import { Router } from "express";
import { requireRole } from "../../middleware/requireRole/index.js";
import { validate } from "../../middleware/validate/index.js";
import { createOption, deleteOption, listOptions, updateOption } from "./startup.controller.js";
import { createOptionSchema, updateOptionSchema } from "./startup.schemas.js";

const router = Router();

// Only tutors and admins manage the Student Start-up Screen choices.
router.use(requireRole("tutor", "admin"));
router.get("/", listOptions);
router.post("/", validate(createOptionSchema), createOption);
router.put("/:id", validate(updateOptionSchema), updateOption);
router.delete("/:id", deleteOption);

export default router;
