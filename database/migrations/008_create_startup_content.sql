-- The wording of the diagnostic intro screen shown after "Continue to diagnostic". Tutors can edit it.
-- One row only (id is always 1). {level}, {subject}, {questions} and {highlight} are filled in on screen.
CREATE TABLE startup_content (
  id           TINYINT UNSIGNED NOT NULL,
  badge        VARCHAR(60)  NOT NULL,
  heading      VARCHAR(120) NOT NULL,
  intro        VARCHAR(300) NOT NULL,
  hint         VARCHAR(300) NOT NULL,
  highlight    VARCHAR(80)  NOT NULL,
  button_label VARCHAR(40)  NOT NULL,
  questions    TINYINT UNSIGNED NOT NULL,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO startup_content (id, badge, heading, intro, hint, highlight, button_label, questions) VALUES
  (1, 'About 10 minutes', 'Your {level} {subject} diagnostic',
   '{questions} questions across the course. It isn''t a test. It shows us exactly what to teach you.',
   'If a question is new to you, choose {highlight}. Guessing makes your map less accurate.',
   '“I haven''t learned this yet”', 'Start diagnostic', 10);
