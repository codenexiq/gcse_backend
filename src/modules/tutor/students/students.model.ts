import type { RowDataPacket } from "mysql2";
import { pool } from "../../../config/db/index.js";
import { AppError } from "../../../utils/AppError/index.js";
import { parseList } from "../../admin/shared/lists.js";
import { addDays, monday, MINE, ownsEnrolment, ymd } from "../shared/mine.js";
import type { UpdateEnrolmentInput } from "./students.schemas.js";

export type TopicStatus = "M" | "P" | "W" | "N";

/** Mastered, needs-work and total topic counts for each of the given subjects (enrolments). */
async function masteryOf(ids: number[]): Promise<Map<number, { m: number; w: number; all: number }>> {
  const out = new Map<number, { m: number; w: number; all: number }>();
  if (ids.length === 0) return out;
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT e.id,
            COUNT(t.id) AS total,
            SUM(CASE WHEN ts.status = 'M' THEN 1 ELSE 0 END) AS m,
            SUM(CASE WHEN ts.status = 'W' THEN 1 ELSE 0 END) AS w
       FROM enrolments e
       LEFT JOIN strands s ON s.subject_id = e.subject_id AND s.level_id = e.level_id
       LEFT JOIN topics t ON t.strand_id = s.id
       LEFT JOIN enrolment_topic_status ts ON ts.enrolment_id = e.id AND ts.topic_id = t.id
      WHERE e.id IN (?) GROUP BY e.id`,
    [ids]
  );
  for (const r of rows) out.set(r.id, { m: Number(r.m ?? 0), w: Number(r.w ?? 0), all: Number(r.total) });
  return out;
}

/** "My students": every subject of mine with the grades and how much of the learning map is mastered; and my groups. */
export async function list(tutorId: number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT e.id, e.tier, e.current_grade, e.target_grade, e.diagnostic_done, e.subject_id, u.full_name, sp.school_year,
            s.name AS subject_name, s.icon, s.color, l.short_name, g.name AS group_name
       FROM enrolments e
       JOIN users u ON u.id = e.student_id JOIN student_profiles sp ON sp.user_id = u.id
       JOIN subjects s ON s.id = e.subject_id JOIN levels l ON l.id = e.level_id
       LEFT JOIN session_groups g ON g.id = e.group_id
      WHERE ${MINE} ORDER BY e.id`,
    [tutorId, tutorId]
  );
  const mastery = await masteryOf(rows.map((r) => r.id));
  const [groups] = await pool.query<RowDataPacket[]>(
    `SELECT g.id, g.name, g.day_of_week, g.start_time, g.subject_id, s.icon, s.color, (SELECT COUNT(*) FROM enrolments e WHERE e.group_id = g.id) AS n
       FROM session_groups g JOIN subjects s ON s.id = g.subject_id WHERE g.tutor_id = ? ORDER BY g.id`,
    [tutorId]
  );
  return {
    students: rows.map((r) => ({
      enrolmentId: r.id as number,
      name: r.full_name as string,
      year: r.school_year as string,
      pathName: `${r.short_name} ${r.subject_name}${r.tier ? ` · ${r.tier}` : ""}`,
      groupName: (r.group_name ?? null) as string | null,
      current: r.current_grade as string,
      target: r.target_grade as string,
      mastered: mastery.get(r.id)?.m ?? 0,
      total: mastery.get(r.id)?.all ?? 0,
      diagnosticDone: Boolean(r.diagnostic_done),
      subject: { id: r.subject_id as string, icon: r.icon as string, color: r.color as string },
    })),
    groups: groups.map((g) => ({
      id: g.id as number,
      name: g.name as string,
      day: g.day_of_week as number,
      start: String(g.start_time).slice(0, 5),
      students: Number(g.n),
      subject: { id: g.subject_id as string, icon: g.icon as string, color: g.color as string },
    })),
  };
}

/** One student's subject: grades, learning map, recent work, sessions and what the student sees. */
export async function profile(tutorId: number, enrolmentId: number) {
  await ownsEnrolment(tutorId, enrolmentId);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT e.id, e.student_id, e.subject_id, e.level_id, e.tier, e.board, e.current_grade, e.target_grade, e.group_id, e.diagnostic_done, e.diagnostic_score, e.misconceptions,
            u.full_name, sp.school_year, pl.name AS plan_name, s.name AS subject_name, s.icon, s.color, l.short_name, l.grades
       FROM enrolments e
       JOIN users u ON u.id = e.student_id JOIN student_profiles sp ON sp.user_id = u.id JOIN plans pl ON pl.id = sp.plan_id
       JOIN subjects s ON s.id = e.subject_id JOIN levels l ON l.id = e.level_id
      WHERE e.id = ?`,
    [enrolmentId]
  );
  const e = rows[0];
  const [topics] = await pool.query<RowDataPacket[]>(
    `SELECT s.id AS strand_id, s.name AS strand, t.id, t.name, COALESCE(ts.status, 'N') AS status
       FROM strands s JOIN topics t ON t.strand_id = s.id
       LEFT JOIN enrolment_topic_status ts ON ts.enrolment_id = ? AND ts.topic_id = t.id
      WHERE s.subject_id = ? AND s.level_id = ? ORDER BY s.position, s.id, t.position, t.id`,
    [enrolmentId, e.subject_id, e.level_id]
  );
  const strands: { id: number; name: string; topics: { id: number; name: string; status: TopicStatus }[] }[] = [];
  for (const t of topics) {
    let s = strands.find((x) => x.id === t.strand_id);
    if (!s) strands.push((s = { id: t.strand_id, name: t.strand, topics: [] }));
    s.topics.push({ id: t.id, name: t.name, status: t.status });
  }
  const all = topics.length;
  const mastered = topics.filter((t) => t.status === "M").length;

  const weekStart = ymd(monday(new Date()));
  const weekEnd = ymd(addDays(monday(new Date()), 7));
  const [mins] = await pool.query<RowDataPacket[]>("SELECT COALESCE(SUM(minutes), 0) AS n FROM study_minutes WHERE enrolment_id = ? AND study_date >= ? AND study_date < ?", [enrolmentId, weekStart, weekEnd]);
  const [results] = await pool.query<RowDataPacket[]>("SELECT title, pct, created_at FROM learning_results WHERE enrolment_id = ? ORDER BY created_at DESC, id DESC", [enrolmentId]);
  const [sessions] = await pool.query<RowDataPacket[]>(
    `SELECT l.id, b.session_date, l.topic_name, l.note, a.present FROM lesson_log_attendance a
       JOIN lesson_logs l ON l.id = a.log_id JOIN session_bookings b ON b.id = l.booking_id
      WHERE a.enrolment_id = ? ORDER BY b.session_date DESC, l.id DESC LIMIT 5`,
    [enrolmentId]
  );
  const [groups] = await pool.query<RowDataPacket[]>("SELECT id, name FROM session_groups WHERE subject_id = ? AND level_id = ? ORDER BY id", [e.subject_id, e.level_id]);

  return {
    enrolment: {
      id: e.id as number,
      studentId: e.student_id as number,
      studentName: e.full_name as string,
      year: e.school_year as string,
      pathName: `${e.short_name} ${e.subject_name}${e.tier ? ` · ${e.tier}` : ""}`,
      board: e.board as string,
      planName: e.plan_name as string,
      subject: { id: e.subject_id as string, icon: e.icon as string, color: e.color as string },
      current: e.current_grade as string,
      target: e.target_grade as string,
      groupId: (e.group_id ?? null) as number | null,
    },
    grades: parseList(e.grades),
    stats: {
      mastered,
      all,
      diagnostic: e.diagnostic_done ? (e.diagnostic_score != null ? `${e.diagnostic_score}%` : "Done") : "To do",
      minutesThisWeek: Number(mins[0].n),
      quizzes: results.length,
    },
    strands,
    misconceptions: parseList(e.misconceptions),
    recent: results.slice(0, 6).map((r) => ({ title: r.title as string, pct: Number(r.pct), at: r.created_at as string })),
    sessions: sessions.map((s) => ({ id: s.id as number, date: s.session_date as string, topicName: s.topic_name as string, present: Boolean(s.present), note: s.note as string })),
    groups: groups.map((g) => ({ id: g.id as number, name: g.name as string })),
  };
}

export async function updateEnrolment(tutorId: number, enrolmentId: number, input: UpdateEnrolmentInput) {
  await ownsEnrolment(tutorId, enrolmentId);
  const [rows] = await pool.query<RowDataPacket[]>("SELECT subject_id, level_id, current_grade, target_grade, group_id FROM enrolments WHERE id = ?", [enrolmentId]);
  const e = rows[0];
  const groupId = input.groupId === undefined ? e.group_id : input.groupId;
  if (groupId) {
    const [g] = await pool.query<RowDataPacket[]>("SELECT id FROM session_groups WHERE id = ? AND subject_id = ? AND level_id = ?", [groupId, e.subject_id, e.level_id]);
    if (g.length === 0) throw new AppError(400, "That group is for a different subject or level.");
  }
  await pool.query("UPDATE enrolments SET current_grade = ?, target_grade = ?, group_id = ? WHERE id = ?", [input.current ?? e.current_grade, input.target ?? e.target_grade, groupId, enrolmentId]);
}

const ORDER: TopicStatus[] = ["N", "P", "W", "M"];

/** Click a topic on the learning map: Not started, In progress, Needs work, Mastered, and round again. */
export async function cycleTopic(tutorId: number, enrolmentId: number, topicId: number): Promise<TopicStatus> {
  await ownsEnrolment(tutorId, enrolmentId);
  const [ok] = await pool.query<RowDataPacket[]>(
    `SELECT t.id FROM topics t JOIN strands s ON s.id = t.strand_id JOIN enrolments e ON e.subject_id = s.subject_id AND e.level_id = s.level_id WHERE e.id = ? AND t.id = ?`,
    [enrolmentId, topicId]
  );
  if (ok.length === 0) throw new AppError(404, "Topic not found");
  const [cur] = await pool.query<RowDataPacket[]>("SELECT status FROM enrolment_topic_status WHERE enrolment_id = ? AND topic_id = ?", [enrolmentId, topicId]);
  const next = ORDER[(ORDER.indexOf((cur[0]?.status as TopicStatus | undefined) ?? "N") + 1) % 4];
  await pool.query("INSERT INTO enrolment_topic_status (enrolment_id, topic_id, status) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status)", [enrolmentId, topicId, next]);
  return next;
}
