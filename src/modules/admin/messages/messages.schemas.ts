import { z } from "zod";

export const sendMessageSchema = z.object({ text: z.string().trim().min(1, "Write a message first.").max(2000) });
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
