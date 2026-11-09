import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../utils/AppError/index.js";
import * as Lesson from "./lesson.model.js";
import type { Block, FinishInput } from "./lesson.schemas.js";

function lessonId(req: Request) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new AppError(404, "Lesson not found");
  return id;
}

async function open(req: Request) {
  const lesson = await Lesson.find(lessonId(req));
  if (!lesson) throw new AppError(404, "Lesson not found");
  return lesson;
}

/** A published lesson with something in it (anything else looks like it does not exist to a student). */
async function openForStudent(req: Request) {
  const lesson = await open(req);
  if (!lesson.published || lesson.blocks.length === 0) throw new AppError(404, "Lesson not found");
  return lesson;
}

const wrap = (fn: (req: Request, res: Response) => Promise<void>) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    await fn(req, res);
  } catch (err) {
    next(err);
  }
};

export const summary = wrap(async (_req, res) => void res.json(await Lesson.summary()));

export const listForTopic = wrap(async (req, res) => {
  const topic = String(req.query.topic ?? "");
  if (!topic) throw new AppError(400, "Choose a topic");
  res.json(await Lesson.listForTopic(topic));
});

export const getOne = wrap(async (req, res) => void res.json(await open(req)));

export const create = wrap(async (req, res) => {
  const { topic, title } = req.body as { topic: string; title: string };
  res.status(201).json(await Lesson.create(req.user!.id, topic, title));
});

export const update = wrap(async (req, res) => {
  await open(req);
  const { title, published, blocks } = req.body as { title: string; published: boolean; blocks: Block[] };
  res.json(await Lesson.update(lessonId(req), title, published, blocks));
});

export const remove = wrap(async (req, res) => {
  await open(req);
  await Lesson.remove(lessonId(req));
  res.json({ deleted: true });
});

export const studentGet = wrap(async (req, res) => void res.json(Lesson.forStudent(await openForStudent(req))));

export const studentCheck = wrap(async (req, res) => {
  const { blockId, choice } = req.body as { blockId: string; choice: number };
  res.json(Lesson.check(await openForStudent(req), blockId, choice));
});

export const studentScheme = wrap(async (req, res) => {
  res.json(Lesson.scheme(await openForStudent(req), String(req.query.blockId ?? "")));
});

export const studentFinish = wrap(async (req, res) => {
  res.json(await Lesson.finish(req.user!.id, await openForStudent(req), req.body as FinishInput));
});

export const bank = wrap(async (req, res) => {
  const topic = typeof req.query.topic === "string" && req.query.topic.trim() ? req.query.topic.trim().slice(0, 100) : null;
  res.json(await Lesson.bank(topic));
});
