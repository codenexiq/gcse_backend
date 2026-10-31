import { z } from "zod";

const text = (name: string, max: number) => z.string().trim().min(1, `${name} is required`).max(max, `${name} is too long`);

export const updateContentSchema = z.object({
  badge: text("Badge", 60),
  heading: text("Heading", 120),
  intro: text("Intro text", 300),
  hint: text("Hint text", 300),
  highlight: text("Highlighted phrase", 80),
  buttonLabel: text("Button label", 40),
  nextLabel: text("Label", 60),
  nextHeading: text("Heading", 120),
  nextText: text("Text", 300),
  questions: z.number().int("Questions must be a whole number").min(1, "At least 1 question").max(100, "At most 100 questions"),
});

export type ContentUpdate = z.infer<typeof updateContentSchema>;
