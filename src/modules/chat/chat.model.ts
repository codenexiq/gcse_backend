import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../../config/db/index.js";
import type { Role } from "../auth/user.model.js";

interface ConversationRow extends RowDataPacket {
  student_id: number;
  full_name: string;
  email: string;
  last_body: string | null;
  last_has_file: number | null;
  last_at: Date | null;
  last_id: number | null;
  last_deleted: number | null;
  cleared: number;
  unread: number;
}

/** Every student with their latest message and how many of their messages the tutors have not read (messages this person cleared do not count). */
export async function listConversations(userId: number) {
  // A tutor's inbox has loaded: every student message so far is now delivered.
  await pool.query(
    `INSERT INTO chat_conversations (student_id, tutor_delivered_id)
     SELECT student_id, MAX(id) FROM chat_messages GROUP BY student_id
     ON DUPLICATE KEY UPDATE tutor_delivered_id = GREATEST(tutor_delivered_id, VALUES(tutor_delivered_id))`
  );
  const [rows] = await pool.query<ConversationRow[]>(
    `SELECT u.id AS student_id, u.full_name, u.email, lm.body AS last_body, (lm.attachment_id IS NOT NULL) AS last_has_file, lm.created_at AS last_at,
       lm.id AS last_id, (lm.deleted_at IS NOT NULL) AS last_deleted, COALESCE(cl.cleared_id, 0) AS cleared,
       (SELECT COUNT(*) FROM chat_messages m WHERE m.student_id = u.id AND m.sender_id = u.id AND m.deleted_at IS NULL
          AND m.id > GREATEST(COALESCE(c.tutor_read_id, 0), COALESCE(cl.cleared_id, 0))) AS unread
     FROM users u
     LEFT JOIN chat_conversations c ON c.student_id = u.id
     LEFT JOIN chat_clears cl ON cl.student_id = u.id AND cl.user_id = ?
     LEFT JOIN chat_messages lm ON lm.id = (SELECT MAX(id) FROM chat_messages WHERE student_id = u.id)
     WHERE u.role = 'student'
     ORDER BY (lm.id IS NULL), lm.id DESC, u.full_name
     LIMIT 500`,
    [userId]
  );
  return rows.map((r) => {
    // Nothing newer than what this person cleared: show the chat as empty.
    const shown = r.last_id !== null && r.last_id > r.cleared;
    return {
      studentId: r.student_id,
      fullName: r.full_name,
      email: r.email,
      lastBody: shown ? (r.last_deleted ? "This message was deleted" : r.last_body) : null,
      lastHasFile: shown && !r.last_deleted && Boolean(r.last_has_file),
      lastAt: shown ? r.last_at : null,
      unread: Number(r.unread),
    };
  });
}

export async function isStudent(id: number) {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT id FROM users WHERE id = ? AND role = 'student'", [id]);
  return rows.length > 0;
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
async function getPointers(studentId: number) {
  const [rows] = await pool.query<PointerRow[]>(
    "SELECT tutor_read_id, tutor_delivered_id, student_read_id, student_delivered_id, wiped_id FROM chat_conversations WHERE student_id = ?",
    [studentId]
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
async function clearedUpTo(studentId: number, userId: number) {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT cleared_id FROM chat_clears WHERE student_id = ? AND user_id = ?", [studentId, userId]);
  return rows[0] ? Number(rows[0].cleared_id) : 0;
}

/**
 * Messages of one conversation. With afterId = 0 these are the latest 200; otherwise only the ones newer than afterId.
 * Whoever asks has now received them (and read them, if there were any), which turns the other side's ticks.
 * The pointers come back every time, so ticks on older messages can turn blue.
 */
export async function listMessages(studentId: number, afterId: number, viewer: "student" | "tutor", userId: number) {
  const latest = afterId === 0;
  // Messages this person cleared stay hidden from them (the other side still has them).
  const cleared = await clearedUpTo(studentId, userId);
  const from = Math.max(afterId, cleared);
  const [rows] = await pool.query<MessageRow[]>(
    `SELECT m.id, m.sender_id, u.full_name, u.role, m.body, m.created_at, (m.deleted_at IS NOT NULL) AS deleted, a.id AS att_id, a.file_name, a.size
     FROM chat_messages m
     JOIN users u ON u.id = m.sender_id
     LEFT JOIN chat_attachments a ON a.id = m.attachment_id
     WHERE m.student_id = ? AND m.id > ?
     ORDER BY m.id ${latest ? "DESC" : "ASC"} LIMIT 200`,
    [studentId, from]
  );
  // Messages deleted by their sender, so a screen that already has them can show "deleted" instead.
  const [gone] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM chat_messages WHERE student_id = ? AND deleted_at IS NOT NULL AND id > ? ORDER BY id DESC LIMIT 200",
    [studentId, cleared]
  );
  if (latest) rows.reverse();
  const who = viewer === "student" ? "student" : "tutor";
  // Delivered: this screen has the newest message. Read: it has shown messages just now.
  await pool.query(
    `INSERT INTO chat_conversations (student_id, ${who}_delivered_id, ${who}_read_id)
     SELECT ?, COALESCE(MAX(id), 0), ? FROM chat_messages WHERE student_id = ?
     ON DUPLICATE KEY UPDATE ${who}_delivered_id = GREATEST(${who}_delivered_id, VALUES(${who}_delivered_id)), ${who}_read_id = GREATEST(${who}_read_id, VALUES(${who}_read_id))`,
    [studentId, rows.length > 0 ? rows[rows.length - 1].id : 0, studentId]
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
    pointers: await getPointers(studentId),
  };
}

/** Each piece of a file is at most this big (hex-encoded in the query it is twice that), well under a 1 MB packet limit. */
const CHUNK_BYTES = 192 * 1024;

export async function saveAttachment(studentId: number, uploadedBy: number, fileName: string, data: Buffer) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query<ResultSetHeader>(
      "INSERT INTO chat_attachments (student_id, uploaded_by, file_name, size) VALUES (?, ?, ?, ?)",
      [studentId, uploadedBy, fileName, data.length]
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

/** Adds a message. The file (if any) must be one this person just uploaded to this conversation and not used yet. */
export async function addMessage(studentId: number, senderId: number, body: string | undefined, attachmentId: number | undefined) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (attachmentId !== undefined) {
      const [att] = await conn.query<RowDataPacket[]>(
        "SELECT id FROM chat_attachments WHERE id = ? AND student_id = ? AND uploaded_by = ? AND message_id IS NULL FOR UPDATE",
        [attachmentId, studentId, senderId]
      );
      if (att.length === 0) {
        await conn.rollback();
        return null;
      }
    }
    const [result] = await conn.query<ResultSetHeader>(
      "INSERT INTO chat_messages (student_id, sender_id, body, attachment_id) VALUES (?, ?, ?, ?)",
      [studentId, senderId, body && body.length > 0 ? body : null, attachmentId ?? null]
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
  file_name: string;
}
interface ChunkRow extends RowDataPacket {
  data: Buffer;
}

/** A shared file (only once it is attached to a message), put back together from its pieces. */
export async function getAttachment(id: number) {
  const [rows] = await pool.query<AttachmentRow[]>("SELECT student_id, file_name FROM chat_attachments WHERE id = ? AND message_id IS NOT NULL", [id]);
  if (rows.length === 0) return null;
  const [chunks] = await pool.query<ChunkRow[]>("SELECT data FROM chat_attachment_chunks WHERE attachment_id = ? ORDER BY seq", [id]);
  return { ...rows[0], data: Buffer.concat(chunks.map((c) => c.data)) };
}

/** Unread messages for the tutors: students' messages no tutor has opened yet, across every conversation. */
export async function unreadForTutors(userId: number) {
  // The tutor's screen has received them (the badge is showing), even if nobody has opened the conversation.
  await pool.query(
    `INSERT INTO chat_conversations (student_id, tutor_delivered_id)
     SELECT student_id, MAX(id) FROM chat_messages GROUP BY student_id
     ON DUPLICATE KEY UPDATE tutor_delivered_id = GREATEST(tutor_delivered_id, VALUES(tutor_delivered_id))`
  );
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM chat_messages m
     LEFT JOIN chat_conversations c ON c.student_id = m.student_id
     LEFT JOIN chat_clears cl ON cl.student_id = m.student_id AND cl.user_id = ?
     WHERE m.sender_id = m.student_id AND m.deleted_at IS NULL AND m.id > GREATEST(COALESCE(c.tutor_read_id, 0), COALESCE(cl.cleared_id, 0))`,
    [userId]
  );
  return Number(rows[0].n);
}

/** Unread messages for one student: what the tutors wrote that this student has not opened yet. */
export async function unreadForStudent(studentId: number) {
  await pool.query(
    `INSERT INTO chat_conversations (student_id, student_delivered_id)
     SELECT ?, COALESCE(MAX(id), 0) FROM chat_messages WHERE student_id = ?
     ON DUPLICATE KEY UPDATE student_delivered_id = GREATEST(student_delivered_id, VALUES(student_delivered_id))`,
    [studentId, studentId]
  );
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM chat_messages m
     LEFT JOIN chat_conversations c ON c.student_id = m.student_id
     LEFT JOIN chat_clears cl ON cl.student_id = m.student_id AND cl.user_id = ?
     WHERE m.student_id = ? AND m.sender_id <> m.student_id AND m.deleted_at IS NULL AND m.id > GREATEST(COALESCE(c.student_read_id, 0), COALESCE(cl.cleared_id, 0))`,
    [studentId, studentId]
  );
  return Number(rows[0].n);
}

/** Deletes one of your OWN messages for everyone: the text and file go, a "deleted" note stays. False if it is not yours. */
export async function deleteMessage(studentId: number, messageId: number, userId: number) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [mine] = await conn.query<RowDataPacket[]>(
      "SELECT id FROM chat_messages WHERE id = ? AND student_id = ? AND sender_id = ? AND deleted_at IS NULL FOR UPDATE",
      [messageId, studentId, userId]
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

/** The newest message id in a conversation (0 when empty). */
async function newestId(studentId: number) {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT COALESCE(MAX(id), 0) AS id FROM chat_messages WHERE student_id = ?", [studentId]);
  return Number(rows[0].id);
}

/** Clear chat: empties the chat on THIS person's screen only. The other side keeps everything. */
export async function clearChat(studentId: number, userId: number) {
  await pool.query(
    "INSERT INTO chat_clears (student_id, user_id, cleared_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE cleared_id = GREATEST(cleared_id, VALUES(cleared_id))",
    [studentId, userId, await newestId(studentId)]
  );
}

/** Delete chat: removes the whole conversation and every file for everyone. This cannot be undone. */
export async function deleteChat(studentId: number) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [newest] = await conn.query<RowDataPacket[]>("SELECT COALESCE(MAX(id), 0) AS id FROM chat_messages WHERE student_id = ? FOR UPDATE", [studentId]);
    await conn.query("DELETE FROM chat_messages WHERE student_id = ?", [studentId]);
    await conn.query("DELETE FROM chat_attachments WHERE student_id = ?", [studentId]); // including files that were uploaded but never sent
    await conn.query("DELETE FROM chat_clears WHERE student_id = ?", [studentId]);
    // Screens that still show old messages learn from wiped_id that they must drop them.
    await conn.query(
      "INSERT INTO chat_conversations (student_id, wiped_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE wiped_id = GREATEST(wiped_id, VALUES(wiped_id))",
      [studentId, Number(newest[0].id)]
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
