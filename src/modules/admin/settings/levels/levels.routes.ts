import { Router } from "express";
import { validate } from "../../../../middleware/validate/index.js";
import { create, list, remove, update } from "./levels.controller.js";
import { createLevelSchema, updateLevelSchema } from "./levels.schemas.js";

// Mounted at /admin/settings/levels.
const router = Router();
router.get("/", list);
router.post("/", validate(createLevelSchema), create);
router.put("/:id", validate(updateLevelSchema), update);
router.delete("/:id", remove);

export default router;
