import { fileURLToPath } from "node:url";
import type { Connection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { connect, dbName } from "./connection.js";

// The starting content of the public website (from the Educate Cloud design). Only fills a table that is still empty,
// so it never overwrites anything an admin has changed. `npm run db:seed-site`

type Color = "sky" | "rose" | "cream" | "lav";

const POSTS: { title: string; excerpt: string; tag: string; author: string; date: string; url: string; color: Color; featured?: boolean }[] = [
  { title: "GCSE motivation for the student who feels tired of revising", excerpt: "At the start of GCSE season, motivation feels easy. Here is what to do when it runs out.", tag: "Study skills", author: "Fatima", date: "2026-05-22", url: "https://educatecloud.co.uk/gcse-motivation-for-the-student-who-feels-tired-of-revising/", color: "sky" },
  { title: "Exam stress and the support teenagers actually remember", excerpt: "“I’m fine” often means “I’m overwhelmed”. How parents can help in the weeks before exams.", tag: "For parents", author: "Fatima", date: "2026-05-22", url: "https://educatecloud.co.uk/exam-stress-the-kind-of-support-teenagers-actually-remember/", color: "rose" },
  { title: "What is education actually meant to do?", excerpt: "Two classrooms, two realities: what I noticed between the UK and Pakistan’s education systems.", tag: "From the founder", author: "Zainab Abid", date: "2026-04-27", url: "https://educatecloud.co.uk/elementor-1065/", color: "cream", featured: true },
  { title: "A 4-week GCSE revision plan before your exams", excerpt: "Exams coming up and not sure where to start? A week-by-week plan you can follow.", tag: "Revision", author: "Fatima", date: "2026-03-23", url: "https://educatecloud.co.uk/a-4-week-gcse-revision-plan-before-your-exams/", color: "lav" },
  { title: "Is it too late to improve your GCSE grades?", excerpt: "If your exams are close and you feel you should have started earlier, take a breath. Here is what still works.", tag: "Revision", author: "Fatima", date: "2026-03-23", url: "https://educatecloud.co.uk/elementor-945/", color: "sky" },
  { title: "How to create the perfect online learning space for your child", excerpt: "Success in online learning is about more than handing a child a laptop.", tag: "For parents", author: "Zainab Abid", date: "2026-01-08", url: "https://educatecloud.co.uk/elementor-588/", color: "cream" },
  { title: "Back to school: essentials prep for GCSE students", excerpt: "The start of a new school year is exciting. A checklist to start it well.", tag: "Study skills", author: "Fatima", date: "2026-01-06", url: "https://educatecloud.co.uk/elementor-page-454/", color: "lav" },
  { title: "Understanding studying difficulties and how to overcome them", excerpt: "What makes studying hard for some students, and practical ways to help.", tag: "For parents", author: "Zainab Abid", date: "2026-01-06", url: "https://educatecloud.co.uk/elementor-page-425/", color: "rose" },
  { title: "7 tips to study smarter", excerpt: "Running out of time before exams? Seven proven revision techniques.", tag: "Study skills", author: "Zainab Abid", date: "2025-09-22", url: "https://educatecloud.co.uk/creative-class-library-for-science-students/", color: "sky" },
];

const PRODUCTS = [
  {
    slug: "physics",
    eyebrow: "Digital resource pack · AQA GCSE Physics",
    title: "GCSE Physics Complete Bundle",
    price: "£20",
    lead: "Notes, PowerPoints and exam questions for all 8 AQA GCSE Physics topics. Over 200 pages of colourful notes with images, ready to use straight away.",
    tagsTitle: "All 8 topics",
    details: {
      tags: ["Energy", "Electricity", "Particle model of matter", "Atomic structure", "Forces", "Waves", "Magnetism and electromagnetism", "Space physics"],
      included: ["Concise, clear GCSE Physics notes", "Topic-by-topic revision mats", "Topic-by-topic PowerPoints", "Exam-style practice questions with full mark schemes", "Progress checklists for every topic", "Written for the AQA specification"],
      perfect: ["Mock exam preparation", "Last-minute revision", "Independent study", "Boosting weak topics", "Structured exam practice"],
      why: ["No fluff, straight to the exam content", "Easy-to-understand explanations", "Exam tips and Higher-tier boxes", "Designed by an experienced GCSE tutor"],
    },
    note: "Written for AQA Separate (Triple) Physics, for students aiming for grades 7 to 9.",
  },
  {
    slug: "maths",
    eyebrow: "Digital resource bundle · Edexcel GCSE Maths",
    title: "Top GCSE Maths Questions",
    price: "£10",
    lead: "Exam-style questions modelled on the hardest questions in Edexcel GCSE Maths Papers 1, 2 and 3, each with a full model solution. Three digital booklets in one bundle.",
    tagsTitle: "3 booklets",
    details: {
      tags: ["Paper 1 (non-calculator)", "Paper 2 (calculator)", "Paper 3 (calculator)"],
      included: ["The hardest types of question on each Edexcel paper", "Similar in style to real exam questions", "A full model solution for every question", "Paper 1, Paper 2 and Paper 3 booklets", "Instant digital access"],
      perfect: ["Students aiming for grades 7 to 9", "Mock exam preparation", "Final weeks before the exam", "Practising the questions that catch people out"],
      why: ["Focuses on the questions that lose the most marks", "Model solutions show every step", "Organised by paper, so it matches the real exams", "Made by an experienced GCSE Maths tutor"],
    },
    note: "For Edexcel GCSE Maths.",
  },
];

const TEAM: { name: string; subjects: string; icon: string; color: Color; bio: string[] }[] = [
  {
    name: "Muhammad", subjects: "Physics", icon: "physics", color: "sky",
    bio: [
      "Muhammad is our dedicated Physics tutor, with a fascinating academic journey. Originally a pre-med student, he later discovered his passion for aviation and is now in pilot training, all while tutoring Physics, a subject he has always excelled in.",
      "His strong academic background and proven track record with students make him a reliable and relatable tutor. Learners appreciate his clarity, motivation and the real-world perspective he brings to physics.",
      "When he isn’t teaching, you’ll find him flying. Literally.",
    ],
  },
  {
    name: "Ayesha", subjects: "Biology and Chemistry", icon: "biology", color: "rose",
    bio: [
      "Ayesha is a friendly and dedicated Biology and Chemistry tutor who is currently studying for her MBBS, working towards her goal of becoming a doctor and contributing to medical research.",
      "She has a real passion for science, especially Biology and Chemistry, and loves helping students make sense of topics that can feel overwhelming at first.",
      "Outside tutoring and medical school, Ayesha is interested in research and the future of healthcare, and brings that curiosity into her lessons to make learning more meaningful. She offers flexible, student-friendly support and is committed to helping every learner reach their full potential.",
    ],
  },
];

// The clips live in frontend/public/site/reviews.
const VIDEO_REVIEWS = [
  { name: "Pavan Chundri", file: "pavan", about: "IGCSE Maths with Zainab · our first student from Qatar" },
  { name: "Jacob Pearce", file: "jacob", about: "Maths with Zainab, Physics with Muhammad" },
  { name: "Mehmona", file: "mehmona", about: "Science with Muhammad" },
];

const GOOGLE_REVIEWS = [
  {
    name: "Maria Mughal",
    about: "Parent of a KS3 student · Science with Muhammad",
    body: "We’ve had a great experience with Educate Cloud. My son has been having science tuition for the past couple of months and is still continuing his lessons. He genuinely enjoys them, which has made a big difference to his confidence and interest in the subject. We’ve already noticed an improvement in his performance at school.\n\nHis tutor, Muhammad, is very professional, patient, and friendly. He creates a supportive and engaging learning environment that really helps my son stay motivated.\n\nI would highly recommend Educate Cloud to anyone looking for quality tuition and dedicated tutors.",
  },
  {
    name: "Eshal",
    about: "GCSE and A-level Maths with Zainab",
    body: "Zainab is such an amazing tutor! She is patient, supportive, and always explains things in a way that’s easy to understand. She creates a comfortable learning environment where I never feel afraid to ask questions, and she truly cares about her students and their progress. I’m so grateful for her help and would highly recommend her to anyone looking for a great tutor in GCSE and A Level Maths!",
  },
  {
    name: "Aaron",
    about: "Lessons with Zainab",
    body: "Zainab is an amazing tutor who really cares. She quickly set up a personalised lesson plan and made learning fun and engaging. I’ve already learned more with her than I did at school. Highly recommend Educate Cloud if you want real progress!",
  },
];

const isEmpty = async (db: Connection, table: string) => {
  const [rows] = await db.query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM ${table}`);
  return Number(rows[0].n) === 0;
};

/** Fills every empty website table with the design's starting content. */
export async function seedSite(db: Connection) {
  if (await isEmpty(db, "site_posts")) {
    for (const p of POSTS) {
      await db.query(
        "INSERT INTO site_posts (title, excerpt, tag, author, published_on, url, color, is_featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [p.title, p.excerpt, p.tag, p.author, p.date, p.url, p.color, p.featured ? 1 : 0]
      );
    }
  }
  if (await isEmpty(db, "site_products")) {
    let order = 0;
    for (const p of PRODUCTS) {
      const [res] = await db.query<ResultSetHeader>(
        "INSERT INTO site_products (slug, eyebrow, title, price, lead, tags_title, details, note, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [p.slug, p.eyebrow, p.title, p.price, p.lead, p.tagsTitle, JSON.stringify(p.details), p.note, ++order]
      );
      // The pictures live in frontend/public/site/shop (physics-1.jpg ... / maths-1.jpg ...).
      const count = p.slug === "physics" ? 3 : 5;
      // Physics shows its cover first, then "what's included", then the collage of pages.
      const files = p.slug === "physics" ? [2, 3, 1] : Array.from({ length: count }, (_, k) => k + 1);
      for (const [k, n] of files.entries()) {
        await db.query("INSERT INTO site_product_images (product_id, url, alt, sort_order) VALUES (?, ?, ?, ?)", [res.insertId, `/site/shop/${p.slug}-${n}.jpg`, `${p.title}, picture ${k + 1}`, k + 1]);
      }
    }
  }
  if (await isEmpty(db, "site_team")) {
    let order = 0;
    for (const t of TEAM) {
      await db.query("INSERT INTO site_team (name, subjects, icon, color, bio, photo_url, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)", [t.name, t.subjects, t.icon, t.color, JSON.stringify(t.bio), `/site/team/${t.name.toLowerCase()}.jpg`, ++order]);
    }
  }
  if (await isEmpty(db, "site_reviews")) {
    let order = 0;
    for (const v of VIDEO_REVIEWS) await db.query("INSERT INTO site_reviews (kind, name, about, video_url, poster_url, sort_order) VALUES ('video', ?, ?, ?, ?, ?)", [v.name, v.about, `/site/reviews/${v.file}.mp4`, `/site/reviews/${v.file}.jpg`, ++order]);
    for (const g of GOOGLE_REVIEWS) await db.query("INSERT INTO site_reviews (kind, name, about, body, sort_order) VALUES ('google', ?, ?, ?, ?)", [g.name, g.about, g.body, ++order]);
  }
  console.log("Website content is in place.");
}

// Run directly: `npm run db:seed-site`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = await connect();
  console.log(`Seeding the website content in "${dbName}"...`);
  await seedSite(db).finally(() => db.end());
}
