import { Router } from "express";
import { authenticate } from "../../middleware/authenticate/index.js";
import { authLimiter } from "../../middleware/rateLimiters/index.js";
import { validate } from "../../middleware/validate/index.js";
import { register, login, tutorLogin, logout, me } from "./auth.controller.js";
import { registerSchema, loginSchema } from "./auth.schemas.js";

const router = Router();

router.post("/register", authLimiter, validate(registerSchema), register);
router.post("/login", authLimiter, validate(loginSchema), login);
router.post("/tutor/login", authLimiter, validate(loginSchema), tutorLogin);
router.post("/logout", logout);
router.get("/me", authenticate, me);

export default router;
