-- Diagnostic questions that tutors write themselves, and their answer choices.
-- Maths is written between dollar signs (for example 3/4 as a fraction) and drawn on screen.
CREATE TABLE diagnostic_questions (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  level      ENUM('GCSE', 'IGCSE / O-level', 'A-level') NOT NULL,
  -- A subject is a choice in startup_options; it cannot be deleted while questions use it.
  subject_id INT UNSIGNED NOT NULL,
  tier       ENUM('Foundation', 'Higher', 'Any') NOT NULL DEFAULT 'Any',
  topic      VARCHAR(60)  NOT NULL,
  question   VARCHAR(500) NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- "the questions of this level and subject, oldest first" is the diagnostic's main lookup.
  KEY idx_dq_level_subject (level, subject_id, id),
  CONSTRAINT fk_dq_subject FOREIGN KEY (subject_id) REFERENCES startup_options (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE diagnostic_options (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  question_id INT UNSIGNED NOT NULL,
  position    TINYINT UNSIGNED NOT NULL,
  text        VARCHAR(200) NOT NULL,
  is_correct  TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_do_question_position (question_id, position),
  CONSTRAINT fk_do_question FOREIGN KEY (question_id) REFERENCES diagnostic_questions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
