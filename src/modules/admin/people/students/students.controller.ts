import { asyncHandler, idParam } from "../../../../utils/asyncHandler/index.js";
import { AppError } from "../../../../utils/AppError/index.js";
import * as Students from "./students.model.js";

const idOf = (v: string | string[] | undefined) => {
  const id = idParam(v);
  if (!id) throw new AppError(404, "Student not found");
  return id;
};

export const list = asyncHandler(async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  res.json(await Students.list(q));
});
export const create = asyncHandler(async (_req, res) => void res.status(201).json(await Students.create()));
export const get = asyncHandler(async (req, res) => void res.json(await Students.detail(idOf(req.params.id))));
export const update = asyncHandler(async (req, res) => void res.json(await Students.update(idOf(req.params.id), req.body)));
export const remove = asyncHandler(async (req, res) => {
  await Students.remove(idOf(req.params.id));
  res.json({ deleted: true });
});
export const addEnrolment = asyncHandler(async (req, res) => void res.status(201).json(await Students.addEnrolment(idOf(req.params.id), req.body.subjectId)));

/** There is no email service yet, so this only says what the real app will do. */
export const passwordReset = asyncHandler(async (req, res) => {
  const student = await Students.detail(idOf(req.params.id));
  res.json({ sent: false, message: `In the real app this emails a reset link to ${student.email || "the student"}.` });
});
