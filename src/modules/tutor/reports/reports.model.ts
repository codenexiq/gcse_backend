import type { RowDataPacket } from "mysql2";
import { pool } from "../../../config/db/index.js";
import { ownsEnrolment } from "../shared/mine.js";

const monthKey = () => new Date().toISOString().slice(0, 7);
export const monthName = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
};
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

export interface ReportFacts {
  month: string;
  attended: number;
  sessions: number;
  topics: string[];
  quizzes: number;
  avg: number | null;
  mastered: number;
  all: number;
  weak: string[];
  notes: string[];
}

/** The month's numbers for one student's subject: sessions attended, quizzes, topics mastered, topics needing work. */
export async function facts(enrolmentId: number): Promise<ReportFacts> {
  const mk = monthKey();
  const [logs] = await pool.query<RowDataPacket[]>(
    `SELECT l.topic_name, l.note, a.present FROM lesson_log_attendance a
       JOIN lesson_logs l ON l.id = a.log_id JOIN session_bookings b ON b.id = l.booking_id
      WHERE a.enrolment_id = ? AND DATE_FORMAT(b.session_date, '%Y-%m') = ? ORDER BY b.session_date`,
    [enrolmentId, mk]
  );
  const [res] = await pool.query<RowDataPacket[]>("SELECT pct FROM learning_results WHERE enrolment_id = ? AND DATE_FORMAT(created_at, '%Y-%m') = ?", [enrolmentId, mk]);
  const [topics] = await pool.query<RowDataPacket[]>(
    `SELECT t.name, COALESCE(ts.status, 'N') AS status FROM enrolments e
       JOIN strands s ON s.subject_id = e.subject_id AND s.level_id = e.level_id JOIN topics t ON t.strand_id = s.id
       LEFT JOIN enrolment_topic_status ts ON ts.enrolment_id = e.id AND ts.topic_id = t.id
      WHERE e.id = ? ORDER BY s.position, s.id, t.position, t.id`,
    [enrolmentId]
  );
  return {
    month: monthName(mk),
    attended: logs.filter((l) => l.present).length,
    sessions: logs.length,
    topics: logs.map((l) => l.topic_name as string).filter(Boolean),
    quizzes: res.length,
    avg: res.length ? Math.round(res.reduce((a, r) => a + Number(r.pct), 0) / res.length) : null,
    mastered: topics.filter((t) => t.status === "M").length,
    all: topics.length,
    weak: topics.filter((t) => t.status === "W").map((t) => t.name as string),
    notes: logs.map((l) => l.note as string).filter(Boolean),
  };
}

/** A first draft of the report written from the facts. The tutor edits it freely. */
export function template(firstName: string, f: ReportFacts, current: string, target: string) {
  return (
    (f.sessions ? `${firstName} attended ${f.attended} of ${f.sessions} sessions in ${f.month}${f.topics.length ? `, covering ${f.topics.slice(0, 4).join(", ")}` : ""}. ` : "") +
    (f.quizzes ? `${firstName} completed ${plural(f.quizzes, "quiz")} with an average of ${f.avg}%. ` : "") +
    `${firstName} has mastered ${f.mastered} of ${f.all} topics on the learning map. ` +
    (f.weak.length ? `Next we will focus on ${f.weak.slice(0, 3).join(", ")}. ` : "") +
    `Current grade: ${current || "–"}, target: ${target || "–"}.`
  );
}

/** The report for this month if one was already sent to the admin, otherwise a fresh draft. */
export async function forEnrolment(tutorId: number, enrolmentId: number) {
  await ownsEnrolment(tutorId, enrolmentId);
  const [e] = await pool.query<RowDataPacket[]>("SELECT u.full_name, e.current_grade, e.target_grade FROM enrolments e JOIN users u ON u.id = e.student_id WHERE e.id = ?", [enrolmentId]);
  const f = await facts(enrolmentId);
  const [existing] = await pool.query<RowDataPacket[]>("SELECT body, status FROM monthly_reports WHERE enrolment_id = ? AND report_month = ?", [enrolmentId, monthKey()]);
  const firstName = String(e[0].full_name).trim().split(/\s+/)[0] || "The student";
  return { facts: f, text: existing[0]?.body ?? template(firstName, f, e[0].current_grade, e[0].target_grade), status: (existing[0]?.status as string | undefined) ?? null };
}

/** Sends the report to the admin team (they email it to the parents). A second send for the same month replaces the first. */
export async function send(tutorId: number, enrolmentId: number, text: string) {
  await ownsEnrolment(tutorId, enrolmentId);
  await pool.query(
    `INSERT INTO monthly_reports (enrolment_id, tutor_id, report_month, body, status) VALUES (?, ?, ?, ?, 'ready')
     ON DUPLICATE KEY UPDATE body = VALUES(body), tutor_id = VALUES(tutor_id), status = 'ready', sent_at = NULL`,
    [enrolmentId, tutorId, monthKey(), text]
  );
}
