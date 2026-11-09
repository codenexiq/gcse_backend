-- A fresh set of practice questions made for one student on one topic (after a low lesson score).
CREATE TABLE practice_sets (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id INT UNSIGNED NOT NULL,
  topic      VARCHAR(100) NOT NULL,
  -- The questions (with the right answers), as JSON text.
  blocks     LONGTEXT     NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ps_student (student_id, topic),
  CONSTRAINT fk_ps_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
