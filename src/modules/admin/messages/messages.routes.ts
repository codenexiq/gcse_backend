import { Router } from "express";
import { messageReadLimiter } from "../../../middleware/rateLimiters/index.js";
import { validate } from "../../../middleware/validate/index.js";
import { send, thread, threads } from "./messages.controller.js";
import { sendMessageSchema } from "./messages.schemas.js";

// Mounted at /admin/messages.
const router = Router();
router.get("/threads", messageReadLimiter, threads);
router.get("/threads/:key", messageReadLimiter, thread);
router.post("/threads/:key/messages", validate(sendMessageSchema), send);

export default router;
