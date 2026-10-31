import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../utils/AppError/index.js";
import { topicExists } from "../subjects/subject.model.js";
import * as Item from "./item.model.js";
import type { NewItem } from "./item.schemas.js";

export async function getItems(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await Item.findAllByUser(req.user!.id)); // authenticate() guarantees req.user
  } catch (err) {
    next(err);
  }
}

export async function createItem(req: Request, res: Response, next: NextFunction) {
  try {
    // req.body was already validated and cleaned by the validate() middleware.
    const body = req.body as NewItem;
    if (body.topicId && !(await topicExists(body.topicId))) {
      throw new AppError(400, "That topic does not exist");
    }
    res.status(201).json(await Item.create(req.user!.id, body));
  } catch (err) {
    next(err);
  }
}
