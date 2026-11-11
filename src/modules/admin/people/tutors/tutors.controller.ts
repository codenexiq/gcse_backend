import { asyncHandler, idParam } from "../../../../utils/asyncHandler/index.js";
import { AppError } from "../../../../utils/AppError/index.js";
import * as Tutors from "./tutors.model.js";

export const list = asyncHandler(async (_req, res) => void res.json(await Tutors.list()));
export const create = asyncHandler(async (_req, res) => void res.status(201).json(await Tutors.create()));
export const update = asyncHandler(async (req, res) => {
  const id = idParam(req.params.id);
  if (!id) throw new AppError(404, "Tutor not found");
  res.json(await Tutors.update(id, req.body));
});
