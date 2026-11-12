import type { RowDataPacket } from "mysql2";
import { inTransaction, pool } from "../../../config/db/index.js";
import { AppError } from "../../../utils/AppError/index.js";
import { ownsEnrolment } from "../shared/mine.js";
import type { FinishInput } from "./learn.schemas.js";

/** A visible lesson, notes page, quiz or video for one of the student's subjects. */
async function visibleItem(studentId: number, enrolmentId: number, itemId: number) {
  const e = await ownsEnrolment(studentId, enrolmentId);
  const [rows] = await pool.query<RowDataPacket[]>("SELECT * FROM content_items WHERE id = ? AND published = 1 AND subject_id = ? AND level_id = ?", [itemId, e.subject_id, e.level_id]);
  if (rows.length === 0) throw new AppError(404, "Not found");
  return rows[0];
}

export async function item(studentId: number, enrolmentId: number, itemId: number) {
  const it = await visibleItem(studentId, enrolmentId, itemId);
  const [blocks] = await pool.query<RowDataPacket[]>("SELECT type, data FROM content_blocks WHERE item_id = ? ORDER BY position, id", [itemId]);
  const [done] = await pool.query<RowDataPacket[]>("SELECT 1 FROM item_completions WHERE enrolment_id = ? AND item_id = ?", [enrolmentId, itemId]);
  return {
    id: it.id as number,
    enrolmentId,
    kind: it.kind as string,
    title: it.title as string,
    topicId: (it.topic_id ?? null) as number | null,
    done: done.length > 0,
    blocks: blocks.map((b) => ({ type: b.type, ...(typeof b.data === "string" ? JSON.parse(b.data) : b.data) })),
  };
}

/**
 * Marks the item as done. Multiple-choice answers are marked here from the saved answers (one mark each); written answers are
 * self-marked against the mark scheme. 70% or more makes the topic "mastered"; under that it "needs work".
 */
export async function finish(studentId: number, enrolmentId: number, itemId: number, input: FinishInput) {
  const it = await visibleItem(studentId, enrolmentId, itemId);
  const [blocks] = await pool.query<RowDataPacket[]>("SELECT type, data FROM content_blocks WHERE item_id = ? ORDER BY position, id", [itemId]);
  let got = 0;
  let max = 0;
  blocks.forEach((b, i) => {
    const data = typeof b.data === "string" ? JSON.parse(b.data) : b.data;
    if (b.type === "mcq") {
      max += 1;
      if (input.mcq[String(i)] === data.correct) got += 1;
    } else if (b.type === "written") {
      const marks = Number(data.marks) || 1;
      max += marks;
      got += Math.max(0, Math.min(marks, input.written[String(i)] ?? 0));
    }
  });
  const pct = max ? Math.round((got / max) * 100) : 0;
  const mastered = max > 0 && pct >= 70;
  await inTransaction(async (conn) => {
    await conn.query("INSERT INTO item_completions (enrolment_id, item_id, score) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE score = VALUES(score), completed_at = NOW()", [enrolmentId, itemId, max ? pct : null]);
    if (max) await conn.query("INSERT INTO learning_results (enrolment_id, title, pct) VALUES (?, ?, ?)", [enrolmentId, it.title, pct]);
    if (it.topic_id) {
      if (max) await conn.query("INSERT INTO enrolment_topic_status (enrolment_id, topic_id, status) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status)", [enrolmentId, it.topic_id, mastered ? "M" : "W"]);
      else await conn.query("INSERT INTO enrolment_topic_status (enrolment_id, topic_id, status) VALUES (?, ?, 'P') ON DUPLICATE KEY UPDATE status = IF(status = 'M', 'M', 'P')", [enrolmentId, it.topic_id]);
    }
    await conn.query("INSERT INTO study_minutes (enrolment_id, study_date, minutes) VALUES (?, CURDATE(), ?)", [enrolmentId, max ? 10 : 8]);
  });
  return { got, max, pct, mastered };
}
