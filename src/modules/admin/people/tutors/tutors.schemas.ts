import { z } from "zod";

const email = z.union([z.literal(""), z.string().trim().toLowerCase().email("Enter a valid email address").max(190)]);

export const updateTutorSchema = z.object({
  name: z.string().trim().min(1, "Give the tutor a name").max(120),
  email,
  phone: z.string().trim().max(40).default(""),
  subjects: z.array(z.string().max(40)).max(60),
});
export type UpdateTutorInput = z.infer<typeof updateTutorSchema>;
