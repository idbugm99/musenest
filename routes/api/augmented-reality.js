/**
 * Augmented Reality and Virtual Reality API Routes
 * 
 * RESTful API endpoints for AR/VR gallery experiences, 3D content management,
 * spatial computing, device compatibility, and immersive analytics.
 */

const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

// Initialize Augmented Reality Service
let augmentedRealityService = null;

async function initializeService() {
    if (!augmentedRealityService) {
        const AugmentedRealityService = require('../../src/services/AugmentedRealityService');
        
        // Create database connection for the service
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        augmentedRealityService = new AugmentedRealityService(db);
        await augmentedRealityService.initialize();
    }
    return augmentedRealityService;
}

// Middleware to ensure service is initialized
async function ensureServiceReady(req, res, next) {
    try {
        await initializeService();
        next();
    } catch (error) {
        console.error('Failed to initialize Augmented Reality Service:', error);
        res.status(503).json({
            error: 'Augmented Reality Service unavailable',
            details: error.message
        });
    }
}

/**
 * GET /api/augmented-reality/health
 * Get service health status and AR/VR system metrics
 */
router.get('/health', ensureServiceReady, async (req, res) => {
    try {
        const health = await augmentedRealityService.getServiceHealthStatus();
        res.json(health);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get health status',
            details: error.message
        });
    }
});

/**
 * POST /api/augmented-reality/create-ar-experience
 * Create an AR gallery experience for a user
 * 
 * Body: {
 *   "userId": 123,
 *   "galleryConfig": {
 *     "layout_type": "modern_gallery",
 *     "content": ["image_1", "image_2", "sculpture_3"],
 *     "social_enabled": true,
 *     "multi_user_enabled": false
 *   },
 *   "deviceInfo": {
 *     "device_type": "mobile_phone",
 *     "device_model": "iPhone 15 Pro",
 *     "operating_system": "iOS 17",
 *     "ar_capabilities": {
 *       "world_tracking": true,
 *       "plane_detection": true,
 *       "occlusion_support": true
 *     }
 *   }
 * }
 */
router.post('/create-ar-experience', ensureServiceReady, async (req, res) => {
    try {
        const { userId, galleryConfig, deviceInfo = {} } = req.body;
        
        if (!userId || !galleryConfig) {
            return res.status(400).json({
                error: 'Missing required parameters',
                required: ['userId', 'galleryConfig']
            });
        }
        
        if (!Array.isArray(galleryConfig.content) || galleryConfig.content.length === 0) {
            return res.status(400).json({
                error: 'Invalid gallery configuration',
                message: 'Gallery must contain at least one content item'
            });
        }
        
        console.log(`🎨 Creating AR gallery experience for user: ${userId}`);
        
        const arExperienceResult = await augmentedRealityService.createARGalleryExperience(
            userId,
            galleryConfig,
            deviceInfo
        );
        
        res.json({
            success: !arExperienceResult.error,
            ...arExperienceResult
        });
        
    } catch (error) {
        console.error('AR experience creation error:', error);
        res.status(500).json({
            error: 'Failed to create AR experience',
            details: error.message
        });
    }
});

/**
 * POST /api/augmented-reality/create-vr-experience
 * Create a VR immersive gallery experience
 * 
 * Body: {
 *   "userId": 123,
 *   "galleryConfig": {
 *     "layout_type": "museum",
 *     "content": ["artwork_1", "sculpture_2"],
 *     "comfort_settings": "moderate",
 *     "social_enabled": true
 *   },
 *   "vrDeviceInfo": {
 *     "device_type": "vr_headset",
 *     "device_model": "Meta Quest 3",
 *     "vr_capabilities": {
 *       "six_dof_tracking": true,
 *       "hand_tracking": true,
 *       "room_scale": true,
 *       "passthrough": true
 *     }
 *   }
 * }
 */
router.post('/create-vr-experience', ensureServiceReady, async (req, res) => {
    try {
        const { userId, galleryConfig, vrDeviceInfo = {} } = req.body;
        
        if (!userId || !galleryConfig) {
            return res.status(400).json({
                error: 'Missing required parameters',
                required: ['userId', 'galleryConfig']
            });
        }
        
        if (!Array.isArray(galleryConfig.content) || galleryConfig.content.length === 0) {
            return res.status(400).json({
                error: 'Invalid gallery configuration',
                message: 'Gallery must contain at least one content item'
            });
        }
        
        console.log(`🎮 Creating VR gallery experience for user: ${userId}`);
        
        const vrExperienceResult = await augmentedRealityService.createVRGalleryExperience(
            userId,
            galleryConfig,
            vrDeviceInfo
        );
        
        res.json({
            success: !vrExperienceResult.error,
            ...vrExperienceResult
        });
        
    } catch (error) {
        console.error('VR experience creation error:', error);
        res.status(500).json({
            error: 'Failed to create VR experience',
            details: error.message
        });
    }
});

/**
 * GET /api/augmented-reality/session/:sessionId
 * Get AR/VR session details and current state
 * 
 * Query params:
 * - include_interactions: include interaction history (default false)
 * - include_anchors: include spatial anchor data (default false)
 * - include_performance: include performance metrics (default false)
 */
router.get('/session/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { 
            include_interactions = 'false', 
            include_anchors = 'false',
            include_performance = 'false'
        } = req.query;
        
        if (!sessionId) {
            return res.status(400).json({
                error: 'Invalid session ID',
                message: 'Session ID is required'
            });
        }
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        // Get AR/VR session
        const [sessions] = await db.execute(`
            SELECT * FROM ar_vr_sessions WHERE session_id = ?
        `, [sessionId]);
        
        if (sessions.length === 0) {
            await db.end();
            return res.status(404).json({
                error: 'Session not found',
                session_id: sessionId
            });
        }
        
        const sessionData = sessions[0];
        
        // Parse JSON fields
        sessionData.device_capabilities = JSON.parse(sessionData.device_capabilities || '{}');
        sessionData.accessibility_features_used = JSON.parse(sessionData.accessibility_features_used || '[]');
        sessionData.comfort_settings_applied = JSON.parse(sessionData.comfort_settings_applied || '{}');
        
        // Get interactions if requested
        if (include_interactions === 'true') {
            const [interactions] = await db.execute(`
                SELECT 
                    interaction_type,
                    interaction_target,
                    target_id,
                    interaction_duration_ms,
                    interaction_success,
                    interaction_effect,
                    created_at
                FROM ar_vr_interactions 
                WHERE session_id = ? 
                ORDER BY created_at DESC
                LIMIT 100
            `, [sessionId]);
            
            sessionData.interactions = interactions;
        }
        
        // Get spatial anchors if requested
        if (include_anchors === 'true') {
            const [anchors] = await db.execute(`
                SELECT 
                    anchor_id,
                    anchor_type,
                    anchor_category,
                    position_x,
                    position_y,
                    position_z,
                    content_id,
                    tracking_confidence,
                    tracking_quality,
                    interaction_count,
                    created_at
                FROM spatial_anchors 
                WHERE session_id = ? 
                ORDER BY created_at DESC
            `, [sessionId]);
            
            sessionData.spatial_anchors = anchors.map(anchor => ({
                ...anchor,
                position_x: parseFloat(anchor.position_x || 0),
                position_y: parseFloat(anchor.position_y || 0),
                position_z: parseFloat(anchor.position_z || 0),
                tracking_confidence: parseFloat(anchor.tracking_confidence || 0)
            }));
        }
        
        // Get performance metrics if requested
        if (include_performance === 'true') {
            const [performance] = await db.execute(`
                SELECT 
                    AVG(system_performance_fps) as avg_fps,
                    AVG(interaction_latency_ms) as avg_latency,
                    COUNT(CASE WHEN interaction_success = FALSE THEN 1 END) as failed_interactions,
                    COUNT(*) as total_interactions
                FROM ar_vr_interactions 
                WHERE session_id = ?
            `, [sessionId]);
            
            sessionData.performance_summary = performance[0] ? {
                avg_fps: parseFloat(performance[0].avg_fps || 0),
                avg_latency: parseFloat(performance[0].avg_latency || 0),
                failed_interactions: parseInt(performance[0].failed_interactions || 0),
                total_interactions: parseInt(performance[0].total_interactions || 0)
            } : {};
        }
        
        await db.end();
        
        res.json({
            success: true,
            session: sessionData
        });
        
    } catch (error) {
        console.error('Get AR/VR session error:', error);
        res.status(500).json({
            error: 'Failed to get session',
            details: error.message
        });
    }
});

/**
 * POST /api/augmented-reality/spatial-interaction
 * Process spatial interaction in AR/VR environment
 * 
 * Body: {
 *   "sessionId": "AR_1234567890_123_ABC123",
 *   "sessionType": "AR",
 *   "interactionData": {
 *     "interaction_type": "tap",
 *     "target_id": "anchor_123",
 *     "position": { "x": 1.5, "y": 0.0, "z": -2.0 },
 *     "gesture_data": { "force": 0.8, "duration": 150 }
 *   }
 * }
 */
router.post('/spatial-interaction', ensureServiceReady, async (req, res) => {
    try {
        const { sessionId, sessionType = 'AR', interactionData } = req.body;
        
        if (!sessionId || !interactionData) {
            return res.status(400).json({
                error: 'Missing required parameters',
                required: ['sessionId', 'interactionData']
            });
        }
        
        if (!interactionData.interaction_type) {
            return res.status(400).json({
                error: 'Invalid interaction data',
                message: 'Interaction type is required'
            });
        }
        
        const validSessionTypes = ['AR', 'VR', 'MIXED_REALITY'];
        if (!validSessionTypes.includes(sessionType)) {
            return res.status(400).json({
                error: 'Invalid session type',
                valid_options: validSessionTypes
            });
        }
        
        console.log(`👋 Processing spatial interaction for session: ${sessionId}`);
        
        const spatialInteractionResult = await augmentedRealityService.processSpatialInteraction(
            sessionId,
            interactionData,
            sessionType
        );
        
        res.json({
            success: true,
            ...spatialInteractionResult
        });
        
    } catch (error) {
        console.error('Spatial interaction processing error:', error);
        res.status(500).json({
            error: 'Failed to process spatial interaction',
            details: error.message
        });
    }
});

/**
 * GET /api/augmented-reality/3d-content
 * Get available 3D content for AR/VR experiences
 * 
 * Query params:
 * - content_type: 3d_model, 3d_scene, environment, etc. (optional)
 * - format: glTF, OBJ, FBX, etc. (optional)
 * - ar_compatible: true/false (default true)
 * - vr_compatible: true/false (default true)
 * - quality: low, medium, high, ultra (optional)
 * - limit: number of results (default 20, max 100)
 */
router.get('/3d-content', async (req, res) => {
    try {
        const { 
            content_type,
            format,
            ar_compatible = 'true',
            vr_compatible = 'true',
            quality,
            limit = 20 
        } = req.query;
        
        const limitNum = Math.min(parseInt(limit) || 20, 100);
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        let query = `
            SELECT 
                content_id,
                content_name,
                content_type,
                content_category,
                file_format,
                file_size_bytes,
                polygon_count,
                texture_count,
                ar_compatible,
                vr_compatible,
                webxr_compatible,
                mobile_ar_optimized,
                render_complexity,
                memory_footprint_mb,
                usage_count,
                user_rating,
                performance_rating,
                bounding_box_size,
                created_at
            FROM ar_vr_3d_content 
            WHERE is_active = TRUE
        `;
        const params = [];
        
        if (content_type) {
            query += ' AND content_type = ?';
            params.push(content_type);
        }
        
        if (format) {
            query += ' AND file_format = ?';
            params.push(format);
        }
        
        if (ar_compatible === 'true') {
            query += ' AND ar_compatible = TRUE';
        }
        
        if (vr_compatible === 'true') {
            query += ' AND vr_compatible = TRUE';
        }
        
        if (quality) {
            query += ' AND render_complexity = ?';
            params.push(quality);
        }
        
        query += ' ORDER BY usage_count DESC, user_rating DESC LIMIT ?';
        params.push(limitNum);
        
        const [content3D] = await db.execute(query, params);
        
        await db.end();
        
        // Process results
        const processed3DContent = content3D.map(content => ({
            ...content,
            file_size_mb: content.file_size_bytes ? (content.file_size_bytes / 1024 / 1024).toFixed(2) : null,
            bounding_box_size: JSON.parse(content.bounding_box_size || '{}'),
            polygon_count: parseInt(content.polygon_count || 0),
            texture_count: parseInt(content.texture_count || 0),
            usage_count: parseInt(content.usage_count || 0),
            user_rating: parseFloat(content.user_rating || 0),
            performance_rating: parseFloat(content.performance_rating || 0),
            memory_footprint_mb: parseFloat(content.memory_footprint_mb || 0)
        }));
        
        res.json({
            success: true,
            content_3d: processed3DContent,
            total_results: processed3DContent.length,
            filters: { content_type, format, ar_compatible, vr_compatible, quality, limit: limitNum }
        });
        
    } catch (error) {
        console.error('3D content query error:', error);
        res.status(500).json({
            error: 'Failed to get 3D content',
            details: error.message
        });
    }
});

/**
 * GET /api/augmented-reality/gallery-environments
 * Get available gallery environments for AR/VR experiences
 * 
 * Query params:
 * - environment_type: museum, modern_gallery, outdoor_exhibition, etc. (optional)
 * - ar_compatible: true/false (default true)
 * - vr_compatible: true/false (default true)
 * - performance_tier: mobile_optimized, desktop_standard, high_end_only (optional)
 * - limit: number of results (default 10, max 50)
 */
router.get('/gallery-environments', async (req, res) => {
    try {
        const { 
            environment_type,
            ar_compatible = 'true',
            vr_compatible = 'true',
            performance_tier,
            limit = 10 
        } = req.query;
        
        const limitNum = Math.min(parseInt(limit) || 10, 50);
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        let query = `
            SELECT 
                environment_id,
                environment_name,
                environment_type,
                environment_category,
                environment_size,
                lighting_setup,
                artwork_placement_style,
                max_artworks_supported,
                ar_compatible,
                vr_compatible,
                performance_tier,
                vr_comfort_rating,
                usage_count,
                user_rating,
                performance_rating,
                immersion_rating,
                created_at
            FROM ar_vr_gallery_environments 
            WHERE is_active = TRUE AND is_public = TRUE
        `;
        const params = [];
        
        if (environment_type) {
            query += ' AND environment_type = ?';
            params.push(environment_type);
        }
        
        if (ar_compatible === 'true') {
            query += ' AND ar_compatible = TRUE';
        }
        
        if (vr_compatible === 'true') {
            query += ' AND vr_compatible = TRUE';
        }
        
        if (performance_tier) {
            query += ' AND performance_tier = ?';
            params.push(performance_tier);
        }
        
        query += ' ORDER BY featured DESC, usage_count DESC, user_rating DESC LIMIT ?';
        params.push(limitNum);
        
        const [environments] = await db.execute(query, params);
        
        await db.end();
        
        // Process results
        const processedEnvironments = environments.map(env => ({
            ...env,
            usage_count: parseInt(env.usage_count || 0),
            user_rating: parseFloat(env.user_rating || 0),
            performance_rating: parseFloat(env.performance_rating || 0),
            immersion_rating: parseFloat(env.immersion_rating || 0),
            max_artworks_supported: parseInt(env.max_artworks_supported || 0)
        }));
        
        res.json({
            success: true,
            gallery_environments: processedEnvironments,
            total_results: processedEnvironments.length,
            filters: { environment_type, ar_compatible, vr_compatible, performance_tier, limit: limitNum }
        });
        
    } catch (error) {
        console.error('Gallery environments query error:', error);
        res.status(500).json({
            error: 'Failed to get gallery environments',
            details: error.message
        });
    }
});

/**
 * GET /api/augmented-reality/device-compatibility/:deviceType
 * Get device compatibility information for AR/VR features
 */
router.get('/device-compatibility/:deviceType', async (req, res) => {
    try {
        const { deviceType } = req.params;
        const { device_model, os_version } = req.query;
        
        if (!deviceType) {
            return res.status(400).json({
                error: 'Device type is required'
            });
        }
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        let query = `
            SELECT 
                device_profile_id,
                device_type,
                device_brand,
                device_model,
                operating_system,
                os_version,
                ar_support,
                vr_support,
                world_tracking,
                plane_detection,
                image_tracking,
                face_tracking,
                occlusion_support,
                lighting_estimation,
                six_dof_tracking,
                room_scale_tracking,
                hand_tracking,
                eye_tracking,
                haptic_feedback,
                passthrough_support,
                gpu_tier,
                recommended_quality,
                webxr_support,
                max_texture_size,
                max_polygons_per_model,
                comfort_rating
            FROM ar_vr_device_profiles 
            WHERE device_type = ?
        `;
        const params = [deviceType];
        
        if (device_model) {
            query += ' AND device_model LIKE ?';
            params.push(`%${device_model}%`);
        }
        
        if (os_version) {
            query += ' AND os_version = ?';
            params.push(os_version);
        }
        
        query += ' ORDER BY user_count DESC LIMIT 10';
        
        const [deviceProfiles] = await db.execute(query, params);
        
        await db.end();
        
        if (deviceProfiles.length === 0) {
            return res.status(404).json({
                error: 'Device compatibility data not found',
                device_type: deviceType
            });
        }
        
        // Process results
        const compatibilityData = {
            device_type: deviceType,
            compatible_devices: deviceProfiles.map(profile => ({
                ...profile,
                max_texture_size: parseInt(profile.max_texture_size || 0),
                max_polygons_per_model: parseInt(profile.max_polygons_per_model || 0),
                
                // Create capability summary
                ar_capabilities: {
                    supported: profile.ar_support,
                    world_tracking: profile.world_tracking,
                    plane_detection: profile.plane_detection,
                    image_tracking: profile.image_tracking,
                    face_tracking: profile.face_tracking,
                    occlusion_support: profile.occlusion_support,
                    lighting_estimation: profile.lighting_estimation
                },
                
                vr_capabilities: {
                    supported: profile.vr_support,
                    six_dof_tracking: profile.six_dof_tracking,
                    room_scale_tracking: profile.room_scale_tracking,
                    hand_tracking: profile.hand_tracking,
                    eye_tracking: profile.eye_tracking,
                    haptic_feedback: profile.haptic_feedback,
                    passthrough_support: profile.passthrough_support
                },
                
                performance_profile: {
                    gpu_tier: profile.gpu_tier,
                    recommended_quality: profile.recommended_quality,
                    comfort_rating: profile.comfort_rating,
                    webxr_support: profile.webxr_support
                }
            })),
            
            summary: {
                total_compatible_devices: deviceProfiles.length,
                ar_support_percentage: Math.round((deviceProfiles.filter(p => p.ar_support).length / deviceProfiles.length) * 100),
                vr_support_percentage: Math.round((deviceProfiles.filter(p => p.vr_support).length / deviceProfiles.length) * 100),
                webxr_support_percentage: Math.round((deviceProfiles.filter(p => p.webxr_support).length / deviceProfiles.length) * 100)
            }
        };
        
        res.json({
            success: true,
            compatibility_data: compatibilityData
        });
        
    } catch (error) {
        console.error('Device compatibility query error:', error);
        res.status(500).json({
            error: 'Failed to get device compatibility data',
            details: error.message
        });
    }
});

/**
 * GET /api/augmented-reality/analytics
 * Get comprehensive AR/VR analytics and performance metrics
 * 
 * Query params:
 * - timeframe: 7d, 30d, 90d (default 30d)
 * - session_type: AR, VR, MIXED_REALITY (optional)
 * - device_type: mobile_phone, vr_headset, etc. (optional)
 */
router.get('/analytics', async (req, res) => {
    try {
        const { 
            timeframe = '30d', 
            session_type,
            device_type 
        } = req.query;
        
        const validTimeframes = ['7d', '30d', '90d'];
        if (!validTimeframes.includes(timeframe)) {
            return res.status(400).json({
                error: 'Invalid timeframe',
                valid_options: validTimeframes
            });
        }
        
        console.log(`📊 Generating AR/VR analytics for timeframe: ${timeframe}`);
        
        const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        // Get session summary
        const [sessionSummary] = await db.execute(`
            SELECT * FROM v_ar_vr_session_summary 
            WHERE session_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            ${session_type ? 'AND session_type = ?' : ''}
            ${device_type ? 'AND device_type = ?' : ''}
            ORDER BY session_date DESC
        `, [days, session_type, device_type].filter(Boolean));
        
        // Get 3D content performance
        const [contentPerformance] = await db.execute(`
            SELECT * FROM v_3d_content_performance 
            ORDER BY usage_count DESC 
            LIMIT 20
        `);
        
        // Get device compatibility analysis
        const [deviceAnalysis] = await db.execute(`
            SELECT * FROM v_device_compatibility_analysis 
            WHERE unique_users > 0
            ORDER BY unique_users DESC
        `);
        
        // Get social session metrics
        const [socialMetrics] = await db.execute(`
            SELECT 
                COUNT(*) as total_social_sessions,
                AVG(current_participants) as avg_participants,
                AVG(total_duration_seconds) as avg_social_duration,
                AVG(user_satisfaction_rating) as avg_social_satisfaction,
                COUNT(CASE WHEN session_status = 'ended' THEN 1 END) as completed_social_sessions
            FROM ar_vr_social_sessions ass
            JOIN ar_vr_sessions avs ON ass.ar_vr_session_id = avs.session_id
            WHERE avs.started_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        `, [days]);
        
        // Get interaction analytics
        const [interactionAnalytics] = await db.execute(`
            SELECT 
                interaction_type,
                COUNT(*) as interaction_count,
                AVG(interaction_duration_ms) as avg_duration,
                AVG(interaction_latency_ms) as avg_latency,
                COUNT(CASE WHEN interaction_success = TRUE THEN 1 END) as successful_interactions,
                AVG(system_performance_fps) as avg_fps_during_interaction
            FROM ar_vr_interactions avi
            JOIN ar_vr_sessions avs ON avi.session_id = avs.session_id
            WHERE avs.started_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY interaction_type
            ORDER BY interaction_count DESC
        `, [days]);
        
        await db.end();
        
        // Process results
        const analytics = {
            timeframe,
            generated_at: new Date().toISOString(),
            filters: {
                session_type: session_type || 'all',
                device_type: device_type || 'all'
            },
            
            session_summary: sessionSummary.map(summary => ({
                ...summary,
                total_sessions: parseInt(summary.total_sessions || 0),
                completed_sessions: parseInt(summary.completed_sessions || 0),
                avg_session_duration: parseFloat(summary.avg_session_duration || 0),
                avg_satisfaction: parseFloat(summary.avg_satisfaction || 0),
                avg_fps: parseFloat(summary.avg_fps || 0),
                total_interactions: parseInt(summary.total_interactions || 0),
                social_sessions: parseInt(summary.social_sessions || 0),
                avg_content_viewed: parseFloat(summary.avg_content_viewed || 0)
            })),
            
            content_performance: contentPerformance.map(content => ({
                ...content,
                usage_count: parseInt(content.usage_count || 0),
                user_rating: parseFloat(content.user_rating || 0),
                performance_rating: parseFloat(content.performance_rating || 0),
                avg_tracking_confidence: parseFloat(content.avg_tracking_confidence || 0),
                sessions_used: parseInt(content.sessions_used || 0),
                total_interactions: parseInt(content.total_interactions || 0),
                memory_footprint_mb: parseFloat(content.memory_footprint_mb || 0),
                loading_time_estimate_ms: parseInt(content.loading_time_estimate_ms || 0)
            })),
            
            device_analysis: deviceAnalysis.map(device => ({
                ...device,
                unique_users: parseInt(device.unique_users || 0),
                total_sessions: parseInt(device.total_sessions || 0),
                avg_satisfaction: parseFloat(device.avg_satisfaction || 0),
                avg_fps: parseFloat(device.avg_fps || 0),
                error_sessions: parseInt(device.error_sessions || 0),
                avg_session_duration: parseFloat(device.avg_session_duration || 0)
            })),
            
            social_metrics: socialMetrics[0] ? {
                total_social_sessions: parseInt(socialMetrics[0].total_social_sessions || 0),
                avg_participants: parseFloat(socialMetrics[0].avg_participants || 0),
                avg_social_duration: parseFloat(socialMetrics[0].avg_social_duration || 0),
                avg_social_satisfaction: parseFloat(socialMetrics[0].avg_social_satisfaction || 0),
                completed_social_sessions: parseInt(socialMetrics[0].completed_social_sessions || 0)
            } : {},
            
            interaction_analytics: interactionAnalytics.map(interaction => ({
                ...interaction,
                interaction_count: parseInt(interaction.interaction_count || 0),
                avg_duration: parseFloat(interaction.avg_duration || 0),
                avg_latency: parseFloat(interaction.avg_latency || 0),
                successful_interactions: parseInt(interaction.successful_interactions || 0),
                avg_fps_during_interaction: parseFloat(interaction.avg_fps_during_interaction || 0),
                success_rate: interaction.interaction_count > 0 ? 
                    Math.round((interaction.successful_interactions / interaction.interaction_count) * 100) : 0
            }))
        };
        
        res.json({
            success: true,
            ...analytics
        });
        
    } catch (error) {
        console.error('AR/VR analytics generation error:', error);
        res.status(500).json({
            error: 'Failed to generate analytics',
            details: error.message
        });
    }
});

/**
 * POST /api/augmented-reality/test
 * Test AR/VR system with sample experiences
 */
router.post('/test', ensureServiceReady, async (req, res) => {
    try {
        const testScenarios = [
            {
                user_id: 4001,
                scenario: 'AR Mobile Gallery',
                gallery_config: {
                    layout_type: 'modern_gallery',
                    content: ['test_sculpture_1', 'test_painting_2'],
                    social_enabled: false
                },
                device_info: {
                    device_type: 'mobile_phone',
                    ar_capabilities: { world_tracking: true, plane_detection: true }
                },
                expected_result: 'AR experience created'
            },
            {
                user_id: 4002,
                scenario: 'VR Immersive Museum',
                gallery_config: {
                    layout_type: 'museum',
                    content: ['test_artwork_3', 'test_sculpture_4'],
                    social_enabled: false
                },
                vr_device_info: {
                    device_type: 'vr_headset',
                    vr_capabilities: { six_dof_tracking: true, hand_tracking: true }
                },
                expected_result: 'VR experience created'
            }
        ];
        
        console.log('🧪 Running AR/VR system test');
        
        const testResults = [];
        
        for (const scenario of testScenarios) {
            let result;
            
            if (scenario.scenario.startsWith('AR')) {
                result = await augmentedRealityService.createARGalleryExperience(
                    scenario.user_id,
                    scenario.gallery_config,
                    scenario.device_info
                );
            } else {
                result = await augmentedRealityService.createVRGalleryExperience(
                    scenario.user_id,
                    scenario.gallery_config,
                    scenario.vr_device_info
                );
            }
            
            testResults.push({
                scenario: scenario.scenario,
                user_id: scenario.user_id,
                expected_result: scenario.expected_result,
                actual_result: result.experience_ready || result.vr_experience_ready ? 'Experience created' : 'Experience failed',
                success: result.initialization_success || false,
                processing_time_ms: result.processing_time_ms || 0,
                session_id: result.ar_session_id || result.vr_session_id || null,
                test_passed: (result.initialization_success === true)
            });
        }
        
        const successRate = testResults.filter(r => r.test_passed).length / testResults.length;
        
        res.json({
            success: true,
            test_scenarios: testScenarios.length,
            test_results: testResults,
            success_rate: successRate,
            avg_processing_time: testResults.reduce((sum, r) => sum + r.processing_time_ms, 0) / testResults.length,
            message: 'AR/VR system test completed successfully'
        });
        
    } catch (error) {
        console.error('AR/VR test execution error:', error);
        res.status(500).json({
            error: 'Failed to run AR/VR test',
            details: error.message
        });
    }
});

// Error handling middleware
router.use((error, req, res, next) => {
    console.error('Augmented Reality API Error:', error);
    res.status(500).json({
        error: 'Internal server error in Augmented Reality API',
        details: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    });
});

module.exports = router;