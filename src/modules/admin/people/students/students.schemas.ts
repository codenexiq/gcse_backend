import { z } from "zod";

const email = z.union([z.literal(""), z.string().trim().toLowerCase().email("Enter a valid email address").max(190)]);

export const updateStudentSchema = z.object({
  name: z.string().trim().min(1, "Give the student a name").max(120),
  email,
  level: z.string().min(1).max(40),
  year: z.string().trim().max(40).default(""),
  plan: z.string().min(1).max(40),
  parent: z.object({
    name: z.string().trim().max(120).default(""),
    email: z.union([z.literal(""), z.string().trim().toLowerCase().email("Enter a valid parent email").max(190)]).default(""),
    phone: z.string().trim().max(40).default(""),
  }),
});
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;

export const addEnrolmentSchema = z.object({ subjectId: z.string().min(1, "Choose a subject").max(40) });
