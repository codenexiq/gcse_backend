-- Student dashboard, part 2: the diagnostic questions and sign-up consent.

-- Multiple-choice diagnostic questions for one subject at one level. A subject with none uses the "how confident are you" version.
CREATE TABLE diagnostic_questions (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  subject_id VARCHAR(40)  NOT NULL,
  level_id   VARCHAR(40)  NOT NULL,
  topic_id   INT UNSIGNED NOT NULL,
  position   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  question   TEXT         NOT NULL,
  options    JSON         NOT NULL,
  correct    TINYINT UNSIGNED NOT NULL DEFAULT 0,
  mistakes   JSON         NULL,
  PRIMARY KEY (id),
  KEY idx_dq_path (subject_id, level_id, position),
  CONSTRAINT fk_dq_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE,
  CONSTRAINT fk_dq_level   FOREIGN KEY (level_id)   REFERENCES levels (id)   ON DELETE CASCADE,
  CONSTRAINT fk_dq_topic   FOREIGN KEY (topic_id)   REFERENCES topics (id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Whether the parent agreed to lesson recordings when signing up.
ALTER TABLE student_profiles ADD COLUMN recording_ok TINYINT(1) NOT NULL DEFAULT 0;

-- The starting questions (each goes to the topic of that name; nothing is added if the topic does not exist).

INSERT INTO diagnostic_questions (subject_id, level_id, topic_id, position, question, options, correct, mistakes)
  SELECT 'maths', 'gcse', t.id, 0, 'Work out $\\frac{3}{4} + \\frac{1}{6}$', '["$\\\\frac{11}{12}$", "$\\\\frac{4}{10}$", "$\\\\frac{4}{24}$", "$\\\\frac{1}{2}$"]', 0, '[null, "Adding the tops and the bottoms"]'
    FROM topics t JOIN strands s ON s.id = t.strand_id WHERE s.subject_id = 'maths' AND s.level_id = 'gcse' AND t.name = 'Fractions' LIMIT 1;

INSERT INTO diagnostic_questions (subject_id, level_id, topic_id, position, question, options, correct, mistakes)
  SELECT 'maths', 'gcse', t.id, 1, 'Increase $80$ by $15\\%$', '["$95$", "$92$", "$12$", "$68$"]', 1, '["Adding the percentage as a number"]'
    FROM topics t JOIN strands s ON s.id = t.strand_id WHERE s.subject_id = 'maths' AND s.level_id = 'gcse' AND t.name = 'Percentages' LIMIT 1;

INSERT INTO diagnostic_questions (subject_id, level_id, topic_id, position, question, options, correct, mistakes)
  SELECT 'maths', 'gcse', t.id, 2, 'Work out $2x^2$ when $x = -3$', '["$-18$", "$36$", "$18$", "$-36$"]', 2, '["Squaring negative numbers"]'
    FROM topics t JOIN strands s ON s.id = t.strand_id WHERE s.subject_id = 'maths' AND s.level_id = 'gcse' AND t.name = 'Negative numbers' LIMIT 1;

INSERT INTO diagnostic_questions (subject_id, level_id, topic_id, position, question, options, correct, mistakes)
  SELECT 'maths', 'gcse', t.id, 3, 'Which is equal to $(x + 3)^2$?', '["$x^2 + 9$", "$x^2 + 6x + 9$", "$x^2 + 3x + 9$", "$2x + 6$"]', 1, '["Thinking $(a + b)^2 = a^2 + b^2$"]'
    FROM topics t JOIN strands s ON s.id = t.strand_id WHERE s.subject_id = 'maths' AND s.level_id = 'gcse' AND t.name = 'Expanding brackets' LIMIT 1;

INSERT INTO diagnostic_questions (subject_id, level_id, topic_id, position, question, options, correct, mistakes)
  SELECT 'maths', 'gcse', t.id, 4, 'Factorise $x^2 + 5x + 6$', '["$(x + 5)(x + 1)$", "$(x + 6)(x - 1)$", "$(x + 2)(x + 3)$", "$x(x + 11)$"]', 2, '["Matching the sum but not the product"]'
    FROM topics t JOIN strands s ON s.id = t.strand_id WHERE s.subject_id = 'maths' AND s.level_id = 'gcse' AND t.name = 'Factorising quadratics' LIMIT 1;

INSERT INTO diagnostic_questions (subject_id, level_id, topic_id, position, question, options, correct, mistakes)
  SELECT 'maths', 'gcse', t.id, 5, 'Solve $x + y = 10$ and $x - y = 4$', '["$x = 7,\\\\ y = 3$", "$x = 3,\\\\ y = 7$", "$x = 14,\\\\ y = -4$", "$x = 5,\\\\ y = 5$"]', 0, '[null, "Mixing up which letter is which"]'
    FROM topics t JOIN strands s ON s.id = t.strand_id WHERE s.subject_id = 'maths' AND s.level_id = 'gcse' AND t.name = 'Simultaneous equations' LIMIT 1;

INSERT INTO diagnostic_questions (subject_id, level_id, topic_id, position, question, options, correct, mistakes)
  SELECT 'maths', 'gcse', t.id, 6, 'Make $x$ the subject of $y = 3x + 2$', '["$x = \\\\frac{y}{3} - 2$", "$x = \\\\frac{y - 2}{3}$", "$x = 3y - 2$", "$x = \\\\frac{y + 2}{3}$"]', 1, '["Undoing steps in the wrong order"]'
    FROM topics t JOIN strands s ON s.id = t.strand_id WHERE s.subject_id = 'maths' AND s.level_id = 'gcse' AND t.name = 'Rearranging formulae' LIMIT 1;

INSERT INTO diagnostic_questions (subject_id, level_id, topic_id, position, question, options, correct, mistakes)
  SELECT 'maths', 'gcse', t.id, 7, 'A right-angled triangle has shorter sides $6$ cm and $8$ cm. How long is the longest side?', '["$14$ cm", "$10$ cm", "$48$ cm", "$100$ cm"]', 1, '["Adding the sides instead of the squares"]'
    FROM topics t JOIN strands s ON s.id = t.strand_id WHERE s.subject_id = 'maths' AND s.level_id = 'gcse' AND t.name = 'Pythagoras' LIMIT 1;

INSERT INTO diagnostic_questions (subject_id, level_id, topic_id, position, question, options, correct, mistakes)
  SELECT 'maths', 'gcse', t.id, 8, 'Which ratio uses the opposite side and the hypotenuse?', '["$\\\\tan\\\\theta$", "$\\\\cos\\\\theta$", "$\\\\sin\\\\theta$", "None of these"]', 2, '["Choosing the wrong trig ratio", "Choosing the wrong trig ratio"]'
    FROM topics t JOIN strands s ON s.id = t.strand_id WHERE s.subject_id = 'maths' AND s.level_id = 'gcse' AND t.name = 'Trigonometry' LIMIT 1;

INSERT INTO diagnostic_questions (subject_id, level_id, topic_id, position, question, options, correct, mistakes)
  SELECT 'maths', 'gcse', t.id, 9, 'The probability it rains is $0.3$. What is the probability it does not rain?', '["$0.3$", "$0.7$", "$1.3$", "$-0.3$"]', 1, '[]'
    FROM topics t JOIN strands s ON s.id = t.strand_id WHERE s.subject_id = 'maths' AND s.level_id = 'gcse' AND t.name = 'Basic probability' LIMIT 1;

INSERT INTO diagnostic_questions (subject_id, level_id, topic_id, position, question, options, correct, mistakes)
  SELECT 'physics', 'gcse', t.id, 0, 'Which is the unit of energy?', '["Watt", "Joule", "Newton", "Volt"]', 1, '["Confusing energy and power"]'
    FROM topics t JOIN strands s ON s.id = t.strand_id WHERE s.subject_id = 'physics' AND s.level_id = 'gcse' AND t.name = 'Energy stores' LIMIT 1;

INSERT INTO diagnostic_questions (subject_id, level_id, topic_id, position, question, options, correct, mistakes)
  SELECT 'physics', 'gcse', t.id, 1, 'A kettle transfers $2000$ J in $10$ s. What is its power?', '["$200$ W", "$20\\\\,000$ W", "$2010$ W", "$0.005$ W"]', 0, '[null, "Multiplying instead of dividing"]'
    FROM topics t JOIN strands s ON s.id = t.strand_id WHERE s.subject_id = 'physics' AND s.level_id = 'gcse' AND t.name = 'Work and power' LIMIT 1;

INSERT INTO diagnostic_questions (subject_id, level_id, topic_id, position, question, options, correct, mistakes)
  SELECT 'physics', 'gcse', t.id, 2, 'Using $V = IR$: what is $V$ when $I = 2$ A and $R = 6\\ \\Omega$?', '["$3$ V", "$8$ V", "$12$ V", "$4$ V"]', 2, '["Dividing instead of multiplying"]'
    FROM topics t JOIN strands s ON s.id = t.strand_id WHERE s.subject_id = 'physics' AND s.level_id = 'gcse' AND t.name = 'Resistance' LIMIT 1;

INSERT INTO diagnostic_questions (subject_id, level_id, topic_id, position, question, options, correct, mistakes)
  SELECT 'physics', 'gcse', t.id, 3, 'Density is mass divided by…', '["volume", "weight", "area", "temperature"]', 0, '[]'
    FROM topics t JOIN strands s ON s.id = t.strand_id WHERE s.subject_id = 'physics' AND s.level_id = 'gcse' AND t.name = 'Density' LIMIT 1;

INSERT INTO diagnostic_questions (subject_id, level_id, topic_id, position, question, options, correct, mistakes)
  SELECT 'physics', 'gcse', t.id, 4, 'An object moves at a steady speed in a straight line. The resultant force is…', '["forwards", "zero", "backwards", "equal to its weight"]', 1, '["Thinking motion needs a resultant force"]'
    FROM topics t JOIN strands s ON s.id = t.strand_id WHERE s.subject_id = 'physics' AND s.level_id = 'gcse' AND t.name = 'Newton''s laws' LIMIT 1;

INSERT INTO diagnostic_questions (subject_id, level_id, topic_id, position, question, options, correct, mistakes)
  SELECT 'physics', 'gcse', t.id, 5, 'Which wave has the shortest wavelength?', '["Radio", "Visible light", "Microwave", "Gamma"]', 3, '[]'
    FROM topics t JOIN strands s ON s.id = t.strand_id WHERE s.subject_id = 'physics' AND s.level_id = 'gcse' AND t.name = 'Electromagnetic spectrum' LIMIT 1;
