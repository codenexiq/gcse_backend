import { z } from "zod";

const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email").max(254));

/** The rules for a new password (also used when it is changed). bcrypt only uses the first 72 bytes, so cap the length there. */
export const passwordRule = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(72, "Password must be at most 72 characters")
  .regex(/[a-z]/, "Password needs a lowercase letter")
  .regex(/[A-Z]/, "Password needs an uppercase letter")
  .regex(/[0-9]/, "Password needs a number");

/** A short unique @name: lower case letters, numbers, dots and underscores. */
export const usernameRule = z.string().trim().toLowerCase().regex(/^[a-z0-9_.]{3,30}$/, "Username must be 3-30 letters, numbers, dots or underscores");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required").max(72),
});

export type Credentials = z.infer<typeof loginSchema>;
