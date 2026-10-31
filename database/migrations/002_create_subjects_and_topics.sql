-- Reference data: GCSE subjects and the topics inside them.
-- It changes rarely, so the API and the browser cache it (see README).
CREATE TABLE subjects (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(60)  NOT NULL,
  slug       VARCHAR(60)  NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_subjects_name (name),
  UNIQUE KEY uq_subjects_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE topics (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  subject_id INT UNSIGNED NOT NULL,
  name       VARCHAR(100) NOT NULL,
  slug       VARCHAR(100) NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- Unique per subject. Because subject_id is its first column, this one index also
  -- speeds up "all topics of a subject" and the foreign key - no extra index needed.
  UNIQUE KEY uq_topics_subject_slug (subject_id, slug),
  CONSTRAINT fk_topics_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
