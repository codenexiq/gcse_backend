import { Router } from "express";
import { markSent } from "./reports.controller.js";

// Mounted at /admin/reports.
const router = Router();
router.post("/:id/sent", markSent);

export default router;
