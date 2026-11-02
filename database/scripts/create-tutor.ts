import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connect, dbName } from "./connection.js";

// `npm run tutor:create -- --name "Jane Smith" --email jane@school.com --role tutor`
// Creates a tutor or admin account with a strong random password, shown ONCE on screen.
// Tutor accounts cannot be created from the website - this is the only way.

const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const parsed = z
  .object({
    fullName: z
      .string({ error: "--name is required (the person's full name)" })
      .trim()
      .min(1, "--name is required (the person's full name)")
      .max(100, "--name must be at most 100 characters"),
    email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email").max(254)),
    role: z.enum(["tutor", "admin"], { error: "--role must be tutor or admin" }),
  })
  .safeParse({ fullName: option("name"), email: option("email"), role: option("role") });

if (!parsed.success) {
  console.error(parsed.error.issues.map((i) => `  - ${i.path.join(".") || "input"}: ${i.message}`).join("\n"));
  console.error('\nUsage: npm run tutor:create -- --name "Jane Smith" --email jane@school.com --role tutor|admin');
  process.exit(1);
}
const { fullName, email, role } = parsed.data;

/** 16 characters with upper case, lower case and digits (no look-alike letters like l / 1 / O / 0). */
function generatePassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const all = upper + lower + digits;
  const pick = (set: string) => set[randomInt(set.length)];
  const chars = [pick(upper), pick(lower), pick(digits)];
  while (chars.length < 16) chars.push(pick(all));
  // Shuffle so the guaranteed characters are not always first.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

const db = await connect();
try {
  const [existing] = await db.query<import("mysql2").RowDataPacket[]>("SELECT role FROM users WHERE email = ?", [email]);
  if (existing.length > 0) {
    console.error(`An account for ${email} already exists (role: ${existing[0].role}). Nothing was changed.`);
    process.exit(1);
  }

  const password = generatePassword();
  const passwordHash = await bcrypt.hash(password, 12);
  const [inserted] = await db.query<import("mysql2").ResultSetHeader>("INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)", [fullName, email, passwordHash, role]);
  // The unique User ID: TUT-00002 for a tutor, ADM-00001 for an admin (made from the account number).
  const userId = `${role === "admin" ? "ADM" : "TUT"}-${String(inserted.insertId).padStart(5, "0")}`;
  await db.query("UPDATE users SET user_code = ? WHERE id = ?", [userId, inserted.insertId]);

  console.log(`\nCreated ${role} account in "${dbName}":`);
  console.log(`  User ID:  ${userId}`);
  console.log(`  Name:     ${fullName}`);
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log("\nCopy the password now - it is not stored anywhere and cannot be shown again.");
  console.log("Sign in at /tutor/login.\n");
} finally {
  await db.end();
}
