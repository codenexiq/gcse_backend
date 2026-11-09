import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../utils/AppError/index.js";
import * as Chat from "../chat/chat.model.js";
import * as Group from "./group.model.js";
import type { AssignInput, GroupInput } from "./group.schemas.js";

const idOf = (value: string | string[] | undefined, what: string) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new AppError(404, `${what} not found`);
  return id;
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const clock = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}${m === 0 ? "" : `:${String(m).padStart(2, "0")}`} ${h < 12 ? "am" : "pm"}`;
};

export async function listGroups(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await Group.list());
  } catch (err) {
    next(err);
  }
}

export async function createGroup(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await Group.create(req.user!.id, req.body as GroupInput));
  } catch (err) {
    next(err);
  }
}

export async function updateGroup(req: Request, res: Response, next: NextFunction) {
  try {
    const group = await Group.update(idOf(req.params.id, "Group"), req.body as GroupInput);
    if (!group) throw new AppError(404, "Group not found");
    res.json(group);
  } catch (err) {
    next(err);
  }
}

export async function deleteGroup(req: Request, res: Response, next: NextFunction) {
  try {
    if (!(await Group.remove(idOf(req.params.id, "Group")))) throw new AppError(404, "Group not found");
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
}

/** Places a student in a group and tells them in their chat. */
export async function assignStudent(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = idOf(req.params.id, "Student");
    if ((await Chat.roleOf(studentId)) !== "student") throw new AppError(404, "Student not found");
    const body = req.body as AssignInput;
    const group = await Group.assign(studentId, body.groupId, body.note, body.sendVideo, req.user!.id);
    // A message from the tutor, in the chat the two of them already share (or a new one).
    const first = ((await Chat.getPeerCard(studentId, false))?.fullName ?? "").trim().split(/\s+/)[0] || "there";
    const text =
      `Hi ${first}, you're in the ${group.name} (${DAYS[group.dayOfWeek]}s, ${clock(group.startTime)} to ${clock(group.endTime)}). ` +
      `Zoom: ${group.zoomLink}` +
      (body.note ? `\n\n${body.note}` : "") +
      (body.sendVideo ? "\n\nI'll send you a short video to watch before the session." : "");
    await Chat.addMessage({ studentId, staffId: req.user!.id }, req.user!.id, text, undefined);
    res.json({ group });
  } catch (err) {
    next(err);
  }
}

export async function removeStudent(req: Request, res: Response, next: NextFunction) {
  try {
    if (!(await Group.unassign(idOf(req.params.id, "Student")))) throw new AppError(404, "That student is not in a group");
    res.json({ removed: true });
  } catch (err) {
    next(err);
  }
}

/** For the student: their own group, or null. */
export async function readMyGroup(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await Group.forStudent(req.user!.id));
  } catch (err) {
    next(err);
  }
}
