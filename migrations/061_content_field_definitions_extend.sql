-- MySQL does not support IF NOT EXISTS for ADD COLUMN. Add columns conditionally.
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'content_field_definitions' AND COLUMN_NAME = 'group_label');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE content_field_definitions ADD COLUMN group_label VARCHAR(255) NULL AFTER input_type', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'content_field_definitions' AND COLUMN_NAME = 'section_order');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE content_field_definitions ADD COLUMN section_order INT NOT NULL DEFAULT 0 AFTER group_label', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'content_field_definitions' AND COLUMN_NAME = 'field_order');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE content_field_definitions ADD COLUMN field_order INT NOT NULL DEFAULT 0 AFTER section_order', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'content_field_definitions' AND COLUMN_NAME = 'options_json');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE content_field_definitions ADD COLUMN options_json TEXT NULL AFTER help_text', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


