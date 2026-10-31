import type { NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../config/env/index.js";
import { AppError } from "../../utils/AppError/index.js";
import { SESSION_COOKIE } from "../../middleware/authenticate/index.js";
import * as User from "./user.model.js";
import type { Role } from "./user.model.js";
import type { Credentials } from "./auth.schemas.js";

// Only these roles may use the tutor sign-in. An allow-list, so an unknown or blank role never gets in.
const TUTOR_ROLES: Role[] = ["tutor", "admin"];

const BCRYPT_ROUNDS = 12;
// Used when the email does not exist, so login takes the same time either way.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", BCRYPT_ROUNDS);

const cookieOptions = {
  httpOnly: true, // JavaScript in the browser can not read it (blocks XSS token theft)
  secure: env.isProduction, // HTTPS only in production
  sameSite: "strict",
  path: "/",
} as const; // never sent on cross-site requests

function startSession(res: Response, user: { id: number }) {
  const token = jwt.sign({ sub: String(user.id) }, env.jwtSecret, {
    algorithm: "HS256",
    expiresIn: `${env.sessionHours}h`,
  });
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: env.sessionHours * 3600 * 1000 });
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { fullName, email, password } = req.body as Credentials & { fullName: string };
    if (await User.findByEmail(email)) {
      throw new AppError(409, "An account with that email already exists");
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await User.create({ fullName, email, passwordHash });
    startSession(res, user);
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body as Credentials;
    const user = await User.findByEmail(email);
    const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
    // Same message for "no such email" and "wrong password" - do not help attackers.
    if (!user || !ok) throw new AppError(401, "Invalid email or password");
    // The password was right, so it is safe to say where this account should sign in instead.
    if (user.role !== "student") throw new AppError(403, "This is a tutor account. Please use the tutor sign-in.");

    startSession(res, user);
    res.json({ user: { id: user.id, fullName: user.full_name, email: user.email, role: user.role } });
  } catch (err) {
    next(err);
  }
}

/** Sign-in for tutors and admins only. */
export async function tutorLogin(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body as Credentials;
    const user = await User.findByEmail(email);
    const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
    // A student using the tutor form gets the exact same answer (and takes the same time) as a wrong
    // password, so nobody can find out which emails belong to tutor.
    if (!user || !ok || !TUTOR_ROLES.includes(user.role)) throw new AppError(401, "Invalid email or password");

    startSession(res, user);
    res.json({ user: { id: user.id, fullName: user.full_name, email: user.email, role: user.role } });
  } catch (err) {
    next(err);
  }
}

export function logout(req: Request, res: Response) {
  res.clearCookie(SESSION_COOKIE, cookieOptions);
  res.json({ message: "Logged out" });
}

export function me(req: Request, res: Response) {
  res.json({ user: req.user });
}
