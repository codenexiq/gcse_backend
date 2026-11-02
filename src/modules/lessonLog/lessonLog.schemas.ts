import { z } from "zod";

export const LESSON_TYPES = ["1:1", "Group", "Admin"] as const;
export const ATTENDANCE = ["Present", "Late", "Absent / No show"] as const;
export const COMPLETED = ["Yes", "No", "Maybe"] as const;

const DAY = 24 * 60 * 60 * 1000;

/** A real calendar date like 2026-11-02, not in the future (one day of leeway for time zones) and not more than a year ago. */
const lessonDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date of the lesson")
  .refine((value) => {
    const time = Date.parse(`${value}T00:00:00Z`);
    return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
  }, "That is not a real date")
  .refine((value) => Date.parse(`${value}T00:00:00Z`) <= Date.now() + DAY, "The lesson date cannot be in the future")
  .refine((value) => Date.parse(`${value}T00:00:00Z`) >= Date.now() - 366 * DAY, "The lesson date cannot be more than a year ago");

/** The attendance and feedback form a tutor fills in after each lesson. */
export const lessonLogSchema = z.object({
  tutorName: z.string().trim().max(100, "The name can be 100 characters at most").default(""),
  lessonDate,
  studentOrClass: z.string().trim().min(1, "Enter the student, class or admin block").max(150, "At most 150 characters"),
  lessonType: z.enum(LESSON_TYPES, { error: "Choose the lesson type" }),
  attendance: z.enum(ATTENDANCE, { error: "Choose the attendance" }),
  durationMinutes: z.number({ error: "Enter the duration in minutes" }).int("Enter whole minutes").min(1, "The duration must be at least 1 minute").max(600, "The duration can be 600 minutes at most"),
  completed: z.enum(COMPLETED, { error: "Say whether the lesson or task was completed" }),
  homeworkAssigned: z.boolean().default(false),
  homeworkOther: z.string().trim().max(300, "At most 300 characters").default(""),
  engagementNotes: z.string().trim().max(2000, "At most 2000 characters").default(""),
  nextFocus: z.string().trim().min(1, "Write the next focus or lesson notes").max(2000, "At most 2000 characters"),
  zoomRecorded: z.boolean().default(false),
});
export type LessonLogInput = z.infer<typeof lessonLogSchema>;
