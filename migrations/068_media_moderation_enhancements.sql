-- Media Library Moderation System Enhancements
-- Part of Phase B: Moderation System Integration
-- Created: 2025-08-09

-- Table to log moderation errors for debugging and monitoring
CREATE TABLE IF NOT EXISTS moderation_error_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    model_id INT,
    model_slug VARCHAR(100) NOT NULL,
    original_filename VARCHAR(255),
    image_path VARCHAR(500),
    usage_intent VARCHAR(50),
    error_message TEXT,
    retry_attempts INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_model_slug_created (model_slug, created_at),
    INDEX idx_error_created (created_at),
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE SET NULL
);

-- Table to link media library entries to content moderation records
CREATE TABLE IF NOT EXISTS media_moderation_links (
    id INT PRIMARY KEY AUTO_INCREMENT,
    media_id INT NOT NULL,
    content_moderation_id INT,
    batch_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_media_moderation (media_id),
    INDEX idx_content_moderation (content_moderation_id),
    INDEX idx_batch_id (batch_id),
    FOREIGN KEY (media_id) REFERENCES model_media_library(id) ON DELETE CASCADE,
    FOREIGN KEY (content_moderation_id) REFERENCES content_moderation(id) ON DELETE SET NULL
);

-- Table to track moderation callbacks for pending results
CREATE TABLE IF NOT EXISTS moderation_callbacks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    media_id INT NOT NULL,
    batch_id VARCHAR(100) NOT NULL,
    model_slug VARCHAR(100) NOT NULL,
    status ENUM('pending', 'completed', 'failed', 'timeout') DEFAULT 'pending',
    callback_received_at TIMESTAMP NULL,
    callback_data JSON,
    retry_count INT DEFAULT 0,
    max_retries INT DEFAULT 5,
    next_retry_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_media_batch (media_id, batch_id),
    INDEX idx_batch_id_status (batch_id, status),
    INDEX idx_status_next_retry (status, next_retry_at),
    INDEX idx_model_slug_status (model_slug, status),
    FOREIGN KEY (media_id) REFERENCES model_media_library(id) ON DELETE CASCADE
);

-- Enhanced media upload statistics view
CREATE OR REPLACE VIEW media_upload_statistics AS
SELECT 
    mml.model_slug,
    COUNT(*) as total_media,
    COUNT(CASE WHEN mml.moderation_status = 'approved' THEN 1 END) as approved_count,
    COUNT(CASE WHEN mml.moderation_status = 'pending' THEN 1 END) as pending_count,
    COUNT(CASE WHEN mml.moderation_status = 'rejected' THEN 1 END) as rejected_count,
    COUNT(CASE WHEN mml.moderation_status = 'flagged' THEN 1 END) as flagged_count,
    COUNT(CASE WHEN mml.moderation_status = 'error' THEN 1 END) as error_count,
    SUM(mml.file_size) as total_size_bytes,
    AVG(CASE WHEN mml.moderation_score > 0 THEN mml.moderation_score END) as avg_moderation_score,
    MAX(mml.upload_date) as last_upload,
    COUNT(CASE WHEN mml.upload_date >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) as uploads_last_24h,
    COUNT(CASE WHEN mml.upload_date >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as uploads_last_week,
    -- Moderation health metrics
    ROUND(
        CASE WHEN COUNT(*) > 0 
        THEN (COUNT(CASE WHEN mml.moderation_status = 'approved' THEN 1 END) / COUNT(*)) * 100 
        ELSE 0 END, 2
    ) as approval_rate_pct,
    ROUND(
        CASE WHEN COUNT(*) > 0 
        THEN (COUNT(CASE WHEN mml.moderation_status = 'error' THEN 1 END) / COUNT(*)) * 100 
        ELSE 0 END, 2
    ) as error_rate_pct,
    ROUND(
        CASE WHEN COUNT(*) > 0 
        THEN (COUNT(CASE WHEN mml.moderation_status = 'pending' THEN 1 END) / COUNT(*)) * 100 
        ELSE 0 END, 2
    ) as pending_rate_pct
FROM model_media_library mml 
WHERE mml.is_deleted = 0
GROUP BY mml.model_slug;

-- Add indices to model_media_library for better performance
CREATE INDEX IF NOT EXISTS idx_model_media_moderation_status ON model_media_library(model_slug, moderation_status);
CREATE INDEX IF NOT EXISTS idx_model_media_upload_date ON model_media_library(model_slug, upload_date);
CREATE INDEX IF NOT EXISTS idx_model_media_score ON model_media_library(moderation_score);

-- Create stored procedure for callback processing
DELIMITER //
CREATE OR REPLACE PROCEDURE ProcessModerationCallback(
    IN p_batch_id VARCHAR(100),
    IN p_callback_data JSON,
    IN p_moderation_status VARCHAR(50),
    IN p_moderation_score DECIMAL(5,2)
)
BEGIN
    DECLARE media_count INT DEFAULT 0;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;
    
    -- Update moderation callbacks table
    UPDATE moderation_callbacks 
    SET 
        status = 'completed',
        callback_received_at = NOW(),
        callback_data = p_callback_data,
        updated_at = NOW()
    WHERE batch_id = p_batch_id AND status = 'pending';
    
    -- Update media library entries via the link table
    UPDATE model_media_library mml
    INNER JOIN media_moderation_links mml_link ON mml.id = mml_link.media_id
    SET 
        mml.moderation_status = p_moderation_status,
        mml.moderation_score = p_moderation_score,
        mml.last_modified = NOW()
    WHERE mml_link.batch_id = p_batch_id;
    
    SELECT ROW_COUNT() as updated_media_count;
    
    COMMIT;
END //
DELIMITER ;