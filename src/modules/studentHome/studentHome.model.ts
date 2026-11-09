import type { RowDataPacket } from "mysql2";
import { pool } from "../../config/db/index.js";
import * as Chat from "../chat/chat.model.js";
import * as Route from "../route/route.model.js";

/** What the top of a student's learning map shows: their tasks, the next sessions and a summary of their messages. */
export async function forStudent(studentId: number) {
  const tasks = await Route.tasksOf(studentId);

  const [sessions] = await pool.query<(RowDataPacket & { id: number; date: string; start_time: string; zoom_link: string; group_name: string | null })[]>(
    `SELECT b.id, DATE_FORMAT(b.session_date, '%Y-%m-%d') AS date, TIME_FORMAT(b.start_time, '%H:%i') AS start_time, b.zoom_link, g.name AS group_name
       FROM session_bookings b LEFT JOIN session_groups g ON g.id = b.group_id
      WHERE b.session_date >= CURDATE()
        AND (b.student_id = ? OR (b.group_id IS NOT NULL AND b.group_id IN (SELECT group_id FROM student_groups WHERE student_id = ?)))
      ORDER BY b.session_date, b.start_time, b.id LIMIT 3`,
    [studentId, studentId]
  );

  const conversations = await Chat.listForStudent(studentId);
  const withMessages = conversations.filter((c) => c.lastAt);
  withMessages.sort((a, b) => new Date(b.lastAt as unknown as string).getTime() - new Date(a.lastAt as unknown as string).getTime());
  const last = withMessages[0];

  return {
    tasks,
    sessions: sessions.map((s) => ({ id: s.id, date: s.date, startTime: s.start_time, zoomLink: s.zoom_link, groupName: s.group_name })),
    messages: {
      unread: conversations.reduce((a, c) => a + Number(c.unread ?? 0), 0),
      last: last ? { from: last.fullName || last.email, text: last.lastBody ?? (last.lastHasFile ? "Sent a file" : "") } : null,
    },
  };
}
