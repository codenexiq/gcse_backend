import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../../config/db/index.js";

export type Role = "student" | "tutor" | "admin";

export interface UserRow extends RowDataPacket {
  id: number;
  full_name: string;
  email: string;
  password_hash: string;
  role: Role;
}

export async function findByEmail(email: string) {
  const [rows] = await pool.query<UserRow[]>("SELECT * FROM users WHERE email = ?", [email]);
  return rows[0];
}

export async function findById(id: number) {
  const [rows] = await pool.query<UserRow[]>("SELECT id, full_name, email, role FROM users WHERE id = ?", [id]);
  return rows[0];
}

/** Accounts made through the website are always students. Tutor are made with `npm run tutor:create`. */
export async function create({ fullName, email, passwordHash }: { fullName: string; email: string; passwordHash: string }) {
  const [result] = await pool.query<ResultSetHeader>(
    "INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, 'student')",
    [fullName, email, passwordHash]
  );
  return { id: result.insertId, fullName, email, role: "student" as const };
}
