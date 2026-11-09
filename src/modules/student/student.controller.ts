import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../utils/AppError/index.js";
import * as Student from "./student.model.js";
import type { ProfileInput, SubmitInput } from "./student.schemas.js";

export async function readOptions(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await Student.listOptions());
  } catch (err) {
    next(err);
  }
}

export async function readContent(req: Request, res: Response, next: NextFunction) {
  try {
    const content = await Student.getContent();
    if (!content) throw new AppError(404, "Content not found");
    res.json(content);
  } catch (err) {
    next(err);
  }
}

export async function readProfile(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await Student.getProfile(req.user!.id)); // null until the student fills in About you
  } catch (err) {
    next(err);
  }
}

export async function saveProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as ProfileInput;
    if (!(await Student.optionsAreValid(body))) throw new AppError(400, "Please choose from the lists");
    res.json(await Student.saveProfile(req.user!.id, body));
  } catch (err) {
    next(err);
  }
}

/** The profile and the number of questions, or an error telling the student to fill in About you first. */
async function diagnosticSetup(userId: number) {
  const profile = await Student.getProfile(userId);
  if (!profile || !profile.subjectId) throw new AppError(409, "Please complete the About you screen first");
  const content = await Student.getContent();
  return { profile, limit: content?.questions ?? 10 };
}

export async function readDiagnostic(req: Request, res: Response, next: NextFunction) {
  try {
    const { profile, limit } = await diagnosticSetup(req.user!.id);
    res.json(await Student.diagnosticFor(profile, limit));
  } catch (err) {
    next(err);
  }
}

export async function submitDiagnostic(req: Request, res: Response, next: NextFunction) {
  try {
    const { profile, limit } = await diagnosticSetup(req.user!.id);
    res.status(201).json(await Student.gradeAndSave(req.user!.id, profile, limit, (req.body as SubmitInput).answers));
  } catch (err) {
    next(err);
  }
}

/** The most recent result (or null), so the Diagnostic screen can show it again. */
export async function readResult(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await Student.latestResult(req.user!.id));
  } catch (err) {
    next(err);
  }
}

export async function readProgress(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await Student.progress(req.user!.id));
  } catch (err) {
    next(err);
  }
}
