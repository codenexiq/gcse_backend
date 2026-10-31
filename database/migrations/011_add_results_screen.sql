-- For the results screen shown when a student finishes the diagnostic.

-- A wrong answer can say what mistake picking it shows, e.g. "adding the sides instead of the squares".
ALTER TABLE diagnostic_options ADD COLUMN misconception VARCHAR(100) NULL AFTER is_correct;

-- The breakdown of an attempt (strong topics, topics that need work, mistakes), kept as JSON text so the
-- results can be shown again later exactly as they were.
ALTER TABLE diagnostic_attempts ADD COLUMN details TEXT NULL AFTER total;

-- The "What happens next" card. Tutors can edit this wording.
ALTER TABLE startup_content
  ADD COLUMN next_label   VARCHAR(60)  NOT NULL DEFAULT 'What happens next',
  ADD COLUMN next_heading VARCHAR(120) NOT NULL DEFAULT 'Your tutor is reviewing your results',
  ADD COLUMN next_text    VARCHAR(300) NOT NULL DEFAULT 'A tutor will place you in a small live group with students who made the same mistakes, usually within 24 hours.';
