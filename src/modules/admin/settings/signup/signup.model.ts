import type { RowDataPacket } from "mysql2";
import { pool } from "../../../../config/db/index.js";

const KEY = "welcome";
export const DEFAULT_WELCOME = "Find your gaps. Follow your plan. Learn with a real teacher.";

export async function get() {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT setting_value FROM app_settings WHERE setting_key = ?", [KEY]);
  return { welcome: (rows[0]?.setting_value as string | undefined) ?? DEFAULT_WELCOME };
}

export async function save(welcome: string) {
  await pool.query("INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)", [KEY, welcome]);
  return get();
}
