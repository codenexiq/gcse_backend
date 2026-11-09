import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../utils/AppError/index.js";
import * as Review from "./studentReview.model.js";

export async function listWaiting(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await Review.waiting());
  } catch (err) {
    next(err);
  }
}

export async function getReview(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new AppError(404, "Student not found");
    const found = await Review.review(id);
    if (!found) throw new AppError(404, "Student not found");
    res.json(found);
  } catch (err) {
    next(err);
  }
}

export async function getOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new AppError(404, "Student not found");
    const found = await Review.overview(id);
    if (!found) throw new AppError(404, "Student not found");
    res.json(found);
  } catch (err) {
    next(err);
  }
}

export async function getMonthReport(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const month = String(req.query.month ?? "");
    if (!Number.isInteger(id) || id <= 0 || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new AppError(400, "Choose a month");
    const found = await Review.monthReport(id, month);
    if (!found) throw new AppError(404, "Student not found");
    res.json(found);
  } catch (err) {
    next(err);
  }
}
