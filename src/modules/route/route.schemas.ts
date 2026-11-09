import { z } from "zod";

export const createSchema = z.object({
  name: z.string().trim().min(1, "Give the route a name").max(120),
  description: z.string().trim().max(300).default(""),
});

export const updateSchema = z.object({
  name: z.string().trim().min(1, "Give the route a name").max(120),
  description: z.string().trim().max(300).default(""),
  steps: z
    .array(z.object({ type: z.enum(["lesson", "quiz"]), id: z.number().int().positive(), week: z.number().int().min(1).max(12) }))
    .max(60, "A route can have 60 steps at most"),
  assigned: z.array(z.number().int().positive()).max(500),
});
export type UpdateInput = z.infer<typeof updateSchema>;
