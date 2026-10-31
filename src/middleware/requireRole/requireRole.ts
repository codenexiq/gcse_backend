import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../utils/AppError/index.js";
import type { Role } from "../../modules/auth/user.model.js";

/**
 * Only lets the listed roles through, e.g. requireRole("tutor", "admin").
 * Use it AFTER authenticate(), which sets req.user from the database.
 */
export const requireRole =
  (...allowed: Role[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError(401, "Please log in"));
    if (!allowed.includes(req.user.role)) return next(new AppError(403, "You do not have access to this"));
    next();
  };
