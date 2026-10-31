-- The choices in the Student Start-up Screen dropdowns. Tutors can add, rename and delete them.
CREATE TABLE startup_options (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  category   ENUM('subject', 'exam_board', 'school_year', 'target_grade') NOT NULL,
  label      VARCHAR(60)  NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- No duplicate choice inside one dropdown; this also serves "all choices of a dropdown, in order".
  UNIQUE KEY uq_startup_options_category_label (category, label),
  KEY idx_startup_options_category_order (category, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO startup_options (category, label, sort_order) VALUES
  ('subject', 'Maths', 1), ('subject', 'English Language', 2), ('subject', 'English Literature', 3),
  ('subject', 'Biology', 4), ('subject', 'Chemistry', 5), ('subject', 'Physics', 6),
  ('subject', 'Combined Science', 7), ('subject', 'History', 8), ('subject', 'Geography', 9),
  ('exam_board', 'AQA', 1), ('exam_board', 'Edexcel', 2), ('exam_board', 'OCR', 3),
  ('exam_board', 'WJEC', 4), ('exam_board', 'Eduqas', 5),
  ('school_year', 'Year 7', 1), ('school_year', 'Year 8', 2), ('school_year', 'Year 9', 3),
  ('school_year', 'Year 10', 4), ('school_year', 'Year 11', 5), ('school_year', 'Year 12', 6),
  ('school_year', 'Year 13', 7),
  ('target_grade', '9', 1), ('target_grade', '8', 2), ('target_grade', '7', 3), ('target_grade', '6', 4),
  ('target_grade', '5', 5), ('target_grade', '4', 6), ('target_grade', '3', 7), ('target_grade', '2', 8),
  ('target_grade', '1', 9);
