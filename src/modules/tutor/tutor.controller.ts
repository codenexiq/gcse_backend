import type { NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { AppError } from "../../utils/AppError/index.js";
import * as User from "../auth/user.model.js";
import { acceptImage } from "../profile/profile.controller.js";
import { deleteImage, saveImage, setPassword } from "../profile/profile.model.js";
import { usernameRule } from "../auth/auth.schemas.js";
import type { StudentFields } from "./tutor.schemas.js";
import * as Tutor from "./tutor.model.js";

const BCRYPT_ROUNDS = 12;
const studentId = (req: Request) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new AppError(404, "Student not found");
  return id;
};

export async function getOverview(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await Tutor.overview());
  } catch (err) {
    next(err);
  }
}

export async function getStudents(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await Tutor.listStudents());
  } catch (err) {
    next(err);
  }
}

export async function getTutorAccounts(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await Tutor.listTutor());
  } catch (err) {
    next(err);
  }
}

// ---- Managing student profiles: admins and tutors (deleting is for admins only).

const profileOf = async (id: number) => {
  const profile = await Tutor.getStudentProfile(id);
  if (!profile) throw new AppError(404, "Student not found");
  return profile;
};

/** A duplicate-username error from the database (two people saving the same name at once) becomes a normal message. */
const asUsernameConflict = (err: unknown) => (typeof err === "object" && err !== null && (err as { code?: string }).code === "ER_DUP_ENTRY" ? new AppError(409, "That username is already taken") : err);

export async function getStudentProfile(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await profileOf(studentId(req)));
  } catch (err) {
    next(err);
  }
}

/** Is a username free? Used while typing it in the form. */
export async function checkUsername(req: Request, res: Response, next: NextFunction) {
  try {
    const username = String(req.query.username ?? "").trim().toLowerCase();
    if (!usernameRule.safeParse(username).success) return void res.json({ available: false, reason: "invalid" });
    const except = Number(req.query.except) || 0;
    res.json({ available: !(await Tutor.usernameTaken(username, except)), reason: null });
  } catch (err) {
    next(err);
  }
}

/** Creates a student account with the password the admin or tutor chose. */
export async function createStudent(req: Request, res: Response, next: NextFunction) {
  try {
    const { password, ...fields } = req.body as StudentFields & { password: string };
    if (await User.findByEmail(fields.email)) throw new AppError(409, "An account with that email already exists");
    if (fields.username && (await Tutor.usernameTaken(fields.username))) throw new AppError(409, "That username is already taken");
    const created = await User.create({ fullName: `${fields.firstName} ${fields.lastName}`.trim(), email: fields.email, passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS) });
    try {
      await Tutor.saveStudentFields(created.id, fields);
    } catch (err) {
      await Tutor.deleteStudent(created.id); // do not leave a half-made account behind
      throw err;
    }
    res.status(201).json(await profileOf(created.id));
  } catch (err) {
    next(asUsernameConflict(err));
  }
}

/** Saves a student's profile. A new password, if given, replaces the old one and signs the student out everywhere. */
export async function updateStudent(req: Request, res: Response, next: NextFunction) {
  try {
    const id = studentId(req);
    const { newPassword, ...fields } = req.body as StudentFields;
    await profileOf(id);
    const other = await User.findByEmail(fields.email);
    if (other && other.id !== id) throw new AppError(409, "An account with that email already exists");
    if (fields.username && (await Tutor.usernameTaken(fields.username, id))) throw new AppError(409, "That username is already taken");
    await Tutor.saveStudentFields(id, fields);
    if (newPassword) await setPassword(id, await bcrypt.hash(newPassword, BCRYPT_ROUNDS));
    res.json(await profileOf(id));
  } catch (err) {
    next(asUsernameConflict(err));
  }
}

/** Sets a student's profile picture or cover photo. */
export async function uploadStudentImage(req: Request, res: Response, next: NextFunction) {
  try {
    const id = studentId(req);
    await profileOf(id);
    const { kind, mime, data } = acceptImage(req.params.kind, req.body);
    res.status(201).json({ version: await saveImage(id, kind, mime, data) });
  } catch (err) {
    next(err);
  }
}

export async function removeStudentImage(req: Request, res: Response, next: NextFunction) {
  try {
    const id = studentId(req);
    await profileOf(id);
    const kind = req.params.kind;
    if (kind !== "avatar" && kind !== "cover") throw new AppError(404, "Unknown picture");
    await deleteImage(id, kind);
    res.json({ removed: true });
  } catch (err) {
    next(err);
  }
}

export async function deleteStudent(req: Request, res: Response, next: NextFunction) {
  try {
    if (!(await Tutor.deleteStudent(studentId(req)))) throw new AppError(404, "Student not found");
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
}

export async function bulkStudents(req: Request, res: Response, next: NextFunction) {
  try {
    const { ids, action } = req.body as { ids: number[]; action: "activate" | "deactivate" | "delete" };
    if (action === "delete" && req.user!.role !== "admin") throw new AppError(403, "Only an administrator can delete students");
    res.json({ changed: await Tutor.bulkStudents(ids, action) });
  } catch (err) {
    next(err);
  }
}
