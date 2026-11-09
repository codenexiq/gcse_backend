import { Router } from "express";
import { requireRole } from "../../middleware/requireRole/index.js";
import { validate } from "../../middleware/validate/index.js";
import { deleteQuiz, getDiagram, getQuiz, listAttempts, listQuizzes, setPublished, submitAttempt, updateQuiz, uploadQuiz } from "./quiz.controller.js";
import { attemptSchema, publishSchema } from "./quiz.schemas.js";

// Mounted at /quizzes.
//  - Tutors and admins upload quiz files (the file is checked inside), publish / unpublish, delete, and see every attempt.
//  - Students see published quizzes, answer them (the server marks them) and see their own attempts.
const router = Router();

router.get("/", listQuizzes);
router.post("/", requireRole("tutor", "admin"), uploadQuiz);
router.get("/:id", getQuiz);
router.get("/:id/diagrams/:key", getDiagram);
router.get("/:id/attempts", listAttempts);
router.post("/:id/attempts", requireRole("student"), validate(attemptSchema), submitAttempt);
router.put("/:id", requireRole("tutor", "admin"), updateQuiz);
router.patch("/:id", requireRole("tutor", "admin"), validate(publishSchema), setPublished);
router.delete("/:id", requireRole("tutor", "admin"), deleteQuiz);

export default router;
