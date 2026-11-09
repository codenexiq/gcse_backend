import type { NextFunction, Request, Response } from "express";
import * as Home from "./studentHome.model.js";

export async function readMyHome(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await Home.forStudent(req.user!.id));
  } catch (err) {
    next(err);
  }
}
