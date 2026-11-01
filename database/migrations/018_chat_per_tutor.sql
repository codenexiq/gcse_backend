-- Every tutor or admin now has their OWN chat with each student (before, all of them shared one chat per student).
-- A chat is identified by the pair (student_id, staff_id). Existing messages are moved into the right pair.

-- 1. Messages: say which tutor/admin the chat is with.
ALTER TABLE chat_messages ADD COLUMN staff_id INT UNSIGNED NULL AFTER student_id;

-- Messages written by a tutor or admin belong to that person's chat.
UPDATE chat_messages SET staff_id = sender_id WHERE sender_id <> student_id;

-- Messages written by a student go to the first tutor/admin who answered that student...
CREATE TEMPORARY TABLE tmp_first_staff AS
  SELECT student_id, MIN(id) AS first_id FROM chat_messages WHERE sender_id <> student_id GROUP BY student_id;
CREATE TEMPORARY TABLE tmp_first_staff_who AS
  SELECT f.student_id, m.sender_id AS staff_id FROM tmp_first_staff f JOIN chat_messages m ON m.id = f.first_id;
UPDATE chat_messages m JOIN tmp_first_staff_who t ON t.student_id = m.student_id SET m.staff_id = t.staff_id WHERE m.sender_id = m.student_id;
DROP TEMPORARY TABLE tmp_first_staff;
DROP TEMPORARY TABLE tmp_first_staff_who;
-- ...or, if nobody answered, to the first tutor/admin account.
UPDATE chat_messages SET staff_id = (SELECT MIN(id) FROM users WHERE role IN ('tutor', 'admin')) WHERE staff_id IS NULL;
DELETE FROM chat_messages WHERE staff_id IS NULL;

ALTER TABLE chat_messages
  MODIFY staff_id INT UNSIGNED NOT NULL,
  ADD KEY idx_cm_pair_id (student_id, staff_id, id),
  ADD CONSTRAINT fk_cm_staff FOREIGN KEY (staff_id) REFERENCES users (id) ON DELETE CASCADE;

-- 2. Shared files belong to a chat too (files uploaded but never sent are dropped).
ALTER TABLE chat_attachments ADD COLUMN staff_id INT UNSIGNED NULL AFTER student_id;
UPDATE chat_attachments a JOIN chat_messages m ON m.id = a.message_id SET a.staff_id = m.staff_id;
DELETE FROM chat_attachments WHERE staff_id IS NULL;
ALTER TABLE chat_attachments
  MODIFY staff_id INT UNSIGNED NOT NULL,
  ADD CONSTRAINT fk_ca_staff FOREIGN KEY (staff_id) REFERENCES users (id) ON DELETE CASCADE;

-- 3. Read / delivered pointers: one row per chat (everything so far counts as read, so nothing turns "unread" by surprise).
CREATE TABLE chat_threads (
  student_id           INT UNSIGNED NOT NULL,
  staff_id             INT UNSIGNED NOT NULL,
  tutor_read_id        INT UNSIGNED NOT NULL DEFAULT 0,
  tutor_delivered_id   INT UNSIGNED NOT NULL DEFAULT 0,
  student_read_id      INT UNSIGNED NOT NULL DEFAULT 0,
  student_delivered_id INT UNSIGNED NOT NULL DEFAULT 0,
  wiped_id             INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (student_id, staff_id),
  CONSTRAINT fk_ct_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_ct_staff FOREIGN KEY (staff_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO chat_threads (student_id, staff_id, tutor_read_id, tutor_delivered_id, student_read_id, student_delivered_id)
  SELECT student_id, staff_id, MAX(id), MAX(id), MAX(id), MAX(id) FROM chat_messages GROUP BY student_id, staff_id;

DROP TABLE chat_conversations;

-- 4. "Clear chat" points are per chat now (an earlier clear is forgotten).
DROP TABLE chat_clears;
CREATE TABLE chat_clears (
  student_id INT UNSIGNED NOT NULL,
  staff_id   INT UNSIGNED NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  cleared_id INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (student_id, staff_id, user_id),
  CONSTRAINT fk_ccl_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_ccl_staff FOREIGN KEY (staff_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_ccl_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
