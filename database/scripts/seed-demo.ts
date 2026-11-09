// Fills the LOCAL database with the sample data from the Educate Cloud prototype, so the whole flow can be checked with real rows:
// 3 groups, 6 students (with diagnostic results, topic statuses, practice time and a latest score), a 5-series booking calendar with session logs,
// the published lessons, the Algebra foundations route, and the sample chats.
//
//   npm run db:seed-demo       adds it (any earlier demo data is removed first, so it is safe to repeat)
//   npm run db:unseed-demo     removes it again
//
// Demo students sign in with their email (firstname.lastname@demo.educate.local) and the password below. Nothing else in the database is touched.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../../src/config/db/index.js";
import { userCode } from "../../src/modules/auth/user.model.js";

const PASSWORD = "Demo1234!";
const DOMAIN = "demo.educate.local";
const SERIES = "demo-";

interface Data {
  STRANDS: [string, string[]][];
  QUESTIONS: { topic: string; q: string; opts: [string, number, string?][] }[];
  GROUPS: { id: string; name: string; day: string; time: string; focus: string[]; zoom: string }[];
  SAMPLE: { name: string; score: number; group: string; mastery: number; mins: number; topics: number; last: string }[];
  LESSONS: Record<string, { id: string; title: string; published: boolean; kind?: string; blocks: unknown[] }[]>;
  ROUTES: { id: string; name: string; desc: string; items: { lesson: string; week: number }[]; assigned: string[] }[];
  MESSAGES: { name: string; msgs: { from: "student" | "teacher"; text: string; at: number }[] }[];
}

const data = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "seed", "prototype-data.json"), "utf8")) as Data;

const emailOf = (name: string) => `${name.toLowerCase().replace(/\s+/g, ".")}@${DOMAIN}`;
const DAY_INDEX: Record<string, number> = { MON: 0, TUE: 1, WED: 2, THU: 3, FRI: 4, SAT: 5, SUN: 6 };
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** "6:00 – 7:00 pm" -> ["18:00", "19:00"]; "11:00 am – 12:00 pm" -> ["11:00", "12:00"] */
function times(text: string): [string, string] {
  const [a, b] = text.split(/\s*[\u2013-]\s*/);
  const mer = (s: string) => (/pm/i.test(s) ? "pm" : /am/i.test(s) ? "am" : "");
  const endMer = mer(b);
  const to24 = (s: string, fallback: string) => {
    const [h, m] = s.replace(/[^\d:]/g, "").split(":").map(Number);
    const m2 = mer(s) || fallback;
    return `${String(m2 === "pm" ? (h % 12) + 12 : h % 12).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}`;
  };
  return [to24(a, endMer), to24(b, endMer)];
}

async function remove() {
  const [users] = await pool.query<RowDataPacket[]>("SELECT id FROM users WHERE email LIKE ?", [`%@${DOMAIN}`]);
  const ids = users.map((u) => u.id as number);
  // Logs stay when their booking goes, so take them out first.
  await pool.query("DELETE FROM lesson_logs WHERE booking_id IN (SELECT id FROM session_bookings WHERE series_id LIKE ?)", [`${SERIES}%`]);
  await pool.query("DELETE FROM session_bookings WHERE series_id LIKE ?", [`${SERIES}%`]);
  await pool.query("DELETE FROM session_groups WHERE name IN (?)", [data.GROUPS.map((g) => g.name)]);
  await pool.query("DELETE FROM learning_routes WHERE name IN (?)", [data.ROUTES.map((r) => r.name)]);
  const titles = Object.values(data.LESSONS).flat().map((l) => l.title);
  await pool.query("DELETE FROM lessons WHERE title IN (?)", [titles]);
  if (ids.length > 0) {
    await pool.query("DELETE FROM chat_messages WHERE student_id IN (?)", [ids]);
    await pool.query("DELETE FROM users WHERE id IN (?)", [ids]);
  }
  return ids.length;
}

async function seed() {
  const [tutors] = await pool.query<RowDataPacket[]>("SELECT id, full_name FROM users WHERE role IN ('tutor', 'admin') ORDER BY (role = 'tutor') DESC, id LIMIT 1");
  if (tutors.length === 0) throw new Error("There is no tutor or admin account to own the demo data. Create one first (npm run tutor:create).");
  const tutor = { id: tutors[0].id as number, name: (tutors[0].full_name as string) || "Tutor" };

  const option = async (category: string, label: string) => {
    const [rows] = await pool.query<RowDataPacket[]>("SELECT id FROM startup_options WHERE category = ? AND label = ?", [category, label]);
    if (rows.length === 0) throw new Error(`The start-up option "${label}" (${category}) is missing. Run the migrations first.`);
    return rows[0].id as number;
  };
  const profile = { subject: await option("subject", "Maths"), board: await option("exam_board", "AQA"), year: await option("school_year", "Year 11"), target: await option("target_grade", "7") };

  const hash = await bcrypt.hash(PASSWORD, 10);
  const allTopics = data.STRANDS.flatMap(([, t]) => t);
  const diagnosticTopics = data.QUESTIONS.map((q) => q.topic);
  const today = new Date();
  const todayIndex = (today.getDay() + 6) % 7;

  // ---- groups ----
  const groupId = new Map<string, number>();
  for (const g of data.GROUPS) {
    const [start, end] = times(g.time);
    const [res] = await pool.query<ResultSetHeader>("INSERT INTO session_groups (name, day_of_week, start_time, end_time, zoom_link, capacity, created_by) VALUES (?, ?, ?, ?, ?, 8, ?)", [
      g.name, DAY_INDEX[g.day], start, end, `https://${g.zoom.replace(/[[\]]/g, "")}`, tutor.id,
    ]);
    groupId.set(g.id, res.insertId);
    for (const topic of g.focus) await pool.query("INSERT INTO session_group_topics (group_id, topic) VALUES (?, ?)", [res.insertId, topic]);
  }

  // ---- students ----
  const studentId = new Map<string, number>();
  const groupOf = new Map<string, string>();
  for (const s of data.SAMPLE) {
    const [res] = await pool.query<ResultSetHeader>("INSERT INTO users (full_name, email, password_hash, role, is_active) VALUES (?, ?, ?, 'student', 1)", [s.name, emailOf(s.name), hash]);
    const id = res.insertId;
    await pool.query("UPDATE users SET user_code = ? WHERE id = ?", [userCode("student", id), id]);
    studentId.set(s.name, id);
    groupOf.set(s.name, s.group);
    await pool.query("INSERT INTO student_profiles (user_id, level, subject_id, exam_board_id, school_year_id, target_grade_id, tier) VALUES (?, 'GCSE', ?, ?, ?, ?, 'Higher')", [id, profile.subject, profile.board, profile.year, profile.target]);

    // The diagnostic: this many of the 10 questions right; the wrong ones are the group's focus topics first.
    const group = data.GROUPS.find((g) => g.id === s.group)!;
    const correct = Math.round(s.score / 10);
    const wrongCount = diagnosticTopics.length - correct;
    const ranked = [...diagnosticTopics.filter((t) => group.focus.includes(t)), ...diagnosticTopics.filter((t) => !group.focus.includes(t))];
    const wrong = ranked.slice(0, wrongCount);
    const strong = diagnosticTopics.filter((t) => !wrong.includes(t));
    const misconceptions = wrong.flatMap((t) => {
      const q = data.QUESTIONS.find((x) => x.topic === t)!;
      const label = q.opts.find((o) => o[1] === 0 && o[2])?.[2];
      return label ? [{ topic: t, text: label }] : [];
    });
    const details = { strong, needWork: wrong, notLearnedTopics: [] as string[], misconceptions };
    await pool.query("INSERT INTO diagnostic_attempts (user_id, correct, not_learned, total, details) VALUES (?, ?, 0, ?, ?)", [id, correct, diagnosticTopics.length, JSON.stringify(details)]);

    // Topic statuses: the diagnostic's, then more topics mastered until the prototype's count is reached.
    const status = new Map<string, string>();
    wrong.forEach((t) => status.set(t, "needs_work"));
    strong.forEach((t) => status.set(t, "mastered"));
    for (const t of allTopics) {
      if ([...status.values()].filter((v) => v === "mastered").length >= s.topics) break;
      if (!status.has(t)) status.set(t, "mastered");
    }
    for (const [topic, st] of status) await pool.query("INSERT INTO student_topic_status (student_id, topic, status) VALUES (?, ?, ?)", [id, topic, st]);

    // Practice time this week (Monday to today) and the latest score.
    if (s.mins > 0) {
      const days = todayIndex + 1;
      const each = Math.floor(s.mins / days);
      for (let i = 0; i < days; i++) await pool.query("INSERT INTO practice_minutes (student_id, day, minutes) VALUES (?, ?, ?)", [id, ymd(addDays(today, i - todayIndex)), i === days - 1 ? s.mins - each * (days - 1) : each]);
    }
    await pool.query("INSERT INTO lesson_results (student_id, lesson_id, topic, title, got, max_marks, percent, detail) VALUES (?, NULL, ?, ?, ?, 100, ?, '[]')", [
      id, group.focus[0], `${group.focus[0]} check`, s.score, s.score,
    ]);

    await pool.query("INSERT INTO student_groups (student_id, group_id, note, send_video, assigned_by) VALUES (?, ?, ?, 1, ?)", [
      id, groupId.get(s.group), "Welcome! In this session we'll fix the mistakes from your diagnostic. Watch the short video before we start.", tutor.id,
    ]);
  }

  // ---- lessons ----
  const lessonId = new Map<string, number>();
  for (const [topic, list] of Object.entries(data.LESSONS)) {
    for (const l of list) {
      const [res] = await pool.query<ResultSetHeader>("INSERT INTO lessons (topic, title, blocks, published, created_by) VALUES (?, ?, ?, ?, ?)", [topic, l.title, JSON.stringify(l.blocks), l.published ? 1 : 0, tutor.id]);
      lessonId.set(l.id, res.insertId);
    }
  }

  // ---- route ----
  for (const r of data.ROUTES) {
    const [res] = await pool.query<ResultSetHeader>("INSERT INTO learning_routes (name, description, created_by) VALUES (?, ?, ?)", [r.name, r.desc, tutor.id]);
    for (let i = 0; i < r.items.length; i++) await pool.query("INSERT INTO route_steps (route_id, position, item_type, item_id, week) VALUES (?, ?, 'lesson', ?, ?)", [res.insertId, i + 1, lessonId.get(r.items[i].lesson), r.items[i].week]);
    for (const who of r.assigned) {
      const id = studentId.get(who.replace(/^s:/, ""));
      if (id) await pool.query("INSERT INTO route_assignments (route_id, student_id, assigned_at) VALUES (?, ?, CURDATE())", [res.insertId, id]);
    }
  }

  // ---- calendar: weeks -2 to +5, five weekly series, with session logs for the recent ones ----
  const monday = addDays(today, -todayIndex);
  const plan = [
    { key: "g1", group: "g1", day: 3, start: "18:00", series: "sg1" },
    { key: "g2", group: "g2", day: 5, start: "11:00", series: "sg2" },
    { key: "g3", group: "g3", day: 6, start: "17:00", series: "sg3" },
    { key: "Bilal Raza", student: "Bilal Raza", day: 1, start: "17:00", series: "sb1" },
    { key: "Zara Malik", student: "Zara Malik", day: 0, start: "16:30", series: "sz1" },
  ];
  const topicOf: Record<string, string> = { g1: "Simultaneous equations", g2: "Trigonometry", g3: "Percentages", "Bilal Raza": "Factorising quadratics", "Zara Malik": "Expanding brackets" };
  const cutoff = ymd(addDays(today, -3));
  let logged = 0;
  let waiting = 0;
  let n = 0;
  for (let w = -2; w <= 5; w++) {
    for (const p of plan) {
      const date = ymd(addDays(monday, w * 7 + p.day));
      const isGroup = Boolean(p.group);
      const gid = p.group ? groupId.get(p.group)! : null;
      const sid = p.student ? studentId.get(p.student)! : null;
      const zoom = p.group ? `https://${data.GROUPS.find((g) => g.id === p.group)!.zoom.replace(/[[\]]/g, "")}` : "https://zoom.us/j/MEETING-ID";
      const [res] = await pool.query<ResultSetHeader>("INSERT INTO session_bookings (tutor_id, student_id, group_id, session_date, start_time, minutes, zoom_link, series_id) VALUES (?, ?, ?, ?, ?, 60, ?, ?)", [
        tutor.id, sid, gid, date, p.start, zoom, `${SERIES}${p.series}`,
      ]);
      n += 1;
      // A log for sessions that are over and in the last two weeks; a few of the newest are left for the tutor to log.
      if (date >= ymd(today) || date < ymd(addDays(monday, -14))) continue;
      if (date >= cutoff && n % 4 === 0) {
        waiting += 1;
        continue;
      }
      const members = isGroup ? data.SAMPLE.filter((s) => s.group === p.group).map((s) => studentId.get(s.name)!) : [];
      const present = members.slice(0, Math.max(1, members.length - 1));
      const name = isGroup ? data.GROUPS.find((g) => g.id === p.group)!.name : p.student!;
      await pool.query(
        `INSERT INTO lesson_logs (booking_id, tutor_id, tutor_name, lesson_date, student_or_class, lesson_type, attendance, duration_minutes, completed,
           homework_assigned, homework_other, engagement_notes, next_focus, zoom_recorded, topics, engagement, focus_score, attendees)
         VALUES (?, ?, ?, ?, ?, ?, 'Present', 60, 'Yes', 1, ?, ?, ?, 0, ?, ?, ?, ?)`,
        [res.insertId, tutor.id, tutor.name, date, name, isGroup ? "Group" : "1:1", `Practice set on ${topicOf[p.key]}`, "Good use of the method on exam-style questions.", "Practise mixed questions and show full working.",
         topicOf[p.key], 3 + (n % 3), 3 + ((n + 1) % 3), isGroup ? JSON.stringify(present) : null]
      );
      logged += 1;
    }
  }

  // ---- chats (the sample conversations) ----
  const now = Date.now();
  let messages = 0;
  for (const chat of data.MESSAGES) {
    const sid = studentId.get(chat.name);
    if (!sid) continue;
    for (const m of chat.msgs) {
      // The prototype stores each time as an offset from "now" when it was made; keep the same gaps.
      const age = Math.max(0, now - m.at);
      await pool.query("INSERT INTO chat_messages (student_id, staff_id, sender_id, body, created_at) VALUES (?, ?, ?, ?, ?)", [sid, tutor.id, m.from === "student" ? sid : tutor.id, m.text, new Date(now - (age > 1e9 ? 3600000 : age))]);
      messages += 1;
    }
  }

  return { students: data.SAMPLE.length, groups: data.GROUPS.length, bookings: n, logged, waiting, lessons: lessonId.size, messages, tutor: tutor.name };
}

const mode = process.argv[2];
try {
  const removed = await remove();
  if (mode === "remove") {
    console.log(`Removed the demo data (${removed} demo student${removed === 1 ? "" : "s"}).`);
  } else {
    const r = await seed();
    console.log(`Demo data added for ${r.tutor}: ${r.students} students, ${r.groups} groups, ${r.bookings} booked sessions (${r.logged} logged, ${r.waiting} waiting for a log), ${r.lessons} lessons, 1 route, ${r.messages} chat messages.`);
    console.log(`Demo students sign in with firstname.lastname@${DOMAIN} and the password ${PASSWORD}`);
  }
} finally {
  await pool.end();
}
