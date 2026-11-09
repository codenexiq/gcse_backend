import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../../config/db/index.js";
import { AppError } from "../../utils/AppError/index.js";
import type { Block, FinishInput } from "./lesson.schemas.js";

interface Row extends RowDataPacket {
  id: number;
  topic: string;
  title: string;
  blocks: string;
  published: number;
  created_by: number;
  updated_at: Date;
}

const parse = (r: Row): Block[] => {
  try {
    return JSON.parse(r.blocks) as Block[];
  } catch {
    return [];
  }
};

const toLesson = (r: Row) => ({ id: r.id, topic: r.topic, title: r.title, published: Boolean(r.published), createdBy: r.created_by, blocks: parse(r), updatedAt: r.updated_at });
export type Lesson = ReturnType<typeof toLesson>;

export async function find(id: number) {
  const [rows] = await pool.query<Row[]>("SELECT * FROM lessons WHERE id = ?", [id]);
  return rows[0] ? toLesson(rows[0]) : null;
}

/** Every strand with its topics and how many lessons each topic has (for the topic list on the lessons page). */
export async function summary() {
  const [rows] = await pool.query<(RowDataPacket & { strand: string; topic: string; n: number })[]>(
    `SELECT s.name AS strand, t.name AS topic, (SELECT COUNT(*) FROM lessons l WHERE l.topic = t.name) AS n
       FROM learning_topics t JOIN learning_strands s ON s.id = t.strand_id ORDER BY s.position, s.id, t.position, t.id`
  );
  const strands: { name: string; topics: { name: string; count: number }[] }[] = [];
  for (const r of rows) {
    let strand = strands.find((x) => x.name === r.strand);
    if (!strand) strands.push((strand = { name: r.strand, topics: [] }));
    strand.topics.push({ name: r.topic, count: Number(r.n) });
  }
  return strands;
}

export async function listForTopic(topic: string) {
  const [rows] = await pool.query<Row[]>("SELECT * FROM lessons WHERE topic = ? ORDER BY id", [topic]);
  return rows.map(toLesson);
}

export async function create(userId: number, topic: string, title: string) {
  const [known] = await pool.query<RowDataPacket[]>("SELECT id FROM learning_topics WHERE name = ?", [topic]);
  if (known.length === 0) throw new AppError(400, "That topic is not on the learning map");
  const [result] = await pool.query<ResultSetHeader>("INSERT INTO lessons (topic, title, blocks, published, created_by) VALUES (?, ?, '[]', 0, ?)", [topic, title, userId]);
  return (await find(result.insertId))!;
}

export async function update(id: number, title: string, published: boolean, blocks: Block[]) {
  // A lesson with nothing in it can not be shown to students.
  const showing = published && blocks.length > 0;
  await pool.query("UPDATE lessons SET title = ?, published = ?, blocks = ? WHERE id = ?", [title, showing ? 1 : 0, JSON.stringify(blocks), id]);
  return find(id);
}

export async function remove(id: number) {
  const [result] = await pool.query<ResultSetHeader>("DELETE FROM lessons WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

/** What a student is sent: the blocks without the right answers, explanations and mark schemes. */
export function forStudent(l: Pick<Lesson, "id" | "topic" | "title" | "blocks">) {
  return {
    id: l.id,
    topic: l.topic,
    title: l.title,
    blocks: l.blocks.map((b) => {
      if (b.type === "mcq") return { id: b.id, type: b.type, question: b.question, options: b.options };
      if (b.type === "written") return { id: b.id, type: b.type, question: b.question, marks: b.marks };
      return b;
    }),
  };
}

/** Marks one multiple choice answer straight away: whether it was right, which was right, and why. */
export function check(l: Pick<Lesson, "blocks">, blockId: string, choice: number) {
  const b = l.blocks.find((x) => x.id === blockId);
  if (!b || b.type !== "mcq") throw new AppError(400, "That is not a multiple choice question");
  return { correct: choice === b.correct, correctIndex: b.correct, explain: b.explain };
}

/** After a written answer is handed in: what the mark scheme says, so the student can mark it. */
export function scheme(l: Lesson, blockId: string) {
  const b = l.blocks.find((x) => x.id === blockId);
  if (!b || b.type !== "written") throw new AppError(400, "That is not a written question");
  return { markScheme: b.markScheme, marks: b.marks };
}

/** Works the score out from the stored answers (never from what the student claims), saves it and updates their topic and practice time. */
export async function finish(studentId: number, l: Pick<Lesson, "topic" | "title" | "blocks"> & { id: number | null }, input: FinishInput) {
  const rows: { id: string; question: string; got: number; max: number }[] = [];
  for (const b of l.blocks) {
    if (b.type === "mcq") rows.push({ id: b.id, question: b.question, max: 1, got: input.answers[b.id] === b.correct ? 1 : 0 });
    else if (b.type === "written") rows.push({ id: b.id, question: b.question, max: b.marks, got: Math.min(b.marks, input.written[b.id] ?? 0) });
  }
  const got = rows.reduce((a, r) => a + r.got, 0);
  const max = rows.reduce((a, r) => a + r.max, 0);
  const percent = max ? Math.round((got / max) * 100) : 100;
  const mastered = max > 0 && percent >= 70;
  await pool.query("INSERT INTO lesson_results (student_id, lesson_id, topic, title, got, max_marks, percent, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [studentId, l.id, l.topic, l.title, got, max, percent, JSON.stringify(rows)]);
  // 70% or more masters the topic; below that it needs work. A lesson with no questions only marks the topic as started.
  if (max > 0) {
    await pool.query("INSERT INTO student_topic_status (student_id, topic, status) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status)", [studentId, l.topic, mastered ? "mastered" : "needs_work"]);
  } else {
    await pool.query("INSERT INTO student_topic_status (student_id, topic, status) VALUES (?, ?, 'in_progress') ON DUPLICATE KEY UPDATE status = IF(status = 'mastered', status, 'in_progress')", [studentId, l.topic]);
  }
  if (input.minutes > 0) await pool.query("INSERT INTO practice_minutes (student_id, day, minutes) VALUES (?, CURDATE(), ?) ON DUPLICATE KEY UPDATE minutes = LEAST(minutes + VALUES(minutes), 1440)", [studentId, input.minutes]);
  return { got, max, percent, mastered, rows };
}

/** A student's finished lessons, newest first (for the tutor). */
export async function resultsOf(studentId: number, limit = 20) {
  const [rows] = await pool.query<(RowDataPacket & { id: number; topic: string; title: string; got: number; max_marks: number; percent: number; created_at: Date })[]>(
    "SELECT id, topic, title, got, max_marks, percent, created_at FROM lesson_results WHERE student_id = ? ORDER BY created_at DESC, id DESC LIMIT ?",
    [studentId, limit]
  );
  return rows.map((r) => ({ id: r.id, topic: r.topic, title: r.title, got: r.got, max: r.max_marks, percent: r.percent, at: r.created_at }));
}

/** Saves a freshly made practice set for a student. */
export async function createPractice(studentId: number, topic: string, blocks: Block[]) {
  const [result] = await pool.query<ResultSetHeader>("INSERT INTO practice_sets (student_id, topic, blocks) VALUES (?, ?, ?)", [studentId, topic, JSON.stringify(blocks)]);
  return result.insertId;
}

/** A practice set, only if it belongs to this student. Shaped like a lesson so the same player and marking work for it. */
export async function findPractice(id: number, studentId: number) {
  const [rows] = await pool.query<(RowDataPacket & { id: number; topic: string; blocks: string })[]>("SELECT id, topic, blocks FROM practice_sets WHERE id = ? AND student_id = ?", [id, studentId]);
  const r = rows[0];
  if (!r) return null;
  return { id: r.id, topic: r.topic, title: `Practice: ${r.topic}`, blocks: JSON.parse(r.blocks) as Block[] };
}

/** Questions a tutor can reuse in a new quiz: every multiple choice or written question in the lessons, plus the diagnostic questions. One topic, or all of them. */
export async function bank(topic: string | null) {
  const out: { topic: string; source: string; block: Block }[] = [];
  const seen = new Set<string>();
  const add = (t: string, source: string, block: Block) => {
    const key = "question" in block ? block.question.trim() : "";
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push({ topic: t, source, block });
  };
  const [lessons] = await pool.query<Row[]>(topic ? "SELECT * FROM lessons WHERE topic = ? ORDER BY id" : "SELECT * FROM lessons ORDER BY id", topic ? [topic] : []);
  for (const l of lessons) for (const b of parse(l)) if (b.type === "mcq" || b.type === "written") add(l.topic, l.title, b);
  const [questions] = await pool.query<(RowDataPacket & { id: number; topic: string; question: string })[]>(topic ? "SELECT id, topic, question FROM diagnostic_questions WHERE topic = ? ORDER BY id" : "SELECT id, topic, question FROM diagnostic_questions ORDER BY id", topic ? [topic] : []);
  if (questions.length > 0) {
    const [opts] = await pool.query<(RowDataPacket & { question_id: number; text: string; is_correct: number })[]>("SELECT question_id, text, is_correct FROM diagnostic_options WHERE question_id IN (?) ORDER BY question_id, position", [questions.map((q) => q.id)]);
    for (const q of questions) {
      const o = opts.filter((x) => x.question_id === q.id);
      if (o.length !== 4) continue;
      const correct = o.findIndex((x) => x.is_correct === 1);
      add(q.topic, "Diagnostic", { id: `dq${q.id}`, type: "mcq", question: q.question, options: o.map((x) => x.text), correct: Math.max(0, correct), explain: correct >= 0 ? `The correct answer is ${o[correct].text}.` : "" });
    }
  }
  return out;
}
