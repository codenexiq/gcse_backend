import app from "./app.js";
import { env } from "./config/env/index.js";
import { pool } from "./config/db/index.js";
import { warnIfMigrationsPending } from "./utils/checkMigrations/index.js";

app.listen(env.port, async () => {
  console.log(`API running on http://localhost:${env.port}/api`);
  try {
    await pool.query("SELECT 1");
    console.log("MySQL connected");
    await warnIfMigrationsPending(); // tells you clearly if you forgot `npm run db:migrate`
  } catch (err) {
    console.error("MySQL connection failed:", err instanceof Error ? err.message : err);
  }
});
