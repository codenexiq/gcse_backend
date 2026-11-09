-- Learning routes: an ordered path of lessons and quizzes, each with a week number. A tutor builds a route once and assigns it to any students.
CREATE TABLE learning_routes (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(120) NOT NULL,
  description VARCHAR(300) NOT NULL DEFAULT '',
  created_by  INT UNSIGNED NOT NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_lroute_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE route_steps (
  id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  route_id  INT UNSIGNED NOT NULL,
  position  SMALLINT UNSIGNED NOT NULL,
  -- Which kind of thing the step points at, and its id (a lesson or a quiz).
  item_type ENUM('lesson', 'quiz') NOT NULL,
  item_id   INT UNSIGNED NOT NULL,
  -- Week 1 to 12 of the route. The task is due at the end of that week, counted from the day the route was assigned.
  week      TINYINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  KEY idx_rs_route (route_id, position),
  CONSTRAINT fk_rs_route FOREIGN KEY (route_id) REFERENCES learning_routes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE route_assignments (
  route_id    INT UNSIGNED NOT NULL,
  student_id  INT UNSIGNED NOT NULL,
  assigned_at DATE         NOT NULL,
  PRIMARY KEY (route_id, student_id),
  KEY idx_ra_student (student_id),
  CONSTRAINT fk_ra_route FOREIGN KEY (route_id) REFERENCES learning_routes (id) ON DELETE CASCADE,
  CONSTRAINT fk_ra_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
