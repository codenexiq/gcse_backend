import type { NextFunction, Request, Response } from "express";
import * as Subject from "./subject.model.js";

export async function getSubjects(req: Request, res: Response, next: NextFunction) {
  try {
    // Public, non-personal data: browsers and shared caches may reuse it for 1 hour.
    // Express adds an ETag, so after that a repeat request is just a tiny "304 Not Modified".
    res.set("Cache-Control", "public, max-age=3600");
    res.json(await Subject.findAllWithTopics());
  } catch (err) {
    next(err);
  }
}
