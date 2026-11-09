import { Router } from "express";
import { requireRole } from "../../middleware/requireRole/index.js";
import { validate } from "../../middleware/validate/index.js";
import { assign, create, library, list, remove, unassign, update } from "./route.controller.js";
import { createSchema, updateSchema } from "./route.schemas.js";

// Mounted at /tutor/routes. Tutors and admins build learning routes and give them to students.
const router = Router();

router.use(requireRole("tutor", "admin"));
router.get("/", list);
router.get("/library", library);
router.post("/", validate(createSchema), create);
router.put("/:id", validate(updateSchema), update);
router.delete("/:id", remove);
router.put("/:id/students/:studentId", assign);
router.delete("/:id/students/:studentId", unassign);

export default router;
