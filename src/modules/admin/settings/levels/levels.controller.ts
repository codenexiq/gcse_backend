import { asyncHandler } from "../../../../utils/asyncHandler/index.js";
import * as Levels from "./levels.model.js";

const idOf = (v: string | string[] | undefined) => String(Array.isArray(v) ? v[0] : (v ?? ""));

export const list = asyncHandler(async (_req, res) => void res.json(await Levels.list()));
export const create = asyncHandler(async (req, res) => void res.status(201).json(await Levels.create(req.body.name)));
export const update = asyncHandler(async (req, res) => void res.json(await Levels.update(idOf(req.params.id), req.body)));
export const remove = asyncHandler(async (req, res) => {
  await Levels.remove(idOf(req.params.id));
  res.json({ deleted: true });
});
