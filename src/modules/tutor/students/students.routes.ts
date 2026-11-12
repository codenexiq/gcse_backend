import { Router } from "express";
import { validate } from "../../../middleware/validate/index.js";
import { cycle, list, profile, update } from "./students.controller.js";
import { updateEnrolmentSchema } from "./students.schemas.js";

// Mounted at /tutor/students. The :id is the student's subject (enrolment): a student with two subjects appears twice.
const router = Router();
router.get("/", list);
router.get("/:id", profile);
router.put("/:id", validate(updateEnrolmentSchema), update);
router.post("/:id/topics/:topicId/cycle", cycle);

export default router;
