import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../../config/db/index.js";
import { AppError } from "../../utils/AppError/index.js";
import type { GroupInput } from "./group.schemas.js";

interface GroupRow extends RowDataPacket {
  id: number;
  name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  zoom_link: string;
  capacity: number;
}

const hhmm = (t: string) => String(t).slice(0, 5);

const toGroup = (r: GroupRow) => ({
  id: r.id,
  name: r.name,
  dayOfWeek: r.day_of_week,
  startTime: hhmm(r.start_time),
  endTime: hhmm(r.end_time),
  zoomLink: r.zoom_link,
  capacity: r.capacity,
});

const COLUMNS = "id, name, day_of_week, start_time, end_time, zoom_link, capacity";

/** Every group with its topics and the students in it (tutors and admins). */
export async function list() {
  const [groups] = await pool.query<GroupRow[]>(`SELECT ${COLUMNS} FROM session_groups ORDER BY day_of_week, start_time, id`);
  if (groups.length === 0) return [];
  const ids = groups.map((g) => g.id);
  const [topics] = await pool.query<(RowDataPacket & { group_id: number; topic: string })[]>("SELECT group_id, topic FROM session_group_topics WHERE group_id IN (?) ORDER BY topic", [ids]);
  const [members] = await pool.query<(RowDataPacket & { group_id: number; id: number; full_name: string; email: string })[]>(
    `SELECT sg.group_id, u.id, u.full_name, u.email FROM student_groups sg JOIN users u ON u.id = sg.student_id WHERE sg.group_id IN (?) ORDER BY u.full_name, u.id`,
    [ids]
  );
  return groups.map((g) => ({
    ...toGroup(g),
    topics: topics.filter((t) => t.group_id === g.id).map((t) => t.topic),
    members: members.filter((m) => m.group_id === g.id).map((m) => ({ id: m.id, fullName: m.full_name || m.email })),
  }));
}

export async function find(id: number) {
  return (await list()).find((g) => g.id === id) ?? null;
}

async function writeTopics(conn: { query: (sql: string, params?: unknown[]) => Promise<unknown> }, groupId: number, topics: string[]) {
  await conn.query("DELETE FROM session_group_topics WHERE group_id = ?", [groupId]);
  for (const topic of [...new Set(topics)]) await conn.query("INSERT INTO session_group_topics (group_id, topic) VALUES (?, ?)", [groupId, topic]);
}

export async function create(userId: number, g: GroupInput) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query<ResultSetHeader>("INSERT INTO session_groups (name, day_of_week, start_time, end_time, zoom_link, capacity, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)", [
      g.name,
      g.dayOfWeek,
      g.startTime,
      g.endTime,
      g.zoomLink,
      g.capacity,
      userId,
    ]);
    await writeTopics(conn, result.insertId, g.topics);
    await conn.commit();
    return (await find(result.insertId))!;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function update(id: number, g: GroupInput) {
  const current = await find(id);
  if (!current) return null;
  // The capacity can not go below the number of students already in the group.
  if (g.capacity < current.members.length) throw new AppError(409, `${current.members.length} students are already in this group, so the capacity can not be lower than that`);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("UPDATE session_groups SET name = ?, day_of_week = ?, start_time = ?, end_time = ?, zoom_link = ?, capacity = ? WHERE id = ?", [g.name, g.dayOfWeek, g.startTime, g.endTime, g.zoomLink, g.capacity, id]);
    await writeTopics(conn, id, g.topics);
    await conn.commit();
    return (await find(id))!;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** Deleting a group puts its students back on the waiting list. */
export async function remove(id: number) {
  const [result] = await pool.query<ResultSetHeader>("DELETE FROM session_groups WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

/** Places a student in a group (moving them if they were in another). Fails when the group is full. */
export async function assign(studentId: number, groupId: number, note: string, sendVideo: boolean, tutorId: number) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Lock the group row so two tutors can not both take the last place.
    const [g] = await conn.query<GroupRow[]>(`SELECT ${COLUMNS} FROM session_groups WHERE id = ? FOR UPDATE`, [groupId]);
    if (g.length === 0) throw new AppError(404, "Group not found");
    const [count] = await conn.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM student_groups WHERE group_id = ? AND student_id <> ?", [groupId, studentId]);
    if (Number(count[0].n) >= g[0].capacity) throw new AppError(409, "That group is full");
    await conn.query(
      `INSERT INTO student_groups (student_id, group_id, note, send_video, assigned_by) VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE group_id = VALUES(group_id), note = VALUES(note), send_video = VALUES(send_video), assigned_by = VALUES(assigned_by), assigned_at = CURRENT_TIMESTAMP`,
      [studentId, groupId, note, sendVideo ? 1 : 0, tutorId]
    );
    await conn.commit();
    return toGroup(g[0]);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function unassign(studentId: number) {
  const [result] = await pool.query<ResultSetHeader>("DELETE FROM student_groups WHERE student_id = ?", [studentId]);
  return result.affectedRows > 0;
}

/** The group a student is in (with the tutor's note), or null. Students never see other students' names. */
export async function forStudent(studentId: number) {
  const [rows] = await pool.query<(GroupRow & { note: string; send_video: number; assigned_at: Date; tutor_name: string })[]>(
    `SELECT g.id, g.name, g.day_of_week, g.start_time, g.end_time, g.zoom_link, g.capacity, sg.note, sg.send_video, sg.assigned_at,
        COALESCE(NULLIF(t.full_name, ''), t.email) AS tutor_name
       FROM student_groups sg JOIN session_groups g ON g.id = sg.group_id JOIN users t ON t.id = sg.assigned_by WHERE sg.student_id = ?`,
    [studentId]
  );
  const r = rows[0];
  if (!r) return null;
  const [topics] = await pool.query<(RowDataPacket & { topic: string })[]>("SELECT topic FROM session_group_topics WHERE group_id = ? ORDER BY topic", [r.id]);
  return { ...toGroup(r), topics: topics.map((t) => t.topic), note: r.note, sendVideo: Boolean(r.send_video), assignedAt: r.assigned_at, tutorName: r.tutor_name };
}

/** The group a student is in, as a tutor sees it on the review screen (just the ids and the note). */
export async function assignmentOf(studentId: number) {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT group_id AS groupId, note, send_video AS sendVideo FROM student_groups WHERE student_id = ?", [studentId]);
  return rows[0] ? { groupId: rows[0].groupId as number, note: rows[0].note as string, sendVideo: Boolean(rows[0].sendVideo) } : null;
}
