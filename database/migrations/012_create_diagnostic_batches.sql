-- One row each time a tutor clicks "Generate questions": a "set" of generated questions, shown as one card.
CREATE TABLE diagnostic_batches (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  level      ENUM('GCSE', 'IGCSE / O-level', 'A-level') NOT NULL,
  subject_id INT UNSIGNED NOT NULL,
  tier       ENUM('Foundation', 'Higher', 'Any') NOT NULL DEFAULT 'Any',
  topic      VARCHAR(60) NULL,
  created_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- "newest sets first"
  KEY idx_db_created (created_at),
  CONSTRAINT fk_db_subject FOREIGN KEY (subject_id) REFERENCES startup_options (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Which set a question belongs to. Questions written by hand (and earlier ones) have no set (NULL).
ALTER TABLE diagnostic_questions
  ADD COLUMN batch_id INT UNSIGNED NULL AFTER subject_id,
  ADD KEY idx_dq_batch (batch_id),
  ADD CONSTRAINT fk_dq_batch FOREIGN KEY (batch_id) REFERENCES diagnostic_batches (id) ON DELETE SET NULL;
