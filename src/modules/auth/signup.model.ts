import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { inTransaction, pool } from "../../config/db/index.js";
import { AppError } from "../../utils/AppError/index.js";
import { allLevels, allSubjects } from "../admin/shared/catalog.js";
import { DEFAULT_WELCOME } from "../admin/settings/signup/signup.model.js";
import { userCode } from "./user.model.js";
import type { SignupInput } from "./signup.schemas.js";

/** Everything the public sign-up screens offer: the welcome line, levels, subjects and plans with their prices. */
export async function options() {
  const [welcome] = await pool.query<RowDataPacket[]>("SELECT setting_value FROM app_settings WHERE setting_key = 'welcome'");
  const [plans] = await pool.query<RowDataPacket[]>("SELECT id, name, tagline, live_classes, mocks, popular, features FROM plans ORDER BY position, id");
  const [prices] = await pool.query<RowDataPacket[]>("SELECT plan_id, level_id, price FROM plan_prices");
  return {
    welcome: (welcome[0]?.setting_value as string | undefined) ?? DEFAULT_WELCOME,
    levels: await allLevels(),
    subjects: await allSubjects(),
    plans: plans.map((p) => ({
      id: p.id as string,
      name: p.name as string,
      tagline: p.tagline as string,
      popular: Boolean(p.popular),
      features: (typeof p.features === "string" ? JSON.parse(p.features) : p.features ?? []) as string[],
      prices: Object.fromEntries(prices.filter((x) => x.plan_id === p.id).map((x) => [x.level_id as string, x.price as string])),
    })),
  };
}

/**
 * Creates a student from the sign-up wizard: the account, their level, plan and parent details, and one enrolment for each
 * subject chosen. A subject goes to the first teacher who teaches it. Everything is checked against the real lists here.
 */
export async function signup(input: SignupInput, passwordHash: string) {
  const level = (await allLevels()).find((l) => l.id === input.level);
  if (!level) throw new AppError(400, "Choose a level.");
  const [plan] = await pool.query<RowDataPacket[]>("SELECT id FROM plans WHERE id = ?", [input.plan]);
  if (plan.length === 0) throw new AppError(400, "Choose a plan.");
  const subjects = await allSubjects();
  const chosen = input.subjects.map((s) => {
    const subject = subjects.find((x) => x.id === s.id && x.levels.includes(level.id));
    if (!subject) throw new AppError(400, "One of the subjects is not taught at that level.");
    if (s.tier && !level.tiers.includes(s.tier)) throw new AppError(400, "Choose a tier from the list.");
    if (s.board && !level.boards.includes(s.board)) throw new AppError(400, "Choose an exam board from the list.");
    if ((s.current && !level.grades.includes(s.current)) || (s.target && !level.grades.includes(s.target))) throw new AppError(400, "Choose grades from the list.");
    return s;
  });
  if (new Set(chosen.map((s) => s.id)).size !== chosen.length) throw new AppError(400, "Each subject can only be chosen once.");
  const year = level.years.length === 0 || level.years.includes(input.year) ? input.year : level.years[0] ?? "";

  try {
    return await inTransaction(async (conn) => {
      const [res] = await conn.query<ResultSetHeader>("INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, 'student')", [input.name, input.email, passwordHash]);
      const id = res.insertId;
      const code = userCode("student", id);
      await conn.query("UPDATE users SET user_code = ? WHERE id = ?", [code, id]);
      await conn.query("INSERT INTO student_profiles (user_id, level_id, school_year, plan_id, parent_name, parent_email, parent_phone, recording_ok) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
        id,
        level.id,
        year,
        input.plan,
        input.parent.name,
        input.parent.email,
        input.parent.phone,
        input.recordingOk ? 1 : 0,
      ]);
      for (const s of chosen) {
        const [tutor] = await conn.query<RowDataPacket[]>("SELECT ts.user_id FROM tutor_subjects ts JOIN users u ON u.id = ts.user_id WHERE ts.subject_id = ? AND u.is_active = 1 ORDER BY ts.user_id LIMIT 1", [s.id]);
        await conn.query("INSERT INTO enrolments (student_id, subject_id, level_id, tier, board, current_grade, target_grade, tutor_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
          id,
          s.id,
          level.id,
          s.tier,
          s.board,
          s.current,
          s.target,
          tutor[0]?.user_id ?? null,
        ]);
      }
      return { id, fullName: input.name, email: input.email, role: "student" as const, userCode: code };
    });
  } catch (err) {
    if ((err as { code?: string }).code === "ER_DUP_ENTRY") throw new AppError(409, "An account with that email already exists");
    throw err;
  }
}
