import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../../config/db/index.js";
import type { Role } from "../auth/user.model.js";

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
      lastBody: shown ? (r.last_deleted ? "This message was deleted" : r.last_body) : null,
      lastHasFile: shown && !r.last_deleted && Boolean(r.last_has_file),
      lastAt: shown ? r.last_at : null,
      unread: Number(r.unread),
    };
  });
}

/** A tutor's or admin's list: every student, with THIS person's chat with them. */
export async function listForStaff(staffId: number) {
  // The inbox has loaded: the students' messages to this person are now delivered.
  await pool.query(
    `INSERT INTO chat_threads (student_id, staff_id, tutor_delivered_id)
     SELECT student_id, staff_id, MAX(id) FROM chat_messages WHERE staff_id = ? GROUP BY student_id, staff_id
     ON DUPLICATE KEY UPDATE tutor_delivered_id = GREATEST(tutor_delivered_id, VALUES(tutor_delivered_id))`,
    [staffId]
  );
  const [rows] = await pool.query<ConversationRow[]>(
    `SELECT u.id AS peer_id, u.full_name, u.email, u.role, lm.body AS last_body, (lm.attachment_id IS NOT NULL) AS last_has_file, lm.created_at AS last_at,
       lm.id AS last_id, (lm.deleted_at IS NOT NULL) AS last_deleted, COALESCE(cl.cleared_id, 0) AS cleared,
       (SELECT COUNT(*) FROM chat_messages m WHERE m.student_id = u.id AND m.staff_id = ? AND m.sender_id = u.id AND m.deleted_at IS NULL
          AND m.id > GREATEST(COALESCE(c.tutor_read_id, 0), COALESCE(cl.cleared_id, 0))) AS unread
     FROM users u
     LEFT JOIN chat_threads c ON c.student_id = u.id AND c.staff_id = ?
     LEFT JOIN chat_clears cl ON cl.student_id = u.id AND cl.staff_id = ? AND cl.user_id = ?
     LEFT JOIN chat_messages lm ON lm.id = (SELECT MAX(id) FROM chat_messages WHERE student_id = u.id AND staff_id = ?)
     WHERE u.role = 'student'
     ORDER BY (lm.id IS NULL), lm.id DESC, u.full_name
     LIMIT 500`,
    [staffId, staffId, staffId, staffId, staffId]
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
    `SELECT u.id AS peer_id, u.full_name, u.email, u.role, lm.body AS last_body, (lm.attachment_id IS NOT NULL) AS last_has_file, lm.created_at AS last_at,
       lm.id AS last_id, (lm.deleted_at IS NOT NULL) AS last_deleted, COALESCE(cl.cleared_id, 0) AS cleared,
       (SELECT COUNT(*) FROM chat_messages m WHERE m.student_id = ? AND m.staff_id = u.id AND m.sender_id = u.id AND m.deleted_at IS NULL
          AND m.id > GREATEST(COALESCE(c.student_read_id, 0), COALESCE(cl.cleared_id, 0))) AS unread
     FROM users u
     LEFT JOIN chat_threads c ON c.student_id = ? AND c.staff_id = u.id
     LEFT JOIN chat_clears cl ON cl.student_id = ? AND cl.staff_id = u.id AND cl.user_id = ?
     LEFT JOIN chat_messages lm ON lm.id = (SELECT MAX(id) FROM chat_messages WHERE student_id = ? AND staff_id = u.id)
     WHERE u.role IN ('tutor', 'admin')
     ORDER BY (lm.id IS NULL), lm.id DESC, u.full_name
     LIMIT 500`,
    [studentId, studentId, studentId, studentId, studentId]
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
  att_id: number | null;
  file_name: string | null;
  size: number | null;
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
    `SELECT m.id, m.sender_id, u.full_name, u.role, m.body, m.created_at, (m.deleted_at IS NOT NULL) AS deleted, a.id AS att_id, a.file_name, a.size
     FROM chat_messages m
     JOIN users u ON u.id = m.sender_id
     LEFT JOIN chat_attachments a ON a.id = m.attachment_id
     WHERE m.student_id = ? AND m.staff_id = ? AND m.id > ?
     ORDER BY m.id ${latest ? "DESC" : "ASC"} LIMIT 200`,
    [studentId, staffId, from]
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
      attachment: r.att_id === null ? null : { id: r.att_id, name: r.file_name as string, size: Number(r.size) },
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
export async function addMessage({ studentId, staffId }: Pair, senderId: number, body: string | undefined, attachmentId: number | undefined) {
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
    const [result] = await conn.query<ResultSetHeader>(
      "INSERT INTO chat_messages (student_id, staff_id, sender_id, body, attachment_id) VALUES (?, ?, ?, ?, ?)",
      [studentId, staffId, senderId, body && body.length > 0 ? body : null, attachmentId ?? null]
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
  student_id: number;
  staff_id: number;
  file_name: string;
}
interface ChunkRow extends RowDataPacket {
  data: Buffer;
}

/** A shared file (only once it is attached to a message), put back together from its pieces. */
export async function getAttachment(id: number) {
  const [rows] = await pool.query<AttachmentRow[]>("SELECT student_id, staff_id, file_name FROM chat_attachments WHERE id = ? AND message_id IS NOT NULL", [id]);
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
       AND m.id > GREATEST(COALESCE(c.tutor_read_id, 0), COALESCE(cl.cleared_id, 0))`,
    [staffId, staffId]
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
       AND m.id > GREATEST(COALESCE(c.student_read_id, 0), COALESCE(cl.cleared_id, 0))`,
    [studentId, studentId]
  );
  return Number(rows[0].n);
}

/** Deletes one of your OWN messages for both people: the text and file go, a "deleted" note stays. False if it is not yours. */
export async function deleteMessage({ studentId, staffId }: Pair, messageId: number, userId: number) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [mine] = await conn.query<RowDataPacket[]>(
      "SELECT id FROM chat_messages WHERE id = ? AND student_id = ? AND staff_id = ? AND sender_id = ? AND deleted_at IS NULL FOR UPDATE",
      [messageId, studentId, staffId, userId]
    );
    if (mine.length === 0) {
      await conn.rollback();
      return false;
    }
    await conn.query("UPDATE chat_messages SET deleted_at = NOW(), body = NULL, attachment_id = NULL WHERE id = ?", [messageId]);
    await conn.query("DELETE FROM chat_attachments WHERE message_id = ?", [messageId]); // its pieces go with it
    await conn.commit();
    return true;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
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
