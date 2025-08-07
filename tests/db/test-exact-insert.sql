-- Test the exact INSERT query that's failing
INSERT INTO content_moderation (
    image_path, original_path, model_id, context_type, usage_intent,
    nudity_score, detected_parts, part_locations, pose_classification,
    explicit_pose_score, generated_caption, policy_violations,
    moderation_status, human_review_required, flagged, auto_blocked,
    confidence_score, final_location, pose_analysis, final_risk_score,
    risk_level, combined_assessment, pose_category
) VALUES (
    '/test/exact.jpg', 
    '/test/exact_orig.jpg', 
    1, 
    'public_gallery', 
    'public_site',
    75.5, 
    '{"FACE": 80}', 
    '{"FACE": {"x": 100, "y": 100}}', 
    'neutral',
    0, 
    NULL, 
    '[]',
    'flagged', 
    1, 
    1, 
    0,
    95.0, 
    'originals', 
    '{"pose_detected": true}', 
    75.5,
    'medium', 
    '{"risk_score": 75.5}', 
    'neutral'
);