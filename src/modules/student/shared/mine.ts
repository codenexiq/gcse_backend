import type { RowDataPacket } from "mysql2";
import { pool } from "../../../config/db/index.js";
import { AppError } from "../../../utils/AppError/index.js";

/** Stops a student opening anything that is not theirs: the subject (enrolment) must belong to them. */
export async function ownsEnrolment(studentId: number, enrolmentId: number): Promise<RowDataPacket> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT * FROM enrolments WHERE id = ? AND student_id = ?", [enrolmentId, studentId]);
  if (rows.length === 0) throw new AppError(404, "Not found");
  return rows[0];
}

/** The teacher of a subject: assigned directly, or the teacher of the group the student is in. */
export const TUTOR_OF = "COALESCE(e.tutor_id, (SELECT g.tutor_id FROM session_groups g WHERE g.id = e.group_id))";
