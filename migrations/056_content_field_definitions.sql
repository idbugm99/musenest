-- Optional field definitions metadata for content manager UI
CREATE TABLE IF NOT EXISTS content_field_definitions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  model_id INT NULL,
  page_type_id INT NOT NULL,
  content_key VARCHAR(255) NOT NULL,
  label VARCHAR(255) NOT NULL,
  input_type ENUM('text','textarea','html','number') NOT NULL DEFAULT 'text',
  help_text VARCHAR(512) NULL,
  is_required TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_cfd_scope (model_id, page_type_id, content_key),
  INDEX idx_cfd_page (page_type_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

