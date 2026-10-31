-- Who is this account? Everyone who registers on the website is a 'student'.
-- 'teacher' and 'admin' accounts can only be created with `npm run tutor:create` (no public sign-up).
ALTER TABLE users
  ADD COLUMN role ENUM('student', 'teacher', 'admin') NOT NULL DEFAULT 'student' AFTER password_hash,
  -- The tutor area lists accounts by role, newest first. This index finds them without scanning every user.
  ADD KEY idx_users_role_created (role, created_at);
