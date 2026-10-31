import { Router } from "express";
import { authenticate } from "../middleware/authenticate/index.js";
import healthRoutes from "../modules/health/health.routes.js";
import authRoutes from "../modules/auth/auth.routes.js";
import subjectRoutes from "../modules/subjects/subject.routes.js";
import itemRoutes from "../modules/items/item.routes.js";
import studentRoutes from "../modules/student/student.routes.js";
import tutorRoutes from "../modules/tutor/tutor.routes.js";

const router = Router();

// Public routes (no login needed)
router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/subjects", subjectRoutes); // read-only school subjects/topics, shown on the public home page

// Everything below needs a logged-in user (secure by default).
router.use(authenticate);
router.use("/items", itemRoutes);
router.use("/student", studentRoutes); // the student workflow (students only; checked inside)
router.use("/tutor", tutorRoutes); // each route inside checks the role (tutor / admin)

export default router;
