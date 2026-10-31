import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../../config/db/index.js";
import type { NewItem } from "./item.schemas.js";

interface ItemRow extends RowDataPacket {
  id: number;
  title: string;
  description: string | null;
  created_at: Date;
  topicId: number | null;
  topicName: string | null;
  subjectName: string | null;
}

// Models contain the SQL. Always use ? placeholders to prevent SQL injection.
// Every query filters by user_id so users can only ever see their own items.
// idx_items_user_created (user_id, created_at) serves this WHERE + ORDER BY without a sort.
const SELECT_ITEM = `
  SELECT i.id, i.title, i.description, i.created_at,
         i.topic_id AS topicId, t.name AS topicName, s.name AS subjectName
  FROM items i
  LEFT JOIN topics t   ON t.id = i.topic_id
  LEFT JOIN subjects s ON s.id = t.subject_id`;

export async function findAllByUser(userId: number) {
  const [rows] = await pool.query<ItemRow[]>(
    `${SELECT_ITEM} WHERE i.user_id = ? ORDER BY i.created_at DESC, i.id DESC LIMIT 200`,
    [userId]
  );
  return rows;
}

export async function create(userId: number, { title, description, topicId }: NewItem) {
  const [result] = await pool.query<ResultSetHeader>(
    "INSERT INTO items (user_id, topic_id, title, description) VALUES (?, ?, ?, ?)",
    [userId, topicId || null, title, description || null]
  );
  const [rows] = await pool.query<ItemRow[]>(`${SELECT_ITEM} WHERE i.id = ? AND i.user_id = ?`, [
    result.insertId,
    userId,
  ]);
  return rows[0];
}
