import { Router } from "express";
import { validate } from "../../middleware/validate/index.js";
import { authLimiter, profileLimiter } from "../../middleware/rateLimiters/index.js";
import { rawImage } from "../../middleware/rawImage/index.js";
import { changePassword, checkUsername, readProfile, saveChatColor, removeImage, saveProfile, sendImage, sendUserAvatar, sendUserCover, uploadImage } from "./profile.controller.js";
import { chatColorSchema, passwordSchema, profileSchema } from "./profile.schemas.js";

const router = Router();

// Every route works on the signed-in person's own account: the id always comes from the session, never from the request.
router.get("/", profileLimiter, readProfile);
router.put("/", profileLimiter, validate(profileSchema), saveProfile);
router.put("/chat-color", profileLimiter, validate(chatColorSchema), saveChatColor); // the colour of the chat area
router.get("/username-available", profileLimiter, checkUsername);
// Guessing the current password is slowed down like logging in.
router.put("/password", authLimiter, validate(passwordSchema), changePassword);

router.get("/image/:kind", profileLimiter, sendImage);
// A student's picture for tutors and admins (the students table); the controller decides who may see whose.
router.get("/avatar/:userId", profileLimiter, sendUserAvatar);
router.get("/cover/:userId", profileLimiter, sendUserCover);
router.delete("/image/:kind", profileLimiter, removeImage);

// The picture arrives as the raw request body.
router.post("/image/:kind", profileLimiter, rawImage, uploadImage);

export default router;
