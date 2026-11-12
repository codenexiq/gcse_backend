import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { inTransaction, pool } from "../../../config/db/index.js";
import { AppError } from "../../../utils/AppError/index.js";
import { addDays, monday, MINE, pad, ymd } from "../shared/mine.js";
import { pendingLogCount, unreadFor } from "../summary/summary.model.js";
import type { BookInput, LogInput } from "./today.schemas.js";

export interface SessionRow {
  id: number;
  who: string;
  kind: "group" | "one";
  date: string;
  start: string;
  mins: number;
  logged: boolean;
  past: boolean;
  subject: { id: string; icon: string; color: string } | null;
}

const hhmm = (t: string) => t.slice(0, 5);

/** One session with its name ("Thursday GCSE Maths" or "Hira Javed · Maths") and subject. */
const SESSION_SQL = `
  SELECT b.id, b.kind, b.session_date, b.start_time, b.minutes, b.logged,
         (TIMESTAMP(b.session_date, b.start_time) + INTERVAL b.minutes MINUTE < NOW()) AS past,
         COALESCE(g.name, CONCAT(su.full_name, ' · ', s.name)) AS who,
         COALESCE(gs.id, s.id) AS subject_id, COALESCE(gs.icon, s.icon) AS icon, COALESCE(gs.color, s.color) AS color
    FROM session_bookings b
    LEFT JOIN session_groups g ON g.id = b.group_id
    LEFT JOIN subjects gs ON gs.id = g.subject_id
    LEFT JOIN enrolments e ON e.id = b.enrolment_id
    LEFT JOIN users su ON su.id = e.student_id
    LEFT JOIN subjects s ON s.id = e.subject_id`;

const toSession = (r: RowDataPacket): SessionRow => ({
  id: r.id,
  who: r.who ?? "Session",
  kind: r.kind,
  date: r.session_date,
  start: hhmm(r.start_time),
  mins: r.minutes,
  logged: Boolean(r.logged),
  past: Boolean(r.past),
  subject: r.subject_id ? { id: r.subject_id, icon: r.icon, color: r.color } : null,
});

export async function today(tutorId: number, week: number) {
  const now = new Date();
  const weekStart = addDays(monday(now), week * 7);
  const weekEnd = addDays(weekStart, 7);

  const [mine] = await pool.query<RowDataPacket[]>(
    `SELECT e.id, u.full_name, s.name AS subject_name, l.short_name, e.tier FROM enrolments e
       JOIN users u ON u.id = e.student_id JOIN subjects s ON s.id = e.subject_id JOIN levels l ON l.id = e.level_id
      WHERE ${MINE} ORDER BY e.id`,
    [tutorId, tutorId]
  );
  const [todays] = await pool.query<RowDataPacket[]>(`${SESSION_SQL} WHERE b.tutor_id = ? AND b.session_date = CURDATE() ORDER BY b.start_time`, [tutorId]);
  const [weekRows] = await pool.query<RowDataPacket[]>(`${SESSION_SQL} WHERE b.tutor_id = ? AND b.session_date >= ? AND b.session_date < ? ORDER BY b.session_date, b.start_time`, [tutorId, ymd(weekStart), ymd(weekEnd)]);
  const [pending] = await pool.query<RowDataPacket[]>(
    `${SESSION_SQL} WHERE b.tutor_id = ? AND b.logged = 0 AND TIMESTAMP(b.session_date, b.start_time) + INTERVAL b.minutes MINUTE < NOW() AND b.session_date >= CURDATE() - INTERVAL 14 DAY ORDER BY b.session_date, b.start_time`,
    [tutorId]
  );
  const [groups] = await pool.query<RowDataPacket[]>("SELECT id, name FROM session_groups WHERE tutor_id = ? ORDER BY id", [tutorId]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = ymd(addDays(weekStart, i));
    return { date: d, day: addDays(weekStart, i).getDate(), isToday: d === ymd(now), sessions: weekRows.filter((r) => r.session_date === d).map(toSession) };
  });

  return {
    kpis: { students: mine.length, sessionsThisWeek: weekRows.length, toLog: pending.length, unread: await unreadFor(tutorId) },
    today: todays.map(toSession),
    pending: pending.map(toSession),
    weekStart: ymd(weekStart),
    days,
    bookOptions: [
      ...groups.map((g) => ({ value: `g|${g.id}`, label: `Group: ${g.name}` })),
      ...mine.map((m) => ({ value: `e|${m.id}`, label: `1:1: ${m.full_name} (${m.short_name} ${m.subject_name}${m.tier ? ` · ${m.tier}` : ""})` })),
    ],
    pendingCount: await pendingLogCount(tutorId),
  };
}

const niceDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
function niceTime(t: string) {
  const h = Number(t.slice(0, 2));
  const m = t.slice(3, 5);
  return `${h % 12 || 12}${m === "00" ? "" : `:${m}`}${h < 12 ? "am" : "pm"}`;
}

/** The students a session is for: everyone in the group, or the one student. */
async function enrolmentsOfBooking(booking: RowDataPacket): Promise<{ id: number; studentId: number; name: string }[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT e.id, e.student_id, u.full_name FROM enrolments e JOIN users u ON u.id = e.student_id WHERE ${booking.group_id ? "e.group_id = ?" : "e.id = ?"} ORDER BY e.id`,
    [booking.group_id ?? booking.enrolment_id]
  );
  return rows.map((r) => ({ id: r.id, studentId: r.student_id, name: r.full_name }));
}

/** Books a session and tells each student by message. */
export async function book(tutorId: number, input: BookInput) {
  const [kind, idText] = input.who.split("|");
  const id = Number(idText);
  let groupId: number | null = null;
  let enrolmentId: number | null = null;
  let zoom = "zoom.us/j/[MEETING-ID]";
  if (kind === "g") {
    const [g] = await pool.query<RowDataPacket[]>("SELECT id, zoom_link FROM session_groups WHERE id = ? AND tutor_id = ?", [id, tutorId]);
    if (g.length === 0) throw new AppError(400, "Choose one of your groups.");
    groupId = id;
    zoom = g[0].zoom_link || zoom;
  } else {
    const [e] = await pool.query<RowDataPacket[]>(`SELECT e.id FROM enrolments e WHERE e.id = ? AND ${MINE}`, [id, tutorId, tutorId]);
    if (e.length === 0) throw new AppError(400, "Choose one of your students.");
    enrolmentId = id;
  }
  const start = `${input.start}:00`;
  const bookingId = await inTransaction(async (conn) => {
    try {
      const [res] = await conn.query<ResultSetHeader>(
        "INSERT INTO session_bookings (kind, group_id, enrolment_id, tutor_id, session_date, start_time, minutes, zoom_link) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [groupId ? "group" : "one", groupId, enrolmentId, tutorId, input.date, start, input.mins, zoom]
      );
      return res.insertId;
    } catch (err) {
      if ((err as { code?: string }).code === "ER_DUP_ENTRY") throw new AppError(409, "That group already has a session on that day.");
      throw err;
    }
  });
  const [bk] = await pool.query<RowDataPacket[]>("SELECT * FROM session_bookings WHERE id = ?", [bookingId]);
  const text = `I've booked a session: ${niceDate(input.date)} at ${niceTime(start)}. The Zoom link is on your dashboard.`;
  for (const s of await enrolmentsOfBooking(bk[0])) {
    await pool.query("INSERT IGNORE INTO chat_threads (student_id, staff_id) VALUES (?, ?)", [s.studentId, tutorId]);
    await pool.query("INSERT INTO chat_messages (student_id, staff_id, sender_id, body) VALUES (?, ?, ?, ?)", [s.studentId, tutorId, tutorId, text]);
  }
  return { id: bookingId, label: `Booked for ${niceDate(input.date)} at ${niceTime(start)}` };
}

/** What the log form needs: the session, topics to choose from, and who to tick as present. */
export async function logForm(tutorId: number, bookingId: number) {
  const [rows] = await pool.query<RowDataPacket[]>(`${SESSION_SQL} WHERE b.id = ? AND b.tutor_id = ?`, [bookingId, tutorId]);
  if (rows.length === 0) throw new AppError(404, "Session not found");
  const [bk] = await pool.query<RowDataPacket[]>("SELECT * FROM session_bookings WHERE id = ?", [bookingId]);
  const students = await enrolmentsOfBooking(bk[0]);
  let subjectId: string, levelId: string;
  if (bk[0].group_id) {
    const [g] = await pool.query<RowDataPacket[]>("SELECT subject_id, level_id FROM session_groups WHERE id = ?", [bk[0].group_id]);
    subjectId = g[0].subject_id;
    levelId = g[0].level_id;
  } else {
    const [e] = await pool.query<RowDataPacket[]>("SELECT subject_id, level_id FROM enrolments WHERE id = ?", [bk[0].enrolment_id]);
    subjectId = e[0].subject_id;
    levelId = e[0].level_id;
  }
  const [topics] = await pool.query<RowDataPacket[]>(
    "SELECT t.id, s.name AS strand, t.name FROM topics t JOIN strands s ON s.id = t.strand_id WHERE s.subject_id = ? AND s.level_id = ? ORDER BY s.position, s.id, t.position, t.id",
    [subjectId, levelId]
  );
  return {
    session: toSession(rows[0]),
    topics: topics.map((t) => ({ id: t.id as number, label: `${t.strand} · ${t.name}` })),
    students: students.map((s) => ({ enrolmentId: s.id, name: s.name })),
  };
}

/** Saves the log, marks the session as logged, and moves each present student's topic from "not started" to "in progress". */
export async function saveLog(tutorId: number, input: LogInput) {
  const [bk] = await pool.query<RowDataPacket[]>("SELECT * FROM session_bookings WHERE id = ? AND tutor_id = ?", [input.bookingId, tutorId]);
  if (bk.length === 0) throw new AppError(404, "Session not found");
  if (bk[0].logged) throw new AppError(409, "That session is already logged.");
  const students = await enrolmentsOfBooking(bk[0]);
  await inTransaction(async (conn) => {
    let topicName = "";
    if (input.topicId) {
      const [t] = await conn.query<RowDataPacket[]>("SELECT name FROM topics WHERE id = ?", [input.topicId]);
      topicName = (t[0]?.name as string | undefined) ?? "";
    }
    const [res] = await conn.query<ResultSetHeader>("INSERT INTO lesson_logs (booking_id, tutor_id, topic_id, topic_name, note, homework) VALUES (?, ?, ?, ?, ?, ?)", [
      input.bookingId,
      tutorId,
      topicName ? input.topicId : null,
      topicName,
      input.note,
      input.homework,
    ]);
    for (const s of students) {
      const present = input.attendance[String(s.id)] === true;
      await conn.query("INSERT INTO lesson_log_attendance (log_id, enrolment_id, present) VALUES (?, ?, ?)", [res.insertId, s.id, present ? 1 : 0]);
      if (present && topicName) await conn.query("INSERT INTO enrolment_topic_status (enrolment_id, topic_id, status) VALUES (?, ?, 'P') ON DUPLICATE KEY UPDATE status = IF(status = 'N', 'P', status)", [s.id, input.topicId]);
    }
    await conn.query("UPDATE session_bookings SET logged = 1 WHERE id = ?", [input.bookingId]);
  });
  void pad;
}
