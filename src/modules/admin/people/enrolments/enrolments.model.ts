import type { RowDataPacket } from "mysql2";
import { pool } from "../../../../config/db/index.js";
import { AppError } from "../../../../utils/AppError/index.js";
import type { UpdateEnrolmentInput } from "./enrolments.schemas.js";

async function find(id: number) {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT id, student_id, subject_id, level_id, tier, board, current_grade, target_grade, tutor_id, group_id FROM enrolments WHERE id = ?", [id]);
  if (rows.length === 0) throw new AppError(404, "Subject not found");
  return rows[0];
}

/** Changes the tier, board, grades, tutor or group of one subject a student studies. Only the fields sent are changed. */
export async function update(id: number, input: UpdateEnrolmentInput) {
  const e = await find(id);
  const tutorId = input.tutorId === undefined ? e.tutor_id : input.tutorId;
  const groupId = input.groupId === undefined ? e.group_id : input.groupId;
  if (tutorId) {
    const [t] = await pool.query<RowDataPacket[]>("SELECT id FROM users WHERE id = ? AND role = 'tutor'", [tutorId]);
    if (t.length === 0) throw new AppError(400, "Choose a tutor from the list.");
  }
  if (groupId) {
    const [g] = await pool.query<RowDataPacket[]>("SELECT id FROM session_groups WHERE id = ? AND subject_id = ? AND level_id = ?", [groupId, e.subject_id, e.level_id]);
    if (g.length === 0) throw new AppError(400, "That group is for a different subject or level.");
  }
  await pool.query("UPDATE enrolments SET tier = ?, board = ?, current_grade = ?, target_grade = ?, tutor_id = ?, group_id = ? WHERE id = ?", [
    input.tier ?? e.tier,
    input.board ?? e.board,
    input.current ?? e.current_grade,
    input.target ?? e.target_grade,
    tutorId,
    groupId,
    id,
  ]);
  return { id, studentId: e.student_id as number };
}

export async function remove(id: number) {
  const e = await find(id);
  await pool.query("DELETE FROM enrolments WHERE id = ?", [id]);
  return { studentId: e.student_id as number };
}
