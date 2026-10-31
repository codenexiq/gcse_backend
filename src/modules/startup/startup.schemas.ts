import { z } from "zod";

export const CATEGORIES = ["subject", "exam_board", "school_year", "target_grade"] as const;

const label = z.string().trim().min(1, "Name is required").max(60, "Name is too long");

export const createOptionSchema = z.object({ category: z.enum(CATEGORIES), label });
export const updateOptionSchema = z.object({ label });
export const idParamSchema = z.coerce.number().int().positive();

export type NewOption = z.infer<typeof createOptionSchema>;
