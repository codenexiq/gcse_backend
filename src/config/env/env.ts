import "dotenv/config";

const isProduction = process.env.NODE_ENV === "production";

// Fail fast: refuse to start with a missing or weak secret.
const jwtSecret = process.env.JWT_SECRET || "";
if (jwtSecret.length < 32) {
  throw new Error(
    "JWT_SECRET must be set in .env and be at least 32 characters. Generate one with:\n" +
      "node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
  );
}
if (isProduction && !process.env.DB_PASSWORD) {
  throw new Error("DB_PASSWORD must be set in production.");
}

export const env = {
  isProduction,
  port: Number(process.env.PORT) || 5000,
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  // Set to 1 when running behind a reverse proxy (so rate limiting sees the real IP).
  trustProxy: Number(process.env.TRUST_PROXY) || 0,
  jwtSecret,
  sessionHours: Number(process.env.SESSION_HOURS) || 2,
  db: {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "educ",
  },
};
