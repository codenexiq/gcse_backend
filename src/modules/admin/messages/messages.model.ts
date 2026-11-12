import type { RowDataPacket } from "mysql2";
import { saveMessage, type SendMessageInput } from "../../chat/messageWithFile.js";
import { pool } from "../../../config/db/index.js";
import { AppError } from "../../../utils/AppError/index.js";

export interface ThreadSummary {
  /** "studentId-staffId": the chat belongs to one student and one tutor. */
  id: string;
  studentName: string;
  tutorName: string;
  last: { from: "student" | "tutor" | "admin"; text: string; hasAttachment: boolean; at: string } | null;
}

/** Every student and tutor conversation that has at least one message, newest first (the admin reads them all for safeguarding). */
export async function threads(): Promise<ThreadSummary[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT t.student_id, t.staff_id, s.full_name AS student_name, st.full_name AS staff_name,
            m.sender_id, su.role AS sender_role, m.body, m.attachment_id, m.created_at
       FROM chat_threads t
       JOIN users s  ON s.id  = t.student_id
       JOIN users st ON st.id = t.staff_id
       JOIN chat_messages m ON m.id = (SELECT MAX(id) FROM chat_messages WHERE student_id = t.student_id AND staff_id = t.staff_id)
       JOIN users su ON su.id = m.sender_id
      ORDER BY m.id DESC`
  );
  return rows.map((r) => ({
    id: `${r.student_id}-${r.staff_id}`,
    studentName: r.student_name,
    tutorName: r.staff_name,
    last: { from: r.sender_role, text: r.body ?? "", hasAttachment: Boolean(r.attachment_id), at: r.created_at },
  }));
}

export async function thread(studentId: number, staffId: number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT s.full_name AS student_name, st.full_name AS staff_name
       FROM chat_threads t JOIN users s ON s.id = t.student_id JOIN users st ON st.id = t.staff_id
      WHERE t.student_id = ? AND t.staff_id = ?`,
    [studentId, staffId]
  );
  const t = rows[0];
  if (!t) throw new AppError(404, "Conversation not found");
  const [msgs] = await pool.query<RowDataPacket[]>(
    `SELECT m.id, m.body, m.created_at, u.role AS sender_role, a.id AS file_id, a.file_name, a.size
       FROM chat_messages m JOIN users u ON u.id = m.sender_id LEFT JOIN chat_attachments a ON a.id = m.attachment_id
      WHERE m.student_id = ? AND m.staff_id = ? ORDER BY m.id`,
    [studentId, staffId]
  );
  return {
    id: `${studentId}-${staffId}`,
    studentName: t.student_name as string,
    tutorName: t.staff_name as string,
    messages: msgs.map((m) => ({
      id: m.id as number,
      from: m.sender_role as "student" | "tutor" | "admin",
      text: (m.body ?? "") as string,
      attachment: m.file_name ? { id: m.file_id as number, name: m.file_name as string, size: Number(m.size ?? 0) } : null,
      at: m.created_at as string,
    })),
  };
}

/** The admin replies in a conversation; both people see it in their chat. */
export async function send(studentId: number, staffId: number, adminId: number, input: SendMessageInput) {
  await thread(studentId, staffId);
  await saveMessage(studentId, staffId, adminId, input);
  return thread(studentId, staffId);
}
