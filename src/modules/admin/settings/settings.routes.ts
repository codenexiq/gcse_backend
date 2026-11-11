import { Router } from "express";
import levelRoutes from "./levels/levels.routes.js";
import planRoutes from "./plans/plans.routes.js";
import signupRoutes from "./signup/signup.routes.js";
import subjectRoutes from "./subjects/subjects.routes.js";
import topicRoutes from "./topics/topics.routes.js";

// Mounted at /admin/settings: edit what every screen shows.
const router = Router();
router.use("/levels", levelRoutes);
router.use("/subjects", subjectRoutes);
router.use("/topics", topicRoutes);
router.use("/plans", planRoutes);
router.use("/signup", signupRoutes);

export default router;
