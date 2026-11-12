import type { RowDataPacket } from "mysql2";
import { inTransaction, pool } from "../../../config/db/index.js";
import { AppError } from "../../../utils/AppError/index.js";
import { ownsEnrolment } from "../shared/mine.js";

type Status = "P" | "W" | "N";
const parse = <T>(v: unknown, fallback: T): T => {
  try {
    return ((typeof v === "string" ? JSON.parse(v) : v) as T) ?? fallback;
  } catch {
    return fallback;
  }
};

async function questionsOf(subjectId: string, levelId: string) {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT question, options, correct, mistakes, topic_id FROM diagnostic_questions WHERE subject_id = ? AND level_id = ? ORDER BY position, id", [subjectId, levelId]);
  return rows.map((r) => ({ q: r.question as string, o: parse<string[]>(r.options, []), correct: Number(r.correct), mistakes: parse<(string | null)[]>(r.mistakes, []), topicId: r.topic_id as number }));
}

/** What the diagnostic screen needs: the questions (without the answers), or, when the subject has none, the topics to rate. */
export async function get(studentId: number, enrolmentId: number) {
  const e = await ownsEnrolment(studentId, enrolmentId);
  const [info] = await pool.query<RowDataPacket[]>("SELECT s.name AS subject_name, s.icon, s.color, l.short_name FROM subjects s, levels l WHERE s.id = ? AND l.id = ?", [e.subject_id, e.level_id]);
  const qs = await questionsOf(e.subject_id, e.level_id);
  const [topics] = await pool.query<RowDataPacket[]>(
    "SELECT st.id AS strand_id, st.name AS strand, t.id, t.name FROM strands st JOIN topics t ON t.strand_id = st.id WHERE st.subject_id = ? AND st.level_id = ? ORDER BY st.position, st.id, t.position, t.id",
    [e.subject_id, e.level_id]
  );
  const names = new Map(topics.map((t) => [t.id as number, t.name as string]));
  const strands: { id: number; name: string; topics: { id: number; name: string }[] }[] = [];
  for (const t of topics) {
    let s = strands.find((x) => x.id === t.strand_id);
    if (!s) strands.push((s = { id: t.strand_id, name: t.strand, topics: [] }));
    s.topics.push({ id: t.id, name: t.name });
  }
  return {
    enrolmentId,
    done: Boolean(e.diagnostic_done),
    pathName: `${info[0].short_name} ${info[0].subject_name}${e.tier ? ` · ${e.tier}` : ""}`,
    subject: { id: e.subject_id as string, icon: info[0].icon as string, color: info[0].color as string },
    mode: qs.length ? ("quiz" as const) : ("conf" as const),
    questions: qs.map((q) => ({ q: q.q, o: q.o, topic: names.get(q.topicId) ?? "" })),
    strands,
  };
}

/**
 * Saves the diagnostic and builds the learning map. A right answer makes the topic "in progress", a wrong one "needs work"
 * (and records the common mistake that answer shows), and "I have not learned this" leaves it "not started".
 */
export async function submit(studentId: number, enrolmentId: number, input: { conf?: Record<string, Status>; answers?: Record<string, number | "nl"> }) {
  const e = await ownsEnrolment(studentId, enrolmentId);
  if (e.diagnostic_done) throw new AppError(409, "You have already done this diagnostic.");
  const [topics] = await pool.query<RowDataPacket[]>("SELECT t.id, t.name FROM topics t JOIN strands st ON st.id = t.strand_id WHERE st.subject_id = ? AND st.level_id = ?", [e.subject_id, e.level_id]);
  const status = new Map<number, Status>(topics.map((t) => [t.id as number, "N" as Status]));
  const mistakes: string[] = [];
  let score: number | null = null;
  const qs = await questionsOf(e.subject_id, e.level_id);

  if (input.answers && qs.length) {
    let right = 0;
    qs.forEach((q, i) => {
      const a = input.answers![String(i)];
      if (a === q.correct) {
        right += 1;
        status.set(q.topicId, "P");
      } else if (a === "nl" || a === undefined) {
        status.set(q.topicId, "N");
      } else {
        status.set(q.topicId, "W");
        const m = q.mistakes[a] ?? q.mistakes[0];
        if (m) mistakes.push(m);
      }
    });
    score = right;
  } else if (input.conf) {
    for (const [id, v] of Object.entries(input.conf)) if (status.has(Number(id))) status.set(Number(id), v);
  } else {
    throw new AppError(400, "Answer the diagnostic first.");
  }

  const unique = mistakes.filter((m, i) => mistakes.indexOf(m) === i);
  await inTransaction(async (conn) => {
    for (const [topicId, st] of status) {
      await conn.query("INSERT INTO enrolment_topic_status (enrolment_id, topic_id, status) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status)", [enrolmentId, topicId, st]);
    }
    await conn.query("UPDATE enrolments SET diagnostic_done = 1, diagnostic_score = ?, misconceptions = ? WHERE id = ?", [score === null ? null : Math.round((score / qs.length) * 100), JSON.stringify(unique), enrolmentId]);
  });
  const nameOf = new Map(topics.map((t) => [t.id as number, t.name as string]));
  return {
    score,
    total: score === null ? null : qs.length,
    misconceptions: unique,
    needsWork: [...status].filter(([, s]) => s === "W").map(([id]) => nameOf.get(id) ?? ""),
    notLearned: [...status].filter(([, s]) => s === "N").map(([id]) => nameOf.get(id) ?? ""),
  };
}
