CREATE TABLE IF NOT EXISTS calendar_availability (
  id INT AUTO_INCREMENT PRIMARY KEY,
  model_id INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  all_day TINYINT(1) NOT NULL DEFAULT 1,
  location VARCHAR(255) NULL,
  status ENUM('available','unavailable','travel','vacation') NOT NULL DEFAULT 'available',
  color VARCHAR(16) NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_calendar_model_dates (model_id, start_date, end_date),
  FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


