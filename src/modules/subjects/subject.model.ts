import type { RowDataPacket } from "mysql2";
import { pool } from "../../config/db/index.js";

interface SubjectRow extends RowDataPacket {
  id: number;
  name: string;
  slug: string;
}
interface TopicRow extends RowDataPacket {
  id: number;
  subject_id: number;
  name: string;
  slug: string;
}

export interface SubjectWithTopics {
  id: number;
  name: string;
  slug: string;
  topics: { id: number; name: string; slug: string }[];
}

// Subjects/topics almost never change, so keep them in memory for a while
// instead of asking MySQL on every request.
const CACHE_MS = 10 * 60 * 1000;
let cache: { data: SubjectWithTopics[] | null; expires: number } = { data: null, expires: 0 };

/** Every subject with its topics: [{ id, name, slug, topics: [{ id, name, slug }] }] */
export async function findAllWithTopics(): Promise<SubjectWithTopics[]> {
  if (cache.data && Date.now() < cache.expires) return cache.data;

  const [subjects] = await pool.query<SubjectRow[]>("SELECT id, name, slug FROM subjects ORDER BY name");
  const [topics] = await pool.query<TopicRow[]>(
    "SELECT id, subject_id, name, slug FROM topics ORDER BY name"
  );

  const data = subjects.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    topics: topics
      .filter((t) => t.subject_id === s.id)
      .map(({ id, name, slug }) => ({ id, name, slug })),
  }));

  cache = { data, expires: Date.now() + CACHE_MS };
  return data;
}

export async function topicExists(id: number) {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT 1 FROM topics WHERE id = ?", [id]);
  return rows.length > 0;
}
