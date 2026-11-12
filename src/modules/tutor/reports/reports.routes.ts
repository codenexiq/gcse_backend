import { Router } from "express";
import { validate } from "../../../middleware/validate/index.js";
import { get, send } from "./reports.controller.js";
import { sendReportSchema } from "./reports.schemas.js";

// Mounted at /tutor/reports. The :id is the student's subject (enrolment).
const router = Router();
router.get("/:id", get);
router.post("/:id/send", validate(sendReportSchema), send);

export default router;
