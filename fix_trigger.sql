-- Drop the existing trigger
DROP TRIGGER IF EXISTS after_content_moderation_insert;

-- Create new trigger with pose analysis fields
DELIMITER $$

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
    
    -- Determine queue type
    SET v_queue_type = CASE
        WHEN NEW.human_review_required = 1 THEN 'manual_review'
        ELSE 'auto_flagged'
    END;
    
    -- Insert into media_review_queue with ALL fields including pose analysis
    INSERT INTO media_review_queue (
        content_moderation_id, model_id, model_name, image_path, original_path,
        nudity_score, detected_parts, part_locations, pose_classification,
        explicit_pose_score, policy_violations, usage_intent, context_type,
        review_status, priority, queue_type, final_location, flagged_at,
        pose_analysis, final_risk_score, risk_level, combined_assessment, pose_category
    ) VALUES (
        NEW.id, NEW.model_id, 
        (SELECT CONCAT(first_name, ' ', last_name) FROM users WHERE id = NEW.model_id),
        NEW.image_path, NEW.image_path, NEW.nudity_score, NEW.detected_parts,
        NEW.part_locations, NEW.pose_classification, NEW.explicit_pose_score,
        NEW.policy_violations, NEW.usage_intent, NEW.context_type,
        'pending', v_priority, v_queue_type, NEW.final_location, NEW.created_at,
        NEW.pose_analysis, NEW.final_risk_score, NEW.risk_level, NEW.combined_assessment, NEW.pose_category
    );
END$$

DELIMITER ;