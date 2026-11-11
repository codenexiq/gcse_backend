import { asyncHandler, idParam } from "../../../../utils/asyncHandler/index.js";
import { AppError } from "../../../../utils/AppError/index.js";
import * as Groups from "./groups.model.js";

const idOf = (v: string | string[] | undefined) => {
  const id = idParam(v);
  if (!id) throw new AppError(404, "Group not found");
  return id;
};

export const list = asyncHandler(async (_req, res) => void res.json(await Groups.list()));
export const create = asyncHandler(async (_req, res) => void res.status(201).json(await Groups.create()));
export const update = asyncHandler(async (req, res) => void res.json(await Groups.update(idOf(req.params.id), req.body)));
export const addSessions = asyncHandler(async (req, res) => void res.json(await Groups.addSessions(idOf(req.params.id))));
