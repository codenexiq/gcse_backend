-- A unique ID for every student, and an Active / Inactive status.

-- The student ID looks like STU-00042. It is made from the account's own number, so it can never repeat.
-- (Tutors and admins have none.)
ALTER TABLE users
  ADD COLUMN student_code VARCHAR(20) NULL AFTER id,
  ADD UNIQUE KEY uq_users_student_code (student_code),
  -- An inactive account cannot sign in (and is signed out at once).
  ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1;

-- Give the students who already exist their IDs.
UPDATE users SET student_code = CONCAT('STU-', LPAD(id, 5, '0')) WHERE role = 'student' AND student_code IS NULL;
