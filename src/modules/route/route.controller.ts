import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../utils/AppError/index.js";
import * as Chat from "../chat/chat.model.js";
import * as Route from "./route.model.js";
import type { UpdateInput } from "./route.schemas.js";

function idOf(value: string | string[], what: string) {
  const id = Number(Array.isArray(value) ? value[0] : value);
  if (!Number.isInteger(id) || id <= 0) throw new AppError(404, `${what} not found`);
  return id;
}

const wrap = (fn: (req: Request, res: Response) => Promise<void>) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    await fn(req, res);
  } catch (err) {
    next(err);
  }
};

/** A message from the tutor, in the chat the two already share (or a new one), telling a student they have a new route. */
async function tell(studentIds: number[], tutorId: number, routeName: string) {
  for (const studentId of studentIds) {
    try {
      await Chat.addMessage({ studentId, staffId: tutorId }, tutorId, `I've added a learning route for you: ${routeName}. Your tasks are on your learning map.`, undefined);
    } catch {
      // A message that can not be sent must not undo the assignment.
    }
  }
}

export const list = wrap(async (_req, res) => void res.json(await Route.list()));
export const library = wrap(async (_req, res) => void res.json(await Route.library()));

export const create = wrap(async (req, res) => {
  const { name, description } = req.body as { name: string; description: string };
  res.status(201).json(await Route.create(req.user!.id, name, description));
});

export const update = wrap(async (req, res) => {
  const saved = await Route.update(idOf(req.params.id, "Route"), req.body as UpdateInput);
  if (!saved) throw new AppError(404, "Route not found");
  await tell(saved.added, req.user!.id, saved.route.name);
  res.json(saved.route);
});

export const remove = wrap(async (req, res) => {
  if (!(await Route.remove(idOf(req.params.id, "Route")))) throw new AppError(404, "Route not found");
  res.json({ deleted: true });
});

export const assign = wrap(async (req, res) => {
  const routeId = idOf(req.params.id, "Route");
  const studentId = idOf(req.params.studentId, "Student");
  const route = await Route.find(routeId);
  if (!route) throw new AppError(404, "Route not found");
  if ((await Chat.roleOf(studentId)) !== "student") throw new AppError(404, "Student not found");
  if (await Route.assign(routeId, studentId)) await tell([studentId], req.user!.id, route.name);
  res.json({ assigned: true });
});

export const unassign = wrap(async (req, res) => {
  await Route.unassign(idOf(req.params.id, "Route"), idOf(req.params.studentId, "Student"));
  res.json({ removed: true });
});
