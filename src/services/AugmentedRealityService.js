/**
 * Augmented Reality Gallery Service
 * 
 * This service provides comprehensive AR (Augmented Reality) and VR (Virtual Reality) capabilities
 * for immersive gallery experiences, virtual previews, 3D content visualization, spatial computing,
 * and mixed reality interactions for enhanced portfolio presentation.
 * 
 * Features:
 * - AR gallery preview with real-world overlay
 * - VR immersive gallery environments
 * - 3D model generation and visualization
 * - Spatial computing and room-scale experiences
 * - Mixed reality interactions and gestures
 * - Cross-platform AR/VR compatibility
 * - Performance optimization for mobile AR
 * - Social AR experiences and sharing
 */

const EventEmitter = require('events');
const mysql = require('mysql2/promise');
const Redis = require('redis');
const crypto = require('crypto');

class AugmentedRealityService extends EventEmitter {
    constructor() {
        super();
        
        // AR/VR Core Configuration
        this.arConfig = {
            // Augmented reality settings
            augmented_reality: {
                enabled: true,
                supported_platforms: ['WebXR', 'ARCore', 'ARKit', 'WebAR'],
                tracking_modes: ['world', 'image', 'face', 'plane', 'marker'],
                default_tracking_mode: 'world',
                occlusion_enabled: true,
                lighting_estimation: true,
                environmental_understanding: true,
                session_timeout_minutes: 30
            },
            
            // Virtual reality settings
            virtual_reality: {
                enabled: true,
                supported_headsets: ['Quest', 'Vive', 'Index', 'PSVR', 'WebVR'],
                room_scale_enabled: true,
                seated_experience_enabled: true,
                hand_tracking_enabled: true,
                eye_tracking_enabled: false,
                haptic_feedback_enabled: true,
                comfort_settings: ['teleport', 'smooth_locomotion', 'comfort_mode']
            },
            
            // Mixed reality settings
            mixed_reality: {
                enabled: true,
                passthrough_enabled: true,
                spatial_anchors: true,
                persistent_content: true,
                multi_user_sessions: true,
                shared_experiences: true,
                collaborative_editing: false
            }
        };
        
        // 3D Content Configuration
        this.contentConfig = {
            // 3D model generation
            model_generation: {
                enabled: true,
                supported_formats: ['glTF', 'GLTF2', 'OBJ', 'FBX', 'USD', 'PLY'],
                default_format: 'glTF',
                auto_generation_enabled: true,
                photogrammetry_enabled: true,
                ai_upscaling_enabled: true,
                texture_optimization: true,
                mesh_optimization: true,
                level_of_detail_generation: true
            },
            
            // 3D scene management
            scene_management: {
                enabled: true,
                max_models_per_scene: 50,
                max_scene_size_mb: 100,
                dynamic_loading: true,
                occlusion_culling: true,
                frustum_culling: true,
                distance_culling: true,
                batch_rendering: true,
                instanced_rendering: true
            },
            
            // Material and lighting
            rendering: {
                physically_based_rendering: true,
                real_time_shadows: true,
                global_illumination: false,
                screen_space_reflections: true,
                ambient_occlusion: true,
                post_processing_enabled: true,
                anti_aliasing: 'MSAA',
                texture_streaming: true,
                compression_enabled: true
            }
        };
        
        // Gallery Experience Configuration
        this.galleryConfig = {
            // Virtual gallery layouts
            gallery_layouts: {
                enabled: true,
                available_layouts: ['museum', 'modern_gallery', 'outdoor_exhibition', 'intimate_studio', 'futuristic_space'],
                default_layout: 'modern_gallery',
                customizable_layouts: true,
                layout_templates: true,
                dynamic_layout_generation: true,
                adaptive_sizing: true
            },
            
            // Interactive features
            interactive_features: {
                image_inspection_enabled: true,
                zoom_and_pan: true,
                rotation_controls: true,
                information_overlays: true,
                audio_descriptions: true,
                guided_tours: true,
                waypoint_navigation: true,
                gesture_controls: true,
                voice_commands: true
            },
            
            // Social features
            social_features: {
                multi_user_galleries: true,
                max_concurrent_users: 12,
                voice_chat_enabled: true,
                spatial_audio: true,
                avatar_system: true,
                shared_pointing: true,
                collaborative_curation: false,
                social_reactions: true,
                screenshot_sharing: true
            }
        };
        
        // Spatial Computing Configuration
        this.spatialConfig = {
            // Spatial mapping
            spatial_mapping: {
                enabled: true,
                real_time_mapping: true,
                persistent_maps: true,
                semantic_understanding: true,
                surface_detection: ['horizontal', 'vertical', 'angled'],
                occlusion_handling: true,
                lighting_probe_placement: true,
                anchor_persistence: true
            },
            
            // Gesture recognition
            gesture_recognition: {
                enabled: true,
                hand_tracking: true,
                gesture_types: ['tap', 'pinch', 'grab', 'point', 'swipe', 'rotate', 'scale'],
                custom_gestures: true,
                gesture_sensitivity: 0.8,
                gesture_smoothing: true,
                gesture_prediction: true,
                multi_hand_gestures: true
            },
            
            // Spatial UI
            spatial_ui: {
                enabled: true,
                ui_placement_mode: 'world_space',
                adaptive_ui_sizing: true,
                distance_based_scaling: true,
                gaze_interaction: true,
                proximity_activation: true,
                ui_following: false,
                curved_ui_surfaces: true,
                depth_layering: true
            }
        };
        
        // Performance Optimization Configuration
        this.performanceConfig = {
            // Mobile optimization
            mobile_optimization: {
                enabled: true,
                adaptive_quality: true,
                battery_aware_rendering: true,
                thermal_throttling_detection: true,
                frame_rate_target: 60,
                min_frame_rate: 30,
                dynamic_resolution_scaling: true,
                texture_memory_management: true,
                geometry_optimization: true
            },
            
            // Streaming and caching
            streaming: {
                enabled: true,
                progressive_loading: true,
                predictive_caching: true,
                bandwidth_adaptation: true,
                cdn_acceleration: true,
                compression_algorithms: ['Draco', 'KTX2', 'Basis'],
                cache_strategies: ['aggressive', 'conservative', 'adaptive'],
                preload_neighboring_content: true
            },
            
            // Quality adaptation
            quality_adaptation: {
                enabled: true,
                quality_levels: ['low', 'medium', 'high', 'ultra'],
                automatic_quality_adjustment: true,
                performance_monitoring: true,
                quality_metrics: ['fps', 'frame_time', 'gpu_usage', 'memory_usage'],
                user_preference_weighting: 0.3,
                device_capability_weighting: 0.7
            }
        };
        
        // Cross-Platform Compatibility Configuration
        this.platformConfig = {
            // Device support
            device_support: {
                mobile_ar: ['iOS', 'Android'],
                desktop_ar: ['Windows', 'macOS', 'Linux'],
                vr_headsets: ['Meta Quest', 'HTC Vive', 'Valve Index', 'Pico', 'Varjo'],
                mixed_reality: ['HoloLens', 'Magic Leap', 'Varjo Aero'],
                web_platforms: ['WebXR', 'WebAR', 'A-Frame', 'Three.js', 'Babylon.js'],
                fallback_experiences: true
            },
            
            // Compatibility layers
            compatibility: {
                webxr_polyfills: true,
                fallback_rendering: '2D',
                progressive_enhancement: true,
                feature_detection: true,
                graceful_degradation: true,
                cross_platform_input: true,
                universal_controls: true,
                accessibility_compliance: true
            }
        };
        
        // Initialize AR/VR state management
        this.arSessions = new Map(); // Active AR sessions
        this.vrSessions = new Map(); // Active VR sessions
        this.spatialAnchors = new Map(); // Persistent spatial anchors
        this.gallery3DContent = new Map(); // 3D models and scenes
        this.userExperiences = new Map(); // User experience preferences
        this.deviceCapabilities = new Map(); // Device capability profiles
        this.performanceMetrics = new Map(); // Performance monitoring data
        
        // AR/VR processing engines
        this.arEngine = null;
        this.vrEngine = null;
        this.spatialEngine = null;
        this.renderingEngine = null;
        this.gestureRecognizer = null;
        this.spatialMapper = null;
        
        // Performance tracking
        this.performanceMetrics = {
            ar_sessions_created: 0,
            vr_sessions_created: 0,
            total_3d_models_generated: 0,
            spatial_anchors_placed: 0,
            user_interactions_processed: 0,
            gallery_experiences_delivered: 0,
            cross_platform_sessions: 0,
            performance_optimizations_applied: 0,
            social_ar_sessions: 0
        };
        
        // Real-time AR/VR streams
        this.arStreams = new Map();
        this.spatialStreams = new Map();
        this.socialStreams = new Map();
    }
    
    /**
     * Initialize the AR/VR service
     */
    async initialize() {
        try {
            console.log('🥽 Initializing Augmented Reality Gallery Service...');
            
            // Initialize database connection
            this.db = await mysql.createConnection({
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_DATABASE || 'musenest'
            });
            
            // Initialize Redis for AR/VR state and caching
            this.redis = Redis.createClient({
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379
            });
            await this.redis.connect();
            
            // Initialize AR/VR specific Redis (separate DB)
            this.arRedis = Redis.createClient({
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                db: 14 // Use database 14 for AR/VR
            });
            await this.arRedis.connect();
            
            // Initialize AR/VR engines
            await this.initializeAREngine();
            await this.initializeVREngine();
            await this.initializeSpatialEngine();
            await this.initializeRenderingEngine();
            
            // Initialize 3D content management
            await this.initialize3DContentManagement();
            
            // Initialize spatial computing
            await this.initializeSpatialComputing();
            
            // Load device capability profiles
            await this.loadDeviceCapabilityProfiles();
            
            // Start performance monitoring
            this.startPerformanceMonitoring();
            
            // Start AR/VR session management
            this.startSessionManagement();
            
            console.log('✅ Augmented Reality Gallery Service initialized successfully');
            console.log(`🥽 AR Support: ${this.arConfig.augmented_reality.enabled ? 'Enabled' : 'Disabled'}`);
            console.log(`🎮 VR Support: ${this.arConfig.virtual_reality.enabled ? 'Enabled' : 'Disabled'}`);
            console.log(`🌐 Mixed Reality: ${this.arConfig.mixed_reality.enabled ? 'Enabled' : 'Disabled'}`);
            console.log(`🎯 Spatial Tracking: ${this.spatialConfig.spatial_mapping.enabled ? 'Enabled' : 'Disabled'}`);
            
            this.emit('initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize Augmented Reality Gallery Service:', error);
            throw error;
        }
    }
    
    /**
     * Create an AR gallery experience for a user
     */
    async createARGalleryExperience(userId, galleryConfig, deviceInfo = {}) {
        try {
            const startTime = Date.now();
            
            console.log(`🎨 Creating AR gallery experience for user: ${userId}`);
            
            // Load user experience preferences
            const userPreferences = await this.loadUserARPreferences(userId);
            
            // Analyze device capabilities
            const deviceCapabilities = await this.analyzeDeviceCapabilities(deviceInfo);
            
            // Generate 3D gallery environment
            const gallery3DEnvironment = await this.generate3DGalleryEnvironment(galleryConfig, userPreferences);
            
            // Prepare 3D content for AR
            const ar3DContent = await this.prepare3DContentForAR(galleryConfig.content, deviceCapabilities);
            
            // Create spatial anchors for content placement
            const spatialAnchors = await this.createSpatialAnchors(gallery3DEnvironment, ar3DContent);
            
            // Initialize AR tracking and mapping
            const arTracking = await this.initializeARTracking(userId, deviceCapabilities);
            
            // Setup interactive AR elements
            const arInteractions = await this.setupARInteractions(ar3DContent, userPreferences);
            
            // Configure performance optimization
            const performanceSettings = await this.configureARPerformance(deviceCapabilities, ar3DContent);
            
            // Create AR session
            const arSessionId = this.generateARSessionId(userId);
            const arSession = {
                session_id: arSessionId,
                user_id: userId,
                session_type: 'AR_GALLERY',
                gallery_config: galleryConfig,
                device_info: deviceInfo,
                device_capabilities: deviceCapabilities,
                user_preferences: userPreferences,
                
                // AR content
                gallery_environment: gallery3DEnvironment,
                ar_content: ar3DContent,
                spatial_anchors: spatialAnchors,
                ar_tracking: arTracking,
                ar_interactions: arInteractions,
                
                // Performance and optimization
                performance_settings: performanceSettings,
                quality_level: performanceSettings.selected_quality,
                adaptive_quality: performanceSettings.adaptive_enabled,
                
                // Session state
                session_status: 'initializing',
                started_at: new Date(),
                last_interaction_at: new Date(),
                
                // Metrics
                content_loaded: ar3DContent.models_loaded,
                anchors_placed: spatialAnchors.anchors_created,
                tracking_quality: arTracking.initial_quality_score
            };
            
            // Store AR session
            this.arSessions.set(arSessionId, arSession);
            await this.storeARSession(arSession);
            
            // Create comprehensive AR experience result
            const arExperienceResult = {
                user_id: userId,
                ar_session_id: arSessionId,
                creation_timestamp: new Date().toISOString(),
                
                // AR experience details
                gallery_environment: gallery3DEnvironment,
                ar_content_summary: {
                    total_models: ar3DContent.total_models,
                    total_images: ar3DContent.total_images,
                    total_anchors: spatialAnchors.anchors_created,
                    estimated_size_mb: ar3DContent.estimated_size_mb
                },
                
                // Device optimization
                device_optimization: performanceSettings,
                recommended_quality: performanceSettings.selected_quality,
                compatibility_score: deviceCapabilities.compatibility_score,
                
                // AR capabilities
                ar_features_enabled: {
                    world_tracking: arTracking.world_tracking_enabled,
                    occlusion: arTracking.occlusion_enabled,
                    lighting_estimation: arTracking.lighting_estimation_enabled,
                    plane_detection: arTracking.plane_detection_enabled,
                    image_tracking: arTracking.image_tracking_enabled
                },
                
                // Interactive features
                interaction_modes: arInteractions.enabled_interactions,
                gesture_support: arInteractions.gesture_support,
                voice_command_support: arInteractions.voice_support,
                
                // Session metadata
                session_configuration: {
                    tracking_mode: arTracking.tracking_mode,
                    performance_mode: performanceSettings.performance_mode,
                    social_features_enabled: galleryConfig.social_enabled || false,
                    multi_user_support: galleryConfig.multi_user_enabled || false
                },
                
                processing_time_ms: Date.now() - startTime,
                experience_ready: true,
                initialization_success: true
            };
            
            // Update performance metrics
            this.updatePerformanceMetrics(arExperienceResult);
            
            const processingTime = Date.now() - startTime;
            console.log(`✅ AR gallery experience created in ${processingTime}ms - Session: ${arSessionId}, Models: ${ar3DContent.total_models}`);
            
            this.emit('ar-experience-created', {
                userId,
                sessionId: arSessionId,
                galleryType: galleryConfig.layout_type,
                contentCount: ar3DContent.total_models,
                processingTime
            });
            
            return arExperienceResult;
            
        } catch (error) {
            console.error(`Error creating AR gallery experience for user ${userId}:`, error);
            return {
                user_id: userId,
                error: true,
                error_message: error.message,
                creation_timestamp: new Date().toISOString(),
                fallback_experience: await this.generateFallbackARExperience(userId, galleryConfig)
            };
        }
    }
    
    /**
     * Create VR immersive gallery experience
     */
    async createVRGalleryExperience(userId, galleryConfig, vrDeviceInfo = {}) {
        try {
            const startTime = Date.now();
            
            console.log(`🎮 Creating VR gallery experience for user: ${userId}`);
            
            // Load user VR preferences
            const userVRPreferences = await this.loadUserVRPreferences(userId);
            
            // Analyze VR device capabilities
            const vrCapabilities = await this.analyzeVRDeviceCapabilities(vrDeviceInfo);
            
            // Generate immersive VR gallery environment
            const vrGalleryEnvironment = await this.generateVRGalleryEnvironment(galleryConfig, userVRPreferences);
            
            // Prepare high-quality 3D content for VR
            const vr3DContent = await this.prepare3DContentForVR(galleryConfig.content, vrCapabilities);
            
            // Setup VR locomotion and comfort settings
            const vrLocomotion = await this.setupVRLocomotion(userVRPreferences, vrCapabilities);
            
            // Configure VR interactions and controllers
            const vrInteractions = await this.configureVRInteractions(vr3DContent, vrCapabilities);
            
            // Initialize spatial audio for VR
            const vrSpatialAudio = await this.initializeVRSpatialAudio(vrGalleryEnvironment);
            
            // Setup VR performance optimization
            const vrPerformanceSettings = await this.configureVRPerformance(vrCapabilities, vr3DContent);
            
            // Create VR session
            const vrSessionId = this.generateVRSessionId(userId);
            const vrSession = {
                session_id: vrSessionId,
                user_id: userId,
                session_type: 'VR_GALLERY',
                vr_device_info: vrDeviceInfo,
                vr_capabilities: vrCapabilities,
                user_preferences: userVRPreferences,
                
                // VR content and environment
                vr_environment: vrGalleryEnvironment,
                vr_content: vr3DContent,
                locomotion_settings: vrLocomotion,
                interaction_settings: vrInteractions,
                spatial_audio: vrSpatialAudio,
                
                // Performance optimization
                performance_settings: vrPerformanceSettings,
                quality_level: vrPerformanceSettings.selected_quality,
                render_scale: vrPerformanceSettings.render_scale,
                
                // Session state
                session_status: 'initializing',
                started_at: new Date(),
                comfort_break_recommended_at: new Date(Date.now() + 20 * 60 * 1000), // 20 minutes
                
                // VR-specific metrics
                headset_tracking_quality: vrCapabilities.tracking_quality,
                controller_tracking_quality: vrCapabilities.controller_tracking,
                room_scale_available: vrCapabilities.room_scale_tracking
            };
            
            // Store VR session
            this.vrSessions.set(vrSessionId, vrSession);
            await this.storeVRSession(vrSession);
            
            // Create comprehensive VR experience result
            const vrExperienceResult = {
                user_id: userId,
                vr_session_id: vrSessionId,
                creation_timestamp: new Date().toISOString(),
                
                // VR experience details
                vr_environment: vrGalleryEnvironment,
                vr_content_summary: {
                    total_models: vr3DContent.total_models,
                    total_scenes: vr3DContent.total_scenes,
                    environment_size: vrGalleryEnvironment.environment_size,
                    estimated_vram_usage_mb: vr3DContent.estimated_vram_mb
                },
                
                // VR device optimization
                vr_optimization: vrPerformanceSettings,
                headset_compatibility: vrCapabilities.compatibility_score,
                recommended_settings: vrPerformanceSettings.recommended_settings,
                
                // VR features
                vr_features_enabled: {
                    room_scale: vrLocomotion.room_scale_enabled,
                    hand_tracking: vrInteractions.hand_tracking_enabled,
                    haptic_feedback: vrInteractions.haptic_enabled,
                    spatial_audio: vrSpatialAudio.enabled,
                    passthrough: vrCapabilities.passthrough_available
                },
                
                // Comfort and accessibility
                comfort_settings: {
                    locomotion_type: vrLocomotion.locomotion_type,
                    comfort_mode: vrLocomotion.comfort_mode_enabled,
                    vignetting: vrLocomotion.comfort_vignetting,
                    teleport_enabled: vrLocomotion.teleport_enabled,
                    break_reminders: userVRPreferences.break_reminders_enabled
                },
                
                processing_time_ms: Date.now() - startTime,
                vr_experience_ready: true,
                initialization_success: true
            };
            
            const processingTime = Date.now() - startTime;
            console.log(`✅ VR gallery experience created in ${processingTime}ms - Session: ${vrSessionId}, Scenes: ${vr3DContent.total_scenes}`);
            
            this.emit('vr-experience-created', {
                userId,
                sessionId: vrSessionId,
                vrDevice: vrDeviceInfo.device_type,
                contentCount: vr3DContent.total_models,
                processingTime
            });
            
            return vrExperienceResult;
            
        } catch (error) {
            console.error(`Error creating VR gallery experience for user ${userId}:`, error);
            return {
                user_id: userId,
                error: true,
                error_message: error.message,
                creation_timestamp: new Date().toISOString(),
                fallback_experience: await this.generateFallbackVRExperience(userId, galleryConfig)
            };
        }
    }
    
    /**
     * Process spatial interaction in AR/VR environment
     */
    async processSpatialInteraction(sessionId, interactionData, sessionType = 'AR') {
        try {
            console.log(`👋 Processing spatial interaction for session: ${sessionId}`);
            
            // Get session data
            const session = sessionType === 'AR' ? 
                this.arSessions.get(sessionId) : 
                this.vrSessions.get(sessionId);
                
            if (!session) {
                throw new Error(`${sessionType} session not found: ${sessionId}`);
            }
            
            // Process interaction based on type
            const interactionResult = await this.processInteractionByType(interactionData, session);
            
            // Update spatial state
            const spatialUpdate = await this.updateSpatialState(session, interactionResult);
            
            // Apply interaction effects
            const interactionEffects = await this.applyInteractionEffects(interactionResult, session);
            
            // Update session with interaction
            await this.updateSessionWithInteraction(sessionId, interactionResult, sessionType);
            
            // Generate response for user
            const interactionResponse = await this.generateInteractionResponse(interactionResult, session);
            
            const spatialInteractionResult = {
                session_id: sessionId,
                session_type: sessionType,
                interaction_timestamp: new Date().toISOString(),
                
                // Interaction details
                interaction_type: interactionData.interaction_type,
                interaction_result: interactionResult,
                spatial_update: spatialUpdate,
                interaction_effects: interactionEffects,
                
                // Response
                user_response: interactionResponse,
                
                // Session state update
                session_state_updated: true,
                requires_rendering_update: interactionEffects.requires_render_update,
                
                // Performance impact
                processing_time_ms: interactionResult.processing_time_ms,
                spatial_accuracy: interactionResult.spatial_accuracy,
                interaction_confidence: interactionResult.confidence_score
            };
            
            this.emit('spatial-interaction-processed', {
                sessionId,
                sessionType,
                interactionType: interactionData.interaction_type,
                success: interactionResult.success
            });
            
            return spatialInteractionResult;
            
        } catch (error) {
            console.error(`Error processing spatial interaction for session ${sessionId}:`, error);
            throw error;
        }
    }
    
    // Utility and helper methods
    
    async initializeAREngine() {
        // Initialize AR processing capabilities (mock implementation)
        this.arEngine = {
            tracking_system: 'SLAM',
            supported_features: ['world_tracking', 'plane_detection', 'image_tracking', 'occlusion'],
            active: false
        };
        console.log('🎯 AR engine initialized');
    }
    
    async initializeVREngine() {
        // Initialize VR processing capabilities (mock implementation)
        this.vrEngine = {
            rendering_pipeline: 'Forward+',
            supported_headsets: ['Quest', 'Vive', 'Index'],
            active: false
        };
        console.log('🎮 VR engine initialized');
    }
    
    async initializeSpatialEngine() {
        // Initialize spatial computing capabilities (mock implementation)
        this.spatialEngine = {
            spatial_mapping: 'Real-time',
            gesture_recognition: 'Hand tracking',
            active: false
        };
        console.log('🌐 Spatial engine initialized');
    }
    
    async initializeRenderingEngine() {
        // Initialize 3D rendering engine (mock implementation)
        this.renderingEngine = {
            renderer: 'WebGL2',
            features: ['PBR', 'HDR', 'Post-processing'],
            active: false
        };
        console.log('🎨 Rendering engine initialized');
    }
    
    generateARSessionId(userId) {
        return 'AR_' + Date.now() + '_' + userId + '_' + crypto.randomBytes(4).toString('hex').toUpperCase();
    }
    
    generateVRSessionId(userId) {
        return 'VR_' + Date.now() + '_' + userId + '_' + crypto.randomBytes(4).toString('hex').toUpperCase();
    }
    
    /**
     * Get service health status
     */
    async getServiceHealthStatus() {
        try {
            const redisConnected = this.redis && this.redis.isReady;
            const arRedisConnected = this.arRedis && this.arRedis.isReady;
            const dbConnected = this.db && await this.db.ping();
            
            const activeARSessions = this.arSessions.size;
            const activeVRSessions = this.vrSessions.size;
            const totalSpatialAnchors = this.spatialAnchors.size;
            
            return {
                status: redisConnected && arRedisConnected && dbConnected ? 'healthy' : 'degraded',
                components: {
                    redis: redisConnected,
                    ar_redis: arRedisConnected,
                    database: dbConnected
                },
                ar_vr_systems: {
                    ar_enabled: this.arConfig.augmented_reality.enabled,
                    vr_enabled: this.arConfig.virtual_reality.enabled,
                    mixed_reality_enabled: this.arConfig.mixed_reality.enabled,
                    spatial_computing_enabled: this.spatialConfig.spatial_mapping.enabled
                },
                active_sessions: {
                    active_ar_sessions: activeARSessions,
                    active_vr_sessions: activeVRSessions,
                    total_spatial_anchors: totalSpatialAnchors,
                    gallery_3d_content: this.gallery3DContent.size
                },
                performance: {
                    ar_sessions_created: this.performanceMetrics.ar_sessions_created,
                    vr_sessions_created: this.performanceMetrics.vr_sessions_created,
                    total_3d_models_generated: this.performanceMetrics.total_3d_models_generated,
                    spatial_anchors_placed: this.performanceMetrics.spatial_anchors_placed,
                    user_interactions_processed: this.performanceMetrics.user_interactions_processed,
                    social_ar_sessions: this.performanceMetrics.social_ar_sessions
                },
                capabilities: {
                    supported_ar_platforms: this.arConfig.augmented_reality.supported_platforms.length,
                    supported_vr_headsets: this.arConfig.virtual_reality.supported_headsets.length,
                    supported_3d_formats: this.contentConfig.model_generation.supported_formats.length,
                    max_models_per_scene: this.contentConfig.scene_management.max_models_per_scene,
                    max_concurrent_users: this.galleryConfig.social_features.max_concurrent_users
                },
                device_support: {
                    mobile_ar_platforms: this.platformConfig.device_support.mobile_ar.length,
                    vr_headset_support: this.platformConfig.device_support.vr_headsets.length,
                    web_platform_support: this.platformConfig.device_support.web_platforms.length,
                    cross_platform_compatibility: this.platformConfig.compatibility.progressive_enhancement
                },
                cache: {
                    ar_sessions: this.arSessions.size,
                    vr_sessions: this.vrSessions.size,
                    spatial_anchors: this.spatialAnchors.size,
                    device_capabilities: this.deviceCapabilities.size,
                    user_experiences: this.userExperiences.size
                },
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'error',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    /**
     * Shutdown service gracefully
     */
    async shutdown() {
        try {
            console.log('🔄 Shutting down Augmented Reality Gallery Service...');
            
            // End all active AR sessions
            for (const [sessionId, session] of this.arSessions) {
                await this.endARSession(sessionId, 'system_shutdown');
            }
            
            // End all active VR sessions
            for (const [sessionId, session] of this.vrSessions) {
                await this.endVRSession(sessionId, 'system_shutdown');
            }
            
            // Clear caches and data structures
            this.arSessions.clear();
            this.vrSessions.clear();
            this.spatialAnchors.clear();
            this.gallery3DContent.clear();
            this.userExperiences.clear();
            this.deviceCapabilities.clear();
            this.performanceMetrics.clear();
            this.arStreams.clear();
            this.spatialStreams.clear();
            this.socialStreams.clear();
            
            if (this.redis) {
                await this.redis.disconnect();
            }
            
            if (this.arRedis) {
                await this.arRedis.disconnect();
            }
            
            if (this.db) {
                await this.db.end();
            }
            
            this.removeAllListeners();
            
            console.log('✅ Augmented Reality Gallery Service shutdown complete');
        } catch (error) {
            console.error('Error during service shutdown:', error);
        }
    }
}

module.exports = AugmentedRealityService;