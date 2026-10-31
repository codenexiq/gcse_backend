import { connect, dbName } from "./connection.js";
import { migrate } from "./migrate.js";
import { seed } from "./seed.js";

// `npm run db:setup` - creates the database, builds the tables and loads the starter data.
const db = await connect();
console.log(`Setting up "${dbName}"...`);
try {
  await migrate(db);
  await seed(db);
} finally {
  await db.end();
}
