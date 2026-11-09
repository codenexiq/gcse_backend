import { z } from "zod";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 18:00");

/** The Zoom link a tutor types. "zoom.us/j/123" is accepted and becomes https://zoom.us/j/123. Only https addresses are kept. */
export const zoomLink = z
  .string()
  .trim()
  .min(1, "Add the Zoom link")
  .max(300, "The Zoom link is too long")
  .transform((v) => (/^https?:\/\//i.test(v) ? v : `https://${v}`))
  .refine((v) => {
    try {
      const url = new URL(v);
      return url.protocol === "https:" && url.hostname.includes(".");
    } catch {
      return false;
    }
  }, "That does not look like a web address (https://...)")
  .transform((v) => new URL(v).toString());

export const groupSchema = z
  .object({
    name: z.string().trim().min(1, "Give the group a name").max(100, "The name is at most 100 characters"),
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: time,
    endTime: time,
    zoomLink,
    capacity: z.number().int().min(1, "A group needs room for at least 1 student").max(30, "A group can have 30 students at most").default(8),
    topics: z.array(z.string().trim().min(1).max(100)).max(30, "Choose 30 topics at most").default([]),
  })
  .refine((g) => g.endTime > g.startTime, { message: "The end time must be after the start time", path: ["endTime"] });

export type GroupInput = z.infer<typeof groupSchema>;

export const assignSchema = z.object({
  groupId: z.number().int().positive(),
  note: z.string().trim().max(1000, "The note is at most 1000 characters").default(""),
  sendVideo: z.boolean().default(false),
});
export type AssignInput = z.infer<typeof assignSchema>;
