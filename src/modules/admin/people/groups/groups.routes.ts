import { Router } from "express";
import { validate } from "../../../../middleware/validate/index.js";
import { addSessions, create, list, update } from "./groups.controller.js";
import { updateGroupSchema } from "./groups.schemas.js";

// Mounted at /admin/people/groups.
const router = Router();
router.get("/", list);
router.post("/", create);
router.put("/:id", validate(updateGroupSchema), update);
router.post("/:id/sessions", addSessions);

export default router;
