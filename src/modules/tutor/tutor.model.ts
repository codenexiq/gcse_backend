import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../../config/db/index.js";
import type { Role } from "../auth/user.model.js";
import type { StudentFields } from "./tutor.schemas.js";

interface CountRow extends RowDataPacket {
  total: number;
}
interface RoleCountRow extends RowDataPacket {
  role: Role;
  total: number;
}
interface AccountRow extends RowDataPacket {
  id: number;
  full_name: string;
  email: string;
  role: Role;
  created_at: Date;
  avatar_v?: number | null;
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

interface StudentRow extends RowDataPacket {
  id: number;
  student_code: string | null;
  full_name: string;
  email: string;
  is_active: number;
  created_at: Date;
  headline: string | null;
  location: string | null;
  level: string | null;
  subject: string | null;
  school_year: string | null;
  avatar_v: number | null;
}

/** One line of the students table: the account, plus what the student wrote in "About you" (if they did). */
const STUDENT_SELECT = `SELECT u.id, u.user_code AS student_code, u.full_name, u.email, u.is_active, u.created_at, u.headline, u.location,
    p.level, so.label AS subject, sy.label AS school_year,
    (SELECT UNIX_TIMESTAMP(updated_at) FROM user_images WHERE user_id = u.id AND kind = 'avatar') AS avatar_v
  FROM users u
  LEFT JOIN student_profiles p ON p.user_id = u.id
  LEFT JOIN startup_options so ON so.id = p.subject_id
  LEFT JOIN startup_options sy ON sy.id = p.school_year_id
  WHERE u.role = 'student'`;

const toStudent = (r: StudentRow) => ({
  id: r.id,
  student_code: r.student_code,
  full_name: r.full_name,
  email: r.email,
  is_active: Boolean(r.is_active),
  created_at: r.created_at,
  headline: r.headline,
  location: r.location,
  level: r.level,
  subject: r.subject,
  school_year: r.school_year,
  /** Changes whenever the student's profile picture changes; null when they have none. */
  avatar_version: r.avatar_v ? Number(r.avatar_v) : null,
});

export async function listStudents() {
  const [rows] = await pool.query<StudentRow[]>(`${STUDENT_SELECT} ORDER BY u.created_at DESC, u.id DESC LIMIT 500`);
  return rows.map(toStudent);
}

export async function getStudent(id: number) {
  const [rows] = await pool.query<StudentRow[]>(`${STUDENT_SELECT} AND u.id = ?`, [id]);
  return rows[0] ? toStudent(rows[0]) : null;
}

interface ProfileRow extends RowDataPacket {
  id: number;
  student_code: string | null;
  username: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  gender: string | null;
  headline: string | null;
  location: string | null;
  bio: string | null;
  is_active: number;
  created_at: Date;
  avatar_v: number | null;
  cover_v: number | null;
}

/** Everything about one student that the profile screen shows and edits. */
export async function getStudentProfile(id: number) {
  const [rows] = await pool.query<ProfileRow[]>(
    `SELECT u.id, u.user_code AS student_code, u.username, u.full_name, u.email, u.phone, u.gender, u.headline, u.location, u.bio, u.is_active, u.created_at,
       (SELECT UNIX_TIMESTAMP(updated_at) FROM user_images WHERE user_id = u.id AND kind = 'avatar') AS avatar_v,
       (SELECT UNIX_TIMESTAMP(updated_at) FROM user_images WHERE user_id = u.id AND kind = 'cover') AS cover_v
     FROM users u WHERE u.id = ? AND u.role = 'student'`,
    [id]
  );
  const r = rows[0];
  if (!r) return null;
  const [first, ...rest] = r.full_name.split(" ");
  return {
    id: r.id,
    studentCode: r.student_code,
    username: r.username ?? "",
    fullName: r.full_name,
    firstName: first,
    lastName: rest.join(" "),
    email: r.email,
    phone: r.phone ?? "",
    gender: r.gender ?? "",
    headline: r.headline ?? "",
    location: r.location ?? "",
    bio: r.bio ?? "",
    isActive: Boolean(r.is_active),
    createdAt: r.created_at,
    avatarVersion: r.avatar_v ? Number(r.avatar_v) : null,
    coverVersion: r.cover_v ? Number(r.cover_v) : null,
  };
}

export { usernameTaken } from "../auth/user.model.js";

/** Saves what an admin or tutor entered about a student. False if there is no such student. */
export async function saveStudentFields(id: number, f: Omit<StudentFields, "newPassword">) {
  const fullName = `${f.firstName} ${f.lastName}`.trim();
  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE users SET full_name = ?, email = ?, username = ?, phone = ?, gender = ?, headline = ?, location = ?, bio = ?, is_active = ?
     WHERE id = ? AND role = 'student'`,
    [fullName, f.email, f.username || null, f.phone || null, f.gender || null, f.headline || null, f.location || null, f.bio || null, f.isActive ? 1 : 0, id]
  );
  return result.affectedRows > 0;
}

/** Deletes a student and everything of theirs (answers, chats, reports, pictures). */
export async function deleteStudent(id: number) {
  const [result] = await pool.query<ResultSetHeader>("DELETE FROM users WHERE id = ? AND role = 'student'", [id]);
  return result.affectedRows > 0;
}

/** Does something to several students at once. Only ever touches students. Returns how many were changed. */
export async function bulkStudents(ids: number[], action: "activate" | "deactivate" | "delete") {
  const [result] =
    action === "delete"
      ? await pool.query<ResultSetHeader>("DELETE FROM users WHERE id IN (?) AND role = 'student'", [ids])
      : await pool.query<ResultSetHeader>("UPDATE users SET is_active = ? WHERE id IN (?) AND role = 'student'", [action === "activate" ? 1 : 0, ids]);
  return result.affectedRows;
}

export async function isStudentId(id: number) {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT id FROM users WHERE id = ? AND role = 'student'", [id]);
  return rows.length > 0;
}

export async function listTutor() {
  const [rows] = await pool.query<AccountRow[]>(
    `SELECT id, full_name, email, role, created_at, (SELECT UNIX_TIMESTAMP(updated_at) FROM user_images WHERE user_id = users.id AND kind = 'avatar') AS avatar_v
     FROM users WHERE role IN ('tutor', 'admin') ORDER BY role, created_at DESC, id DESC LIMIT 500`
  );
  // avatar_version changes whenever the picture changes; null when there is none.
  return rows.map((r) => ({ id: r.id, full_name: r.full_name, email: r.email, role: r.role, created_at: r.created_at, avatar_version: r.avatar_v ? Number(r.avatar_v) : null }));
}
