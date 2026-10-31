-- What a student tells us on the "About you" screen (one row per student).
-- The four choices point at startup_options; if a tutor deletes a choice the student chose, it becomes empty (NULL).
CREATE TABLE student_profiles (
  user_id         INT UNSIGNED NOT NULL,
  level           ENUM('GCSE', 'IGCSE / O-level', 'A-level') NOT NULL,
  subject_id      INT UNSIGNED NULL,
  exam_board_id   INT UNSIGNED NULL,
  school_year_id  INT UNSIGNED NULL,
  target_grade_id INT UNSIGNED NULL,
  tier            ENUM('Foundation', 'Higher', 'Not sure yet') NOT NULL,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_sp_user    FOREIGN KEY (user_id)         REFERENCES users (id)           ON DELETE CASCADE,
  CONSTRAINT fk_sp_subject FOREIGN KEY (subject_id)      REFERENCES startup_options (id) ON DELETE SET NULL,
  CONSTRAINT fk_sp_board   FOREIGN KEY (exam_board_id)   REFERENCES startup_options (id) ON DELETE SET NULL,
  CONSTRAINT fk_sp_year    FOREIGN KEY (school_year_id)  REFERENCES startup_options (id) ON DELETE SET NULL,
  CONSTRAINT fk_sp_grade   FOREIGN KEY (target_grade_id) REFERENCES startup_options (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One row each time a student finishes the diagnostic. Only the totals are kept.
CREATE TABLE diagnostic_attempts (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NOT NULL,
  correct     SMALLINT UNSIGNED NOT NULL,
  not_learned SMALLINT UNSIGNED NOT NULL,
  total       SMALLINT UNSIGNED NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- "this student's attempts, newest first"
  KEY idx_da_user_created (user_id, created_at),
  CONSTRAINT fk_da_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
