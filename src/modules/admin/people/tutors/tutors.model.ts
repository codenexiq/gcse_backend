import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { inTransaction, pool } from "../../../../config/db/index.js";
import { AppError } from "../../../../utils/AppError/index.js";
import { allSubjects } from "../../shared/catalog.js";
import type { UpdateTutorInput } from "./tutors.schemas.js";

export interface Tutor {
  id: number;
  name: string;
  email: string;
  phone: string;
  subjects: string[];
  /** Enrolments this tutor teaches: assigned to them directly, or in one of their groups. */
  students: number;
  groups: number;
}

export async function list(): Promise<Tutor[]> {
  const [users] = await pool.query<RowDataPacket[]>("SELECT id, full_name, email, phone FROM users WHERE role = 'tutor' ORDER BY id");
  const [subjects] = await pool.query<RowDataPacket[]>("SELECT user_id, subject_id FROM tutor_subjects");
  const [students] = await pool.query<RowDataPacket[]>(
    `SELECT t.id AS tutor_id, COUNT(DISTINCT e.id) AS n
       FROM users t
       JOIN enrolments e ON e.tutor_id = t.id OR e.group_id IN (SELECT id FROM session_groups WHERE tutor_id = t.id)
      WHERE t.role = 'tutor' GROUP BY t.id`
  );
  const [groups] = await pool.query<RowDataPacket[]>("SELECT tutor_id, COUNT(*) AS n FROM session_groups WHERE tutor_id IS NOT NULL GROUP BY tutor_id");
  return users.map((u) => ({
    id: u.id,
    name: u.full_name,
    email: u.email ?? "",
    phone: u.phone ?? "",
    subjects: subjects.filter((s) => s.user_id === u.id).map((s) => s.subject_id as string),
    students: Number(students.find((s) => s.tutor_id === u.id)?.n ?? 0),
    groups: Number(groups.find((g) => g.tutor_id === u.id)?.n ?? 0),
  }));
}

export async function create() {
  const [res] = await pool.query<ResultSetHeader>("INSERT INTO users (role, full_name) VALUES ('tutor', 'New tutor')");
  await pool.query("UPDATE users SET user_code = CONCAT('TUT-', LPAD(id, 5, '0')) WHERE id = ?", [res.insertId]);
  return (await list()).find((t) => t.id === res.insertId)!;
}

export async function update(id: number, input: UpdateTutorInput) {
  const [found] = await pool.query<RowDataPacket[]>("SELECT id FROM users WHERE id = ? AND role = 'tutor'", [id]);
  if (found.length === 0) throw new AppError(404, "Tutor not found");
  const valid = new Set((await allSubjects()).map((s) => s.id));
  const subjects = [...new Set(input.subjects)].filter((s) => valid.has(s));
  try {
    await inTransaction(async (conn) => {
      await conn.query("UPDATE users SET full_name = ?, email = ?, phone = ? WHERE id = ?", [input.name, input.email || null, input.phone || null, id]);
      await conn.query("DELETE FROM tutor_subjects WHERE user_id = ?", [id]);
      for (const s of subjects) await conn.query("INSERT INTO tutor_subjects (user_id, subject_id) VALUES (?, ?)", [id, s]);
    });
  } catch (err) {
    if ((err as { code?: string }).code === "ER_DUP_ENTRY") throw new AppError(409, "That email is already used by someone else.");
    throw err;
  }
  return (await list()).find((t) => t.id === id)!;
}
