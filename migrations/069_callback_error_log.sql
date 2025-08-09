-- Callback Error Log Table
-- Part of Phase B.2: Moderation Callback Handler
-- Created: 2025-08-09

CREATE TABLE IF NOT EXISTS callback_error_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    batch_id VARCHAR(100) NOT NULL,
    callback_data JSON,
    error_message TEXT,
    error_stack TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_batch_id_created (batch_id, created_at),
    INDEX idx_error_created (created_at)
);

-- Add callback statistics view
CREATE OR REPLACE VIEW callback_statistics AS
SELECT 
    mc.model_slug,
    COUNT(*) as total_callbacks,
    COUNT(CASE WHEN mc.status = 'pending' THEN 1 END) as pending_callbacks,
    COUNT(CASE WHEN mc.status = 'completed' THEN 1 END) as completed_callbacks,
    COUNT(CASE WHEN mc.status = 'failed' THEN 1 END) as failed_callbacks,
    COUNT(CASE WHEN mc.status = 'timeout' THEN 1 END) as timeout_callbacks,
    AVG(mc.retry_count) as avg_retry_count,
    MAX(mc.retry_count) as max_retry_count,
    COUNT(CASE WHEN mc.next_retry_at IS NOT NULL AND mc.next_retry_at <= NOW() THEN 1 END) as ready_for_retry,
    MAX(mc.callback_received_at) as last_callback_received,
    COUNT(cel.id) as error_count
FROM moderation_callbacks mc
LEFT JOIN callback_error_log cel ON mc.batch_id = cel.batch_id
GROUP BY mc.model_slug;