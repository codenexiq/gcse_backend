import { z } from "zod";
import { LEVELS } from "../diagnostic/diagnostic.schemas.js";

export const TIERS = ["Foundation", "Higher", "Not sure yet"] as const;

const optionId = z.number().int().positive();

export const profileSchema = z.object({
  level: z.enum(LEVELS),
  subjectId: optionId,
  examBoardId: optionId,
  schoolYearId: optionId,
  targetGradeId: optionId,
  tier: z.enum(TIERS),
});

/** One answer: the index of the chosen option, or -1 for "I haven't learned this yet". */
export const submitSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.number().int().positive(),
        choice: z.number().int().min(-1).max(5),
      })
    )
    .min(1, "Answer at least one question")
    .max(100),
});

export type ProfileInput = z.infer<typeof profileSchema>;
export type SubmitInput = z.infer<typeof submitSchema>;
