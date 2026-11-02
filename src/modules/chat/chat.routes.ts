import { Router } from "express";
import groupRoutes from "../chatGroup/chatGroup.routes.js";
import { rawFile } from "../../middleware/rawFile/index.js";
import { requireRole } from "../../middleware/requireRole/index.js";
import { validate } from "../../middleware/validate/index.js";
import { chatReadLimiter, chatWriteLimiter } from "../../middleware/rateLimiters/index.js";
import { clearConversation, deleteConversation, downloadAttachment, findStudents, listConversations, readPeer, postMessage, readMessages, removeMessage, unreadCount, uploadAttachment } from "./chat.controller.js";
import { sendSchema } from "./chat.schemas.js";

const router = Router();

// Group chats (an admin makes a group and adds students).
router.use("/groups", groupRoutes);

// Every chat is between one student and one tutor/admin. The controller works the pair out from who is asking, so nobody can reach another person's chat.
// Reading is polled every few seconds, so it has its own roomy limit (the global one would run out).
router.get("/conversations", chatReadLimiter, listConversations); // students see the tutors; tutors and admins see the chats they already have
router.get("/students", chatReadLimiter, requireRole("tutor", "admin"), findStudents); // search, to start a new chat
router.get("/messages", chatReadLimiter, readMessages);
router.get("/peer", chatReadLimiter, readPeer); // the other person's card, shown beside the chat
router.get("/unread", chatReadLimiter, unreadCount);
router.get("/attachments/:id", chatReadLimiter, downloadAttachment);
router.post("/messages", chatWriteLimiter, validate(sendSchema), postMessage);
router.delete("/messages/:id", chatWriteLimiter, removeMessage); // your own message, for everyone
router.post("/clear", chatWriteLimiter, clearConversation); // empties the chat on your screen only
router.delete("/conversation", chatWriteLimiter, deleteConversation); // the whole chat, for everyone

// The file arrives as the raw request body (the name goes in the address), up to 5 MB.
router.post("/attachments", chatWriteLimiter, rawFile, uploadAttachment);

export default router;
