-- Lessons: a tutor builds a lesson for a topic from ordered blocks (slide, video, multiple choice, written question).
CREATE TABLE lessons (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  -- The topic name, as on the learning map.
  topic      VARCHAR(100) NOT NULL,
  title      VARCHAR(150) NOT NULL,
  -- The blocks in order, as JSON text.
  blocks     LONGTEXT     NOT NULL,
  -- Students only see a lesson once this is ticked.
  published  TINYINT(1)   NOT NULL DEFAULT 0,
  created_by INT UNSIGNED NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_lessons_topic (topic, published),
  CONSTRAINT fk_lessons_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One row each time a student finishes a lesson: the score, and each question's marks (as JSON text).
CREATE TABLE lesson_results (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id INT UNSIGNED NOT NULL,
  lesson_id  INT UNSIGNED NULL,
  topic      VARCHAR(100) NOT NULL,
  title      VARCHAR(150) NOT NULL,
  got        SMALLINT UNSIGNED NOT NULL,
  max_marks  SMALLINT UNSIGNED NOT NULL,
  percent    TINYINT UNSIGNED NOT NULL,
  detail     LONGTEXT     NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_lr_student (student_id, created_at),
  KEY idx_lr_topic (student_id, topic),
  CONSTRAINT fk_lr_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_lr_lesson FOREIGN KEY (lesson_id) REFERENCES lessons (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
