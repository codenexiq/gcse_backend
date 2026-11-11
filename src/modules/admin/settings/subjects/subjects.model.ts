import type { RowDataPacket } from "mysql2";
import { inTransaction, pool } from "../../../../config/db/index.js";
import { AppError } from "../../../../utils/AppError/index.js";
import { randomSuffix, slugOf } from "../../../../utils/slug/index.js";
import { allLevels, allSubjects } from "../../shared/catalog.js";
import type { UpdateSubjectInput } from "./subjects.schemas.js";

const COLOURS = ["#2B6CB0", "#6B4FC9", "#2E8B66", "#B4475A", "#B5741C", "#1F7A8C", "#8A5A44"];

/** A picture for a new subject, guessed from its name. */
function guessIcon(name: string) {
  const n = name.toLowerCase();
  const known = ["maths", "physics", "chemistry", "biology", "english", "computing", "humanities", "languages"].find((x) => n.includes(x.slice(0, 5)));
  if (known) return known;
  if (/comput|ict/i.test(n)) return "computing";
  if (/history|geog|religio/i.test(n)) return "humanities";
  if (/french|spanish|urdu|arabic|german/i.test(n)) return "languages";
  return "book";
}

/** A subject is in use while any student is enrolled in it or any group or tutor is tied to it. */
async function usedIds(): Promise<Set<string>> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT subject_id AS id FROM enrolments UNION SELECT subject_id FROM session_groups");
  return new Set(rows.map((r) => r.id as string));
}

export async function list() {
  const [subjects, used] = await Promise.all([allSubjects(), usedIds()]);
  return subjects.map((s) => ({ ...s, inUse: used.has(s.id) }));
}

export async function create(name: string) {
  const [subjects, levels] = await Promise.all([allSubjects(), allLevels()]);
  let id = slugOf(name) || `sb${randomSuffix()}`;
  if (subjects.some((s) => s.id === id)) id = `sb${randomSuffix()}`;
  const level = levels.find((l) => l.id === "gcse") ?? levels[0];
  await inTransaction(async (conn) => {
    await conn.query("INSERT INTO subjects (id, name, icon, color, position) VALUES (?, ?, ?, ?, ?)", [id, name, guessIcon(name), COLOURS[subjects.length % COLOURS.length], subjects.length]);
    if (level) await conn.query("INSERT INTO subject_levels (subject_id, level_id) VALUES (?, ?)", [id, level.id]);
  });
  return (await list()).find((s) => s.id === id)!;
}

export async function update(id: string, input: UpdateSubjectInput) {
  if (!(await allSubjects()).some((s) => s.id === id)) throw new AppError(404, "Subject not found");
  const valid = new Set((await allLevels()).map((l) => l.id));
  const levels = [...new Set(input.levels)].filter((l) => valid.has(l));
  await inTransaction(async (conn) => {
    await conn.query("UPDATE subjects SET name = ?, color = ?, icon = ? WHERE id = ?", [input.name, input.color.toUpperCase(), input.icon, id]);
    await conn.query("DELETE FROM subject_levels WHERE subject_id = ?", [id]);
    for (const level of levels) await conn.query("INSERT INTO subject_levels (subject_id, level_id) VALUES (?, ?)", [id, level]);
  });
  return (await list()).find((s) => s.id === id)!;
}

export async function remove(id: string) {
  if ((await usedIds()).has(id)) throw new AppError(409, "That subject is in use, so it cannot be deleted.");
  await pool.query("DELETE FROM subjects WHERE id = ?", [id]);
}
