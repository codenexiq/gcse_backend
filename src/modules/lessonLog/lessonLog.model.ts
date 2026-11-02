import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../../config/db/index.js";
import type { Role } from "../auth/user.model.js";
import type { LessonLogInput } from "./lessonLog.schemas.js";

interface Row extends RowDataPacket {
  id: number;
  tutor_id: number;
  tutor_name: string;
  account_name: string;
  tutor_email: string;
  lesson_date: string;
  student_or_class: string;
  lesson_type: string;
  attendance: string;
  duration_minutes: number;
  completed: string;
  homework_assigned: number;
  homework_other: string | null;
  engagement_notes: string | null;
  next_focus: string;
  zoom_recorded: number;
  created_at: Date;
}

const toEntry = (r: Row) => ({
  id: r.id,
  tutorId: r.tutor_id,
  tutorName: r.tutor_name || r.account_name,
  tutorEmail: r.tutor_email,
  lessonDate: r.lesson_date,
  studentOrClass: r.student_or_class,
  lessonType: r.lesson_type,
  attendance: r.attendance,
  durationMinutes: r.duration_minutes,
  completed: r.completed,
  homeworkAssigned: Boolean(r.homework_assigned),
  homeworkOther: r.homework_other ?? "",
  engagementNotes: r.engagement_notes ?? "",
  nextFocus: r.next_focus,
  zoomRecorded: Boolean(r.zoom_recorded),
  createdAt: r.created_at,
});

// DATE_FORMAT keeps the date as plain text (no time zone surprises).
const SELECT = `SELECT l.id, l.tutor_id, l.tutor_name, u.full_name AS account_name, u.email AS tutor_email, DATE_FORMAT(l.lesson_date, '%Y-%m-%d') AS lesson_date,
    l.student_or_class, l.lesson_type, l.attendance, l.duration_minutes, l.completed, l.homework_assigned, l.homework_other,
    l.engagement_notes, l.next_focus, l.zoom_recorded, l.created_at
  FROM lesson_logs l JOIN users u ON u.id = l.tutor_id`;

/** Saves one lesson entry for a tutor. */
export async function create(tutorId: number, f: LessonLogInput) {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO lesson_logs (tutor_id, tutor_name, lesson_date, student_or_class, lesson_type, attendance, duration_minutes, completed,
       homework_assigned, homework_other, engagement_notes, next_focus, zoom_recorded)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [tutorId, f.tutorName, f.lessonDate, f.studentOrClass, f.lessonType, f.attendance, f.durationMinutes, f.completed, f.homeworkAssigned ? 1 : 0, f.homeworkOther || null, f.engagementNotes || null, f.nextFocus, f.zoomRecorded ? 1 : 0]
  );
  const [rows] = await pool.query<Row[]>(`${SELECT} WHERE l.id = ?`, [result.insertId]);
  return toEntry(rows[0]);
}

/** An admin sees every entry; a tutor only their own. Newest lesson first. */
export async function list(viewer: { id: number; role: Role }) {
  const all = viewer.role === "admin";
  const [rows] = await pool.query<Row[]>(`${SELECT} ${all ? "" : "WHERE l.tutor_id = ?"} ORDER BY l.lesson_date DESC, l.id DESC LIMIT 500`, all ? [] : [viewer.id]);
  return rows.map(toEntry);
}

export async function remove(id: number) {
  const [result] = await pool.query<ResultSetHeader>("DELETE FROM lesson_logs WHERE id = ?", [id]);
  return result.affectedRows > 0;
}
