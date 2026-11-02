-- Every account gets a unique User ID, not just students: STU-00042 (student), TUT-00002 (tutor), ADM-00001 (admin).
-- The column that held the student IDs becomes the User ID column.
ALTER TABLE users DROP INDEX uq_users_student_code;
ALTER TABLE users CHANGE student_code user_code VARCHAR(20) NULL;
ALTER TABLE users ADD UNIQUE KEY uq_users_user_code (user_code);

-- Give the tutors and admins who already exist their IDs (the number is the account's own, so an ID never repeats).
UPDATE users
  SET user_code = CONCAT(CASE role WHEN 'tutor' THEN 'TUT' WHEN 'admin' THEN 'ADM' ELSE 'STU' END, '-', LPAD(id, 5, '0'))
  WHERE user_code IS NULL;
