import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../../utils/AppError/index.js";

export function notFound(req: Request, res: Response) {
  res.status(404).json({ message: "Route not found" });
}

// Never send stack traces or SQL errors to the client - log them on the server only.
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: "Invalid input",
      errors: err.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    });
  }
  // Errors thrown by express.json() carry a `type`.
  const bodyError = (err as { type?: string } | null)?.type;
  if (bodyError === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON" });
  }
  if (bodyError === "entity.too.large") {
    return res.status(413).json({ message: "Request too large" });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ message: err.message });
  }
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
}
