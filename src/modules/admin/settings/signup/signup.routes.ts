import { Router } from "express";
import { validate } from "../../../../middleware/validate/index.js";
import { get, save } from "./signup.controller.js";
import { saveSignupSchema } from "./signup.schemas.js";

// Mounted at /admin/settings/signup.
const router = Router();
router.get("/", get);
router.put("/", validate(saveSignupSchema), save);

export default router;
