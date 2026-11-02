import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../utils/AppError/index.js";
import * as LessonLog from "./lessonLog.model.js";
import type { LessonLogInput } from "./lessonLog.schemas.js";

export async function createEntry(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const input = req.body as LessonLogInput;
    // The name on the form starts as the account's own name.
    res.status(201).json(await LessonLog.create(user.id, { ...input, tutorName: input.tutorName || user.fullName }));
  } catch (err) {
    next(err);
  }
}

export async function listEntries(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await LessonLog.list(req.user!));
  } catch (err) {
    next(err);
  }
}

export async function deleteEntry(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0 || !(await LessonLog.remove(id))) throw new AppError(404, "Entry not found");
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
}
