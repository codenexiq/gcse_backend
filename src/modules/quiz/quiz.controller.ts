import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../utils/AppError/index.js";
import * as Quiz from "./quiz.model.js";
import { DIAGRAM_KEY, parseQuizFile, type AttemptInput } from "./quiz.schemas.js";

function quizId(req: Request) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new AppError(404, "Quiz not found");
  return id;
}

/** A quiz the person is allowed to open: students only see published ones (anything else looks like it does not exist). */
async function openable(req: Request) {
  const quiz = await Quiz.find(quizId(req));
  if (!quiz || (req.user!.role === "student" && !quiz.published)) throw new AppError(404, "Quiz not found");
  return quiz;
}

/** Only an admin, or the tutor who uploaded it, changes or removes a quiz. */
function mayManage(req: Request, createdBy: number) {
  return req.user!.role === "admin" || req.user!.id === createdBy;
}

export async function uploadQuiz(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = parseQuizFile(req.body);
    // ?dryRun=1 only checks the file with the real rules and says what it contains. Nothing is saved.
    if (req.query.dryRun === "1") {
      res.json({
        dryRun: true,
        title: parsed.title,
        subtitle: parsed.subtitle,
        questionCount: parsed.content.questions.length,
        totalMarks: parsed.content.questions.reduce((sum, q) => sum + q.marks, 0),
        diagrams: Object.keys(parsed.diagrams).length,
        diagramBytes: Object.values(parsed.diagrams).reduce((sum, svg) => sum + Buffer.byteLength(svg), 0),
      });
      return;
    }
    // ?draft=1 saves it hidden from students, so a tutor can check it and publish it later.
    res.status(201).json(await Quiz.create(req.user!.id, parsed, req.query.draft !== "1"));
  } catch (err) {
    next(err);
  }
}

export async function listQuizzes(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await Quiz.list(req.user!));
  } catch (err) {
    next(err);
  }
}

export async function getQuiz(req: Request, res: Response, next: NextFunction) {
  try {
    const quiz = await openable(req);
    res.json(req.user!.role === "student" ? Quiz.forStudent(quiz) : Quiz.forTutor(quiz));
  } catch (err) {
    next(err);
  }
}

export async function submitAttempt(req: Request, res: Response, next: NextFunction) {
  try {
    const quiz = await openable(req);
    res.status(201).json(await Quiz.submitAttempt(req.user!.id, quiz, (req.body as AttemptInput).answers));
  } catch (err) {
    next(err);
  }
}

export async function listAttempts(req: Request, res: Response, next: NextFunction) {
  try {
    const quiz = await openable(req);
    res.json(await Quiz.listAttempts(quiz.id, req.user!));
  } catch (err) {
    next(err);
  }
}

export async function setPublished(req: Request, res: Response, next: NextFunction) {
  try {
    const quiz = await openable(req);
    if (!mayManage(req, quiz.createdBy)) throw new AppError(403, "Only an admin or the tutor who uploaded this quiz can change it");
    await Quiz.setPublished(quiz.id, (req.body as { published: boolean }).published);
    res.json({ published: (req.body as { published: boolean }).published });
  } catch (err) {
    next(err);
  }
}

export async function deleteQuiz(req: Request, res: Response, next: NextFunction) {
  try {
    const quiz = await openable(req);
    if (!mayManage(req, quiz.createdBy)) throw new AppError(403, "Only an admin or the tutor who uploaded this quiz can delete it");
    await Quiz.remove(quiz.id);
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
}

/** One picture of a quiz, to be shown with <img>. Served as an image under a policy that blocks scripts even if the address is opened on its own. */
export async function getDiagram(req: Request, res: Response, next: NextFunction) {
  try {
    const quiz = await openable(req);
    const key = String(req.params.key);
    const svg = DIAGRAM_KEY.test(key) ? await Quiz.findDiagram(quiz.id, key) : null;
    if (svg === null) throw new AppError(404, "Diagram not found");
    res.set({
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=3600",
    });
    res.send(svg);
  } catch (err) {
    next(err);
  }
}
