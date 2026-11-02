import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../../config/db/index.js";
import type { Role } from "../auth/user.model.js";
import { DELETE_FOR_EVERYONE_SECONDS } from "./chat.schemas.js";

// A chat belongs to ONE student and ONE tutor/admin (staff). Two admins talking to the same student have two separate chats.
export interface Pair {
  studentId: number;
  staffId: number;
}

/** The role of an account, or null when there is no such account. */
export async function roleOf(id: number): Promise<Role | null> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT role FROM users WHERE id = ?", [id]);
  return rows[0] ? (rows[0].role as Role) : null;
}

interface ConversationRow extends RowDataPacket {
  peer_id: number;
  full_name: string;
  email: string;
  role: Role;
  avatar_v: number | null;
  last_body: string | null;
  last_has_file: number | null;
  last_at: Date | null;
  last_id: number | null;
  last_deleted: number | null;
  cleared: number;
  unread: number;
}

function toConversations(rows: ConversationRow[]) {
  return rows.map((r) => {
    // Nothing newer than what this person cleared: show the chat as empty.
    const shown = r.last_id !== null && r.last_id > r.cleared;
    return {
      peerId: r.peer_id,
      fullName: r.full_name,
      email: r.email,
      peerRole: r.role,
      /** Changes whenever the person's profile picture changes; null when they have none. */
      avatarVersion: r.avatar_v ? Number(r.avatar_v) : null,
      lastBody: shown ? (r.last_deleted ? "This message was deleted" : r.last_body) : null,
      lastHasFile: shown && !r.last_deleted && Boolean(r.last_has_file),
      lastAt: shown ? r.last_at : null,
      unread: Number(r.unread),
    };
  });
}

/** A tutor's or admin's list: only the students THIS person already has a chat with (new chats start from a search). */
export async function listForStaff(staffId: number) {
  // The inbox has loaded: the students' messages to this person are now delivered.
  await pool.query(
    `INSERT INTO chat_threads (student_id, staff_id, tutor_delivered_id)
     SELECT student_id, staff_id, MAX(id) FROM chat_messages WHERE staff_id = ? GROUP BY student_id, staff_id
     ON DUPLICATE KEY UPDATE tutor_delivered_id = GREATEST(tutor_delivered_id, VALUES(tutor_delivered_id))`,
    [staffId]
  );
  const [rows] = await pool.query<ConversationRow[]>(
    `SELECT u.id AS peer_id, u.full_name, u.email, u.role,
       (SELECT UNIX_TIMESTAMP(updated_at) FROM user_images WHERE user_id = u.id AND kind = 'avatar') AS avatar_v,
       lm.body AS last_body, (lm.attachment_id IS NOT NULL) AS last_has_file, lm.created_at AS last_at,
       lm.id AS last_id, (lm.deleted_at IS NOT NULL) AS last_deleted, COALESCE(cl.cleared_id, 0) AS cleared,
       (SELECT COUNT(*) FROM chat_messages m WHERE m.student_id = u.id AND m.staff_id = ? AND m.sender_id = u.id AND m.deleted_at IS NULL
          AND m.id > GREATEST(COALESCE(c.tutor_read_id, 0), COALESCE(cl.cleared_id, 0))
          AND NOT EXISTS (SELECT 1 FROM chat_message_hides h WHERE h.message_id = m.id AND h.user_id = ?)) AS unread
     FROM users u
     LEFT JOIN chat_threads c ON c.student_id = u.id AND c.staff_id = ?
     LEFT JOIN chat_clears cl ON cl.student_id = u.id AND cl.staff_id = ? AND cl.user_id = ?
     LEFT JOIN chat_messages lm ON lm.id = (SELECT MAX(m.id) FROM chat_messages m WHERE m.student_id = u.id AND m.staff_id = ? AND NOT EXISTS (SELECT 1 FROM chat_message_hides h WHERE h.message_id = m.id AND h.user_id = ?))
     WHERE u.role = 'student' AND lm.id IS NOT NULL
     ORDER BY lm.id DESC, u.full_name
     LIMIT 500`,
    [staffId, staffId, staffId, staffId, staffId, staffId, staffId]
  );
  return toConversations(rows);
}

/** A student's list: every tutor and admin, with this student's chat with each of them. */
export async function listForStudent(studentId: number) {
  await pool.query(
    `INSERT INTO chat_threads (student_id, staff_id, student_delivered_id)
     SELECT student_id, staff_id, MAX(id) FROM chat_messages WHERE student_id = ? GROUP BY student_id, staff_id
     ON DUPLICATE KEY UPDATE student_delivered_id = GREATEST(student_delivered_id, VALUES(student_delivered_id))`,
    [studentId]
  );
  const [rows] = await pool.query<ConversationRow[]>(
    `SELECT u.id AS peer_id, u.full_name, u.email, u.role,
       (SELECT UNIX_TIMESTAMP(updated_at) FROM user_images WHERE user_id = u.id AND kind = 'avatar') AS avatar_v,
       lm.body AS last_body, (lm.attachment_id IS NOT NULL) AS last_has_file, lm.created_at AS last_at,
       lm.id AS last_id, (lm.deleted_at IS NOT NULL) AS last_deleted, COALESCE(cl.cleared_id, 0) AS cleared,
       (SELECT COUNT(*) FROM chat_messages m WHERE m.student_id = ? AND m.staff_id = u.id AND m.sender_id = u.id AND m.deleted_at IS NULL
          AND m.id > GREATEST(COALESCE(c.student_read_id, 0), COALESCE(cl.cleared_id, 0))
          AND NOT EXISTS (SELECT 1 FROM chat_message_hides h WHERE h.message_id = m.id AND h.user_id = ?)) AS unread
     FROM users u
     LEFT JOIN chat_threads c ON c.student_id = ? AND c.staff_id = u.id
     LEFT JOIN chat_clears cl ON cl.student_id = ? AND cl.staff_id = u.id AND cl.user_id = ?
     LEFT JOIN chat_messages lm ON lm.id = (SELECT MAX(m.id) FROM chat_messages m WHERE m.student_id = ? AND m.staff_id = u.id AND NOT EXISTS (SELECT 1 FROM chat_message_hides h WHERE h.message_id = m.id AND h.user_id = ?))
     WHERE u.role IN ('tutor', 'admin')
     ORDER BY (lm.id IS NULL), lm.id DESC, u.full_name
     LIMIT 500`,
    [studentId, studentId, studentId, studentId, studentId, studentId, studentId]
  );
  return toConversations(rows);
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
  att_id: number | null;
  file_name: string | null;
  size: number | null;
  r_id: number | null;
  r_name: string | null;
  r_body: string | null;
  r_deleted: number | null;
  r_file: string | null;
}

interface PointerRow extends RowDataPacket {
  tutor_read_id: number;
  tutor_delivered_id: number;
  student_read_id: number;
  student_delivered_id: number;
  wiped_id: number;
}

/** How far each side has received and read, for the ticks. A message is "read" when its id is at or below the pointer. */
async function getPointers({ studentId, staffId }: Pair) {
  const [rows] = await pool.query<PointerRow[]>(
    "SELECT tutor_read_id, tutor_delivered_id, student_read_id, student_delivered_id, wiped_id FROM chat_threads WHERE student_id = ? AND staff_id = ?",
    [studentId, staffId]
  );
  const r = rows[0];
  return {
    tutorRead: r ? Number(r.tutor_read_id) : 0,
    tutorDelivered: r ? Number(r.tutor_delivered_id) : 0,
    studentRead: r ? Number(r.student_read_id) : 0,
    studentDelivered: r ? Number(r.student_delivered_id) : 0,
    /** Everything up to this id was removed when the whole chat was deleted. */
    wipedUpTo: r ? Number(r.wiped_id) : 0,
  };
}

/** The newest message this person has cleared away (0 = they never cleared this chat). */
async function clearedUpTo({ studentId, staffId }: Pair, userId: number) {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT cleared_id FROM chat_clears WHERE student_id = ? AND staff_id = ? AND user_id = ?", [studentId, staffId, userId]);
  return rows[0] ? Number(rows[0].cleared_id) : 0;
}

/**
 * Messages of one chat. With afterId = 0 these are the latest 200; otherwise only the ones newer than afterId.
 * Whoever asks has now received them (and read them, if there were any), which turns the other side's ticks.
 * The pointers come back every time, so ticks on older messages can turn blue.
 */
export async function listMessages(pair: Pair, afterId: number, viewer: "student" | "tutor", userId: number) {
  const { studentId, staffId } = pair;
  const latest = afterId === 0;
  // Messages this person cleared stay hidden from them (the other side still has them).
  const cleared = await clearedUpTo(pair, userId);
  const from = Math.max(afterId, cleared);
  const [rows] = await pool.query<MessageRow[]>(
    `SELECT m.id, m.sender_id, u.full_name, u.role, m.body, m.created_at, (m.deleted_at IS NOT NULL) AS deleted, TIMESTAMPDIFF(SECOND, m.created_at, NOW()) AS age, a.id AS att_id, a.file_name, a.size,
       rm.id AS r_id, ru.full_name AS r_name, rm.body AS r_body, (rm.deleted_at IS NOT NULL) AS r_deleted, ra.file_name AS r_file
     FROM chat_messages m
     JOIN users u ON u.id = m.sender_id
     LEFT JOIN chat_attachments a ON a.id = m.attachment_id
     LEFT JOIN chat_messages rm ON rm.id = m.reply_to_id
     LEFT JOIN users ru ON ru.id = rm.sender_id
     LEFT JOIN chat_attachments ra ON ra.id = rm.attachment_id
     WHERE m.student_id = ? AND m.staff_id = ? AND m.id > ?
       AND NOT EXISTS (SELECT 1 FROM chat_message_hides h WHERE h.message_id = m.id AND h.user_id = ?)
     ORDER BY m.id ${latest ? "DESC" : "ASC"} LIMIT 200`,
    [studentId, staffId, from, userId]
  );
  // Messages deleted by their sender, so a screen that already has them can show "deleted" instead.
  const [gone] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM chat_messages WHERE student_id = ? AND staff_id = ? AND deleted_at IS NOT NULL AND id > ? ORDER BY id DESC LIMIT 200",
    [studentId, staffId, cleared]
  );
  if (latest) rows.reverse();
  const who = viewer === "student" ? "student" : "tutor";
  // Delivered: this screen has the newest message. Read: it has shown messages just now.
  await pool.query(
    `INSERT INTO chat_threads (student_id, staff_id, ${who}_delivered_id, ${who}_read_id)
     SELECT ?, ?, COALESCE(MAX(id), 0), ? FROM chat_messages WHERE student_id = ? AND staff_id = ?
     ON DUPLICATE KEY UPDATE ${who}_delivered_id = GREATEST(${who}_delivered_id, VALUES(${who}_delivered_id)), ${who}_read_id = GREATEST(${who}_read_id, VALUES(${who}_read_id))`,
    [studentId, staffId, rows.length > 0 ? rows[rows.length - 1].id : 0, studentId, staffId]
  );
  return {
    messages: rows.map((r) => ({
      id: r.id,
      senderId: r.sender_id,
      senderName: r.full_name,
      senderRole: r.role,
      body: r.body,
      createdAt: r.created_at,
      deleted: Boolean(r.deleted),
      /** Seconds left in which the sender can still "delete for everyone" (0 = no longer possible). */
      windowLeft: Math.max(0, DELETE_FOR_EVERYONE_SECONDS - Number(r.age)),
      attachment: r.att_id === null ? null : { id: r.att_id, name: r.file_name as string, size: Number(r.size) },
      /** The message this one answers, as a short quote (the text is left out if that message was deleted for everyone). */
      replyTo:
        r.r_id === null
          ? null
          : { id: r.r_id, senderName: r.r_name as string, body: r.r_deleted ? null : r.r_body, fileName: r.r_deleted ? null : r.r_file, deleted: Boolean(r.r_deleted) },
    })),
    deletedIds: gone.map((g) => Number(g.id)),
    pointers: await getPointers(pair),
  };
}

/** Each piece of a file is at most this big (hex-encoded in the query it is twice that), well under a 1 MB packet limit. */
const CHUNK_BYTES = 192 * 1024;

export async function saveAttachment({ studentId, staffId }: Pair, uploadedBy: number, fileName: string, data: Buffer) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query<ResultSetHeader>(
      "INSERT INTO chat_attachments (student_id, staff_id, uploaded_by, file_name, size) VALUES (?, ?, ?, ?, ?)",
      [studentId, staffId, uploadedBy, fileName, data.length]
    );
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

/** Adds a message. The file (if any) must be one this person just uploaded to this chat and not used yet. */
export async function addMessage({ studentId, staffId }: Pair, senderId: number, body: string | undefined, attachmentId: number | undefined, replyToId?: number) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (attachmentId !== undefined) {
      const [att] = await conn.query<RowDataPacket[]>(
        "SELECT id FROM chat_attachments WHERE id = ? AND student_id = ? AND staff_id = ? AND uploaded_by = ? AND message_id IS NULL FOR UPDATE",
        [attachmentId, studentId, staffId, senderId]
      );
      if (att.length === 0) {
        await conn.rollback();
        return null;
      }
    }
    if (replyToId !== undefined) {
      // You can only answer a message of this same chat (and not one that was deleted for everyone).
      const [original] = await conn.query<RowDataPacket[]>(
        "SELECT id FROM chat_messages WHERE id = ? AND student_id = ? AND staff_id = ? AND deleted_at IS NULL",
        [replyToId, studentId, staffId]
      );
      if (original.length === 0) {
        await conn.rollback();
        return null;
      }
    }
    const [result] = await conn.query<ResultSetHeader>(
      "INSERT INTO chat_messages (student_id, staff_id, sender_id, body, attachment_id, reply_to_id) VALUES (?, ?, ?, ?, ?, ?)",
      [studentId, staffId, senderId, body && body.length > 0 ? body : null, attachmentId ?? null, replyToId ?? null]
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

interface AttachmentRow extends RowDataPacket {
  student_id: number | null;
  staff_id: number | null;
  /** Set for a file shared in a group chat (then there is no student and staff member). */
  group_id: number | null;
  file_name: string;
}
interface ChunkRow extends RowDataPacket {
  data: Buffer;
}

/** A shared file (only once it is attached to a message), put back together from its pieces. */
export async function getAttachment(id: number) {
  const [rows] = await pool.query<AttachmentRow[]>("SELECT student_id, staff_id, group_id, file_name FROM chat_attachments WHERE id = ? AND message_id IS NOT NULL", [id]);
  if (rows.length === 0) return null;
  const [chunks] = await pool.query<ChunkRow[]>("SELECT data FROM chat_attachment_chunks WHERE attachment_id = ? ORDER BY seq", [id]);
  return { ...rows[0], data: Buffer.concat(chunks.map((c) => c.data)) };
}

/** Unread messages for a tutor or admin: what students wrote to THIS person that they have not opened yet. */
export async function unreadForStaff(staffId: number) {
  // The screen has received them (the badge is showing), even if the chat has not been opened.
  await pool.query(
    `INSERT INTO chat_threads (student_id, staff_id, tutor_delivered_id)
     SELECT student_id, staff_id, MAX(id) FROM chat_messages WHERE staff_id = ? GROUP BY student_id, staff_id
     ON DUPLICATE KEY UPDATE tutor_delivered_id = GREATEST(tutor_delivered_id, VALUES(tutor_delivered_id))`,
    [staffId]
  );
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM chat_messages m
     LEFT JOIN chat_threads c ON c.student_id = m.student_id AND c.staff_id = m.staff_id
     LEFT JOIN chat_clears cl ON cl.student_id = m.student_id AND cl.staff_id = m.staff_id AND cl.user_id = ?
     WHERE m.staff_id = ? AND m.sender_id = m.student_id AND m.deleted_at IS NULL
       AND m.id > GREATEST(COALESCE(c.tutor_read_id, 0), COALESCE(cl.cleared_id, 0))
       AND NOT EXISTS (SELECT 1 FROM chat_message_hides h WHERE h.message_id = m.id AND h.user_id = ?)`,
    [staffId, staffId, staffId]
  );
  return Number(rows[0].n);
}

/** Unread messages for one student: what any tutor or admin wrote to them that they have not opened yet. */
export async function unreadForStudent(studentId: number) {
  await pool.query(
    `INSERT INTO chat_threads (student_id, staff_id, student_delivered_id)
     SELECT student_id, staff_id, MAX(id) FROM chat_messages WHERE student_id = ? GROUP BY student_id, staff_id
     ON DUPLICATE KEY UPDATE student_delivered_id = GREATEST(student_delivered_id, VALUES(student_delivered_id))`,
    [studentId]
  );
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM chat_messages m
     LEFT JOIN chat_threads c ON c.student_id = m.student_id AND c.staff_id = m.staff_id
     LEFT JOIN chat_clears cl ON cl.student_id = m.student_id AND cl.staff_id = m.staff_id AND cl.user_id = ?
     WHERE m.student_id = ? AND m.sender_id <> m.student_id AND m.deleted_at IS NULL
       AND m.id > GREATEST(COALESCE(c.student_read_id, 0), COALESCE(cl.cleared_id, 0))
       AND NOT EXISTS (SELECT 1 FROM chat_message_hides h WHERE h.message_id = m.id AND h.user_id = ?)`,
    [studentId, studentId, studentId]
  );
  return Number(rows[0].n);
}

/**
 * "Delete for everyone": removes one of your OWN messages for both people (the text and file go, a "deleted" note stays).
 * Only possible in the first 10 minutes after sending. Returns "ok", "missing" (not found / not yours) or "expired".
 */
export async function deleteForEveryone({ studentId, staffId }: Pair, messageId: number, userId: number): Promise<"ok" | "missing" | "expired"> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [mine] = await conn.query<RowDataPacket[]>(
      "SELECT TIMESTAMPDIFF(SECOND, created_at, NOW()) AS age FROM chat_messages WHERE id = ? AND student_id = ? AND staff_id = ? AND sender_id = ? AND deleted_at IS NULL FOR UPDATE",
      [messageId, studentId, staffId, userId]
    );
    if (mine.length === 0) {
      await conn.rollback();
      return "missing";
    }
    if (Number(mine[0].age) > DELETE_FOR_EVERYONE_SECONDS) {
      await conn.rollback();
      return "expired";
    }
    await conn.query("UPDATE chat_messages SET deleted_at = NOW(), body = NULL, attachment_id = NULL WHERE id = ?", [messageId]);
    await conn.query("DELETE FROM chat_attachments WHERE message_id = ? AND group_id IS NULL", [messageId]); // its pieces go with it
    await conn.commit();
    return "ok";
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** "Delete for me": hides any message of this chat (yours or theirs) from YOUR view only. The other person keeps it. */
export async function deleteForMe({ studentId, staffId }: Pair, messageId: number, userId: number) {
  const [found] = await pool.query<RowDataPacket[]>("SELECT id FROM chat_messages WHERE id = ? AND student_id = ? AND staff_id = ?", [messageId, studentId, staffId]);
  if (found.length === 0) return false;
  await pool.query("INSERT IGNORE INTO chat_message_hides (message_id, user_id) VALUES (?, ?)", [messageId, userId]);
  return true;
}

/** The newest message id in a chat (0 when empty). */
async function newestId({ studentId, staffId }: Pair) {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT COALESCE(MAX(id), 0) AS id FROM chat_messages WHERE student_id = ? AND staff_id = ?", [studentId, staffId]);
  return Number(rows[0].id);
}

/** Clear chat: empties the chat on THIS person's screen only. The other person keeps everything. */
export async function clearChat(pair: Pair, userId: number) {
  await pool.query(
    "INSERT INTO chat_clears (student_id, staff_id, user_id, cleared_id) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE cleared_id = GREATEST(cleared_id, VALUES(cleared_id))",
    [pair.studentId, pair.staffId, userId, await newestId(pair)]
  );
}

/** Delete chat: removes this chat (and its files) for both people. Other chats of the same student or tutor are untouched. */
export async function deleteChat({ studentId, staffId }: Pair) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [newest] = await conn.query<RowDataPacket[]>(
      "SELECT COALESCE(MAX(id), 0) AS id FROM chat_messages WHERE student_id = ? AND staff_id = ? FOR UPDATE",
      [studentId, staffId]
    );
    await conn.query("DELETE FROM chat_messages WHERE student_id = ? AND staff_id = ?", [studentId, staffId]);
    await conn.query("DELETE FROM chat_attachments WHERE student_id = ? AND staff_id = ?", [studentId, staffId]); // including files uploaded but never sent
    await conn.query("DELETE FROM chat_clears WHERE student_id = ? AND staff_id = ?", [studentId, staffId]);
    // Screens that still show old messages learn from wiped_id that they must drop them.
    await conn.query(
      "INSERT INTO chat_threads (student_id, staff_id, wiped_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE wiped_id = GREATEST(wiped_id, VALUES(wiped_id))",
      [studentId, staffId, Number(newest[0].id)]
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Finds students by name or email, so a tutor or admin can start a chat with one. There is no way to list every student:
 * the search needs at least 2 characters and gives at most 20 people.
 */
export async function searchStudents(query: string) {
  const text = query.trim();
  if (text.length < 2) return [];
  // The person's own % and _ are plain letters, not wildcards.
  const like = `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, full_name, email FROM users WHERE role = 'student' AND (full_name LIKE ? OR email LIKE ?) ORDER BY full_name, id LIMIT 20",
    [like, like]
  );
  return rows.map((r) => ({ peerId: Number(r.id), fullName: r.full_name as string, email: r.email as string, peerRole: "student" as const, lastBody: null, lastHasFile: false, lastAt: null, unread: 0 }));
}

interface PeerRow extends RowDataPacket {
  id: number;
  full_name: string;
  role: Role;
  username: string | null;
  headline: string | null;
  location: string | null;
  bio: string | null;
  user_code: string | null;
  email: string;
  phone: string | null;
  gender: string | null;
  created_at: Date;
  is_active: number;
  avatar_v: number | null;
  cover_v: number | null;
}

/**
 * What the contact card beside a chat shows about the other person.
 * `full` is for a tutor or admin looking at a STUDENT: then it has every detail (ID, email, phone ...).
 * A student looking at a tutor or admin only gets what that person put on their profile to be seen: no email, no phone number.
 */
export async function getPeerCard(id: number, full: boolean) {
  const [rows] = await pool.query<PeerRow[]>(
    `SELECT u.id, u.full_name, u.role, u.username, u.headline, u.location, u.bio, u.user_code, u.email, u.phone, u.gender, u.created_at, u.is_active,
       (SELECT UNIX_TIMESTAMP(updated_at) FROM user_images WHERE user_id = u.id AND kind = 'avatar') AS avatar_v,
       (SELECT UNIX_TIMESTAMP(updated_at) FROM user_images WHERE user_id = u.id AND kind = 'cover') AS cover_v
     FROM users u WHERE u.id = ?`,
    [id]
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    fullName: r.full_name,
    role: r.role,
    username: r.username ?? "",
    headline: r.headline ?? "",
    location: r.location ?? "",
    bio: r.bio ?? "",
    avatarVersion: r.avatar_v ? Number(r.avatar_v) : null,
    coverVersion: r.cover_v ? Number(r.cover_v) : null,
    ...(full ? { userCode: r.user_code, email: r.email, phone: r.phone ?? "", gender: r.gender ?? "", createdAt: r.created_at, isActive: Boolean(r.is_active) } : {}),
  };
}
