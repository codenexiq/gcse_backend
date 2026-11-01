import { Router } from "express";
import { requireRole } from "../../middleware/requireRole/index.js";
import { validate } from "../../middleware/validate/index.js";
import { readContent, readDiagnostic, readOptions, readProfile, readResult, saveProfile, submitDiagnostic } from "./student.controller.js";
import { studentReportRoutes } from "../monthlyReport/monthlyReport.routes.js";
import { profileSchema, submitSchema } from "./student.schemas.js";

const router = Router();

// The student workflow: only students use these (tutors and admins have their own area).
router.use(requireRole("student"));
router.get("/startup-options", readOptions);
router.get("/startup-content", readContent);
router.get("/profile", readProfile);
router.put("/profile", validate(profileSchema), saveProfile);
router.get("/diagnostic", readDiagnostic);
router.get("/diagnostic/result", readResult);
router.post("/diagnostic/submit", validate(submitSchema), submitDiagnostic);
// Monthly progress reports sent by tutors: read-only.
router.use("/monthly-reports", studentReportRoutes);

export default router;
