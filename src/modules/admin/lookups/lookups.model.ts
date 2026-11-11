import type { RowDataPacket } from "mysql2";
import { pool } from "../../../config/db/index.js";
import { allLevels, allSubjects } from "../shared/catalog.js";
import { list as plans } from "../settings/plans/plans.model.js";

/** Everything the Admin selects are made from (levels, subjects, plans, tutors, groups), in one call. */
export async function lookups() {
  const [levels, subjects, planList] = await Promise.all([allLevels(), allSubjects(), plans()]);
  const [tutors] = await pool.query<RowDataPacket[]>("SELECT id, full_name FROM users WHERE role = 'tutor' ORDER BY id");
  const [links] = await pool.query<RowDataPacket[]>("SELECT user_id, subject_id FROM tutor_subjects");
  const [groups] = await pool.query<RowDataPacket[]>("SELECT id, name, subject_id, level_id FROM session_groups ORDER BY id");
  return {
    levels,
    subjects,
    plans: planList.map((p) => ({ id: p.id, name: p.name, live: p.live })),
    tutors: tutors.map((t) => ({ id: t.id as number, name: t.full_name as string, subjects: links.filter((l) => l.user_id === t.id).map((l) => l.subject_id as string) })),
    groups: groups.map((g) => ({ id: g.id as number, name: g.name as string, subjectId: g.subject_id as string, levelId: g.level_id as string })),
  };
}
