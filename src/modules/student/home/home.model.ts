import type { RowDataPacket } from "mysql2";
import { pool } from "../../../config/db/index.js";
import { AppError } from "../../../utils/AppError/index.js";
import { ownsEnrolment } from "../shared/mine.js";

export type TopicStatus = "M" | "P" | "W" | "N";

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** The student's subjects (one tab each), and everything for the chosen one: learning map, tasks, live lessons and progress. */
export async function home(studentId: number, wanted?: number) {
  const [me] = await pool.query<RowDataPacket[]>(
    `SELECT u.full_name, l.name AS level_name, p.name AS plan_name, p.live_classes
       FROM users u LEFT JOIN student_profiles sp ON sp.user_id = u.id LEFT JOIN levels l ON l.id = sp.level_id LEFT JOIN plans p ON p.id = sp.plan_id WHERE u.id = ?`,
    [studentId]
  );
  const [enrols] = await pool.query<RowDataPacket[]>(
    `SELECT e.id, e.tier, e.current_grade, e.target_grade, e.diagnostic_done, e.group_id, e.subject_id, e.level_id,
            s.name AS subject_name, s.icon, s.color, l.short_name
       FROM enrolments e JOIN subjects s ON s.id = e.subject_id JOIN levels l ON l.id = e.level_id WHERE e.student_id = ? ORDER BY e.id`,
    [studentId]
  );
  const student = {
    name: me[0].full_name as string,
    level: (me[0].level_name ?? "") as string,
    plan: { name: (me[0].plan_name ?? "") as string, live: Number(me[0].live_classes ?? 0) > 0 },
  };
  const subjects = enrols.map((e) => ({
    id: e.id as number,
    subject: { id: e.subject_id as string, icon: e.icon as string, color: e.color as string },
    pathName: `${e.short_name} ${e.subject_name}${e.tier ? ` · ${e.tier}` : ""}`,
    diagnosticDone: Boolean(e.diagnostic_done),
  }));
  if (enrols.length === 0) return { student, subjects, current: null };

  const e = enrols.find((x) => x.id === wanted) ?? enrols[0];
  const [topics] = await pool.query<RowDataPacket[]>(
    `SELECT st.id AS strand_id, st.name AS strand, t.id, t.name, COALESCE(ts.status, 'N') AS status
       FROM strands st JOIN topics t ON t.strand_id = st.id
       LEFT JOIN enrolment_topic_status ts ON ts.enrolment_id = ? AND ts.topic_id = t.id
      WHERE st.subject_id = ? AND st.level_id = ? ORDER BY st.position, st.id, t.position, t.id`,
    [e.id, e.subject_id, e.level_id]
  );
  const strands: { id: number; name: string; topics: { id: number; name: string; status: TopicStatus }[] }[] = [];
  for (const t of topics) {
    let s = strands.find((x) => x.id === t.strand_id);
    if (!s) strands.push((s = { id: t.strand_id, name: t.strand, topics: [] }));
    s.topics.push({ id: t.id, name: t.name, status: t.status });
  }

  // Tasks: the visible steps of every route shown to this student (or to their group). Each is due at the end of its week.
  const [steps] = await pool.query<RowDataPacket[]>(
    `SELECT DISTINCT r.id AS route_id, r.name AS route_name, COALESCE(r.assigned_at, r.created_at) AS assigned, rs.position, rs.week,
            i.id AS item_id, i.kind, i.title, t.name AS topic, (ic.item_id IS NOT NULL) AS done
       FROM learning_routes r
       JOIN route_audience a ON a.route_id = r.id AND (a.enrolment_id = ? OR (a.group_id IS NOT NULL AND a.group_id = ?))
       JOIN route_steps rs ON rs.route_id = r.id
       JOIN content_items i ON i.id = rs.item_id AND i.published = 1
       LEFT JOIN topics t ON t.id = i.topic_id
       LEFT JOIN item_completions ic ON ic.enrolment_id = ? AND ic.item_id = i.id
      WHERE r.subject_id = ? AND r.level_id = ? ORDER BY r.id, rs.position`,
    [e.id, e.group_id ?? 0, e.id, e.subject_id, e.level_id]
  );
  const today = ymd(new Date());
  const tasks = steps
    .map((s) => {
      const due = new Date(s.assigned);
      due.setDate(due.getDate() + Number(s.week) * 7 - 1);
      return { itemId: s.item_id as number, kind: s.kind as string, title: s.title as string, topic: (s.topic ?? "") as string, done: Boolean(s.done), due: ymd(due), routeName: s.route_name as string };
    })
    .sort((a, b) => (a.done === b.done ? (a.due < b.due ? -1 : 1) : a.done ? 1 : -1))
    .map((t) => ({ ...t, late: !t.done && t.due < today }));

  const [sessions] = await pool.query<RowDataPacket[]>(
    `SELECT b.id, b.session_date, b.start_time, b.zoom_link, g.name AS group_name, tu.full_name AS tutor_name
       FROM session_bookings b LEFT JOIN session_groups g ON g.id = b.group_id JOIN users tu ON tu.id = b.tutor_id
      WHERE (b.enrolment_id = ? OR (b.group_id IS NOT NULL AND b.group_id = ?)) AND TIMESTAMP(b.session_date, b.start_time) + INTERVAL b.minutes MINUTE >= NOW()
      ORDER BY b.session_date, b.start_time LIMIT 3`,
    [e.id, e.group_id ?? 0]
  );
  const all = strands.flatMap((s) => s.topics);
  return {
    student,
    subjects,
    current: {
      id: e.id as number,
      subject: { id: e.subject_id as string, name: e.subject_name as string, icon: e.icon as string, color: e.color as string },
      pathName: `${e.short_name} ${e.subject_name}${e.tier ? ` · ${e.tier}` : ""}`,
      diagnosticDone: Boolean(e.diagnostic_done),
      currentGrade: e.current_grade as string,
      targetGrade: e.target_grade as string,
      strands,
      mastered: all.filter((t) => t.status === "M").length,
      total: all.length,
      tasks,
      sessions: sessions.map((s) => ({ id: s.id as number, date: s.session_date as string, start: String(s.start_time).slice(0, 5), who: s.group_name ? (s.group_name as string) : `1-to-1 with ${s.tutor_name}`, zoom: (s.zoom_link ?? "") as string })),
    },
  };
}

/** One topic of the learning map: its status and the visible lessons, notes and quizzes on it. */
export async function topic(studentId: number, enrolmentId: number, topicId: number) {
  const e = await ownsEnrolment(studentId, enrolmentId);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT t.id, t.name, st.name AS strand, COALESCE(ts.status, 'N') AS status FROM topics t JOIN strands st ON st.id = t.strand_id
       LEFT JOIN enrolment_topic_status ts ON ts.enrolment_id = ? AND ts.topic_id = t.id
      WHERE t.id = ? AND st.subject_id = ? AND st.level_id = ?`,
    [enrolmentId, topicId, e.subject_id, e.level_id]
  );
  if (rows.length === 0) throw new AppError(404, "Not found");
  const [items] = await pool.query<RowDataPacket[]>(
    `SELECT i.id, i.kind, i.title, (ic.item_id IS NOT NULL) AS done FROM content_items i
       LEFT JOIN item_completions ic ON ic.enrolment_id = ? AND ic.item_id = i.id
      WHERE i.topic_id = ? AND i.published = 1 ORDER BY i.id`,
    [enrolmentId, topicId]
  );
  return {
    enrolmentId,
    topic: { id: rows[0].id as number, name: rows[0].name as string, strand: rows[0].strand as string, status: rows[0].status as TopicStatus },
    items: items.map((i) => ({ id: i.id as number, kind: i.kind as string, title: i.title as string, done: Boolean(i.done) })),
  };
}
