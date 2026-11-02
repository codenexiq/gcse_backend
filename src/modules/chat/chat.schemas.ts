import { z } from "zod";

export const sendSchema = z
  .object({
    // The other person in the chat: a student names the tutor or admin, a tutor or admin names the student.
    peerId: z.number().int().positive().optional(),
    body: z.string().trim().max(2000, "A message can be 2000 characters at most").optional(),
    attachmentId: z.number().int().positive().optional(),
    /** The message this one answers (it must be in the same chat). */
    replyToId: z.number().int().positive().optional(),
  })
  .refine((m) => (m.body && m.body.length > 0) || m.attachmentId !== undefined, "Write a message or attach a file");
export type SendInput = z.infer<typeof sendSchema>;

/** Only these kinds of file can be shared. Nothing that can run (.exe, .js, .html, .svg ...). */
export const ALLOWED_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "gif", "webp", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv"];
/** "Delete for everyone" only works this long after a message was sent. */
export const DELETE_FOR_EVERYONE_SECONDS = 10 * 60;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
