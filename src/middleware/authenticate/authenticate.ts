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
    try {
      const payload = jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] });
      userId = Number(typeof payload === "string" ? NaN : payload.sub);
    } catch {
      throw new AppError(401, "Session expired, please log in again");
    }

    // Look the user up every time, so deleted accounts lose access immediately.
    const user = Number.isInteger(userId) ? await User.findById(userId) : undefined;
    if (!user) throw new AppError(401, "Please log in");

    // The role comes from the database on every request - never from the browser.
    req.user = { id: user.id, fullName: user.full_name, email: user.email, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
}
