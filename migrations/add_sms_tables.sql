-- SMS logging and webhook tables for Telnyx integration

-- SMS log table to track all SMS attempts
CREATE TABLE IF NOT EXISTS sms_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(50) NOT NULL COMMENT 'chat_started, new_message, custom',
    conversation_id INT NULL,
    to_number VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    success BOOLEAN NOT NULL DEFAULT FALSE,
    message_id VARCHAR(255) NULL COMMENT 'Telnyx message ID',
    error_message TEXT NULL,
    metadata JSON NULL COMMENT 'Additional context data',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_conversation (conversation_id),
    INDEX idx_type (type),
    INDEX idx_success (success),
    INDEX idx_created_at (created_at),
    INDEX idx_message_id (message_id)
);

-- SMS webhooks table to track incoming webhooks from Telnyx
CREATE TABLE IF NOT EXISTS sms_webhooks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    webhook_type VARCHAR(100) NOT NULL COMMENT 'message.received, message.sent, etc',
    webhook_data JSON NOT NULL,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    
    INDEX idx_webhook_type (webhook_type),
    INDEX idx_processed_at (processed_at)
);

-- Add phone number to models table (ignore error if column exists)
ALTER TABLE models 
ADD COLUMN phone VARCHAR(20) NULL COMMENT 'Model phone number for SMS notifications' 
AFTER email;

-- Update sample model with a test phone number (you can change this)
UPDATE models 
SET phone = '+15551234567' 
WHERE slug = 'modelexample' AND phone IS NULL;