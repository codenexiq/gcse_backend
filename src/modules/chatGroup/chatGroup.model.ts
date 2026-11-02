import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../../config/db/index.js";
import type { Role } from "../auth/user.model.js";
import { DELETE_FOR_EVERYONE_SECONDS } from "../chat/chat.schemas.js";

/** Who is asking. */
export interface Viewer {
  id: number;
  role: Role;
}

/** A message this person removed "for me" is left out. */
const NOT_HIDDEN = (alias: string) => `NOT EXISTS (SELECT 1 FROM chat_group_hides h WHERE h.message_id = ${alias}.id AND h.user_id = ?)`;

/**
 * Can this person open the group? Admins can open every group. A student only the groups they were added to.
 * Tutors are not part of group chats.
 */
export async function canAccess(viewer: Viewer, groupId: number): Promise<boolean> {
  if (viewer.role === "admin") {
    const [rows] = await pool.query<RowDataPacket[]>("SELECT id FROM chat_groups WHERE id = ?", [groupId]);
    return rows.length > 0;
  }
  if (viewer.role === "student") {
    const [rows] = await pool.query<RowDataPacket[]>("SELECT group_id FROM chat_group_members WHERE group_id = ? AND user_id = ?", [groupId, viewer.id]);
    return rows.length > 0;
  }
  return false;
}

/** Do these two people share a group? (Then they may see each other's profile picture.) */
export async function shareGroup(a: number, b: number): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT 1 FROM chat_group_members x JOIN chat_group_members y ON y.group_id = x.group_id WHERE x.user_id = ? AND y.user_id = ? LIMIT 1",
    [a, b]
  );
  return rows.length > 0;
}

interface GroupRow extends RowDataPacket {
  id: number;
  name: string;
  description: string | null;
  member_count: number;
  last_body: string | null;
  last_has_file: number | null;
  last_deleted: number | null;
  last_at: Date | null;
  unread: number;
}

/** The groups this person can open, newest conversation first, with how many messages they have not read. */
export async function listGroups(viewer: Viewer) {
  if (viewer.role === "tutor") return [];
  const student = viewer.role === "student";
  const v = viewer.id;
  const [rows] = await pool.query<GroupRow[]>(
    `SELECT g.id, g.name, g.description,
       (SELECT COUNT(*) FROM chat_group_members WHERE group_id = g.id) AS member_count,
       lm.body AS last_body, (lm.attachment_id IS NOT NULL) AS last_has_file, (lm.deleted_at IS NOT NULL) AS last_deleted, lm.created_at AS last_at,
       (SELECT COUNT(*) FROM chat_group_messages m WHERE m.group_id = g.id AND m.sender_id <> ? AND m.deleted_at IS NULL
          AND m.id > COALESCE(r.read_id, 0) AND ${NOT_HIDDEN("m")}) AS unread
     FROM chat_groups g
     ${student ? "JOIN chat_group_members me ON me.group_id = g.id AND me.user_id = ?" : ""}
     LEFT JOIN chat_group_reads r ON r.group_id = g.id AND r.user_id = ?
     LEFT JOIN chat_group_messages lm ON lm.id = (SELECT MAX(m2.id) FROM chat_group_messages m2 WHERE m2.group_id = g.id AND ${NOT_HIDDEN("m2")})
     ORDER BY (lm.id IS NULL), lm.id DESC, g.name
     LIMIT 200`,
    student ? [v, v, v, v, v] : [v, v, v, v]
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? "",
    memberCount: Number(r.member_count),
    lastBody: r.last_deleted ? "This message was deleted" : r.last_body,
    lastHasFile: !r.last_deleted && Boolean(r.last_has_file),
    lastAt: r.last_at,
    unread: Number(r.unread),
  }));
}

/** Unread group messages for the sidebar's red badge. */
export async function unreadTotal(viewer: Viewer): Promise<number> {
  if (viewer.role === "tutor") return 0;
  const student = viewer.role === "student";
  const v = viewer.id;
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM chat_group_messages m
     ${student ? "JOIN chat_group_members me ON me.group_id = m.group_id AND me.user_id = ?" : ""}
     LEFT JOIN chat_group_reads r ON r.group_id = m.group_id AND r.user_id = ?
     WHERE m.sender_id <> ? AND m.deleted_at IS NULL AND m.id > COALESCE(r.read_id, 0) AND ${NOT_HIDDEN("m")}`,
    student ? [v, v, v, v] : [v, v, v]
  );
  return Number(rows[0].n);
}

/** Adds students to a group. Only real students are added (a tutor's or admin's id in the list is ignored). Returns how many were new. */
export async function addMembers(groupId: number, studentIds: number[]): Promise<number> {
  if (studentIds.length === 0) return 0;
  const [result] = await pool.query<ResultSetHeader>(
    "INSERT IGNORE INTO chat_group_members (group_id, user_id) SELECT ?, id FROM users WHERE id IN (?) AND role = 'student'",
    [groupId, studentIds]
  );
  return result.affectedRows;
}

export async function createGroup(adminId: number, name: string, description: string, studentIds: number[]): Promise<number> {
  const [result] = await pool.query<ResultSetHeader>("INSERT INTO chat_groups (name, description, created_by) VALUES (?, ?, ?)", [name, description || null, adminId]);
  await addMembers(result.insertId, studentIds);
  return result.insertId;
}

interface MemberRow extends RowDataPacket {
  id: number;
  full_name: string;
  avatar_v: number | null;
}

/** One group with the students in it. */
export async function getGroup(groupId: number) {
  const [groups] = await pool.query<RowDataPacket[]>("SELECT id, name, description, created_at FROM chat_groups WHERE id = ?", [groupId]);
  const g = groups[0];
  if (!g) return null;
  const [members] = await pool.query<MemberRow[]>(
    `SELECT u.id, u.full_name, (SELECT UNIX_TIMESTAMP(updated_at) FROM user_images WHERE user_id = u.id AND kind = 'avatar') AS avatar_v
     FROM chat_group_members gm JOIN users u ON u.id = gm.user_id WHERE gm.group_id = ? ORDER BY u.full_name, u.id`,
    [groupId]
  );
  return {
    id: g.id as number,
    name: g.name as string,
    description: (g.description as string | null) ?? "",
    createdAt: g.created_at as Date,
    members: members.map((m) => ({ id: m.id, fullName: m.full_name, avatarVersion: m.avatar_v ? Number(m.avatar_v) : null })),
  };
}

export async function updateGroup(groupId: number, name: string, description: string): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>("UPDATE chat_groups SET name = ?, description = ? WHERE id = ?", [name, description || null, groupId]);
  return result.affectedRows > 0;
}

export async function removeMember(groupId: number, userId: number): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>("DELETE FROM chat_group_members WHERE group_id = ? AND user_id = ?", [groupId, userId]);
  await pool.query("DELETE FROM chat_group_reads WHERE group_id = ? AND user_id = ?", [groupId, userId]);
  return result.affectedRows > 0;
}

/** Deletes the group with every message and file in it. */
export async function deleteGroup(groupId: number): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>("DELETE FROM chat_groups WHERE id = ?", [groupId]);
  return result.affectedRows > 0;
}

interface MessageRow extends RowDataPacket {
  id: number;
  sender_id: number;
  full_name: string;
  role: Role;
  body: string | null;
  created_at: Date;
  deleted: number;
  age: number;
  sender_av: number | null;
  att_id: number | null;
  file_name: string | null;
  size: number | null;
  r_id: number | null;
  r_name: string | null;
  r_body: string | null;
  r_deleted: number | null;
  r_file: string | null;
}

/**
 * Messages of one group. With afterId = 0 these are the latest 200; otherwise only the ones newer than afterId.
 * Whoever asks has now read them. The answer has the same shape as a one-to-one chat (there are no read ticks in a group).
 */
export async function listMessages(groupId: number, afterId: number, viewerId: number) {
  const latest = afterId === 0;
  const [rows] = await pool.query<MessageRow[]>(
    `SELECT m.id, m.sender_id, u.full_name, u.role, m.body, m.created_at, (m.deleted_at IS NOT NULL) AS deleted,
       TIMESTAMPDIFF(SECOND, m.created_at, NOW()) AS age,
       (SELECT UNIX_TIMESTAMP(updated_at) FROM user_images WHERE user_id = u.id AND kind = 'avatar') AS sender_av,
       a.id AS att_id, a.file_name, a.size,
       rm.id AS r_id, ru.full_name AS r_name, rm.body AS r_body, (rm.deleted_at IS NOT NULL) AS r_deleted, ra.file_name AS r_file
     FROM chat_group_messages m
     JOIN users u ON u.id = m.sender_id
     LEFT JOIN chat_attachments a ON a.id = m.attachment_id
     LEFT JOIN chat_group_messages rm ON rm.id = m.reply_to_id
     LEFT JOIN users ru ON ru.id = rm.sender_id
     LEFT JOIN chat_attachments ra ON ra.id = rm.attachment_id
     WHERE m.group_id = ? AND m.id > ? AND ${NOT_HIDDEN("m")}
     ORDER BY m.id ${latest ? "DESC" : "ASC"} LIMIT 200`,
    [groupId, afterId, viewerId]
  );
  if (latest) rows.reverse();
  const [gone] = await pool.query<RowDataPacket[]>("SELECT id FROM chat_group_messages WHERE group_id = ? AND deleted_at IS NOT NULL ORDER BY id DESC LIMIT 200", [groupId]);
  if (rows.length > 0) {
    await pool.query(
      "INSERT INTO chat_group_reads (group_id, user_id, read_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE read_id = GREATEST(read_id, VALUES(read_id))",
      [groupId, viewerId, rows[rows.length - 1].id]
    );
  }
  return {
    messages: rows.map((r) => ({
      id: r.id,
      senderId: r.sender_id,
      senderName: r.full_name,
      senderRole: r.role,
      /** So the screen can show everybody's picture (they are all in this group). */
      senderAvatarVersion: r.sender_av ? Number(r.sender_av) : null,
      body: r.body,
      createdAt: r.created_at,
      deleted: Boolean(r.deleted),
      windowLeft: Math.max(0, DELETE_FOR_EVERYONE_SECONDS - Number(r.age)),
      attachment: r.att_id === null ? null : { id: r.att_id, name: r.file_name as string, size: Number(r.size) },
      replyTo:
        r.r_id === null
          ? null
          : { id: r.r_id, senderName: r.r_name as string, body: r.r_deleted ? null : r.r_body, fileName: r.r_deleted ? null : r.r_file, deleted: Boolean(r.r_deleted) },
    })),
    deletedIds: gone.map((g) => Number(g.id)),
    pointers: null,
  };
}

/** Each piece of a file is at most this big, well under a 1 MB packet limit once encoded in the query. */
const CHUNK_BYTES = 192 * 1024;

export async function saveAttachment(groupId: number, uploadedBy: number, fileName: string, data: Buffer) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query<ResultSetHeader>("INSERT INTO chat_attachments (group_id, uploaded_by, file_name, size) VALUES (?, ?, ?, ?)", [groupId, uploadedBy, fileName, data.length]);
    for (let seq = 0, at = 0; at < data.length; seq++, at += CHUNK_BYTES) {
      await conn.query("INSERT INTO chat_attachment_chunks (attachment_id, seq, data) VALUES (?, ?, ?)", [result.insertId, seq, data.subarray(at, at + CHUNK_BYTES)]);
    }
    await conn.commit();
    return { id: result.insertId, name: fileName, size: data.length };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** Adds a message. The file (if any) must be one this person just uploaded to this group; a reply must answer a message of this group. */
export async function addMessage(groupId: number, senderId: number, body: string | undefined, attachmentId?: number, replyToId?: number) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (attachmentId !== undefined) {
      const [att] = await conn.query<RowDataPacket[]>("SELECT id FROM chat_attachments WHERE id = ? AND group_id = ? AND uploaded_by = ? AND message_id IS NULL FOR UPDATE", [attachmentId, groupId, senderId]);
      if (att.length === 0) {
        await conn.rollback();
        return null;
      }
    }
    if (replyToId !== undefined) {
      const [original] = await conn.query<RowDataPacket[]>("SELECT id FROM chat_group_messages WHERE id = ? AND group_id = ? AND deleted_at IS NULL", [replyToId, groupId]);
      if (original.length === 0) {
        await conn.rollback();
        return null;
      }
    }
    const [result] = await conn.query<ResultSetHeader>(
      "INSERT INTO chat_group_messages (group_id, sender_id, body, attachment_id, reply_to_id) VALUES (?, ?, ?, ?, ?)",
      [groupId, senderId, body && body.length > 0 ? body : null, attachmentId ?? null, replyToId ?? null]
    );
    if (attachmentId !== undefined) await conn.query("UPDATE chat_attachments SET message_id = ? WHERE id = ?", [result.insertId, attachmentId]);
    await conn.commit();
    return result.insertId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * "Delete for everyone". A member can do it for their OWN message in the first 10 minutes. An admin can do it for ANY message at any time
 * (to keep the group in order). Returns "ok", "missing" (not found, or not yours) or "expired".
 */
export async function deleteForEveryone(groupId: number, messageId: number, viewer: Viewer): Promise<"ok" | "missing" | "expired"> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [found] = await conn.query<RowDataPacket[]>(
      "SELECT sender_id, TIMESTAMPDIFF(SECOND, created_at, NOW()) AS age FROM chat_group_messages WHERE id = ? AND group_id = ? AND deleted_at IS NULL FOR UPDATE",
      [messageId, groupId]
    );
    const m = found[0];
    if (!m || (viewer.role !== "admin" && m.sender_id !== viewer.id)) {
      await conn.rollback();
      return "missing";
    }
    if (viewer.role !== "admin" && Number(m.age) > DELETE_FOR_EVERYONE_SECONDS) {
      await conn.rollback();
      return "expired";
    }
    await conn.query("UPDATE chat_group_messages SET deleted_at = NOW(), body = NULL, attachment_id = NULL WHERE id = ?", [messageId]);
    await conn.query("DELETE FROM chat_attachments WHERE message_id = ? AND group_id = ?", [messageId, groupId]); // its pieces go with it
    await conn.commit();
    return "ok";
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** "Delete for me": hides a message of the group from this person's view only. */
export async function deleteForMe(groupId: number, messageId: number, userId: number): Promise<boolean> {
  const [found] = await pool.query<RowDataPacket[]>("SELECT id FROM chat_group_messages WHERE id = ? AND group_id = ?", [messageId, groupId]);
  if (found.length === 0) return false;
  await pool.query("INSERT IGNORE INTO chat_group_hides (message_id, user_id) VALUES (?, ?)", [messageId, userId]);
  return true;
}
