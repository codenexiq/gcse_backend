import mysql from "mysql2/promise";
import { env } from "../env/index.js";

// A pool re-uses connections instead of opening a new one per request.
export const pool = mysql.createPool({
  ...env.db,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: ["DATE"], // a DATE column is the plain text "2026-11-12", never a timezone-shifted Date
});

// Strict mode: bad data (for example a role that does not exist) is REFUSED with an error.
// Without it, some MySQL/MariaDB setups quietly save a blank value instead.
pool.pool.on("connection", (connection) => {
  connection.query("SET SESSION sql_mode = CONCAT_WS(',', @@SESSION.sql_mode, 'STRICT_ALL_TABLES')");
});

/** Runs several queries as one unit: they all succeed, or none of them is saved. */
export async function inTransaction<T>(work: (conn: mysql.PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
