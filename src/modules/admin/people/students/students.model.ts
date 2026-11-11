import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { inTransaction, pool } from "../../../../config/db/index.js";
import { AppError } from "../../../../utils/AppError/index.js";
import { allLevels, allSubjects, pathName } from "../../shared/catalog.js";
import type { UpdateStudentInput } from "./students.schemas.js";

export interface EnrolmentView {
  id: number;
  subjectId: string;
  levelId: string;
  tier: string;
  board: string;
  current: string;
  target: string;
  tutorId: number | null;
  groupId: number | null;
  pathName: string;
}

export interface StudentListItem {
  id: number;
  name: string;
  email: string;
  year: string;
  planName: string;
  parent: { name: string; email: string; phone: string };
  enrolments: { id: number; subjectId: string; pathName: string }[];
}

const BASE = `SELECT u.id, u.full_name, u.email, u.created_at, p.level_id, p.school_year, p.plan_id, pl.name AS plan_name,
                p.parent_name, p.parent_email, p.parent_phone
           FROM users u
           JOIN student_profiles p ON p.user_id = u.id
           JOIN plans pl ON pl.id = p.plan_id`;

async function enrolmentsFor(studentIds: number[]): Promise<(EnrolmentView & { studentId: number })[]> {
  if (studentIds.length === 0) return [];
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT e.id, e.student_id, e.subject_id, e.level_id, e.tier, e.board, e.current_grade, e.target_grade, e.tutor_id, e.group_id,
            s.name AS subject_name, l.short_name
       FROM enrolments e JOIN subjects s ON s.id = e.subject_id JOIN levels l ON l.id = e.level_id
      WHERE e.student_id IN (?) ORDER BY e.id`,
    [studentIds]
  );
  return rows.map((r) => ({
    id: r.id,
    studentId: r.student_id,
    subjectId: r.subject_id,
    levelId: r.level_id,
    tier: r.tier,
    board: r.board,
    current: r.current_grade,
    target: r.target_grade,
    tutorId: r.tutor_id,
    groupId: r.group_id,
    pathName: pathName(r.short_name, r.subject_name, r.tier),
  }));
}

export async function list(q: string): Promise<StudentListItem[]> {
  const like = `%${q.toLowerCase()}%`;
  const [rows] = await pool.query<RowDataPacket[]>(
    `${BASE} WHERE ? = '' OR LOWER(CONCAT_WS(' ', u.full_name, u.email, p.parent_name, p.parent_email)) LIKE ? ORDER BY u.id`,
    [q, like]
  );
  const enrol = await enrolmentsFor(rows.map((r) => r.id));
  return rows.map((r) => ({
    id: r.id,
    name: r.full_name,
    email: r.email ?? "",
    year: r.school_year,
    planName: r.plan_name,
    parent: { name: r.parent_name, email: r.parent_email, phone: r.parent_phone },
    enrolments: enrol.filter((e) => e.studentId === r.id).map((e) => ({ id: e.id, subjectId: e.subjectId, pathName: e.pathName })),
  }));
}

export async function detail(id: number) {
  const [rows] = await pool.query<RowDataPacket[]>(`${BASE} WHERE u.id = ?`, [id]);
  const r = rows[0];
  if (!r) throw new AppError(404, "Student not found");
  const enrolments = (await enrolmentsFor([id])).map(({ studentId: _studentId, ...e }) => e);
  const [threads] = await pool.query<RowDataPacket[]>(
    `SELECT t.staff_id AS tutor_id, tu.full_name AS tutor_name,
            (SELECT COUNT(*) FROM chat_messages m WHERE m.student_id = t.student_id AND m.staff_id = t.staff_id) AS n
       FROM chat_threads t JOIN users tu ON tu.id = t.staff_id WHERE t.student_id = ? ORDER BY t.staff_id`,
    [id]
  );
  return {
    id: r.id as number,
    name: r.full_name as string,
    email: (r.email ?? "") as string,
    level: r.level_id as string,
    year: r.school_year as string,
    plan: r.plan_id as string,
    joined: r.created_at as string,
    parent: { name: r.parent_name as string, email: r.parent_email as string, phone: r.parent_phone as string },
    enrolments,
    conversations: threads.filter((t) => Number(t.n) > 0).map((t) => ({ tutorId: t.tutor_id as number, tutorName: t.tutor_name as string, messages: Number(t.n) })),
  };
}

export async function create() {
  const levels = await allLevels();
  const [plans] = await pool.query<RowDataPacket[]>("SELECT id FROM plans ORDER BY position, id LIMIT 1");
  if (levels.length === 0 || plans.length === 0) throw new AppError(409, "Add a level and a plan in Settings first.");
  const level = levels.find((l) => l.id === "gcse") ?? levels[0];
  const id = await inTransaction(async (conn) => {
    const [res] = await conn.query<ResultSetHeader>("INSERT INTO users (role, full_name) VALUES ('student', 'New student')");
    await conn.query("UPDATE users SET user_code = CONCAT('STU-', LPAD(id, 5, '0')) WHERE id = ?", [res.insertId]);
    await conn.query("INSERT INTO student_profiles (user_id, level_id, school_year, plan_id) VALUES (?, ?, ?, ?)", [res.insertId, level.id, level.years[0] ?? "", plans[0].id]);
    return res.insertId;
  });
  return detail(id);
}

export async function update(id: number, input: UpdateStudentInput) {
  await detail(id);
  const level = (await allLevels()).find((l) => l.id === input.level);
  if (!level) throw new AppError(400, "Choose a level from the list.");
  const [plan] = await pool.query<RowDataPacket[]>("SELECT id FROM plans WHERE id = ?", [input.plan]);
  if (plan.length === 0) throw new AppError(400, "Choose a plan from the list.");
  // A year that does not belong to the new level falls back to the level's first year.
  const year = level.years.length === 0 || level.years.includes(input.year) ? input.year : level.years[0];
  try {
    await inTransaction(async (conn) => {
      await conn.query("UPDATE users SET full_name = ?, email = ? WHERE id = ?", [input.name, input.email || null, id]);
      await conn.query("UPDATE student_profiles SET level_id = ?, school_year = ?, plan_id = ?, parent_name = ?, parent_email = ?, parent_phone = ? WHERE user_id = ?", [
        input.level,
        year,
        input.plan,
        input.parent.name,
        input.parent.email,
        input.parent.phone,
        id,
      ]);
    });
  } catch (err) {
    if ((err as { code?: string }).code === "ER_DUP_ENTRY") throw new AppError(409, "That email is already used by someone else.");
    throw err;
  }
  return detail(id);
}

export async function remove(id: number) {
  await detail(id);
  await pool.query("DELETE FROM users WHERE id = ? AND role = 'student'", [id]);
}

/** Adds a subject at the student's own level. The tutor starts as the first tutor who teaches that subject. */
export async function addEnrolment(studentId: number, subjectId: string) {
  const student = await detail(studentId);
  const [subjects, levels] = await Promise.all([allSubjects(), allLevels()]);
  const subject = subjects.find((s) => s.id === subjectId);
  const level = levels.find((l) => l.id === student.level);
  if (!subject || !level || !subject.levels.includes(level.id)) throw new AppError(400, "That subject is not offered at this student's level.");
  if (student.enrolments.some((e) => e.subjectId === subjectId && e.levelId === level.id)) throw new AppError(409, "The student already studies that subject.");
  const [tutors] = await pool.query<RowDataPacket[]>("SELECT user_id FROM tutor_subjects WHERE subject_id = ? ORDER BY user_id LIMIT 1", [subjectId]);
  await pool.query("INSERT INTO enrolments (student_id, subject_id, level_id, tier, tutor_id) VALUES (?, ?, ?, ?, ?)", [studentId, subjectId, level.id, level.tiers.at(-1) ?? "", tutors[0]?.user_id ?? null]);
  return detail(studentId);
}
