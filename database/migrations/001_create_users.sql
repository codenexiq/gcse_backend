-- Accounts. Passwords are stored as bcrypt hashes, never as plain text.
CREATE TABLE users (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  email         VARCHAR(254)  NOT NULL,
  password_hash VARCHAR(100)  NOT NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- Login looks users up by email: the unique index makes that instant and stops duplicates.
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
