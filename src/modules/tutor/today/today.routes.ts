import { Router } from "express";
import { validate } from "../../../middleware/validate/index.js";
import { book, get, logForm, saveLog } from "./today.controller.js";
import { bookSchema, logSchema } from "./today.schemas.js";

// Mounted at /tutor/today.
const router = Router();
router.get("/", get);
router.post("/bookings", validate(bookSchema), book);
router.get("/logs/:id/form", logForm);
router.post("/logs", validate(logSchema), saveLog);

export default router;
