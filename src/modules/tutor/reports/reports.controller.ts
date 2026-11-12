import { asyncHandler, idParam } from "../../../utils/asyncHandler/index.js";
import { AppError } from "../../../utils/AppError/index.js";
import * as Reports from "./reports.model.js";

const idOf = (v: string | string[] | undefined) => {
  const id = idParam(v);
  if (!id) throw new AppError(404, "Student not found");
  return id;
};

export const get = asyncHandler(async (req, res) => void res.json(await Reports.forEnrolment(req.user!.id, idOf(req.params.id))));

export const send = asyncHandler(async (req, res) => {
  await Reports.send(req.user!.id, idOf(req.params.id), req.body.text);
  res.json({ sent: true });
});
