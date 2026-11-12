import { z } from "zod";

export const bookSchema = z.object({
  /** "g|3" for a group, "e|7" for one student's subject. */
  who: z.string().regex(/^[ge]\|\d+$/, "Choose who the session is for."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date."),
  start: z.string().regex(/^\d{2}:\d{2}$/, "Choose a start time."),
  mins: z.number().int().min(15).max(240).default(60),
});
export type BookInput = z.infer<typeof bookSchema>;

export const logSchema = z.object({
  bookingId: z.number().int().positive(),
  topicId: z.number().int().positive().nullable(),
  /** Enrolment id -> was the student there. */
  attendance: z.record(z.string().regex(/^\d+$/), z.boolean()),
  note: z.string().trim().max(2000).default(""),
  homework: z.string().trim().max(255).default(""),
});
export type LogInput = z.infer<typeof logSchema>;
