import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../../config/db/index.js";
import { AppError } from "../../utils/AppError/index.js";
import type { UpdateInput } from "./route.schemas.js";

interface RouteRow extends RowDataPacket {
  id: number;
  name: string;
  description: string;
}

interface StepRow extends RowDataPacket {
  id: number;
  route_id: number;
  item_type: "lesson" | "quiz";
  item_id: number;
  week: number;
  title: string | null;
  topic: string | null;
  published: number | null;
}

/** Each step with the lesson or quiz it points at (steps whose item was deleted are left out). */
const STEPS = `SELECT s.id, s.route_id, s.item_type, s.item_id, s.week,
    CASE s.item_type WHEN 'lesson' THEN l.title ELSE q.title END AS title,
    CASE s.item_type WHEN 'lesson' THEN l.topic ELSE NULL END AS topic,
    CASE s.item_type WHEN 'lesson' THEN (l.published = 1 AND l.blocks <> '[]') ELSE q.published END AS published
  FROM route_steps s
  LEFT JOIN lessons l ON s.item_type = 'lesson' AND l.id = s.item_id
  LEFT JOIN quizzes q ON s.item_type = 'quiz' AND q.id = s.item_id`;

const toStep = (r: StepRow) => ({ id: r.id, type: r.item_type, itemId: r.item_id, week: r.week, title: r.title ?? "", topic: r.topic, published: Boolean(r.published) });

/** Every route with its steps and the students it is assigned to. */
export async function list() {
  const [routes] = await pool.query<RouteRow[]>("SELECT id, name, description FROM learning_routes ORDER BY name, id");
  if (routes.length === 0) return [];
  const ids = routes.map((r) => r.id);
  const [steps] = await pool.query<StepRow[]>(`${STEPS} WHERE s.route_id IN (?) AND (l.id IS NOT NULL OR q.id IS NOT NULL) ORDER BY s.route_id, s.position`, [ids]);
  const [assigned] = await pool.query<(RowDataPacket & { route_id: number; student_id: number })[]>("SELECT route_id, student_id FROM route_assignments WHERE route_id IN (?)", [ids]);
  return routes.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    steps: steps.filter((s) => s.route_id === r.id).map(toStep),
    assigned: assigned.filter((a) => a.route_id === r.id).map((a) => a.student_id),
  }));
}

export async function find(id: number) {
  return (await list()).find((r) => r.id === id) ?? null;
}

export async function create(userId: number, name: string, description: string) {
  const [result] = await pool.query<ResultSetHeader>("INSERT INTO learning_routes (name, description, created_by) VALUES (?, ?, ?)", [name, description, userId]);
  return (await find(result.insertId))!;
}

/** Replaces a route's name, steps and students in one go. Returns the route and the students who were newly given it. */
export async function update(id: number, input: UpdateInput) {
  const before = await find(id);
  if (!before) return null;
  // Every step must point at a lesson or quiz that exists; every student must be a student.
  for (const type of ["lesson", "quiz"] as const) {
    const wanted = [...new Set(input.steps.filter((s) => s.type === type).map((s) => s.id))];
    if (wanted.length === 0) continue;
    const [found] = await pool.query<RowDataPacket[]>(`SELECT id FROM ${type === "lesson" ? "lessons" : "quizzes"} WHERE id IN (?)`, [wanted]);
    if (found.length !== wanted.length) throw new AppError(400, `One of the ${type}s in this route no longer exists`);
  }
  const students = [...new Set(input.assigned)];
  if (students.length > 0) {
    const [found] = await pool.query<RowDataPacket[]>("SELECT id FROM users WHERE role = 'student' AND id IN (?)", [students]);
    if (found.length !== students.length) throw new AppError(400, "One of the students was not found");
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("UPDATE learning_routes SET name = ?, description = ? WHERE id = ?", [input.name, input.description, id]);
    await conn.query("DELETE FROM route_steps WHERE route_id = ?", [id]);
    for (let i = 0; i < input.steps.length; i++) {
      const s = input.steps[i];
      await conn.query("INSERT INTO route_steps (route_id, position, item_type, item_id, week) VALUES (?, ?, ?, ?, ?)", [id, i + 1, s.type, s.id, s.week]);
    }
    // Students who keep the route keep their original start date, so their due dates do not move.
    await conn.query(students.length ? "DELETE FROM route_assignments WHERE route_id = ? AND student_id NOT IN (?)" : "DELETE FROM route_assignments WHERE route_id = ?", students.length ? [id, students] : [id]);
    for (const studentId of students) await conn.query("INSERT IGNORE INTO route_assignments (route_id, student_id, assigned_at) VALUES (?, ?, CURDATE())", [id, studentId]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  return { route: (await find(id))!, added: students.filter((s) => !before.assigned.includes(s)) };
}

export async function remove(id: number) {
  const [result] = await pool.query<ResultSetHeader>("DELETE FROM learning_routes WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

/** Gives one student a route (from the student's page). Returns false if they already have it. */
export async function assign(routeId: number, studentId: number) {
  const [result] = await pool.query<ResultSetHeader>("INSERT IGNORE INTO route_assignments (route_id, student_id, assigned_at) VALUES (?, ?, CURDATE())", [routeId, studentId]);
  return result.affectedRows > 0;
}

export async function unassign(routeId: number, studentId: number) {
  const [result] = await pool.query<ResultSetHeader>("DELETE FROM route_assignments WHERE route_id = ? AND student_id = ?", [routeId, studentId]);
  return result.affectedRows > 0;
}

/** The lessons and quizzes tutors can put in a route. */
export async function library() {
  const [lessons] = await pool.query<(RowDataPacket & { id: number; title: string; topic: string; published: number; blocks: string })[]>("SELECT id, title, topic, published, (blocks <> '[]') AS has_blocks FROM lessons ORDER BY topic, id");
  const [quizzes] = await pool.query<(RowDataPacket & { id: number; title: string; published: number })[]>("SELECT id, title, published FROM quizzes ORDER BY title, id");
  return [
    ...lessons.map((l) => ({ type: "lesson" as const, id: l.id, title: l.title, topic: l.topic as string | null, published: Boolean(l.published) })),
    ...quizzes.map((q) => ({ type: "quiz" as const, id: q.id, title: q.title, topic: null as string | null, published: Boolean(q.published) })),
  ];
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** A student's tasks: every published step of every route they have, with whether they did it and when it is due. Not-yet-done tasks first, soonest due first. */
export async function tasksOf(studentId: number) {
  const [steps] = await pool.query<(StepRow & { route_name: string; assigned_at: string })[]>(
    `SELECT x.*, r.name AS route_name, DATE_FORMAT(a.assigned_at, '%Y-%m-%d') AS assigned_at FROM (${STEPS}) x
       JOIN learning_routes r ON r.id = x.route_id
       JOIN route_assignments a ON a.route_id = x.route_id AND a.student_id = ?
      WHERE x.title IS NOT NULL AND x.published = 1 ORDER BY x.route_id, x.id`,
    [studentId]
  );
  const [lessonDone] = await pool.query<(RowDataPacket & { lesson_id: number })[]>("SELECT DISTINCT lesson_id FROM lesson_results WHERE student_id = ? AND lesson_id IS NOT NULL", [studentId]);
  const [quizDone] = await pool.query<(RowDataPacket & { quiz_id: number })[]>("SELECT DISTINCT quiz_id FROM quiz_attempts WHERE student_id = ?", [studentId]);
  const doneLessons = new Set(lessonDone.map((r) => r.lesson_id));
  const doneQuizzes = new Set(quizDone.map((r) => r.quiz_id));
  const tasks = steps.map((s) => {
    const start = new Date(`${s.assigned_at}T00:00:00`);
    const due = ymd(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7 * s.week));
    return { routeName: s.route_name, type: s.item_type, itemId: s.item_id, title: s.title ?? "", topic: s.topic, week: s.week, due, done: s.item_type === "lesson" ? doneLessons.has(s.item_id) : doneQuizzes.has(s.item_id) };
  });
  return tasks.sort((a, b) => (a.done === b.done ? (a.due < b.due ? -1 : a.due > b.due ? 1 : 0) : a.done ? 1 : -1));
}

/** The routes a student has, with each step marked done or not (for the tutor's view of the student). */
export async function routesOf(studentId: number) {
  const [assigned] = await pool.query<(RowDataPacket & { route_id: number })[]>("SELECT route_id FROM route_assignments WHERE student_id = ? ORDER BY assigned_at DESC", [studentId]);
  if (assigned.length === 0) return [];
  const tasks = await tasksOf(studentId);
  const all = await list();
  return assigned
    .map((a) => all.find((r) => r.id === a.route_id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .map((r) => ({
      id: r.id,
      name: r.name,
      steps: r.steps.map((s) => ({ type: s.type, title: s.title, week: s.week, published: s.published, done: tasks.some((t) => t.type === s.type && t.itemId === s.itemId && t.done) })),
    }));
}
