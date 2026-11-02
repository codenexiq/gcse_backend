-- Profiles: a few facts about the person, and the moment their password last changed.
ALTER TABLE users
  ADD COLUMN headline VARCHAR(100)  NULL AFTER full_name,
  ADD COLUMN location VARCHAR(100)  NULL AFTER headline,
  ADD COLUMN bio      VARCHAR(1000) NULL AFTER location,
  -- Sessions started before this moment stop working (so changing the password signs out every other device).
  ADD COLUMN password_changed_at TIMESTAMP NULL DEFAULT NULL;

-- Profile picture and cover photo: one of each per person. The picture itself is kept in small pieces (see the next table).
CREATE TABLE user_images (
  user_id    INT UNSIGNED NOT NULL,
  kind       ENUM('avatar', 'cover') NOT NULL,
  mime       VARCHAR(50)  NOT NULL,
  size       INT UNSIGNED NOT NULL,
  updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, kind),
  CONSTRAINT fk_ui_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE user_image_chunks (
  user_id INT UNSIGNED NOT NULL,
  kind    ENUM('avatar', 'cover') NOT NULL,
  seq     INT UNSIGNED NOT NULL,
  data    MEDIUMBLOB   NOT NULL,
  PRIMARY KEY (user_id, kind, seq),
  CONSTRAINT fk_uic_image FOREIGN KEY (user_id, kind) REFERENCES user_images (user_id, kind) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
