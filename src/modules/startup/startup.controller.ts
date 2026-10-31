import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../utils/AppError/index.js";
import * as Startup from "./startup.model.js";
import { idParamSchema, type NewOption } from "./startup.schemas.js";

const isDuplicate = (err: unknown) => (err as { code?: string } | null)?.code === "ER_DUP_ENTRY";

function parseId(req: Request) {
  const id = idParamSchema.safeParse(req.params.id);
  if (!id.success) throw new AppError(400, "Invalid id");
  return id.data;
}

export async function listOptions(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await Startup.listAll());
  } catch (err) {
    next(err);
  }
}

export async function createOption(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await Startup.create(req.body as NewOption));
  } catch (err) {
    next(isDuplicate(err) ? new AppError(409, "That choice already exists") : err);
  }
}

export async function updateOption(req: Request, res: Response, next: NextFunction) {
  try {
    const option = await Startup.rename(parseId(req), (req.body as { label: string }).label);
    if (!option) throw new AppError(404, "Choice not found");
    res.json(option);
  } catch (err) {
    next(isDuplicate(err) ? new AppError(409, "That choice already exists") : err);
  }
}

export async function deleteOption(req: Request, res: Response, next: NextFunction) {
  try {
    if (!(await Startup.remove(parseId(req)))) throw new AppError(404, "Choice not found");
    res.status(204).end();
  } catch (err) {
    // A subject that diagnostic questions use is protected by a foreign key.
    next((err as { code?: string } | null)?.code === "ER_ROW_IS_REFERENCED_2" ? new AppError(409, "Diagnostic questions use this subject. Delete those questions first.") : err);
  }
}
