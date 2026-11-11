import { Router } from "express";
import { get } from "./lookups.controller.js";

// Mounted at /admin/lookups.
const router = Router();
router.get("/", get);

export default router;
