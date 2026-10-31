-- A user's study items. Each can optionally be linked to a topic.
CREATE TABLE items (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NOT NULL,
  topic_id    INT UNSIGNED NULL,
  title       VARCHAR(100) NOT NULL,
  description TEXT         NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- The main query is "this user's items, newest first". This composite index finds the
  -- user's rows AND returns them already sorted, so MySQL needs no extra sorting step.
  -- (It also covers the user_id foreign key.)
  KEY idx_items_user_created (user_id, created_at),
  -- Speeds up the topic join and the foreign key.
  KEY idx_items_topic (topic_id),
  CONSTRAINT fk_items_user  FOREIGN KEY (user_id)  REFERENCES users (id)  ON DELETE CASCADE,
  CONSTRAINT fk_items_topic FOREIGN KEY (topic_id) REFERENCES topics (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
