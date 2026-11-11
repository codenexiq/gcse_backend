import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { inTransaction, pool } from "../../../../config/db/index.js";
import { AppError } from "../../../../utils/AppError/index.js";
import { allLevels, allSubjects } from "../../shared/catalog.js";
import type { SaveTopicsInput } from "./topics.schemas.js";

export interface Strand {
  id: number;
  name: string;
  topics: { id: number; name: string }[];
}

/** Every subject and level pair that is offered ("GCSE Maths"), for the Pathway picker. */
export async function paths() {
  const [subjects, levels] = await Promise.all([allSubjects(), allLevels()]);
  const out: { key: string; subjectId: string; levelId: string; label: string }[] = [];
  for (const s of subjects) {
    for (const l of s.levels) {
      const level = levels.find((x) => x.id === l);
      if (level) out.push({ key: `${s.id}|${l}`, subjectId: s.id, levelId: l, label: `${level.short} ${s.name}` });
    }
  }
  return out;
}

export async function strandsOf(subjectId: string, levelId: string): Promise<Strand[]> {
  const [strands] = await pool.query<RowDataPacket[]>("SELECT id, name FROM strands WHERE subject_id = ? AND level_id = ? ORDER BY position, id", [subjectId, levelId]);
  if (strands.length === 0) return [];
  const [topics] = await pool.query<RowDataPacket[]>("SELECT id, strand_id, name FROM topics WHERE strand_id IN (?) ORDER BY position, id", [strands.map((s) => s.id)]);
  return strands.map((s) => ({ id: s.id, name: s.name, topics: topics.filter((t) => t.strand_id === s.id).map((t) => ({ id: t.id, name: t.name })) }));
}

export async function save(subjectId: string, levelId: string, input: SaveTopicsInput) {
  if (!(await paths()).some((p) => p.subjectId === subjectId && p.levelId === levelId)) throw new AppError(404, "That pathway is not offered");
  await inTransaction(async (conn) => {
    const [oldStrands] = await conn.query<RowDataPacket[]>("SELECT id FROM strands WHERE subject_id = ? AND level_id = ?", [subjectId, levelId]);
    const oldIds = new Set(oldStrands.map((s) => s.id as number));
    const keepStrands = new Set<number>();
    for (const [i, s] of input.strands.entries()) {
      let strandId = s.id && oldIds.has(s.id) ? s.id : 0;
      if (strandId) await conn.query("UPDATE strands SET name = ?, position = ? WHERE id = ?", [s.name, i, strandId]);
      else {
        const [res] = await conn.query<ResultSetHeader>("INSERT INTO strands (subject_id, level_id, name, position) VALUES (?, ?, ?, ?)", [subjectId, levelId, s.name, i]);
        strandId = res.insertId;
      }
      keepStrands.add(strandId);
      const [oldTopics] = await conn.query<RowDataPacket[]>("SELECT id FROM topics WHERE strand_id = ?", [strandId]);
      const oldTopicIds = new Set(oldTopics.map((t) => t.id as number));
      const keepTopics = new Set<number>();
      for (const [j, t] of s.topics.entries()) {
        if (t.id && oldTopicIds.has(t.id)) {
          await conn.query("UPDATE topics SET name = ?, position = ? WHERE id = ?", [t.name, j, t.id]);
          keepTopics.add(t.id);
        } else {
          const [res] = await conn.query<ResultSetHeader>("INSERT INTO topics (strand_id, name, position) VALUES (?, ?, ?)", [strandId, t.name, j]);
          keepTopics.add(res.insertId);
        }
      }
      const drop = [...oldTopicIds].filter((id) => !keepTopics.has(id));
      if (drop.length) await conn.query("DELETE FROM topics WHERE id IN (?)", [drop]);
    }
    const dropStrands = [...oldIds].filter((id) => !keepStrands.has(id));
    if (dropStrands.length) await conn.query("DELETE FROM strands WHERE id IN (?)", [dropStrands]);
  });
  return strandsOf(subjectId, levelId);
}
