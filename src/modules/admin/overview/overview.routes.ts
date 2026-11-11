import { Router } from "express";
import { attention, get } from "./overview.controller.js";

// Mounted at /admin/overview.
const router = Router();
router.get("/", get);
router.get("/attention", attention);

export default router;
