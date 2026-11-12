import { z } from "zod";
import { passwordRule } from "./auth.schemas.js";

const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email").max(254));
const short = (max: number) => z.string().trim().max(max).default("");

/** The sign-up wizard: level, plan, subjects (each with tier, exam board and grades), the student's details and a parent or guardian. */
export const signupSchema = z.object({
  level: z.string().min(1).max(40),
  plan: z.string().min(1).max(40),
  subjects: z
    .array(z.object({ id: z.string().min(1).max(40), tier: short(30), board: short(40), current: short(30), target: short(30) }))
    .min(1, "Choose at least one subject.")
    .max(12),
  name: z.string().trim().min(1, "Add the student's name.").max(100),
  email,
  password: passwordRule,
  year: short(30),
  parent: z.object({ name: z.string().trim().min(1, "Add the parent's name.").max(100), email, phone: short(30) }),
  consent: z.literal(true, { error: "Tick to agree to the terms." }),
  recordingOk: z.boolean().default(false),
});
export type SignupInput = z.infer<typeof signupSchema>;
