// Fills the database with a small, believable school so every screen has something to show:
// 2 teachers, 10 students (1-2 subjects each), 2 weekly groups, diagnostic results, learning-map statuses, study time,
// recent results, booked and logged lessons, lessons and a learning route, completed tasks, monthly reports and chats.
//
//   npm run db:seed-demo       adds it (earlier demo data is removed first, so it is safe to repeat)
//   npm run db:unseed-demo     removes it again
//
// Every demo account uses an email ending @demo.educate.local and the password below. Nothing else in the database is touched.
// Sign in as a teacher on the Teacher tab (sarah.bennett@... / david.okafor@...) and as a student on the Student tab.
import bcrypt from "bcryptjs";
import type { Connection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { connect, dbName } from "./connection.js";

const PASSWORD = "Demo1234!";
const DOMAIN = "demo.educate.local";

const TEACHERS = [
  { name: "Sarah Bennett", subjects: ["maths"], headline: "GCSE and A-level Maths" },
  { name: "David Okafor", subjects: ["physics", "chemistry"], headline: "GCSE Physics and Chemistry" },
];

// level is always GCSE here. subs: subject -> [tier, board, current grade, target grade, diagnostic score % (null = not done yet)]
type Sub = [string, string, string, string, number | null];
const STUDENTS: { name: string; year: string; plan: string; parent: string; subs: Record<string, Sub>; group?: string }[] = [
  { name: "Aisha Khan", year: "Year 11", plan: "weekly", parent: "Nadia Khan", subs: { maths: ["Higher", "AQA", "5", "7", 64] }, group: "maths" },
  { name: "Ben Carter", year: "Year 10", plan: "intensive", parent: "Paul Carter", subs: { maths: ["Higher", "Edexcel", "6", "8", 78], physics: ["Higher", "AQA", "5", "7", 55] }, group: "maths" },
  { name: "Chloe Evans", year: "Year 11", plan: "weekly", parent: "Helen Evans", subs: { maths: ["Foundation", "AQA", "3", "5", 41] }, group: "maths" },
  { name: "Daniel Park", year: "Year 10", plan: "self", parent: "Min-jun Park", subs: { maths: ["Higher", "OCR", "4", "6", 52] }, group: "maths" },
  { name: "Emma Rossi", year: "Year 11", plan: "weekly", parent: "Marco Rossi", subs: { maths: ["Higher", "AQA", "6", "8", 82], physics: ["Higher", "AQA", "6", "7", 70] }, group: "maths" },
  { name: "Farhan Ali", year: "Year 10", plan: "weekly", parent: "Samira Ali", subs: { physics: ["Higher", "AQA", "4", "6", 48] }, group: "physics" },
  { name: "Grace Liu", year: "Year 11", plan: "intensive", parent: "Wei Liu", subs: { physics: ["Higher", "AQA", "7", "9", 88], chemistry: ["Higher", "AQA", "6", "8", 74] }, group: "physics" },
  { name: "Harry Wilson", year: "Year 9", plan: "self", parent: "Jo Wilson", subs: { chemistry: ["Foundation", "Edexcel", "3", "5", 36] } },
  { name: "Isla Murray", year: "Year 11", plan: "weekly", parent: "Fiona Murray", subs: { maths: ["Higher", "AQA", "5", "6", null] } },
  { name: "Jamal Reed", year: "Year 10", plan: "weekly", parent: "Tanya Reed", subs: { maths: ["Higher", "AQA", "5", "7", 58], physics: ["Foundation", "AQA", "4", "5", null] }, group: "physics" },
];

const emailOf = (name: string) => `${name.toLowerCase().replace(/\s+/g, ".")}@${DOMAIN}`;
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
/** The next date (today or later) that falls on this weekday (Mon = 0 ... Sun = 6). */
const nextWeekday = (dow: number, plusWeeks = 0) => { const d = new Date(); d.setDate(d.getDate() + ((dow - ((d.getDay() + 6) % 7) + 7) % 7) + plusWeeks * 7); return d; };
/** A small repeatable "random": the same names always get the same numbers. */
function hash(s: string) { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }

async function remove(db: Connection) {
  const [users] = await db.query<RowDataPacket[]>("SELECT id FROM users WHERE email LIKE ?", [`%@${DOMAIN}`]);
  const ids = users.map((u) => u.id as number);
  if (ids.length) {
    // These keep their rows (the link just becomes empty) when a person goes, so take them out first.
    await db.query("DELETE FROM learning_routes WHERE created_by IN (?)", [ids]);
    await db.query("DELETE FROM content_items WHERE created_by IN (?)", [ids]);
    await db.query("DELETE FROM session_groups WHERE tutor_id IN (?)", [ids]);
    await db.query("DELETE FROM users WHERE id IN (?)", [ids]);
  }
  return ids.length;
}

const db = await connect();
try {
  const removed = await remove(db);
  if (process.argv[2] === "remove") {
    console.log(`Removed ${removed} demo account(s) and their data from "${dbName}".`);
    process.exit(0);
  }

  const hash12 = await bcrypt.hash(PASSWORD, 10);
  const q = async <T extends RowDataPacket>(sql: string, p: unknown[] = []) => (await db.query<T[]>(sql, p))[0];
  const run = async (sql: string, p: unknown[] = []) => (await db.query<ResultSetHeader>(sql, p))[0];
  const newUser = async (name: string, role: "tutor" | "student", extra: { headline?: string } = {}) => {
    const r = await run("INSERT INTO users (full_name, email, password_hash, role, headline) VALUES (?, ?, ?, ?, ?)", [name, emailOf(name), hash12, role, extra.headline ?? ""]);
    await run("UPDATE users SET user_code = ? WHERE id = ?", [`${role === "tutor" ? "TUT" : "STU"}-${String(r.insertId).padStart(5, "0")}`, r.insertId]);
    return r.insertId;
  };

  // ---- teachers
  const tutorId: Record<string, number> = {};
  for (const t of TEACHERS) {
    const id = await newUser(t.name, "tutor", { headline: t.headline });
    for (const s of t.subjects) await run("INSERT INTO tutor_subjects (user_id, subject_id) VALUES (?, ?)", [id, s]);
    for (const s of t.subjects) tutorId[s] = id;
  }
  const sarah = tutorId.maths, david = tutorId.physics;

  // ---- groups (day: Mon = 0)
  const grp = async (name: string, subject: string, tutor: number, day: number, time: string) =>
    (await run("INSERT INTO session_groups (name, subject_id, level_id, tutor_id, day_of_week, start_time, zoom_link) VALUES (?, ?, 'gcse', ?, ?, ?, ?)", [name, subject, tutor, day, time, "https://zoom.us/j/demo-" + subject])).insertId;
  const groupId: Record<string, number> = { maths: await grp("Thursday GCSE Maths", "maths", sarah, 3, "17:00:00"), physics: await grp("Tuesday GCSE Physics", "physics", david, 1, "18:00:00") };

  // ---- topics per subject
  const topics = await q("SELECT t.id, t.name, s.subject_id FROM topics t JOIN strands s ON s.id = t.strand_id ORDER BY t.id");
  const topicsOf = (subject: string) => topics.filter((t) => t.subject_id === subject);

  // ---- students, enrolments, learning-map statuses, study time, results
  const enrol: Record<string, number[]> = {}; // student name -> enrolment ids
  const enrolBy: Record<string, { id: number; student: string; subject: string; studentId: number }> = {};
  const studentId: Record<string, number> = {};
  const RESULT_TITLES: Record<string, string[]> = { maths: ["Algebra check-in", "Number quiz", "Mock paper 1"], physics: ["Forces quiz", "Energy check-in", "Mock paper 1"], chemistry: ["Atoms quiz", "Bonding check-in", "Mock paper 1"] };
  for (const s of STUDENTS) {
    const id = await newUser(s.name, "student");
    studentId[s.name] = id;
    await run("INSERT INTO student_profiles (user_id, level_id, school_year, plan_id, parent_name, parent_email, parent_phone, recording_ok) VALUES (?, 'gcse', ?, ?, ?, ?, ?, 1)", [id, s.year, s.plan, s.parent, `${s.parent.toLowerCase().replace(/\s+/g, ".")}@${DOMAIN}`, "07700 900" + String(100 + (hash(s.name) % 900))]);
    enrol[s.name] = [];
    for (const [subject, [tier, board, cur, tgt, score]] of Object.entries(s.subs)) {
      const done = score !== null;
      const mis = done && score < 60 ? JSON.stringify(["Mixing up the order of operations", "Not checking units"]) : JSON.stringify([]);
      const e = await run(
        "INSERT INTO enrolments (student_id, subject_id, level_id, tier, board, current_grade, target_grade, diagnostic_done, diagnostic_score, misconceptions, tutor_id, group_id) VALUES (?, ?, 'gcse', ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [id, subject, tier, board, cur, tgt, done ? 1 : 0, done ? score : null, mis, tutorId[subject], s.group === subject ? groupId[subject] : null]
      );
      enrol[s.name].push(e.insertId);
      enrolBy[`${s.name}|${subject}`] = { id: e.insertId, student: s.name, subject, studentId: id };
      if (done) {
        // The learning map: the higher the diagnostic score, the more topics are mastered / in progress.
        const list = topicsOf(subject);
        for (let i = 0; i < list.length; i++) {
          const r = (hash(s.name + subject + i) % 100) / 100;
          const m = score / 100;
          const st = r < m * 0.45 ? "M" : r < m * 0.8 ? "P" : r < 0.9 ? "W" : "N";
          await run("INSERT INTO enrolment_topic_status (enrolment_id, topic_id, status) VALUES (?, ?, ?)", [e.insertId, list[i].id, st]);
        }
        for (let d = 0; d < 14; d++) if ((hash(s.name + subject + "d" + d) % 3) !== 0) await run("INSERT INTO study_minutes (enrolment_id, study_date, minutes) VALUES (?, ?, ?)", [e.insertId, ymd(addDays(-d)), 15 + (hash(s.name + d) % 50)]);
        const titles = RESULT_TITLES[subject] ?? ["Quiz"];
        for (let i = 0; i < 3; i++) await run("INSERT INTO learning_results (enrolment_id, title, pct, created_at) VALUES (?, ?, ?, ?)", [e.insertId, titles[i], Math.max(20, Math.min(98, score + ((hash(s.name + i) % 21) - 10) + i * 3)), addDays(-20 + i * 8)]);
      }
    }
  }

  // ---- lessons and a route per teacher (visible to students)
  const block = (type: string, d: object) => JSON.stringify({ type, ...d });
  const makeItem = async (tutor: number, subject: string, kind: string, title: string, topicName: string, blocks: object[]) => {
    const topic = topicsOf(subject).find((t) => t.name === topicName) ?? topicsOf(subject)[0];
    const it = await run("INSERT INTO content_items (kind, title, subject_id, level_id, topic_id, source, published, created_by) VALUES (?, ?, ?, 'gcse', ?, '', 1, ?)", [kind, title, subject, topic.id, tutor]);
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i] as { type: string };
      const { type, ...rest } = b;
      await run("INSERT INTO content_blocks (item_id, position, type, data) VALUES (?, ?, ?, ?)", [it.insertId, i, type, JSON.stringify(rest)]);
    }
    return it.insertId;
  };
  const mathsLesson = await makeItem(sarah, "maths", "lesson", "Expanding brackets", "Expanding brackets", [
    { type: "slide", title: "Multiply every term", body: "To expand a bracket, multiply every term inside by the term outside.\n\nExample: $3(x + 4) = 3x + 12$" },
    { type: "mcq", question: "Expand $2(x + 5)$.", options: ["$2x + 5$", "$2x + 10$", "$x + 10$", "$2x + 7$"], correct: 1, explain: "Multiply both terms by 2." },
    { type: "written", question: "Expand and simplify $3(x + 2) + 2(x - 1)$.", markScheme: "$3x + 6 + 2x - 2 = 5x + 4$", marks: 3 },
  ]);
  const mathsQuiz = await makeItem(sarah, "maths", "quiz", "Fractions quick quiz", "Fractions", [
    { type: "mcq", question: "What is $\\frac{1}{2} + \\frac{1}{4}$?", options: ["$\\frac{2}{6}$", "$\\frac{3}{4}$", "$\\frac{1}{8}$", "$\\frac{2}{4}$"], correct: 1, explain: "Make the bottoms the same: $\\frac{2}{4} + \\frac{1}{4}$." },
    { type: "mcq", question: "Which is the largest?", options: ["$\\frac{1}{3}$", "$\\frac{2}{5}$", "$\\frac{3}{8}$", "$\\frac{1}{4}$"], correct: 1, explain: "Compare as decimals: 0.33, 0.4, 0.375, 0.25." },
  ]);
  const physLesson = await makeItem(david, "physics", "lesson", "Forces and motion", topicsOf("physics")[0].name, [
    { type: "slide", title: "Resultant force", body: "The resultant force is the single force that has the same effect as all the forces acting on an object.\n\n$F = ma$" },
    { type: "mcq", question: "A 2 kg mass has a resultant force of 10 N. What is its acceleration?", options: ["5 m/s²", "20 m/s²", "0.2 m/s²", "8 m/s²"], correct: 0, explain: "$a = F \\div m = 10 \\div 2$." },
    { type: "written", question: "State Newton's second law.", markScheme: "Acceleration is proportional to the resultant force and inversely proportional to the mass.", marks: 2 },
  ]);
  const route = async (tutor: number, subject: string, name: string, items: [number, number][], groupKey: string) => {
    const r = await run("INSERT INTO learning_routes (name, subject_id, level_id, created_by, assigned_at) VALUES (?, ?, 'gcse', ?, NOW())", [name, subject, tutor]);
    for (let i = 0; i < items.length; i++) await run("INSERT INTO route_steps (route_id, position, item_id, week) VALUES (?, ?, ?, ?)", [r.insertId, i, items[i][0], items[i][1]]);
    await run("INSERT INTO route_audience (route_id, group_id, enrolment_id) VALUES (?, ?, NULL)", [r.insertId, groupId[groupKey]]);
    return r.insertId;
  };
  await route(sarah, "maths", "Algebra foundations", [[mathsLesson, 1], [mathsQuiz, 2]], "maths");
  await route(david, "physics", "Forces starter", [[physLesson, 1]], "physics");

  // some students have already done tasks
  for (const [key, e] of Object.entries(enrolBy)) {
    const h = hash(key);
    if (e.subject === "maths" && STUDENTS.find((s) => s.name === e.student)?.group === "maths" && h % 3 !== 0) await run("INSERT INTO item_completions (enrolment_id, item_id, score) VALUES (?, ?, ?)", [e.id, mathsLesson, 50 + (h % 51)]);
    if (e.subject === "physics" && STUDENTS.find((s) => s.name === e.student)?.group === "physics" && h % 2 === 0) await run("INSERT INTO item_completions (enrolment_id, item_id, score) VALUES (?, ?, ?)", [e.id, physLesson, 40 + (h % 61)]);
  }

  // ---- calendar: last week's lesson (logged) and the next two (booked), for each group
  for (const [key, subj, tutor, day, time, topicName] of [
    ["maths", "maths", sarah, 3, "17:00:00", "Fractions"],
    ["physics", "physics", david, 1, "18:00:00", topicsOf("physics")[0].name],
  ] as const) {
    const members = Object.values(enrolBy).filter((e) => e.subject === subj && STUDENTS.find((s) => s.name === e.student)?.group === key);
    const past = nextWeekday(day, -1);
    if (past > new Date()) past.setDate(past.getDate() - 7);
    const pb = await run("INSERT INTO session_bookings (kind, group_id, enrolment_id, tutor_id, session_date, start_time, minutes, zoom_link, logged) VALUES ('group', ?, NULL, ?, ?, ?, 60, ?, 1)", [groupId[key], tutor, ymd(past), time, "https://zoom.us/j/demo-" + subj]);
    const t = topicsOf(subj).find((x) => x.name === topicName) ?? topicsOf(subj)[0];
    const log = await run("INSERT INTO lesson_logs (booking_id, tutor_id, topic_id, topic_name, note, homework) VALUES (?, ?, ?, ?, ?, ?)", [pb.insertId, tutor, t.id, t.name, "Good session. Most of the class were confident; two need another example.", "Finish the practice sheet."]);
    for (const m of members) await run("INSERT INTO lesson_log_attendance (log_id, enrolment_id, present) VALUES (?, ?, ?)", [log.insertId, m.id, hash(m.student + "att") % 6 === 0 ? 0 : 1]);
    for (const w of [0, 1]) {
      const d = nextWeekday(day, w);
      await run("INSERT INTO session_bookings (kind, group_id, enrolment_id, tutor_id, session_date, start_time, minutes, zoom_link, logged) VALUES ('group', ?, NULL, ?, ?, ?, 60, ?, 0)", [groupId[key], tutor, ymd(d), time, "https://zoom.us/j/demo-" + subj]);
    }
  }
  // a one-to-one session for a student without a group
  const harry = enrolBy["Harry Wilson|chemistry"];
  await run("INSERT INTO session_bookings (kind, group_id, enrolment_id, tutor_id, session_date, start_time, minutes, zoom_link, logged) VALUES ('one', NULL, ?, ?, ?, '16:00:00', 45, ?, 0)", [harry.id, david, ymd(addDays(3)), "https://zoom.us/j/demo-one"]);

  // ---- monthly reports (a draft, a ready one and a sent one)
  const report = async (key: string, tutor: number, status: string, body: string) => run("INSERT INTO monthly_reports (enrolment_id, tutor_id, report_month, body, status, sent_at) VALUES (?, ?, ?, ?, ?, ?)", [enrolBy[key].id, tutor, new Date().toLocaleString("en-GB", { month: "long", year: "numeric" }), body, status, status === "sent" ? new Date() : null]);
  await report("Aisha Khan|maths", sarah, "sent", "Aisha has worked steadily this month and moved from a 5 towards a 6 on algebra questions. Next: factorising.");
  await report("Ben Carter|maths", sarah, "ready", "Ben is confident with number and algebra. He should practise showing more working on longer questions.");
  await report("Chloe Evans|maths", sarah, "draft", "");
  await report("Grace Liu|physics", david, "ready", "Grace is working at a 7-8 standard in physics. Keep practising 6-mark questions.");

  // ---- chats (the thread id is the student and the teacher; the last message from a student is unread by the teacher)
  const chat = async (student: string, subject: string, lines: [("t" | "s"), string][]) => {
    const sid = studentId[student], tid = tutorId[subject];
    await run("INSERT IGNORE INTO chat_threads (student_id, staff_id) VALUES (?, ?)", [sid, tid]);
    for (let i = 0; i < lines.length; i++) await run("INSERT INTO chat_messages (student_id, staff_id, sender_id, body, created_at) VALUES (?, ?, ?, ?, ?)", [sid, tid, lines[i][0] === "t" ? tid : sid, lines[i][1], new Date(Date.now() - (lines.length - i) * 3600_000 * 5)]);
  };
  await chat("Aisha Khan", "maths", [["t", "Hi Aisha, welcome to the group! Your first task is on your learning map."], ["s", "Thank you! Can I do it before Thursday?"], ["t", "Yes, that's perfect."]]);
  await chat("Ben Carter", "maths", [["t", "Great quiz score last week, Ben."], ["s", "Thanks, could we go over simultaneous equations?"]]);
  await chat("Farhan Ali", "physics", [["t", "Hi Farhan, I've added a Forces starter route for you."], ["s", "Got it, I'll start tonight."]]);
  await chat("Harry Wilson", "chemistry", [["t", "Hi Harry, your one-to-one session is booked for this week."]]);

  console.log(`\nDemo data added to "${dbName}": ${TEACHERS.length} teachers and ${STUDENTS.length} students.`);
  console.log(`Password for every demo account: ${PASSWORD}\n`);
  console.log("Teachers (Teacher tab):");
  for (const t of TEACHERS) console.log(`  ${t.name.padEnd(16)} ${emailOf(t.name)}   [${t.subjects.join(", ")}]`);
  console.log("Students (Student tab):");
  for (const s of STUDENTS) console.log(`  ${s.name.padEnd(16)} ${emailOf(s.name)}   [${Object.keys(s.subs).join(", ")}]`);
  console.log("\nRemove it all again with: npm run db:unseed-demo\n");
} finally {
  await db.end();
}
