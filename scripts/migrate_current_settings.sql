-- Migrate current moderation rules to new analysis configuration system
-- Based on existing moderation_rules_config table

-- Public Site Configuration (Conservative)
INSERT INTO analysis_configurations (
    usage_intent, 
    model_id, 
    detection_config, 
    scoring_config, 
    blip_config,
    is_active
) VALUES (
    'public_site',
    NULL,
    JSON_OBJECT(
        'nudenet_components', JSON_OBJECT(
            'breast_detection', true,
            'genitalia_detection', true,
            'buttocks_detection', true,
            'anus_detection', true,
            'face_detection', true
        ),
        'blip_components', JSON_OBJECT(
            'age_estimation', true,
            'child_content_detection', true,
            'image_description', true
        )
    ),
    JSON_OBJECT(
        'detection_weights', JSON_OBJECT(
            'BREAST_EXPOSED', 30,
            'GENITALIA', 90,
            'BUTTOCKS_EXPOSED', 25,
            'ANUS_EXPOSED', 85,
            'FACE_DETECTED', 0,
            'SEXUAL_ACTIVITY', 95,
            'COVERED', 0,
            'CLOTHED', 0
        ),
        'thresholds', JSON_OBJECT(
            'auto_approve_under', 10,
            'auto_flag_over', 20,
            'auto_reject_over', 85
        ),
        'risk_multipliers', JSON_OBJECT(
            'underage_detected', 20.0,
            'child_content_blip', 15.0
        )
    ),
    JSON_OBJECT(
        'enabled', true,
        'child_detection_keywords', JSON_ARRAY('child', 'kid', 'baby', 'toddler', 'minor', 'student', 'young'),
        'age_estimation_threshold', 18,
        'description_analysis', true,
        'webhook_delivery', true
    ),
    true
);

-- Paysite Configuration (Moderate - allows nudity but blocks extreme content)
INSERT INTO analysis_configurations (
    usage_intent, 
    model_id, 
    detection_config, 
    scoring_config, 
    blip_config,
    is_active
) VALUES (
    'paysite',
    NULL,
    JSON_OBJECT(
        'nudenet_components', JSON_OBJECT(
            'breast_detection', true,
            'genitalia_detection', true,
            'buttocks_detection', true,
            'anus_detection', true,
            'face_detection', true
        ),
        'blip_components', JSON_OBJECT(
            'age_estimation', true,
            'child_content_detection', true,
            'image_description', true
        )
    ),
    JSON_OBJECT(
        'detection_weights', JSON_OBJECT(
            'BREAST_EXPOSED', 15,
            'GENITALIA', 45,
            'BUTTOCKS_EXPOSED', 12,
            'ANUS_EXPOSED', 35,
            'FACE_DETECTED', 0,
            'SEXUAL_ACTIVITY', 95,
            'ILLEGAL_CONTENT', 100
        ),
        'thresholds', JSON_OBJECT(
            'auto_approve_under', 60,
            'auto_flag_over', 80,
            'auto_reject_over', 95
        ),
        'risk_multipliers', JSON_OBJECT(
            'underage_detected', 50.0,
            'child_content_blip', 25.0
        )
    ),
    JSON_OBJECT(
        'enabled', true,
        'child_detection_keywords', JSON_ARRAY('child', 'kid', 'baby', 'toddler', 'minor', 'teen', 'young'),
        'age_estimation_threshold', 18,
        'description_analysis', true,
        'webhook_delivery', true
    ),
    true
);

-- Store Configuration (Liberal - allows most content)
INSERT INTO analysis_configurations (
    usage_intent, 
    model_id, 
    detection_config, 
    scoring_config, 
    blip_config,
    is_active
) VALUES (
    'store',
    NULL,
    JSON_OBJECT(
        'nudenet_components', JSON_OBJECT(
            'breast_detection', true,
            'genitalia_detection', true,
            'buttocks_detection', true,
            'anus_detection', true,
            'face_detection', true
        ),
        'blip_components', JSON_OBJECT(
            'age_estimation', true,
            'child_content_detection', true,
            'image_description', false
        )
    ),
    JSON_OBJECT(
        'detection_weights', JSON_OBJECT(
            'BREAST_EXPOSED', 8,
            'GENITALIA', 25,
            'BUTTOCKS_EXPOSED', 6,
            'ANUS_EXPOSED', 20,
            'FACE_DETECTED', 0,
            'ILLEGAL_CONTENT', 100,
            'VIOLENCE', 100
        ),
        'thresholds', JSON_OBJECT(
            'auto_approve_under', 85,
            'auto_flag_over', 90,
            'auto_reject_over', 98
        ),
        'risk_multipliers', JSON_OBJECT(
            'underage_detected', 100.0,
            'child_content_blip', 50.0
        )
    ),
    JSON_OBJECT(
        'enabled', true,
        'child_detection_keywords', JSON_ARRAY('child', 'kid', 'baby', 'toddler', 'minor'),
        'age_estimation_threshold', 18,
        'description_analysis', false,
        'webhook_delivery', true
    ),
    true
);

-- Private Configuration (Very Liberal - minimal restrictions)
INSERT INTO analysis_configurations (
    usage_intent, 
    model_id, 
    detection_config, 
    scoring_config, 
    blip_config,
    is_active
) VALUES (
    'private',
    NULL,
    JSON_OBJECT(
        'nudenet_components', JSON_OBJECT(
            'breast_detection', true,
            'genitalia_detection', true,
            'buttocks_detection', true,
            'anus_detection', true,
            'face_detection', true
        ),
        'blip_components', JSON_OBJECT(
            'age_estimation', true,
            'child_content_detection', true,
            'image_description', false
        )
    ),
    JSON_OBJECT(
        'detection_weights', JSON_OBJECT(
            'BREAST_EXPOSED', 2,
            'GENITALIA', 8,
            'BUTTOCKS_EXPOSED', 1,
            'ANUS_EXPOSED', 5,
            'FACE_DETECTED', 0,
            'ILLEGAL_CONTENT', 100
        ),
        'thresholds', JSON_OBJECT(
            'auto_approve_under', 95,
            'auto_flag_over', 98,
            'auto_reject_over', 100
        ),
        'risk_multipliers', JSON_OBJECT(
            'underage_detected', 100.0,
            'child_content_blip', 100.0
        )
    ),
    JSON_OBJECT(
        'enabled', true,
        'child_detection_keywords', JSON_ARRAY('child', 'kid', 'baby', 'toddler', 'minor'),
        'age_estimation_threshold', 18,
        'description_analysis', false,
        'webhook_delivery', true
    ),
    true
);

-- Log the migration
INSERT INTO analysis_config_audit (
    config_id, action, changed_by, changes, usage_intent
) VALUES 
(1, 'create', 'system_migration', JSON_OBJECT('source', 'migrated_from_moderation_rules_config'), 'public_site'),
(2, 'create', 'system_migration', JSON_OBJECT('source', 'migrated_from_moderation_rules_config'), 'paysite'),
(3, 'create', 'system_migration', JSON_OBJECT('source', 'migrated_from_moderation_rules_config'), 'store'),
(4, 'create', 'system_migration', JSON_OBJECT('source', 'migrated_from_moderation_rules_config'), 'private');