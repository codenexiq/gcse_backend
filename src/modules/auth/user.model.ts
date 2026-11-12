import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../../config/db/index.js";

export type Role = "student" | "tutor" | "admin";

export interface UserRow extends RowDataPacket {
  id: number;
  full_name: string;
  email: string;
  password_hash: string;
  role: Role;
  is_active: number;
  /** Only set by findById: when the password last changed (unix seconds) and the version of the profile picture. */
  pw_changed?: number | null;
  avatar_version?: number | null;
  chat_color?: string | null;
}

export async function findByEmail(email: string) {
  const [rows] = await pool.query<UserRow[]>("SELECT * FROM users WHERE email = ?", [email]);
  return rows[0];
}

export async function findById(id: number) {
  const [rows] = await pool.query<UserRow[]>(`SELECT id, full_name, email, role, is_active, chat_color, UNIX_TIMESTAMP(password_changed_at) AS pw_changed,
            (SELECT UNIX_TIMESTAMP(updated_at) FROM user_images WHERE user_id = users.id AND kind = 'avatar') AS avatar_version
     FROM users WHERE id = ?`, [id]);
  return rows[0];
}

/** Is this @username already used by someone? (`exceptId` is the person asking, who may keep their own.) */
export async function usernameTaken(username: string, exceptId = 0) {
  const [rows] = await pool.query<UserRow[]>("SELECT id FROM users WHERE username = ? AND id <> ?", [username, exceptId]);
  return rows.length > 0;
}

/** An account's unique User ID, made from the account number (so it can never repeat): STU-00042, TUT-00002 or ADM-00001. */
export const userCode = (role: Role, id: number) => `${role === "tutor" ? "TUT" : role === "admin" ? "ADM" : "STU"}-${String(id).padStart(5, "0")}`;
