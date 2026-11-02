-- Group chats: an admin makes a group, adds students to it, and everyone in it talks in one shared chat.

CREATE TABLE chat_groups (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(80)  NOT NULL,
  description VARCHAR(300) NULL,
  created_by  INT UNSIGNED NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_cg_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- The students in a group. (Every admin can open every group, so admins are not listed here.)
CREATE TABLE chat_group_members (
  group_id INT UNSIGNED NOT NULL,
  user_id  INT UNSIGNED NOT NULL,
  added_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (group_id, user_id),
  -- "which groups is this student in?"
  KEY idx_cgm_user (user_id),
  CONSTRAINT fk_cgm_group FOREIGN KEY (group_id) REFERENCES chat_groups (id) ON DELETE CASCADE,
  CONSTRAINT fk_cgm_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE chat_group_messages (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  group_id      INT UNSIGNED  NOT NULL,
  sender_id     INT UNSIGNED  NOT NULL,
  body          VARCHAR(2000) NULL,
  attachment_id INT UNSIGNED  NULL,
  reply_to_id   INT UNSIGNED  NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at    TIMESTAMP     NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_cgmsg_group_id (group_id, id),
  CONSTRAINT fk_cgmsg_group FOREIGN KEY (group_id) REFERENCES chat_groups (id) ON DELETE CASCADE,
  CONSTRAINT fk_cgmsg_sender FOREIGN KEY (sender_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_cgmsg_reply FOREIGN KEY (reply_to_id) REFERENCES chat_group_messages (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- How far each person has read in each group (for the unread counts).
CREATE TABLE chat_group_reads (
  group_id INT UNSIGNED NOT NULL,
  user_id  INT UNSIGNED NOT NULL,
  read_id  INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (group_id, user_id),
  CONSTRAINT fk_cgr_group FOREIGN KEY (group_id) REFERENCES chat_groups (id) ON DELETE CASCADE,
  CONSTRAINT fk_cgr_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- "Delete for me": a group message one person removed from THEIR OWN view.
CREATE TABLE chat_group_hides (
  message_id INT UNSIGNED NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  PRIMARY KEY (message_id, user_id),
  CONSTRAINT fk_cgh_message FOREIGN KEY (message_id) REFERENCES chat_group_messages (id) ON DELETE CASCADE,
  CONSTRAINT fk_cgh_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Files shared in a group live in the same table as files shared in a one-to-one chat. Those have a student and a tutor/admin;
-- a group file has a group instead, so the two columns may now be empty.
ALTER TABLE chat_attachments
  MODIFY student_id INT UNSIGNED NULL,
  MODIFY staff_id   INT UNSIGNED NULL,
  ADD COLUMN group_id INT UNSIGNED NULL AFTER staff_id,
  ADD KEY idx_ca_group (group_id),
  ADD CONSTRAINT fk_ca_group FOREIGN KEY (group_id) REFERENCES chat_groups (id) ON DELETE CASCADE;
