-- The tutor's calendar: sessions booked with one student or with a group. "Repeat every week" books a series that shares a series_id.
CREATE TABLE session_bookings (
  id           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  tutor_id     INT UNSIGNED  NOT NULL,
  -- Exactly one of these two is set: a 1-to-1 session is with a student, a group session is with a group.
  student_id   INT UNSIGNED  NULL,
  group_id     INT UNSIGNED  NULL,
  session_date DATE          NOT NULL,
  start_time   TIME          NOT NULL,
  minutes      SMALLINT UNSIGNED NOT NULL DEFAULT 60,
  zoom_link    VARCHAR(300)  NOT NULL,
  series_id    CHAR(16)      NULL,
  created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sb_tutor_date (tutor_id, session_date),
  KEY idx_sb_series (series_id),
  CONSTRAINT fk_sb_tutor   FOREIGN KEY (tutor_id)   REFERENCES users (id)          ON DELETE CASCADE,
  CONSTRAINT fk_sb_student FOREIGN KEY (student_id) REFERENCES users (id)          ON DELETE CASCADE,
  CONSTRAINT fk_sb_group   FOREIGN KEY (group_id)   REFERENCES session_groups (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- A lesson log can now belong to a booked session. The extra columns hold what the calendar's log form asks for.
-- Cancelling a booking keeps its log (booking_id becomes empty).
ALTER TABLE lesson_logs
  ADD COLUMN booking_id  INT UNSIGNED NULL AFTER id,
  ADD COLUMN topics      VARCHAR(300) NULL,
  ADD COLUMN engagement  TINYINT UNSIGNED NULL,
  ADD COLUMN focus_score TINYINT UNSIGNED NULL,
  -- For a group session: the ids of the students who came, as JSON text.
  ADD COLUMN attendees   VARCHAR(1000) NULL,
  ADD UNIQUE KEY uq_ll_booking (booking_id),
  ADD CONSTRAINT fk_ll_booking FOREIGN KEY (booking_id) REFERENCES session_bookings (id) ON DELETE SET NULL;
