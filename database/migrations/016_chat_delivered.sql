-- "Delivered" ticks: how far each side's screen has received the messages (read is already tracked by *_read_id).
ALTER TABLE chat_conversations
  ADD COLUMN tutor_delivered_id   INT UNSIGNED NOT NULL DEFAULT 0 AFTER tutor_read_id,
  ADD COLUMN student_delivered_id INT UNSIGNED NOT NULL DEFAULT 0 AFTER student_read_id;
