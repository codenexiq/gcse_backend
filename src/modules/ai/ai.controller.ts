import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../utils/AppError/index.js";
import * as Lesson from "../lesson/lesson.model.js";
import type { FinishInput } from "../lesson/lesson.schemas.js";
import * as Ai from "./ai.service.js";

const wrap = (fn: (req: Request, res: Response) => Promise<void>) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    await fn(req, res);
  } catch (err) {
    next(err);
  }
};

const idOf = (value: string | string[], what: string) => {
  const id = Number(Array.isArray(value) ? value[0] : value);
  if (!Number.isInteger(id) || id <= 0) throw new AppError(404, `${what} not found`);
  return id;
};

/** A published lesson a student may open. */
async function lessonFor(req: Request) {
  const lesson = await Lesson.find(idOf(req.params.id, "Lesson"));
  if (!lesson || !lesson.published || lesson.blocks.length === 0) throw new AppError(404, "Lesson not found");
  return lesson;
}

export const status = wrap(async (_req, res) => void res.json({ enabled: Ai.aiEnabled() }));

export const mark = wrap(async (req, res) => {
  const lesson = await lessonFor(req);
  const { blockId, answer } = req.body as { blockId: string; answer: string };
  const block = lesson.blocks.find((b) => b.id === blockId);
  if (!block || block.type !== "written") throw new AppError(400, "That is not a written question");
  Ai.takeTurn(req.user!.id);
  res.json(await Ai.markWritten({ topic: lesson.topic, question: block.question, markScheme: block.markScheme, marks: block.marks, answer }));
});

export const genie = wrap(async (req, res) => {
  const lesson = await lessonFor(req);
  const { blockId, question, answered } = req.body as { blockId: string; question: string; answered: boolean };
  const block = lesson.blocks.find((b) => b.id === blockId);
  if (!block) throw new AppError(400, "That part of the lesson was not found");
  Ai.takeTurn(req.user!.id);
  res.json({ answer: await Ai.genie({ topic: lesson.topic, block, answered, question }) });
});

/** Makes a fresh practice set on a topic for the student. */
export const practice = wrap(async (req, res) => {
  const { topic } = req.body as { topic: string };
  Ai.takeTurn(req.user!.id);
  const blocks = await Ai.practiceSet(topic);
  res.status(201).json({ id: await Lesson.createPractice(req.user!.id, topic, blocks) });
});

async function setFor(req: Request) {
  const set = await Lesson.findPractice(idOf(req.params.id, "Practice set"), req.user!.id);
  if (!set) throw new AppError(404, "Practice set not found");
  return set;
}

export const practiceGet = wrap(async (req, res) => void res.json(Lesson.forStudent(await setFor(req))));
export const practiceCheck = wrap(async (req, res) => {
  const { blockId, choice } = req.body as { blockId: string; choice: number };
  res.json(Lesson.check(await setFor(req), blockId, choice));
});
export const practiceFinish = wrap(async (req, res) => void res.json(await Lesson.finish(req.user!.id, { ...(await setFor(req)), id: null }, req.body as FinishInput)));

export const redesign = wrap(async (req, res) => {
  const { topic, slides } = req.body as { topic: string; slides: string[][] };
  Ai.takeTurn(req.user!.id);
  res.json({ blocks: await Ai.redesign(topic, slides) });
});

export const questions = wrap(async (req, res) => {
  const { topic, slides } = req.body as { topic: string; slides: { title: string; body: string }[] };
  Ai.takeTurn(req.user!.id);
  res.json({ questions: await Ai.questionsFor(topic, slides) });
});

export const quiz = wrap(async (req, res) => {
  Ai.takeTurn(req.user!.id);
  res.json({ blocks: await Ai.quizFor(req.body as { topic: string; tier: string; n: number; mix: string; focus: string }) });
});

export const pdf = wrap(async (req, res) => {
  Ai.takeTurn(req.user!.id);
  res.json({ blocks: await Ai.fromPdf(req.body as { topic: string; mode: "quiz" | "notes"; pdf: string }) });
});
