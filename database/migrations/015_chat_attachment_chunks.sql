-- Files are stored in small pieces, so they fit under any MySQL "max_allowed_packet" limit.
CREATE TABLE chat_attachment_chunks (
  attachment_id INT UNSIGNED NOT NULL,
  seq           INT UNSIGNED NOT NULL,
  data          MEDIUMBLOB   NOT NULL,
  PRIMARY KEY (attachment_id, seq),
  CONSTRAINT fk_cac_attachment FOREIGN KEY (attachment_id) REFERENCES chat_attachments (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- The whole-file column from the first version is no longer used.
ALTER TABLE chat_attachments DROP COLUMN data;
