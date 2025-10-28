-- Augmented Reality and Virtual Reality Gallery System Migration
-- Adds comprehensive tables for AR/VR experiences, 3D content management,
-- spatial computing, device compatibility, and immersive gallery analytics

USE phoenix4ge;

-- AR/VR session management and tracking
CREATE TABLE IF NOT EXISTS ar_vr_sessions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    session_id VARCHAR(100) UNIQUE NOT NULL,
    user_id BIGINT NOT NULL,
    
    -- Session details
    session_type ENUM('AR', 'VR', 'MIXED_REALITY', 'WEB_AR', 'WEB_VR') NOT NULL,
    session_status ENUM('initializing', 'active', 'paused', 'ended', 'error') DEFAULT 'initializing',
    gallery_id VARCHAR(100), -- Reference to gallery configuration
    
    -- Device and platform information
    device_type VARCHAR(100), -- iPhone, Android, Quest, Vive, etc.
    device_model VARCHAR(200),
    platform_version VARCHAR(50),
    browser_info VARCHAR(500), -- For WebXR sessions
    device_capabilities JSON, -- Device capability profile
    
    -- AR/VR configuration
    tracking_mode ENUM('world', 'image', 'face', 'plane', 'marker', 'inside_out', 'outside_in') DEFAULT 'world',
    quality_level ENUM('low', 'medium', 'high', 'ultra', 'adaptive') DEFAULT 'adaptive',
    performance_mode ENUM('battery_saver', 'balanced', 'performance') DEFAULT 'balanced',
    render_scale DECIMAL(4,2) DEFAULT 1.00, -- VR render scale multiplier
    
    -- Content and environment
    gallery_environment_type ENUM('museum', 'modern_gallery', 'outdoor_exhibition', 'intimate_studio', 'futuristic_space', 'custom') DEFAULT 'modern_gallery',
    total_3d_models_loaded INT DEFAULT 0,
    total_images_loaded INT DEFAULT 0,
    total_spatial_anchors INT DEFAULT 0,
    content_size_mb DECIMAL(10,2) DEFAULT 0.00,
    
    -- User interaction and engagement
    total_interactions INT DEFAULT 0,
    gesture_interactions INT DEFAULT 0,
    voice_commands_used INT DEFAULT 0,
    spatial_manipulations INT DEFAULT 0,
    content_items_viewed INT DEFAULT 0,
    
    -- Performance metrics
    average_fps DECIMAL(6,2), -- Frames per second
    frame_drops INT DEFAULT 0,
    tracking_lost_count INT DEFAULT 0,
    occlusion_events INT DEFAULT 0,
    memory_usage_mb DECIMAL(10,2),
    cpu_usage_percentage DECIMAL(6,4),
    gpu_usage_percentage DECIMAL(6,4),
    battery_drain_percentage DECIMAL(6,4),
    
    -- Comfort and accessibility
    comfort_breaks_taken INT DEFAULT 0,
    motion_sickness_reported BOOLEAN DEFAULT FALSE,
    accessibility_features_used JSON,
    comfort_settings_applied JSON,
    
    -- Social and collaborative features
    is_multi_user_session BOOLEAN DEFAULT FALSE,
    concurrent_users INT DEFAULT 1,
    social_interactions INT DEFAULT 0,
    shared_content_items INT DEFAULT 0,
    voice_chat_used BOOLEAN DEFAULT FALSE,
    
    -- Session timing
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP NULL,
    last_interaction_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    session_duration_seconds INT DEFAULT 0,
    active_viewing_time_seconds INT DEFAULT 0,
    
    -- User feedback and satisfaction
    user_satisfaction_rating DECIMAL(4,2), -- 1.0 to 5.0
    experience_quality_rating DECIMAL(4,2), -- 1.0 to 5.0
    would_recommend BOOLEAN DEFAULT NULL,
    user_feedback_text TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_session_id (session_id),
    INDEX idx_user_id (user_id),
    INDEX idx_session_type (session_type),
    INDEX idx_session_status (session_status),
    INDEX idx_device_type (device_type),
    INDEX idx_started_at (started_at DESC),
    INDEX idx_user_satisfaction (user_satisfaction_rating DESC),
    INDEX idx_multi_user_sessions (is_multi_user_session, concurrent_users),
    INDEX idx_performance_metrics (average_fps DESC, tracking_lost_count),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3D content and model management for AR/VR
CREATE TABLE IF NOT EXISTS ar_vr_3d_content (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    content_id VARCHAR(100) UNIQUE NOT NULL,
    
    -- Content identification
    content_name VARCHAR(300) NOT NULL,
    content_type ENUM('3d_model', '3d_scene', 'environment', 'texture', 'material', 'animation') NOT NULL,
    content_category ENUM('artwork', 'sculpture', 'photography', 'digital_art', 'environment_asset', 'ui_element') NOT NULL,
    
    -- File and format information
    file_format ENUM('glTF', 'GLB', 'OBJ', 'FBX', 'USD', 'PLY', 'STL', '3DS') NOT NULL,
    file_size_bytes BIGINT,
    compressed_size_bytes BIGINT,
    texture_count INT DEFAULT 0,
    polygon_count INT DEFAULT 0,
    vertex_count INT DEFAULT 0,
    
    -- Quality and optimization levels
    quality_variants JSON, -- Different quality versions (low, medium, high)
    lod_levels INT DEFAULT 1, -- Level of detail variants
    compression_algorithm VARCHAR(50), -- Draco, KTX2, etc.
    optimization_applied JSON, -- Applied optimizations
    
    -- AR/VR specific properties
    ar_compatible BOOLEAN DEFAULT TRUE,
    vr_compatible BOOLEAN DEFAULT TRUE,
    webxr_compatible BOOLEAN DEFAULT TRUE,
    mobile_ar_optimized BOOLEAN DEFAULT FALSE,
    occlusion_enabled BOOLEAN DEFAULT TRUE,
    physics_enabled BOOLEAN DEFAULT FALSE,
    interactive_elements JSON, -- Interactive hotspots, animations
    
    -- Spatial properties
    bounding_box_size JSON, -- Width, height, depth in meters
    recommended_scale_min DECIMAL(6,4) DEFAULT 0.1000,
    recommended_scale_max DECIMAL(6,4) DEFAULT 10.0000,
    anchor_points JSON, -- Predefined anchor positions
    
    -- Performance characteristics
    render_complexity ENUM('very_low', 'low', 'medium', 'high', 'very_high') DEFAULT 'medium',
    memory_footprint_mb DECIMAL(10,2),
    gpu_memory_mb DECIMAL(10,2),
    loading_time_estimate_ms INT,
    draw_calls_estimate INT,
    
    -- Usage and analytics
    usage_count BIGINT DEFAULT 0,
    user_rating DECIMAL(4,2) DEFAULT 0.00,
    performance_rating DECIMAL(4,2) DEFAULT 0.00,
    compatibility_issues_reported INT DEFAULT 0,
    
    -- Content metadata
    created_by_user_id BIGINT,
    source_image_ids JSON, -- Source images if generated from photos
    generation_method ENUM('manual_upload', 'photogrammetry', 'ai_generation', 'procedural', 'scan') DEFAULT 'manual_upload',
    ai_generated BOOLEAN DEFAULT FALSE,
    
    -- Versioning and updates
    content_version VARCHAR(20) DEFAULT '1.0',
    parent_content_id VARCHAR(100), -- If this is a variant of another content
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_content_id (content_id),
    INDEX idx_content_type (content_type),
    INDEX idx_content_category (content_category),
    INDEX idx_file_format (file_format),
    INDEX idx_ar_compatible (ar_compatible),
    INDEX idx_vr_compatible (vr_compatible),
    INDEX idx_mobile_optimized (mobile_ar_optimized),
    INDEX idx_render_complexity (render_complexity),
    INDEX idx_usage_count (usage_count DESC),
    INDEX idx_user_rating (user_rating DESC),
    INDEX idx_created_by_user_id (created_by_user_id),
    INDEX idx_is_active (is_active),
    
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_content_id) REFERENCES ar_vr_3d_content(content_id) ON DELETE SET NULL
);

-- Spatial anchors and positioning for AR experiences
CREATE TABLE IF NOT EXISTS spatial_anchors (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    anchor_id VARCHAR(100) UNIQUE NOT NULL,
    session_id VARCHAR(100) NOT NULL,
    
    -- Anchor identification
    anchor_name VARCHAR(200),
    anchor_type ENUM('world_anchor', 'image_anchor', 'plane_anchor', 'object_anchor', 'persistent_anchor') NOT NULL,
    anchor_category ENUM('content_placement', 'ui_element', 'waypoint', 'interaction_zone', 'reference_point') NOT NULL,
    
    -- Spatial positioning
    position_x DECIMAL(10,6), -- World coordinates in meters
    position_y DECIMAL(10,6),
    position_z DECIMAL(10,6),
    rotation_x DECIMAL(8,4), -- Quaternion rotation
    rotation_y DECIMAL(8,4),
    rotation_z DECIMAL(8,4),
    rotation_w DECIMAL(8,4) DEFAULT 1.0000,
    scale_x DECIMAL(6,4) DEFAULT 1.0000,
    scale_y DECIMAL(6,4) DEFAULT 1.0000,
    scale_z DECIMAL(6,4) DEFAULT 1.0000,
    
    -- Anchor reliability and tracking
    tracking_confidence DECIMAL(6,4), -- 0.0 to 1.0
    tracking_quality ENUM('poor', 'fair', 'good', 'excellent') DEFAULT 'good',
    is_persistent BOOLEAN DEFAULT FALSE,
    persistent_duration_hours INT DEFAULT 24,
    anchor_lost_count INT DEFAULT 0,
    last_tracked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Associated content
    content_id VARCHAR(100), -- Reference to 3D content placed at anchor
    content_scale DECIMAL(6,4) DEFAULT 1.0000,
    content_visible BOOLEAN DEFAULT TRUE,
    interaction_enabled BOOLEAN DEFAULT TRUE,
    
    -- Environmental context
    surface_type ENUM('horizontal_plane', 'vertical_plane', 'arbitrary_plane', 'point_cloud', 'image_target') DEFAULT 'horizontal_plane',
    lighting_conditions ENUM('bright', 'normal', 'dim', 'mixed', 'unknown') DEFAULT 'normal',
    occlusion_enabled BOOLEAN DEFAULT TRUE,
    shadow_enabled BOOLEAN DEFAULT TRUE,
    
    -- Usage analytics
    interaction_count INT DEFAULT 0,
    view_count INT DEFAULT 0,
    successful_placements INT DEFAULT 0,
    failed_placements INT DEFAULT 0,
    user_adjustments INT DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_anchor_id (anchor_id),
    INDEX idx_session_id (session_id),
    INDEX idx_anchor_type (anchor_type),
    INDEX idx_anchor_category (anchor_category),
    INDEX idx_content_id (content_id),
    INDEX idx_tracking_quality (tracking_quality),
    INDEX idx_is_persistent (is_persistent),
    INDEX idx_interaction_count (interaction_count DESC),
    INDEX idx_spatial_position (position_x, position_y, position_z),
    
    FOREIGN KEY (session_id) REFERENCES ar_vr_sessions(session_id) ON DELETE CASCADE,
    FOREIGN KEY (content_id) REFERENCES ar_vr_3d_content(content_id) ON DELETE SET NULL
);

-- User interaction events in AR/VR environments
CREATE TABLE IF NOT EXISTS ar_vr_interactions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    session_id VARCHAR(100) NOT NULL,
    user_id BIGINT NOT NULL,
    
    -- Interaction details
    interaction_type ENUM('tap', 'pinch', 'grab', 'rotate', 'scale', 'swipe', 'gaze', 'voice_command', 'controller_input', 'gesture') NOT NULL,
    interaction_target ENUM('3d_content', 'ui_element', 'spatial_anchor', 'environment', 'other_user') NOT NULL,
    target_id VARCHAR(100), -- ID of the target object
    
    -- Spatial interaction data
    interaction_position_x DECIMAL(10,6),
    interaction_position_y DECIMAL(10,6),
    interaction_position_z DECIMAL(10,6),
    head_position_x DECIMAL(10,6), -- User head position during interaction
    head_position_y DECIMAL(10,6),
    head_position_z DECIMAL(10,6),
    gaze_direction_x DECIMAL(8,4), -- Gaze direction vector
    gaze_direction_y DECIMAL(8,4),
    gaze_direction_z DECIMAL(8,4),
    
    -- Interaction properties
    interaction_duration_ms INT,
    interaction_force DECIMAL(6,4), -- For pressure-sensitive interactions
    interaction_velocity DECIMAL(8,4), -- Speed of interaction
    interaction_accuracy DECIMAL(6,4), -- Accuracy score 0.0 to 1.0
    
    -- Gesture and voice data
    gesture_data JSON, -- Detailed gesture information
    voice_command_text TEXT, -- Transcribed voice command
    voice_confidence DECIMAL(6,4), -- Speech recognition confidence
    
    -- Interaction result
    interaction_success BOOLEAN DEFAULT TRUE,
    interaction_effect ENUM('content_moved', 'content_scaled', 'content_rotated', 'ui_activated', 'navigation', 'selection', 'no_effect') DEFAULT 'no_effect',
    result_data JSON, -- Detailed result information
    
    -- Context and environment
    lighting_conditions ENUM('bright', 'normal', 'dim', 'mixed') DEFAULT 'normal',
    tracking_quality ENUM('poor', 'fair', 'good', 'excellent') DEFAULT 'good',
    occlusion_present BOOLEAN DEFAULT FALSE,
    other_users_present INT DEFAULT 0,
    
    -- Performance metrics
    interaction_latency_ms INT, -- Time from input to response
    system_performance_fps DECIMAL(6,2), -- FPS during interaction
    processing_time_ms INT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_session_id (session_id),
    INDEX idx_user_id (user_id),
    INDEX idx_interaction_type (interaction_type),
    INDEX idx_interaction_target (interaction_target),
    INDEX idx_target_id (target_id),
    INDEX idx_interaction_success (interaction_success),
    INDEX idx_created_at (created_at DESC),
    INDEX idx_interaction_performance (interaction_latency_ms, system_performance_fps),
    
    FOREIGN KEY (session_id) REFERENCES ar_vr_sessions(session_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Device compatibility and capability profiles
CREATE TABLE IF NOT EXISTS ar_vr_device_profiles (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    device_profile_id VARCHAR(100) UNIQUE NOT NULL,
    
    -- Device identification
    device_type ENUM('mobile_phone', 'tablet', 'ar_headset', 'vr_headset', 'mixed_reality_headset', 'desktop', 'web_browser') NOT NULL,
    device_brand VARCHAR(100),
    device_model VARCHAR(200),
    operating_system VARCHAR(100),
    os_version VARCHAR(50),
    browser_type VARCHAR(100), -- For web-based AR/VR
    browser_version VARCHAR(50),
    
    -- AR capabilities
    ar_support BOOLEAN DEFAULT FALSE,
    world_tracking BOOLEAN DEFAULT FALSE,
    plane_detection BOOLEAN DEFAULT FALSE,
    image_tracking BOOLEAN DEFAULT FALSE,
    face_tracking BOOLEAN DEFAULT FALSE,
    occlusion_support BOOLEAN DEFAULT FALSE,
    lighting_estimation BOOLEAN DEFAULT FALSE,
    depth_sensing BOOLEAN DEFAULT FALSE,
    
    -- VR capabilities
    vr_support BOOLEAN DEFAULT FALSE,
    six_dof_tracking BOOLEAN DEFAULT FALSE,
    room_scale_tracking BOOLEAN DEFAULT FALSE,
    hand_tracking BOOLEAN DEFAULT FALSE,
    eye_tracking BOOLEAN DEFAULT FALSE,
    haptic_feedback BOOLEAN DEFAULT FALSE,
    passthrough_support BOOLEAN DEFAULT FALSE,
    
    -- Display specifications
    screen_resolution_width INT,
    screen_resolution_height INT,
    screen_refresh_rate_hz INT DEFAULT 60,
    pixel_density_ppi INT,
    hdr_support BOOLEAN DEFAULT FALSE,
    
    -- Performance characteristics
    gpu_tier ENUM('low', 'medium', 'high', 'premium') DEFAULT 'medium',
    memory_gb INT,
    cpu_cores INT,
    gpu_memory_gb INT,
    thermal_throttling_prone BOOLEAN DEFAULT FALSE,
    battery_life_estimate_hours INT,
    
    -- Supported features and formats
    supported_formats JSON, -- glTF, OBJ, etc.
    max_texture_size INT DEFAULT 2048,
    max_polygons_per_model INT DEFAULT 50000,
    max_concurrent_models INT DEFAULT 10,
    webxr_support BOOLEAN DEFAULT FALSE,
    webgl_version VARCHAR(10) DEFAULT '2.0',
    
    -- Quality recommendations
    recommended_quality ENUM('low', 'medium', 'high', 'ultra') DEFAULT 'medium',
    max_render_scale DECIMAL(4,2) DEFAULT 1.00,
    optimal_fps_target INT DEFAULT 60,
    comfort_rating ENUM('comfortable', 'acceptable', 'challenging', 'not_recommended') DEFAULT 'comfortable',
    
    -- Usage statistics
    user_count BIGINT DEFAULT 0,
    successful_sessions BIGINT DEFAULT 0,
    failed_sessions BIGINT DEFAULT 0,
    average_session_duration_minutes DECIMAL(8,2) DEFAULT 0.00,
    performance_issues_reported INT DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_device_profile_id (device_profile_id),
    INDEX idx_device_type (device_type),
    INDEX idx_device_brand_model (device_brand, device_model),
    INDEX idx_ar_support (ar_support),
    INDEX idx_vr_support (vr_support),
    INDEX idx_gpu_tier (gpu_tier),
    INDEX idx_recommended_quality (recommended_quality),
    INDEX idx_user_count (user_count DESC),
    INDEX idx_webxr_support (webxr_support),
    
    UNIQUE KEY unique_device_signature (device_brand, device_model, operating_system, os_version)
);

-- Gallery environment and layout configurations
CREATE TABLE IF NOT EXISTS ar_vr_gallery_environments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    environment_id VARCHAR(100) UNIQUE NOT NULL,
    
    -- Environment details
    environment_name VARCHAR(300) NOT NULL,
    environment_type ENUM('museum', 'modern_gallery', 'outdoor_exhibition', 'intimate_studio', 'futuristic_space', 'custom') NOT NULL,
    environment_category ENUM('realistic', 'stylized', 'abstract', 'fantastical', 'minimal') DEFAULT 'realistic',
    
    -- Environment properties
    environment_size ENUM('small', 'medium', 'large', 'extra_large') DEFAULT 'medium',
    room_dimensions JSON, -- Width, height, depth in meters
    lighting_setup ENUM('natural', 'studio', 'dramatic', 'soft', 'dynamic') DEFAULT 'natural',
    ambient_sound_enabled BOOLEAN DEFAULT TRUE,
    background_music_enabled BOOLEAN DEFAULT FALSE,
    
    -- Layout and positioning
    artwork_placement_style ENUM('grid', 'organic', 'featured', 'chronological', 'thematic') DEFAULT 'organic',
    max_artworks_supported INT DEFAULT 50,
    walking_paths JSON, -- Predefined walking paths
    viewpoints JSON, -- Optimal viewing positions
    accessibility_features JSON, -- Wheelchair access, audio descriptions, etc.
    
    -- Visual and aesthetic settings
    color_palette JSON, -- Primary colors for the environment
    material_style ENUM('modern', 'classic', 'industrial', 'organic', 'futuristic') DEFAULT 'modern',
    texture_quality ENUM('low', 'medium', 'high', 'ultra') DEFAULT 'high',
    detail_level ENUM('minimal', 'moderate', 'detailed', 'ultra_detailed') DEFAULT 'detailed',
    
    -- AR/VR specific settings
    ar_compatible BOOLEAN DEFAULT TRUE,
    vr_compatible BOOLEAN DEFAULT TRUE,
    ar_occlusion_objects JSON, -- Objects that provide occlusion in AR
    vr_comfort_rating ENUM('comfortable', 'moderate', 'challenging') DEFAULT 'comfortable',
    teleportation_points JSON, -- VR teleportation locations
    
    -- Performance characteristics
    polygon_count INT DEFAULT 0,
    texture_memory_mb DECIMAL(10,2) DEFAULT 0.00,
    draw_calls INT DEFAULT 0,
    performance_tier ENUM('mobile_optimized', 'desktop_standard', 'high_end_only') DEFAULT 'desktop_standard',
    loading_time_seconds INT DEFAULT 0,
    
    -- Customization and variants
    customizable_elements JSON, -- Elements that can be customized
    color_variants JSON, -- Available color variations
    size_variants JSON, -- Available size variations
    is_template BOOLEAN DEFAULT FALSE,
    parent_environment_id VARCHAR(100), -- If derived from another environment
    
    -- Usage analytics
    usage_count BIGINT DEFAULT 0,
    user_rating DECIMAL(4,2) DEFAULT 0.00,
    performance_rating DECIMAL(4,2) DEFAULT 0.00,
    immersion_rating DECIMAL(4,2) DEFAULT 0.00,
    
    -- Metadata
    created_by_user_id BIGINT,
    is_public BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    featured BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_environment_id (environment_id),
    INDEX idx_environment_type (environment_type),
    INDEX idx_environment_category (environment_category),
    INDEX idx_ar_compatible (ar_compatible),
    INDEX idx_vr_compatible (vr_compatible),
    INDEX idx_performance_tier (performance_tier),
    INDEX idx_usage_count (usage_count DESC),
    INDEX idx_user_rating (user_rating DESC),
    INDEX idx_created_by_user_id (created_by_user_id),
    INDEX idx_is_public (is_public),
    INDEX idx_is_active (is_active),
    INDEX idx_featured (featured),
    
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_environment_id) REFERENCES ar_vr_gallery_environments(environment_id) ON DELETE SET NULL
);

-- Social AR/VR experiences and multi-user sessions
CREATE TABLE IF NOT EXISTS ar_vr_social_sessions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    social_session_id VARCHAR(100) UNIQUE NOT NULL,
    host_user_id BIGINT NOT NULL,
    
    -- Session details
    session_name VARCHAR(300),
    session_type ENUM('collaborative_viewing', 'guided_tour', 'social_gathering', 'educational_session', 'creative_workshop') NOT NULL,
    session_privacy ENUM('public', 'friends_only', 'invite_only', 'private') DEFAULT 'friends_only',
    max_participants INT DEFAULT 8,
    current_participants INT DEFAULT 1,
    
    -- Associated AR/VR session
    ar_vr_session_id VARCHAR(100) NOT NULL, -- Primary AR/VR session
    gallery_environment_id VARCHAR(100),
    
    -- Social features enabled
    voice_chat_enabled BOOLEAN DEFAULT TRUE,
    spatial_audio_enabled BOOLEAN DEFAULT TRUE,
    avatar_system_enabled BOOLEAN DEFAULT TRUE,
    shared_pointing_enabled BOOLEAN DEFAULT TRUE,
    collaborative_controls_enabled BOOLEAN DEFAULT FALSE,
    screen_sharing_enabled BOOLEAN DEFAULT FALSE,
    
    -- Communication and interaction
    total_voice_messages INT DEFAULT 0,
    total_gestures_shared INT DEFAULT 0,
    total_points_shared INT DEFAULT 0,
    total_reactions_shared INT DEFAULT 0,
    shared_screenshots INT DEFAULT 0,
    shared_content_items INT DEFAULT 0,
    
    -- Session activity
    session_status ENUM('waiting_for_participants', 'active', 'paused', 'ended') DEFAULT 'waiting_for_participants',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP NULL,
    total_duration_seconds INT DEFAULT 0,
    most_active_user_id BIGINT,
    
    -- Social engagement metrics
    average_participation_score DECIMAL(6,4) DEFAULT 0.0000,
    total_social_interactions INT DEFAULT 0,
    user_satisfaction_rating DECIMAL(4,2) DEFAULT 0.00,
    session_cohesion_score DECIMAL(6,4) DEFAULT 0.0000, -- How well users interacted together
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_social_session_id (social_session_id),
    INDEX idx_host_user_id (host_user_id),
    INDEX idx_session_type (session_type),
    INDEX idx_session_privacy (session_privacy),
    INDEX idx_session_status (session_status),
    INDEX idx_ar_vr_session_id (ar_vr_session_id),
    INDEX idx_current_participants (current_participants DESC),
    INDEX idx_started_at (started_at DESC),
    INDEX idx_user_satisfaction (user_satisfaction_rating DESC),
    
    FOREIGN KEY (host_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (ar_vr_session_id) REFERENCES ar_vr_sessions(session_id) ON DELETE CASCADE,
    FOREIGN KEY (gallery_environment_id) REFERENCES ar_vr_gallery_environments(environment_id) ON DELETE SET NULL
);

-- Insert default 3D gallery environments
INSERT IGNORE INTO ar_vr_gallery_environments (
    environment_id, environment_name, environment_type, environment_category,
    environment_size, lighting_setup, artwork_placement_style, max_artworks_supported,
    ar_compatible, vr_compatible, performance_tier, is_public, is_active
) VALUES
('ENV_MODERN_GALLERY_01', 'Modern Gallery - White Cube', 'modern_gallery', 'realistic', 'medium', 'natural', 'grid', 30, TRUE, TRUE, 'desktop_standard', TRUE, TRUE),
('ENV_MUSEUM_CLASSIC_01', 'Classic Museum Hall', 'museum', 'realistic', 'large', 'dramatic', 'chronological', 50, TRUE, TRUE, 'desktop_standard', TRUE, TRUE),
('ENV_OUTDOOR_PARK_01', 'Sculpture Park', 'outdoor_exhibition', 'realistic', 'extra_large', 'natural', 'organic', 40, TRUE, TRUE, 'mobile_optimized', TRUE, TRUE),
('ENV_INTIMATE_STUDIO_01', 'Artist Studio', 'intimate_studio', 'stylized', 'small', 'soft', 'featured', 15, TRUE, TRUE, 'mobile_optimized', TRUE, TRUE),
('ENV_FUTURISTIC_SPACE_01', 'Digital Nexus', 'futuristic_space', 'fantastical', 'medium', 'dynamic', 'thematic', 35, TRUE, TRUE, 'high_end_only', TRUE, TRUE);

-- Insert sample device profiles for common AR/VR devices
INSERT IGNORE INTO ar_vr_device_profiles (
    device_profile_id, device_type, device_brand, device_model, operating_system,
    ar_support, vr_support, world_tracking, plane_detection, occlusion_support,
    six_dof_tracking, hand_tracking, gpu_tier, recommended_quality, webxr_support
) VALUES
('PROF_IPHONE_15_PRO', 'mobile_phone', 'Apple', 'iPhone 15 Pro', 'iOS 17', TRUE, FALSE, TRUE, TRUE, TRUE, FALSE, FALSE, 'premium', 'high', TRUE),
('PROF_PIXEL_8_PRO', 'mobile_phone', 'Google', 'Pixel 8 Pro', 'Android 14', TRUE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, 'high', 'high', TRUE),
('PROF_QUEST_3', 'vr_headset', 'Meta', 'Quest 3', 'Quest OS', TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, 'premium', 'ultra', TRUE),
('PROF_HOLOLENS_2', 'mixed_reality_headset', 'Microsoft', 'HoloLens 2', 'Windows Holographic', TRUE, FALSE, TRUE, TRUE, TRUE, TRUE, TRUE, 'premium', 'high', FALSE),
('PROF_CHROME_DESKTOP', 'web_browser', 'Google', 'Chrome', 'Windows 11', TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, FALSE, 'high', 'high', TRUE);

-- Create views for AR/VR analytics
CREATE OR REPLACE VIEW v_ar_vr_session_summary AS
SELECT 
    DATE(avs.started_at) as session_date,
    avs.session_type,
    avs.device_type,
    COUNT(*) as total_sessions,
    COUNT(CASE WHEN avs.session_status = 'ended' THEN 1 END) as completed_sessions,
    AVG(avs.session_duration_seconds) as avg_session_duration,
    AVG(avs.user_satisfaction_rating) as avg_satisfaction,
    AVG(avs.average_fps) as avg_fps,
    SUM(avs.total_interactions) as total_interactions,
    COUNT(CASE WHEN avs.is_multi_user_session = TRUE THEN 1 END) as social_sessions,
    AVG(avs.content_items_viewed) as avg_content_viewed
FROM ar_vr_sessions avs
WHERE avs.started_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY DATE(avs.started_at), avs.session_type, avs.device_type
ORDER BY session_date DESC, total_sessions DESC;

CREATE OR REPLACE VIEW v_3d_content_performance AS
SELECT 
    c.content_id,
    c.content_name,
    c.content_type,
    c.file_format,
    c.render_complexity,
    c.usage_count,
    c.user_rating,
    c.performance_rating,
    AVG(sa.tracking_confidence) as avg_tracking_confidence,
    COUNT(DISTINCT sa.session_id) as sessions_used,
    SUM(avi.interaction_count) as total_interactions,
    c.memory_footprint_mb,
    c.loading_time_estimate_ms
FROM ar_vr_3d_content c
LEFT JOIN spatial_anchors sa ON c.content_id = sa.content_id
LEFT JOIN ar_vr_interactions avi ON sa.anchor_id = avi.target_id
WHERE c.is_active = TRUE
GROUP BY c.content_id, c.content_name, c.content_type, c.file_format, 
         c.render_complexity, c.usage_count, c.user_rating, c.performance_rating,
         c.memory_footprint_mb, c.loading_time_estimate_ms
ORDER BY c.usage_count DESC, c.user_rating DESC;

CREATE OR REPLACE VIEW v_device_compatibility_analysis AS
SELECT 
    dp.device_type,
    dp.device_brand,
    dp.gpu_tier,
    dp.recommended_quality,
    COUNT(DISTINCT avs.user_id) as unique_users,
    COUNT(avs.id) as total_sessions,
    AVG(avs.user_satisfaction_rating) as avg_satisfaction,
    AVG(avs.average_fps) as avg_fps,
    COUNT(CASE WHEN avs.session_status = 'error' THEN 1 END) as error_sessions,
    AVG(avs.session_duration_seconds) as avg_session_duration,
    dp.ar_support,
    dp.vr_support,
    dp.webxr_support
FROM ar_vr_device_profiles dp
LEFT JOIN ar_vr_sessions avs ON dp.device_type = avs.device_type
WHERE avs.started_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) OR avs.started_at IS NULL
GROUP BY dp.device_type, dp.device_brand, dp.gpu_tier, dp.recommended_quality,
         dp.ar_support, dp.vr_support, dp.webxr_support
ORDER BY unique_users DESC, avg_satisfaction DESC;

-- Create stored procedures for AR/VR operations
DELIMITER $$

CREATE PROCEDURE StartARVRSession(
    IN p_user_id BIGINT,
    IN p_session_type VARCHAR(20) DEFAULT 'AR',
    IN p_device_type VARCHAR(100) DEFAULT 'mobile_phone',
    IN p_gallery_environment_id VARCHAR(100) DEFAULT NULL
)
BEGIN
    DECLARE v_session_id VARCHAR(100);
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- Generate session ID
    SET v_session_id = CONCAT(p_session_type, '_', UNIX_TIMESTAMP(), '_', p_user_id, '_', SUBSTRING(MD5(RAND()), 1, 6));
    
    -- Create AR/VR session
    INSERT INTO ar_vr_sessions (
        session_id,
        user_id,
        session_type,
        device_type,
        gallery_environment_type,
        session_status
    ) VALUES (
        v_session_id,
        p_user_id,
        p_session_type,
        p_device_type,
        COALESCE((SELECT environment_type FROM ar_vr_gallery_environments WHERE environment_id = p_gallery_environment_id), 'modern_gallery'),
        'initializing'
    );
    
    SELECT v_session_id as session_id, 'AR/VR session started successfully' as message;
    
    COMMIT;
END$$

CREATE PROCEDURE GetARVRAnalytics(
    IN p_start_date DATE DEFAULT NULL,
    IN p_end_date DATE DEFAULT NULL,
    IN p_session_type VARCHAR(20) DEFAULT NULL
)
BEGIN
    DECLARE v_start_date DATE DEFAULT COALESCE(p_start_date, DATE_SUB(CURDATE(), INTERVAL 30 DAY));
    DECLARE v_end_date DATE DEFAULT COALESCE(p_end_date, CURDATE());
    
    -- Session performance metrics
    SELECT 
        'Session Metrics' as section,
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN session_status = 'ended' THEN 1 END) as completed_sessions,
        AVG(session_duration_seconds) as avg_duration_seconds,
        AVG(user_satisfaction_rating) as avg_satisfaction,
        AVG(average_fps) as avg_fps,
        COUNT(CASE WHEN is_multi_user_session = TRUE THEN 1 END) as social_sessions
    FROM ar_vr_sessions
    WHERE DATE(started_at) BETWEEN v_start_date AND v_end_date
      AND (p_session_type IS NULL OR session_type = p_session_type);
    
    -- Device performance analysis
    SELECT 
        'Device Performance' as section,
        device_type,
        COUNT(*) as session_count,
        AVG(user_satisfaction_rating) as avg_satisfaction,
        AVG(average_fps) as avg_fps,
        COUNT(CASE WHEN session_status = 'error' THEN 1 END) as error_count
    FROM ar_vr_sessions
    WHERE DATE(started_at) BETWEEN v_start_date AND v_end_date
      AND (p_session_type IS NULL OR session_type = p_session_type)
    GROUP BY device_type
    ORDER BY session_count DESC;
    
    -- Content usage statistics
    SELECT 
        'Content Usage' as section,
        c.content_name,
        c.content_type,
        c.usage_count,
        c.user_rating,
        COUNT(DISTINCT sa.session_id) as sessions_used
    FROM ar_vr_3d_content c
    LEFT JOIN spatial_anchors sa ON c.content_id = sa.content_id
    LEFT JOIN ar_vr_sessions avs ON sa.session_id = avs.session_id
    WHERE (avs.started_at IS NULL OR DATE(avs.started_at) BETWEEN v_start_date AND v_end_date)
      AND c.is_active = TRUE
    GROUP BY c.content_id, c.content_name, c.content_type, c.usage_count, c.user_rating
    ORDER BY c.usage_count DESC
    LIMIT 20;
END$$

DELIMITER ;

-- Create indexes for optimal AR/VR query performance
ALTER TABLE ar_vr_sessions ADD INDEX idx_session_performance (session_type, average_fps DESC, user_satisfaction_rating DESC);
ALTER TABLE ar_vr_3d_content ADD INDEX idx_content_optimization (render_complexity, memory_footprint_mb, usage_count DESC);
ALTER TABLE spatial_anchors ADD INDEX idx_anchor_tracking (tracking_quality, tracking_confidence DESC, anchor_lost_count);
ALTER TABLE ar_vr_interactions ADD INDEX idx_interaction_analytics (interaction_type, interaction_success, interaction_latency_ms);

-- Grant permissions for AR/VR service
-- Note: In production, create dedicated service users
-- GRANT SELECT, INSERT, UPDATE, DELETE ON phoenix4ge.ar_vr_sessions TO 'ar_vr_service'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON phoenix4ge.ar_vr_3d_content TO 'ar_vr_service'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON phoenix4ge.spatial_anchors TO 'ar_vr_service'@'localhost';
-- GRANT EXECUTE ON PROCEDURE phoenix4ge.StartARVRSession TO 'ar_vr_service'@'localhost';
-- GRANT EXECUTE ON PROCEDURE phoenix4ge.GetARVRAnalytics TO 'ar_vr_service'@'localhost';

SELECT 'Augmented Reality and Virtual Reality Gallery system migration completed successfully' as status;