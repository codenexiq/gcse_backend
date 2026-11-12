-- Teacher "Content" tab: the library of lessons, notes, quizzes and videos, and the learning routes built from them.

-- One item in the library, for one subject at one level (and one topic on its learning map).
CREATE TABLE content_items (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  kind       ENUM('lesson','notes','quiz','video') NOT NULL DEFAULT 'lesson',
  title      VARCHAR(160) NOT NULL,
  subject_id VARCHAR(40)  NOT NULL,
  level_id   VARCHAR(40)  NOT NULL,
  topic_id   INT UNSIGNED NULL,
  source     VARCHAR(255) NOT NULL DEFAULT '',
  published  TINYINT(1)   NOT NULL DEFAULT 0,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ci_path (subject_id, level_id),
  CONSTRAINT fk_ci_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE,
  CONSTRAINT fk_ci_level   FOREIGN KEY (level_id)   REFERENCES levels (id)   ON DELETE CASCADE,
  CONSTRAINT fk_ci_topic   FOREIGN KEY (topic_id)   REFERENCES topics (id)   ON DELETE SET NULL,
  CONSTRAINT fk_ci_user    FOREIGN KEY (created_by) REFERENCES users (id)    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- The parts of an item, in order: a slide, a video, a multiple-choice question or a written question.
-- `data` holds the fields of that type (slide: title, body; mcq: question, options, correct, explain; ...).
CREATE TABLE content_blocks (
  id       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_id  INT UNSIGNED NOT NULL,
  position SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  type     ENUM('slide','video','mcq','written') NOT NULL,
  data     JSON NOT NULL,
  PRIMARY KEY (id),
  KEY idx_cb_item (item_id, position),
  CONSTRAINT fk_cb_item FOREIGN KEY (item_id) REFERENCES content_items (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- A learning route: the order students work through items, with a week for each step.
CREATE TABLE learning_routes (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(160) NOT NULL,
  subject_id  VARCHAR(40)  NOT NULL,
  level_id    VARCHAR(40)  NOT NULL,
  created_by  INT UNSIGNED NULL,
  assigned_at TIMESTAMP    NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_lrt_path (subject_id, level_id),
  CONSTRAINT fk_lrt_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE,
  CONSTRAINT fk_lrt_level   FOREIGN KEY (level_id)   REFERENCES levels (id)   ON DELETE CASCADE,
  CONSTRAINT fk_lrt_user    FOREIGN KEY (created_by) REFERENCES users (id)    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE route_steps (
  id       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  route_id INT UNSIGNED NOT NULL,
  position SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  item_id  INT UNSIGNED NOT NULL,
  week     TINYINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  KEY idx_rs_route (route_id, position),
  CONSTRAINT fk_rs_route FOREIGN KEY (route_id) REFERENCES learning_routes (id) ON DELETE CASCADE,
  CONSTRAINT fk_rs_item  FOREIGN KEY (item_id)  REFERENCES content_items (id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Who sees a route: a whole group, or one student's subject.
CREATE TABLE route_audience (
  route_id     INT UNSIGNED NOT NULL,
  group_id     INT UNSIGNED NULL,
  enrolment_id INT UNSIGNED NULL,
  UNIQUE KEY uq_ra_group (route_id, group_id),
  UNIQUE KEY uq_ra_enrol (route_id, enrolment_id),
  CONSTRAINT fk_ra_route FOREIGN KEY (route_id)     REFERENCES learning_routes (id) ON DELETE CASCADE,
  CONSTRAINT fk_ra_group FOREIGN KEY (group_id)     REFERENCES session_groups (id)  ON DELETE CASCADE,
  CONSTRAINT fk_ra_enrol FOREIGN KEY (enrolment_id) REFERENCES enrolments (id)      ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
