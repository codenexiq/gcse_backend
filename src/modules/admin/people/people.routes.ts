import { Router } from "express";
import enrolmentRoutes from "./enrolments/enrolments.routes.js";
import groupRoutes from "./groups/groups.routes.js";
import studentRoutes from "./students/students.routes.js";
import tutorRoutes from "./tutors/tutors.routes.js";

// Mounted at /admin/people: students, tutors and groups.
const router = Router();
router.use("/students", studentRoutes);
router.use("/tutors", tutorRoutes);
router.use("/groups", groupRoutes);
router.use("/enrolments", enrolmentRoutes);

export default router;
