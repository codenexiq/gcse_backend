import express, { type NextFunction, type Request, type Response } from "express";
import { AppError } from "../../utils/AppError/index.js";
import { MAX_FILE_BYTES } from "../../modules/chat/chat.schemas.js";

const parse = express.raw({ type: () => true, limit: MAX_FILE_BYTES });

/** Reads a shared file sent as the raw request body (5 MB at most). */
export const rawFile = (req: Request, res: Response, next: NextFunction) =>
  parse(req, res, (err?: unknown) => (err ? next(new AppError(413, "The file is too big (5 MB at most)")) : next()));
