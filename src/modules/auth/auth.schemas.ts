import { z } from "zod";

const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email").max(254));

export const registerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Full name is required")
    .max(100, "Full name must be at most 100 characters"),
  email,
  // bcrypt only uses the first 72 bytes, so cap the length there.
  password: z
    .string()
    .min(10, "Password must be at least 10 characters")
    .max(72, "Password must be at most 72 characters")
    .regex(/[a-z]/, "Password needs a lowercase letter")
    .regex(/[A-Z]/, "Password needs an uppercase letter")
    .regex(/[0-9]/, "Password needs a number"),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required").max(72),
});

export type Credentials = z.infer<typeof registerSchema>;
