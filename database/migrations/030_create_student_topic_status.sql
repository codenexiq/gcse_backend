-- What a student can do on each topic. The diagnostic fills it in; lessons and practice (a later step) change it.
-- Keyed by the topic NAME (the diagnostic questions carry a topic name), so it works with whatever topic list the site uses.
CREATE TABLE student_topic_status (
  student_id INT UNSIGNED NOT NULL,
  topic      VARCHAR(100) NOT NULL,
  -- mastered: got it right | needs_work: got it wrong | in_progress: started, not mastered yet | not_started: has not learned it yet
  status     ENUM('mastered', 'in_progress', 'needs_work', 'not_started') NOT NULL,
  updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (student_id, topic),
  CONSTRAINT fk_sts_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
