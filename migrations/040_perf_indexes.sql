-- 040: Performance indexes for frequently queried lists and joins
-- Idempotent: checks INFORMATION_SCHEMA before creating

-- Helper: create index if missing
-- Models table
SET @tbl := 'models';
SET @col := 'status';
SET @idx := 'idx_models_status';
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME=@tbl AND COLUMN_NAME=@col);
SET @idx_exists := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME=@tbl AND INDEX_NAME=@idx);
SET @sql := IF(@col_exists > 0 AND @idx_exists = 0, CONCAT('CREATE INDEX ', @idx, ' ON ', @tbl, ' (', @col, ')'), 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := 'subscription_status';
SET @idx := 'idx_models_subscription_status';
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='models' AND COLUMN_NAME=@col);
SET @idx_exists := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='models' AND INDEX_NAME=@idx);
SET @sql := IF(@col_exists > 0 AND @idx_exists = 0, 'CREATE INDEX idx_models_subscription_status ON models (subscription_status)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := 'client_type';
SET @idx := 'idx_models_client_type';
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='models' AND COLUMN_NAME=@col);
SET @idx_exists := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='models' AND INDEX_NAME=@idx);
SET @sql := IF(@col_exists > 0 AND @idx_exists = 0, 'CREATE INDEX idx_models_client_type ON models (client_type)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := 'business_type_id';
SET @idx := 'idx_models_business_type_id';
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='models' AND COLUMN_NAME=@col);
SET @idx_exists := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='models' AND INDEX_NAME=@idx);
SET @sql := IF(@col_exists > 0 AND @idx_exists = 0, 'CREATE INDEX idx_models_business_type_id ON models (business_type_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := 'created_at';
SET @idx := 'idx_models_created_at';
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='models' AND COLUMN_NAME=@col);
SET @idx_exists := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='models' AND INDEX_NAME=@idx);
SET @sql := IF(@col_exists > 0 AND @idx_exists = 0, 'CREATE INDEX idx_models_created_at ON models (created_at)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Users
SET @tbl := 'users';
SET @col := 'role';
SET @idx := 'idx_users_role';
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME=@tbl AND COLUMN_NAME=@col);
SET @idx_exists := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME=@tbl AND INDEX_NAME=@idx);
SET @sql := IF(@col_exists > 0 AND @idx_exists = 0, CONCAT('CREATE INDEX ', @idx, ' ON ', @tbl, ' (', @col, ')'), 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := 'created_at';
SET @idx := 'idx_users_created_at';
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME=@col);
SET @idx_exists := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='users' AND INDEX_NAME=@idx);
SET @sql := IF(@col_exists > 0 AND @idx_exists = 0, 'CREATE INDEX idx_users_created_at ON users (created_at)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- model_users
SET @tbl := 'model_users';
SET @idx := 'idx_model_users_user_role';
SET @idx_exists := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME=@tbl AND INDEX_NAME=@idx);
SET @sql := IF(@idx_exists = 0, 'CREATE INDEX idx_model_users_user_role ON model_users (user_id, role)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx := 'idx_model_users_model_role';
SET @idx_exists := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='model_users' AND INDEX_NAME=@idx);
SET @sql := IF(@idx_exists = 0, 'CREATE INDEX idx_model_users_model_role ON model_users (model_id, role)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- theme_sets
SET @tbl := 'theme_sets';
SET @idx := 'idx_theme_sets_active';
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME=@tbl AND COLUMN_NAME='is_active');
SET @idx_exists := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME=@tbl AND INDEX_NAME=@idx);
SET @sql := IF(@col_exists > 0 AND @idx_exists = 0, 'CREATE INDEX idx_theme_sets_active ON theme_sets (is_active)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx := 'idx_theme_sets_category';
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='theme_sets' AND COLUMN_NAME='category');
SET @idx_exists := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='theme_sets' AND INDEX_NAME=@idx);
SET @sql := IF(@col_exists > 0 AND @idx_exists = 0, 'CREATE INDEX idx_theme_sets_category ON theme_sets (category)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- business_page_sets
SET @tbl := 'business_page_sets';
SET @idx := 'idx_bps_active';
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME=@tbl AND COLUMN_NAME='is_active');
SET @idx_exists := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME=@tbl AND INDEX_NAME=@idx);
SET @sql := IF(@col_exists > 0 AND @idx_exists = 0, 'CREATE INDEX idx_bps_active ON business_page_sets (is_active)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx := 'idx_bps_business_type_tier';
SET @col_bt := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='business_page_sets' AND COLUMN_NAME='business_type_id');
SET @col_tier := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='business_page_sets' AND COLUMN_NAME='tier');
SET @idx_exists := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='business_page_sets' AND INDEX_NAME=@idx);
SET @sql := IF(@col_bt > 0 AND @col_tier > 0 AND @idx_exists = 0, 'CREATE INDEX idx_bps_business_type_tier ON business_page_sets (business_type_id, tier)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- moderation_queue
SET @tbl := 'moderation_queue';
SET @idx := 'idx_mq_priority';
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME=@tbl AND COLUMN_NAME='priority');
SET @idx_exists := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME=@tbl AND INDEX_NAME=@idx);
SET @sql := IF(@col_exists > 0 AND @idx_exists = 0, 'CREATE INDEX idx_mq_priority ON moderation_queue (priority)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx := 'idx_mq_assigned_to';
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='moderation_queue' AND COLUMN_NAME='assigned_to');
SET @idx_exists := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='moderation_queue' AND INDEX_NAME=@idx);
SET @sql := IF(@col_exists > 0 AND @idx_exists = 0, 'CREATE INDEX idx_mq_assigned_to ON moderation_queue (assigned_to)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx := 'idx_mq_created_at';
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='moderation_queue' AND COLUMN_NAME='created_at');
SET @idx_exists := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='moderation_queue' AND INDEX_NAME=@idx);
SET @sql := IF(@col_exists > 0 AND @idx_exists = 0, 'CREATE INDEX idx_mq_created_at ON moderation_queue (created_at)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


