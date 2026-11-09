import type { RowDataPacket } from "mysql2";
import { pool } from "../../config/db/index.js";
import * as Group from "../group/group.model.js";
import * as Route from "../route/route.model.js";
import * as Lesson from "../lesson/lesson.model.js";
import * as Student from "../student/student.model.js";

interface WaitingRow extends RowDataPacket {
  id: number;
  student_code: string | null;
  full_name: string;
  email: string;
  level: string | null;
  subject: string | null;
  correct: number;
  total: number;
  finished_at: Date;
  avatar_v: number | null;
}

/**
 * Students who have finished the diagnostic and are waiting for a tutor, newest first.
 * A student who has been placed in a group is no longer listed.
 */
export async function waiting() {
  const [rows] = await pool.query<WaitingRow[]>(
    `SELECT u.id, u.user_code AS student_code, u.full_name, u.email, p.level, so.label AS subject, a.correct, a.total, a.created_at AS finished_at,
        (SELECT UNIX_TIMESTAMP(updated_at) FROM user_images WHERE user_id = u.id AND kind = 'avatar') AS avatar_v
       FROM users u
       JOIN diagnostic_attempts a ON a.id = (SELECT MAX(id) FROM diagnostic_attempts WHERE user_id = u.id)
       LEFT JOIN student_profiles p ON p.user_id = u.id
       LEFT JOIN startup_options so ON so.id = p.subject_id
      WHERE u.role = 'student' AND u.is_active = 1 AND NOT EXISTS (SELECT 1 FROM student_groups sg WHERE sg.student_id = u.id)
      ORDER BY a.created_at DESC, a.id DESC LIMIT 200`
  );
  return rows.map((r) => ({
    id: r.id,
    studentCode: r.student_code,
    fullName: r.full_name,
    email: r.email,
    level: r.level,
    subject: r.subject,
    correct: r.correct,
    total: r.total,
    finishedAt: r.finished_at,
    avatarVersion: r.avatar_v ? Number(r.avatar_v) : null,
  }));
}

interface ReviewRow extends RowDataPacket {
  id: number;
  student_code: string | null;
  full_name: string;
  email: string;
  level: string | null;
  tier: string | null;
  subject: string | null;
  exam_board: string | null;
  school_year: string | null;
  target_grade: string | null;
  avatar_v: number | null;
}

/** Everything a tutor needs to place a student: what they chose in About you, and what the diagnostic found. Null if there is no such student. */
export async function review(studentId: number) {
  const [rows] = await pool.query<ReviewRow[]>(
    `SELECT u.id, u.user_code AS student_code, u.full_name, u.email, p.level, p.tier,
        so.label AS subject, eb.label AS exam_board, sy.label AS school_year, tg.label AS target_grade,
        (SELECT UNIX_TIMESTAMP(updated_at) FROM user_images WHERE user_id = u.id AND kind = 'avatar') AS avatar_v
       FROM users u
       LEFT JOIN student_profiles p ON p.user_id = u.id
       LEFT JOIN startup_options so ON so.id = p.subject_id
       LEFT JOIN startup_options eb ON eb.id = p.exam_board_id
       LEFT JOIN startup_options sy ON sy.id = p.school_year_id
       LEFT JOIN startup_options tg ON tg.id = p.target_grade_id
      WHERE u.id = ? AND u.role = 'student'`,
    [studentId]
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    studentCode: r.student_code,
    fullName: r.full_name,
    email: r.email,
    avatarVersion: r.avatar_v ? Number(r.avatar_v) : null,
    about: { level: r.level, tier: r.tier, subject: r.subject, examBoard: r.exam_board, schoolYear: r.school_year, targetGrade: r.target_grade },
    result: await Student.latestResult(r.id),
    topics: await Student.topicStatuses(r.id),
    group: await Group.assignmentOf(r.id),
  };
}

interface SessionRow extends RowDataPacket {
  id: number;
  group_id: number | null;
  session_date: string;
  start_time: string;
  log_topics: string | null;
  log_next: string | null;
  log_engagement: number | null;
  log_focus: number | null;
}

/** What the tutor's page for one student shows: who they are, their group, the sessions coming up and the last session logs. Null if there is no such student. */
export async function overview(studentId: number) {
  const base = await review(studentId);
  if (!base) return null;
  const [contact] = await pool.query<RowDataPacket[]>("SELECT phone FROM users WHERE id = ?", [studentId]);
  const group = base.group ? await Group.find(base.group.groupId) : null;
  // Sessions booked for this student, or for the group they are in.
  const where = "(b.student_id = ? OR (b.group_id IS NOT NULL AND b.group_id IN (SELECT group_id FROM student_groups WHERE student_id = ?)))";
  const pick = `SELECT b.id, b.group_id, DATE_FORMAT(b.session_date, '%Y-%m-%d') AS session_date, TIME_FORMAT(b.start_time, '%H:%i') AS start_time,
      l.topics AS log_topics, l.next_focus AS log_next, l.engagement AS log_engagement, l.focus_score AS log_focus
    FROM session_bookings b LEFT JOIN lesson_logs l ON l.booking_id = b.id`;
  const [upcoming] = await pool.query<SessionRow[]>(`${pick} WHERE ${where} AND b.session_date >= CURDATE() ORDER BY b.session_date, b.start_time, b.id LIMIT 6`, [studentId, studentId]);
  const [logged] = await pool.query<SessionRow[]>(`${pick} WHERE ${where} AND l.id IS NOT NULL ORDER BY b.session_date DESC, b.start_time DESC, b.id DESC LIMIT 6`, [studentId, studentId]);
  return {
    id: base.id,
    studentCode: base.studentCode,
    fullName: base.fullName,
    email: base.email,
    phone: (contact[0]?.phone as string | null) ?? null,
    avatarVersion: base.avatarVersion,
    about: base.about,
    group: group ? { id: group.id, name: group.name } : null,
    routes: await Route.routesOf(studentId),
    results: await Lesson.resultsOf(studentId, 10),
    upcoming: upcoming.map((r) => ({ id: r.id, date: r.session_date, startTime: r.start_time, kind: r.group_id !== null ? ("group" as const) : ("one" as const) })),
    logs: logged.map((r) => ({ id: r.id, date: r.session_date, topics: r.log_topics ?? "", nextStep: r.log_next ?? "", engagement: r.log_engagement, focus: r.log_focus })),
  };
}

const avg = (nums: number[]) => (nums.length === 0 ? null : Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10);

/** One student's month in numbers, worked out from their booked sessions, session logs and quiz attempts. `month` is YYYY-MM. */
export async function monthReport(studentId: number, month: string) {
  const base = await review(studentId);
  if (!base) return null;
  const from = `${month}-01`;
  const where = "(b.student_id = ? OR (b.group_id IS NOT NULL AND b.group_id IN (SELECT group_id FROM student_groups WHERE student_id = ?)))";
  const range = "b.session_date >= ? AND b.session_date < DATE_ADD(?, INTERVAL 1 MONTH)";
  const [booked] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM session_bookings b WHERE ${where} AND ${range}`, [studentId, studentId, from, from]);
  const [logs] = await pool.query<(RowDataPacket & { topics: string | null; went_well: string | null; next_focus: string | null; engagement: number | null; focus_score: number | null; attendance: string })[]>(
    `SELECT l.topics, l.engagement_notes AS went_well, l.next_focus, l.engagement, l.focus_score, l.attendance
       FROM session_bookings b JOIN lesson_logs l ON l.booking_id = b.id WHERE ${where} AND ${range} ORDER BY b.session_date, b.start_time`,
    [studentId, studentId, from, from]
  );
  const [quizzes] = await pool.query<(RowDataPacket & { title: string; marks: number; total_marks: number })[]>(
    `SELECT q.title, a.marks, a.total_marks FROM quiz_attempts a JOIN quizzes q ON q.id = a.quiz_id
      WHERE a.student_id = ? AND a.created_at >= ? AND a.created_at < DATE_ADD(?, INTERVAL 1 MONTH) ORDER BY a.created_at`,
    [studentId, from, from]
  );
  const split = (text: string) => text.split(/[,;\n]/).map((t) => t.trim()).filter(Boolean);
  const unique = (list: string[]) => [...new Set(list)];
  const scores = quizzes.map((q) => ({ title: q.title, percent: q.total_marks > 0 ? Math.round((q.marks / q.total_marks) * 100) : 0 }));
  return {
    month,
    name: base.fullName,
    about: base.about,
    sessions: { held: logs.length, booked: Number(booked[0].n) },
    engagement: avg(logs.filter((l) => l.engagement).map((l) => Number(l.engagement))),
    focus: avg(logs.filter((l) => l.focus_score).map((l) => Number(l.focus_score))),
    quizAverage: scores.length === 0 ? null : Math.round(scores.reduce((a, s) => a + s.percent, 0) / scores.length),
    topics: unique(logs.flatMap((l) => split(l.topics ?? ""))),
    scores,
    wentWell: unique(logs.map((l) => (l.went_well ?? "").trim()).filter(Boolean)),
    nextSteps: unique(logs.map((l) => (l.next_focus ?? "").trim()).filter(Boolean)),
  };
}
