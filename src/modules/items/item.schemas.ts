import { z } from "zod";

export const createItemSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(100, "Title is too long"),
  description: z.string().trim().max(1000, "Description is too long").optional(),
  topicId: z.number().int().positive().optional(),
});

export type NewItem = z.infer<typeof createItemSchema>;
