import { Router } from "express";
import { requireRole } from "../../middleware/requireRole/index.js";
import { validate } from "../../middleware/validate/index.js";
import { listAllReports, listMine, readMine, readReport, sendReport } from "./monthlyReport.controller.js";
import { sendSchema } from "./monthlyReport.schemas.js";

/** Mounted at /tutor/monthly-reports: tutors and admins send reports. */
export const tutorReportRoutes = Router();
tutorReportRoutes.use(requireRole("tutor", "admin"));
tutorReportRoutes.get("/", listAllReports);
tutorReportRoutes.get("/:id", readReport);
tutorReportRoutes.post("/", validate(sendSchema), sendReport);

/** Mounted at /student/monthly-reports: students can only read their own. */
export const studentReportRoutes = Router();
studentReportRoutes.get("/", listMine);
studentReportRoutes.get("/:id", readMine);
