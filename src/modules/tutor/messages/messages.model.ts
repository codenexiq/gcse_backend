import type { RowDataPacket } from "mysql2";
import { saveMessage, type SendMessageInput } from "../../chat/messageWithFile.js";
import { pool } from "../../../config/db/index.js";
import { AppError } from "../../../utils/AppError/index.js";
import { MINE } from "../shared/mine.js";

export interface ThreadSummary {
  /** The student's id: a tutor has one conversation per student. */
  id: number;
  studentName: string;
  unread: number;
  last: { from: "student" | "tutor" | "admin"; text: string; hasAttachment: boolean; at: string } | null;
}

/** Makes sure every student of mine has a conversation with me (so I can message them before they write first). */
async function ensureThreads(tutorId: number) {
  await pool.query(`INSERT IGNORE INTO chat_threads (student_id, staff_id) SELECT DISTINCT e.student_id, ? FROM enrolments e WHERE ${MINE}`, [tutorId, tutorId, tutorId]);
}

/** My conversations, newest first. A student with no messages yet is listed last. */
export async function threads(tutorId: number): Promise<ThreadSummary[]> {
  await ensureThreads(tutorId);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT t.student_id, s.full_name AS student_name,
            (SELECT COUNT(*) FROM chat_messages m WHERE m.student_id = t.student_id AND m.staff_id = t.staff_id
               AND m.sender_id = t.student_id AND m.deleted_at IS NULL AND m.id > t.tutor_read_id) AS unread,
            m.sender_id, su.role AS sender_role, m.body, m.attachment_id, m.created_at
       FROM chat_threads t
       JOIN users s ON s.id = t.student_id
       LEFT JOIN chat_messages m ON m.id = (SELECT MAX(id) FROM chat_messages WHERE student_id = t.student_id AND staff_id = t.staff_id AND deleted_at IS NULL)
       LEFT JOIN users su ON su.id = m.sender_id
      WHERE t.staff_id = ? ORDER BY m.id IS NULL, m.id DESC, s.full_name`,
    [tutorId]
  );
  return rows.map((r) => ({
    id: r.student_id,
    studentName: r.student_name,
    unread: Number(r.unread),
    last: r.sender_role ? { from: r.sender_role, text: r.body ?? "", hasAttachment: Boolean(r.attachment_id), at: r.created_at } : null,
  }));
}

async function owned(tutorId: number, studentId: number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT s.full_name AS student_name, tu.full_name AS tutor_name FROM chat_threads t
       JOIN users s ON s.id = t.student_id JOIN users tu ON tu.id = t.staff_id WHERE t.student_id = ? AND t.staff_id = ?`,
    [studentId, tutorId]
  );
  if (rows.length === 0) throw new AppError(404, "Conversation not found");
  return rows[0];
}

/** Opening a conversation marks everything in it as read. */
export async function thread(tutorId: number, studentId: number) {
  const t = await owned(tutorId, studentId);
  const [msgs] = await pool.query<RowDataPacket[]>(
    `SELECT m.id, m.body, m.created_at, u.role AS sender_role, a.id AS file_id, a.file_name, a.size
       FROM chat_messages m JOIN users u ON u.id = m.sender_id LEFT JOIN chat_attachments a ON a.id = m.attachment_id
      WHERE m.student_id = ? AND m.staff_id = ? AND m.deleted_at IS NULL ORDER BY m.id`,
    [studentId, tutorId]
  );
  const lastId = msgs.length ? Number(msgs[msgs.length - 1].id) : 0;
  await pool.query("UPDATE chat_threads SET tutor_read_id = GREATEST(tutor_read_id, ?), tutor_delivered_id = GREATEST(tutor_delivered_id, ?) WHERE student_id = ? AND staff_id = ?", [lastId, lastId, studentId, tutorId]);
  return {
    id: String(studentId),
    studentName: t.student_name as string,
    tutorName: t.tutor_name as string,
    messages: msgs.map((m) => ({
      id: m.id as number,
      from: m.sender_role as "student" | "tutor" | "admin",
      text: (m.body ?? "") as string,
      attachment: m.file_name ? { id: m.file_id as number, name: m.file_name as string, size: Number(m.size ?? 0) } : null,
      at: m.created_at as string,
    })),
  };
}

export async function send(tutorId: number, studentId: number, input: SendMessageInput) {
  await owned(tutorId, studentId);
  await saveMessage(studentId, tutorId, tutorId, input);
  return thread(tutorId, studentId);
}

/** The "Message" button on a student's profile: makes sure my conversation with that student exists and returns its id. */
export async function open(tutorId: number, studentId: number) {
  const [mine] = await pool.query<RowDataPacket[]>(`SELECT e.id FROM enrolments e WHERE e.student_id = ? AND ${MINE} LIMIT 1`, [studentId, tutorId, tutorId]);
  if (mine.length === 0) throw new AppError(404, "Student not found");
  await pool.query("INSERT IGNORE INTO chat_threads (student_id, staff_id) VALUES (?, ?)", [studentId, tutorId]);
  return { id: studentId };
}
