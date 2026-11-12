import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { inTransaction, pool } from "../../../config/db/index.js";
import { AppError } from "../../../utils/AppError/index.js";
import { MINE } from "../shared/mine.js";
import type { Block, SaveItemInput, SaveRouteInput } from "./content.schemas.js";

/** A tutor works on the subjects an admin gave them, at the levels those subjects are taught. */
async function teachesPath(tutorId: number, subject: string, level: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT 1 FROM tutor_subjects ts JOIN subject_levels sl ON sl.subject_id = ts.subject_id WHERE ts.user_id = ? AND ts.subject_id = ? AND sl.level_id = ?",
    [tutorId, subject, level]
  );
  if (rows.length === 0) throw new AppError(403, "That subject is not one of yours.");
}

/** Loads an item the tutor may work on (it belongs to one of their pathways). */
async function itemOf(tutorId: number, id: number) {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT * FROM content_items WHERE id = ?", [id]);
  if (rows.length === 0) throw new AppError(404, "Not found");
  await teachesPath(tutorId, rows[0].subject_id, rows[0].level_id).catch(() => {
    throw new AppError(404, "Not found");
  });
  return rows[0];
}
async function routeOf(tutorId: number, id: number) {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT * FROM learning_routes WHERE id = ?", [id]);
  if (rows.length === 0) throw new AppError(404, "Not found");
  await teachesPath(tutorId, rows[0].subject_id, rows[0].level_id).catch(() => {
    throw new AppError(404, "Not found");
  });
  return rows[0];
}

/** The pathways (subject at a level) this tutor can build content for, with how many of their students are on each. */
export async function paths(tutorId: number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT s.id AS subject_id, s.name AS subject_name, s.icon, s.color, l.id AS level_id, l.short_name,
            (SELECT COUNT(*) FROM enrolments e WHERE e.subject_id = s.id AND e.level_id = l.id AND ${MINE}) AS students
       FROM tutor_subjects ts JOIN subjects s ON s.id = ts.subject_id
       JOIN subject_levels sl ON sl.subject_id = s.id JOIN levels l ON l.id = sl.level_id
      WHERE ts.user_id = ? ORDER BY students DESC, s.position, l.position`,
    [tutorId, tutorId, tutorId]
  );
  return rows.map((r) => ({
    key: `${r.subject_id}|${r.level_id}`,
    subject: { id: r.subject_id as string, name: r.subject_name as string, icon: r.icon as string, color: r.color as string },
    level: { id: r.level_id as string, short: r.short_name as string },
    label: `${r.short_name} ${r.subject_name}`,
    students: Number(r.students),
  }));
}

/** The library for one pathway: every topic with its items. */
export async function library(tutorId: number, subject: string, level: string) {
  await teachesPath(tutorId, subject, level);
  const [topics] = await pool.query<RowDataPacket[]>(
    `SELECT st.id AS strand_id, st.name AS strand, t.id, t.name FROM strands st JOIN topics t ON t.strand_id = st.id
      WHERE st.subject_id = ? AND st.level_id = ? ORDER BY st.position, st.id, t.position, t.id`,
    [subject, level]
  );
  const [items] = await pool.query<RowDataPacket[]>("SELECT id, kind, title, topic_id, published FROM content_items WHERE subject_id = ? AND level_id = ? ORDER BY id", [subject, level]);
  const row = (i: RowDataPacket) => ({ id: i.id as number, kind: i.kind as string, title: i.title as string, published: Boolean(i.published) });
  const strands: { id: number; name: string; topics: { id: number; name: string; items: ReturnType<typeof row>[] }[] }[] = [];
  for (const t of topics) {
    let s = strands.find((x) => x.id === t.strand_id);
    if (!s) strands.push((s = { id: t.strand_id, name: t.strand, topics: [] }));
    s.topics.push({ id: t.id, name: t.name, items: items.filter((i) => i.topic_id === t.id).map(row) });
  }
  const unsorted = items.filter((i) => !topics.some((t) => t.id === i.topic_id)).map(row);
  return { strands, unsorted };
}

const toBlock = (r: RowDataPacket): Block => ({ type: r.type, ...(typeof r.data === "string" ? JSON.parse(r.data) : r.data) });

export async function getItem(tutorId: number, id: number) {
  const it = await itemOf(tutorId, id);
  const [blocks] = await pool.query<RowDataPacket[]>("SELECT type, data FROM content_blocks WHERE item_id = ? ORDER BY position, id", [id]);
  const [topics] = await pool.query<RowDataPacket[]>(
    `SELECT t.id, st.name AS strand, t.name FROM strands st JOIN topics t ON t.strand_id = st.id
      WHERE st.subject_id = ? AND st.level_id = ? ORDER BY st.position, st.id, t.position, t.id`,
    [it.subject_id, it.level_id]
  );
  return {
    id: it.id as number,
    kind: it.kind as string,
    title: it.title as string,
    subject: it.subject_id as string,
    level: it.level_id as string,
    topicId: (it.topic_id ?? null) as number | null,
    published: Boolean(it.published),
    source: it.source as string,
    blocks: blocks.map(toBlock),
    topics: topics.map((t) => ({ id: t.id as number, label: `${t.strand} · ${t.name}` })),
  };
}

const blockData = (b: Block) => {
  const { type, ...rest } = b;
  void type;
  return JSON.stringify(rest);
};

export async function createItem(tutorId: number, subject: string, level: string, kind: SaveItemInput["kind"]) {
  await teachesPath(tutorId, subject, level);
  const [first] = await pool.query<RowDataPacket[]>(
    "SELECT t.id FROM strands st JOIN topics t ON t.strand_id = st.id WHERE st.subject_id = ? AND st.level_id = ? ORDER BY st.position, st.id, t.position, t.id LIMIT 1",
    [subject, level]
  );
  const id = await inTransaction(async (conn) => {
    const [res] = await conn.query<ResultSetHeader>("INSERT INTO content_items (kind, title, subject_id, level_id, topic_id, created_by) VALUES (?, ?, ?, ?, ?, ?)", [
      kind,
      `New ${kind}`,
      subject,
      level,
      first[0]?.id ?? null,
      tutorId,
    ]);
    // A new item starts with the part that suits it: a question for a quiz, a video for a video lesson, a slide otherwise.
    const start: Block = kind === "quiz" ? { type: "mcq", question: "", options: ["", "", "", ""], correct: 0, explain: "" } : kind === "video" ? { type: "video", title: "", url: "", note: "" } : { type: "slide", title: "", body: "" };
    await conn.query("INSERT INTO content_blocks (item_id, position, type, data) VALUES (?, 0, ?, ?)", [res.insertId, start.type, blockData(start)]);
    return res.insertId;
  });
  return getItem(tutorId, id);
}

/** Saves the whole item as the editor shows it (the editor sends everything after each change). */
export async function saveItem(tutorId: number, id: number, input: SaveItemInput) {
  const it = await itemOf(tutorId, id);
  if (input.topicId) {
    const [ok] = await pool.query<RowDataPacket[]>("SELECT t.id FROM topics t JOIN strands st ON st.id = t.strand_id WHERE t.id = ? AND st.subject_id = ? AND st.level_id = ?", [input.topicId, it.subject_id, it.level_id]);
    if (ok.length === 0) throw new AppError(400, "Choose a topic of this subject.");
  }
  await inTransaction(async (conn) => {
    await conn.query("UPDATE content_items SET title = ?, kind = ?, topic_id = ?, published = ? WHERE id = ?", [input.title, input.kind, input.topicId, input.published ? 1 : 0, id]);
    await conn.query("DELETE FROM content_blocks WHERE item_id = ?", [id]);
    for (const [i, b] of input.blocks.entries()) await conn.query("INSERT INTO content_blocks (item_id, position, type, data) VALUES (?, ?, ?, ?)", [id, i, b.type, blockData(b)]);
  });
}

export async function deleteItem(tutorId: number, id: number) {
  await itemOf(tutorId, id);
  await pool.query("DELETE FROM content_items WHERE id = ?", [id]); // its parts and route steps go with it
}

// ---------- learning routes ----------

/** What the Learning routes view needs for one pathway: the routes, the library to add from, and who a route can be shown to. */
export async function routes(tutorId: number, subject: string, level: string) {
  await teachesPath(tutorId, subject, level);
  const [rs] = await pool.query<RowDataPacket[]>(
    "SELECT r.id, r.name, (SELECT COUNT(*) FROM route_steps WHERE route_id = r.id) AS steps FROM learning_routes r WHERE r.subject_id = ? AND r.level_id = ? ORDER BY r.id",
    [subject, level]
  );
  const [aud] = await pool.query<RowDataPacket[]>(
    `SELECT a.route_id, COALESCE(g.name, u.full_name) AS name FROM route_audience a
       LEFT JOIN session_groups g ON g.id = a.group_id
       LEFT JOIN enrolments e ON e.id = a.enrolment_id LEFT JOIN users u ON u.id = e.student_id
      WHERE a.route_id IN (SELECT id FROM learning_routes WHERE subject_id = ? AND level_id = ?)`,
    [subject, level]
  );
  const [items] = await pool.query<RowDataPacket[]>(
    "SELECT i.id, i.kind, i.title, i.published, t.name AS topic FROM content_items i LEFT JOIN topics t ON t.id = i.topic_id WHERE i.subject_id = ? AND i.level_id = ? ORDER BY i.id",
    [subject, level]
  );
  const [groups] = await pool.query<RowDataPacket[]>("SELECT id, name FROM session_groups WHERE subject_id = ? AND level_id = ? AND tutor_id = ? ORDER BY id", [subject, level, tutorId]);
  const [students] = await pool.query<RowDataPacket[]>(
    `SELECT e.id, u.full_name FROM enrolments e JOIN users u ON u.id = e.student_id WHERE e.subject_id = ? AND e.level_id = ? AND ${MINE} ORDER BY u.full_name`,
    [subject, level, tutorId, tutorId]
  );
  return {
    routes: rs.map((r) => ({ id: r.id as number, name: r.name as string, steps: Number(r.steps), shownTo: aud.filter((a) => a.route_id === r.id).map((a) => a.name as string) })),
    items: items.map((i) => ({ id: i.id as number, kind: i.kind as string, title: i.title as string, topic: (i.topic ?? "") as string, published: Boolean(i.published) })),
    groups: groups.map((g) => ({ id: g.id as number, name: g.name as string })),
    students: students.map((s) => ({ enrolmentId: s.id as number, name: s.full_name as string })),
  };
}

export async function getRoute(tutorId: number, id: number) {
  const r = await routeOf(tutorId, id);
  const [steps] = await pool.query<RowDataPacket[]>("SELECT item_id, week FROM route_steps WHERE route_id = ? ORDER BY position, id", [id]);
  const [aud] = await pool.query<RowDataPacket[]>("SELECT group_id, enrolment_id FROM route_audience WHERE route_id = ?", [id]);
  return {
    id: r.id as number,
    name: r.name as string,
    steps: steps.map((s) => ({ itemId: s.item_id as number, week: Number(s.week) })),
    groups: aud.filter((a) => a.group_id).map((a) => a.group_id as number),
    enrolments: aud.filter((a) => a.enrolment_id).map((a) => a.enrolment_id as number),
  };
}

export async function createRoute(tutorId: number, subject: string, level: string) {
  await teachesPath(tutorId, subject, level);
  const [res] = await pool.query<ResultSetHeader>("INSERT INTO learning_routes (name, subject_id, level_id, created_by) VALUES ('New route', ?, ?, ?)", [subject, level, tutorId]);
  return getRoute(tutorId, res.insertId);
}

/** Students a route reaches: everyone in the chosen groups plus the chosen students. */
async function reached(groups: number[], enrolments: number[]): Promise<number[]> {
  const conds: string[] = [];
  const params: number[][] = [];
  if (groups.length) {
    conds.push("group_id IN (?)");
    params.push(groups);
  }
  if (enrolments.length) {
    conds.push("id IN (?)");
    params.push(enrolments);
  }
  if (conds.length === 0) return [];
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT DISTINCT student_id FROM enrolments WHERE ${conds.join(" OR ")}`, params);
  return rows.map((r) => r.student_id as number);
}

export async function saveRoute(tutorId: number, id: number, input: SaveRouteInput) {
  const r = await routeOf(tutorId, id);
  // Only items of the same pathway, groups of mine, and my students may be used.
  if (input.steps.length) {
    const ids = [...new Set(input.steps.map((s) => s.itemId))];
    const [ok] = await pool.query<RowDataPacket[]>("SELECT id FROM content_items WHERE subject_id = ? AND level_id = ? AND id IN (?)", [r.subject_id, r.level_id, ids]);
    if (ok.length !== ids.length) throw new AppError(400, "One of the steps is not in this library.");
  }
  if (input.groups.length) {
    const [ok] = await pool.query<RowDataPacket[]>("SELECT id FROM session_groups WHERE tutor_id = ? AND subject_id = ? AND level_id = ? AND id IN (?)", [tutorId, r.subject_id, r.level_id, input.groups]);
    if (ok.length !== new Set(input.groups).size) throw new AppError(400, "Choose one of your groups.");
  }
  if (input.enrolments.length) {
    const [ok] = await pool.query<RowDataPacket[]>(`SELECT e.id FROM enrolments e WHERE e.subject_id = ? AND e.level_id = ? AND ${MINE} AND e.id IN (?)`, [r.subject_id, r.level_id, tutorId, tutorId, input.enrolments]);
    if (ok.length !== new Set(input.enrolments).size) throw new AppError(400, "Choose one of your students.");
  }
  const before = await getRoute(tutorId, id);
  const hadBefore = new Set(await reached(before.groups, before.enrolments));
  await inTransaction(async (conn) => {
    await conn.query("UPDATE learning_routes SET name = ?, assigned_at = COALESCE(assigned_at, IF(?, NOW(), NULL)) WHERE id = ?", [input.name, input.groups.length + input.enrolments.length > 0 ? 1 : 0, id]);
    await conn.query("DELETE FROM route_steps WHERE route_id = ?", [id]);
    for (const [i, s] of input.steps.entries()) await conn.query("INSERT INTO route_steps (route_id, position, item_id, week) VALUES (?, ?, ?, ?)", [id, i, s.itemId, s.week]);
    await conn.query("DELETE FROM route_audience WHERE route_id = ?", [id]);
    for (const g of new Set(input.groups)) await conn.query("INSERT INTO route_audience (route_id, group_id) VALUES (?, ?)", [id, g]);
    for (const e of new Set(input.enrolments)) await conn.query("INSERT INTO route_audience (route_id, enrolment_id) VALUES (?, ?)", [id, e]);
  });
  // A student who now sees the route for the first time is told in a message.
  for (const studentId of await reached(input.groups, input.enrolments)) {
    if (hadBefore.has(studentId)) continue;
    await pool.query("INSERT IGNORE INTO chat_threads (student_id, staff_id) VALUES (?, ?)", [studentId, tutorId]);
    await pool.query("INSERT INTO chat_messages (student_id, staff_id, sender_id, body) VALUES (?, ?, ?, ?)", [studentId, tutorId, tutorId, `New tasks on your learning map: ${input.name}.`]);
  }
}

export async function duplicateRoute(tutorId: number, id: number) {
  const r = await routeOf(tutorId, id);
  const newId = await inTransaction(async (conn) => {
    const [res] = await conn.query<ResultSetHeader>("INSERT INTO learning_routes (name, subject_id, level_id, created_by) VALUES (?, ?, ?, ?)", [`${r.name} (copy)`.slice(0, 160), r.subject_id, r.level_id, tutorId]);
    await conn.query("INSERT INTO route_steps (route_id, position, item_id, week) SELECT ?, position, item_id, week FROM route_steps WHERE route_id = ?", [res.insertId, id]);
    return res.insertId;
  });
  return getRoute(tutorId, newId);
}

export async function deleteRoute(tutorId: number, id: number) {
  await routeOf(tutorId, id);
  await pool.query("DELETE FROM learning_routes WHERE id = ?", [id]);
}
