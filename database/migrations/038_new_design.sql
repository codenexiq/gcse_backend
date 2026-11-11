-- The new dashboards (admin, tutor, student). Replaces the old learning tables.
-- Kept: users, user_images*, chat_*, site_*. Everything else of the old design is dropped.

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS
  items, diagnostic_attempts, diagnostic_batches, diagnostic_options, diagnostic_questions,
  learning_routes, learning_strands, learning_topics, lessons, lesson_logs, lesson_results,
  monthly_reports, practice_minutes, practice_sets, quizzes, quiz_attempts, quiz_diagrams,
  route_assignments, route_steps, session_bookings, session_groups, session_group_topics,
  startup_content, startup_options, student_groups, student_profiles, student_topic_status,
  topics, subjects;
SET FOREIGN_KEY_CHECKS = 1;

-- Levels: Key Stage 3, GCSE, A-level ... (the id is a short text such as "gcse")
CREATE TABLE levels (
  id         VARCHAR(40)  NOT NULL,
  name       VARCHAR(80)  NOT NULL,
  short_name VARCHAR(30)  NOT NULL,
  years      TEXT         NOT NULL,
  tiers      TEXT         NOT NULL,
  boards     TEXT         NOT NULL,
  grades     TEXT         NOT NULL,
  position   INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE subjects (
  id       VARCHAR(40) NOT NULL,
  name     VARCHAR(80) NOT NULL,
  icon     VARCHAR(30) NOT NULL DEFAULT 'book',
  color    VARCHAR(9)  NOT NULL DEFAULT '#2B6CB0',
  position INT         NOT NULL DEFAULT 0,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE subject_levels (
  subject_id VARCHAR(40) NOT NULL,
  level_id   VARCHAR(40) NOT NULL,
  PRIMARY KEY (subject_id, level_id),
  CONSTRAINT fk_sl_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE,
  CONSTRAINT fk_sl_level   FOREIGN KEY (level_id)   REFERENCES levels (id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Strands and topics of one pathway (subject + level), e.g. GCSE Maths > Algebra > Quadratics
CREATE TABLE strands (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  subject_id VARCHAR(40)  NOT NULL,
  level_id   VARCHAR(40)  NOT NULL,
  name       VARCHAR(100) NOT NULL,
  position   INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_strands_path (subject_id, level_id, position),
  CONSTRAINT fk_strand_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE,
  CONSTRAINT fk_strand_level   FOREIGN KEY (level_id)   REFERENCES levels (id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE topics (
  id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  strand_id INT UNSIGNED NOT NULL,
  name      VARCHAR(120) NOT NULL,
  position  INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_topics_strand (strand_id, position),
  CONSTRAINT fk_topic_strand FOREIGN KEY (strand_id) REFERENCES strands (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE plans (
  id           VARCHAR(40)  NOT NULL,
  name         VARCHAR(80)  NOT NULL,
  tagline      VARCHAR(200) NOT NULL DEFAULT '',
  live_classes TINYINT UNSIGNED NOT NULL DEFAULT 0,
  mocks        TINYINT(1)   NOT NULL DEFAULT 0,
  popular      TINYINT(1)   NOT NULL DEFAULT 0,
  features     TEXT         NOT NULL,
  position     INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE plan_prices (
  plan_id  VARCHAR(40) NOT NULL,
  level_id VARCHAR(40) NOT NULL,
  price    VARCHAR(40) NOT NULL,
  PRIMARY KEY (plan_id, level_id),
  CONSTRAINT fk_pp_plan  FOREIGN KEY (plan_id)  REFERENCES plans (id)  ON DELETE CASCADE,
  CONSTRAINT fk_pp_level FOREIGN KEY (level_id) REFERENCES levels (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE app_settings (
  setting_key   VARCHAR(60) NOT NULL,
  setting_value TEXT        NOT NULL,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Which subjects each tutor teaches
CREATE TABLE tutor_subjects (
  user_id    INT UNSIGNED NOT NULL,
  subject_id VARCHAR(40)  NOT NULL,
  PRIMARY KEY (user_id, subject_id),
  CONSTRAINT fk_ts_user    FOREIGN KEY (user_id)    REFERENCES users (id)    ON DELETE CASCADE,
  CONSTRAINT fk_ts_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One row per student: level, school year, plan and parent contact
CREATE TABLE student_profiles (
  user_id      INT UNSIGNED NOT NULL,
  level_id     VARCHAR(40)  NOT NULL,
  school_year  VARCHAR(30)  NOT NULL DEFAULT '',
  plan_id      VARCHAR(40)  NOT NULL,
  parent_name  VARCHAR(100) NOT NULL DEFAULT '',
  parent_email VARCHAR(254) NOT NULL DEFAULT '',
  parent_phone VARCHAR(30)  NOT NULL DEFAULT '',
  PRIMARY KEY (user_id),
  CONSTRAINT fk_sp_user  FOREIGN KEY (user_id)  REFERENCES users (id)  ON DELETE CASCADE,
  CONSTRAINT fk_sp_level FOREIGN KEY (level_id) REFERENCES levels (id),
  CONSTRAINT fk_sp_plan  FOREIGN KEY (plan_id)  REFERENCES plans (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Weekly live groups
CREATE TABLE session_groups (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(100) NOT NULL,
  subject_id  VARCHAR(40)  NOT NULL,
  level_id    VARCHAR(40)  NOT NULL,
  tutor_id    INT UNSIGNED NULL,
  day_of_week TINYINT UNSIGNED NOT NULL DEFAULT 0,
  start_time  TIME         NOT NULL DEFAULT '17:00:00',
  zoom_link   VARCHAR(300) NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  CONSTRAINT fk_sg_subject FOREIGN KEY (subject_id) REFERENCES subjects (id),
  CONSTRAINT fk_sg_level   FOREIGN KEY (level_id)   REFERENCES levels (id),
  CONSTRAINT fk_sg_tutor   FOREIGN KEY (tutor_id)   REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- A student studying one subject at one level (a "pathway")
CREATE TABLE enrolments (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id    INT UNSIGNED NOT NULL,
  subject_id    VARCHAR(40)  NOT NULL,
  level_id      VARCHAR(40)  NOT NULL,
  tier          VARCHAR(30)  NOT NULL DEFAULT '',
  board         VARCHAR(40)  NOT NULL DEFAULT '',
  current_grade VARCHAR(30)  NOT NULL DEFAULT '',
  target_grade  VARCHAR(30)  NOT NULL DEFAULT '',
  tutor_id      INT UNSIGNED NULL,
  group_id      INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_enrol (student_id, subject_id, level_id),
  KEY idx_enrol_tutor (tutor_id),
  KEY idx_enrol_group (group_id),
  CONSTRAINT fk_en_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_en_subject FOREIGN KEY (subject_id) REFERENCES subjects (id),
  CONSTRAINT fk_en_level   FOREIGN KEY (level_id)   REFERENCES levels (id),
  CONSTRAINT fk_en_tutor   FOREIGN KEY (tutor_id)   REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_en_group   FOREIGN KEY (group_id)   REFERENCES session_groups (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Booked sessions: a group class or a one-to-one
CREATE TABLE session_bookings (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  kind         ENUM('group','one') NOT NULL DEFAULT 'one',
  group_id     INT UNSIGNED NULL,
  enrolment_id INT UNSIGNED NULL,
  tutor_id     INT UNSIGNED NOT NULL,
  session_date DATE         NOT NULL,
  start_time   TIME         NOT NULL,
  minutes      SMALLINT UNSIGNED NOT NULL DEFAULT 60,
  zoom_link    VARCHAR(300) NOT NULL DEFAULT '',
  logged       TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_booking_group (group_id, session_date, start_time),
  KEY idx_booking_tutor (tutor_id, session_date),
  CONSTRAINT fk_bk_group FOREIGN KEY (group_id)     REFERENCES session_groups (id) ON DELETE CASCADE,
  CONSTRAINT fk_bk_enrol FOREIGN KEY (enrolment_id) REFERENCES enrolments (id)     ON DELETE CASCADE,
  CONSTRAINT fk_bk_tutor FOREIGN KEY (tutor_id)     REFERENCES users (id)          ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Monthly progress reports a tutor writes; the admin sends them on to the parent
CREATE TABLE monthly_reports (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  enrolment_id INT UNSIGNED NOT NULL,
  tutor_id     INT UNSIGNED NOT NULL,
  report_month VARCHAR(30)  NOT NULL,
  body         TEXT         NOT NULL,
  status       ENUM('draft','ready','sent') NOT NULL DEFAULT 'draft',
  sent_at      TIMESTAMP    NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_mr_status (status),
  CONSTRAINT fk_mr_enrol FOREIGN KEY (enrolment_id) REFERENCES enrolments (id) ON DELETE CASCADE,
  CONSTRAINT fk_mr_tutor FOREIGN KEY (tutor_id)     REFERENCES users (id)      ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Accounts an admin adds start without an email or a password (they are filled in later).
ALTER TABLE users
  MODIFY email         VARCHAR(254) NULL,
  MODIFY password_hash VARCHAR(100) NULL;
