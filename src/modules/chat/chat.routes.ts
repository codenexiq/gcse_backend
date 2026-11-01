import express, { Router, type NextFunction, type Request, type Response } from "express";
import { validate } from "../../middleware/validate/index.js";
import { chatReadLimiter, chatWriteLimiter } from "../../middleware/rateLimiters/index.js";
import { AppError } from "../../utils/AppError/index.js";
import { clearConversation, deleteConversation, downloadAttachment, listConversations, postMessage, readMessages, removeMessage, unreadCount, uploadAttachment } from "./chat.controller.js";
import { MAX_FILE_BYTES, sendSchema } from "./chat.schemas.js";

const router = Router();

// Every chat is between one student and one tutor/admin. The controller works the pair out from who is asking, so nobody can reach another person's chat.
// Reading is polled every few seconds, so it has its own roomy limit (the global one would run out).
router.get("/conversations", chatReadLimiter, listConversations); // students see the tutors, tutors and admins see the students
router.get("/messages", chatReadLimiter, readMessages);
router.get("/unread", chatReadLimiter, unreadCount);
router.get("/attachments/:id", chatReadLimiter, downloadAttachment);
router.post("/messages", chatWriteLimiter, validate(sendSchema), postMessage);
router.delete("/messages/:id", chatWriteLimiter, removeMessage); // your own message, for everyone
router.post("/clear", chatWriteLimiter, clearConversation); // empties the chat on your screen only
router.delete("/conversation", chatWriteLimiter, deleteConversation); // the whole chat, for everyone

// The file arrives as the raw request body (the name goes in the address), up to 5 MB.
const rawFile = express.raw({ type: () => true, limit: MAX_FILE_BYTES });
router.post(
  "/attachments",
  chatWriteLimiter,
  (req: Request, res: Response, next: NextFunction) =>
    rawFile(req, res, (err?: unknown) => (err ? next(new AppError(413, "The file is too big (5 MB at most)")) : next())),
  uploadAttachment
);

export default router;
