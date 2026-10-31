-- Add full_name column to users table
ALTER TABLE users
ADD COLUMN full_name VARCHAR(100) NOT NULL AFTER email;
