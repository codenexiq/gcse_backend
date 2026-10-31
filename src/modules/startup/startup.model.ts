import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../../config/db/index.js";
import type { NewOption } from "./startup.schemas.js";

export interface StartupOption extends RowDataPacket {
  id: number;
  category: NewOption["category"];
  label: string;
  sort_order: number;
}

const COLUMNS = "id, category, label, sort_order";

export async function listAll() {
  const [rows] = await pool.query<StartupOption[]>(`SELECT ${COLUMNS} FROM startup_options ORDER BY category, sort_order, id`);
  return rows;
}

async function findById(id: number) {
  const [rows] = await pool.query<StartupOption[]>(`SELECT ${COLUMNS} FROM startup_options WHERE id = ?`, [id]);
  return rows[0] ?? null;
}

export async function create({ category, label }: NewOption) {
  const [result] = await pool.query<ResultSetHeader>(
    "INSERT INTO startup_options (category, label, sort_order) SELECT ?, ?, COALESCE(MAX(sort_order), 0) + 1 FROM startup_options WHERE category = ?",
    [category, label, category]
  );
  return findById(result.insertId);
}

export async function rename(id: number, label: string) {
  const [result] = await pool.query<ResultSetHeader>("UPDATE startup_options SET label = ? WHERE id = ?", [label, id]);
  return result.affectedRows ? findById(id) : null;
}

export async function remove(id: number) {
  const [result] = await pool.query<ResultSetHeader>("DELETE FROM startup_options WHERE id = ?", [id]);
  return result.affectedRows > 0;
}
