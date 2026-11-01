-- Chat between a student and the tutors. Each student has ONE conversation, which every tutor and admin can read and answer.

-- Who has read how far in each conversation (used for the "unread" counts).
CREATE TABLE chat_conversations (
  student_id      INT UNSIGNED NOT NULL,
  tutor_read_id   INT UNSIGNED NOT NULL DEFAULT 0,
  student_read_id INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (student_id),
  CONSTRAINT fk_cc_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- The messages. A message has text, a file, or both.
CREATE TABLE chat_messages (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  student_id    INT UNSIGNED  NOT NULL,
  sender_id     INT UNSIGNED  NOT NULL,
  body          VARCHAR(2000) NULL,
  attachment_id INT UNSIGNED  NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- "the newest messages of one conversation" and "messages after id N"
  KEY idx_cm_student_id (student_id, id),
  CONSTRAINT fk_cm_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_cm_sender FOREIGN KEY (sender_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Shared files. The file itself is kept in the database (5 MB at most), so it survives every deployment.
CREATE TABLE chat_attachments (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id  INT UNSIGNED NOT NULL,
  uploaded_by INT UNSIGNED NOT NULL,
  message_id  INT UNSIGNED NULL,
  file_name   VARCHAR(150) NOT NULL,
  size        INT UNSIGNED NOT NULL,
  data        LONGBLOB     NOT NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ca_student (student_id),
  CONSTRAINT fk_ca_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_ca_uploader FOREIGN KEY (uploaded_by) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
