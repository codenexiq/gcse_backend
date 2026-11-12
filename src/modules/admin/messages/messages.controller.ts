import { asyncHandler, idParam } from "../../../utils/asyncHandler/index.js";
import { AppError } from "../../../utils/AppError/index.js";
import * as Messages from "./messages.model.js";

const pair = (req: { params: Record<string, string | string[] | undefined> }) => {
  const [student, staff] = String(req.params.key ?? "").split("-").map((x) => idParam(x));
  if (!student || !staff) throw new AppError(404, "Conversation not found");
  return { student, staff };
};

export const threads = asyncHandler(async (_req, res) => void res.json(await Messages.threads()));
export const thread = asyncHandler(async (req, res) => {
  const { student, staff } = pair(req);
  res.json(await Messages.thread(student, staff));
});
export const send = asyncHandler(async (req, res) => {
  const { student, staff } = pair(req);
  res.status(201).json(await Messages.send(student, staff, req.user!.id, req.body));
});
