import type { NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { AppError } from "../../utils/AppError/index.js";
import { startSession } from "../auth/auth.controller.js";
import { usernameTaken } from "../auth/user.model.js";
import { shareGroup } from "../chatGroup/chatGroup.model.js";
import * as Profile from "./profile.model.js";
import { IMAGE_KINDS, MAX_IMAGE_BYTES, type ImageKind, type PasswordInput, type ProfileInput } from "./profile.schemas.js";

const BCRYPT_ROUNDS = 12;

function kindOf(value: unknown): ImageKind {
  if (!IMAGE_KINDS.includes(value as ImageKind)) throw new AppError(404, "Unknown picture");
  return value as ImageKind;
}

/** What kind of picture these bytes really are (looking at the file itself, not at what the browser says). */
function detectImage(data: Buffer): string | null {
  if (data.length > 12 && data[0] === 0x89 && data.subarray(1, 4).toString("latin1") === "PNG") return "image/png";
  if (data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  if (data.length > 12 && data.subarray(0, 4).toString("latin1") === "RIFF" && data.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

export async function readProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const profile = await Profile.getProfile(req.user!.id);
    if (!profile) throw new AppError(404, "Account not found");
    res.json(profile);
  } catch (err) {
    next(err);
  }
}

export async function saveProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const fields = req.body as ProfileInput;
    if (fields.username && (await usernameTaken(fields.username, req.user!.id))) throw new AppError(409, "That username is already taken");
    await Profile.updateProfile(req.user!.id, fields);
    res.json(await Profile.getProfile(req.user!.id));
  } catch (err) {
    // Two people saving the same username at the same moment: the database refuses the second one.
    next(typeof err === "object" && err !== null && (err as { code?: string }).code === "ER_DUP_ENTRY" ? new AppError(409, "That username is already taken") : err);
  }
}

/** Is this username free for me? Used while typing it in the form. */
export async function checkUsername(req: Request, res: Response, next: NextFunction) {
  try {
    const username = String(req.query.username ?? "").trim().toLowerCase();
    if (!/^[a-z0-9_.]{3,30}$/.test(username)) return void res.json({ available: false, reason: "invalid" });
    res.json({ available: !(await usernameTaken(username, req.user!.id)), reason: null });
  } catch (err) {
    next(err);
  }
}

export async function saveChatColor(req: Request, res: Response, next: NextFunction) {
  try {
    const color = (req.body as { color: string | null }).color;
    await Profile.setChatColor(req.user!.id, color);
    res.json({ chatColor: color ? color.toLowerCase() : null });
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { currentPassword, newPassword } = req.body as PasswordInput;
    const hash = await Profile.getPasswordHash(req.user!.id);
    // 400, not 401: the person is signed in, they just typed the wrong current password.
    if (!hash || !(await bcrypt.compare(currentPassword, hash))) throw new AppError(400, "Your current password is not right");
    if (currentPassword === newPassword) throw new AppError(400, "Choose a new password that is different from the current one");
    await Profile.setPassword(req.user!.id, await bcrypt.hash(newPassword, BCRYPT_ROUNDS));
    // Every older session is now invalid; this one carries on with a fresh session.
    startSession(res, req.user!);
    res.json({ changed: true });
  } catch (err) {
    next(err);
  }
}

/** Checks a picture (size, and what it really is) and returns its type. Throws a readable error if it cannot be accepted. */
export function acceptImage(kindValue: unknown, data: unknown): { kind: ImageKind; mime: string; data: Buffer } {
  const kind = kindOf(kindValue);
  if (!Buffer.isBuffer(data) || data.length === 0) throw new AppError(400, "The picture is empty");
  if (data.length > MAX_IMAGE_BYTES[kind]) throw new AppError(413, `The picture is too big (${MAX_IMAGE_BYTES[kind] / 1024 / 1024} MB at most)`);
  const mime = detectImage(data);
  if (!mime) throw new AppError(400, "Please choose a PNG, JPG or WebP picture");
  return { kind, mime, data };
}

export async function uploadImage(req: Request, res: Response, next: NextFunction) {
  try {
    const { kind, mime, data } = acceptImage(req.params.kind, req.body);
    res.status(201).json({ version: await Profile.saveImage(req.user!.id, kind, mime, data) });
  } catch (err) {
    next(err);
  }
}

export async function removeImage(req: Request, res: Response, next: NextFunction) {
  try {
    await Profile.deleteImage(req.user!.id, kindOf(req.params.kind));
    res.json({ removed: true });
  } catch (err) {
    next(err);
  }
}

/**
 * Someone's profile picture or cover photo. You can always see your own. A tutor or admin can see a STUDENT's,
 * a student can see a TUTOR's or ADMIN's, and an ADMIN can see anyone's. Nobody else's: students cannot see each other's,
 * and a tutor cannot see another tutor's or an admin's.
 */
function sendUserImage(kind: ImageKind) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const target = Number(req.params.userId);
      if (!Number.isInteger(target) || target <= 0) throw new AppError(404, "No picture");
      const viewer = req.user!;
      if (target !== viewer.id) {
        // Staff see students' pictures, and students see the pictures of tutors and admins (the people they chat with).
        // A student never sees another student's, and tutors and admins never see each other's.
        const role = await Profile.getRole(target);
        // An admin manages every account (the Tutor Accounts page), so an admin may see anyone's picture.
        const allowed = viewer.role === "admin" ? role !== null : viewer.role === "student" ? role === "tutor" || role === "admin" : role === "student";
        // People who are in the same group chat may also see each other's pictures.
        if (!allowed && !(await shareGroup(viewer.id, target))) throw new AppError(404, "No picture");
      }
      const image = await Profile.getImage(target, kind);
      if (!image) throw new AppError(404, "No picture");
      res.setHeader("Content-Type", image.mime);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "private, max-age=86400");
      res.send(image.data);
    } catch (err) {
      next(err);
    }
  };
}
export const sendUserAvatar = sendUserImage("avatar");
export const sendUserCover = sendUserImage("cover");

/** Your own picture. The address carries a version number, so a browser can keep it until it changes. */
export async function sendImage(req: Request, res: Response, next: NextFunction) {
  try {
    const image = await Profile.getImage(req.user!.id, kindOf(req.params.kind));
    if (!image) throw new AppError(404, "No picture");
    res.setHeader("Content-Type", image.mime);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.send(image.data);
  } catch (err) {
    next(err);
  }
}
