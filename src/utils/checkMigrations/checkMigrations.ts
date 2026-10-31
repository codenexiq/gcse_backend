import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { RowDataPacket } from "mysql2";
import { pool } from "../../config/db/index.js";

// backend/database/migrations (this file sits three folders below backend/ in both src/ and dist/)
const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "database", "migrations");

/** The names of migration files that have not been run on this database yet. */
export async function findPendingMigrations(): Promise<string[]> {
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();

  let applied = new Set<string>();
  try {
    const [rows] = await pool.query<RowDataPacket[]>("SELECT name FROM schema_migrations");
    applied = new Set(rows.map((r) => r.name as string));
  } catch {
    // no schema_migrations table yet: nothing has been run (a brand-new database)
  }
  return files.filter((f) => !applied.has(f));
}

/** Prints a clear warning at start-up if the database is behind the code. */
export async function warnIfMigrationsPending(): Promise<void> {
  try {
    const pending = await findPendingMigrations();
    if (pending.length === 0) return;
    console.warn(
      `\nWARNING: the database is out of date - ${pending.length} migration(s) have not been run:\n` +
        pending.map((name) => `  - ${name}`).join("\n") +
        "\nUntil you run them, parts of the API will fail with 'Unknown column' errors.\n" +
        "Fix:  npm run db:migrate\n"
    );
  } catch (err) {
    console.error("Could not check for pending migrations:", err instanceof Error ? err.message : err);
  }
}
