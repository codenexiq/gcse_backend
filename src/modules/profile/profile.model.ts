import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../../config/db/index.js";
import { userCode, type Role } from "../auth/user.model.js";
import type { ImageKind, ProfileInput } from "./profile.schemas.js";

interface ProfileRow extends RowDataPacket {
  id: number;
  full_name: string;
  email: string;
  role: Role;
  user_code: string | null;
  username: string | null;
  phone: string | null;
  gender: string | null;
  headline: string | null;
  location: string | null;
  bio: string | null;
  created_at: Date;
  avatar_v: number | null;
  cover_v: number | null;
}

/** Everything the profile page shows. The picture "versions" change whenever a picture changes (so browsers fetch the new one). */
export async function getProfile(userId: number) {
  const [rows] = await pool.query<ProfileRow[]>(
    `SELECT u.id, u.full_name, u.email, u.role, u.user_code, u.username, u.phone, u.gender, u.headline, u.location, u.bio, u.created_at,
       (SELECT UNIX_TIMESTAMP(updated_at) FROM user_images WHERE user_id = u.id AND kind = 'avatar') AS avatar_v,
       (SELECT UNIX_TIMESTAMP(updated_at) FROM user_images WHERE user_id = u.id AND kind = 'cover') AS cover_v
     FROM users u WHERE u.id = ?`,
    [userId]
  );
  const r = rows[0];
  if (!r) return null;
  // An account made some other way (for example straight in the database) has no ID yet: give it one now.
  let code = r.user_code;
  if (!code) {
    code = userCode(r.role, r.id);
    await pool.query("UPDATE users SET user_code = ? WHERE id = ? AND user_code IS NULL", [code, r.id]);
  }
  const [first, ...rest] = r.full_name.split(" ");
  return {
    id: r.id,
    fullName: r.full_name,
    firstName: first,
    lastName: rest.join(" "),
    email: r.email,
    role: r.role,
    /** The account's unique User ID, e.g. STU-00042, TUT-00002 or ADM-00001. */
    userCode: code,
    username: r.username ?? "",
    phone: r.phone ?? "",
    gender: r.gender ?? "",
    headline: r.headline ?? "",
    location: r.location ?? "",
    bio: r.bio ?? "",
    createdAt: r.created_at,
    avatarVersion: r.avatar_v ? Number(r.avatar_v) : null,
    coverVersion: r.cover_v ? Number(r.cover_v) : null,
  };
}

/** The role of an account, or null when there is none. */
export async function getRole(userId: number) {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT role FROM users WHERE id = ?", [userId]);
  return rows[0] ? (rows[0].role as Role) : null;
}

export async function updateProfile(userId: number, f: ProfileInput) {
  await pool.query(
    "UPDATE users SET full_name = ?, username = ?, phone = ?, gender = ?, headline = ?, location = ?, bio = ? WHERE id = ?",
    [`${f.firstName} ${f.lastName}`.trim(), f.username || null, f.phone || null, f.gender || null, f.headline || null, f.location || null, f.bio || null, userId]
  );
}

export async function getPasswordHash(userId: number) {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT password_hash FROM users WHERE id = ?", [userId]);
  return rows[0] ? (rows[0].password_hash as string) : null;
}

/** Saves the new password and remembers when, so every session that began earlier stops working. */
export async function setPassword(userId: number, passwordHash: string) {
  // The time comes from this server (not the database), the same clock that stamps the new session, so the two can never disagree.
  await pool.query("UPDATE users SET password_hash = ?, password_changed_at = FROM_UNIXTIME(?) WHERE id = ?", [passwordHash, Math.floor(Date.now() / 1000), userId]);
}

/** Each piece of a picture is at most this big, well under a 1 MB packet limit once encoded in the query. */
const CHUNK_BYTES = 192 * 1024;

/** Saves a picture, replacing the one of that kind the person had before. */
export async function saveImage(userId: number, kind: ImageKind, mime: string, data: Buffer) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("DELETE FROM user_images WHERE user_id = ? AND kind = ?", [userId, kind]); // its pieces go with it
    await conn.query<ResultSetHeader>("INSERT INTO user_images (user_id, kind, mime, size) VALUES (?, ?, ?, ?)", [userId, kind, mime, data.length]);
    for (let seq = 0, at = 0; at < data.length; seq++, at += CHUNK_BYTES) {
      await conn.query("INSERT INTO user_image_chunks (user_id, kind, seq, data) VALUES (?, ?, ?, ?)", [userId, kind, seq, data.subarray(at, at + CHUNK_BYTES)]);
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  const [rows] = await pool.query<RowDataPacket[]>("SELECT UNIX_TIMESTAMP(updated_at) AS v FROM user_images WHERE user_id = ? AND kind = ?", [userId, kind]);
  return Number(rows[0].v);
}

export async function deleteImage(userId: number, kind: ImageKind) {
  await pool.query("DELETE FROM user_images WHERE user_id = ? AND kind = ?", [userId, kind]);
}

interface ImageRow extends RowDataPacket {
  mime: string;
}
interface ChunkRow extends RowDataPacket {
  data: Buffer;
}

export async function getImage(userId: number, kind: ImageKind) {
  const [rows] = await pool.query<ImageRow[]>("SELECT mime FROM user_images WHERE user_id = ? AND kind = ?", [userId, kind]);
  if (rows.length === 0) return null;
  const [chunks] = await pool.query<ChunkRow[]>("SELECT data FROM user_image_chunks WHERE user_id = ? AND kind = ? ORDER BY seq", [userId, kind]);
  return { mime: rows[0].mime, data: Buffer.concat(chunks.map((c) => c.data)) };
}
