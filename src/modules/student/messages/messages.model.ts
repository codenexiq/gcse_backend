import type { RowDataPacket } from "mysql2";
import { saveMessage, type SendMessageInput } from "../../chat/messageWithFile.js";
import { pool } from "../../../config/db/index.js";
import { AppError } from "../../../utils/AppError/index.js";
import { TUTOR_OF } from "../shared/mine.js";

export interface ThreadSummary {
  /** The teacher's id: a student has one conversation per teacher. */
  id: number;
  tutorName: string;
  unread: number;
  last: { from: "student" | "tutor" | "admin"; text: string; hasAttachment: boolean; at: string } | null;
}

/** The teachers this student can message: the teachers of their subjects and groups. */
async function myTutors(studentId: number): Promise<{ id: number; name: string }[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT DISTINCT u.id, u.full_name FROM enrolments e JOIN users u ON u.id = ${TUTOR_OF} WHERE e.student_id = ? ORDER BY u.full_name`,
    [studentId]
  );
  return rows.map((r) => ({ id: r.id as number, name: r.full_name as string }));
}

export async function threads(studentId: number): Promise<ThreadSummary[]> {
  const tutors = await myTutors(studentId);
  const out: ThreadSummary[] = [];
  for (const t of tutors) {
    await pool.query("INSERT IGNORE INTO chat_threads (student_id, staff_id) VALUES (?, ?)", [studentId, t.id]);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT (SELECT COUNT(*) FROM chat_messages m WHERE m.student_id = c.student_id AND m.staff_id = c.staff_id AND m.sender_id <> c.student_id AND m.deleted_at IS NULL AND m.id > c.student_read_id) AS unread,
              m.body, m.attachment_id, m.created_at, su.role AS sender_role
         FROM chat_threads c
         LEFT JOIN chat_messages m ON m.id = (SELECT MAX(id) FROM chat_messages WHERE student_id = c.student_id AND staff_id = c.staff_id AND deleted_at IS NULL)
         LEFT JOIN users su ON su.id = m.sender_id
        WHERE c.student_id = ? AND c.staff_id = ?`,
      [studentId, t.id]
    );
    const r = rows[0];
    out.push({ id: t.id, tutorName: t.name, unread: Number(r.unread), last: r.sender_role ? { from: r.sender_role, text: r.body ?? "", hasAttachment: Boolean(r.attachment_id), at: r.created_at } : null });
  }
  return out;
}

async function owned(studentId: number, tutorId: number) {
  const tutor = (await myTutors(studentId)).find((t) => t.id === tutorId);
  if (!tutor) throw new AppError(404, "Conversation not found");
  return tutor;
}

/** Opening a conversation marks everything in it as read. */
export async function thread(studentId: number, tutorId: number) {
  const tutor = await owned(studentId, tutorId);
  await pool.query("INSERT IGNORE INTO chat_threads (student_id, staff_id) VALUES (?, ?)", [studentId, tutorId]);
  const [me] = await pool.query<RowDataPacket[]>("SELECT full_name FROM users WHERE id = ?", [studentId]);
  const [msgs] = await pool.query<RowDataPacket[]>(
    `SELECT m.id, m.body, m.created_at, u.role AS sender_role, a.id AS file_id, a.file_name, a.size
       FROM chat_messages m JOIN users u ON u.id = m.sender_id LEFT JOIN chat_attachments a ON a.id = m.attachment_id
      WHERE m.student_id = ? AND m.staff_id = ? AND m.deleted_at IS NULL ORDER BY m.id`,
    [studentId, tutorId]
  );
  const lastId = msgs.length ? Number(msgs[msgs.length - 1].id) : 0;
  await pool.query("UPDATE chat_threads SET student_read_id = GREATEST(student_read_id, ?), student_delivered_id = GREATEST(student_delivered_id, ?) WHERE student_id = ? AND staff_id = ?", [lastId, lastId, studentId, tutorId]);
  return {
    id: String(tutorId),
    studentName: me[0].full_name as string,
    tutorName: tutor.name,
    messages: msgs.map((m) => ({
      id: m.id as number,
      from: m.sender_role as "student" | "tutor" | "admin",
      text: (m.body ?? "") as string,
      attachment: m.file_name ? { id: m.file_id as number, name: m.file_name as string, size: Number(m.size ?? 0) } : null,
      at: m.created_at as string,
    })),
  };
}

export async function send(studentId: number, tutorId: number, input: SendMessageInput) {
  await owned(studentId, tutorId);
  await saveMessage(studentId, tutorId, studentId, input);
  return thread(studentId, tutorId);
}

export async function unread(studentId: number): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM chat_messages m JOIN chat_threads c ON c.student_id = m.student_id AND c.staff_id = m.staff_id
      WHERE m.student_id = ? AND m.sender_id <> m.student_id AND m.deleted_at IS NULL AND m.id > c.student_read_id`,
    [studentId]
  );
  return Number(rows[0].n);
}
