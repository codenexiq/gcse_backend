import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { connect, dbName } from "./connection.js";

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "migrations");

/**
 * Runs every migrations/*.sql file that has not been run yet, in filename order.
 * Finished files are recorded in the schema_migrations table, so this is safe to repeat.
 * Never edit a migration that has already run - add a new numbered file instead.
 */
export async function migrate(db: Connection) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       VARCHAR(255) NOT NULL PRIMARY KEY,
      applied_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);

  const [done] = await db.query<RowDataPacket[]>("SELECT name FROM schema_migrations");
  const applied = new Set(done.map((row) => row.name));
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    console.log(`  running ${file}`);
    await db.query(fs.readFileSync(path.join(migrationsDir, file), "utf8"));
    await db.query("INSERT INTO schema_migrations (name) VALUES (?)", [file]);
    count++;
  }
  console.log(count ? `Applied ${count} migration(s).` : "Database is already up to date.");
}

// Run directly: `npm run db:migrate`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = await connect();
  console.log(`Migrating "${dbName}"...`);
  await migrate(db).finally(() => db.end());
}
