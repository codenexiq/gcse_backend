import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../../../../config/db/index.js";
import { AppError } from "../../../../utils/AppError/index.js";
import { allSubjects } from "../../shared/catalog.js";
import type { UpdateGroupInput } from "./groups.schemas.js";

export interface Group {
  id: number;
  name: string;
  subjectId: string;
  levelId: string;
  tutorId: number | null;
  day: number;
  start: string;
  zoom: string;
  students: number;
}

const hhmm = (t: string) => t.slice(0, 5);

export async function list(): Promise<Group[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT g.id, g.name, g.subject_id, g.level_id, g.tutor_id, g.day_of_week, g.start_time, g.zoom_link,
            (SELECT COUNT(*) FROM enrolments e WHERE e.group_id = g.id) AS students
       FROM session_groups g ORDER BY g.id`
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    subjectId: r.subject_id,
    levelId: r.level_id,
    tutorId: r.tutor_id,
    day: r.day_of_week,
    start: hhmm(r.start_time),
    zoom: r.zoom_link,
    students: Number(r.students),
  }));
}

export async function create() {
  const subject = (await allSubjects()).find((s) => s.levels.length > 0);
  if (!subject) throw new AppError(409, "Add a subject and tick a level first.");
  const [res] = await pool.query<ResultSetHeader>("INSERT INTO session_groups (name, subject_id, level_id, tutor_id, day_of_week, start_time, zoom_link) VALUES ('New group', ?, ?, NULL, 0, '17:00:00', '')", [subject.id, subject.levels[0]]);
  return (await list()).find((g) => g.id === res.insertId)!;
}

export async function update(id: number, input: UpdateGroupInput) {
  if (!(await list()).some((g) => g.id === id)) throw new AppError(404, "Group not found");
  const subject = (await allSubjects()).find((s) => s.id === input.subjectId);
  if (!subject || !subject.levels.includes(input.levelId)) throw new AppError(400, "That subject is not offered at that level.");
  if (input.tutorId) {
    const [t] = await pool.query<RowDataPacket[]>("SELECT id FROM users WHERE id = ? AND role = 'tutor'", [input.tutorId]);
    if (t.length === 0) throw new AppError(400, "Choose a tutor from the list.");
  }
  await pool.query("UPDATE session_groups SET name = ?, subject_id = ?, level_id = ?, tutor_id = ?, day_of_week = ?, start_time = ?, zoom_link = ? WHERE id = ?", [
    input.name,
    input.subjectId,
    input.levelId,
    input.tutorId,
    input.day,
    input.start.length === 5 ? `${input.start}:00` : input.start,
    input.zoom,
    id,
  ]);
  return (await list()).find((g) => g.id === id)!;
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Adds this group's class to the calendar for the next 6 weeks (weeks already on the calendar, and days gone by, are skipped). */
export async function addSessions(id: number) {
  const group = (await list()).find((g) => g.id === id);
  if (!group) throw new AppError(404, "Group not found");
  if (!group.tutorId) throw new AppError(400, "Choose a tutor first.");
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  let added = 0;
  for (let w = 0; w < 6; w++) {
    const day = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + w * 7 + group.day);
    const [h, m] = group.start.split(":").map(Number);
    const startsAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
    if (startsAt < now) continue;
    const [res] = await pool.query<ResultSetHeader>("INSERT IGNORE INTO session_bookings (kind, group_id, tutor_id, session_date, start_time, minutes, zoom_link) VALUES ('group', ?, ?, ?, ?, 60, ?)", [
      id,
      group.tutorId,
      ymd(day),
      `${group.start}:00`,
      group.zoom,
    ]);
    added += res.affectedRows;
  }
  return { added };
}
