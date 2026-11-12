import { Router } from "express";
import { messageReadLimiter } from "../../middleware/rateLimiters/index.js";
import { actingAs } from "../../middleware/actingAs/index.js";
import { authenticate } from "../../middleware/authenticate/index.js";
import { requireRole } from "../../middleware/requireRole/index.js";
import { validate } from "../../middleware/validate/index.js";
import { sendMessageSchema } from "../admin/messages/messages.schemas.js";
import { diagnostic, diagnosticGet, finish, home, item, practice, practiceResult, send, summary, thread, threads, topic } from "./student.controller.js";
import { diagnosticSchema, finishSchema, practiceResultSchema } from "./learn/learn.schemas.js";

// Mounted at /student. Everything is limited to the signed-in student's own subjects.
// An administrator may look at a student's panel too (see actingAs).
const router = Router();
router.use(authenticate, actingAs("student"), requireRole("student"));

router.get("/summary", summary); // name and unread messages for the header
router.get("/home", home); // ?enrolment=: the subjects, learning map, tasks, live lessons, progress
router.get("/topics/:id", topic); // ?enrolment=
router.get("/topics/:id/practice", practice); // ?enrolment=: questions for a practice set
router.post("/topics/:id/practice-result", validate(practiceResultSchema), practiceResult);
router.get("/enrolments/:id/diagnostic", diagnosticGet);
router.post("/enrolments/:id/diagnostic", validate(diagnosticSchema), diagnostic);
router.get("/items/:id", item); // ?enrolment=: a visible lesson, notes, quiz or video
router.post("/items/:id/finish", validate(finishSchema), finish);
router.get("/messages/threads", messageReadLimiter, threads);
router.get("/messages/threads/:id", messageReadLimiter, thread);
router.post("/messages/threads/:id/messages", validate(sendMessageSchema), send);

export default router;
