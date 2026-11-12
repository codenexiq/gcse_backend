import { asyncHandler, idParam } from "../../../utils/asyncHandler/index.js";
import { AppError } from "../../../utils/AppError/index.js";
import * as Today from "./today.model.js";

export const get = asyncHandler(async (req, res) => {
  const week = Math.max(-52, Math.min(52, Math.round(Number(req.query.week) || 0)));
  res.json(await Today.today(req.user!.id, week));
});
export const book = asyncHandler(async (req, res) => void res.status(201).json(await Today.book(req.user!.id, req.body)));
export const logForm = asyncHandler(async (req, res) => {
  const id = idParam(req.params.id);
  if (!id) throw new AppError(404, "Session not found");
  res.json(await Today.logForm(req.user!.id, id));
});
export const saveLog = asyncHandler(async (req, res) => {
  await Today.saveLog(req.user!.id, req.body);
  res.status(201).json({ saved: true });
});
