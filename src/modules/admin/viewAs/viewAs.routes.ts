import { Router } from "express";
import type { RowDataPacket } from "mysql2";
import { z } from "zod";
import { env } from "../../../config/env/index.js";
import { pool } from "../../../config/db/index.js";
import { viewCookie } from "../../../middleware/actingAs/index.js";
import { validate } from "../../../middleware/validate/index.js";
import { asyncHandler } from "../../../utils/asyncHandler/index.js";
import { AppError } from "../../../utils/AppError/index.js";

// Mounted at /admin/view-as. Which teacher or student the administrator is looking at in the Teacher and Student panels.
const router = Router();
const panelOf = (v: unknown) => {
  if (v !== "tutor" && v !== "student") throw new AppError(404, "Not found");
  return v;
};

router.get(
  "/:panel",
  asyncHandler(async (req, res) => {
    const panel = panelOf(req.params.panel);
    const [people] = await pool.query<RowDataPacket[]>(
      panel === "tutor"
        ? `SELECT u.id, u.full_name, (SELECT GROUP_CONCAT(s.name ORDER BY s.position SEPARATOR ', ') FROM tutor_subjects ts JOIN subjects s ON s.id = ts.subject_id WHERE ts.user_id = u.id) AS detail
             FROM users u WHERE u.role = 'tutor' AND u.is_active = 1 ORDER BY u.full_name`
        : `SELECT u.id, u.full_name, (SELECT GROUP_CONCAT(CONCAT(l.short_name, ' ', s.name) ORDER BY e.id SEPARATOR ', ') FROM enrolments e JOIN subjects s ON s.id = e.subject_id JOIN levels l ON l.id = e.level_id WHERE e.student_id = u.id) AS detail
             FROM users u WHERE u.role = 'student' AND u.is_active = 1 ORDER BY u.full_name`
    );
    const id = Number(req.cookies?.[viewCookie(panel)]);
    const options = people.map((p) => ({ id: p.id as number, name: p.full_name as string, detail: (p.detail ?? "") as string }));
    res.json({ current: options.find((o) => o.id === id) ?? null, options });
  })
);

router.post(
  "/",
  validate(z.object({ panel: z.enum(["tutor", "student"]), userId: z.number().int().positive().nullable() })),
  asyncHandler(async (req, res) => {
    const { panel, userId } = req.body as { panel: "tutor" | "student"; userId: number | null };
    if (userId === null) {
      res.clearCookie(viewCookie(panel), { path: "/" });
    } else {
      const [rows] = await pool.query<RowDataPacket[]>("SELECT id FROM users WHERE id = ? AND role = ? AND is_active = 1", [userId, panel]);
      if (rows.length === 0) throw new AppError(404, "Not found");
      res.cookie(viewCookie(panel), String(userId), { httpOnly: true, secure: env.isProduction, sameSite: "strict", path: "/", maxAge: 8 * 3600 * 1000 });
    }
    res.json({ ok: true });
  })
);

export default router;
