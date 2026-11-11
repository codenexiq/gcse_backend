import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Connection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { connect, dbName } from "./connection.js";

const dataFile = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "seed", "design-data.json");

interface Design {
  cfg: {
    welcome: string;
    levels: { id: string; name: string; short: string; years: string[]; tiers: string[]; boards: string[]; grades: string[] }[];
    subjects: { id: string; name: string; icon: string; color: string; levels: string[] }[];
    plans: { id: string; name: string; tagline: string; live: number; mocks: boolean; popular?: boolean | null; features: string[]; prices: Record<string, string> }[];
    topics: Record<string, { strand: string; topics: { name: string }[] }[]>;
  };
}

/** Fills levels, subjects, topics and plans from the design's starting data. Only runs on an empty catalog. */
export async function seedCatalog(db: Connection) {
  const [rows] = await db.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM levels");
  if (Number(rows[0].n) > 0) return;
  const { cfg } = JSON.parse(fs.readFileSync(dataFile, "utf8")) as Design;

  for (const [i, l] of cfg.levels.entries()) {
    await db.query("INSERT INTO levels (id, name, short_name, years, tiers, boards, grades, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
      l.id, l.name, l.short, JSON.stringify(l.years), JSON.stringify(l.tiers), JSON.stringify(l.boards), JSON.stringify(l.grades), i,
    ]);
  }
  for (const [i, s] of cfg.subjects.entries()) {
    await db.query("INSERT INTO subjects (id, name, icon, color, position) VALUES (?, ?, ?, ?, ?)", [s.id, s.name, s.icon, s.color, i]);
    for (const l of s.levels) await db.query("INSERT INTO subject_levels (subject_id, level_id) VALUES (?, ?)", [s.id, l]);
  }
  for (const [i, p] of cfg.plans.entries()) {
    await db.query("INSERT INTO plans (id, name, tagline, live_classes, mocks, popular, features, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
      p.id, p.name, p.tagline, p.live, p.mocks ? 1 : 0, p.popular ? 1 : 0, JSON.stringify(p.features), i,
    ]);
    for (const [level, price] of Object.entries(p.prices)) await db.query("INSERT INTO plan_prices (plan_id, level_id, price) VALUES (?, ?, ?)", [p.id, level, price]);
  }
  for (const [key, strands] of Object.entries(cfg.topics)) {
    const [subjectId, levelId] = key.split("|");
    for (const [i, st] of strands.entries()) {
      const [res] = await db.query<ResultSetHeader>("INSERT INTO strands (subject_id, level_id, name, position) VALUES (?, ?, ?, ?)", [subjectId, levelId, st.strand, i]);
      for (const [j, t] of st.topics.entries()) await db.query("INSERT INTO topics (strand_id, name, position) VALUES (?, ?, ?)", [res.insertId, t.name, j]);
    }
  }
  await db.query("INSERT INTO app_settings (setting_key, setting_value) VALUES ('welcome', ?) ON DUPLICATE KEY UPDATE setting_value = setting_value", [cfg.welcome]);
  console.log("Levels, subjects, topics and plans are in place.");
}

// Run directly: `npm run db:seed-catalog`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = await connect();
  console.log(`Seeding the catalog in "${dbName}"...`);
  await seedCatalog(db).finally(() => db.end());
}
