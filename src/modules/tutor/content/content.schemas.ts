import { z } from "zod";

const text = (max: number) => z.string().max(max).default("");

/** One part of an item. The editor sends them in order; the order is the order students see. */
export const blockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("slide"), title: text(160), body: text(8000) }),
  z.object({ type: z.literal("video"), title: text(160), url: text(500), note: text(2000) }),
  z.object({
    type: z.literal("mcq"),
    question: text(2000),
    options: z.array(z.string().max(300)).min(2).max(6),
    correct: z.number().int().min(0).max(5),
    explain: text(2000),
  }),
  z.object({ type: z.literal("written"), question: text(2000), markScheme: text(2000), marks: z.number().int().min(1).max(6) }),
]);
export type Block = z.infer<typeof blockSchema>;

export const KINDS = ["lesson", "notes", "quiz", "video"] as const;

export const createItemSchema = z.object({ subject: z.string().min(1).max(40), level: z.string().min(1).max(40), kind: z.enum(KINDS) });
export const saveItemSchema = z.object({
  title: z.string().trim().min(1, "Give it a title.").max(160),
  kind: z.enum(KINDS),
  topicId: z.number().int().positive().nullable(),
  published: z.boolean(),
  blocks: z.array(blockSchema).max(100),
});
export type SaveItemInput = z.infer<typeof saveItemSchema>;

export const createRouteSchema = z.object({ subject: z.string().min(1).max(40), level: z.string().min(1).max(40) });
export const saveRouteSchema = z.object({
  name: z.string().trim().min(1, "Give the route a name.").max(160),
  steps: z.array(z.object({ itemId: z.number().int().positive(), week: z.number().int().min(1).max(12) })).max(200),
  groups: z.array(z.number().int().positive()).max(100),
  enrolments: z.array(z.number().int().positive()).max(500),
});
export type SaveRouteInput = z.infer<typeof saveRouteSchema>;
