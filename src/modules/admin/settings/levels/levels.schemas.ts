import { z } from "zod";

const list = z.array(z.string().trim().max(40)).max(40);

export const createLevelSchema = z.object({ name: z.string().trim().min(1, "Type a name first.").max(80) });

export const updateLevelSchema = z.object({
  name: z.string().trim().min(1, "Give the level a name").max(80),
  short: z.string().trim().min(1, "Give the level a short name").max(40),
  years: list,
  tiers: list,
  boards: list,
  grades: list,
});
export type UpdateLevelInput = z.infer<typeof updateLevelSchema>;
