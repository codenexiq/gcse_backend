import { z } from "zod";
import { pool } from "../../config/db/index.js";
import { AppError } from "../../utils/AppError/index.js";
import { addMessage, saveAttachment } from "./chat.model.js";

/** The biggest file that can be sent in a message (3 MB). The browser sends it as base64 text, which is about a third longer. */
export const MAX_FILE_BYTES = 3 * 1024 * 1024;

/** The message the student, teacher and admin screens send: some text, a file, or both. */
export const sendMessageSchema = z
  .object({
    text: z.string().trim().max(2000).default(""),
    attachment: z
      .object({
        name: z.string().trim().min(1).max(150),
        type: z.string().max(100).default(""),
        size: z.number().int().nonnegative().max(MAX_FILE_BYTES),
        data: z.string().max(Math.ceil(MAX_FILE_BYTES * 1.4)).optional(),
      })
      .optional(),
  })
  .refine((m) => m.text.length > 0 || m.attachment, { message: "Write a message first.", path: ["text"] });
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

/** Saves one message from `senderId` in the chat of this student and teacher, with its file if there is one. */
export async function saveMessage(studentId: number, staffId: number, senderId: number, input: SendMessageInput) {
  const file = input.attachment;
  if (!file) {
    await pool.query("INSERT INTO chat_messages (student_id, staff_id, sender_id, body) VALUES (?, ?, ?, ?)", [studentId, staffId, senderId, input.text]);
    return;
  }
  // "data:image/png;base64,AAAA" or plain base64.
  const base64 = (file.data ?? "").replace(/^data:[^,]*,/, "");
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length === 0) throw new AppError(400, "That file could not be read. Please attach it again.");
  if (bytes.length > MAX_FILE_BYTES) throw new AppError(400, "That file is over 3 MB. Share a smaller file.");
  const saved = await saveAttachment({ studentId, staffId }, senderId, file.name.replace(/[\/\r\n]/g, "_"), bytes);
  const id = await addMessage({ studentId, staffId }, senderId, input.text, saved.id);
  if (id === null) throw new AppError(400, "That file could not be sent.");
}
