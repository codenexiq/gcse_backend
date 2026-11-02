import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../../config/db/index.js";
import type { SendInput } from "./monthlyReport.schemas.js";

interface Row extends RowDataPacket {
  id: number;
  subject: string;
  month: string;
  data: string;
  updated_at: Date;
}

/** Sends a report to a student. Sending the same subject and month again replaces the earlier one. */
export async function send(authorId: number, { studentId, subject, month, data }: SendInput) {
  const [student] = await pool.query<RowDataPacket[]>("SELECT id FROM users WHERE id = ? AND role = 'student'", [studentId]);
  if (student.length === 0) return null;
  await pool.query<ResultSetHeader>(
    `INSERT INTO monthly_reports (student_id, author_id, subject, month, data) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE author_id = VALUES(author_id), data = VALUES(data)`,
    [studentId, authorId, subject, month, JSON.stringify(data)]
  );
  return { studentId, subject, month };
}

/** The months already sent to one student (so a tutor can see what exists). */
export async function listForStudent(studentId: number) {
  const [rows] = await pool.query<Row[]>(
    "SELECT id, subject, month, updated_at FROM monthly_reports WHERE student_id = ? ORDER BY updated_at DESC, id DESC LIMIT 200",
    [studentId]
  );
  return rows.map((r) => ({ id: r.id, subject: r.subject, month: r.month, updated_at: r.updated_at }));
}

/** One report, only if it belongs to this student. */
export async function getForStudent(studentId: number, id: number) {
  const [rows] = await pool.query<Row[]>("SELECT id, subject, month, data, updated_at FROM monthly_reports WHERE id = ? AND student_id = ?", [id, studentId]);
  if (rows.length === 0) return null;
  const r = rows[0];
  return { id: r.id, subject: r.subject, month: r.month, updated_at: r.updated_at, data: JSON.parse(r.data) as unknown };
}

interface TutorRow extends Row {
  student_id: number;
  full_name: string;
  email: string;
  avatar_v?: number | null;
}

/** Every report that has been sent, newest first, with the student it is for (the tutor's table). */
export async function listAll() {
  const [rows] = await pool.query<TutorRow[]>(
    `SELECT r.id, r.student_id, u.full_name, u.email, r.subject, r.month, r.updated_at, (SELECT UNIX_TIMESTAMP(updated_at) FROM user_images WHERE user_id = u.id AND kind = 'avatar') AS avatar_v
     FROM monthly_reports r JOIN users u ON u.id = r.student_id
     ORDER BY r.updated_at DESC, r.id DESC LIMIT 500`
  );
  return rows.map((r) => ({
    id: r.id,
    student_id: r.student_id,
    full_name: r.full_name,
    email: r.email,
    subject: r.subject,
    month: r.month,
    updated_at: r.updated_at,
    /** Changes whenever the student's profile picture changes; null when they have none. */
    avatar_version: r.avatar_v ? Number(r.avatar_v) : null,
  }));
}

/** One report with its student, for a tutor to read. */
export async function getOne(id: number) {
  const [rows] = await pool.query<TutorRow[]>(
    `SELECT r.id, r.student_id, u.full_name, u.email, r.subject, r.month, r.data, r.updated_at
     FROM monthly_reports r JOIN users u ON u.id = r.student_id WHERE r.id = ?`,
    [id]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return { id: r.id, student_id: r.student_id, full_name: r.full_name, email: r.email, subject: r.subject, month: r.month, updated_at: r.updated_at, data: JSON.parse(r.data) as unknown };
}
