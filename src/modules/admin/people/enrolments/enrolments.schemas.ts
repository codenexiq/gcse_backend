import { z } from "zod";

/** Send only what changed: anything left out stays as it was. */
export const updateEnrolmentSchema = z.object({
  tier: z.string().trim().max(40).optional(),
  board: z.string().trim().max(40).optional(),
  current: z.string().trim().max(20).optional(),
  target: z.string().trim().max(20).optional(),
  tutorId: z.number().int().positive().nullable().optional(),
  groupId: z.number().int().positive().nullable().optional(),
});
export type UpdateEnrolmentInput = z.infer<typeof updateEnrolmentSchema>;
