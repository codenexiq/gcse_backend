-- The learning map: topics grouped into strands (so tutors can change them later), and the minutes a student practises each day.
CREATE TABLE learning_strands (
  id       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name     VARCHAR(100) NOT NULL,
  position SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ls_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE learning_topics (
  id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  strand_id INT UNSIGNED NOT NULL,
  -- The same name the diagnostic questions and student_topic_status use.
  name      VARCHAR(100) NOT NULL,
  position  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_lt_name (name),
  KEY idx_lt_strand (strand_id, position),
  CONSTRAINT fk_lt_strand FOREIGN KEY (strand_id) REFERENCES learning_strands (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Minutes spent practising on one day (the weekly chart on the learning map).
CREATE TABLE practice_minutes (
  student_id INT UNSIGNED NOT NULL,
  day        DATE NOT NULL,
  minutes    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (student_id, day),
  CONSTRAINT fk_pm_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO learning_strands (name, position) VALUES
  ('Number', 1), ('Algebra', 2), ('Ratio and proportion', 3), ('Geometry and measures', 4), ('Probability', 5), ('Statistics', 6);

INSERT INTO learning_topics (strand_id, name, position)
SELECT s.id, t.name, t.position FROM learning_strands s JOIN (
  SELECT 'Number' AS strand, 'Place value and rounding' AS name, 1 AS position UNION ALL
  SELECT 'Number', 'Negative numbers', 2 UNION ALL SELECT 'Number', 'Fractions', 3 UNION ALL SELECT 'Number', 'Percentages', 4 UNION ALL
  SELECT 'Number', 'Indices and surds', 5 UNION ALL SELECT 'Number', 'Standard form', 6 UNION ALL
  SELECT 'Algebra', 'Solving linear equations', 1 UNION ALL SELECT 'Algebra', 'Expanding brackets', 2 UNION ALL SELECT 'Algebra', 'Factorising quadratics', 3 UNION ALL
  SELECT 'Algebra', 'Simultaneous equations', 4 UNION ALL SELECT 'Algebra', 'Rearranging formulae', 5 UNION ALL SELECT 'Algebra', 'Sequences', 6 UNION ALL
  SELECT 'Ratio and proportion', 'Ratio', 1 UNION ALL SELECT 'Ratio and proportion', 'Direct and inverse proportion', 2 UNION ALL SELECT 'Ratio and proportion', 'Compound interest', 3 UNION ALL
  SELECT 'Geometry and measures', 'Area and volume', 1 UNION ALL SELECT 'Geometry and measures', 'Pythagoras', 2 UNION ALL SELECT 'Geometry and measures', 'Trigonometry', 3 UNION ALL SELECT 'Geometry and measures', 'Circle theorems', 4 UNION ALL
  SELECT 'Probability', 'Basic probability', 1 UNION ALL SELECT 'Probability', 'Tree diagrams', 2 UNION ALL SELECT 'Probability', 'Venn diagrams', 3 UNION ALL
  SELECT 'Statistics', 'Averages and range', 1 UNION ALL SELECT 'Statistics', 'Charts and graphs', 2 UNION ALL SELECT 'Statistics', 'Cumulative frequency', 3
) t ON t.strand = s.name;
