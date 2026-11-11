import { Router } from "express";
import { authenticate } from "../middleware/authenticate/index.js";
import healthRoutes from "../modules/health/health.routes.js";
import authRoutes from "../modules/auth/auth.routes.js";
import profileRoutes from "../modules/profile/profile.routes.js";
import chatRoutes from "../modules/chat/chat.routes.js";
import adminRoutes from "../modules/admin/admin.routes.js";
import { siteRoutes } from "../modules/site/site.routes.js";

const router = Router();

// Public routes (no login needed)
router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/site", siteRoutes); // the public website: its content and the contact form

// Everything below needs a logged-in user (secure by default).
router.use(authenticate);
router.use("/profile", profileRoutes); // everyone manages their own profile (the account comes from the session)
router.use("/admin", adminRoutes); // the admin dashboard (admins only; checked inside)
router.use("/chat", chatRoutes); // students and tutors talk to each other (the role decides what each can reach)

export default router;
