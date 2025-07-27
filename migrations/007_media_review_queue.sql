-- Migration: Create media_review_queue table for Media Governance Flow
-- This table consolidates all media moderation data for seamless admin review

USE musenest;

-- Create media_review_queue table
CREATE TABLE IF NOT EXISTS media_review_queue (
    id INT AUTO_INCREMENT PRIMARY KEY,
    content_moderation_id INT NOT NULL,
    model_id INT NOT NULL,
    model_name VARCHAR(255) NOT NULL,
    image_path TEXT NOT NULL,
    original_path TEXT NOT NULL,
    thumbnail_path TEXT,
    
    -- AI Analysis Results
    nudity_score DECIMAL(5,2) DEFAULT 0,
    detected_parts JSON,
    part_locations JSON,
    pose_classification VARCHAR(100),
    explicit_pose_score DECIMAL(5,2) DEFAULT 0,
    policy_violations JSON,
    
    -- Usage Intent and Context
    usage_intent ENUM('public_site', 'paysite', 'store', 'private') NOT NULL DEFAULT 'public_site',
    context_type VARCHAR(100) DEFAULT 'public_gallery',
    
    -- Review Status
    review_status ENUM('pending', 'approved', 'approved_blurred', 'rejected', 'appealed') DEFAULT 'pending',
    priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    queue_type ENUM('auto_flagged', 'manual_review', 'appeal', 'admin_override') DEFAULT 'auto_flagged',
    
    -- Admin Review Data
    reviewed_by INT NULL,
    reviewed_at TIMESTAMP NULL,
    admin_notes TEXT,
    
    -- Blur Settings (if approved with blur)
    blur_settings JSON,
    blurred_path TEXT,
    blur_applied BOOLEAN DEFAULT FALSE,
    
    -- Appeal Information
    appeal_id INT NULL,
    appeal_reason VARCHAR(255),
    appeal_message TEXT,
    appeal_requested BOOLEAN DEFAULT FALSE,
    appeal_reviewed_at TIMESTAMP NULL,
    
    -- File Management
    final_location VARCHAR(100) DEFAULT 'originals',
    file_moved BOOLEAN DEFAULT FALSE,
    moved_at TIMESTAMP NULL,
    
    -- Timestamps
    flagged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes for performance
    INDEX idx_review_status (review_status),
    INDEX idx_priority (priority),
    INDEX idx_queue_type (queue_type),
    INDEX idx_model_id (model_id),
    INDEX idx_usage_intent (usage_intent),
    INDEX idx_flagged_at (flagged_at),
    INDEX idx_nudity_score (nudity_score),
    
    -- Foreign key constraints
    FOREIGN KEY (content_moderation_id) REFERENCES content_moderation(id) ON DELETE CASCADE,
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    FOREIGN KEY (appeal_id) REFERENCES moderation_appeals(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create view for quick queue statistics
CREATE OR REPLACE VIEW media_queue_stats AS
SELECT 
    COUNT(*) as total_queue,
    SUM(CASE WHEN priority = 'urgent' THEN 1 ELSE 0 END) as urgent_items,
    SUM(CASE WHEN queue_type = 'appeal' THEN 1 ELSE 0 END) as appeal_items,
    SUM(CASE WHEN queue_type = 'auto_flagged' THEN 1 ELSE 0 END) as auto_flagged,
    SUM(CASE WHEN review_status = 'approved' THEN 1 ELSE 0 END) as approved_items,
    SUM(CASE WHEN review_status = 'approved_blurred' THEN 1 ELSE 0 END) as blurred_items,
    SUM(CASE WHEN review_status = 'rejected' THEN 1 ELSE 0 END) as rejected_items,
    AVG(nudity_score) as avg_nudity_score
FROM media_review_queue 
WHERE review_status = 'pending';

-- Create procedure to populate queue from existing content_moderation data
DELIMITER //
DROP PROCEDURE IF EXISTS PopulateMediaReviewQueue //
CREATE PROCEDURE PopulateMediaReviewQueue()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_id INT;
    DECLARE v_model_id INT;
    DECLARE v_model_name VARCHAR(255);
    DECLARE v_image_path TEXT;
    DECLARE v_original_path TEXT;
    DECLARE v_nudity_score DECIMAL(5,2);
    DECLARE v_detected_parts JSON;
    DECLARE v_part_locations JSON;
    DECLARE v_pose_classification VARCHAR(100);
    DECLARE v_explicit_pose_score DECIMAL(5,2);
    DECLARE v_policy_violations JSON;
    DECLARE v_usage_intent VARCHAR(50);
    DECLARE v_context_type VARCHAR(100);
    DECLARE v_moderation_status VARCHAR(50);
    DECLARE v_human_review_required BOOLEAN;
    DECLARE v_flagged BOOLEAN;
    DECLARE v_auto_blocked BOOLEAN;
    DECLARE v_final_location VARCHAR(100);
    DECLARE v_created_at TIMESTAMP;
    
    -- Cursor for flagged content requiring review
    DECLARE content_cursor CURSOR FOR
        SELECT 
            cm.id,
            cm.model_id,
            COALESCE(m.name, 'Unknown Model') as model_name,
            COALESCE(cm.image_path, cm.original_path) as image_path,
            cm.original_path,
            cm.nudity_score,
            cm.detected_parts,
            cm.part_locations,
            cm.pose_classification,
            cm.explicit_pose_score,
            cm.policy_violations,
            cm.usage_intent,
            cm.context_type,
            cm.moderation_status,
            cm.human_review_required,
            cm.flagged,
            cm.auto_blocked,
            cm.final_location,
            cm.created_at
        FROM content_moderation cm
        LEFT JOIN models m ON cm.model_id = m.id
        WHERE cm.flagged = 1 
        AND cm.moderation_status IN ('flagged', 'pending')
        AND cm.id NOT IN (SELECT content_moderation_id FROM media_review_queue);
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    OPEN content_cursor;
    
    read_loop: LOOP
        FETCH content_cursor INTO 
            v_id, v_model_id, v_model_name, v_image_path, v_original_path,
            v_nudity_score, v_detected_parts, v_part_locations, v_pose_classification,
            v_explicit_pose_score, v_policy_violations, v_usage_intent, v_context_type,
            v_moderation_status, v_human_review_required, v_flagged, v_auto_blocked,
            v_final_location, v_created_at;
        
        IF done THEN
            LEAVE read_loop;
        END IF;
        
        -- Determine priority based on nudity score and auto_blocked status
        SET @priority = CASE 
            WHEN v_nudity_score > 90 OR v_auto_blocked = 1 THEN 'urgent'
            WHEN v_nudity_score > 70 THEN 'high'
            WHEN v_nudity_score > 40 THEN 'medium'
            ELSE 'low'
        END;
        
        -- Determine queue type
        SET @queue_type = CASE 
            WHEN v_auto_blocked = 1 THEN 'auto_flagged'
            WHEN v_human_review_required = 1 THEN 'manual_review'
            ELSE 'manual_review'
        END;
        
        -- Insert into media_review_queue
        INSERT INTO media_review_queue (
            content_moderation_id, model_id, model_name, image_path, original_path,
            nudity_score, detected_parts, part_locations, pose_classification,
            explicit_pose_score, policy_violations, usage_intent, context_type,
            review_status, priority, queue_type, final_location, flagged_at
        ) VALUES (
            v_id, v_model_id, v_model_name, v_image_path, v_original_path,
            v_nudity_score, v_detected_parts, v_part_locations, v_pose_classification,
            v_explicit_pose_score, v_policy_violations, v_usage_intent, v_context_type,
            'pending', @priority, @queue_type, v_final_location, v_created_at
        );
        
    END LOOP;
    
    CLOSE content_cursor;
    
    -- Update any existing appeals
    UPDATE media_review_queue mrq
    JOIN moderation_appeals ma ON mrq.content_moderation_id = ma.content_moderation_id
    SET 
        mrq.appeal_id = ma.id,
        mrq.appeal_reason = ma.appeal_reason,
        mrq.appeal_message = ma.appeal_message,
        mrq.appeal_requested = TRUE,
        mrq.queue_type = 'appeal'
    WHERE mrq.appeal_requested = FALSE;
    
END //
DELIMITER ;

-- Run the population procedure
CALL PopulateMediaReviewQueue();

-- Create trigger to auto-populate queue when new flagged content is added
DELIMITER //
DROP TRIGGER IF EXISTS after_content_moderation_flagged //
CREATE TRIGGER after_content_moderation_flagged
AFTER INSERT ON content_moderation
FOR EACH ROW
BEGIN
    DECLARE v_model_name VARCHAR(255) DEFAULT 'Unknown Model';
    DECLARE v_priority VARCHAR(10);
    DECLARE v_queue_type VARCHAR(20);
    
    -- Only process flagged content
    IF NEW.flagged = 1 AND NEW.moderation_status IN ('flagged', 'pending') THEN
        
        -- Get model name
        SELECT COALESCE(name, 'Unknown Model')
        INTO v_model_name
        FROM models 
        WHERE id = NEW.model_id;
        
        -- Determine priority
        SET v_priority = CASE 
            WHEN NEW.nudity_score > 90 OR NEW.auto_blocked = 1 THEN 'urgent'
            WHEN NEW.nudity_score > 70 THEN 'high'
            WHEN NEW.nudity_score > 40 THEN 'medium'
            ELSE 'low'
        END;
        
        -- Determine queue type
        SET v_queue_type = CASE 
            WHEN NEW.auto_blocked = 1 THEN 'auto_flagged'
            WHEN NEW.human_review_required = 1 THEN 'manual_review'
            ELSE 'manual_review'
        END;
        
        -- Insert into media review queue
        INSERT INTO media_review_queue (
            content_moderation_id, model_id, model_name, 
            image_path, original_path, nudity_score, detected_parts, 
            part_locations, pose_classification, explicit_pose_score,
            policy_violations, usage_intent, context_type, review_status,
            priority, queue_type, final_location, flagged_at
        ) VALUES (
            NEW.id, NEW.model_id, v_model_name,
            COALESCE(NEW.image_path, NEW.original_path), NEW.original_path,
            NEW.nudity_score, NEW.detected_parts, NEW.part_locations,
            NEW.pose_classification, NEW.explicit_pose_score, NEW.policy_violations,
            NEW.usage_intent, NEW.context_type, 'pending', v_priority, v_queue_type,
            NEW.final_location, NEW.created_at
        );
        
    END IF;
END //
DELIMITER ;

-- Create trigger to update queue when appeals are created
DELIMITER //
DROP TRIGGER IF EXISTS after_moderation_appeal_created //
CREATE TRIGGER after_moderation_appeal_created
AFTER INSERT ON moderation_appeals
FOR EACH ROW
BEGIN
    UPDATE media_review_queue 
    SET 
        appeal_id = NEW.id,
        appeal_reason = NEW.appeal_reason,
        appeal_message = NEW.appeal_message,
        appeal_requested = TRUE,
        queue_type = 'appeal',
        priority = 'medium'  -- Appeals get medium priority by default
    WHERE content_moderation_id = NEW.content_moderation_id;
END //
DELIMITER ;

-- Grant permissions (skipped in development)

-- Show final statistics
SELECT 'Media Review Queue Migration Complete' as status;
SELECT * FROM media_queue_stats;
SELECT 
    review_status,
    COUNT(*) as count,
    AVG(nudity_score) as avg_score
FROM media_review_queue 
GROUP BY review_status;