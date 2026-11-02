import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../utils/AppError/index.js";
import { ALLOWED_EXTENSIONS, MAX_FILE_BYTES } from "../chat/chat.schemas.js";
import * as Groups from "./chatGroup.model.js";

/** The group named in the address, if this person may open it (otherwise it "does not exist" for them). */
async function openGroup(req: Request): Promise<number> {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0 || !(await Groups.canAccess(req.user!, id))) throw new AppError(404, "Group not found");
  return id;
}

const onlyAdmin = (req: Request) => {
  if (req.user!.role !== "admin") throw new AppError(403, "Only an administrator can do this");
};

export async function listGroups(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await Groups.listGroups(req.user!));
  } catch (err) {
    next(err);
  }
}

export async function createGroup(req: Request, res: Response, next: NextFunction) {
  try {
    onlyAdmin(req);
    const { name, description, studentIds } = req.body as { name: string; description: string; studentIds: number[] };
    const id = await Groups.createGroup(req.user!.id, name, description, studentIds);
    res.status(201).json(await Groups.getGroup(id));
  } catch (err) {
    next(err);
  }
}

export async function readGroup(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await Groups.getGroup(await openGroup(req)));
  } catch (err) {
    next(err);
  }
}

export async function updateGroup(req: Request, res: Response, next: NextFunction) {
  try {
    onlyAdmin(req);
    const id = await openGroup(req);
    await Groups.updateGroup(id, req.body.name, req.body.description);
    res.json(await Groups.getGroup(id));
  } catch (err) {
    next(err);
  }
}

export async function addMembers(req: Request, res: Response, next: NextFunction) {
  try {
    onlyAdmin(req);
    const id = await openGroup(req);
    await Groups.addMembers(id, req.body.studentIds);
    res.json(await Groups.getGroup(id));
  } catch (err) {
    next(err);
  }
}

export async function removeMember(req: Request, res: Response, next: NextFunction) {
  try {
    onlyAdmin(req);
    const id = await openGroup(req);
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || !(await Groups.removeMember(id, userId))) throw new AppError(404, "That student is not in the group");
    res.json(await Groups.getGroup(id));
  } catch (err) {
    next(err);
  }
}

export async function deleteGroup(req: Request, res: Response, next: NextFunction) {
  try {
    onlyAdmin(req);
    await Groups.deleteGroup(await openGroup(req));
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
}

export async function readMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const id = await openGroup(req);
    const after = Math.max(0, Math.trunc(Number(req.query.after) || 0));
    res.json(await Groups.listMessages(id, after, req.user!.id));
  } catch (err) {
    next(err);
  }
}

export async function postMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const id = await openGroup(req);
    const messageId = await Groups.addMessage(id, req.user!.id, req.body.body, req.body.attachmentId, req.body.replyToId);
    if (messageId === null) throw new AppError(400, "That file or reply could not be used. Please try again.");
    res.status(201).json({ id: messageId });
  } catch (err) {
    next(err);
  }
}

/**
 * ?scope=me hides a message from your own view only. ?scope=everyone removes it for the whole group:
 * your own message in its first 10 minutes, or any message if you are an admin.
 */
export async function removeMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const id = await openGroup(req);
    const messageId = Number(req.params.messageId);
    if (!Number.isInteger(messageId) || messageId <= 0) throw new AppError(404, "Message not found");
    const scope = req.query.scope;
    if (scope !== "me" && scope !== "everyone") throw new AppError(400, "Choose Delete for me or Delete for everyone");
    if (scope === "me") {
      if (!(await Groups.deleteForMe(id, messageId, req.user!.id))) throw new AppError(404, "Message not found");
      return void res.json({ deleted: true, scope });
    }
    const result = await Groups.deleteForEveryone(id, messageId, req.user!);
    if (result === "missing") throw new AppError(404, "Message not found, or it is not yours to delete for everyone");
    if (result === "expired") throw new AppError(403, "You can only delete a message for everyone in the first 10 minutes after sending it. You can still delete it for yourself.");
    res.json({ deleted: true, scope });
  } catch (err) {
    next(err);
  }
}

export async function uploadAttachment(req: Request, res: Response, next: NextFunction) {
  try {
    const id = await openGroup(req);
    const name = String(req.query.name ?? "")
      .replace(/[\\/]/g, "_")
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .trim()
      .slice(-150);
    if (!name) throw new AppError(400, "The file needs a name");
    const extension = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
    if (!ALLOWED_EXTENSIONS.includes(extension)) throw new AppError(400, `This kind of file cannot be shared. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`);
    const data = req.body;
    if (!Buffer.isBuffer(data) || data.length === 0) throw new AppError(400, "The file is empty");
    if (data.length > MAX_FILE_BYTES) throw new AppError(413, "The file is too big (5 MB at most)");
    res.status(201).json(await Groups.saveAttachment(id, req.user!.id, name, data));
  } catch (err) {
    next(err);
  }
}
