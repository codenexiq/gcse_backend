-- The role called 'teacher' is now called 'tutor'. Any existing teacher accounts become tutors.
-- (MySQL needs three steps: allow both names, convert the rows, then drop the old name.)
ALTER TABLE users
  MODIFY COLUMN role ENUM('student', 'teacher', 'tutor', 'admin') NOT NULL DEFAULT 'student';

UPDATE users SET role = 'tutor' WHERE role = 'teacher';

ALTER TABLE users
  MODIFY COLUMN role ENUM('student', 'tutor', 'admin') NOT NULL DEFAULT 'student';
