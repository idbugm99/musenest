-- Test just inserting with pose_analysis
INSERT INTO content_moderation (
    image_path, original_path, model_id, context_type, 
    moderation_status, pose_analysis
) VALUES (
    '/test/simple.jpg', 
    '/test/simple_orig.jpg', 
    1, 
    'public_gallery', 
    'flagged', 
    '{"test": true}'
);