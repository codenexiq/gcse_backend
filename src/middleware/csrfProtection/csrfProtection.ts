import type { NextFunction, Request, Response } from "express";
import { env } from "../../config/env/index.js";
import { AppError } from "../../utils/AppError/index.js";

const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

/**
 * CSRF protection for cookie sessions. State-changing requests must:
 *  1. come from our own frontend (Origin check), and
 *  2. carry a custom header. Browsers only allow custom headers from pages
 *     that pass CORS, so another website cannot forge it.
 * (The session cookie is also SameSite=Strict as a third layer.)
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.includes(req.method)) return next();

  const origin = req.get("origin");
  if (origin && origin !== env.frontendUrl) {
    return next(new AppError(403, "Forbidden"));
  }
  if (req.get("x-requested-with") !== "XMLHttpRequest") {
    return next(new AppError(403, "Forbidden"));
  }
  next();
}
