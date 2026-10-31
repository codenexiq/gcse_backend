import type { RowDataPacket } from "mysql2";
import { pool } from "../../config/db/index.js";
import type { ContentUpdate } from "./content.schemas.js";

interface ContentRow extends RowDataPacket, ContentUpdate {}

const SELECT = "SELECT badge, heading, intro, hint, highlight, button_label AS buttonLabel, questions, next_label AS nextLabel, next_heading AS nextHeading, next_text AS nextText FROM startup_content WHERE id = 1";

export async function getContent() {
  const [rows] = await pool.query<ContentRow[]>(SELECT);
  return rows[0] ?? null;
}

export async function updateContent(c: ContentUpdate) {
  await pool.query(
    "UPDATE startup_content SET badge = ?, heading = ?, intro = ?, hint = ?, highlight = ?, button_label = ?, questions = ?, next_label = ?, next_heading = ?, next_text = ? WHERE id = 1",
    [c.badge, c.heading, c.intro, c.hint, c.highlight, c.buttonLabel, c.questions, c.nextLabel, c.nextHeading, c.nextText]
  );
  return getContent();
}
