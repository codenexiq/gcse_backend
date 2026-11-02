import { Router } from "express";
import { requireRole } from "../../middleware/requireRole/index.js";
import { rawImage } from "../../middleware/rawImage/index.js";
import { validate } from "../../middleware/validate/index.js";
import diagnosticRoutes from "../diagnostic/diagnostic.routes.js";
import startupContentRoutes from "../startup/content.routes.js";
import lessonLogRoutes from "../lessonLog/lessonLog.routes.js";
import { tutorReportRoutes } from "../monthlyReport/monthlyReport.routes.js";
import startupRoutes from "../startup/startup.routes.js";
import { bulkStudents, checkUsername, createStudent, deleteStudent, getOverview, getStudentProfile, getStudents, getTutorAccounts, removeStudentImage, updateStudent, uploadStudentImage } from "./tutor.controller.js";
import { bulkStudentsSchema, createStudentSchema, updateStudentSchema } from "./tutor.schemas.js";

const router = Router();

// Tutors and admins can see the overview and the student directory...
router.get("/overview", requireRole("tutor", "admin"), getOverview);
router.get("/students", requireRole("tutor", "admin"), getStudents);
// Admins and tutors manage student profiles: create, change, set pictures, switch Active / Inactive.
router.get("/students/username-available", requireRole("tutor", "admin"), checkUsername);
router.post("/students", requireRole("tutor", "admin"), validate(createStudentSchema), createStudent);
router.post("/students/bulk", requireRole("tutor", "admin"), validate(bulkStudentsSchema), bulkStudents); // deleting in bulk is checked inside: admins only
router.get("/students/:id", requireRole("tutor", "admin"), getStudentProfile);
router.put("/students/:id", requireRole("tutor", "admin"), validate(updateStudentSchema), updateStudent);
router.post("/students/:id/image/:kind", requireRole("tutor", "admin"), rawImage, uploadStudentImage);
router.delete("/students/:id/image/:kind", requireRole("tutor", "admin"), removeStudentImage);
// Only admins delete a student (it removes everything of theirs for good).
router.delete("/students/:id", requireRole("admin"), deleteStudent);
// Only admins can see the list of tutor accounts.
router.get("/accounts", requireRole("admin"), getTutorAccounts);

// The Student Start-up Screen dropdown choices (tutor / admin; checked inside).
router.use("/startup-options", startupRoutes);
// The wording of the diagnostic intro screen (tutor / admin; checked inside).
router.use("/startup-content", startupContentRoutes);

// Diagnostic questions written by tutors (tutor / admin; checked inside).
router.use("/diagnostic-questions", diagnosticRoutes);

// Monthly progress reports a tutor sends to a student (tutor / admin; checked inside).
router.use("/monthly-reports", tutorReportRoutes);

// The attendance and feedback form a tutor fills in after each lesson (tutor / admin; checked inside).
router.use("/lesson-logs", lessonLogRoutes);

export default router;
