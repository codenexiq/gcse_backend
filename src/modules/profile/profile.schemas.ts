import { z } from "zod";
import { passwordRule, usernameRule } from "../auth/auth.schemas.js";

/** A text field that may be left empty. */
const optionalText = (max: number) => z.string().trim().max(max, `Must be at most ${max} characters`).default("");

export const profileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(50, "First name must be at most 50 characters"),
  lastName: z.string().trim().max(49, "Last name must be at most 49 characters").default(""),
  /** May stay empty; when given it must be free. */
  username: z.union([usernameRule, z.literal("")]).default(""),
  phone: z.string().trim().regex(/^$|^\+?[0-9 ()-]{6,25}$/, "Enter a valid phone number").default(""),
  gender: z.enum(["", "Male", "Female", "Other", "Prefer not to say"]).default(""),
  headline: optionalText(100),
  location: optionalText(100),
  bio: optionalText(1000),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password").max(72),
  newPassword: passwordRule,
});
export type PasswordInput = z.infer<typeof passwordSchema>;

/** The chat colour: exactly #rrggbb (so nothing else can ever be stored or put into a page), or null for the standard colour. */
export const chatColorSchema = z.object({ color: z.union([z.string().regex(/^#[0-9a-fA-F]{6}$/, "Choose a colour like #dff3e6"), z.null()]) });

export const IMAGE_KINDS = ["avatar", "cover"] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];

/** The biggest picture accepted. The website shrinks pictures before sending them, so real ones are far smaller. */
export const MAX_IMAGE_BYTES: Record<ImageKind, number> = { avatar: 2 * 1024 * 1024, cover: 4 * 1024 * 1024 };
