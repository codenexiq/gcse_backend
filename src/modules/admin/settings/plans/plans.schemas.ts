import { z } from "zod";

export const updatePlanSchema = z.object({
  name: z.string().trim().min(1, "Give the plan a name").max(80),
  tagline: z.string().trim().max(160).default(""),
  live: z.number().int().min(0).max(3),
  mocks: z.boolean(),
  popular: z.boolean(),
  features: z.array(z.string().trim().max(200)).max(20),
  prices: z.record(z.string().max(40), z.string().trim().max(60)),
});
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
