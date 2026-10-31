import rateLimit from "express-rate-limit";

const base = { standardHeaders: true, legacyHeaders: false };

// Every route: 100 requests / 15 minutes / IP.
export const globalLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 100,
  message: { message: "Too many requests, please try again later" },
});

// Login + register: only 10 attempts / 15 minutes / IP, to slow down password guessing.
export const authLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { message: "Too many attempts, please try again in 15 minutes" },
});
