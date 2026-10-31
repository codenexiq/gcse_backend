import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../utils/AppError/index.js";
import * as Content from "./content.model.js";
import type { ContentUpdate } from "./content.schemas.js";

export async function readContent(req: Request, res: Response, next: NextFunction) {
  try {
    const content = await Content.getContent();
    if (!content) throw new AppError(404, "Content not found");
    res.json(content);
  } catch (err) {
    next(err);
  }
}

export async function saveContent(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await Content.updateContent(req.body as ContentUpdate));
  } catch (err) {
    next(err);
  }
}
