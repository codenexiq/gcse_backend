import type { RowDataPacket } from "mysql2";
import { inTransaction, pool } from "../../../../config/db/index.js";
import { AppError } from "../../../../utils/AppError/index.js";
import { randomSuffix, slugOf } from "../../../../utils/slug/index.js";
import { allLevels } from "../../shared/catalog.js";
import { cleanList, toList } from "../../shared/lists.js";
import type { UpdateLevelInput } from "./levels.schemas.js";

const DEFAULT_GRADES = ["Emerging", "Developing", "Secure", "Mastered"];

/** A level is in use while any student, enrolment or group is at that level. */
async function usedIds(): Promise<Set<string>> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT level_id AS id FROM student_profiles UNION SELECT level_id FROM enrolments UNION SELECT level_id FROM session_groups"
  );
  return new Set(rows.map((r) => r.id as string));
}

export async function list() {
  const [levels, used] = await Promise.all([allLevels(), usedIds()]);
  return levels.map((l) => ({ ...l, inUse: used.has(l.id) }));
}

export async function create(name: string) {
  const levels = await allLevels();
  let id = slugOf(name) || `lv${randomSuffix()}`;
  if (levels.some((l) => l.id === id)) id = `lv${randomSuffix()}`;
  const short = name.replace(/Key Stage /i, "KS");
  await inTransaction(async (conn) => {
    await conn.query("INSERT INTO levels (id, name, short_name, years, tiers, boards, grades, position) VALUES (?, ?, ?, '[]', '[]', '[]', ?, ?)", [id, name, short, toList(DEFAULT_GRADES), levels.length]);
    // Every plan gets a placeholder price for the new level.
    await conn.query("INSERT INTO plan_prices (plan_id, level_id, price) SELECT id, ?, ? FROM plans", [id, "£—/month"]);
  });
  return (await list()).find((l) => l.id === id)!;
}

export async function update(id: string, input: UpdateLevelInput) {
  if (!(await allLevels()).some((l) => l.id === id)) throw new AppError(404, "Level not found");
  await pool.query("UPDATE levels SET name = ?, short_name = ?, years = ?, tiers = ?, boards = ?, grades = ? WHERE id = ?", [
    input.name,
    input.short,
    toList(cleanList(input.years)),
    toList(cleanList(input.tiers)),
    toList(cleanList(input.boards)),
    toList(cleanList(input.grades)),
    id,
  ]);
  return (await list()).find((l) => l.id === id)!;
}

export async function remove(id: string) {
  if ((await usedIds()).has(id)) throw new AppError(409, "That level is in use, so it cannot be deleted.");
  await pool.query("DELETE FROM levels WHERE id = ?", [id]);
}
