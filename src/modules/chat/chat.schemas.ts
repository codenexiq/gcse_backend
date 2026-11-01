import { z } from "zod";

export const sendSchema = z
  .object({
    // Tutors and admins say which student's conversation; a student always writes in their own.
    studentId: z.number().int().positive().optional(),
    body: z.string().trim().max(2000, "A message can be 2000 characters at most").optional(),
    attachmentId: z.number().int().positive().optional(),
  })
  .refine((m) => (m.body && m.body.length > 0) || m.attachmentId !== undefined, "Write a message or attach a file");
export type SendInput = z.infer<typeof sendSchema>;

/** Only these kinds of file can be shared. Nothing that can run (.exe, .js, .html, .svg ...). */
export const ALLOWED_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "gif", "webp", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv"];
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
