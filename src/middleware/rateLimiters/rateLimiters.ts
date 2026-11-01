import rateLimit from "express-rate-limit";

const base = { standardHeaders: true, legacyHeaders: false };

// Every route: 100 requests / 15 minutes / IP.
export const globalLimiter = rateLimit({
  ...base,
  // Chat is checked every few seconds while it is open, so it has its own limits below.
  skip: (req) => req.originalUrl.startsWith("/api/chat/"),
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

// Chat: reading is polled every few seconds, so it gets plenty of room (about 8 open tabs per IP).
export const chatReadLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  message: { message: "Too many requests, please try again in a few minutes" },
});

// Chat: sending messages and uploading files, 60 a minute per IP.
export const chatWriteLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  limit: 60,
  message: { message: "You are sending too fast, please wait a moment" },
});
