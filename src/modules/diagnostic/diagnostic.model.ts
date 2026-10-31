import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../config/db/index.js";
import type { QuestionInput } from "./diagnostic.schemas.js";

interface QuestionRow extends RowDataPacket {
  id: number;
  level: QuestionInput["level"];
  subjectId: number;
  tier: QuestionInput["tier"];
  topic: string;
  question: string;
}
interface OptionRow extends RowDataPacket {
  questionId: number;
  text: string;
  isCorrect: number;
  misconception: string | null;
}

export interface Question {
  id: number;
  level: QuestionInput["level"];
  subjectId: number;
  tier: QuestionInput["tier"];
  topic: string;
  question: string;
  options: { text: string; isCorrect: boolean; misconception: string | null }[];
}

const QUESTION_SELECT = "SELECT id, level, subject_id AS subjectId, tier, topic, question FROM diagnostic_questions";

async function withOptions(rows: QuestionRow[]): Promise<Question[]> {
  if (rows.length === 0) return [];
  const [opts] = await pool.query<OptionRow[]>(
    "SELECT question_id AS questionId, text, is_correct AS isCorrect, misconception FROM diagnostic_options WHERE question_id IN (?) ORDER BY question_id, position",
    [rows.map((r) => r.id)]
  );
  return rows.map((r) => ({
    id: r.id,
    level: r.level,
    subjectId: r.subjectId,
    tier: r.tier,
    topic: r.topic,
    question: r.question,
    options: opts.filter((o) => o.questionId === r.id).map((o) => ({ text: o.text, isCorrect: o.isCorrect === 1, misconception: o.misconception })),
  }));
}

export async function listAll() {
  const [rows] = await pool.query<QuestionRow[]>(`${QUESTION_SELECT} ORDER BY level, subject_id, id`);
  return withOptions(rows);
}

export async function findById(id: number) {
  const [rows] = await pool.query<QuestionRow[]>(`${QUESTION_SELECT} WHERE id = ?`, [id]);
  return (await withOptions(rows))[0] ?? null;
}

export async function subjectName(id: number) {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT label FROM startup_options WHERE id = ? AND category = 'subject'", [id]);
  return (rows[0]?.label as string | undefined) ?? null;
}

/** The text of the questions already written for a level and subject (so generated ones are different). */
export async function existingQuestionTexts(level: string, subjectId: number, limit = 60) {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT question FROM diagnostic_questions WHERE level = ? AND subject_id = ? ORDER BY id DESC LIMIT ?", [level, subjectId, limit]);
  return rows.map((r) => r.question as string);
}

export async function subjectExists(id: number) {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT id FROM startup_options WHERE id = ? AND category = 'subject'", [id]);
  return rows.length > 0;
}

async function writeOptions(conn: PoolConnection, questionId: number, options: QuestionInput["options"]) {
  await conn.query("DELETE FROM diagnostic_options WHERE question_id = ?", [questionId]);
  for (const [i, o] of options.entries()) {
    await conn.query("INSERT INTO diagnostic_options (question_id, position, text, is_correct, misconception) VALUES (?, ?, ?, ?, ?)", [questionId, i + 1, o.text, o.isCorrect ? 1 : 0, o.isCorrect ? null : (o.misconception ?? null)]);
  }
}

/** Runs the question and its answers as one unit: either all of it is saved or none. */
async function inTransaction<T>(work: (conn: PoolConnection) => Promise<T>) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function create(q: QuestionInput) {
  const id = await inTransaction(async (conn) => {
    const [result] = await conn.query<ResultSetHeader>(
      "INSERT INTO diagnostic_questions (level, subject_id, tier, topic, question) VALUES (?, ?, ?, ?, ?)",
      [q.level, q.subjectId, q.tier, q.topic, q.question]
    );
    await writeOptions(conn, result.insertId, q.options);
    return result.insertId;
  });
  return findById(id);
}

export async function update(id: number, q: QuestionInput) {
  const found = await inTransaction(async (conn) => {
    const [exists] = await conn.query<RowDataPacket[]>("SELECT id FROM diagnostic_questions WHERE id = ?", [id]);
    if (exists.length === 0) return false;
    await conn.query("UPDATE diagnostic_questions SET level = ?, subject_id = ?, tier = ?, topic = ?, question = ? WHERE id = ?", [
      q.level,
      q.subjectId,
      q.tier,
      q.topic,
      q.question,
      id,
    ]);
    await writeOptions(conn, id, q.options);
    return true;
  });
  return found ? findById(id) : null;
}

export async function remove(id: number) {
  const [result] = await pool.query<ResultSetHeader>("DELETE FROM diagnostic_questions WHERE id = ?", [id]);
  return result.affectedRows > 0;
}
