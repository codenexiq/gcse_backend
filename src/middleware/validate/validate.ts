import type { RequestHandler } from "express";
import type { ZodType } from "zod";

/** Checks req.body against a zod schema. Unknown fields are stripped. */
export const validate =
  (schema: ZodType): RequestHandler =>
  (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) return next(result.error);
    req.body = result.data;
    next();
  };
