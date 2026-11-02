import { z } from "zod";

const ids = z.array(z.number().int().positive()).max(200, "Choose at most 200 students at a time");

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, "Give the group a name").max(80, "The name can be 80 characters at most"),
  description: z.string().trim().max(300, "The description can be 300 characters at most").default(""),
  studentIds: ids.default([]),
});

export const updateGroupSchema = z.object({
  name: z.string().trim().min(1, "Give the group a name").max(80, "The name can be 80 characters at most"),
  description: z.string().trim().max(300, "The description can be 300 characters at most").default(""),
});

export const addMembersSchema = z.object({ studentIds: ids.min(1, "Choose at least one student") });

export const sendGroupMessageSchema = z
  .object({
    body: z.string().trim().max(2000, "A message can be 2000 characters at most").optional(),
    attachmentId: z.number().int().positive().optional(),
    /** The message this one answers (it must be in the same group). */
    replyToId: z.number().int().positive().optional(),
  })
  .refine((m) => (m.body && m.body.length > 0) || m.attachmentId !== undefined, "Write a message or attach a file");
