import { z } from "zod";

/** What the player sends when a student finishes: the option chosen for each multiple-choice part, and the marks they gave a written answer. Keys are the part's position (0, 1, 2...). */
export const finishSchema = z.object({
  enrolmentId: z.number().int().positive(),
  mcq: z.record(z.string().regex(/^\d+$/), z.number().int().min(0).max(5)).default({}),
  written: z.record(z.string().regex(/^\d+$/), z.number().int().min(0).max(6)).default({}),
});
export type FinishInput = z.infer<typeof finishSchema>;

/** Either a confidence rating for each topic (conf), or the answer chosen for each question (answers: its position, and the option number, or "nl" for "I have not learned this"). */
export const diagnosticSchema = z
  .object({
    conf: z.record(z.string().regex(/^\d+$/), z.enum(["P", "W", "N"])).optional(),
    answers: z.record(z.string().regex(/^\d+$/), z.union([z.number().int().min(0).max(5), z.literal("nl")])).optional(),
  })
  .refine((v) => v.conf || v.answers, "Answer the diagnostic first.");

export const practiceResultSchema = z.object({ enrolmentId: z.number().int().positive(), got: z.number().int().min(0).max(100), max: z.number().int().min(1).max(100) });
