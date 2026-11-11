import type { RowDataPacket } from "mysql2";
import { pool } from "../../../config/db/index.js";
import { parseList } from "./lists.js";

export interface LevelRow {
  id: string;
  name: string;
  short: string;
  years: string[];
  tiers: string[];
  boards: string[];
  grades: string[];
}

export async function allLevels(): Promise<LevelRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT id, name, short_name, years, tiers, boards, grades FROM levels ORDER BY position, id");
  return rows.map((r) => ({ id: r.id, name: r.name, short: r.short_name, years: parseList(r.years), tiers: parseList(r.tiers), boards: parseList(r.boards), grades: parseList(r.grades) }));
}

export async function levelById(id: string): Promise<LevelRow | null> {
  return (await allLevels()).find((l) => l.id === id) ?? null;
}

export interface SubjectRow {
  id: string;
  name: string;
  icon: string;
  color: string;
  levels: string[];
}

export async function allSubjects(): Promise<SubjectRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT id, name, icon, color FROM subjects ORDER BY position, id");
  const [links] = await pool.query<RowDataPacket[]>("SELECT subject_id, level_id FROM subject_levels");
  const [lv] = await pool.query<RowDataPacket[]>("SELECT id FROM levels ORDER BY position, id");
  const order = lv.map((l) => l.id as string);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    icon: r.icon,
    color: r.color,
    levels: links
      .filter((l) => l.subject_id === r.id)
      .map((l) => l.level_id as string)
      .sort((a, b) => order.indexOf(a) - order.indexOf(b)),
  }));
}

/** "GCSE Maths" or "GCSE Maths · Higher": how a pathway is named on every screen. */
export function pathName(levelShort: string, subjectName: string, tier?: string) {
  return `${levelShort} ${subjectName}${tier ? ` · ${tier}` : ""}`;
}
