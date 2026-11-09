import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../utils/AppError/index.js";
import * as Chat from "../chat/chat.model.js";
import * as Booking from "./booking.model.js";
import type { BookingInput, BookingLogInput } from "./booking.schemas.js";

const DAY = 24 * 60 * 60 * 1000;
const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const niceDate = (date: string) => {
  const d = new Date(`${date}T00:00:00Z`);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};
const niceTime = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}${m === 0 ? "" : `:${String(m).padStart(2, "0")}`}${h < 12 ? "am" : "pm"}`;
};

function idOf(req: Request) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new AppError(404, "Session not found");
  return id;
}

/** A booking this person may change: their own (an admin may change anyone's). */
async function mine(req: Request) {
  const b = await Booking.find(idOf(req));
  if (!b || (req.user!.role !== "admin" && b.tutor_id !== req.user!.id)) throw new AppError(404, "Session not found");
  return b;
}

/** A message in the chat the tutor already has with each student (or a new one). Failures are not allowed to undo the booking. */
async function tell(tutorId: number, studentIds: number[], text: string) {
  for (const studentId of studentIds) {
    try {
      await Chat.addMessage({ studentId, staffId: tutorId }, tutorId, text, undefined);
    } catch (err) {
      console.error("[booking] could not message a student:", err instanceof Error ? err.message : err);
    }
  }
}

export async function listBookings(req: Request, res: Response, next: NextFunction) {
  try {
    const from = String(req.query.from ?? "");
    const to = String(req.query.to ?? "");
    if (!DATE.test(from) || !DATE.test(to) || to < from) throw new AppError(400, "Give a from and a to date, like 2026-11-02");
    if (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`) > 70 * DAY) throw new AppError(400, "Ask for 10 weeks at most");
    res.json(await Booking.list(req.user!, from, to));
  } catch (err) {
    next(err);
  }
}

export async function createBooking(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as BookingInput;
    if (body.date < dayOf(Date.now() - DAY)) throw new AppError(400, "Choose today or a later date");
    const made = await Booking.create(req.user!.id, body);
    const first = made[0];
    const who = await Booking.audience({ student_id: body.who.type === "student" ? body.who.id : null, group_id: body.who.type === "group" ? body.who.id : null });
    await tell(
      req.user!.id,
      who,
      `Your ${body.who.type === "group" ? "group session" : "1-to-1"} is booked for ${niceDate(first.date)} at ${niceTime(first.startTime)}${made.length > 1 ? `, every week for ${made.length} weeks` : ""}. Zoom: ${first.zoomLink}`
    );
    res.status(201).json(made);
  } catch (err) {
    next(err);
  }
}

export async function cancelBooking(req: Request, res: Response, next: NextFunction) {
  try {
    const b = await mine(req);
    if (b.session_date < dayOf(Date.now() - DAY)) throw new AppError(409, "A session that has already happened can not be cancelled");
    if (b.log_id !== null) throw new AppError(409, "This session has a log, so it can not be cancelled");
    const series = req.query.series === "1";
    const who = await Booking.audience(b);
    const count = await Booking.cancel(b, series);
    await tell(b.tutor_id, who, series && count > 1 ? `Your weekly sessions from ${niceDate(b.session_date)} are cancelled.` : `Your session on ${niceDate(b.session_date)} at ${niceTime(b.start_time)} is cancelled.`);
    res.json({ cancelled: count });
  } catch (err) {
    next(err);
  }
}

export async function logBooking(req: Request, res: Response, next: NextFunction) {
  try {
    const b = await mine(req);
    if (b.session_date > dayOf(Date.now() + DAY)) throw new AppError(409, "You can log a session once it has happened");
    res.status(201).json(await Booking.addLog(b, { id: req.user!.id, fullName: req.user!.fullName ?? "" }, req.body as BookingLogInput));
  } catch (err) {
    next(err);
  }
}
