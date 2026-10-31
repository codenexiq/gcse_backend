import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Connection } from "mysql2/promise";
import { connect, dbName } from "./connection.js";

const seedsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "seeds");

/** Runs every seeds/*.sql file. Seeds are written to be safe to run again and again. */
export async function seed(db: Connection) {
  const files = fs.readdirSync(seedsDir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    console.log(`  seeding ${file}`);
    await db.query(fs.readFileSync(path.join(seedsDir, file), "utf8"));
  }
  console.log("Seed data loaded.");
}

// Run directly: `npm run db:seed`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = await connect();
  console.log(`Seeding "${dbName}"...`);
  await seed(db).finally(() => db.end());
}
