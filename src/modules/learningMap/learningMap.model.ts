import type { RowDataPacket } from "mysql2";
import { pool } from "../../config/db/index.js";
import * as Group from "../group/group.model.js";
import * as Review from "../studentReview/studentReview.model.js";

type Status = "mastered" | "in_progress" | "needs_work" | "not_started";

/** The four hours a week a student is asked to practise. */
const WEEKLY_GOAL_MINUTES = 240;

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** The student's learning map: every topic by strand with its status, what to do next, this week's practice and the next live session. Null if there is no such student. */
export async function forStudent(studentId: number) {
  const base = await Review.review(studentId);
  if (!base) return null;

  const [strandRows] = await pool.query<(RowDataPacket & { strand: string; topic: string })[]>(
    `SELECT s.name AS strand, t.name AS topic FROM learning_topics t JOIN learning_strands s ON s.id = t.strand_id ORDER BY s.position, s.id, t.position, t.id`
  );
  // A topic shows a Lesson button when a tutor has published a lesson with something in it; the score is the latest lesson result.
  const [lessonRows] = await pool.query<(RowDataPacket & { topic: string; id: number })[]>("SELECT topic, MIN(id) AS id FROM lessons WHERE published = 1 AND blocks <> '[]' GROUP BY topic");
  const lessonOf = new Map(lessonRows.map((r) => [r.topic, r.id]));
  const [scoreRows] = await pool.query<(RowDataPacket & { topic: string; percent: number })[]>("SELECT topic, percent FROM lesson_results WHERE student_id = ? ORDER BY id", [studentId]);
  const scoreOf = new Map(scoreRows.map((r) => [r.topic, Number(r.percent)]));
  const status = new Map<string, Status>(base.topics.map((t) => [t.topic, t.status]));

  const strands: { name: string; topics: { name: string; status: Status; score: number | null; lessonId: number | null }[] }[] = [];
  for (const r of strandRows) {
    let strand = strands.find((s) => s.name === r.strand);
    if (!strand) strands.push((strand = { name: r.strand, topics: [] }));
    strand.topics.push({ name: r.topic, status: status.get(r.topic) ?? "not_started", score: scoreOf.get(r.topic) ?? null, lessonId: lessonOf.get(r.topic) ?? null });
  }
  const all = strands.flatMap((s) => s.topics);

  // The group's focus topics come first when choosing what to do next.
  const group = base.group ? await Group.forStudent(studentId) : null;
  const focus = new Set(group?.topics ?? []);
  let next: (typeof all)[number] | null = null;
  for (const wanted of ["in_progress", "needs_work", "not_started"] as const) {
    const ofKind = all.filter((t) => t.status === wanted);
    next = ofKind.find((t) => focus.has(t.name)) ?? ofKind[0] ?? null;
    if (next) break;
  }

  // Practice minutes from Monday to Sunday of this week.
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const [minuteRows] = await pool.query<(RowDataPacket & { day: string; minutes: number })[]>(
    "SELECT DATE_FORMAT(day, '%Y-%m-%d') AS day, minutes FROM practice_minutes WHERE student_id = ? AND day >= ? AND day <= DATE_ADD(?, INTERVAL 6 DAY)",
    [studentId, ymd(monday), ymd(monday)]
  );
  const week = Array.from({ length: 7 }, (_, i) => {
    const day = ymd(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
    return Number(minuteRows.find((m) => m.day === day)?.minutes ?? 0);
  });

  // The next booked session (their own or the group's); without one, the group's weekly slot.
  let nextSession: { date: string | null; dayOfWeek: number; startTime: string; groupName: string; tutorName: string; zoomLink: string } | null = null;
  if (group) {
    const [booked] = await pool.query<(RowDataPacket & { date: string; start_time: string; zoom_link: string; tutor: string })[]>(
      `SELECT DATE_FORMAT(b.session_date, '%Y-%m-%d') AS date, TIME_FORMAT(b.start_time, '%H:%i') AS start_time, b.zoom_link, COALESCE(NULLIF(t.full_name, ''), t.email) AS tutor
         FROM session_bookings b JOIN users t ON t.id = b.tutor_id
        WHERE (b.student_id = ? OR b.group_id = ?) AND b.session_date >= CURDATE() ORDER BY b.session_date, b.start_time, b.id LIMIT 1`,
      [studentId, group.id]
    );
    nextSession = booked[0]
      ? { date: booked[0].date, dayOfWeek: group.dayOfWeek, startTime: booked[0].start_time, groupName: group.name, tutorName: booked[0].tutor, zoomLink: booked[0].zoom_link }
      : { date: null, dayOfWeek: group.dayOfWeek, startTime: group.startTime, groupName: group.name, tutorName: group.tutorName, zoomLink: group.zoomLink };
  }

  return {
    name: base.fullName,
    about: base.about,
    mastered: all.filter((t) => t.status === "mastered").length,
    total: all.length,
    next: next ? { name: next.name, status: next.status, lessonId: next.lessonId } : null,
    strands,
    week,
    weeklyGoal: WEEKLY_GOAL_MINUTES,
    nextSession,
  };
}
