import { z } from "zod";

export const updateGroupSchema = z.object({
  name: z.string().trim().min(1, "Give the group a name").max(120),
  subjectId: z.string().min(1).max(40),
  levelId: z.string().min(1).max(40),
  tutorId: z.number().int().positive().nullable(),
  day: z.number().int().min(0).max(6),
  start: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Choose a start time"),
  zoom: z.string().trim().max(255).default(""),
});
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
