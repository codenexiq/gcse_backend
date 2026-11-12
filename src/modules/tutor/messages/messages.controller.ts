import { asyncHandler, idParam } from "../../../utils/asyncHandler/index.js";
import { AppError } from "../../../utils/AppError/index.js";
import * as Messages from "./messages.model.js";

const idOf = (v: string | string[] | undefined, what: string) => {
  const id = idParam(v);
  if (!id) throw new AppError(404, `${what} not found`);
  return id;
};

export const threads = asyncHandler(async (req, res) => void res.json(await Messages.threads(req.user!.id)));
export const thread = asyncHandler(async (req, res) => void res.json(await Messages.thread(req.user!.id, idOf(req.params.id, "Conversation"))));
export const send = asyncHandler(async (req, res) => void res.status(201).json(await Messages.send(req.user!.id, idOf(req.params.id, "Conversation"), req.body)));
export const open = asyncHandler(async (req, res) => void res.json(await Messages.open(req.user!.id, Number(req.body.studentId))));
