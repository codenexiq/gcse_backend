import { z } from "zod";

const text = (max: number) => z.string().max(max).default("");

/** One block of a lesson. Maths is written between dollar signs. */
export const blockSchema = z.discriminatedUnion("type", [
  z.object({ id: z.string().min(1).max(40), type: z.literal("slide"), title: text(200), body: text(6000) }),
  z.object({ id: z.string().min(1).max(40), type: z.literal("video"), title: text(200), url: text(500), note: text(2000) }),
  z.object({
    id: z.string().min(1).max(40),
    type: z.literal("mcq"),
    question: text(2000),
    options: z.array(z.string().max(300)).length(4),
    correct: z.number().int().min(0).max(3),
    explain: text(2000),
  }),
  z.object({ id: z.string().min(1).max(40), type: z.literal("written"), question: text(2000), markScheme: text(3000), marks: z.number().int().min(1).max(6) }),
]);
export type Block = z.infer<typeof blockSchema>;

export const createSchema = z.object({
  topic: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1, "Give the lesson a title").max(150),
});

export const updateSchema = z.object({
  title: z.string().trim().min(1, "Give the lesson a title").max(150),
  published: z.boolean(),
  blocks: z.array(blockSchema).max(80, "A lesson can have 80 blocks at most"),
});

export const checkSchema = z.object({ blockId: z.string().min(1).max(40), choice: z.number().int().min(0).max(3) });

/** What a student sends when they finish: the option chosen for each multiple choice, the marks they gave themselves for each written question, and how long it took. */
export const finishSchema = z.object({
  answers: z.record(z.string().max(40), z.number().int().min(0).max(3)).default({}),
  written: z.record(z.string().max(40), z.number().int().min(0).max(6)).default({}),
  minutes: z.number().int().min(0).max(120).default(0),
});
export type FinishInput = z.infer<typeof finishSchema>;

export const markSchema = z.object({ blockId: z.string().min(1).max(40), answer: z.string().trim().min(1, "Write an answer first").max(2000) });
export const genieSchema = z.object({ blockId: z.string().min(1).max(40), question: z.string().trim().min(1, "Type your question first").max(1500), answered: z.boolean() });
export const practiceSchema = z.object({ topic: z.string().trim().min(1).max(100) });
export const redesignSchema = z.object({ topic: z.string().trim().min(1).max(100), slides: z.array(z.array(z.string().max(2000)).max(60)).min(1).max(60) });
export const questionsSchema = z.object({ topic: z.string().trim().min(1).max(100), slides: z.array(z.object({ title: z.string().max(200), body: z.string().max(6000) })).min(1).max(60) });

export const quizAiSchema = z.object({
  topic: z.string().trim().min(1).max(100),
  tier: z.enum(["Higher", "Foundation"]).default("Higher"),
  n: z.number().int().min(3).max(10).default(8),
  mix: z.enum(["mcq", "mixed", "written"]).default("mixed"),
  focus: z.string().trim().max(200).default(""),
});
/** A PDF worksheet or notes, sent as base64 (up to about 7 MB of file), to become a quiz or lesson notes. */
export const pdfAiSchema = z.object({
  topic: z.string().trim().min(1).max(100),
  mode: z.enum(["quiz", "notes"]),
  pdf: z.string().min(100).max(10_000_000),
});
