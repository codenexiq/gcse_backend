import { asyncHandler, idParam } from "../../../utils/asyncHandler/index.js";
import { AppError } from "../../../utils/AppError/index.js";
import * as Students from "./students.model.js";

const idOf = (v: string | string[] | undefined, what = "Student") => {
  const id = idParam(v);
  if (!id) throw new AppError(404, `${what} not found`);
  return id;
};

export const list = asyncHandler(async (req, res) => void res.json(await Students.list(req.user!.id)));
export const profile = asyncHandler(async (req, res) => void res.json(await Students.profile(req.user!.id, idOf(req.params.id))));
export const update = asyncHandler(async (req, res) => {
  await Students.updateEnrolment(req.user!.id, idOf(req.params.id), req.body);
  res.json({ saved: true });
});
export const cycle = asyncHandler(async (req, res) => {
  res.json({ status: await Students.cycleTopic(req.user!.id, idOf(req.params.id), idOf(req.params.topicId, "Topic")) });
});
