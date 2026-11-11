import { Router } from "express";
import { validate } from "../../../../middleware/validate/index.js";
import { get, paths, save } from "./topics.controller.js";
import { saveTopicsSchema } from "./topics.schemas.js";

// Mounted at /admin/settings/topics.
const router = Router();
router.get("/paths", paths);
router.get("/:subjectId/:levelId", get);
router.put("/:subjectId/:levelId", validate(saveTopicsSchema), save);

export default router;
