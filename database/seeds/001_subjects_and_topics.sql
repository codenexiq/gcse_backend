-- GCSE subjects and starter topics. Safe to run many times (existing rows are left alone).
INSERT IGNORE INTO subjects (name, slug) VALUES
  ('Maths',               'maths'),
  ('English Language',    'english-language'),
  ('English Literature',  'english-literature'),
  ('Biology',             'biology'),
  ('Chemistry',           'chemistry'),
  ('Physics',             'physics'),
  ('Computer Science',    'computer-science'),
  ('History',             'history'),
  ('Geography',           'geography');

INSERT IGNORE INTO topics (subject_id, name, slug)
SELECT s.id, t.name, t.slug
FROM subjects s
JOIN (
  SELECT 'maths' AS subject, 'Algebra' AS name, 'algebra' AS slug
  UNION ALL SELECT 'maths', 'Geometry and measures', 'geometry-and-measures'
  UNION ALL SELECT 'maths', 'Probability', 'probability'
  UNION ALL SELECT 'maths', 'Statistics', 'statistics'
  UNION ALL SELECT 'english-language', 'Reading comprehension', 'reading-comprehension'
  UNION ALL SELECT 'english-language', 'Creative writing', 'creative-writing'
  UNION ALL SELECT 'english-language', 'Transactional writing', 'transactional-writing'
  UNION ALL SELECT 'english-literature', 'Shakespeare', 'shakespeare'
  UNION ALL SELECT 'english-literature', 'Poetry anthology', 'poetry-anthology'
  UNION ALL SELECT 'english-literature', '19th-century novel', '19th-century-novel'
  UNION ALL SELECT 'biology', 'Cell biology', 'cell-biology'
  UNION ALL SELECT 'biology', 'Organisation', 'organisation'
  UNION ALL SELECT 'biology', 'Infection and response', 'infection-and-response'
  UNION ALL SELECT 'biology', 'Bioenergetics', 'bioenergetics'
  UNION ALL SELECT 'chemistry', 'Atomic structure', 'atomic-structure'
  UNION ALL SELECT 'chemistry', 'Bonding', 'bonding'
  UNION ALL SELECT 'chemistry', 'Quantitative chemistry', 'quantitative-chemistry'
  UNION ALL SELECT 'chemistry', 'Rates of reaction', 'rates-of-reaction'
  UNION ALL SELECT 'physics', 'Forces', 'forces'
  UNION ALL SELECT 'physics', 'Energy', 'energy'
  UNION ALL SELECT 'physics', 'Electricity', 'electricity'
  UNION ALL SELECT 'physics', 'Waves', 'waves'
  UNION ALL SELECT 'computer-science', 'Algorithms', 'algorithms'
  UNION ALL SELECT 'computer-science', 'Programming', 'programming'
  UNION ALL SELECT 'computer-science', 'Data representation', 'data-representation'
  UNION ALL SELECT 'computer-science', 'Networks', 'networks'
  UNION ALL SELECT 'history', 'Medicine through time', 'medicine-through-time'
  UNION ALL SELECT 'history', 'Weimar and Nazi Germany', 'weimar-and-nazi-germany'
  UNION ALL SELECT 'history', 'Cold War', 'cold-war'
  UNION ALL SELECT 'geography', 'Natural hazards', 'natural-hazards'
  UNION ALL SELECT 'geography', 'Rivers', 'rivers'
  UNION ALL SELECT 'geography', 'Urban issues', 'urban-issues'
) t ON t.subject = s.slug;
