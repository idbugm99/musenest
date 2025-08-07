-- Migration 020: Media Moderation Queue Normalization
-- Intent: normalize media_review_queue schema, add indexes and constraints.

-- Ensure table exists
CREATE TABLE IF NOT EXISTS media_review_queue (
    id INT AUTO_INCREMENT PRIMARY KEY,
    content_moderation_id INT NOT NULL,
    model_id INT NOT NULL,
    model_name VARCHAR(255) NOT NULL,
    image_path TEXT NOT NULL,
    original_path TEXT NOT NULL,
    thumbnail_path TEXT,
    nudity_score DECIMAL(5,2) DEFAULT 0,
    detected_parts JSON,
    part_locations JSON,
    pose_classification VARCHAR(100),
    explicit_pose_score DECIMAL(5,2) DEFAULT 0,
    policy_violations JSON,
    usage_intent ENUM('public_site', 'paysite', 'store', 'private') NOT NULL DEFAULT 'public_site',
    context_type VARCHAR(100) DEFAULT 'public_gallery',
    review_status ENUM('pending', 'approved', 'approved_blurred', 'rejected', 'appealed') DEFAULT 'pending',
    priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    queue_type ENUM('auto_flagged', 'manual_review', 'appeal', 'admin_override') DEFAULT 'auto_flagged',
    reviewed_by INT NULL,
    reviewed_at TIMESTAMP NULL,
    admin_notes TEXT,
    blur_settings JSON,
    blurred_path TEXT,
    blur_applied BOOLEAN DEFAULT FALSE,
    appeal_id INT NULL,
    appeal_reason VARCHAR(255),
    appeal_message TEXT,
    appeal_requested BOOLEAN DEFAULT FALSE,
    appeal_reviewed_at TIMESTAMP NULL,
    final_location VARCHAR(100) DEFAULT 'originals',
    file_moved BOOLEAN DEFAULT FALSE,
    moved_at TIMESTAMP NULL,
    flagged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_review_status (review_status),
    INDEX idx_priority (priority),
    INDEX idx_queue_type (queue_type),
    INDEX idx_model_id (model_id),
    INDEX idx_usage_intent (usage_intent),
    INDEX idx_flagged_at (flagged_at),
    INDEX idx_nudity_score (nudity_score)
);

-- Add missing columns/indexes for existing installs
ALTER TABLE media_review_queue
    ADD COLUMN IF NOT EXISTS queue_type ENUM('auto_flagged','manual_review','appeal','admin_override') DEFAULT 'auto_flagged',
    ADD COLUMN IF NOT EXISTS thumbnail_path TEXT,
    ADD COLUMN IF NOT EXISTS policy_violations JSON,
    ADD INDEX IF NOT EXISTS idx_mrq_status (review_status),
    ADD INDEX IF NOT EXISTS idx_mrq_created_at (created_at);


