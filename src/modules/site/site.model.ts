import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../../config/db/index.js";
import type { EnquiryInput } from "./site.schemas.js";

/** Reads a JSON text column. Bad or empty data gives the fallback instead of an error. */
function parseJson<T>(text: string | null, fallback: T): T {
  try {
    return text ? (JSON.parse(text) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** A date column as "2026-05-22" (no time zone shifts). */
const day = (d: Date | string) => (d instanceof Date ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : String(d).slice(0, 10));

// ---------- what visitors read ----------

interface PostRow extends RowDataPacket {
  id: number;
  title: string;
  excerpt: string;
  tag: string;
  author: string;
  published_on: Date | string;
  url: string;
  color: string;
  is_featured: number;
}

export async function listPosts(limit?: number) {
  const [rows] = await pool.query<PostRow[]>(
    `SELECT id, title, excerpt, tag, author, published_on, url, color, is_featured
       FROM site_posts WHERE is_published = 1 ORDER BY published_on DESC, id DESC${limit ? " LIMIT ?" : ""}`,
    limit ? [limit] : []
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    excerpt: r.excerpt,
    tag: r.tag,
    author: r.author,
    publishedOn: day(r.published_on),
    url: r.url,
    color: r.color,
    featured: r.is_featured === 1,
  }));
}

interface ProductRow extends RowDataPacket {
  id: number;
  slug: string;
  eyebrow: string;
  title: string;
  price: string;
  lead: string;
  tags_title: string;
  details: string;
  note: string;
}

interface Details {
  tags: string[];
  included: string[];
  perfect: string[];
  why: string[];
}

export async function listProducts() {
  const [rows] = await pool.query<ProductRow[]>(
    "SELECT id, slug, eyebrow, title, price, lead, tags_title, details, note FROM site_products WHERE is_published = 1 ORDER BY sort_order, id"
  );
  if (rows.length === 0) return [];
  const [images] = await pool.query<(RowDataPacket & { product_id: number; url: string; alt: string })[]>(
    "SELECT product_id, url, alt FROM site_product_images WHERE product_id IN (?) ORDER BY sort_order, id",
    [rows.map((r) => r.id)]
  );
  return rows.map((r) => {
    const d = parseJson<Partial<Details>>(r.details, {});
    return {
      id: r.id,
      slug: r.slug,
      eyebrow: r.eyebrow,
      title: r.title,
      price: r.price,
      lead: r.lead,
      tagsTitle: r.tags_title,
      tags: d.tags ?? [],
      included: d.included ?? [],
      perfect: d.perfect ?? [],
      why: d.why ?? [],
      note: r.note,
      images: images.filter((i) => i.product_id === r.id).map((i) => ({ url: i.url, alt: i.alt })),
    };
  });
}

interface TeamRow extends RowDataPacket {
  id: number;
  name: string;
  subjects: string;
  icon: string;
  color: string;
  bio: string;
  photo_url: string | null;
}

export async function listTeam() {
  const [rows] = await pool.query<TeamRow[]>("SELECT id, name, subjects, icon, color, bio, photo_url FROM site_team ORDER BY sort_order, id");
  return rows.map((r) => ({ id: r.id, name: r.name, subjects: r.subjects, icon: r.icon, color: r.color, bio: parseJson<string[]>(r.bio, []), photoUrl: r.photo_url }));
}

interface ReviewRow extends RowDataPacket {
  id: number;
  kind: "video" | "google";
  name: string;
  about: string;
  body: string | null;
  video_url: string | null;
  poster_url: string | null;
}

export async function listReviews() {
  const [rows] = await pool.query<ReviewRow[]>("SELECT id, kind, name, about, body, video_url, poster_url FROM site_reviews WHERE is_published = 1 ORDER BY sort_order, id");
  return {
    videos: rows.filter((r) => r.kind === "video").map((r) => ({ id: r.id, name: r.name, about: r.about, videoUrl: r.video_url, posterUrl: r.poster_url })),
    google: rows.filter((r) => r.kind === "google").map((r) => ({ id: r.id, name: r.name, about: r.about, text: r.body ?? "" })),
  };
}

// ---------- the contact form ----------

export async function createEnquiry(input: EnquiryInput) {
  const [res] = await pool.query<ResultSetHeader>(
    "INSERT INTO site_enquiries (parent_name, student_name, email, phone, year_group, subject, message) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [input.parentName, input.studentName, input.email, input.phone || null, input.yearGroup, input.subject, input.message || null]
  );
  return res.insertId;
}

// ---------- the admin inbox ----------

interface EnquiryRow extends RowDataPacket {
  id: number;
  parent_name: string;
  student_name: string;
  email: string;
  phone: string | null;
  year_group: string;
  subject: string;
  message: string | null;
  status: "new" | "contacted" | "closed";
  created_at: Date;
}

export async function listEnquiries() {
  const [rows] = await pool.query<EnquiryRow[]>(
    "SELECT id, parent_name, student_name, email, phone, year_group, subject, message, status, created_at FROM site_enquiries ORDER BY created_at DESC, id DESC LIMIT 500"
  );
  return rows.map((r) => ({
    id: r.id,
    parentName: r.parent_name,
    studentName: r.student_name,
    email: r.email,
    phone: r.phone,
    yearGroup: r.year_group,
    subject: r.subject,
    message: r.message,
    status: r.status,
    createdAt: r.created_at.toISOString(),
  }));
}

export async function setEnquiryStatus(id: number, status: string) {
  const [res] = await pool.query<ResultSetHeader>("UPDATE site_enquiries SET status = ? WHERE id = ?", [status, id]);
  return res.affectedRows > 0;
}

export async function removeEnquiry(id: number) {
  const [res] = await pool.query<ResultSetHeader>("DELETE FROM site_enquiries WHERE id = ?", [id]);
  return res.affectedRows > 0;
}
