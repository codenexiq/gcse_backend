-- Student dashboard: which lessons, notes and quizzes a student has finished (for each of their subjects).
CREATE TABLE item_completions (
  enrolment_id INT UNSIGNED NOT NULL,
  item_id      INT UNSIGNED NOT NULL,
  score        TINYINT UNSIGNED NULL,
  completed_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (enrolment_id, item_id),
  CONSTRAINT fk_ic_enrol FOREIGN KEY (enrolment_id) REFERENCES enrolments (id)    ON DELETE CASCADE,
  CONSTRAINT fk_ic_item  FOREIGN KEY (item_id)      REFERENCES content_items (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
