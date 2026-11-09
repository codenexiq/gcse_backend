import { Router } from "express";
import { requireRole } from "../../middleware/requireRole/index.js";
import { validate } from "../../middleware/validate/index.js";
import { assignStudent, removeStudent } from "../group/group.controller.js";
import { assignSchema } from "../group/group.schemas.js";
import { getMonthReport, getOverview, getReview, listWaiting } from "./studentReview.controller.js";

// Mounted at /tutor/students (before the routes that take a student id). Tutors and admins only.
const router = Router();

router.get("/waiting", requireRole("tutor", "admin"), listWaiting);
router.get("/:id/diagnostic", requireRole("tutor", "admin"), getReview);
router.get("/:id/overview", requireRole("tutor", "admin"), getOverview);
router.get("/:id/month-report", requireRole("tutor", "admin"), getMonthReport);
router.put("/:id/group", requireRole("tutor", "admin"), validate(assignSchema), assignStudent);
router.delete("/:id/group", requireRole("tutor", "admin"), removeStudent);

export default router;
