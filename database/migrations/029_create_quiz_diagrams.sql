-- Diagrams for quiz questions: SVG pictures that came in a quiz file. Kept apart from the quiz so the questions stay small to send.
-- Several questions can share one picture (for example one page of a question paper), so each is stored once under a key.
CREATE TABLE quiz_diagrams (
  quiz_id     INT UNSIGNED NOT NULL,
  diagram_key VARCHAR(40)  NOT NULL,
  -- The SVG text, checked on upload (no scripts, no event handlers, no links to other sites).
  svg         LONGTEXT     NOT NULL,
  PRIMARY KEY (quiz_id, diagram_key),
  CONSTRAINT fk_qd_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
