import { z } from "zod";
import { zoomLink } from "../group/group.schemas.js";

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date")
  .refine((v) => new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v, "That is not a real date");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 17:00");

export const MINUTES = [30, 45, 60, 90] as const;

/** Book a session with a student or a group, once or every week. */
export const bookingSchema = z.object({
  who: z.object({ type: z.enum(["student", "group"]), id: z.number().int().positive() }),
  date,
  startTime: time,
  minutes: z.number().int().refine((m) => (MINUTES as readonly number[]).includes(m), "Choose 30, 45, 60 or 90 minutes"),
  repeat: z.number().int().refine((n) => n === 1 || n === 12, "Choose once, or every week for 12 weeks"),
  zoomLink,
});
export type BookingInput = z.infer<typeof bookingSchema>;

export const ATTENDED = ["Attended", "Late (5+ minutes)", "Absent"] as const;

/** The short log a tutor writes after a session. */
export const bookingLogSchema = z.object({
  // 1-to-1: how the student attended. A group session uses `present` (the students who came) instead.
  attendance: z.enum(ATTENDED).default("Attended"),
  present: z.array(z.number().int().positive()).max(60).default([]),
  topics: z.string().trim().min(1, "Add the topics covered").max(300, "The topics are at most 300 characters"),
  homework: z.string().trim().max(300, "The homework is at most 300 characters").default(""),
  wentWell: z.string().trim().max(1000, "What went well is at most 1000 characters").default(""),
  nextStep: z.string().trim().max(1000, "The next step is at most 1000 characters").default(""),
  engagement: z.number().int().min(1, "Rate the engagement from 1 to 5").max(5),
  focus: z.number().int().min(1, "Rate the focus from 1 to 5").max(5),
});
export type BookingLogInput = z.infer<typeof bookingLogSchema>;
