import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { env } from "../../config/env/index.js";
import { AppError } from "../../utils/AppError/index.js";
import type { Role } from "../auth/user.model.js";
import * as Quiz from "../quiz/quiz.model.js";
import { parseQuizFile } from "../quiz/quiz.schemas.js";

/** The account every connector call runs as. It can only do what that account can do on the website. */
export interface Actor {
  id: number;
  role: Role;
  fullName: string;
}

const kb = (bytes: number) => (bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`);
const ok = (text: string) => ({ content: [{ type: "text" as const, text }] });
const failed = (text: string) => ({ isError: true, content: [{ type: "text" as const, text }] });

/** A mistake in the quiz or a permission problem: its message is safe to show and tells Claude what to fix. Anything else is hidden. */
function fail(err: unknown, what: string) {
  if (err instanceof AppError) return failed(err.message);
  console.error(`[mcp] ${what} failed:`, err instanceof Error ? err.message : err);
  return failed(`The website had a problem while trying to ${what}. Nothing was changed.`);
}

const questionSchema = z.object({
  question: z.string().describe("The question text."),
  options: z.record(z.string(), z.string()).describe('The choices, keyed by letter A to F, for example { "A": "44°", "B": "54°", "C": "126°", "D": "36°" }. Two to six choices.'),
  correct: z.string().describe('The letter of the right choice, for example "B". It must be one of the option letters.'),
  explanation: z.string().optional().describe("Why that answer is right. Shown to students after they finish."),
  marks: z.number().int().min(1).max(20).optional().describe("Marks for the question (default 1)."),
  topic: z.string().optional().describe('The topic, for example "Angles on a straight line".'),
  ref: z.string().optional().describe('The question number as printed on the paper, for example "1(b)(ii)".'),
  diagram: z.string().optional().describe("A written description of the diagram, for students who cannot see one."),
  svg: z.string().optional().describe("An SVG picture for this question, as text starting with <svg and ending with </svg>. Keep it small and simple (shapes, lines, labels). No scripts or outside links: they are refused."),
  diagramKey: z.string().optional().describe("Instead of svg: the name of a picture in `diagrams`, so several questions can share one picture."),
});

const quizShape = {
  title: z.string().describe('The quiz title, for example "Velocity-time graphs".'),
  subtitle: z.string().optional().describe('For example "Edexcel GCSE Maths".'),
  instructions: z.string().optional().describe("Shown to students before they start."),
  questions: z.array(questionSchema).min(1).max(200).describe("The questions, in order."),
  diagrams: z.record(z.string(), z.string()).optional().describe('Named SVG pictures that questions can share, for example { "graph1": "<svg ...>...</svg>" }. Names use letters, numbers, - and _ only.'),
  scoring: z
    .object({ feedback: z.array(z.object({ min: z.number().int().min(0), max: z.number().int().min(0), message: z.string() })).optional() })
    .optional()
    .describe("Optional messages for ranges of scores (by number of questions right), for example { min: 0, max: 11, message: 'Keep practising!' }."),
};

type QuizArgs = {
  title: string;
  subtitle?: string;
  instructions?: string;
  questions: (z.infer<typeof questionSchema>)[];
  diagrams?: Record<string, string>;
  scoring?: { feedback?: { min: number; max: number; message: string }[] };
};

/** Turns the tool's input into the quiz file format the website's own checker reads. */
function toFile({ questions, diagrams, ...top }: QuizArgs) {
  return {
    ...top,
    questions: questions.map(({ svg, diagramKey, ...q }) => ({ ...q, ...(svg ? { svg } : {}), ...(diagramKey ? { diagramSvgKey: diagramKey } : {}) })),
    ...(diagrams ? { diagramSvgs: diagrams } : {}),
  };
}

export function createMcpServer(user: Actor): McpServer {
  const server = new McpServer({ name: "gcse-quiz", version: "0.3.0" });
  const link = (id: number) => ` Open it: ${env.frontendUrl}/tutor/dashboard/quizzes/${id}`;

  server.registerTool(
    "validate_quiz",
    {
      title: "Check a quiz with the website",
      description:
        "Checks a quiz with the website's real rules (questions, answers, SVG safety, sizes) WITHOUT saving anything. If something is wrong, the error says which question or diagram, so fix it and check again. Use this before upload_quiz.",
      inputSchema: quizShape,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => {
      try {
        const parsed = parseQuizFile(toFile(args));
        const marks = parsed.content.questions.reduce((sum, q) => sum + q.marks, 0);
        const bytes = Object.values(parsed.diagrams).reduce((sum, svg) => sum + Buffer.byteLength(svg), 0);
        return ok(`The website accepts this quiz (nothing was saved): "${parsed.title}", ${parsed.content.questions.length} questions, ${marks} marks, ${Object.keys(parsed.diagrams).length} diagram(s) (${kb(bytes)}).`);
      } catch (err) {
        return fail(err, "check the quiz");
      }
    }
  );

  server.registerTool(
    "upload_quiz",
    {
      title: "Upload a quiz",
      description:
        "Uploads a multiple-choice quiz to the GCSE Cloud website, with optional SVG diagrams (inline per question, or named in `diagrams` and shared). The website checks everything; if something is wrong the error says which question or field, so fix it and call again. " +
        "By default the quiz is saved HIDDEN from students (publish=false) so a tutor can look it over first; publish=true makes it visible at once. Afterwards call verify_quiz with the id to confirm it is on the website.",
      inputSchema: { ...quizShape, publish: z.boolean().optional().describe("true = visible to students immediately. Default false (saved hidden).") },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ publish, ...args }) => {
      try {
        const saved = await Quiz.create(user.id, parseQuizFile(toFile(args)), publish === true);
        console.log(`[mcp] ${user.fullName} uploaded quiz ${saved.id} (${saved.questionCount} questions, ${saved.published ? "published" : "hidden"})`);
        return ok(
          `Uploaded "${saved.title}" (quiz id ${saved.id}): ${saved.questionCount} questions, ${saved.totalMarks} marks. ` +
            (saved.published ? "It is PUBLISHED: students can take it now." : "It is saved HIDDEN from students.") +
            `${link(saved.id)} Call verify_quiz with id ${saved.id} to confirm it is on the website.`
        );
      } catch (err) {
        return fail(err, "upload the quiz");
      }
    }
  );

  server.registerTool(
    "verify_quiz",
    {
      title: "Verify a quiz is on the website",
      description:
        "Reads a quiz back FROM THE WEBSITE'S DATABASE and reports what is really stored: title, question count, whether it is published, and for each SVG diagram whether it is stored (and its size). Use it after upload_quiz to prove the upload worked.",
      inputSchema: { id: z.number().int().positive().describe("The quiz id, from upload_quiz or list_quizzes.") },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ id }) => {
      try {
        const quiz = await Quiz.find(id);
        if (!quiz) return failed("Quiz not found.");
        const questions = quiz.content.questions;
        const keys = [...new Set(questions.map((q) => q.diagramKey).filter(Boolean))];
        const lines = [
          `ON THE WEBSITE: quiz #${quiz.id} "${quiz.title}"${quiz.subtitle ? ` (${quiz.subtitle})` : ""}`,
          `${quiz.questionCount} questions, ${quiz.totalMarks} marks, ${quiz.published ? "PUBLISHED (students can take it)" : "HIDDEN from students"}, ${quiz.attemptCount} attempts, uploaded by ${quiz.createdByName}.`,
        ];
        let good = true;
        for (const key of keys) {
          const svg = await Quiz.findDiagram(id, key);
          const used = questions.filter((q) => q.diagramKey === key).map((q) => q.id);
          const stored = svg !== null && svg.trimStart().startsWith("<svg");
          good &&= stored;
          lines.push(`diagram "${key}": ${stored ? `stored OK (${kb(Buffer.byteLength(svg))})` : "PROBLEM: not stored"}  used by question${used.length === 1 ? "" : "s"} ${used.join(", ")}`);
        }
        if (keys.length === 0) lines.push("No SVG diagrams in this quiz.");
        const noAnswer = questions.filter((q) => !q.correct).length;
        if (noAnswer) lines.push(`WARNING: ${noAnswer} question(s) have no correct answer stored.`);
        lines.push(good && !noAnswer ? "RESULT: everything is on the website and working." : "RESULT: there are problems, see above.");
        lines.push(`Dashboard: ${env.frontendUrl}/tutor/dashboard/quizzes/${id}`);
        return ok(lines.join("\n"));
      } catch (err) {
        return fail(err, "read the quiz");
      }
    }
  );

  server.registerTool(
    "list_quizzes",
    {
      title: "List quizzes",
      description: "Lists the quizzes on the website with their id, size, whether students can see them, who uploaded them, and how many attempts there are.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      try {
        const quizzes = await Quiz.list({ id: user.id, role: user.role });
        if (quizzes.length === 0) return ok("There are no quizzes yet.");
        return ok(quizzes.map((q) => `#${q.id}  ${q.title}${q.subtitle ? ` (${q.subtitle})` : ""}  |  ${q.questionCount} questions, ${q.totalMarks} marks  |  ${q.published ? "published" : "hidden"}  |  ${q.attemptCount} attempts  |  by ${q.createdByName}`).join("\n"));
      } catch (err) {
        return fail(err, "list the quizzes");
      }
    }
  );

  server.registerTool(
    "set_quiz_published",
    {
      title: "Publish or hide a quiz",
      description: "Makes a quiz visible to students (published=true) or hides it (published=false). Only the tutor who uploaded it, or an admin, can change it.",
      inputSchema: {
        id: z.number().int().positive().describe("The quiz id, from upload_quiz or list_quizzes."),
        published: z.boolean().describe("true = visible to students, false = hidden."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ id, published }) => {
      try {
        const quiz = await Quiz.find(id);
        if (!quiz) return failed("Quiz not found.");
        if (user.role !== "admin" && quiz.createdBy !== user.id) return failed("Only an admin or the tutor who uploaded this quiz can change it.");
        await Quiz.setPublished(id, published);
        console.log(`[mcp] ${user.fullName} set quiz ${id} to ${published ? "published" : "hidden"}`);
        return ok(`Quiz ${id} is now ${published ? "PUBLISHED: students can take it" : "HIDDEN from students"}.`);
      } catch (err) {
        return fail(err, "change the quiz");
      }
    }
  );

  return server;
}
