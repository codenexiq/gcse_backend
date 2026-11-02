import express, { type NextFunction, type Request, type Response } from "express";
import { AppError } from "../../utils/AppError/index.js";
import { MAX_IMAGE_BYTES } from "../../modules/profile/profile.schemas.js";

const parse = express.raw({ type: () => true, limit: Math.max(...Object.values(MAX_IMAGE_BYTES)) });

/** Reads a picture sent as the raw request body (up to the biggest allowed size). */
export const rawImage = (req: Request, res: Response, next: NextFunction) =>
  parse(req, res, (err?: unknown) => (err ? next(new AppError(413, "The picture is too big")) : next()));
