CREATE TABLE IF NOT EXISTS model_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  model_id INT NOT NULL,
  setting_key VARCHAR(128) NOT NULL,
  setting_value TEXT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_model_setting (model_id, setting_key),
  INDEX idx_model_settings_model (model_id),
  FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


