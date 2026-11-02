-- More about a student, for the profile an admin or tutor manages.
ALTER TABLE users
  -- A short @name, unique. Optional (existing students have none until someone gives them one).
  ADD COLUMN username VARCHAR(30) NULL AFTER student_code,
  ADD UNIQUE KEY uq_users_username (username),
  ADD COLUMN phone  VARCHAR(30) NULL AFTER email,
  ADD COLUMN gender VARCHAR(20) NULL AFTER phone;
