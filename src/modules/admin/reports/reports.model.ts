import type { ResultSetHeader } from "mysql2";
import { pool } from "../../../config/db/index.js";
import { AppError } from "../../../utils/AppError/index.js";

/** The admin has sent a tutor's monthly report to the parent. */
export async function markSent(id: number) {
  const [res] = await pool.query<ResultSetHeader>("UPDATE monthly_reports SET status = 'sent', sent_at = NOW() WHERE id = ? AND status = 'ready'", [id]);
  if (res.affectedRows === 0) throw new AppError(404, "That report is not waiting to be sent.");
}
