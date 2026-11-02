-- Replying to a specific message: the new message remembers which message it answers.
-- (If that message disappears, the reply simply loses its quote.)
ALTER TABLE chat_messages
  ADD COLUMN reply_to_id INT UNSIGNED NULL AFTER attachment_id,
  ADD CONSTRAINT fk_cm_reply FOREIGN KEY (reply_to_id) REFERENCES chat_messages (id) ON DELETE SET NULL;
