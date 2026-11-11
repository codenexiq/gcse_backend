import { Router } from "express";
import { validate } from "../../../../middleware/validate/index.js";
import { create, list, remove, update } from "./subjects.controller.js";
import { createSubjectSchema, updateSubjectSchema } from "./subjects.schemas.js";

// Mounted at /admin/settings/subjects.
const router = Router();
router.get("/", list);
router.post("/", validate(createSubjectSchema), create);
router.put("/:id", validate(updateSubjectSchema), update);
router.delete("/:id", remove);

export default router;
