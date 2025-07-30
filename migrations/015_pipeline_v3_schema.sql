-- Enhanced Moderation Pipeline v3.0 Schema Updates
-- Add fields for NudeNet + BLIP + InsightFace pipeline

-- Add new columns to content_moderation table
ALTER TABLE content_moderation 
ADD COLUMN face_analysis JSON DEFAULT NULL COMMENT 'InsightFace age/gender analysis results',
ADD COLUMN image_description JSON DEFAULT NULL COMMENT 'BLIP-2 generated image description and tags',
ADD COLUMN min_detected_age INT DEFAULT NULL COMMENT 'Minimum age detected in faces',
ADD COLUMN face_count INT DEFAULT 0 COMMENT 'Number of faces detected',
ADD COLUMN underage_detected BOOLEAN DEFAULT FALSE COMMENT 'Whether faces under 16 were detected',
ADD COLUMN age_risk_multiplier DECIMAL(4,2) DEFAULT 1.0 COMMENT 'Risk multiplier based on detected ages',
ADD COLUMN description_risk DECIMAL(5,2) DEFAULT 0.0 COMMENT 'Risk score from image description tags';

-- Add new columns to media_review_queue table  
ALTER TABLE media_review_queue
ADD COLUMN face_analysis JSON DEFAULT NULL COMMENT 'Face analysis data for queue review',
ADD COLUMN image_description JSON DEFAULT NULL COMMENT 'Image description for human reviewers',
ADD COLUMN min_detected_age INT DEFAULT NULL COMMENT 'Minimum age for reviewer reference',
ADD COLUMN underage_detected BOOLEAN DEFAULT FALSE COMMENT 'Underage flag for priority handling',
ADD COLUMN rejection_reason VARCHAR(500) DEFAULT NULL COMMENT 'Specific reason for auto-rejection';

-- Create index for efficient age-based queries
CREATE INDEX idx_content_moderation_age ON content_moderation(min_detected_age, underage_detected);
CREATE INDEX idx_media_review_queue_underage ON media_review_queue(underage_detected, min_detected_age);

-- Update the content moderation trigger to include new fields
DROP TRIGGER IF EXISTS after_content_moderation_flagged_v3;

DELIMITER $$
CREATE TRIGGER after_content_moderation_flagged_v3
    AFTER INSERT ON content_moderation
    FOR EACH ROW
BEGIN
    DECLARE queue_priority VARCHAR(20) DEFAULT 'normal';
    DECLARE queue_type VARCHAR(50) DEFAULT 'manual_review';
    
    -- Only add to queue if flagged for review
    IF NEW.flagged = 1 THEN
        
        -- Set priority based on risk and age detection
        IF NEW.underage_detected = TRUE THEN
            SET queue_priority = 'urgent';
            SET queue_type = 'underage_review';
        ELSEIF NEW.final_risk_score >= 80 OR NEW.risk_level = 'high' THEN
            SET queue_priority = 'urgent';
        ELSEIF NEW.final_risk_score >= 50 THEN
            SET queue_priority = 'high';
        END IF;
        
        -- Insert into media review queue with v3.0 fields
        INSERT INTO media_review_queue (
            content_moderation_id,
            model_id,
            model_name,
            image_path,
            nudity_score,
            detected_parts,
            part_locations,
            pose_classification,
            explicit_pose_score,
            final_risk_score,
            risk_level,
            combined_assessment,
            pose_category,
            face_analysis,
            image_description,
            min_detected_age,
            underage_detected,
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
            NEW.nudity_score,
            NEW.detected_parts,
            NEW.part_locations,
            NEW.pose_classification,
            NEW.explicit_pose_score,
            NEW.final_risk_score,
            NEW.risk_level,
            NEW.combined_assessment,
            NEW.pose_category,
            NEW.face_analysis,
            NEW.image_description,
            NEW.min_detected_age,
            NEW.underage_detected,
            CASE 
                WHEN NEW.underage_detected = TRUE THEN CONCAT('Auto-rejected: Face detected under age ', COALESCE(NEW.min_detected_age, 16))
                ELSE NULL 
            END,
            'pending',
            queue_priority,
            queue_type,
            NOW()
        );
        
    END IF;
END$$
DELIMITER ;

-- Add comments for documentation
ALTER TABLE content_moderation COMMENT = 'Enhanced with v3.0 pipeline: NudeNet + BLIP + InsightFace';
ALTER TABLE media_review_queue COMMENT = 'Enhanced with v3.0 age-based review workflow';

-- Create a view for age-based moderation statistics
CREATE OR REPLACE VIEW moderation_age_stats AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_flagged,
    SUM(CASE WHEN underage_detected = TRUE THEN 1 ELSE 0 END) as underage_flagged,
    SUM(CASE WHEN min_detected_age IS NOT NULL AND min_detected_age < 18 THEN 1 ELSE 0 END) as under_18_flagged,
    AVG(min_detected_age) as avg_min_age,
    COUNT(DISTINCT CASE WHEN face_count > 0 THEN id END) as images_with_faces
FROM content_moderation 
WHERE flagged = 1 
GROUP BY DATE(created_at)
ORDER BY date DESC;