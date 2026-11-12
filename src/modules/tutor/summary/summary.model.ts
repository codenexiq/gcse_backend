import type { RowDataPacket } from "mysql2";
import { pool } from "../../../config/db/index.js";

const PENDING_LOG = "b.logged = 0 AND TIMESTAMP(b.session_date, b.start_time) + INTERVAL b.minutes MINUTE < NOW() AND b.session_date >= CURDATE() - INTERVAL 14 DAY";

/** Messages a student (or the admin) sent that the tutor has not read yet. */
export async function unreadFor(tutorId: number): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM chat_messages m JOIN chat_threads t ON t.student_id = m.student_id AND t.staff_id = m.staff_id
      WHERE m.staff_id = ? AND m.sender_id = m.student_id AND m.deleted_at IS NULL AND m.id > t.tutor_read_id`,
    [tutorId]
  );
  return Number(rows[0].n);
}

export async function pendingLogCount(tutorId: number): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM session_bookings b WHERE b.tutor_id = ? AND ${PENDING_LOG}`, [tutorId]);
  return Number(rows[0].n);
}

/** What the header and tabs need: the tutor's name, sessions waiting for a log, and unread messages. */
export async function summary(tutorId: number, name: string) {
  const [pendingLogs, unread] = await Promise.all([pendingLogCount(tutorId), unreadFor(tutorId)]);
  return { name, pendingLogs, unread };
}
