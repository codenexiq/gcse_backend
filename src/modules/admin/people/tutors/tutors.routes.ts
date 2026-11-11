import { Router } from "express";
import { validate } from "../../../../middleware/validate/index.js";
import { create, list, update } from "./tutors.controller.js";
import { updateTutorSchema } from "./tutors.schemas.js";

// Mounted at /admin/people/tutors.
const router = Router();
router.get("/", list);
router.post("/", create);
router.put("/:id", validate(updateTutorSchema), update);

export default router;
