import { z } from "zod";
import { passwordRule, usernameRule } from "../auth/auth.schemas.js";

const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email").max(254));
const text = (max: number) => z.string().trim().max(max, `Must be at most ${max} characters`).default("");

/** What an admin or tutor can fill in about a student. */
const profileFields = {
  firstName: z.string().trim().min(1, "First name is required").max(50, "First name must be at most 50 characters"),
  lastName: z.string().trim().max(49, "Last name must be at most 49 characters").default(""),
  email,
  phone: z.string().trim().regex(/^$|^\+?[0-9 ()-]{6,25}$/, "Enter a valid phone number").default(""),
  gender: z.enum(["", "Male", "Female", "Other", "Prefer not to say"]).default(""),
  headline: text(100),
  location: text(100),
  bio: text(1000),
  isActive: z.boolean().default(true),
};

/** Creating a student: the admin or tutor chooses the first password. */
export const createStudentSchema = z.object({ ...profileFields, username: usernameRule, password: passwordRule });

/** Changing a student. The username may stay empty; a new password is optional (leave it out to keep the old one). */
export const updateStudentSchema = z.object({
  ...profileFields,
  username: z.union([usernameRule, z.literal("")]).default(""),
  newPassword: passwordRule.optional(),
});

export type StudentFields = z.infer<typeof updateStudentSchema>;

export const bulkStudentsSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, "Choose at least one student").max(200, "Choose at most 200 students at a time"),
  action: z.enum(["activate", "deactivate", "delete"]),
});
