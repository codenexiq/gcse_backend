import { Router } from "express";
import { get } from "./summary.controller.js";

// Mounted at /tutor/summary.
const router = Router();
router.get("/", get);

export default router;
