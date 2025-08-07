-- Migration 030: Content Template Constraints
-- Intent: add NOT NULLs + defaults for robustness to content_templates and related tables.

-- Tighten content_templates columns (compatible with existing structure)
-- Apply column modifications where possible
ALTER TABLE content_templates
    MODIFY COLUMN model_id INT NOT NULL,
    MODIFY COLUMN page_type_id INT NOT NULL,
    MODIFY COLUMN content_key VARCHAR(100) NOT NULL,
    MODIFY COLUMN content_type ENUM('text','html','json','image','video') NOT NULL DEFAULT 'text';

-- Ensure is_required exists and is constrained
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='content_templates' AND COLUMN_NAME='is_required');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE content_templates ADD COLUMN is_required BOOLEAN NOT NULL DEFAULT FALSE', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Ensure composite index exists (portable across MySQL versions)
SET @idx_exists := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'content_templates' AND INDEX_NAME = 'idx_ct_model_page'
);
SET @sql := IF(@idx_exists > 0, 'SELECT 1', 'CREATE INDEX idx_ct_model_page ON content_templates (model_id, page_type_id)');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


