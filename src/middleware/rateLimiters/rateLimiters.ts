import rateLimit from "express-rate-limit";

const base = { standardHeaders: true, legacyHeaders: false };

// Every route: 1500 requests / 15 minutes / IP. The student, teacher and admin panels make several calls per page
// and a whole class can share one school IP, so this is generous; sign-in has its own strict limit below.
export const globalLimiter = rateLimit({
  ...base,
  // Chat is checked every few seconds while it is open, so it has its own limits below.
  skip: (req) => req.originalUrl.startsWith("/api/chat/") || (req.method === "GET" && /^\/api\/(student|tutor|admin)\/messages\//.test(req.originalUrl)),
  windowMs: 15 * 60 * 1000,
  limit: 1500,
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

// Profile pages and picture uploads: 60 a minute per IP.
export const profileLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  limit: 60,
  message: { message: "Too many requests, please wait a moment" },
});

// The public contact form: 5 messages an hour per IP, so it cannot be used to flood the admins' inbox.
export const enquiryLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: { message: "You have sent several messages already. Please try again later, or email us." },
});

// The messages screens check for new messages every few seconds while a chat is open (GET only), so they get plenty of room:
// about 50 open chats behind one school IP. Sending has its own limit.
export const messageReadLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 5000,
  message: { message: "Too many requests, please try again in a few minutes" },
});
