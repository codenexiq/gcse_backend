import type { RowDataPacket } from "mysql2";
import { pool } from "../../config/db/index.js";
import type { Role } from "../auth/user.model.js";

interface CountRow extends RowDataPacket {
  total: number;
}
interface RoleCountRow extends RowDataPacket {
  role: Role;
  total: number;
}
interface AccountRow extends RowDataPacket {
  id: number;
  email: string;
  role: Role;
  created_at: Date;
}

/** Headline numbers for the tutor dashboard. */
export async function overview() {
  const [byRole] = await pool.query<RoleCountRow[]>("SELECT role, COUNT(*) AS total FROM users GROUP BY role");
  const [items] = await pool.query<CountRow[]>("SELECT COUNT(*) AS total FROM items");
  const [subjects] = await pool.query<CountRow[]>("SELECT COUNT(*) AS total FROM subjects");
  const [topics] = await pool.query<CountRow[]>("SELECT COUNT(*) AS total FROM topics");

  const count = (role: Role) => byRole.find((r) => r.role === role)?.total ?? 0;
  return {
    students: count("student"),
    tutors: count("tutor"),
    admins: count("admin"),
    items: items[0].total,
    subjects: subjects[0].total,
    topics: topics[0].total,
  };
}

// idx_users_role_created (role, created_at) finds these rows already in order - no sorting needed.
export async function listStudents() {
  const [rows] = await pool.query<AccountRow[]>(
    "SELECT id, email, created_at FROM users WHERE role = 'student' ORDER BY created_at DESC, id DESC LIMIT 500"
  );
  return rows;
}

export async function listTutor() {
  const [rows] = await pool.query<AccountRow[]>(
    "SELECT id, email, role, created_at FROM users WHERE role IN ('tutor', 'admin') ORDER BY role, created_at DESC, id DESC LIMIT 500"
  );
  return rows;
}
