import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../../config/db/index.js";
import type { ProfileInput, SubmitInput } from "./student.schemas.js";

export interface Profile {
  level: ProfileInput["level"];
  subjectId: number | null;
  examBoardId: number | null;
  schoolYearId: number | null;
  targetGradeId: number | null;
  tier: ProfileInput["tier"];
}

interface ProfileRow extends RowDataPacket, Profile {}
interface QuestionRow extends RowDataPacket {
  id: number;
  topic: string;
  question: string;
}
interface OptionRow extends RowDataPacket {
  questionId: number;
  text: string;
  isCorrect: number;
  misconception: string | null;
}

/** The choices the About you dropdowns show (set by tutors). Read-only for students. */
export async function listOptions() {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT id, category, label, sort_order FROM startup_options ORDER BY category, sort_order, id");
  return rows;
}

/** The wording of the diagnostic intro card (set by tutors). */
export async function getContent() {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT badge, heading, intro, hint, highlight, button_label AS buttonLabel, questions, next_label AS nextLabel, next_heading AS nextHeading, next_text AS nextText FROM startup_content WHERE id = 1"
  );
  return rows[0] ?? null;
}

export async function getProfile(userId: number) {
  const [rows] = await pool.query<ProfileRow[]>(
    "SELECT level, subject_id AS subjectId, exam_board_id AS examBoardId, school_year_id AS schoolYearId, target_grade_id AS targetGradeId, tier FROM student_profiles WHERE user_id = ?",
    [userId]
  );
  return rows[0] ? ({ ...rows[0] } as Profile) : null;
}

/** True when every id is a choice of the right dropdown (a subject really is a subject, and so on). */
export async function optionsAreValid(p: ProfileInput) {
  const wanted: [number, string][] = [
    [p.subjectId, "subject"],
    [p.examBoardId, "exam_board"],
    [p.schoolYearId, "school_year"],
    [p.targetGradeId, "target_grade"],
  ];
  const [rows] = await pool.query<RowDataPacket[]>("SELECT id, category FROM startup_options WHERE id IN (?)", [wanted.map(([id]) => id)]);
  return wanted.every(([id, category]) => rows.some((r) => r.id === id && r.category === category));
}

export async function saveProfile(userId: number, p: ProfileInput) {
  await pool.query(
    `INSERT INTO student_profiles (user_id, level, subject_id, exam_board_id, school_year_id, target_grade_id, tier)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE level = VALUES(level), subject_id = VALUES(subject_id), exam_board_id = VALUES(exam_board_id),
       school_year_id = VALUES(school_year_id), target_grade_id = VALUES(target_grade_id), tier = VALUES(tier)`,
    [userId, p.level, p.subjectId, p.examBoardId, p.schoolYearId, p.targetGradeId, p.tier]
  );
  return getProfile(userId);
}

/** The questions that fit what the student chose. A tier of "Not sure yet" takes every tier. */
async function matchingQuestions(profile: Profile, limit: number) {
  const tierFilter = profile.tier === "Not sure yet" ? "" : "AND tier IN ('Any', ?)";
  const params: (string | number)[] = [profile.level, profile.subjectId ?? 0];
  if (profile.tier !== "Not sure yet") params.push(profile.tier);
  params.push(limit);
  const [rows] = await pool.query<QuestionRow[]>(
    `SELECT id, topic, question FROM diagnostic_questions WHERE level = ? AND subject_id = ? ${tierFilter} ORDER BY id LIMIT ?`,
    params
  );
  return rows;
}

async function optionsOf(questionIds: number[]) {
  if (questionIds.length === 0) return [];
  const [rows] = await pool.query<OptionRow[]>(
    "SELECT question_id AS questionId, text, is_correct AS isCorrect, misconception FROM diagnostic_options WHERE question_id IN (?) ORDER BY question_id, position",
    [questionIds]
  );
  return rows;
}

/** The diagnostic for this student. The correct answers are NOT included. */
export async function diagnosticFor(profile: Profile, limit: number) {
  const questions = await matchingQuestions(profile, limit);
  const options = await optionsOf(questions.map((q) => q.id));
  return questions.map((q) => ({
    id: q.id,
    topic: q.topic,
    question: q.question,
    options: options.filter((o) => o.questionId === q.id).map((o) => ({ text: o.text })),
  }));
}

/** What the student sees when they finish: totals, the topics behind them, and the mistakes they made. */
export interface DiagnosticResult {
  correct: number;
  notLearned: number;
  incorrect: number;
  total: number;
  /** Topics the student got right (and never got wrong). */
  strong: string[];
  /** Topics with at least one wrong answer. */
  needWork: string[];
  /** Topics the student said they have not learned yet. */
  notLearnedTopics: string[];
  misconceptions: { topic: string; text: string }[];
}

type Details = Pick<DiagnosticResult, "strong" | "needWork" | "notLearnedTopics" | "misconceptions">;

interface AttemptRow extends RowDataPacket {
  correct: number;
  not_learned: number;
  total: number;
  details: string | null;
}

/** Marks the answers on the server, saves the result and returns it. */
export async function gradeAndSave(userId: number, profile: Profile, limit: number, submitted: SubmitInput["answers"]) {
  const questions = await matchingQuestions(profile, limit); // only questions that really are part of this student's diagnostic count
  const options = await optionsOf(questions.map((q) => q.id));

  let correct = 0;
  let notLearned = 0;
  let answered = 0;
  const right = new Set<string>();
  const wrong = new Set<string>();
  const unknown = new Set<string>();
  const mistakes = new Map<string, { topic: string; text: string }>();

  for (const q of questions) {
    const answer = submitted.find((a) => a.questionId === q.id);
    if (!answer) continue;
    answered++;
    if (answer.choice === -1) {
      notLearned++;
      unknown.add(q.topic);
      continue;
    }
    const chosen = options.filter((o) => o.questionId === q.id)[answer.choice];
    if (chosen?.isCorrect === 1) {
      correct++;
      right.add(q.topic);
    } else {
      wrong.add(q.topic);
      if (chosen?.misconception) mistakes.set(`${q.topic}|${chosen.misconception}`, { topic: q.topic, text: chosen.misconception });
    }
  }

  const details: Details = {
    strong: [...right].filter((t) => !wrong.has(t) && !unknown.has(t)),
    needWork: [...wrong],
    notLearnedTopics: [...unknown].filter((t) => !wrong.has(t)),
    misconceptions: [...mistakes.values()],
  };
  const total = questions.length;
  await pool.query<ResultSetHeader>("INSERT INTO diagnostic_attempts (user_id, correct, not_learned, total, details) VALUES (?, ?, ?, ?, ?)", [
    userId,
    correct,
    notLearned,
    total,
    JSON.stringify(details),
  ]);
  await saveTopicStatuses(userId, details);
  return { correct, notLearned, incorrect: answered - correct - notLearned, total, ...details } satisfies DiagnosticResult;
}

/**
 * Remembers what the diagnostic found for each topic it covered: right = mastered, wrong = needs work, "not learned yet" = not started.
 * Taking the diagnostic again replaces the status of the topics it covers; other topics are left alone.
 */
async function saveTopicStatuses(userId: number, d: Details) {
  const rows: [number, string, string][] = [
    ...d.strong.map((t): [number, string, string] => [userId, t, "mastered"]),
    ...d.needWork.map((t): [number, string, string] => [userId, t, "needs_work"]),
    ...d.notLearnedTopics.map((t): [number, string, string] => [userId, t, "not_started"]),
  ];
  if (rows.length === 0) return;
  await pool.query("INSERT INTO student_topic_status (student_id, topic, status) VALUES ? ON DUPLICATE KEY UPDATE status = VALUES(status)", [rows]);
}

/** The student's topic statuses, as { topic, status }. */
export async function topicStatuses(userId: number) {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT topic, status FROM student_topic_status WHERE student_id = ? ORDER BY topic", [userId]);
  return rows as { topic: string; status: "mastered" | "in_progress" | "needs_work" | "not_started" }[];
}

/** The student's most recent finished diagnostic, or null if they have not done one. */
export async function latestResult(userId: number): Promise<DiagnosticResult | null> {
  const [rows] = await pool.query<AttemptRow[]>("SELECT correct, not_learned, total, details FROM diagnostic_attempts WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 1", [userId]);
  const row = rows[0];
  if (!row) return null;
  const details: Details = row.details ? (JSON.parse(row.details) as Details) : { strong: [], needWork: [], notLearnedTopics: [], misconceptions: [] };
  return { correct: row.correct, notLearned: row.not_learned, incorrect: row.total - row.correct - row.not_learned, total: row.total, ...details };
}

/**
 * Where the student is in the first steps, worked out from what they have saved (never stored separately, so it can not drift):
 *  about-you  - the About you screen is not finished
 *  diagnostic - About you is done, the diagnostic has not been handed in
 *  results    - the diagnostic is done and a tutor has not placed the student in a group yet
 *  group      - a tutor has placed the student in a group
 */
export async function progress(userId: number) {
  const profile = await getProfile(userId);
  const [rows] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM diagnostic_attempts WHERE user_id = ?", [userId]);
  const [placed] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM student_groups WHERE student_id = ?", [userId]);
  const aboutYou = Boolean(profile && profile.subjectId);
  const diagnostic = aboutYou && Number(rows[0]?.n ?? 0) > 0;
  const group = diagnostic && Number(placed[0]?.n ?? 0) > 0;
  const step = !aboutYou ? "about-you" : !diagnostic ? "diagnostic" : !group ? "results" : "group";
  return { step, aboutYou, diagnostic, group };
}
