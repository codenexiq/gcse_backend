import { Router } from "express";
import { authenticate } from "../../middleware/authenticate/index.js";
import { requireRole } from "../../middleware/requireRole/index.js";
import lookupRoutes from "./lookups/lookups.routes.js";
import messageRoutes from "./messages/messages.routes.js";
import overviewRoutes from "./overview/overview.routes.js";
import peopleRoutes from "./people/people.routes.js";
import reportRoutes from "./reports/reports.routes.js";
import settingsRoutes from "./settings/settings.routes.js";

// Mounted at /admin. Only admins may use anything below.
const router = Router();
router.use(authenticate, requireRole("admin"));

router.use("/lookups", lookupRoutes); // levels, subjects, plans, tutors and groups for the selects
router.use("/overview", overviewRoutes); // the Overview tab
router.use("/reports", reportRoutes); // monthly reports waiting to be sent to parents
router.use("/people", peopleRoutes); // students, tutors, groups
router.use("/messages", messageRoutes); // read every conversation, reply as the team
router.use("/settings", settingsRoutes); // levels, subjects, topics, plans, sign-up

export default router;
