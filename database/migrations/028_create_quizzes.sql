-- Quizzes: a tutor (or admin) uploads a JSON file of multiple-choice questions; students take it and their scores are saved.
CREATE TABLE quizzes (
  id             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  title          VARCHAR(150)  NOT NULL,
  subtitle       VARCHAR(150)  NULL,
  instructions   VARCHAR(1000) NULL,
  question_count SMALLINT UNSIGNED NOT NULL,
  total_marks    SMALLINT UNSIGNED NOT NULL,
  -- The questions (with the right answers and explanations) and the feedback messages, as JSON text.
  -- Students are never sent the answers before they hand in an attempt.
  content        LONGTEXT      NOT NULL,
  -- Only published quizzes are visible to students.
  published      TINYINT(1)    NOT NULL DEFAULT 1,
  created_by     INT UNSIGNED  NOT NULL,
  created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_quizzes_published (published, created_at),
  CONSTRAINT fk_quizzes_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One row each time a student hands in a quiz.
CREATE TABLE quiz_attempts (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  quiz_id         INT UNSIGNED NOT NULL,
  student_id      INT UNSIGNED NOT NULL,
  -- Questions answered correctly, and marks earned.
  score           SMALLINT UNSIGNED NOT NULL,
  marks           SMALLINT UNSIGNED NOT NULL,
  question_count  SMALLINT UNSIGNED NOT NULL,
  total_marks     SMALLINT UNSIGNED NOT NULL,
  -- What the student chose, as JSON text: {"1": "B", "2": "C", ...}
  answers         LONGTEXT     NOT NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_qa_quiz (quiz_id, created_at),
  KEY idx_qa_student (student_id, quiz_id),
  CONSTRAINT fk_qa_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes (id) ON DELETE CASCADE,
  CONSTRAINT fk_qa_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
