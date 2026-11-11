import { asyncHandler, idParam } from "../../../../utils/asyncHandler/index.js";
import { AppError } from "../../../../utils/AppError/index.js";
import * as Enrolments from "./enrolments.model.js";

const idOf = (v: string | string[] | undefined) => {
  const id = idParam(v);
  if (!id) throw new AppError(404, "Subject not found");
  return id;
};

export const update = asyncHandler(async (req, res) => void res.json(await Enrolments.update(idOf(req.params.id), req.body)));
export const remove = asyncHandler(async (req, res) => void res.json({ deleted: true, ...(await Enrolments.remove(idOf(req.params.id))) }));
