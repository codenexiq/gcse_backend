import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../utils/AppError/index.js";
import * as User from "../../modules/auth/user.model.js";

type Panel = "tutor" | "student";

/** The cookie that remembers which teacher or student an administrator is looking at. */
export const viewCookie = (panel: Panel) => `gcse_view_${panel}`;

/**
 * The teacher and student panels belong to teachers and students. An administrator may open them too, and sees exactly
 * what the chosen person sees: from here on the request is handled as that person (req.user is replaced). Anyone who is
 * not an administrator is never affected by the cookie. Use it after authenticate() and before requireRole().
 * An administrator cannot write chat messages as someone else: they reply from Admin > Messages.
 */
export const actingAs = (panel: Panel) => async (req: Request, _res: Response, next: NextFunction) => {
  try {
    if (req.user?.role === "admin") {
      const id = Number(req.cookies?.[viewCookie(panel)]);
      const target = Number.isInteger(id) && id > 0 ? await User.findById(id) : undefined;
      if (!target || target.role !== panel || !target.is_active) throw new AppError(409, `Choose a ${panel === "tutor" ? "teacher" : "student"} to view first.`);
      if (req.method !== "GET" && req.originalUrl.includes("/messages")) throw new AppError(403, "Administrators reply to messages in Admin > Messages.");
      req.user = {
        id: target.id,
        fullName: target.full_name,
        email: target.email,
        role: target.role,
        avatarVersion: target.avatar_version ? Number(target.avatar_version) : null,
        chatColor: target.chat_color ?? null,
      };
    }
    next();
  } catch (err) {
    next(err);
  }
};
