import { z } from "zod";
import { AppError } from "../../utils/AppError/index.js";

export const MAX_QUESTIONS = 200;
export const MAX_DIAGRAMS = 30;
const MAX_SVG_BYTES = 2_000_000;
/** A diagram's name in the file ("page1"): letters, numbers, - and _ only, so it is safe in an address. */
export const DIAGRAM_KEY = /^[A-Za-z0-9_-]{1,40}$/;

const letter = z.string().regex(/^[A-F]$/, "Option letters must be A to F");

const questionSchema = z
  .object({
    ref: z.string().trim().max(40, "ref is at most 40 characters").default(""),
    marks: z.number({ error: "marks must be a number" }).int("marks must be a whole number").min(1, "marks must be at least 1").max(20, "marks can be 20 at most").default(1),
    topic: z.string().trim().max(150, "topic is at most 150 characters").default(""),
    diagramKey: z.string().regex(DIAGRAM_KEY, "the diagram name can use letters, numbers, - and _ (40 at most)").default(""),
    diagram: z.string().trim().max(1500, "diagram is at most 1500 characters").default(""),
    question: z.string({ error: "the question text is missing" }).trim().min(1, "the question text is empty").max(1000, "the question is at most 1000 characters"),
    options: z.record(letter, z.string().trim().min(1, "an option is empty").max(500, "an option is at most 500 characters"), { error: "options must list the choices, like { \"A\": \"...\", \"B\": \"...\" }" }),
    correct: letter,
    explanation: z.string().trim().max(1500, "explanation is at most 1500 characters").default(""),
  })
  .refine((q) => Object.keys(q.options).length >= 2 && Object.keys(q.options).length <= 6, { message: "a question needs 2 to 6 options", path: ["options"] })
  .refine((q) => q.correct in q.options, { message: "\"correct\" must be one of the option letters", path: ["correct"] });

/** Things that must never be inside an uploaded SVG. The SVG is also only ever shown as a picture (never as part of the page), and is served with a locked-down policy, so this is a second line of defence. */
const SVG_REFUSED: [RegExp, string][] = [
  [/<\s*script/i, "contains a script"],
  [/<\s*(foreignObject|iframe|embed|object|audio|video|link|meta)\b/i, "contains an element that is not allowed (foreignObject, iframe, embed, object...)"],
  [/<\s*(animate|set)\b/i, "contains <animate> or <set>, which are not allowed"],
  [/<!\s*(DOCTYPE|ENTITY)/i, "contains a DOCTYPE or ENTITY declaration"],
  [/[\s"'\/]on[a-z]+\s*=/i, "contains an event handler (like onclick or onload)"],
  [/javascript\s*:/i, "contains a javascript: link"],
  [/@import/i, "contains an @import"],
  [/url\(\s*['"]?\s*(?!#)/i, "refers to something outside the picture with url()"],
];

/** Checks an SVG from the file and returns it trimmed. Throws a 400 that names the diagram and says what is wrong. */
function checkSvg(label: string, svg: unknown): string {
  if (typeof svg !== "string") throw new AppError(400, `${label} must be SVG text`);
  const text = svg.trim();
  if (Buffer.byteLength(text) > MAX_SVG_BYTES) throw new AppError(400, `${label} is over 2 MB`);
  if (!/^(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(text) || !/<\/svg>\s*$/i.test(text)) throw new AppError(400, `${label} is not an SVG (it should start with <svg and end with </svg>)`);
  for (const [pattern, why] of SVG_REFUSED) if (pattern.test(text)) throw new AppError(400, `${label} ${why}`);
  // Links inside the picture may only point to other parts of it (#id) or to a small embedded image.
  for (const m of text.matchAll(/(?:xlink:)?href\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    const target = (m[1] ?? m[2] ?? "").trim();
    if (!/^#/.test(target) && !/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(target)) throw new AppError(400, `${label} links to something outside the picture`);
  }
  return text;
}

const feedbackSchema = z.array(
  z.object({
    min: z.number().int().min(0),
    max: z.number().int().min(0),
    message: z.string().trim().min(1).max(300),
  })
);

/** The top of a quiz file. The questions are checked one by one afterwards, so a mistake can be pointed to by number. Colours and other extras in the file are ignored. */
const topSchema = z.object({
  title: z.string({ error: "The file needs a \"title\"" }).trim().min(1, "The \"title\" is empty").max(150, "The title is at most 150 characters"),
  subtitle: z.string().trim().max(150, "The subtitle is at most 150 characters").optional(),
  instructions: z.string().trim().max(1000, "The instructions are at most 1000 characters").optional(),
  questions: z.array(z.unknown(), { error: "The file needs a \"questions\" list" }).min(1, "The file has no questions").max(MAX_QUESTIONS, `A quiz can have ${MAX_QUESTIONS} questions at most`),
  scoring: z.object({ feedback: feedbackSchema.optional() }).optional(),
  // Alternative wording some files use for the same things.
  examBoard: z.string().trim().max(150).optional(),
  // The pictures, by name. A question points at one with "diagramKey" (or "diagramSvgKey").
  diagramSvgs: z.record(z.string(), z.unknown()).optional(),
});

export interface QuizQuestion {
  id: number;
  ref: string;
  marks: number;
  topic: string;
  /** Written description of the diagram. */
  diagram: string;
  /** The name of the SVG picture for this question ("" if none). */
  diagramKey: string;
  question: string;
  options: Record<string, string>;
  correct: string;
  explanation: string;
}
export interface QuizContent {
  questions: QuizQuestion[];
  feedback: { min: number; max: number; message: string }[];
}
export interface ParsedQuiz {
  title: string;
  subtitle: string;
  instructions: string;
  content: QuizContent;
  /** name -> checked SVG text, only the pictures some question uses. */
  diagrams: Record<string, string>;
}

/** Files from different tools word things differently: accept the common alternatives for the same field. */
function withAliases(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return raw;
  const r = raw as Record<string, unknown>;
  const ref = r.ref ?? r.number;
  return {
    ...r,
    question: r.question ?? r.prompt,
    correct: r.correct ?? r.correctOption,
    ref: typeof ref === "number" ? String(ref) : ref,
    diagramKey: r.diagramKey ?? r.diagramSvgKey,
  };
}

/** Checks an uploaded quiz file and turns it into the shape we keep. Throws a 400 whose message says exactly what is wrong. */
export function parseQuizFile(body: unknown): ParsedQuiz {
  const top = topSchema.safeParse(body);
  if (!top.success) throw new AppError(400, top.error.issues[0]?.message ?? "This is not a quiz file");
  const sources = top.data.diagramSvgs ?? {};
  const diagrams: Record<string, string> = {};
  const addDiagram = (key: string, label: string, svg: unknown) => {
    if (diagrams[key] !== undefined) return;
    if (Object.keys(diagrams).length >= MAX_DIAGRAMS) throw new AppError(400, `A quiz can have ${MAX_DIAGRAMS} diagrams at most`);
    diagrams[key] = checkSvg(label, svg);
  };

  const questions = top.data.questions.map((raw, i): QuizQuestion => {
    const q = questionSchema.safeParse(withAliases(raw));
    if (!q.success) {
      const issue = q.error.issues[0];
      const where = issue?.path.length ? ` (${issue.path.join(".")})` : "";
      throw new AppError(400, `Question ${i + 1}${where}: ${issue?.message ?? "is not valid"}`);
    }
    let diagramKey = q.data.diagramKey;
    // An SVG written straight into the question gets a name of its own.
    const fields = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
    const own = fields.svg ?? fields.diagramSvg;
    if (typeof own === "string" && own.trim()) {
      diagramKey = `q${i + 1}`;
      addDiagram(diagramKey, `The diagram for question ${i + 1}`, own);
    } else if (diagramKey) {
      if (!(diagramKey in sources)) throw new AppError(400, `Question ${i + 1}: the diagram "${diagramKey}" is not in the file's diagramSvgs`);
      addDiagram(diagramKey, `Diagram "${diagramKey}"`, sources[diagramKey]);
    }
    // Numbered 1, 2, 3... by their place in the file, so a file's own ids can never clash.
    return { id: i + 1, ...q.data, diagramKey, options: Object.fromEntries(Object.entries(q.data.options).sort(([a], [b]) => a.localeCompare(b))) };
  });
  return {
    title: top.data.title,
    subtitle: top.data.subtitle ?? top.data.examBoard ?? "",
    instructions: top.data.instructions ?? "",
    content: { questions, feedback: top.data.scoring?.feedback ?? [] },
    diagrams,
  };
}

export const attemptSchema = z.object({
  // question number -> chosen letter
  answers: z.record(z.string().regex(/^\d{1,3}$/), letter),
});
export type AttemptInput = z.infer<typeof attemptSchema>;

export const publishSchema = z.object({ published: z.boolean() });
