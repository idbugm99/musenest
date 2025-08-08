-- Content change log for audit/rollback (idempotent)
CREATE TABLE IF NOT EXISTS content_change_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  model_id INT NOT NULL,
  page_type_id INT NOT NULL,
  content_key VARCHAR(255) NOT NULL,
  previous_value MEDIUMTEXT NULL,
  new_value MEDIUMTEXT NULL,
  reason VARCHAR(512) NULL,
  admin_user_id INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ccl_model_page_key (model_id, page_type_id, content_key),
  INDEX idx_ccl_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

