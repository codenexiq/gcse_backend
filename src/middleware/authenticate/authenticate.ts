import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env/index.js";
import { AppError } from "../../utils/AppError/index.js";
import * as User from "../../modules/auth/user.model.js";

export const SESSION_COOKIE = "gcse_session";

/** Protects a route: the request must carry a valid session cookie of an existing user. */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token) throw new AppError(401, "Please log in");

    let userId: number;
    let issuedAt = 0;
    try {
      const payload = jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] });
      userId = Number(typeof payload === "string" ? NaN : payload.sub);
      issuedAt = typeof payload === "string" ? 0 : (payload.iat ?? 0);
    } catch {
      throw new AppError(401, "Session expired, please log in again");
    }

    // Look the user up every time, so deleted accounts lose access immediately.
    const user = Number.isInteger(userId) ? await User.findById(userId) : undefined;
    if (!user) throw new AppError(401, "Please log in");

    // An account an admin switched to Inactive loses access at once.
    if (!user.is_active) throw new AppError(403, "This account is inactive. Please contact your tutor.");

    // A session that began before the password was last changed is no longer valid (the person who changed it stays signed in on their own device).
    if (user.pw_changed && issuedAt < Number(user.pw_changed)) throw new AppError(401, "Your password was changed. Please log in again.");

    // The role comes from the database on every request - never from the browser.
    req.user = { id: user.id, fullName: user.full_name, email: user.email, role: user.role, avatarVersion: user.avatar_version ? Number(user.avatar_version) : null, chatColor: user.chat_color ?? null };
    next();
  } catch (err) {
    next(err);
  }
}
