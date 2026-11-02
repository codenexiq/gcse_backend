import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../utils/AppError/index.js";
import * as Groups from "../chatGroup/chatGroup.model.js";
import * as Chat from "./chat.model.js";
import type { Pair } from "./chat.model.js";
import { ALLOWED_EXTENSIONS, MAX_FILE_BYTES } from "./chat.schemas.js";

/**
 * Which chat this request is about. A chat is always between ONE student and ONE tutor/admin.
 * `peer` is the OTHER person: a student names the tutor/admin, a tutor or admin names the student.
 * Nobody can reach a chat they are not part of, because their own id is always one half of the pair.
 */
async function pairOf(req: Request, peer: unknown): Promise<Pair> {
  const user = req.user!;
  const peerId = Number(peer);
  if (!Number.isInteger(peerId) || peerId <= 0) throw new AppError(400, user.role === "student" ? "Choose a tutor first" : "Choose a student first");
  const peerRole = await Chat.roleOf(peerId);
  if (user.role === "student") {
    if (peerRole !== "tutor" && peerRole !== "admin") throw new AppError(404, "Tutor not found");
    return { studentId: user.id, staffId: peerId };
  }
  if (peerRole !== "student") throw new AppError(404, "Student not found");
  return { studentId: peerId, staffId: user.id };
}

/** The people this person can chat with: students for a tutor or admin, tutors and admins for a student. */
export async function listConversations(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    res.json(user.role === "student" ? await Chat.listForStudent(user.id) : await Chat.listForStaff(user.id));
  } catch (err) {
    next(err);
  }
}

export async function readMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const pair = await pairOf(req, req.query.with);
    const after = Math.max(0, Math.trunc(Number(req.query.after) || 0));
    res.json(await Chat.listMessages(pair, after, req.user!.role === "student" ? "student" : "tutor", req.user!.id));
  } catch (err) {
    next(err);
  }
}

export async function postMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const pair = await pairOf(req, req.body.peerId);
    const id = await Chat.addMessage(pair, req.user!.id, req.body.body, req.body.attachmentId, req.body.replyToId);
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
    const pair = await pairOf(req, req.query.with);
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
    res.status(201).json(await Chat.saveAttachment(pair, req.user!.id, name, data));
  } catch (err) {
    next(err);
  }
}

export async function downloadAttachment(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new AppError(404, "File not found");
    const file = await Chat.getAttachment(id);
    // Only the two people in that chat can open the file (another tutor or admin cannot).
    // A file shared in a group can be opened by whoever may open that group.
    const user = req.user!;
    const allowed = file && (file.group_id !== null ? await Groups.canAccess(user, file.group_id) : user.role === "student" ? file.student_id === user.id : file.staff_id === user.id);
    if (!file || !allowed) throw new AppError(404, "File not found");
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.file_name)}`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, no-store");
    res.send(file.data);
  } catch (err) {
    next(err);
  }
}

/** Tutors and admins only: search for a student to start a chat with. */
export async function findStudents(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await Chat.searchStudents(String(req.query.q ?? "").slice(0, 100)));
  } catch (err) {
    next(err);
  }
}

/** The other person's card, shown beside the chat. Only for someone you can actually chat with (a student sees tutors and admins; staff see students). */
export async function readPeer(req: Request, res: Response, next: NextFunction) {
  try {
    const pair = await pairOf(req, req.query.with);
    // Tutors and admins see all of a student's details; a student sees a tutor's or admin's public profile only.
    const viewerIsStaff = req.user!.role !== "student";
    const peer = await Chat.getPeerCard(viewerIsStaff ? pair.studentId : pair.staffId, viewerIsStaff);
    if (!peer) throw new AppError(404, "Person not found");
    res.json(peer);
  } catch (err) {
    next(err);
  }
}

/** The number for the red badge on the sidebar's Messages button. */
export async function unreadCount(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    // One-to-one chats and group chats both count towards the red badge.
    const direct = user.role === "student" ? await Chat.unreadForStudent(user.id) : await Chat.unreadForStaff(user.id);
    res.json({ count: direct + (await Groups.unreadTotal(user)) });
  } catch (err) {
    next(err);
  }
}

/**
 * Delete a message. ?scope=me hides it from your own view only (any message in the chat).
 * ?scope=everyone removes your OWN message for both people, but only in the first 10 minutes.
 */
export async function removeMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const pair = await pairOf(req, req.query.with);
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new AppError(404, "Message not found");
    const scope = req.query.scope;
    if (scope !== "me" && scope !== "everyone") throw new AppError(400, "Choose Delete for me or Delete for everyone");

    if (scope === "me") {
      if (!(await Chat.deleteForMe(pair, id, req.user!.id))) throw new AppError(404, "Message not found");
      return void res.json({ deleted: true, scope });
    }
    const result = await Chat.deleteForEveryone(pair, id, req.user!.id);
    if (result === "missing") throw new AppError(404, "Message not found, or it is not yours to delete for everyone");
    if (result === "expired") throw new AppError(403, "You can only delete a message for everyone in the first 10 minutes after sending it. You can still delete it for yourself.");
    res.json({ deleted: true, scope });
  } catch (err) {
    next(err);
  }
}

/** Clear chat: only for the person asking. */
export async function clearConversation(req: Request, res: Response, next: NextFunction) {
  try {
    await Chat.clearChat(await pairOf(req, req.query.with), req.user!.id);
    res.json({ cleared: true });
  } catch (err) {
    next(err);
  }
}

/** Delete chat: this chat only, for both people. */
export async function deleteConversation(req: Request, res: Response, next: NextFunction) {
  try {
    await Chat.deleteChat(await pairOf(req, req.query.with));
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
}
