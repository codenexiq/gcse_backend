import { Router } from "express";
import { requireRole } from "../../middleware/requireRole/index.js";
import { validate } from "../../middleware/validate/index.js";
import { createGroup, deleteGroup, listGroups, updateGroup } from "./group.controller.js";
import { groupSchema } from "./group.schemas.js";

// Mounted at /tutor/groups. Tutors and admins set up the weekly groups.
const router = Router();

router.use(requireRole("tutor", "admin"));
router.get("/", listGroups);
router.post("/", validate(groupSchema), createGroup);
router.put("/:id", validate(groupSchema), updateGroup);
router.delete("/:id", deleteGroup);

export default router;
