import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../utils/AppError/index.js";
import * as LearningMap from "./learningMap.model.js";

export async function readMyMap(req: Request, res: Response, next: NextFunction) {
  try {
    const map = await LearningMap.forStudent(req.user!.id);
    if (!map) throw new AppError(404, "Student not found");
    res.json(map);
  } catch (err) {
    next(err);
  }
}
