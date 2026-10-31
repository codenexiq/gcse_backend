import { Router } from "express";
import { requireRole } from "../../middleware/requireRole/index.js";
import diagnosticRoutes from "../diagnostic/diagnostic.routes.js";
import startupContentRoutes from "../startup/content.routes.js";
import startupRoutes from "../startup/startup.routes.js";
import { getOverview, getStudents, getTutorAccounts } from "./tutor.controller.js";

const router = Router();

// Tutors and admins can see the overview and the student directory...
router.get("/overview", requireRole("tutor", "admin"), getOverview);
router.get("/students", requireRole("tutor", "admin"), getStudents);
// ...but only admins can see the list of tutor accounts.
router.get("/accounts", requireRole("admin"), getTutorAccounts);

// The Student Start-up Screen dropdown choices (tutor / admin; checked inside).
router.use("/startup-options", startupRoutes);
// The wording of the diagnostic intro screen (tutor / admin; checked inside).
router.use("/startup-content", startupContentRoutes);

// Diagnostic questions written by tutors (tutor / admin; checked inside).
router.use("/diagnostic-questions", diagnosticRoutes);

export default router;
