import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../utils/AppError/index.js";
import * as Diagnostic from "./diagnostic.model.js";
import { generateMathsQuestions, isMaths, topicCatalog } from "./diagnostic.maths.js";
import { idParamSchema, type GenerateInput, type QuestionInput } from "./diagnostic.schemas.js";

function parseId(req: Request) {
  const id = idParamSchema.safeParse(req.params.id);
  if (!id.success) throw new AppError(400, "Invalid id");
  return id.data;
}

async function checkSubject(q: QuestionInput) {
  if (!(await Diagnostic.subjectExists(q.subjectId))) throw new AppError(400, "That subject does not exist");
}

export async function listQuestions(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await Diagnostic.listAll());
  } catch (err) {
    next(err);
  }
}

export async function createQuestion(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as QuestionInput;
    await checkSubject(body);
    res.status(201).json(await Diagnostic.create(body));
  } catch (err) {
    next(err);
  }
}

export async function updateQuestion(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as QuestionInput;
    await checkSubject(body);
    const question = await Diagnostic.update(parseId(req), body);
    if (!question) throw new AppError(404, "Question not found");
    res.json(question);
  } catch (err) {
    next(err);
  }
}

export async function deleteQuestion(req: Request, res: Response, next: NextFunction) {
  try {
    if (!(await Diagnostic.remove(parseId(req)))) throw new AppError(404, "Question not found");
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

/** The topics the free built-in generator can write. */
export function listTopics(req: Request, res: Response) {
  res.json(topicCatalog());
}

/** One click: the built-in (free) generator writes the questions and they are saved straight away. */
export async function generateAndSave(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as GenerateInput;
    const subjectName = await Diagnostic.subjectName(body.subjectId);
    if (!subjectName) throw new AppError(400, "That subject does not exist");
    if (!isMaths(subjectName)) {
      throw new AppError(400, `The free generator can only write Maths questions. Use "New question" to write ${subjectName} questions yourself.`);
    }

    const drafts = generateMathsQuestions({
      level: body.level,
      tier: body.tier,
      topic: body.topic,
      count: body.count,
      existing: await Diagnostic.existingQuestionTexts(body.level, body.subjectId),
    });

    const saved = [];
    for (const d of drafts) saved.push(await Diagnostic.create({ ...d, subjectId: body.subjectId }));
    res.status(201).json(saved);
  } catch (err) {
    next(err);
  }
}
