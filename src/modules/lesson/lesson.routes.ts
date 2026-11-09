import { Router } from "express";
import { requireRole } from "../../middleware/requireRole/index.js";
import { validate } from "../../middleware/validate/index.js";
import { checkSchema, createSchema, finishSchema, genieSchema, markSchema, pdfAiSchema, practiceSchema, questionsSchema, quizAiSchema, redesignSchema, updateSchema } from "./lesson.schemas.js";
import * as Ai from "../ai/ai.controller.js";
import { bank, create, getOne, listForTopic, remove, studentCheck, studentFinish, studentGet, studentScheme, summary, update } from "./lesson.controller.js";

// Mounted at /lessons.
//  - Tutors and admins build lessons (list, create, edit, publish, delete).
//  - Students open published lessons under /lessons/student/:id, check answers and finish (the server marks them).
const router = Router();

// The AI helper. It answers 503 until ANTHROPIC_API_KEY is set; the screens carry on without it.
router.get("/ai/status", Ai.status);
router.post("/ai/redesign", requireRole("tutor", "admin"), validate(redesignSchema), Ai.redesign);
router.post("/ai/quiz", requireRole("tutor", "admin"), validate(quizAiSchema), Ai.quiz);
router.post("/ai/pdf", requireRole("tutor", "admin"), validate(pdfAiSchema), Ai.pdf);
router.post("/ai/questions", requireRole("tutor", "admin"), validate(questionsSchema), Ai.questions);

// A fresh practice set for a student (declared before /student/:id so "practice" is not read as an id).
router.post("/student/practice", requireRole("student"), validate(practiceSchema), Ai.practice);
router.get("/student/practice/:id", requireRole("student"), Ai.practiceGet);
router.post("/student/practice/:id/check", requireRole("student"), validate(checkSchema), Ai.practiceCheck);
router.post("/student/practice/:id/finish", requireRole("student"), validate(finishSchema), Ai.practiceFinish);

router.post("/student/:id/mark", requireRole("student"), validate(markSchema), Ai.mark);
router.post("/student/:id/genie", requireRole("student"), validate(genieSchema), Ai.genie);
router.get("/student/:id", requireRole("student"), studentGet);
router.post("/student/:id/check", requireRole("student"), validate(checkSchema), studentCheck);
router.get("/student/:id/scheme", requireRole("student"), studentScheme);
router.post("/student/:id/finish", requireRole("student"), validate(finishSchema), studentFinish);

router.get("/bank", requireRole("tutor", "admin"), bank);
router.get("/summary", requireRole("tutor", "admin"), summary);
router.get("/", requireRole("tutor", "admin"), listForTopic);
router.post("/", requireRole("tutor", "admin"), validate(createSchema), create);
router.get("/:id", requireRole("tutor", "admin"), getOne);
router.put("/:id", requireRole("tutor", "admin"), validate(updateSchema), update);
router.delete("/:id", requireRole("tutor", "admin"), remove);

export default router;
