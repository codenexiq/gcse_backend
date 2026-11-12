import { Router } from "express";
import { messageReadLimiter } from "../../../middleware/rateLimiters/index.js";
import { z } from "zod";
import { validate } from "../../../middleware/validate/index.js";
import { sendMessageSchema } from "../../admin/messages/messages.schemas.js";
import { open, send, thread, threads } from "./messages.controller.js";

// Mounted at /tutor/messages.
const router = Router();
router.get("/threads", messageReadLimiter, threads);
router.get("/threads/:id", messageReadLimiter, thread);
router.post("/threads/:id/messages", validate(sendMessageSchema), send);
router.post("/open", validate(z.object({ studentId: z.number().int().positive() })), open);

export default router;
