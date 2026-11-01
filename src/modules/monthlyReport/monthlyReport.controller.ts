import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../utils/AppError/index.js";
import * as Reports from "./monthlyReport.model.js";

// Tutor / admin: send a report to a student.
export async function sendReport(req: Request, res: Response, next: NextFunction) {
  try {
    const sent = await Reports.send(req.user!.id, req.body);
    if (!sent) throw new AppError(404, "Student not found");
    res.status(201).json(sent);
  } catch (err) {
    next(err);
  }
}

// Student: only their own reports, read-only.
export async function listMine(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await Reports.listForStudent(req.user!.id));
  } catch (err) {
    next(err);
  }
}

export async function readMine(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new AppError(404, "Report not found");
    const report = await Reports.getForStudent(req.user!.id, id);
    if (!report) throw new AppError(404, "Report not found");
    res.json(report);
  } catch (err) {
    next(err);
  }
}

// Tutor / admin: the table of every report, and one report to read.
export async function listAllReports(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await Reports.listAll());
  } catch (err) {
    next(err);
  }
}

export async function readReport(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new AppError(404, "Report not found");
    const report = await Reports.getOne(id);
    if (!report) throw new AppError(404, "Report not found");
    res.json(report);
  } catch (err) {
    next(err);
  }
}
