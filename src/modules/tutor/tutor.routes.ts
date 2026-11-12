import { Router } from "express";
import { actingAs } from "../../middleware/actingAs/index.js";
import { authenticate } from "../../middleware/authenticate/index.js";
import { requireRole } from "../../middleware/requireRole/index.js";
import contentRoutes from "./content/content.routes.js";
import messageRoutes from "./messages/messages.routes.js";
import reportRoutes from "./reports/reports.routes.js";
import studentRoutes from "./students/students.routes.js";
import summaryRoutes from "./summary/summary.routes.js";
import todayRoutes from "./today/today.routes.js";

// Mounted at /tutor. Tutors see academic details only: no emails, phone numbers or parent details anywhere below.
const router = Router();
router.use(authenticate, actingAs("tutor"), requireRole("tutor")); // an admin may look at a teacher's panel (see actingAs)

router.use("/summary", summaryRoutes); // name, sessions to log, unread messages
router.use("/today", todayRoutes); // calendar, booking, session logs
router.use("/students", studentRoutes); // my students, profiles, learning map
router.use("/reports", reportRoutes); // monthly report: written here, sent on by the admin team
router.use("/content", contentRoutes); // lessons, notes, quizzes and learning routes
router.use("/messages", messageRoutes); // conversations with my students

export default router;
