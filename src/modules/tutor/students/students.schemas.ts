import { z } from "zod";

export const updateEnrolmentSchema = z.object({
  current: z.string().trim().max(20).optional(),
  target: z.string().trim().max(20).optional(),
  groupId: z.number().int().positive().nullable().optional(),
});
export type UpdateEnrolmentInput = z.infer<typeof updateEnrolmentSchema>;
