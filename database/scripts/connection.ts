import "dotenv/config";
import mysql from "mysql2/promise";

// These scripts read .env directly, so they work without JWT_SECRET.
export const dbName = process.env.DB_NAME || "educ";

// The name is used as an SQL identifier (it can not be a ? placeholder), so only allow safe characters.
if (!/^[A-Za-z0-9_]+$/.test(dbName)) {
  throw new Error("DB_NAME may only contain letters, numbers and underscores.");
}

const settings = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  multipleStatements: true, // lets one .sql file contain many statements
};

/** Connects to the MySQL server, creating the database first if needed. */
export async function connect() {
  const server = await mysql.createConnection(settings);
  await server.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await server.changeUser({ database: dbName });
  // Strict mode, same as the app: bad data is refused instead of being saved as a blank.
  await server.query("SET SESSION sql_mode = CONCAT_WS(',', @@SESSION.sql_mode, 'STRICT_ALL_TABLES')");
  return server;
}

/** Connects to the MySQL server only (no database selected). */
export const connectToServer = () => mysql.createConnection(settings);
