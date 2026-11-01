-- Deleting in the chat.

-- A message its sender deleted: the text and file are gone, a "deleted" note stays.
ALTER TABLE chat_messages ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL AFTER created_at;

-- When a whole chat is deleted, this is the newest message id that was removed (so open screens can drop what they still show).
ALTER TABLE chat_conversations ADD COLUMN wiped_id INT UNSIGNED NOT NULL DEFAULT 0;

-- "Clear chat": one person's own empty point in a chat. Messages up to cleared_id are hidden from THEM only.
CREATE TABLE chat_clears (
  student_id INT UNSIGNED NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  cleared_id INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (student_id, user_id),
  CONSTRAINT fk_ccl_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_ccl_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
