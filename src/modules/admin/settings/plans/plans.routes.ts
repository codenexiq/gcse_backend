import { Router } from "express";
import { validate } from "../../../../middleware/validate/index.js";
import { list, update } from "./plans.controller.js";
import { updatePlanSchema } from "./plans.schemas.js";

// Mounted at /admin/settings/plans.
const router = Router();
router.get("/", list);
router.put("/:id", validate(updatePlanSchema), update);

export default router;
