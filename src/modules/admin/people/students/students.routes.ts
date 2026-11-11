import { Router } from "express";
import { validate } from "../../../../middleware/validate/index.js";
import { addEnrolment, create, get, list, passwordReset, remove, update } from "./students.controller.js";
import { addEnrolmentSchema, updateStudentSchema } from "./students.schemas.js";

// Mounted at /admin/people/students.
const router = Router();
router.get("/", list);
router.post("/", create);
router.get("/:id", get);
router.put("/:id", validate(updateStudentSchema), update);
router.delete("/:id", remove);
router.post("/:id/enrolments", validate(addEnrolmentSchema), addEnrolment);
router.post("/:id/password-reset", passwordReset);

export default router;
