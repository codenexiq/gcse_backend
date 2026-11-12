import { asyncHandler, idParam } from "../../utils/asyncHandler/index.js";
import { AppError } from "../../utils/AppError/index.js";
import * as Diagnostic from "./diagnostic/diagnostic.model.js";
import * as Home from "./home/home.model.js";
import * as Practice from "./practice/practice.model.js";
import * as Learn from "./learn/learn.model.js";
import * as Messages from "./messages/messages.model.js";

const idOf = (v: unknown, what = "Not found") => {
  const id = idParam(typeof v === "string" ? v : undefined);
  if (!id) throw new AppError(404, what);
  return id;
};
const enrolmentOf = (req: { query: Record<string, unknown> }) => idOf(req.query.enrolment);

export const summary = asyncHandler(async (req, res) => void res.json({ name: req.user!.fullName, unread: await Messages.unread(req.user!.id) }));
export const home = asyncHandler(async (req, res) => {
  const wanted = idParam(typeof req.query.enrolment === "string" ? req.query.enrolment : undefined) || undefined;
  res.json(await Home.home(req.user!.id, wanted));
});
export const topic = asyncHandler(async (req, res) => void res.json(await Home.topic(req.user!.id, enrolmentOf(req), idOf(req.params.id))));
export const diagnosticGet = asyncHandler(async (req, res) => void res.json(await Diagnostic.get(req.user!.id, idOf(req.params.id))));
export const diagnostic = asyncHandler(async (req, res) => void res.status(201).json(await Diagnostic.submit(req.user!.id, idOf(req.params.id), req.body)));
export const practice = asyncHandler(async (req, res) => void res.json(await Practice.bank(req.user!.id, enrolmentOf(req), idOf(req.params.id))));
export const practiceResult = asyncHandler(async (req, res) => void res.status(201).json(await Practice.result(req.user!.id, req.body.enrolmentId, idOf(req.params.id), req.body.got, req.body.max)));
export const item = asyncHandler(async (req, res) => void res.json(await Learn.item(req.user!.id, enrolmentOf(req), idOf(req.params.id))));
export const finish = asyncHandler(async (req, res) => void res.json(await Learn.finish(req.user!.id, req.body.enrolmentId, idOf(req.params.id), req.body)));
export const threads = asyncHandler(async (req, res) => void res.json(await Messages.threads(req.user!.id)));
export const thread = asyncHandler(async (req, res) => void res.json(await Messages.thread(req.user!.id, idOf(req.params.id, "Conversation not found"))));
export const send = asyncHandler(async (req, res) => void res.status(201).json(await Messages.send(req.user!.id, idOf(req.params.id, "Conversation not found"), req.body)));
