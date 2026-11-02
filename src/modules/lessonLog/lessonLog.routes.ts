import { Router } from "express";
import { requireRole } from "../../middleware/requireRole/index.js";
import { validate } from "../../middleware/validate/index.js";
import { createEntry, deleteEntry, listEntries } from "./lessonLog.controller.js";
import { lessonLogSchema } from "./lessonLog.schemas.js";

// Mounted at /tutor/lesson-logs. Tutors and admins fill in the form and see their entries (admins see everyone's).
// Only an admin can delete an entry, so a submitted entry cannot be quietly changed or removed afterwards.
const router = Router();

router.use(requireRole("tutor", "admin"));
router.get("/", listEntries);
router.post("/", validate(lessonLogSchema), createEntry);
router.delete("/:id", requireRole("admin"), deleteEntry);

export default router;
