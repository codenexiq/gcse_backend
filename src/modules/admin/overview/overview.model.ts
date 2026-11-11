import type { RowDataPacket } from "mysql2";
import { pool } from "../../../config/db/index.js";
import { pathName } from "../shared/catalog.js";

/** A pathway needs setup when it has no tutor, or its plan has live classes but it has no group and no booked session. */
const NEEDS_SETUP = `(e.tutor_id IS NULL OR (pl.live_classes > 0 AND e.group_id IS NULL
                      AND NOT EXISTS (SELECT 1 FROM session_bookings b WHERE b.enrolment_id = e.id)))`;

/** A session is waiting for its log once it has ended (and was in the last 14 days). */
const PENDING_LOG = `b.logged = 0 AND TIMESTAMP(b.session_date, b.start_time) + INTERVAL b.minutes MINUTE < NOW() AND b.session_date >= CURDATE() - INTERVAL 14 DAY`;

async function needsAction() {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT e.id, e.tier, e.tutor_id, e.group_id, e.subject_id, e.level_id, u.id AS student_id, u.full_name, u.email,
            pl.name AS plan_name, s.name AS subject_name, l.short_name
       FROM enrolments e
       JOIN users u ON u.id = e.student_id
       JOIN student_profiles sp ON sp.user_id = u.id
       JOIN plans pl ON pl.id = sp.plan_id
       JOIN subjects s ON s.id = e.subject_id
       JOIN levels l ON l.id = e.level_id
      WHERE ${NEEDS_SETUP} ORDER BY e.id`
  );
  return rows.map((r) => ({
    enrolmentId: r.id as number,
    student: { id: r.student_id as number, name: r.full_name as string, email: (r.email ?? "") as string },
    pathway: pathName(r.short_name, r.subject_name, r.tier),
    planName: r.plan_name as string,
    subjectId: r.subject_id as string,
    levelId: r.level_id as string,
    tutorId: r.tutor_id as number | null,
    groupId: r.group_id as number | null,
  }));
}

async function readyReports() {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT r.id, r.report_month, r.body, tu.full_name AS tutor_name, u.full_name AS student_name,
            sp.parent_name, sp.parent_email, s.name AS subject_name, l.short_name, e.tier
       FROM monthly_reports r
       JOIN enrolments e ON e.id = r.enrolment_id
       JOIN users u ON u.id = e.student_id
       JOIN student_profiles sp ON sp.user_id = u.id
       JOIN subjects s ON s.id = e.subject_id
       JOIN levels l ON l.id = e.level_id
       JOIN users tu ON tu.id = r.tutor_id
      WHERE r.status = 'ready' ORDER BY r.id`
  );
  return rows.map((r) => ({
    id: r.id as number,
    studentName: r.student_name as string,
    pathway: pathName(r.short_name, r.subject_name, r.tier),
    month: r.report_month as string,
    tutorName: r.tutor_name as string,
    text: r.body as string,
    parent: { name: r.parent_name as string, email: r.parent_email as string },
  }));
}

export async function overview() {
  const [[k]] = await Promise.all([
    pool.query<RowDataPacket[]>(
      `SELECT (SELECT COUNT(*) FROM users WHERE role = 'student') AS students,
              (SELECT COUNT(*) FROM enrolments) AS pathways,
              (SELECT COUNT(*) FROM users WHERE role = 'tutor') AS tutors,
              (SELECT COUNT(*) FROM session_groups) AS grps`
    ),
  ]);
  const kpis = { students: Number(k[0].students), pathways: Number(k[0].pathways), tutors: Number(k[0].tutors), groups: Number(k[0].grps) };

  const [plans] = await pool.query<RowDataPacket[]>(
    `SELECT pl.id, pl.name, (SELECT COUNT(*) FROM student_profiles sp WHERE sp.plan_id = pl.id) AS n FROM plans pl ORDER BY pl.position, pl.id`
  );
  const [subjects] = await pool.query<RowDataPacket[]>(
    `SELECT s.id, s.name, s.icon, s.color, (SELECT COUNT(*) FROM enrolments e WHERE e.subject_id = s.id) AS n FROM subjects s ORDER BY s.position, s.id`
  );
  const [tutors] = await pool.query<RowDataPacket[]>(
    `SELECT t.id, t.full_name,
            (SELECT COUNT(DISTINCT e.id) FROM enrolments e WHERE e.tutor_id = t.id OR e.group_id IN (SELECT id FROM session_groups WHERE tutor_id = t.id)) AS students,
            (SELECT COUNT(*) FROM session_bookings b WHERE b.tutor_id = t.id AND ${PENDING_LOG}) AS pending
       FROM users t WHERE t.role = 'tutor' ORDER BY t.id`
  );

  return {
    kpis,
    plans: plans.map((p) => ({ id: p.id as string, name: p.name as string, count: Number(p.n), percent: kpis.students ? Math.round((Number(p.n) / kpis.students) * 100) : 0 })),
    subjects: subjects
      .filter((s) => Number(s.n) > 0)
      .map((s) => ({ id: s.id as string, name: s.name as string, icon: s.icon as string, color: s.color as string, count: Number(s.n), percent: Math.round((Number(s.n) / kpis.pathways) * 100) })),
    needsAction: await needsAction(),
    reports: await readyReports(),
    tutors: tutors.map((t) => ({ id: t.id as number, name: t.full_name as string, students: Number(t.students), pendingLogs: Number(t.pending) })),
  };
}

/** The number on the Overview tab: pathways needing setup plus reports waiting to be sent. */
export async function attention() {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT (SELECT COUNT(*) FROM enrolments e JOIN student_profiles sp ON sp.user_id = e.student_id JOIN plans pl ON pl.id = sp.plan_id WHERE ${NEEDS_SETUP}) AS setup,
            (SELECT COUNT(*) FROM monthly_reports WHERE status = 'ready') AS ready`
  );
  return { count: Number(rows[0].setup) + Number(rows[0].ready) };
}
