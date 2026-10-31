import { Router } from "express";
import { requireRole } from "../../middleware/requireRole/index.js";
import { validate } from "../../middleware/validate/index.js";
import { readContent, saveContent } from "./content.controller.js";
import { updateContentSchema } from "./content.schemas.js";

const router = Router();

// Only tutors and admins read or change the diagnostic intro wording.
router.use(requireRole("tutor", "admin"));
router.get("/", readContent);
router.put("/", validate(updateContentSchema), saveContent);

export default router;
