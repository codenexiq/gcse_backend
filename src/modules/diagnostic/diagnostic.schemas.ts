import { z } from "zod";

export const LEVELS = ["GCSE", "IGCSE / O-level", "A-level"] as const;
export const TIERS = ["Foundation", "Higher", "Any"] as const;

const option = z.object({
  text: z.string().trim().min(1, "Every answer needs some text").max(200, "An answer is too long"),
  isCorrect: z.boolean(),
  // For a wrong answer: the mistake that picking it shows (used on the student's results). Optional.
  misconception: z
    .string()
    .trim()
    .max(100, "A mistake description is too long")
    .nullish()
    .transform((v) => v || undefined),
});

export const questionSchema = z.object({
  level: z.enum(LEVELS),
  subjectId: z.number().int().positive(),
  tier: z.enum(TIERS),
  topic: z.string().trim().min(1, "Topic is required").max(60, "Topic is too long"),
  question: z.string().trim().min(1, "The question is required").max(500, "The question is too long"),
  options: z
    .array(option)
    .min(2, "Add at least 2 answers")
    .max(6, "At most 6 answers")
    .refine((o) => o.filter((x) => x.isCorrect).length === 1, "Mark exactly one answer as correct"),
});

export const generateSchema = z.object({
  level: z.enum(LEVELS),
  subjectId: z.number().int().positive(),
  tier: z.enum(TIERS),
  // Optional: leave empty to spread the questions across the whole course.
  topic: z
    .string()
    .trim()
    .max(60, "Topic is too long")
    .optional()
    .transform((t) => t || undefined),
  count: z.number().int().min(1, "Ask for at least 1 question").max(20, "At most 20 questions at a time"),
});

export type GenerateInput = z.infer<typeof generateSchema>;
export type QuestionInput = z.infer<typeof questionSchema>;
export const idParamSchema = z.coerce.number().int().positive();
