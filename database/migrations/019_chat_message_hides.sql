-- "Delete for me": a message one person removed from THEIR OWN view. The other person still sees it.
CREATE TABLE chat_message_hides (
  message_id INT UNSIGNED NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  PRIMARY KEY (message_id, user_id),
  CONSTRAINT fk_cmh_message FOREIGN KEY (message_id) REFERENCES chat_messages (id) ON DELETE CASCADE,
  CONSTRAINT fk_cmh_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
