import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../../config/db/index.js";
import type { Role } from "../auth/user.model.js";
import type { ParsedQuiz, QuizContent } from "./quiz.schemas.js";

interface QuizRow extends RowDataPacket {
  id: number;
  title: string;
  subtitle: string | null;
  instructions: string | null;
  question_count: number;
  total_marks: number;
  content: string;
  published: number;
  created_by: number;
  creator_name: string;
  created_at: Date;
  attempt_count: number;
  my_attempts?: number;
  my_best?: number | null;
}

interface AttemptRow extends RowDataPacket {
  id: number;
  quiz_id: number;
  student_id: number;
  student_name: string;
  user_code: string | null;
  score: number;
  marks: number;
  question_count: number;
  total_marks: number;
  created_at: Date;
}

const summary = (r: QuizRow) => ({
  id: r.id,
  title: r.title,
  subtitle: r.subtitle ?? "",
  instructions: r.instructions ?? "",
  questionCount: r.question_count,
  totalMarks: r.total_marks,
  published: Boolean(r.published),
  createdBy: r.created_by,
  createdByName: r.creator_name,
  createdAt: r.created_at,
  attemptCount: Number(r.attempt_count ?? 0),
  myAttempts: r.my_attempts === undefined ? undefined : Number(r.my_attempts),
  myBest: r.my_best === undefined || r.my_best === null ? null : Number(r.my_best),
});

const attempt = (r: AttemptRow) => ({
  id: r.id,
  quizId: r.quiz_id,
  studentId: r.student_id,
  studentName: r.student_name,
  studentCode: r.user_code ?? "",
  score: r.score,
  marks: r.marks,
  questionCount: r.question_count,
  totalMarks: r.total_marks,
  createdAt: r.created_at,
});

const readContent = (text: string): QuizContent => JSON.parse(text) as QuizContent;

const SELECT = `SELECT q.id, q.title, q.subtitle, q.instructions, q.question_count, q.total_marks, q.published, q.created_by, q.created_at,
    COALESCE(NULLIF(u.full_name, ''), u.email) AS creator_name,
    (SELECT COUNT(*) FROM quiz_attempts a WHERE a.quiz_id = q.id) AS attempt_count`;

/** Saves an uploaded quiz (published straight away). */
export async function create(userId: number, quiz: ParsedQuiz, published = true) {
  const marks = quiz.content.questions.reduce((sum, q) => sum + q.marks, 0);
  // The quiz and its pictures are saved together or not at all.
  const conn = await pool.getConnection();
  let id: number;
  try {
    await conn.beginTransaction();
    const [result] = await conn.query<ResultSetHeader>(
      "INSERT INTO quizzes (title, subtitle, instructions, question_count, total_marks, content, published, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [quiz.title, quiz.subtitle || null, quiz.instructions || null, quiz.content.questions.length, marks, JSON.stringify(quiz.content), published ? 1 : 0, userId]
    );
    id = result.insertId;
    for (const [key, svg] of Object.entries(quiz.diagrams)) await conn.query("INSERT INTO quiz_diagrams (quiz_id, diagram_key, svg) VALUES (?, ?, ?)", [id, key, svg]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  return (await findSummary(id))!;
}

/** Replaces a quiz's title, questions and pictures with an edited version. Who took it, and what they scored, stays as it was. Whether it is published is not changed. */
export async function update(id: number, quiz: ParsedQuiz) {
  const marks = quiz.content.questions.reduce((sum, q) => sum + q.marks, 0);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      "UPDATE quizzes SET title = ?, subtitle = ?, instructions = ?, question_count = ?, total_marks = ?, content = ? WHERE id = ?",
      [quiz.title, quiz.subtitle || null, quiz.instructions || null, quiz.content.questions.length, marks, JSON.stringify(quiz.content), id]
    );
    await conn.query("DELETE FROM quiz_diagrams WHERE quiz_id = ?", [id]);
    for (const [key, svg] of Object.entries(quiz.diagrams)) await conn.query("INSERT INTO quiz_diagrams (quiz_id, diagram_key, svg) VALUES (?, ?, ?)", [id, key, svg]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  return (await findSummary(id))!;
}

/** Every picture of a quiz, by name (for the editor). */
export async function diagramsOf(quizId: number) {
  const [rows] = await pool.query<(RowDataPacket & { diagram_key: string; svg: string })[]>("SELECT diagram_key, svg FROM quiz_diagrams WHERE quiz_id = ?", [quizId]);
  return Object.fromEntries(rows.map((r) => [r.diagram_key, r.svg]));
}

/** The SVG text of one picture of a quiz, or null. */
export async function findDiagram(quizId: number, key: string) {
  const [rows] = await pool.query<(RowDataPacket & { svg: string })[]>("SELECT svg FROM quiz_diagrams WHERE quiz_id = ? AND diagram_key = ?", [quizId, key]);
  return rows[0]?.svg ?? null;
}

async function findSummary(id: number) {
  const [rows] = await pool.query<QuizRow[]>(`${SELECT} FROM quizzes q JOIN users u ON u.id = q.created_by WHERE q.id = ?`, [id]);
  return rows[0] ? summary(rows[0]) : null;
}

/** Tutors and admins see every quiz; a student sees the published ones, with their own attempts. */
export async function list(viewer: { id: number; role: Role }) {
  if (viewer.role === "student") {
    const [rows] = await pool.query<QuizRow[]>(
      `${SELECT},
        (SELECT COUNT(*) FROM quiz_attempts a WHERE a.quiz_id = q.id AND a.student_id = ?) AS my_attempts,
        (SELECT MAX(a.score) FROM quiz_attempts a WHERE a.quiz_id = q.id AND a.student_id = ?) AS my_best
       FROM quizzes q JOIN users u ON u.id = q.created_by WHERE q.published = 1 ORDER BY q.created_at DESC, q.id DESC LIMIT 200`,
      [viewer.id, viewer.id]
    );
    // A student does not need to know who uploaded it or how many others tried it.
    return rows.map((r) => ({ ...summary(r), createdByName: "", attemptCount: 0 }));
  }
  const [rows] = await pool.query<QuizRow[]>(`${SELECT} FROM quizzes q JOIN users u ON u.id = q.created_by ORDER BY q.created_at DESC, q.id DESC LIMIT 200`);
  return rows.map(summary);
}

/** One quiz with its content, or null. */
export async function find(id: number) {
  const [rows] = await pool.query<QuizRow[]>(`${SELECT}, q.content FROM quizzes q JOIN users u ON u.id = q.created_by WHERE q.id = ?`, [id]);
  const row = rows[0];
  return row ? { ...summary(row), content: readContent(row.content) } : null;
}

type Found = NonNullable<Awaited<ReturnType<typeof find>>>;

/** What a tutor sees: everything, answers included. */
export const forTutor = (quiz: Found) => ({ ...quiz, questions: quiz.content.questions, content: undefined });

/** What a student gets to answer: no correct answers and no explanations. */
export function forStudent(quiz: Found) {
  return {
    id: quiz.id,
    title: quiz.title,
    subtitle: quiz.subtitle,
    instructions: quiz.instructions,
    questionCount: quiz.questionCount,
    totalMarks: quiz.totalMarks,
    questions: quiz.content.questions.map(({ id, ref, marks, topic, diagram, diagramKey, diagramPosition, question, options }) => ({ id, ref, marks, topic, diagram, diagramKey: diagramKey ?? "", diagramPosition: diagramPosition ?? "below", question, options })),
  };
}

/** The message for a score: the file's own bands when it has one for that score, otherwise one by percentage. */
function messageFor(content: QuizContent, score: number, count: number) {
  const band = content.feedback.find((b) => score >= b.min && score <= b.max);
  if (band) return band.message;
  const pct = count ? (score / count) * 100 : 0;
  return pct >= 80 ? "Excellent work!" : pct >= 50 ? "Good work! A few more to master." : "Keep practising and try again.";
}

/** Marks an attempt, saves it, and returns the result with the right answers and explanations. */
export async function submitAttempt(studentId: number, quiz: Found, answers: Record<string, string>) {
  const results = quiz.content.questions.map((q) => {
    const chosen = answers[String(q.id)] ?? "";
    return { id: q.id, chosen, correct: q.correct, isCorrect: chosen === q.correct, marks: q.marks, explanation: q.explanation, options: q.options, question: q.question, topic: q.topic };
  });
  const score = results.filter((r) => r.isCorrect).length;
  const marks = results.filter((r) => r.isCorrect).reduce((sum, r) => sum + r.marks, 0);
  const saved: Record<string, string> = {};
  for (const r of results) if (r.chosen) saved[String(r.id)] = r.chosen;
  const [result] = await pool.query<ResultSetHeader>(
    "INSERT INTO quiz_attempts (quiz_id, student_id, score, marks, question_count, total_marks, answers) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [quiz.id, studentId, score, marks, quiz.questionCount, quiz.totalMarks, JSON.stringify(saved)]
  );
  return { attemptId: result.insertId, score, questionCount: quiz.questionCount, marks, totalMarks: quiz.totalMarks, message: messageFor(quiz.content, score, quiz.questionCount), results };
}

/** Tutors and admins see every attempt at a quiz; a student only their own. Newest first. */
export async function listAttempts(quizId: number, viewer: { id: number; role: Role }) {
  const own = viewer.role === "student";
  const [rows] = await pool.query<AttemptRow[]>(
    `SELECT a.id, a.quiz_id, a.student_id, COALESCE(NULLIF(u.full_name, ''), u.email) AS student_name, u.user_code,
        a.score, a.marks, a.question_count, a.total_marks, a.created_at
       FROM quiz_attempts a JOIN users u ON u.id = a.student_id
      WHERE a.quiz_id = ? ${own ? "AND a.student_id = ?" : ""} ORDER BY a.created_at DESC, a.id DESC LIMIT 500`,
    own ? [quizId, viewer.id] : [quizId]
  );
  return rows.map(attempt);
}

export async function setPublished(id: number, published: boolean) {
  const [result] = await pool.query<ResultSetHeader>("UPDATE quizzes SET published = ? WHERE id = ?", [published ? 1 : 0, id]);
  return result.affectedRows > 0;
}

export async function remove(id: number) {
  const [result] = await pool.query<ResultSetHeader>("DELETE FROM quizzes WHERE id = ?", [id]);
  return result.affectedRows > 0;
}
