/**
 * Content Moderation Service with Usage Intent & Auto-Moderation Rules
 * Handles the refined workflow for model uploads with flexible approval system
 */

const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');

class ContentModerationService {
    constructor(dbConnection) {
        this.db = dbConnection;
        this.baseUploadPath = path.join(__dirname, '../../public/uploads');
        this.rules = new Map(); // Cache for moderation rules
    }

    /**
     * Get webhook URL for BLIP data delivery
     * 🚨 DEV ONLY: Uses ngrok for local development
     * 🚨 TODO: Remove ngrok logic before production deployment
     */
    getWebhookUrl() {
        // 🚨 DEVELOPMENT ONLY - REMOVE BEFORE PRODUCTION 🚨
        if (process.env.NODE_ENV !== 'production') {
            // Check for ngrok URL first (for local development)
            if (process.env.NGROK_URL) {
                const webhookUrl = `${process.env.NGROK_URL}/api/blip/webhook`;
                console.log('🚨 DEV MODE: Using ngrok URL for webhooks:', webhookUrl);
                return webhookUrl;
            }
            
            // Fallback: disable webhooks in local dev if no ngrok
            console.log('⚠️ DEV MODE: No NGROK_URL set - webhooks disabled');
            return null;
        }
        // 🚨 END DEVELOPMENT ONLY SECTION 🚨
        
        // Production webhook URL
        const baseUrl = process.env.WEBHOOK_BASE_URL || 'https://musenest.com';
        return `${baseUrl}/api/blip/webhook`;
    }

    /**
     * Load moderation rules from database for specific usage intent
     */
    async loadModerationRules(usageIntent) {
        try {
            const [rules] = await this.db.execute(
                'SELECT * FROM moderation_rules_config WHERE usage_intent = ? AND is_active = TRUE',
                [usageIntent]
            );

            const ruleSet = {};
            rules.forEach(rule => {
                let ruleValue;
                try {
                    // Handle both JSON string and object formats
                    if (typeof rule.rule_value === 'string') {
                        ruleValue = JSON.parse(rule.rule_value);
                    } else if (typeof rule.rule_value === 'object') {
                        ruleValue = rule.rule_value;
                    } else {
                        console.warn(`Invalid rule value format for ${rule.rule_name}:`, rule.rule_value);
                        ruleValue = {};
                    }
                } catch (parseError) {
                    console.error(`Failed to parse rule value for ${rule.rule_name}:`, parseError.message);
                    ruleValue = {};
                }
                
                ruleSet[rule.rule_name] = {
                    type: rule.rule_type,
                    value: ruleValue
                };
            });

            this.rules.set(usageIntent, ruleSet);
            return ruleSet;
        } catch (error) {
            console.error('Error loading moderation rules:', error);
            return this.getDefaultRules(usageIntent);
        }
    }

    /**
     * Get default rules if database rules fail
     */
    getDefaultRules(usageIntent) {
        const defaultRules = {
            public_site: {
                nudity_threshold: { type: 'nudity_threshold', value: { max_confidence: 20, auto_flag: true } },
                blocked_labels: { type: 'blocked_labels', value: ['GENITALIA', 'SEXUAL_ACTIVITY', 'ANUS_EXPOSED'] },
                auto_approve_threshold: { type: 'auto_approve', value: { max_confidence: 10, allowed_labels: ['COVERED', 'CLOTHED'] } }
            },
            paysite: {
                nudity_threshold: { type: 'nudity_threshold', value: { max_confidence: 80, auto_flag: true } },
                blocked_labels: { type: 'blocked_labels', value: ['SEXUAL_ACTIVITY', 'ILLEGAL_CONTENT'] },
                auto_approve_threshold: { type: 'auto_approve', value: { max_confidence: 60, allowed_labels: ['BREAST_EXPOSED', 'BUTTOCKS_EXPOSED'] } }
            },
            store: {
                nudity_threshold: { type: 'nudity_threshold', value: { max_confidence: 90, auto_flag: true } },
                blocked_labels: { type: 'blocked_labels', value: ['ILLEGAL_CONTENT', 'VIOLENCE'] },
                auto_approve_threshold: { type: 'auto_approve', value: { max_confidence: 85, allowed_labels: ['GENITALIA', 'BREAST_EXPOSED', 'BUTTOCKS_EXPOSED'] } }
            },
            private: {
                nudity_threshold: { type: 'nudity_threshold', value: { max_confidence: 95, auto_flag: false } },
                blocked_labels: { type: 'blocked_labels', value: ['ILLEGAL_CONTENT'] },
                auto_approve_threshold: { type: 'auto_approve', value: { max_confidence: 95, allowed_labels: ['*'] } }
            }
        };

        return defaultRules[usageIntent] || defaultRules.public_site;
    }

    /**
     * Create folder structure for a model
     */
    async createModelFolderStructure(modelSlug) {
        const modelPath = path.join(this.baseUploadPath, modelSlug);
        const folders = ['originals', 'thumbs', 'public', 'public/blurred', 'paysite', 'store', 'rejected', 'private'];

        try {
            for (const folder of folders) {
                const folderPath = path.join(modelPath, folder);
                await fs.mkdir(folderPath, { recursive: true });
            }
            console.log(`Folder structure created for model: ${modelSlug}`);
            return true;
        } catch (error) {
            console.error('Error creating folder structure:', error);
            return false;
        }
    }

    /**
     * Process uploaded image through moderation workflow
     */
    async processUploadedImage(imageData) {
        const {
            filePath,
            originalName,
            modelId,
            modelSlug,
            usageIntent = 'public_site',
            contextType = 'public_gallery'
        } = imageData;

        console.log('ContentModerationService processing:', { 
            filePath, 
            originalName, 
            modelId, 
            modelSlug, 
            usageIntent, 
            contextType 
        });

        // Validate required fields
        if (!modelSlug) {
            throw new Error('modelSlug is required for processing');
        }
        if (!modelId) {
            throw new Error('modelId is required for processing');
        }
        if (!filePath) {
            throw new Error('filePath is required for processing');
        }
        if (!originalName) {
            throw new Error('originalName is required for processing');
        }

        try {
            // 1. Ensure folder structure exists
            await this.createModelFolderStructure(modelSlug);

            // 2. Move file to originals folder
            const originalPath = await this.moveToOriginals(filePath, modelSlug, originalName);

            // 3. Get AI analysis
            const aiAnalysis = await this.analyzeWithNudeNet(originalPath, contextType, modelId);

            // 4. Apply auto-moderation rules
            const moderationResult = await this.applyModerationRules(aiAnalysis, usageIntent);

            // 5. Store in database
            const contentModerationId = await this.storeModerationResult({
                ...moderationResult,
                originalPath,
                modelId,
                usageIntent,
                contextType,
                image_path: originalPath // Ensure image_path is set
            });

            // 6. Handle flagged content
            if (moderationResult.flagged) {
                await this.handleFlaggedContent(contentModerationId, {
                    ...moderationResult,
                    modelId
                });
            }

            // 7. Process approved content
            if (moderationResult.moderation_status === 'approved') {
                await this.processApprovedContent(contentModerationId, originalPath, modelSlug, usageIntent);
            }

            return {
                success: true,
                contentModerationId,
                ...moderationResult
            };

        } catch (error) {
            console.error('Error processing uploaded image:', error);
            return {
                success: false,
                error: error.message,
                moderation_status: 'error'
            };
        }
    }

    /**
     * Move uploaded file to originals folder
     */
    async moveToOriginals(tempFilePath, modelSlug, originalName) {
        const timestamp = Date.now();
        const ext = path.extname(originalName);
        const baseName = path.basename(originalName, ext);
        const newFileName = `${timestamp}_${baseName}${ext}`;
        const originalPath = path.join(this.baseUploadPath, modelSlug, 'originals', newFileName);

        await fs.rename(tempFilePath, originalPath);
        return originalPath;
    }

    /**
     * Analyze image with Enhanced MediaPipe API (NudeNet + Pose Analysis)
     */
    async analyzeWithNudeNet(imagePath, contextType, modelId) {
        console.log(`🚀 Starting enhanced analysis for image: ${imagePath}`);
        console.log(`📡 Target: 18.221.22.72:5000/analyze`);
        
        return new Promise((resolve, reject) => {
            const FormData = require('form-data');
            const fs = require('fs');
            const http = require('http');
            
            // Create form data for enhanced API
            const form = new FormData();
            form.append('image', fs.createReadStream(imagePath));
            form.append('context_type', contextType);
            form.append('model_id', modelId.toString());
            
            // Add webhook URL for automatic BLIP delivery
            const webhookUrl = this.getWebhookUrl();
            if (webhookUrl) {
                form.append('webhook_url', webhookUrl);
                console.log(`📡 Webhook URL provided: ${webhookUrl}`);
            } else {
                console.log('⚠️ No webhook URL configured - BLIP data will need manual retrieval');
            }

            console.log(`📝 Form data prepared: context_type=${contextType}, model_id=${modelId}`);
            console.log(`📡 Webhook URL: ${webhookUrl || 'NONE'}`);
            console.log(`🚀 Sending request to EC2 server...`);
            
            const startTime = Date.now();
            
            // Send to enhanced MediaPipe API with proper connection handling
            const req = http.request({
                hostname: '18.221.22.72',
                port: 5000,
                path: '/analyze',
                method: 'POST',
                headers: {
                    ...form.getHeaders(),
                    'Connection': 'close',
                    'Keep-Alive': 'timeout=5, max=1'
                },
                timeout: 10000, // 10 second timeout
                agent: false // Don't use connection pooling
            }, (res) => {
                const responseTime = Date.now() - startTime;
                console.log(`✅ Enhanced API response received in ${responseTime}ms`);
                console.log(`📊 Status: ${res.statusCode}, Content-Length: ${res.headers['content-length']}`);
                
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    const totalTime = Date.now() - startTime;
                    console.log(`🏁 Complete response received in ${totalTime}ms, size: ${data.length} bytes`);
                    console.log(`📄 Raw response preview: ${data.substring(0, 500)}...`);
                    
                    try {
                        const result = JSON.parse(data);
                        console.log(`✅ JSON parsed successfully, success: ${result.success}`);
                        
                        // Check if this is a valid response (either has success=true OR has batch_id + detected_parts)
                        const isValidResponse = result.success === true || 
                                              (result.batch_id && result.detected_parts);
                        
                        console.log(`🔍 Response validation: isValid=${isValidResponse}, hasBatchId=${!!result.batch_id}, hasDetectedParts=${!!result.detected_parts}`);
                        
                        if (isValidResponse) {
                            console.log('🎯 Transforming enhanced API response...');
                            
                            // DEBUG: Log the complete raw API response structure
                            console.log('🔍 DEBUG - Complete API response structure:');
                            console.log(JSON.stringify(result, null, 2));
                            
                            // Log key response data for debugging (v3.0 format)
                            const nudityScore = result.image_analysis?.nudity_detection?.nudity_score;
                            const faceCount = result.image_analysis?.face_analysis?.face_count;
                            const minAge = result.image_analysis?.face_analysis?.min_age;
                            const riskLevel = result.image_analysis?.combined_assessment?.risk_level;
                            const imageDescription = result.image_analysis?.image_description;
                            
                            console.log(`📊 Raw API results: nudity=${nudityScore}, faces=${faceCount}, minAge=${minAge}, risk=${riskLevel}`);
                            console.log(`📝 Image description found:`, imageDescription);
                            
                            // Transform enhanced API response to match expected format
                            const transformedResult = this.transformEnhancedResponse(result);
                            console.log(`✅ Transformation complete, final nudity score: ${transformedResult.nudity_score}`);
                            console.log(`🎭 Pose analysis: ${transformedResult.pose_category} (${transformedResult.explicit_pose_score})`);
                            console.log(`🔍 Debug - Full transformed result keys:`, Object.keys(transformedResult));
                            console.log(`🔍 Debug - Pose analysis data:`, transformedResult.pose_analysis);
                            console.log(`🔍 Debug - Combined assessment:`, transformedResult.combined_assessment);
                            
                            resolve(transformedResult);
                        } else {
                            console.error('❌ Enhanced API returned success: false');
                            console.error('Full API response:', JSON.stringify(result, null, 2));
                            console.error('Error details:', result.error);
                            const errorMessage = result.error || 'Enhanced analysis failed - no error details provided';
                            reject(new Error(errorMessage));
                        }
                    } catch (parseError) {
                        console.error('❌ JSON parse error:', parseError.message);
                        console.error('Raw response preview:', data.substring(0, 300) + '...');
                        reject(new Error('Failed to parse enhanced analysis response'));
                    }
                });
            });

            req.on('error', (error) => {
                const errorTime = Date.now() - startTime;
                console.error(`❌ Enhanced API request error after ${errorTime}ms:`, error.message);
                console.error(`Error details: code=${error.code}, syscall=${error.syscall}`);
                console.log('🚨 FALLING BACK TO CONSERVATIVE ANALYSIS');
                
                // Fallback to basic analysis when enhanced API is unavailable
                this.fallbackToBasicAnalysis(imagePath, contextType, modelId)
                    .then(result => {
                        console.log('✅ Fallback analysis completed');
                        resolve(result);
                    })
                    .catch(fallbackError => {
                        console.error('❌ Fallback analysis also failed:', fallbackError);
                        reject(new Error(`Both enhanced and fallback analysis failed: ${error.message}`));
                    });
            });

            req.on('timeout', () => {
                const timeoutTime = Date.now() - startTime;
                console.log(`⏰ Enhanced API timeout after ${timeoutTime}ms`);
                req.destroy();
                console.log('🚨 FALLING BACK TO CONSERVATIVE ANALYSIS');
                
                // Fallback to basic analysis when enhanced API times out
                this.fallbackToBasicAnalysis(imagePath, contextType, modelId)
                    .then(result => {
                        console.log('✅ Fallback analysis completed after timeout');
                        resolve(result);
                    })
                    .catch(fallbackError => {
                        console.error('❌ Fallback analysis also failed:', fallbackError);
                        reject(new Error(`Enhanced API timeout and fallback failed: ${fallbackError.message}`));
                    });
            });

            // Add connection tracking
            req.on('socket', (socket) => {
                console.log('🔌 Socket assigned for enhanced API request');
                
                socket.on('connect', () => {
                    console.log('🌐 Socket connected to EC2');
                });
                
                socket.on('timeout', () => {
                    console.log('⏰ Socket timeout occurred');
                });
            });

            console.log('📤 Sending form data to enhanced API...');
            form.pipe(req);
        });
    }

    /**
     * Fallback to basic NudeNet analysis when enhanced API is unavailable
     */
    async fallbackToBasicAnalysis(imagePath, contextType, modelId) {
        console.log('🚨 Using HARDCODED conservative fallback - NO ACTUAL IMAGE ANALYSIS');
        
        // Return a conservative analysis structure that flags for review
        // When enhanced API is unavailable, be extremely conservative
        return {
            detected_parts: { 'FALLBACK_ANALYSIS': 95.0 },
            part_locations: {},
            nudity_score: 95.0, // High score to trigger moderation rules
            has_nudity: true, // Assume nudity present to be safe
            
            // Fallback fields  
            pose_analysis: {
                pose_detected: false,
                pose_category: 'enhanced_api_unavailable',
                suggestive_score: 0,
                details: { reasoning: ['NO_REAL_ANALYSIS_PERFORMED', 'enhanced_api_unreachable'] }
            },
            combined_assessment: {
                final_risk_score: 95.0,
                risk_level: 'high',
                reasoning: ['HARDCODED_CONSERVATIVE_RESPONSE', 'EC2_API_UNREACHABLE']
            },
            moderation_decision: {
                status: 'flagged_for_review',
                action: 'require_human_review',
                human_review_required: true
            },
            
            // Legacy compatibility
            success: true,
            analysis_version: 'FALLBACK_NO_ANALYSIS',
            warning: 'Enhanced MediaPipe API unavailable - using conservative hardcoded response'
        };
    }

    /**
     * Validate pose analysis to catch AI hallucinations
     * @param {Object} poseAnalysis - Raw pose analysis from AI
     * @param {Object} nudityDetection - Nudity detection results for context
     * @returns {Object} Validated pose analysis
     */
    validatePoseAnalysis(poseAnalysis, nudityDetection) {
        if (!poseAnalysis || !poseAnalysis.pose_detected) {
            return poseAnalysis;
        }

        // Check if only face/head parts detected (indicates close-up)
        const detectedParts = nudityDetection.detected_parts || {};
        const partTypes = Object.keys(detectedParts);
        const onlyFaceDetected = partTypes.length === 1 && 
                                partTypes[0].includes('FACE');

        // If only face detected but AI claims pose detection, it's likely a false positive
        if (onlyFaceDetected && poseAnalysis.pose_detected) {
            console.log('⚠️ Pose validation: Detected face-only with pose claims - likely AI hallucination');
            
            return {
                ...poseAnalysis,
                pose_detected: false,
                pose_category: 'face_only_no_pose',
                suggestive_score: 0,
                details: {
                    ...poseAnalysis.details,
                    reasoning: ['face_only_image_no_body_visible'],
                    validation_override: 'pose_detection_disabled_for_face_only_image'
                },
                raw_metrics: {
                    ...poseAnalysis.raw_metrics,
                    validation_note: 'Original metrics ignored due to face-only detection'
                }
            };
        }

        // Additional validation: Check for unrealistic pose metrics
        const metrics = poseAnalysis.raw_metrics;
        if (metrics && (
            metrics.leg_spread > 0.8 ||  // Extremely wide leg spread unlikely
            metrics.hip_bend_angle > 5   // Extreme hip angles unlikely
        )) {
            console.log('⚠️ Pose validation: Detected extreme pose metrics - may be AI error');
            
            return {
                ...poseAnalysis,
                pose_category: 'uncertain_pose_detection',
                details: {
                    ...poseAnalysis.details,
                    reasoning: [...(poseAnalysis.details?.reasoning || []), 'extreme_metrics_detected'],
                    validation_warning: 'Pose metrics appear unrealistic'
                }
            };
        }

        return poseAnalysis;
    }

    /**
     * Create structured fallback when server returns analysis errors
     */
    createStructuredFallback() {
        return {
            // Conservative nudity analysis
            detected_parts: { 'SERVER_ANALYSIS_ERROR': 95.0 },
            part_locations: {},
            nudity_score: 95.0,
            has_nudity: true,
            
            // Face analysis simulation
            face_analysis: {
                faces_detected: false,
                face_count: 0,
                min_age: null,
                underage_detected: false,
                simulation_note: 'Server NudeNet analysis failed'
            },
            face_count: 0,
            min_detected_age: null,
            max_detected_age: null,
            underage_detected: false,
            age_risk_multiplier: 1.0,
            
            // Image description fallback
            image_description: {
                description: 'Image analysis failed on server',
                tags: [],
                generation_method: 'server_error_fallback'
            },
            description_text: 'Analysis unavailable due to server error',
            description_tags: [],
            contains_children: false,
            description_risk: 0.0,
            
            // Risk assessment
            final_risk_score: 95.0,
            risk_level: 'critical',
            risk_reasoning: ['SERVER_ANALYSIS_ERROR', 'CONSERVATIVE_FALLBACK_APPLIED'],
            
            // Pose analysis compatibility
            pose_analysis: {
                pose_detected: false,
                pose_category: 'server_analysis_error',
                suggestive_score: 0,
                details: { reasoning: ['SERVER_NUDENET_FAILED', 'using_conservative_fallback'] }
            },
            
            // Combined assessment
            combined_assessment: {
                final_risk_score: 95.0,
                risk_level: 'critical',
                reasoning: ['SERVER_ANALYSIS_ERROR', 'NUDENET_FAILED_ON_EC2']
            },
            
            // Moderation decision
            moderation_decision: {
                status: 'flagged_for_review',
                action: 'require_human_review',
                human_review_required: true
            },
            moderation_status: 'flagged',
            human_review_required: true,
            flagged: true,
            auto_rejected: false,
            rejection_reason: null,
            
            // Metadata
            success: true,
            analysis_version: 'server_error_fallback'
        };
    }

    /**
     * Transform webhook-style response (flat structure) to v3 format
     */
    transformWebhookResponse(webhookResult) {
        return {
            // NudeNet results from webhook
            detected_parts: webhookResult.detected_parts || {},
            part_locations: webhookResult.part_locations || {},
            nudity_score: webhookResult.nudity_score || 0,
            has_nudity: webhookResult.nudity_score > 30,
            
            // Simulated face analysis (webhook doesn't include face data yet)
            face_analysis: {
                faces_detected: false,
                face_count: 0,
                min_age: null,
                underage_detected: false,
                simulation_note: 'Face analysis pending - BLIP webhook will follow'
            },
            face_count: 0,
            min_detected_age: null,
            max_detected_age: null,
            underage_detected: false,
            age_risk_multiplier: 1.0,
            
            // Image description placeholder (BLIP webhook will follow)
            image_description: {
                description: 'BLIP analysis in progress via webhook',
                tags: [],
                generation_method: 'webhook_pending',
                batch_id: webhookResult.batch_id
            },
            description_text: 'BLIP description will arrive via webhook',
            description_tags: [],
            contains_children: false,
            description_risk: 0.0,
            
            // Risk assessment from webhook
            final_risk_score: webhookResult.final_risk_score || webhookResult.nudity_score || 0,
            risk_level: webhookResult.risk_level || 'unknown',
            risk_reasoning: ['webhook_nudity_analysis', `batch_id_${webhookResult.batch_id}`],
            
            // Combined assessment placeholder
            combined_assessment: {
                final_risk_score: webhookResult.final_risk_score || webhookResult.nudity_score || 0,
                risk_level: webhookResult.risk_level || 'unknown',
                reasoning: ['webhook_response', 'blip_analysis_pending'],
                batch_id: webhookResult.batch_id
            },
            
            // Pose analysis compatibility
            pose_analysis: {
                pose_detected: false,
                pose_category: 'webhook_analysis_pending',
                suggestive_score: 0,
                details: { 
                    reasoning: ['webhook_nudity_complete', 'blip_pending'],
                    batch_id: webhookResult.batch_id
                }
            },
            
            // Moderation decision
            moderation_decision: {
                status: webhookResult.moderation_status || 'pending',
                action: webhookResult.human_review_required ? 'require_human_review' : 'auto_approve',
                human_review_required: webhookResult.human_review_required || false
            },
            moderation_status: webhookResult.moderation_status || 'pending',
            human_review_required: webhookResult.human_review_required || false,
            flagged: webhookResult.flagged || false,
            auto_rejected: false,
            rejection_reason: null,
            
            // Webhook metadata
            batch_id: webhookResult.batch_id,
            success: true,
            analysis_version: 'webhook_v3_with_blip_pending'
        };
    }

    /**
     * Transform v1 API response to clean format (no legacy compatibility)
     */
    transformEnhancedResponse(enhancedResult) {
        // Check if this is an analysis error response
        if (enhancedResult.image_analysis?.nudity_detection?.detected_parts?.ANALYSIS_ERROR) {
            console.log('🚨 Server returned ANALYSIS_ERROR - using structured fallback');
            return this.createStructuredFallback();
        }

        // Check if this is a webhook-style response (flat structure)
        if (enhancedResult.batch_id && enhancedResult.detected_parts && !enhancedResult.image_analysis) {
            console.log('🔄 Detected webhook-style response - transforming to v3 structure');
            return this.transformWebhookResponse(enhancedResult);
        }

        const analysis = enhancedResult.image_analysis;
        const nudityDetection = analysis?.nudity_detection;
        const faceAnalysis = analysis?.face_analysis;
        const imageDescription = analysis?.image_description;
        const combinedAssessment = analysis?.combined_assessment;
        const decision = enhancedResult.moderation_decision;

        // Process nudity detection results
        const detectedParts = {};
        const partLocations = {};
        let maxNudityScore = 0;

        if (nudityDetection?.detected_parts) {
            Object.entries(nudityDetection.detected_parts).forEach(([part, confidence]) => {
                detectedParts[part] = confidence;
                maxNudityScore = Math.max(maxNudityScore, confidence);
                
                if (nudityDetection.part_locations?.[part]) {
                    partLocations[part] = nudityDetection.part_locations[part];
                } else {
                    partLocations[part] = {
                        x: 0, y: 0, width: 100, height: 100, confidence: confidence
                    };
                }
            });
        }

        // Extract image description details
        const descriptionText = imageDescription?.description || 'No description available';
        const descriptionTags = imageDescription?.tags || [];
        const containsChildren = this.checkForChildrenInDescription(descriptionText, descriptionTags);

        return {
            // NudeNet results
            detected_parts: detectedParts,
            part_locations: partLocations,
            nudity_score: maxNudityScore,
            has_nudity: nudityDetection?.has_nudity || false,
            
            // Face analysis results
            face_analysis: faceAnalysis,
            face_count: faceAnalysis?.face_count || 0,
            min_detected_age: faceAnalysis?.min_age,
            max_detected_age: faceAnalysis?.max_age,
            underage_detected: faceAnalysis?.underage_detected || false,
            age_risk_multiplier: combinedAssessment?.age_risk_multiplier || 1.0,
            
            // Image description results
            image_description: imageDescription,
            description_text: descriptionText,
            description_tags: descriptionTags,
            contains_children: containsChildren,
            description_risk: combinedAssessment?.description_risk || 0.0,
            
            // Risk assessment
            final_risk_score: combinedAssessment?.final_risk_score || 0,
            risk_level: combinedAssessment?.risk_level || 'unknown',
            risk_reasoning: combinedAssessment?.reasoning || [],
            
            // Combined assessment (for display compatibility)
            combined_assessment: combinedAssessment,
            
            // Pose analysis compatibility (map from face analysis)
            pose_analysis: {
                pose_detected: faceAnalysis?.faces_detected || false,
                pose_category: faceAnalysis?.underage_detected ? 'underage_detected' : 'age_verified',
                suggestive_score: 0,
                details: {
                    reasoning: [`face_analysis_${faceAnalysis?.face_count || 0}_faces`],
                    min_age: faceAnalysis?.min_age,
                    face_count: faceAnalysis?.face_count || 0
                }
            },
            
            // Moderation decision
            moderation_decision: decision,
            moderation_status: decision?.status || 'pending',
            auto_rejected: decision?.status === 'auto_rejected',
            rejection_reason: decision?.rejection_reason || null,
            
            // Metadata
            success: true,
            analysis_version: enhancedResult.metadata?.analysis_version || 'v3_real_analysis'
        };
    }

    /**
     * Check if image description indicates presence of children
     */
    checkForChildrenInDescription(description, tags) {
        const childKeywords = [
            'child', 'children', 'kid', 'kids', 'baby', 'babies', 'toddler', 'infant',
            'boy', 'girl', 'daughter', 'son', 'student', 'school', 'playground',
            'mother with child', 'father with child', 'family with children'
        ];
        
        const descriptionLower = description.toLowerCase();
        const allTags = tags.map(tag => tag.toLowerCase());
        
        // Check description text
        const hasChildKeyword = childKeywords.some(keyword => 
            descriptionLower.includes(keyword)
        );
        
        // Check tags
        const hasChildTag = childKeywords.some(keyword =>
            allTags.includes(keyword)
        );
        
        return hasChildKeyword || hasChildTag;
    }

    /**
     * Apply moderation rules based on usage intent
     */
    async applyModerationRules(aiAnalysis, usageIntent) {
        const rules = this.rules.get(usageIntent) || await this.loadModerationRules(usageIntent);
        
        const result = {
            ...aiAnalysis,
            usage_intent: usageIntent,
            flagged: false,
            auto_blocked: false,
            human_review_required: false,
            final_location: 'originals'
        };

        // Check nudity threshold
        if (rules.nudity_threshold) {
            const threshold = rules.nudity_threshold.value.max_confidence;
            const autoFlag = rules.nudity_threshold.value.auto_flag;
            
            if (result.nudity_score > threshold && autoFlag) {
                result.flagged = true;
                result.auto_blocked = true;
                result.human_review_required = true;
                result.moderation_status = 'flagged';
            }
        }

        // Check blocked labels
        if (rules.blocked_labels && result.detected_parts) {
            const blockedLabels = rules.blocked_labels.value;
            const detectedLabels = Object.keys(result.detected_parts);
            
            const hasBlockedLabel = detectedLabels.some(label => 
                blockedLabels.includes(label.toUpperCase()) || 
                blockedLabels.includes(this.mapDetectionToLabel(label))
            );

            if (hasBlockedLabel) {
                result.flagged = true;
                result.auto_blocked = true;
                result.human_review_required = true;
                result.moderation_status = 'flagged';
            }
        }

        // Auto-approve if within threshold
        if (!result.flagged && rules.auto_approve_threshold) {
            const autoApprove = rules.auto_approve_threshold.value;
            if (result.nudity_score <= autoApprove.max_confidence) {
                result.moderation_status = 'approved';
                result.final_location = this.getFinalLocation(usageIntent);
            }
        }

        // Default to flagged for manual review if not auto-approved
        if (!result.moderation_status) {
            result.flagged = true;
            result.human_review_required = true;
            result.moderation_status = 'flagged';
        }

        return result;
    }

    /**
     * Map AI detection labels to standardized labels
     */
    mapDetectionToLabel(detection) {
        const mapping = {
            'genitalia': 'GENITALIA',
            'breasts': 'BREAST_EXPOSED',
            'buttocks': 'BUTTOCKS_EXPOSED',
            'anus': 'ANUS_EXPOSED'
        };
        return mapping[detection.toLowerCase()] || detection.toUpperCase();
    }

    /**
     * Get final location based on usage intent
     */
    getFinalLocation(usageIntent) {
        const locationMap = {
            'public_site': 'public',
            'paysite': 'paysite',
            'store': 'store',
            'private': 'private'
        };
        return locationMap[usageIntent] || 'originals';
    }

    /**
     * Store moderation result in database with timeout handling
     */
    async storeModerationResult(data) {
        console.log('💾 Storing moderation result in database...');
        const startTime = Date.now();
        
        const query = `
            INSERT INTO content_moderation (
                image_path, original_path, model_id, context_type, usage_intent,
                nudity_score, detected_parts, part_locations, has_nudity,
                face_analysis, face_count, min_detected_age, max_detected_age, 
                underage_detected, age_risk_multiplier,
                image_description, description_text, description_tags, 
                contains_children, description_risk,
                final_risk_score, risk_level, risk_reasoning,
                moderation_status, human_review_required, flagged, 
                auto_rejected, rejection_reason, confidence_score, final_location
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            data.image_path || data.originalPath || '',
            data.originalPath || data.image_path || '',
            data.modelId || null,
            data.contextType || '',
            data.usageIntent || '',
            data.nudity_score || 0,
            JSON.stringify(data.detected_parts || {}),
            JSON.stringify(data.part_locations || {}),
            data.has_nudity ? 1 : 0,
            JSON.stringify(data.face_analysis || {}),
            data.face_count || 0,
            data.min_detected_age || null,
            data.max_detected_age || null,
            data.underage_detected ? 1 : 0,
            data.age_risk_multiplier || 1.0,
            JSON.stringify(data.image_description || {}),
            data.description_text || '',
            JSON.stringify(data.description_tags || []),
            data.contains_children ? 1 : 0,
            data.description_risk || 0.0,
            data.final_risk_score || null,
            data.risk_level || '',
            JSON.stringify(data.risk_reasoning || []),
            data.moderation_status || 'pending',
            data.human_review_required ? 1 : 0,
            data.flagged ? 1 : 0,
            data.auto_rejected ? 1 : 0,
            data.rejection_reason || '',
            data.confidence_score || 0,
            data.final_location || 'originals'
        ];

        try {
            // Get dedicated connection from pool for this operation
            const connection = await this.db.pool.getConnection();
            console.log('🔌 Got dedicated database connection');
            
            try {
                const executePromise = connection.execute(query, values);
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Database insert timeout')), 5000);
                });
                
                const [result] = await Promise.race([executePromise, timeoutPromise]);
                const dbTime = Date.now() - startTime;
                console.log(`✅ Database insert completed in ${dbTime}ms`);
                return result.insertId;
            } finally {
                connection.release();
                console.log('🔌 Database connection released');
            }
        } catch (error) {
            const dbTime = Date.now() - startTime;
            console.error(`❌ Database insert failed after ${dbTime}ms:`, error.message);
            throw error;
        }
    }

    /**
     * Handle flagged content (add to moderation queue)
     */
    async handleFlaggedContent(contentModerationId, moderationResult) {
        console.log('📋 Adding flagged content to moderation queue...');
        const startTime = Date.now();
        
        const queueQuery = `
            INSERT INTO moderation_queue (
                content_moderation_id, priority, queue_type, model_id
            ) VALUES (?, ?, ?, ?)
        `;

        const priority = this.determinePriority(moderationResult);
        const queueType = moderationResult.auto_blocked ? 'auto_flagged' : 'manual_review';

        try {
            // Get dedicated connection for queue operation too
            const connection = await this.db.pool.getConnection();
            console.log('🔌 Got dedicated database connection for queue');
            
            try {
                const executePromise = connection.execute(queueQuery, [
                    contentModerationId,
                    priority,
                    queueType,
                    moderationResult.modelId
                ]);
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Queue insert timeout')), 3000);
                });
                
                await Promise.race([executePromise, timeoutPromise]);
                const queueTime = Date.now() - startTime;
                console.log(`✅ Queue insert completed in ${queueTime}ms`);
                console.log(`Content flagged and added to moderation queue: ${contentModerationId}`);
            } finally {
                connection.release();
                console.log('🔌 Queue database connection released');
            }
        } catch (error) {
            const queueTime = Date.now() - startTime;
            console.error(`❌ Queue insert failed after ${queueTime}ms:`, error.message);
            throw error;
        }
    }

    /**
     * Determine priority based on analysis results
     */
    determinePriority(moderationResult) {
        if (moderationResult.nudity_score > 90) return 'urgent';
        if (moderationResult.nudity_score > 70) return 'high';
        if (moderationResult.nudity_score > 40) return 'medium';
        return 'low';
    }

    /**
     * Process approved content (create symlinks/copies)
     */
    async processApprovedContent(contentModerationId, originalPath, modelSlug, usageIntent) {
        const finalLocation = this.getFinalLocation(usageIntent);
        const finalFolder = path.join(this.baseUploadPath, modelSlug, finalLocation);
        const fileName = path.basename(originalPath);
        const finalPath = path.join(finalFolder, fileName);

        try {
            // Create symbolic link (or copy if symlink fails)
            try {
                await fs.symlink(originalPath, finalPath);
            } catch (symlinkError) {
                await fs.copyFile(originalPath, finalPath);
            }

            // Update database with final path
            await this.db.execute(
                'UPDATE content_moderation SET image_path = ? WHERE id = ?',
                [finalPath, contentModerationId]
            );

            console.log(`Approved content processed: ${finalPath}`);
        } catch (error) {
            console.error('Error processing approved content:', error);
        }
    }

    /**
     * Create appeal for flagged content
     */
    async createAppeal(contentModerationId, modelId, appealData) {
        const { reason, message } = appealData;

        const query = `
            INSERT INTO moderation_appeals (
                content_moderation_id, model_id, appeal_reason, appeal_message
            ) VALUES (?, ?, ?, ?)
        `;

        const [result] = await this.db.query(query, [
            contentModerationId,
            modelId,
            reason,
            message
        ]);

        // Update content moderation record
        await this.db.execute(
            'UPDATE content_moderation SET appeal_requested = TRUE WHERE id = ?',
            [contentModerationId]
        );

        // Add to appeal queue
        await this.db.execute(
            `INSERT INTO moderation_queue (
                content_moderation_id, appeal_id, priority, queue_type, model_id
            ) VALUES (?, ?, ?, ?, ?)`,
            [contentModerationId, result.insertId, 'medium', 'appeal', modelId]
        );

        return result.insertId;
    }

    /**
     * Admin approval with blur
     */
    async approveWithBlur(contentModerationId, blurSettings, adminNotes, reviewedBy) {
        // TODO: Generate blurred version using blur settings
        const blurredPath = await this.generateBlurredVersion(contentModerationId, blurSettings);

        await this.db.execute(`
            UPDATE content_moderation 
            SET moderation_status = 'approved',
                blur_settings = ?,
                blurred_path = ?,
                final_location = 'public_blurred',
                admin_notes = ?,
                reviewed_by = ?,
                reviewed_at = NOW()
            WHERE id = ?
        `, [
            JSON.stringify(blurSettings),
            blurredPath,
            adminNotes,
            reviewedBy,
            contentModerationId
        ]);

        // Remove from moderation queue
        await this.db.execute(
            'DELETE FROM moderation_queue WHERE content_moderation_id = ?',
            [contentModerationId]
        );
    }

    /**
     * Generate blurred version using Sharp with Gaussian blur
     */
    async generateBlurredVersion(contentModerationId, blurSettings) {
        const sharp = require('sharp');
        const fsPromises = require('fs').promises;
        
        try {
            // Get content moderation record with model information
            const [content] = await this.db.execute(`
                SELECT cm.original_path, m.name as model_name, m.slug as model_slug 
                FROM content_moderation cm 
                JOIN models m ON cm.model_id = m.id 
                WHERE cm.id = ?
            `, [contentModerationId]);

            if (!content[0]) {
                throw new Error('Content moderation record not found');
            }

            const { original_path: originalPath, model_name: modelName, model_slug: modelSlug } = content[0];
            
            if (!originalPath) {
                throw new Error('No original path found');
            }

            // Check if original file exists
            try {
                await fsPromises.access(originalPath);
            } catch {
                throw new Error(`Original file not accessible: ${originalPath}`);
            }

            // Create blurred file name and path
            const fileName = path.basename(originalPath);
            const blurredFileName = `blurred_${Date.now()}_${fileName}`;
            const blurredDir = path.join(this.baseUploadPath, modelSlug, 'public', 'blurred');
            const blurredPath = path.join(blurredDir, blurredFileName);

            // Ensure directory exists
            await fsPromises.mkdir(blurredDir, { recursive: true });

            console.log('Creating blurred version with settings:', blurSettings);
            console.log('Original path:', originalPath);
            console.log('Output path:', blurredPath);

            // Get image metadata to handle orientation
            const rawImage = sharp(originalPath, { autoRotate: false });
            const rawMetadata = await rawImage.metadata();
            
            console.log('Raw image dimensions:', rawMetadata.width, 'x', rawMetadata.height, 'orientation:', rawMetadata.orientation);
            
            // Process blur using EXIF-stripped coordinates (matching NudeNet detection space)
            console.log('🔄 Processing blur in EXIF-stripped coordinate system (matching NudeNet)');
            
            // Create working image in raw EXIF-stripped state (matching NudeNet detection)
            let workingImage = sharp(originalPath, { autoRotate: false });
            const rawMetadataForProcessing = await workingImage.metadata();
            console.log(`🔄 Working with raw image: ${rawMetadataForProcessing.width}x${rawMetadataForProcessing.height}, orientation: ${rawMetadataForProcessing.orientation}`);
            
            // NO rotation applied here - blur coordinates are for EXIF-stripped space
            console.log('✅ Using EXIF-stripped coordinate system (matching NudeNet detection)');
            
            const workingMetadata = await workingImage.metadata();
            console.log('Working with corrected dimensions:', workingMetadata.width, 'x', workingMetadata.height);
            console.log('Original raw dimensions:', rawMetadata.width, 'x', rawMetadata.height, 'orientation:', rawMetadata.orientation);

            // Apply blur to specific regions if overlay positions are provided
            if (blurSettings.overlayPositions && Object.keys(blurSettings.overlayPositions).length > 0) {
                console.log('Applying selective blur to regions:', Object.keys(blurSettings.overlayPositions));
                
                // Create blur overlay for each region
                // Sharp.js .blur() expects sigma (standard deviation)
                // Use moderate multiplier for effective blur without over-diffusion
                const rawBlurRadius = blurSettings.strength || 15;
                const blurRadius = Math.max(1, Math.min(50, rawBlurRadius * 0.6)); // 60% of backend value
                console.log(`Blur setting: ${rawBlurRadius}px backend → ${blurRadius}px Sharp.js sigma`);
                
                // Collect all blur regions for single composite operation
                const blurRegions = [];
                
                for (const [bodyPart, position] of Object.entries(blurSettings.overlayPositions)) {
                    console.log(`Processing blur for ${bodyPart}:`, position);
                    console.log(`Received manual blur box: x=${position.x}, y=${position.y}, w=${position.width}, h=${position.height}`);
                    
                    // Get current working image dimensions for validation
                    const currentMeta = await workingImage.metadata();
                    console.log(`Working image dimensions: ${currentMeta.width}x${currentMeta.height}`);
                    
                    // Coordinates are now in the same coordinate system as the working image
                    let left = Math.max(0, Math.round(position.x));
                    let top = Math.max(0, Math.round(position.y));
                    let width = Math.round(position.width);
                    let height = Math.round(position.height);
                    
                    // Clamp coordinates to image boundaries to prevent extract_area errors
                    if (left + width > currentMeta.width) {
                        width = currentMeta.width - left;
                        console.log(`Clamped width from ${Math.round(position.width)} to ${width} to fit image bounds`);
                    }
                    if (top + height > currentMeta.height) {
                        height = currentMeta.height - top;
                        console.log(`Clamped height from ${Math.round(position.height)} to ${height} to fit image bounds`);
                    }
                    
                    // Final validation - ensure we have valid dimensions
                    if (width <= 0 || height <= 0) {
                        console.error(`❌ Invalid dimensions for ${bodyPart}: width=${width}, height=${height}`);
                        continue; // Skip this region
                    }
                    
                    const rightEdge = left + width;
                    const bottomEdge = top + height;
                    console.log(`Coordinate validation: right=${rightEdge}/${currentMeta.width}, bottom=${bottomEdge}/${currentMeta.height}`);
                    
                    if (left < 0 || top < 0 || rightEdge > currentMeta.width || bottomEdge > currentMeta.height) {
                        console.error(`❌ Invalid coordinates for ${bodyPart}: bounds check failed after clamping`);
                        console.error(`Image: ${currentMeta.width}x${currentMeta.height}, Extract: ${left},${top} ${width}x${height}`);
                        continue; // Skip this region
                    }
                    
                    console.log(`Using coordinates directly (normalized system): ${left},${top} ${width}x${height}`);
                    
                    // Extract the region from EXIF-corrected working image (matches NudeNet coordinate system)
                    console.log(`🔍 About to extract region: left=${left}, top=${top}, width=${width}, height=${height}`);
                    console.log(`🔍 Extract bounds check: right=${left + width}/${currentMeta.width}, bottom=${top + height}/${currentMeta.height}`);
                    
                    let originalRegion;
                    try {
                        // Double-check the actual working image dimensions right before extract
                        const extractMeta = await workingImage.clone().metadata();
                        console.log(`🔍 ACTUAL working image dimensions just before extract: ${extractMeta.width}x${extractMeta.height}`);
                        
                        if (left + width > extractMeta.width || top + height > extractMeta.height) {
                            console.error(`❌ REAL bounds violation detected!`);
                            console.error(`❌ Extract bounds: right=${left + width}/${extractMeta.width}, bottom=${top + height}/${extractMeta.height}`);
                            throw new Error(`Real bounds violation: extract area exceeds actual image dimensions`);
                        }
                        
                        // Apply blur in EXIF-stripped coordinate space (matching NudeNet detection)
                        console.log(`🔄 Creating fresh Sharp instance for ${bodyPart} in raw EXIF-stripped space`);
                        console.log(`🔄 Using autoRotate: false to match NudeNet coordinate space`);
                        
                        // Use EXIF-stripped image for blur application (matching NudeNet)
                        const finalImage = sharp(originalPath, { autoRotate: false });
                        const finalMeta = await finalImage.metadata();
                        console.log(`🔄 Raw metadata (EXIF-stripped): ${finalMeta.width}x${finalMeta.height}, orientation: ${finalMeta.orientation}`);
                        
                        console.log(`🔍 FINAL BOUNDS CHECK: extract(${left}, ${top}, ${width}, ${height}) from ${finalMeta.width}x${finalMeta.height}`);
                        console.log(`🔍 Right edge: ${left + width} <= ${finalMeta.width}? ${left + width <= finalMeta.width}`);
                        console.log(`🔍 Bottom edge: ${top + height} <= ${finalMeta.height}? ${top + height <= finalMeta.height}`);
                        
                        console.log(`🔄 Attempting extract for ${bodyPart}...`);
                        originalRegion = await finalImage
                            .extract({ left, top, width, height })
                            .toBuffer();
                        console.log(`✅ Fresh extract successful for ${bodyPart}`);
                        console.log(`✅ Successfully extracted ${bodyPart} region`);
                    } catch (extractError) {
                        console.error(`❌ Extract failed for ${bodyPart}:`, extractError.message);
                        console.error(`❌ Coordinates: left=${left}, top=${top}, width=${width}, height=${height}`);
                        console.error(`❌ Image dimensions: ${currentMeta.width}x${currentMeta.height}`);
                        throw extractError;
                    }
                    
                    // No rotation needed - coordinates already match the working image orientation
                    const orientedRegion = originalRegion;
                    
                    // Create blurred version
                    console.log(`DEBUG: About to apply ${blurRadius}px blur to ${bodyPart} region`);
                    let blurredRegion = await sharp(orientedRegion).blur(blurRadius).toBuffer();
                    
                    // Apply shape processing based on blur settings
                    const shape = blurSettings.shape || 'square';
                    console.log(`DEBUG: ==========================================`);
                    console.log(`DEBUG: Processing ${bodyPart} with shape: "${shape}"`);
                    console.log(`DEBUG: Shape comparison: shape === 'oval' is ${shape === 'oval'}`);
                    console.log(`DEBUG: Shape comparison: shape === 'rounded' is ${shape === 'rounded'}`);
                    console.log(`DEBUG: Shape comparison: shape === 'square' is ${shape === 'square'}`);
                    console.log(`DEBUG: Full blur settings:`, JSON.stringify(blurSettings, null, 2));
                    console.log(`DEBUG: ==========================================`);
                    
                    let finalBlurredRegion = blurredRegion;
                    
                    if (shape === 'oval') {
                        console.log(`DEBUG: FORCING OVAL SHAPE for ${bodyPart} - creating custom SVG blur`);
                        
                        // Force oval by using SVG blur filter directly
                        const ovalSvg = `
                            <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                                <defs>
                                    <filter id="blur" x="-50%" y="-50%" width="200%" height="200%">
                                        <feGaussianBlur in="SourceGraphic" stdDeviation="${blurRadius}"/>
                                    </filter>
                                    <clipPath id="oval">
                                        <ellipse cx="${width/2}" cy="${height/2}" rx="${width/2}" ry="${height/2}"/>
                                    </clipPath>
                                </defs>
                                <image href="data:image/jpeg;base64,${orientedRegion.toString('base64')}" 
                                       width="${width}" height="${height}" filter="url(#blur)" clip-path="url(#oval)"/>
                            </svg>
                        `;
                        
                        try {
                            finalBlurredRegion = await sharp(Buffer.from(ovalSvg))
                                .png()
                                .toBuffer();
                            console.log(`DEBUG: Created SVG oval blur for ${bodyPart}`);
                        } catch (svgError) {
                            console.error(`SVG oval failed: ${svgError.message}`);
                            // Simple fallback - just use rectangular blur for now
                            finalBlurredRegion = blurredRegion;
                        }
                        
                    } else if (shape === 'rounded') {
                        // Simple approach: Create blurred rounded rectangle that composites naturally
                        const cornerRadius = Math.min(width, height) * 0.15; // 15% corner radius
                        
                        // Step 1: Create rounded rectangle mask as grayscale
                        const roundedMask = await sharp({
                            create: {
                                width: width,
                                height: height,
                                channels: 3,
                                background: { r: 0, g: 0, b: 0 }
                            }
                        })
                        .composite([{
                            input: Buffer.from(`<svg width="${width}" height="${height}">
                                <rect x="0" y="0" width="${width}" height="${height}" rx="${cornerRadius}" ry="${cornerRadius}" fill="white"/>
                            </svg>`),
                            blend: 'over'
                        }])
                        .raw()
                        .toBuffer();
                        
                        // Step 2: Use the mask to blend original and blurred versions
                        const originalBuffer = await sharp(orientedRegion).raw().toBuffer();
                        const blurredBuffer = await sharp(orientedRegion).blur(blurRadius).raw().toBuffer();
                        
                        // Step 3: Manual pixel blending based on mask
                        const resultBuffer = Buffer.alloc(originalBuffer.length);
                        const channels = 3; // RGB
                        
                        for (let i = 0; i < originalBuffer.length; i += channels) {
                            const maskValue = roundedMask[i] / 255; // Normalize to 0-1
                            
                            // Blend: original * (1-mask) + blurred * mask
                            resultBuffer[i] = Math.round(originalBuffer[i] * (1 - maskValue) + blurredBuffer[i] * maskValue);     // R
                            resultBuffer[i + 1] = Math.round(originalBuffer[i + 1] * (1 - maskValue) + blurredBuffer[i + 1] * maskValue); // G
                            resultBuffer[i + 2] = Math.round(originalBuffer[i + 2] * (1 - maskValue) + blurredBuffer[i + 2] * maskValue); // B
                        }
                        
                        // Convert back to image buffer
                        finalBlurredRegion = await sharp(resultBuffer, { 
                            raw: { width: width, height: height, channels: channels } 
                        }).jpeg().toBuffer();
                        
                        console.log(`DEBUG: Applied rounded rectangle blur blending to ${bodyPart}`);
                    } else {
                        // Square/rectangle - no additional processing needed
                        console.log(`DEBUG: Using square/rectangle shape for ${bodyPart}`);
                    }
                    
                    // Add to blur regions array - use shaped blur region
                    blurRegions.push({
                        input: finalBlurredRegion,
                        left: left,
                        top: top
                    });
                }
                
                // Apply all blur regions in a single composite operation to landscape image
                console.log(`Applying ${blurRegions.length} blur regions to landscape image`);
                workingImage = workingImage.composite(blurRegions);
            } else {
                // Apply global blur if no specific regions
                const blurCalibrationFactor = 2.5;
                const rawBlurRadius = blurSettings.strength || 15;
                const blurRadius = Math.max(1, Math.min(100, rawBlurRadius * blurCalibrationFactor));
                console.log(`Applying global blur: ${blurRadius}px`);
                workingImage = workingImage.blur(blurRadius);
            }

            // Keep EXIF-stripped result - no rotation needed since admin interface now matches
            let finalImage = workingImage;
            console.log('✅ Keeping EXIF-stripped result - admin interface now uses same coordinate space');
            
            // Save the processed image with original EXIF orientation metadata for correct display
            console.log('Saving processed image to:', blurredPath);
            console.log(`Setting EXIF orientation metadata to: ${rawMetadataForProcessing.orientation}`);
            
            await finalImage
                .jpeg({ quality: 90 })
                .withMetadata({ orientation: rawMetadataForProcessing.orientation })
                .toFile(blurredPath);
            
            // Verify file was created
            const stats = await fsPromises.stat(blurredPath);
            console.log('Blurred file created successfully - Size:', stats.size, 'bytes');
            
            // Return web-accessible path
            return `/uploads/${modelSlug}/public/blurred/${blurredFileName}`;

        } catch (error) {
            console.error('Error creating blurred version:', error);
            throw error;
        }
    }
}

module.exports = ContentModerationService;