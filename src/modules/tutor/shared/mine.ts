import type { RowDataPacket } from "mysql2";
import { pool } from "../../../config/db/index.js";
import { AppError } from "../../../utils/AppError/index.js";

/** SQL for "this subject is one of my students'": assigned to me directly, or in one of my groups. Use with `[tutorId, tutorId]`. */
export const MINE = "(e.tutor_id = ? OR e.group_id IN (SELECT id FROM session_groups WHERE tutor_id = ?))";

export async function ownsEnrolment(tutorId: number, enrolmentId: number): Promise<void> {
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT e.id FROM enrolments e WHERE e.id = ? AND ${MINE}`, [enrolmentId, tutorId, tutorId]);
  if (rows.length === 0) throw new AppError(404, "Student not found");
}

/** The ids of every subject of mine (so counts match: one student with two subjects counts twice, as in the prototype). */
export async function myEnrolmentIds(tutorId: number): Promise<number[]> {
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT e.id FROM enrolments e WHERE ${MINE} ORDER BY e.id`, [tutorId, tutorId]);
  return rows.map((r) => r.id as number);
}

export const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const monday = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
