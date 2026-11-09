-- Live groups: a tutor sets up a weekly group session, then places students in it after their diagnostic.
CREATE TABLE session_groups (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  name        VARCHAR(100)  NOT NULL,
  -- 0 = Monday ... 6 = Sunday
  day_of_week TINYINT UNSIGNED NOT NULL,
  start_time  TIME          NOT NULL,
  end_time    TIME          NOT NULL,
  -- The Zoom link the tutor types in (always an https address).
  zoom_link   VARCHAR(300)  NOT NULL,
  capacity    TINYINT UNSIGNED NOT NULL DEFAULT 8,
  created_by  INT UNSIGNED  NOT NULL,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_sg_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- The topics a group focuses on (topic names, the same names the diagnostic questions use).
CREATE TABLE session_group_topics (
  group_id INT UNSIGNED NOT NULL,
  topic    VARCHAR(100) NOT NULL,
  PRIMARY KEY (group_id, topic),
  CONSTRAINT fk_sgt_group FOREIGN KEY (group_id) REFERENCES session_groups (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Which group a student is in. One group per student (the student is the key). Deleting a group puts its students back on the "waiting" list.
CREATE TABLE student_groups (
  student_id  INT UNSIGNED NOT NULL,
  group_id    INT UNSIGNED NOT NULL,
  -- The tutor's note to the student, shown on the "Your group" screen.
  note        VARCHAR(1000) NOT NULL DEFAULT '',
  send_video  TINYINT(1)   NOT NULL DEFAULT 0,
  assigned_by INT UNSIGNED NOT NULL,
  assigned_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (student_id),
  KEY idx_stg_group (group_id),
  CONSTRAINT fk_stg_student FOREIGN KEY (student_id)  REFERENCES users (id)          ON DELETE CASCADE,
  CONSTRAINT fk_stg_group   FOREIGN KEY (group_id)    REFERENCES session_groups (id) ON DELETE CASCADE,
  CONSTRAINT fk_stg_tutor   FOREIGN KEY (assigned_by) REFERENCES users (id)          ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
