import { connect, connectToServer, dbName } from "./connection.js";
import { migrate } from "./migrate.js";
import { seed } from "./seed.js";

// `npm run db:reset` - DELETES the whole database and rebuilds it. Development only.
if (process.env.NODE_ENV === "production") {
  console.error("Refusing to reset the database in production.");
  process.exit(1);
}
if (!process.argv.includes("--yes")) {
  console.error(`This will DELETE all data in "${dbName}". Run again with --yes to confirm:`);
  console.error("  npm run db:reset -- --yes");
  process.exit(1);
}

const server = await connectToServer();
await server.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
await server.end();
console.log(`Dropped "${dbName}".`);

const db = await connect();
try {
  await migrate(db);
  await seed(db);
} finally {
  await db.end();
}
