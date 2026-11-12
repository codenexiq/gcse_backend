import type { RowDataPacket } from "mysql2";
import { inTransaction, pool } from "../../../config/db/index.js";
import { AppError } from "../../../utils/AppError/index.js";
import { ownsEnrolment } from "../shared/mine.js";

async function topicOf(subjectId: string, levelId: string, topicId: number) {
  const [t] = await pool.query<RowDataPacket[]>("SELECT t.name FROM topics t JOIN strands st ON st.id = t.strand_id WHERE t.id = ? AND st.subject_id = ? AND st.level_id = ?", [topicId, subjectId, levelId]);
  if (t.length === 0) throw new AppError(404, "Not found");
  return t[0].name as string;
}

/**
 * Questions for a practice set on one topic: every multiple-choice and written question from the visible items on that topic,
 * and, if there are few, from the rest of the subject. (The screen adds freshly made questions for some topics.)
 */
export async function bank(studentId: number, enrolmentId: number, topicId: number) {
  const e = await ownsEnrolment(studentId, enrolmentId);
  const name = await topicOf(e.subject_id, e.level_id, topicId);
  const load = async (sql: string, params: unknown[]) => {
    const [rows] = await pool.query<RowDataPacket[]>(sql, params);
    return rows.map((r) => ({ type: r.type as "mcq" | "written", ...(typeof r.data === "string" ? JSON.parse(r.data) : r.data) }));
  };
  const base = "SELECT b.type, b.data FROM content_blocks b JOIN content_items i ON i.id = b.item_id WHERE i.published = 1 AND i.subject_id = ? AND i.level_id = ? AND b.type IN ('mcq','written')";
  let blocks = await load(`${base} AND i.topic_id = ? ORDER BY b.id`, [e.subject_id, e.level_id, topicId]);
  if (blocks.length < 3) blocks = blocks.concat(await load(`${base} AND (i.topic_id IS NULL OR i.topic_id <> ?) ORDER BY b.id LIMIT 6`, [e.subject_id, e.level_id, topicId]));
  return { enrolmentId, topic: { id: topicId, name }, blocks };
}

/** Saves a practice set result like a quiz: it is a result, adds study time, and moves the topic to mastered (70% or more) or needs work. */
export async function result(studentId: number, enrolmentId: number, topicId: number, got: number, max: number) {
  const e = await ownsEnrolment(studentId, enrolmentId);
  if (got > max) throw new AppError(400, "That score is not possible.");
  const name = await topicOf(e.subject_id, e.level_id, topicId);
  const pct = Math.round((got / max) * 100);
  await inTransaction(async (conn) => {
    await conn.query("INSERT INTO learning_results (enrolment_id, title, pct) VALUES (?, ?, ?)", [enrolmentId, `Practice: ${name}`.slice(0, 160), pct]);
    await conn.query("INSERT INTO enrolment_topic_status (enrolment_id, topic_id, status) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status)", [enrolmentId, topicId, pct >= 70 ? "M" : "W"]);
    await conn.query("INSERT INTO study_minutes (enrolment_id, study_date, minutes) VALUES (?, CURDATE(), 10)", [enrolmentId]);
  });
  return { got, max, pct, mastered: pct >= 70 };
}
