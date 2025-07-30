-- Fix the trigger to use 'urgent' instead of 'critical' priority

DELIMITER $$
CREATE TRIGGER after_content_moderation_flagged_v3
    AFTER INSERT ON content_moderation
    FOR EACH ROW
BEGIN
    DECLARE queue_priority VARCHAR(20) DEFAULT 'medium';
    DECLARE queue_type VARCHAR(50) DEFAULT 'manual_review';
    
    -- Only add to queue if flagged for review
    IF NEW.flagged = 1 THEN
        
        -- Set priority based on risk and age detection
        IF NEW.underage_detected = TRUE THEN
            SET queue_priority = 'urgent';  -- Changed from 'critical' to 'urgent'
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
            original_path,
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
            COALESCE(NEW.original_path, NEW.image_path),
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