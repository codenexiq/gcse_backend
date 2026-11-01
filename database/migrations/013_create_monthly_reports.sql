-- A monthly progress report a tutor has sent to a student. The student can only read it.
-- One report per student, subject and month: sending again replaces the earlier one.
CREATE TABLE monthly_reports (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id INT UNSIGNED NOT NULL,
  author_id  INT UNSIGNED NULL,
  subject    VARCHAR(100) NOT NULL,
  month      VARCHAR(30)  NOT NULL,
  -- The whole report as JSON text.
  data       LONGTEXT     NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_mr_student_subject_month (student_id, subject, month),
  KEY idx_mr_student_updated (student_id, updated_at),
  CONSTRAINT fk_mr_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_mr_author FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
