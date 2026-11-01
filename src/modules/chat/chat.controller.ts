import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../utils/AppError/index.js";
import * as Chat from "./chat.model.js";
import { ALLOWED_EXTENSIONS, MAX_FILE_BYTES } from "./chat.schemas.js";

/**
 * Which student's conversation this request is about.
 * A student always gets their own. A tutor or admin names one (and it must be a real student).
 */
async function conversationOf(req: Request, named: unknown): Promise<number> {
  const user = req.user!;
  if (user.role === "student") return user.id;
  const id = Number(named);
  if (!Number.isInteger(id) || id <= 0) throw new AppError(400, "Choose a student first");
  if (!(await Chat.isStudent(id))) throw new AppError(404, "Student not found");
  return id;
}

export async function listConversations(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await Chat.listConversations(req.user!.id));
  } catch (err) {
    next(err);
  }
}

export async function readMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = await conversationOf(req, req.query.studentId);
    const after = Math.max(0, Math.trunc(Number(req.query.after) || 0));
    res.json(await Chat.listMessages(studentId, after, req.user!.role === "student" ? "student" : "tutor", req.user!.id));
  } catch (err) {
    next(err);
  }
}

export async function postMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = await conversationOf(req, req.body.studentId);
    const id = await Chat.addMessage(studentId, req.user!.id, req.body.body, req.body.attachmentId);
    if (id === null) throw new AppError(400, "That file could not be attached. Please upload it again.");
    res.status(201).json({ id });
  } catch (err) {
    next(err);
  }
}

/** The extension of a file name in lower case, or "" when there is none. */
const extensionOf = (name: string) => (name.includes(".") ? name.split(".").pop()!.toLowerCase() : "");

export async function uploadAttachment(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = await conversationOf(req, req.query.studentId);
    // The name only: never a path, and no control characters.
    const name = String(req.query.name ?? "")
      .replace(/[\\/]/g, "_")
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .trim()
      .slice(-150);
    if (!name) throw new AppError(400, "The file needs a name");
    if (!ALLOWED_EXTENSIONS.includes(extensionOf(name))) {
      throw new AppError(400, `This kind of file cannot be shared. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`);
    }
    const data = req.body;
    if (!Buffer.isBuffer(data) || data.length === 0) throw new AppError(400, "The file is empty");
    if (data.length > MAX_FILE_BYTES) throw new AppError(413, "The file is too big (5 MB at most)");
    res.status(201).json(await Chat.saveAttachment(studentId, req.user!.id, name, data));
  } catch (err) {
    next(err);
  }
}

export async function downloadAttachment(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new AppError(404, "File not found");
    const file = await Chat.getAttachment(id);
    // A student can only open files from their own conversation. Tutors and admins can open any.
    if (!file || (req.user!.role === "student" && file.student_id !== req.user!.id)) throw new AppError(404, "File not found");
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.file_name)}`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, no-store");
    res.send(file.data);
  } catch (err) {
    next(err);
  }
}

/** The number for the red badge on the sidebar's Messages button. */
export async function unreadCount(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    res.json({ count: user.role === "student" ? await Chat.unreadForStudent(user.id) : await Chat.unreadForTutors(user.id) });
  } catch (err) {
    next(err);
  }
}

/** Delete one of your own messages (for everyone). */
export async function removeMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = await conversationOf(req, req.query.studentId);
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0 || !(await Chat.deleteMessage(studentId, id, req.user!.id))) throw new AppError(404, "Message not found, or it is not yours to delete");
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
}

/** Clear chat: only for the person asking. */
export async function clearConversation(req: Request, res: Response, next: NextFunction) {
  try {
    await Chat.clearChat(await conversationOf(req, req.query.studentId), req.user!.id);
    res.json({ cleared: true });
  } catch (err) {
    next(err);
  }
}

/** Delete chat: the whole conversation, for everyone. */
export async function deleteConversation(req: Request, res: Response, next: NextFunction) {
  try {
    await Chat.deleteChat(await conversationOf(req, req.query.studentId));
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
}
