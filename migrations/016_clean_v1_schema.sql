-- Clean v1 Moderation Schema
-- Removes pose analysis legacy, keeps blur functionality, focuses on face age + BLIP descriptions

-- Drop existing content_moderation table and recreate clean
DROP TABLE IF EXISTS content_moderation;

CREATE TABLE content_moderation (
    id INT PRIMARY KEY AUTO_INCREMENT,
    
    -- File paths and processing
    image_path VARCHAR(255) NOT NULL,
    original_path VARCHAR(500) DEFAULT NULL,
    blurred_path VARCHAR(500) DEFAULT NULL,
    final_location ENUM('originals','public','public_blurred','paysite','store','rejected','private') DEFAULT 'originals',
    
    -- Model and context
    model_id INT NOT NULL,
    context_type ENUM('profile_pic','public_gallery','premium_gallery','private_content') NOT NULL,
    usage_intent ENUM('public_site','paysite','store','private') DEFAULT 'public_site',
    
    -- NudeNet Analysis
    nudity_score DECIMAL(5,2) DEFAULT 0.00,
    detected_parts JSON DEFAULT NULL,
    part_locations JSON DEFAULT NULL,
    has_nudity BOOLEAN DEFAULT FALSE,
    
    -- Face Analysis (InsightFace)
    face_analysis JSON DEFAULT NULL,
    face_count INT DEFAULT 0,
    min_detected_age INT DEFAULT NULL,
    max_detected_age INT DEFAULT NULL,
    underage_detected BOOLEAN DEFAULT FALSE,
    age_risk_multiplier DECIMAL(4,2) DEFAULT 1.00,
    
    -- Image Description (BLIP)
    image_description JSON DEFAULT NULL,
    description_text TEXT DEFAULT NULL,
    description_tags JSON DEFAULT NULL,
    contains_children BOOLEAN DEFAULT FALSE,
    description_risk DECIMAL(5,2) DEFAULT 0.00,
    
    -- Risk Assessment
    final_risk_score DECIMAL(5,2) DEFAULT NULL,
    risk_level ENUM('minimal','low','medium','high','critical') DEFAULT NULL,
    risk_reasoning JSON DEFAULT NULL,
    
    -- Moderation Decision
    moderation_status ENUM('pending','approved','flagged','rejected','error') DEFAULT 'pending',
    flagged BOOLEAN DEFAULT FALSE,
    human_review_required BOOLEAN DEFAULT FALSE,
    auto_rejected BOOLEAN DEFAULT FALSE,
    rejection_reason TEXT DEFAULT NULL,
    
    -- Blur Settings (preserve existing functionality)
    blur_settings JSON DEFAULT NULL,
    model_notes TEXT DEFAULT NULL,
    admin_notes TEXT DEFAULT NULL,
    
    -- Admin workflow
    reviewed_by INT DEFAULT NULL,
    reviewed_at TIMESTAMP NULL,
    appeal_requested BOOLEAN DEFAULT FALSE,
    admin_override BOOLEAN DEFAULT FALSE,
    confidence_score DECIMAL(4,2) DEFAULT 0.00,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign keys
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Indexes for performance
    INDEX idx_model_id (model_id),
    INDEX idx_flagged (flagged),
    INDEX idx_moderation_status (moderation_status),
    INDEX idx_underage (underage_detected),
    INDEX idx_risk_score (final_risk_score),
    INDEX idx_created (created_at)
);

-- Drop existing media_review_queue and recreate clean
DROP TABLE IF EXISTS media_review_queue;

CREATE TABLE media_review_queue (
    id INT PRIMARY KEY AUTO_INCREMENT,
    
    -- Reference to moderation record
    content_moderation_id INT NOT NULL,
    model_id INT NOT NULL,
    model_name VARCHAR(100) DEFAULT NULL,
    
    -- File paths
    image_path VARCHAR(255) NOT NULL,
    original_path TEXT DEFAULT NULL,
    
    -- Analysis results for reviewers
    nudity_score DECIMAL(5,2) DEFAULT 0.00,
    detected_parts JSON DEFAULT NULL,
    part_locations JSON DEFAULT NULL,
    
    -- Face analysis for reviewers
    face_analysis JSON DEFAULT NULL,
    min_detected_age INT DEFAULT NULL,
    underage_detected BOOLEAN DEFAULT FALSE,
    
    -- Image description for reviewers
    image_description JSON DEFAULT NULL,
    description_summary TEXT DEFAULT NULL,
    
    -- Risk assessment
    final_risk_score DECIMAL(5,2) DEFAULT NULL,
    risk_level ENUM('minimal','low','medium','high','critical') DEFAULT NULL,
    risk_reasoning JSON DEFAULT NULL,
    rejection_reason TEXT DEFAULT NULL,
    
    -- Queue management
    review_status ENUM('pending','in_review','approved','rejected','escalated') DEFAULT 'pending',
    priority ENUM('low','medium','high','urgent') DEFAULT 'medium',
    queue_type ENUM('manual_review','underage_review','appeal','escalation') DEFAULT 'manual_review',
    assigned_to INT DEFAULT NULL,
    
    -- Timestamps
    flagged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_at TIMESTAMP NULL,
    reviewed_at TIMESTAMP NULL,
    
    -- Foreign keys
    FOREIGN KEY (content_moderation_id) REFERENCES content_moderation(id) ON DELETE CASCADE,
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_content_moderation (content_moderation_id),
    INDEX idx_model_id (model_id),
    INDEX idx_review_status (review_status),
    INDEX idx_priority (priority),
    INDEX idx_queue_type (queue_type),
    INDEX idx_underage (underage_detected),
    INDEX idx_flagged_at (flagged_at)
);

-- Create clean v1 trigger for queue management
DELIMITER $$
CREATE TRIGGER after_content_moderation_flagged_v1
    AFTER INSERT ON content_moderation
    FOR EACH ROW
BEGIN
    DECLARE queue_priority VARCHAR(20) DEFAULT 'medium';
    DECLARE queue_type VARCHAR(50) DEFAULT 'manual_review';
    
    -- Only add to queue if flagged for review
    IF NEW.flagged = 1 THEN
        
        -- Set priority based on age detection and risk
        IF NEW.underage_detected = TRUE THEN
            SET queue_priority = 'urgent';
            SET queue_type = 'underage_review';
        ELSEIF NEW.auto_rejected = TRUE OR NEW.final_risk_score >= 80 THEN
            SET queue_priority = 'urgent';
        ELSEIF NEW.final_risk_score >= 60 THEN
            SET queue_priority = 'high';
        ELSEIF NEW.final_risk_score >= 40 THEN
            SET queue_priority = 'medium';
        ELSE
            SET queue_priority = 'low';
        END IF;
        
        -- Insert into clean review queue
        INSERT INTO media_review_queue (
            content_moderation_id,
            model_id,
            model_name,
            image_path,
            original_path,
            nudity_score,
            detected_parts,
            part_locations,
            face_analysis,
            min_detected_age,
            underage_detected,
            image_description,
            description_summary,
            final_risk_score,
            risk_level,
            risk_reasoning,
            rejection_reason,
            review_status,
            priority,
            queue_type,
            flagged_at
        ) VALUES (
            NEW.id,
            NEW.model_id,
            (SELECT name FROM models WHERE id = NEW.model_id),
            NEW.image_path,
            NEW.original_path,
            NEW.nudity_score,
            NEW.detected_parts,
            NEW.part_locations,
            NEW.face_analysis,
            NEW.min_detected_age,
            NEW.underage_detected,
            NEW.image_description,
            NEW.description_text,
            NEW.final_risk_score,
            NEW.risk_level,
            NEW.risk_reasoning,
            NEW.rejection_reason,
            'pending',
            queue_priority,
            queue_type,
            NOW()
        );
        
    END IF;
END$$
DELIMITER ;

-- Success message
SELECT 'Clean v1 moderation schema created successfully!' as status;