-- Migration 013: Update content_moderation trigger to save pose analysis data
-- This ensures all the comprehensive moderation data gets saved to the queue

DELIMITER //

-- Drop existing trigger
DROP TRIGGER IF EXISTS after_content_moderation_insert//

-- Create updated trigger that saves pose analysis data
CREATE TRIGGER after_content_moderation_insert
AFTER INSERT ON content_moderation
FOR EACH ROW
BEGIN
    DECLARE v_priority VARCHAR(20);
    DECLARE v_queue_type VARCHAR(50);
    
    -- Determine priority based on nudity score and risk level
    IF NEW.nudity_score >= 80 OR NEW.final_risk_score >= 80 THEN
        SET v_priority = 'urgent';
    ELSEIF NEW.nudity_score >= 60 OR NEW.final_risk_score >= 60 THEN  
        SET v_priority = 'high';
    ELSEIF NEW.nudity_score >= 40 OR NEW.final_risk_score >= 40 THEN
        SET v_priority = 'medium';
    ELSE
        SET v_priority = 'low';
    END IF;
    
    -- Determine queue type (must match ENUM values in media_review_queue)
    SET v_queue_type = CASE
        WHEN NEW.underage_detected = 1 THEN 'underage_review'
        WHEN NEW.human_review_required = 1 THEN 'manual_review'
        ELSE 'manual_review'
    END;
    
    -- Insert into media_review_queue with fields that exist in both tables
    INSERT INTO media_review_queue (
        content_moderation_id, model_id, model_name, image_path, original_path,
        nudity_score, detected_parts, part_locations, usage_intent, context_type,
        review_status, priority, queue_type, final_location, flagged_at,
        -- Analysis fields that exist in content_moderation
        pose_analysis, final_risk_score, risk_level, face_analysis, 
        min_detected_age, underage_detected, image_description, risk_reasoning
    ) VALUES (
        NEW.id, NEW.model_id, 
        (SELECT name FROM models WHERE id = NEW.model_id),
        NEW.image_path, NEW.original_path, NEW.nudity_score, NEW.detected_parts,
        NEW.part_locations, NEW.usage_intent, NEW.context_type,
        'pending', v_priority, v_queue_type, NEW.final_location, NEW.created_at,
        -- Analysis values from content_moderation
        NEW.pose_analysis, NEW.final_risk_score, NEW.risk_level, NEW.face_analysis,
        NEW.min_detected_age, NEW.underage_detected, NEW.image_description, NEW.risk_reasoning
    );
END//

DELIMITER ;