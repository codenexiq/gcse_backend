import { Router } from "express";
import { validate } from "../../../../middleware/validate/index.js";
import { remove, update } from "./enrolments.controller.js";
import { updateEnrolmentSchema } from "./enrolments.schemas.js";

// Mounted at /admin/people/enrolments.
const router = Router();
router.put("/:id", validate(updateEnrolmentSchema), update);
router.delete("/:id", remove);

export default router;
