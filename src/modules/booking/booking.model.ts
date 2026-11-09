import { randomBytes } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../../config/db/index.js";
import { AppError } from "../../utils/AppError/index.js";
import type { Role } from "../auth/user.model.js";
import type { BookingInput, BookingLogInput } from "./booking.schemas.js";

interface Row extends RowDataPacket {
  id: number;
  tutor_id: number;
  student_id: number | null;
  group_id: number | null;
  who_name: string | null;
  member_count: number | null;
  session_date: string;
  start_time: string;
  minutes: number;
  zoom_link: string;
  series_id: string | null;
  log_id: number | null;
  log_topics: string | null;
  log_went_well: string | null;
  log_next: string | null;
  log_homework: string | null;
  log_attendance: string | null;
  log_engagement: number | null;
  log_focus: number | null;
  log_attendees: string | null;
}

type Viewer = { id: number; role: Role };

const SELECT = `SELECT b.id, b.tutor_id, b.student_id, b.group_id,
    COALESCE(NULLIF(u.full_name, ''), u.email, g.name) AS who_name,
    (SELECT COUNT(*) FROM student_groups sg WHERE sg.group_id = b.group_id) AS member_count,
    DATE_FORMAT(b.session_date, '%Y-%m-%d') AS session_date, TIME_FORMAT(b.start_time, '%H:%i') AS start_time, b.minutes, b.zoom_link, b.series_id,
    l.id AS log_id, l.topics AS log_topics, l.engagement_notes AS log_went_well, l.next_focus AS log_next, l.homework_other AS log_homework,
    l.attendance AS log_attendance, l.engagement AS log_engagement, l.focus_score AS log_focus, l.attendees AS log_attendees
  FROM session_bookings b
  LEFT JOIN users u ON u.id = b.student_id
  LEFT JOIN session_groups g ON g.id = b.group_id
  LEFT JOIN lesson_logs l ON l.booking_id = b.id`;

const attendanceText = (r: Row) => {
  if (r.group_id !== null) {
    const came = r.log_attendees ? (JSON.parse(r.log_attendees) as number[]).length : 0;
    return `${came} of ${r.member_count ?? 0} attended`;
  }
  return r.log_attendance === "Late" ? "Late (5+ minutes)" : r.log_attendance === "Present" ? "Attended" : "Absent";
};

const toBooking = (r: Row) => ({
  id: r.id,
  tutorId: r.tutor_id,
  who: { type: r.group_id !== null ? ("group" as const) : ("student" as const), id: (r.group_id ?? r.student_id) as number, name: r.who_name ?? "" },
  date: r.session_date,
  startTime: r.start_time,
  minutes: r.minutes,
  zoomLink: r.zoom_link,
  seriesId: r.series_id,
  logged: r.log_id !== null,
  log:
    r.log_id === null
      ? null
      : {
          topics: r.log_topics ?? "",
          wentWell: r.log_went_well ?? "",
          nextStep: r.log_next ?? "",
          homework: r.log_homework ?? "",
          attendance: attendanceText(r),
          engagement: r.log_engagement ?? 0,
          focus: r.log_focus ?? 0,
        },
});

/** Sessions between two dates (inclusive). A tutor sees their own; an admin sees everyone's. */
export async function list(viewer: Viewer, from: string, to: string) {
  const own = viewer.role !== "admin";
  const [rows] = await pool.query<Row[]>(`${SELECT} WHERE b.session_date BETWEEN ? AND ? ${own ? "AND b.tutor_id = ?" : ""} ORDER BY b.session_date, b.start_time, b.id LIMIT 1000`, own ? [from, to, viewer.id] : [from, to]);
  return rows.map(toBooking);
}

export async function find(id: number) {
  const [rows] = await pool.query<Row[]>(`${SELECT} WHERE b.id = ?`, [id]);
  return rows[0] ?? null;
}

const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Books one session, or a weekly series of 12. Returns the sessions made and who is to be told. */
export async function create(tutorId: number, b: BookingInput) {
  const isGroup = b.who.type === "group";
  const [exists] = await pool.query<RowDataPacket[]>(isGroup ? "SELECT id FROM session_groups WHERE id = ?" : "SELECT id FROM users WHERE id = ? AND role = 'student'", [b.who.id]);
  if (exists.length === 0) throw new AppError(404, isGroup ? "Group not found" : "Student not found");
  const series = b.repeat > 1 ? randomBytes(8).toString("hex") : null;
  const conn = await pool.getConnection();
  const ids: number[] = [];
  try {
    await conn.beginTransaction();
    for (let i = 0; i < b.repeat; i++) {
      const [result] = await conn.query<ResultSetHeader>(
        "INSERT INTO session_bookings (tutor_id, student_id, group_id, session_date, start_time, minutes, zoom_link, series_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [tutorId, isGroup ? null : b.who.id, isGroup ? b.who.id : null, addDays(b.date, i * 7), b.startTime, b.minutes, b.zoomLink, series]
      );
      ids.push(result.insertId);
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  return (await list({ id: tutorId, role: "admin" }, b.date, addDays(b.date, (b.repeat - 1) * 7))).filter((x) => ids.includes(x.id));
}

/** The students a session is for: the student, or everyone in the group. */
export async function audience(b: Pick<Row, "student_id" | "group_id">) {
  if (b.student_id !== null) return [b.student_id];
  const [rows] = await pool.query<RowDataPacket[]>("SELECT student_id FROM student_groups WHERE group_id = ?", [b.group_id]);
  return rows.map((r) => r.student_id as number);
}

/** Cancels one session, or this one and every later one in its weekly series. Returns how many were cancelled. */
export async function cancel(b: Row, wholeSeries: boolean) {
  if (wholeSeries && b.series_id) {
    const [result] = await pool.query<ResultSetHeader>("DELETE FROM session_bookings WHERE series_id = ? AND session_date >= ?", [b.series_id, b.session_date]);
    return result.affectedRows;
  }
  const [result] = await pool.query<ResultSetHeader>("DELETE FROM session_bookings WHERE id = ?", [b.id]);
  return result.affectedRows;
}

/** Saves the session log as a lesson-log entry tied to this booking (so it also shows in the Lesson log and feeds the monthly report). */
export async function addLog(b: Row, tutor: { id: number; fullName: string }, input: BookingLogInput) {
  const isGroup = b.group_id !== null;
  let present: number[] = [];
  if (isGroup) {
    const members = await audience(b);
    present = input.present.filter((id) => members.includes(id));
  }
  const attendance = isGroup ? (present.length > 0 ? "Present" : "Absent / No show") : input.attendance === "Attended" ? "Present" : input.attendance === "Absent" ? "Absent / No show" : "Late";
  const came = isGroup ? present.length > 0 : input.attendance !== "Absent";
  try {
    await pool.query(
      `INSERT INTO lesson_logs (booking_id, tutor_id, tutor_name, lesson_date, student_or_class, lesson_type, attendance, duration_minutes, completed,
         homework_assigned, homework_other, engagement_notes, next_focus, zoom_recorded, topics, engagement, focus_score, attendees)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      [
        b.id, tutor.id, tutor.fullName, b.session_date, b.who_name ?? "", isGroup ? "Group" : "1:1", attendance, b.minutes, came ? "Yes" : "No",
        input.homework ? 1 : 0, input.homework || null, input.wentWell || null, input.nextStep, input.topics, input.engagement, input.focus, isGroup ? JSON.stringify(present) : null,
      ]
    );
  } catch (err) {
    if (typeof err === "object" && err !== null && (err as { code?: string }).code === "ER_DUP_ENTRY") throw new AppError(409, "This session already has a log");
    throw err;
  }
  return toBooking((await find(b.id))!);
}
