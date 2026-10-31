import mysql from "mysql2/promise";
import { env } from "../env/index.js";

// A pool re-uses connections instead of opening a new one per request.
export const pool = mysql.createPool({
  ...env.db,
  waitForConnections: true,
  connectionLimit: 10,
});

// Strict mode: bad data (for example a role that does not exist) is REFUSED with an error.
// Without it, some MySQL/MariaDB setups quietly save a blank value instead.
pool.pool.on("connection", (connection) => {
  connection.query("SET SESSION sql_mode = CONCAT_WS(',', @@SESSION.sql_mode, 'STRICT_ALL_TABLES')");
});
