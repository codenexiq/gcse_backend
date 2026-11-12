import { Router } from "express";
import { authenticate } from "../../middleware/authenticate/index.js";
import { authLimiter } from "../../middleware/rateLimiters/index.js";
import { validate } from "../../middleware/validate/index.js";
import { signup, signupOptions, login, tutorLogin, adminLogin, logout, me } from "./auth.controller.js";
import { loginSchema } from "./auth.schemas.js";
import { signupSchema } from "./signup.schemas.js";

const router = Router();

router.get("/signup-options", signupOptions);
router.post("/signup", authLimiter, validate(signupSchema), signup);
router.post("/login", authLimiter, validate(loginSchema), login);
router.post("/tutor/login", authLimiter, validate(loginSchema), tutorLogin);
router.post("/admin/login", authLimiter, validate(loginSchema), adminLogin);
router.post("/logout", logout);
router.get("/me", authenticate, me);

export default router;
