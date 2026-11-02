-- The lesson log: after each lesson a tutor (or admin) fills in an attendance and feedback form.
CREATE TABLE lesson_logs (
  id                INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  tutor_id          INT UNSIGNED  NOT NULL,
  -- The name shown on the form (starts as the account's name, and may be changed).
  tutor_name        VARCHAR(100)  NOT NULL,
  lesson_date       DATE          NOT NULL,
  -- "Student name / class name / admin block": free text.
  student_or_class  VARCHAR(150)  NOT NULL,
  lesson_type       ENUM('1:1', 'Group', 'Admin') NOT NULL,
  attendance        ENUM('Present', 'Late', 'Absent / No show') NOT NULL,
  duration_minutes  SMALLINT UNSIGNED NOT NULL,
  completed         ENUM('Yes', 'No', 'Maybe') NOT NULL,
  homework_assigned TINYINT(1)    NOT NULL DEFAULT 0,
  homework_other    VARCHAR(300)  NULL,
  engagement_notes  VARCHAR(2000) NULL,
  next_focus        VARCHAR(2000) NOT NULL,
  -- "Lesson was recorded to Zoom Cloud for the full duration"
  zoom_recorded     TINYINT(1)    NOT NULL DEFAULT 0,
  created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- "this tutor's entries, newest first" and "everyone's entries, newest first"
  KEY idx_ll_tutor_date (tutor_id, lesson_date),
  KEY idx_ll_date (lesson_date),
  CONSTRAINT fk_ll_tutor FOREIGN KEY (tutor_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
