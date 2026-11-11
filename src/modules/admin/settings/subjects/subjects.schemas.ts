import { z } from "zod";

export const SUBJECT_ICONS = ["maths", "physics", "chemistry", "biology", "english", "computing", "humanities", "languages", "book"] as const;

export const createSubjectSchema = z.object({ name: z.string().trim().min(1, "Type a name first.").max(80) });

export const updateSubjectSchema = z.object({
  name: z.string().trim().min(1, "Give the subject a name").max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Choose a colour"),
  icon: z.enum(SUBJECT_ICONS),
  levels: z.array(z.string().max(40)).max(40),
});
export type UpdateSubjectInput = z.infer<typeof updateSubjectSchema>;
