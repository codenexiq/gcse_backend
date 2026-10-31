import { Router } from "express";
import { requireRole } from "../../middleware/requireRole/index.js";
import { validate } from "../../middleware/validate/index.js";
import { createQuestion, generateAndSave, deleteQuestion, listQuestions, listTopics, updateQuestion } from "./diagnostic.controller.js";
import { generateSchema, questionSchema } from "./diagnostic.schemas.js";

const router = Router();

// Only tutors and admins write and read diagnostic questions (answers included).
router.use(requireRole("tutor", "admin"));
router.get("/", listQuestions);
router.post("/", validate(questionSchema), createQuestion);
router.get("/topics", listTopics);
router.post("/generate", validate(generateSchema), generateAndSave);
router.put("/:id", validate(questionSchema), updateQuestion);
router.delete("/:id", deleteQuestion);

export default router;
