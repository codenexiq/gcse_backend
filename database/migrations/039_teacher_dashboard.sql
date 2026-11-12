-- Teacher dashboard: session logs, each student's learning map, and the work students do (read by the tutor).

-- What the diagnostic found out about a student in one subject.
ALTER TABLE enrolments
  ADD COLUMN diagnostic_done  TINYINT(1)   NOT NULL DEFAULT 0 AFTER target_grade,
  ADD COLUMN diagnostic_score TINYINT UNSIGNED NULL AFTER diagnostic_done,
  ADD COLUMN misconceptions   JSON         NULL AFTER diagnostic_score;

-- One log per booked session: what was covered and the homework set.
CREATE TABLE lesson_logs (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  booking_id INT UNSIGNED NOT NULL,
  tutor_id   INT UNSIGNED NOT NULL,
  topic_id   INT UNSIGNED NULL,
  topic_name VARCHAR(160) NOT NULL DEFAULT '',
  note       TEXT         NOT NULL,
  homework   VARCHAR(255) NOT NULL DEFAULT '',
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_log_booking (booking_id),
  CONSTRAINT fk_ll_booking FOREIGN KEY (booking_id) REFERENCES session_bookings (id) ON DELETE CASCADE,
  CONSTRAINT fk_ll_tutor   FOREIGN KEY (tutor_id)   REFERENCES users (id)            ON DELETE CASCADE,
  CONSTRAINT fk_ll_topic   FOREIGN KEY (topic_id)   REFERENCES topics (id)           ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Who was in the session.
CREATE TABLE lesson_log_attendance (
  log_id       INT UNSIGNED NOT NULL,
  enrolment_id INT UNSIGNED NOT NULL,
  present      TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (log_id, enrolment_id),
  CONSTRAINT fk_lla_log   FOREIGN KEY (log_id)       REFERENCES lesson_logs (id) ON DELETE CASCADE,
  CONSTRAINT fk_lla_enrol FOREIGN KEY (enrolment_id) REFERENCES enrolments (id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- The learning map: N not started, P in progress, W needs work, M mastered. No row means not started.
CREATE TABLE enrolment_topic_status (
  enrolment_id INT UNSIGNED NOT NULL,
  topic_id     INT UNSIGNED NOT NULL,
  status       ENUM('N','P','W','M') NOT NULL DEFAULT 'N',
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (enrolment_id, topic_id),
  CONSTRAINT fk_ets_enrol FOREIGN KEY (enrolment_id) REFERENCES enrolments (id) ON DELETE CASCADE,
  CONSTRAINT fk_ets_topic FOREIGN KEY (topic_id)     REFERENCES topics (id)     ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Minutes a student studied on a day.
CREATE TABLE study_minutes (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  enrolment_id INT UNSIGNED NOT NULL,
  study_date   DATE         NOT NULL,
  minutes      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_sm_enrol (enrolment_id, study_date),
  CONSTRAINT fk_sm_enrol FOREIGN KEY (enrolment_id) REFERENCES enrolments (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Quiz and practice scores.
CREATE TABLE learning_results (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  enrolment_id INT UNSIGNED NOT NULL,
  title        VARCHAR(160) NOT NULL,
  pct          TINYINT UNSIGNED NOT NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_lr_enrol (enrolment_id, created_at),
  CONSTRAINT fk_lr_enrol FOREIGN KEY (enrolment_id) REFERENCES enrolments (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
