import type { NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../config/env/index.js";
import { AppError } from "../../utils/AppError/index.js";
import { SESSION_COOKIE } from "../../middleware/authenticate/index.js";
import * as User from "./user.model.js";
import type { Role } from "./user.model.js";
import type { Credentials } from "./auth.schemas.js";
import * as Signup from "./signup.model.js";
import type { SignupInput } from "./signup.schemas.js";

const BCRYPT_ROUNDS = 12;
// Used when the email does not exist, so login takes the same time either way.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", BCRYPT_ROUNDS);

const cookieOptions = {
  httpOnly: true, // JavaScript in the browser can not read it (blocks XSS token theft)
  secure: env.isProduction, // HTTPS only in production
  sameSite: "strict",
  path: "/",
} as const; // never sent on cross-site requests

export function startSession(res: Response, user: { id: number }) {
  const token = jwt.sign({ sub: String(user.id) }, env.jwtSecret, {
    algorithm: "HS256",
    expiresIn: `${env.sessionHours}h`,
  });
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: env.sessionHours * 3600 * 1000 });
}

/** The sign-up wizard (public): the lists it offers. */
export async function signupOptions(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await Signup.options());
  } catch (err) {
    next(err);
  }
}

/** The sign-up wizard (public): makes the student's account and subjects, and signs them in. */
export async function signup(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as SignupInput;
    const user = await Signup.signup(input, await bcrypt.hash(input.password, BCRYPT_ROUNDS));
    startSession(res, user);
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
}

/**
 * One sign-in for each kind of person. Each accepts only its own role, so a teacher can never sign in on the
 * student or admin form (or the other way round). A person using the wrong form gets the exact same answer, and takes
 * the same time, as a wrong password: nobody can find out which emails belong to which role.
 */
function signInFor(role: Role) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body as Credentials;
      const user = await User.findByEmail(email);
      const ok = await bcrypt.compare(password, user?.password_hash ? user.password_hash : DUMMY_HASH);
      if (!user || !ok || user.role !== role) throw new AppError(401, "Invalid email or password");
      if (!user.is_active) throw new AppError(403, "This account is inactive. Please contact the Educate Cloud team.");

      startSession(res, user);
      res.json({ user: { id: user.id, fullName: user.full_name, email: user.email, role: user.role } });
    } catch (err) {
      next(err);
    }
  };
}

export const login = signInFor("student");
export const tutorLogin = signInFor("tutor");
export const adminLogin = signInFor("admin");

export function logout(req: Request, res: Response) {
  res.clearCookie(SESSION_COOKIE, cookieOptions);
  res.json({ message: "Logged out" });
}

export function me(req: Request, res: Response) {
  res.json({ user: req.user });
}
