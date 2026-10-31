import type { NextFunction, Request, Response } from "express";
import * as Tutor from "./tutor.model.js";

export async function getOverview(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await Tutor.overview());
  } catch (err) {
    next(err);
  }
}

export async function getStudents(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await Tutor.listStudents());
  } catch (err) {
    next(err);
  }
}

export async function getTutorAccounts(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await Tutor.listTutor());
  } catch (err) {
    next(err);
  }
}
