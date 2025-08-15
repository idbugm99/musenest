/**
 * Content Moderation Service with Usage Intent & Auto-Moderation Rules
 * Handles the refined workflow for model uploads with flexible approval system
 */

const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const VeniceAIService = require('./VeniceAIService');
const sharp = require('sharp');
const crypto = require('crypto');

class ContentModerationService {
    constructor(dbConnection) {
        this.db = dbConnection;
        this.baseUploadPath = path.join(__dirname, '../../public/uploads');
        this.rules = new Map(); // Cache for moderation rules (legacy)
        this.analysisConfigs = new Map(); // Cache for new analysis configurations
        this.configCacheExpiry = 10 * 60 * 1000; // 10 minutes
    }


    /**
     * Load analysis configuration from new system (preferred method)
     */
    async loadAnalysisConfiguration(usageIntent, modelId = null) {
        const cacheKey = `analysis_config_${usageIntent}_${modelId || 'global'}`;
        const cached = this.analysisConfigs.get(cacheKey);

        if (cached && (Date.now() - cached.timestamp) < this.configCacheExpiry) {
            return cached.data;
        }

        try {
            // Try model-specific first, then global
            const queries = modelId 
                ? [
                    [usageIntent, modelId],    // Model-specific
                    [usageIntent, null]        // Global fallback
                  ]
                : [[usageIntent, null]];       // Global only

            for (const [intent, mId] of queries) {
                const [rows] = await this.db.execute(`
                    SELECT * FROM analysis_configurations 
                    WHERE usage_intent = ? AND model_id <=> ? AND is_active = true
                    ORDER BY created_at DESC 
                    LIMIT 1
                `, [intent, mId]);

                if (rows.length > 0) {
                    const config = rows[0];
                    
                    // Parse JSON fields (handle both string and object formats)
                    config.detection_config = typeof config.detection_config === 'string' 
                        ? JSON.parse(config.detection_config) 
                        : config.detection_config;
                    config.scoring_config = typeof config.scoring_config === 'string' 
                        ? JSON.parse(config.scoring_config) 
                        : config.scoring_config;
                    config.blip_config = typeof config.blip_config === 'string' 
                        ? JSON.parse(config.blip_config) 
                        : config.blip_config;

                    // Cache the result
                    this.analysisConfigs.set(cacheKey, {
                        data: config,
                        timestamp: Date.now()
                    });

                    console.log(`✅ Loaded analysis configuration for ${intent}${mId ? ` (model ${mId})` : ' (global)'}`);
                    return config;
                }
            }

            console.log(`⚠️ No analysis configuration found for ${usageIntent}${modelId ? ` (model ${modelId})` : ''}`);
            return null;

        } catch (error) {
            console.error('Load analysis configuration error:', error);
            return null;
        }
    }

    /**
     * Load moderation rules from database for specific usage intent (legacy method)
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
     * Extract comprehensive image metadata including EXIF, hash, dimensions
     */
    async extractImageMetadata(imagePath) {
        try {
            console.log('📊 Extracting comprehensive metadata for:', path.basename(imagePath));
            
            // Get file stats
            const fileStats = await fs.stat(imagePath);
            const fileSize = fileStats.size;
            
            // Calculate file hash
            const fileBuffer = await fs.readFile(imagePath);
            const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
            
            // Extract image metadata and EXIF using Sharp
            const imageMetadata = await sharp(imagePath).metadata();
            const { width, height, density, format, exif, orientation } = imageMetadata;
            
            // Parse EXIF data if available
            let parsedExifData = null;
            if (exif && exif.length > 0) {
                try {
                    // Convert EXIF buffer to object using sharp's metadata
                    parsedExifData = {
                        imageWidth: width,
                        imageHeight: height,
                        orientation: orientation,
                        density: density,
                        format: format,
                        // Additional EXIF fields that Sharp can extract
                        hasColorProfile: !!imageMetadata.hasProfile,
                        colorSpace: imageMetadata.space,
                        channels: imageMetadata.channels,
                        isProgressive: imageMetadata.isProgressive,
                        resolutionUnit: imageMetadata.resolutionUnit || 'inch'
                    };
                    
                    console.log('📷 EXIF data extracted successfully');
                } catch (exifError) {
                    console.warn('⚠️ EXIF parsing failed:', exifError.message);
                    parsedExifData = null;
                }
            }
            
            const metadata = {
                // File information
                fileHash: fileHash,
                fileSize: fileSize,
                fileName: path.basename(imagePath),
                
                // Image dimensions and technical details
                width: width || null,
                height: height || null,
                format: format || null,
                density: density || null,
                
                // EXIF and metadata
                exifData: parsedExifData,
                orientation: orientation || 1,
                hasColorProfile: !!imageMetadata.hasProfile,
                colorSpace: imageMetadata.space || null,
                channels: imageMetadata.channels || null,
                
                // Processing metadata
                extractedAt: new Date().toISOString(),
                extractionMethod: 'sharp_nodejs'
            };
            
            console.log('✅ Metadata extraction complete:', {
                hash: fileHash.substring(0, 12) + '...',
                dimensions: `${width}x${height}`,
                fileSize: Math.round(fileSize / 1024) + 'KB',
                format: format,
                hasExif: !!parsedExifData
            });
            
            return metadata;
            
        } catch (error) {
            console.error('❌ Metadata extraction failed:', error);
            return {
                fileHash: null,
                fileSize: 0,
                width: null,
                height: null,
                exifData: null,
                error: error.message,
                extractedAt: new Date().toISOString(),
                extractionMethod: 'failed'
            };
        }
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

            // 2.5. Extract comprehensive metadata
            const imageMetadata = await this.extractImageMetadata(originalPath);
            console.log('📊 Image metadata extracted:', {
                hash: imageMetadata.fileHash,
                dimensions: `${imageMetadata.width}x${imageMetadata.height}`,
                fileSize: imageMetadata.fileSize,
                hasExif: !!imageMetadata.exifData
            });

            // 3. Parallel processing: NudeNet + Venice.ai
            console.log('🔄 Starting parallel processing: NudeNet + Venice.ai...');
            const [aiAnalysis, veniceResult] = await Promise.allSettled([
                this.analyzeWithNudeNet(originalPath, contextType, modelId, usageIntent),
                VeniceAIService.processImage(originalPath, { 
                    modelId, 
                    modelSlug, 
                    usageIntent, 
                    contextType 
                })
            ]);

            // Handle NudeNet result
            if (aiAnalysis.status === 'rejected') {
                console.error('❌ NudeNet analysis failed:', aiAnalysis.reason);
                throw new Error(`NudeNet analysis failed: ${aiAnalysis.reason.message}`);
            }
            const nudenetData = aiAnalysis.value;
            
            console.log(`🔍 DEBUG aiAnalysis keys:`, Object.keys(nudenetData));
            console.log(`🔍 DEBUG aiAnalysis.batch_id:`, nudenetData.batch_id);
            console.log(`🔍 DEBUG aiAnalysis.moderation_status:`, nudenetData.moderation_status);

            // Handle Venice.ai result
            let veniceData = null;
            let adminNotificationNeeded = false;
            
            if (veniceResult.status === 'fulfilled' && veniceResult.value.success) {
                veniceData = veniceResult.value;
                console.log('✅ Venice.ai processing successful');
                
                // Check for children detection
                if (veniceData.childrenDetected && veniceData.childrenDetected.detected) {
                    console.warn('🚨 CHILDREN DETECTED in Venice.ai description:', veniceData.childrenDetected.termsFound);
                }
            } else {
                console.error('❌ Venice.ai processing failed:', veniceResult.reason || veniceResult.value?.error);
                adminNotificationNeeded = true;
                veniceData = {
                    success: false,
                    error: veniceResult.reason?.message || veniceResult.value?.error || 'Unknown Venice.ai error',
                    requiresManualRetry: true
                };
            }

            // 4. Merge Venice.ai child detection results into NudeNet analysis before applying moderation rules
            if (veniceData?.success && veniceData.childrenDetected?.detected) {
                console.log(`🔗 Merging Venice.ai child detection data into analysis object`);
                nudenetData.venice_children_detected = true;
                nudenetData.venice_children_terms = veniceData.childrenDetected.termsFound;
                console.log(`✅ Added Venice.ai child detection: ${veniceData.childrenDetected.termsFound.join(', ')}`);
            } else {
                nudenetData.venice_children_detected = false;
                nudenetData.venice_children_terms = [];
            }

            // 5. Apply local moderation rules to merged NudeNet + Venice.ai results
            console.log(`🔍 Applying local moderation rules to merged analysis results`);
            const moderationResult = await this.applyModerationRules(nudenetData, usageIntent, modelId);

            // 6. Store in database with Venice.ai data and comprehensive metadata
            const contentModerationId = await this.storeModerationResult({
                ...moderationResult,
                originalPath,
                modelId,
                usageIntent,
                contextType,
                image_path: originalPath,
                // Add Venice.ai data with SEO enhancements
                venice_description: veniceData?.fullResponse || null,
                venice_detailed_description: veniceData?.detailedDescription || null,
                venice_brief_description: veniceData?.briefDescription || null,
                venice_seo_keywords: veniceData?.seoKeywords ? JSON.stringify(veniceData.seoKeywords) : null,
                venice_alt_text: veniceData?.altText || null,
                venice_children_detected: veniceData?.childrenDetected?.detected || false,
                venice_children_terms: veniceData?.childrenDetected?.termsFound ? JSON.stringify(veniceData.childrenDetected.termsFound) : null,
                venice_processing_error: veniceData?.success === false ? veniceData.error : null,
                admin_notification_needed: adminNotificationNeeded,
                // Add comprehensive image metadata
                image_metadata: imageMetadata
            });

            // 7. Handle flagged content
            if (moderationResult.flagged) {
                await this.handleFlaggedContent(contentModerationId, {
                    ...moderationResult,
                    modelId
                });
            }

            // 8. Process approved content
            if (moderationResult.moderation_status === 'approved') {
                await this.processApprovedContent(contentModerationId, originalPath, modelSlug, usageIntent);
            }

            return {
                success: true,
                contentModerationId,
                ...moderationResult,
                // Include Venice.ai data for downstream processing
                venice_data: {
                    seoKeywords: veniceData?.seoKeywords || [],
                    altText: veniceData?.altText || null,
                    briefDescription: veniceData?.briefDescription || null,
                    detailedDescription: veniceData?.detailedDescription || null
                },
                // Include extracted metadata
                image_metadata: imageMetadata
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
     * Analyze image with local NudeNet processing
     */
    async analyzeWithNudeNet(imagePath, contextType, modelId, usageIntent = 'public_site') {
        console.log(`🚀 Starting local NudeNet analysis for image: ${imagePath}`);
        
        // Generate batch ID for tracking (compatible with test interface)
        const batchId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        return new Promise((resolve, reject) => {
            const python = spawn('python3', [
                path.join(__dirname, '../../nudenet-cli.py'),
                '--image', imagePath,
                '--context_type', contextType
            ], {
                cwd: path.join(__dirname, '../..'),
                env: { 
                    ...process.env, 
                    PATH: path.join(__dirname, '../../.venv/bin') + ':' + process.env.PATH,
                    VIRTUAL_ENV: path.join(__dirname, '../../.venv')
                }
            });

            let stdout = '';
            let stderr = '';

            python.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            python.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            python.on('close', (code) => {
                if (code !== 0) {
                    console.error(`❌ Local NudeNet process failed with code ${code}`);
                    console.error('stderr:', stderr);
                    reject(new Error(`Local NudeNet process failed: ${stderr}`));
                    return;
                }

                try {
                    console.log('📝 Raw NudeNet output:', stdout);
                    const result = JSON.parse(stdout.trim());
                    
                    // Apply nudity score correction (exclude faces and covered parts)
                    const detectedParts = result.detected_parts || {};
                    const ACTUAL_NUDITY_PARTS = [
                        'FEMALE_GENITALIA_EXPOSED',
                        'MALE_GENITALIA_EXPOSED', 
                        'BUTTOCKS_EXPOSED',
                        'FEMALE_BREAST_EXPOSED',
                        'ANUS_EXPOSED'
                    ];
                    
                    let correctedNudityScore = 0;
                    Object.entries(detectedParts).forEach(([part, confidence]) => {
                        if (ACTUAL_NUDITY_PARTS.includes(part)) {
                            correctedNudityScore = Math.max(correctedNudityScore, confidence);
                        }
                    });

                    console.log(`🔍 Local NudeNet results: Original=${result.nudity_score?.toFixed(1)}%, Corrected=${correctedNudityScore.toFixed(1)}%`);
                    
                    resolve({
                        ...result,
                        nudity_score: correctedNudityScore,
                        processing_method: 'local_nudenet',
                        analysis_version: 'local_v1.0',
                        batch_id: batchId,
                        moderation_status: 'pending' // Will be determined by moderation rules
                    });
                } catch (parseError) {
                    console.error(`❌ Failed to parse NudeNet result:`, parseError.message);
                    console.error('stdout:', stdout);
                    reject(new Error(`Failed to parse local NudeNet result: ${parseError.message}`));
                }
            });

            python.on('error', (error) => {
                console.error(`❌ Failed to start local NudeNet process:`, error.message);
                reject(new Error(`Failed to start local NudeNet process: ${error.message}`));
            });
        });
    }

    /**
     * Fallback to basic NudeNet analysis when local processing fails
     */
    async fallbackToBasicAnalysis(imagePath, contextType, modelId, usageIntent = 'public_site') {
        console.log('🔄 Fallback: Attempting direct NudeNet analysis...');
        
        // Load configuration to determine what to analyze locally
        const analysisConfig = await this.loadAnalysisConfiguration(usageIntent, modelId);
        
        try {
            // Try direct NudeNet analysis using Python script or local service
            const result = await this.performDirectNudeNetAnalysis(imagePath, analysisConfig);
            
            if (result && result.success) {
                console.log('✅ Direct NudeNet analysis successful');
                return this.transformDirectNudeNetResponse(result, contextType, modelId, analysisConfig);
            }
        } catch (directError) {
            console.error('❌ Direct NudeNet analysis failed:', directError.message);
        }
        
        console.log('🚨 All analysis methods failed - using conservative fallback');
        
        // Return a conservative analysis structure that flags for review
        // When all analysis methods fail, be extremely conservative
        return {
            detected_parts: { 'ANALYSIS_FAILED': 95.0 },
            part_locations: {},
            nudity_score: 95.0, // High score to trigger moderation rules
            has_nudity: true, // Assume nudity present to be safe
            
            // Fallback fields  
            pose_analysis: {
                pose_detected: false,
                pose_category: 'analysis_failed',
                suggestive_score: 0,
                details: { reasoning: ['ALL_ANALYSIS_METHODS_FAILED', 'using_conservative_fallback'] }
            },
            combined_assessment: {
                final_risk_score: 95.0,
                risk_level: 'high',
                reasoning: ['ALL_ANALYSIS_FAILED', 'CONSERVATIVE_FALLBACK_APPLIED']
            },
            moderation_decision: {
                status: 'flagged_for_review',
                action: 'require_human_review',
                human_review_required: true
            },
            
            // Legacy compatibility
            success: true,
            analysis_version: 'CONSERVATIVE_FALLBACK',
            warning: 'All image analysis methods failed - using conservative hardcoded response'
        };
    }

    /**
     * Perform direct NudeNet analysis using local Python installation
     */
    async performDirectNudeNetAnalysis(imagePath, analysisConfig = null) {
        console.log('🐍 Attempting direct NudeNet analysis via Python...');
        
        // Determine what components to analyze based on config
        const enabledComponents = analysisConfig ? analysisConfig.detection_config.nudenet_components : null;
        if (enabledComponents) {
            console.log(`📋 Using configuration: breast=${enabledComponents.breast_detection}, genitalia=${enabledComponents.genitalia_detection}`);
        }
        
        return new Promise((resolve, reject) => {
            const { spawn } = require('child_process');
            const path = require('path');
            
            // Create a simple Python script to run NudeNet locally
            const pythonScript = `
import sys
import json
from nudenet import NudeDetector

try:
    detector = NudeDetector()
    image_path = sys.argv[1]
    
    # Run detection
    detections = detector.detect(image_path)
    
    # Transform to expected format
    detected_parts = {}
    part_locations = {}
    max_score = 0
    
    for detection in detections:
        label = detection['class'].upper()
        confidence = detection['score'] * 100
        detected_parts[label] = confidence
        max_score = max(max_score, confidence)
        
        # Store location info
        part_locations[label] = {
            'x': detection['box'][0],
            'y': detection['box'][1], 
            'width': detection['box'][2] - detection['box'][0],
            'height': detection['box'][3] - detection['box'][1],
            'confidence': confidence
        }
    
    result = {
        'success': True,
        'detected_parts': detected_parts,
        'part_locations': part_locations,
        'nudity_score': max_score,
        'has_nudity': max_score > 30,
        'analysis_method': 'local_nudenet'
    }
    
    print(json.dumps(result))
    
except Exception as e:
    error_result = {
        'success': False,
        'error': str(e),
        'analysis_method': 'local_nudenet_failed'
    }
    print(json.dumps(error_result))
    sys.exit(1)
`;
            
            // Write Python script to temp file
            const fs = require('fs');
            const os = require('os');
            const scriptPath = path.join(os.tmpdir(), `nudenet_analysis_${Date.now()}.py`);
            
            fs.writeFileSync(scriptPath, pythonScript);
            
            // Execute Python script
            const python = spawn('python3', [scriptPath, imagePath], {
                timeout: 30000 // 30 second timeout
            });
            
            let output = '';
            let errorOutput = '';
            
            python.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            python.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });
            
            python.on('close', (code) => {
                // Clean up temp script
                try {
                    fs.unlinkSync(scriptPath);
                } catch (cleanup) {
                    console.warn('Failed to cleanup temp script:', cleanup.message);
                }
                
                if (code === 0) {
                    try {
                        const result = JSON.parse(output);
                        console.log('✅ Python NudeNet analysis completed');
                        resolve(result);
                    } catch (parseError) {
                        console.error('❌ Failed to parse Python output:', parseError.message);
                        reject(new Error('Failed to parse NudeNet output'));
                    }
                } else {
                    console.error('❌ Python script failed:', errorOutput);
                    reject(new Error(`Python NudeNet failed with code ${code}: ${errorOutput}`));
                }
            });
            
            python.on('error', (error) => {
                console.error('❌ Failed to spawn Python process:', error.message);
                reject(error);
            });
        });
    }

    /**
     * Transform direct NudeNet response to match expected format
     */
    transformDirectNudeNetResponse(directResult, contextType, modelId, analysisConfig = null) {
        // Filter detected parts based on configuration
        let detectedParts = directResult.detected_parts || {};
        let partLocations = directResult.part_locations || {};
        
        if (analysisConfig && analysisConfig.detection_config.nudenet_components) {
            const enabledComponents = analysisConfig.detection_config.nudenet_components;
            const filteredParts = {};
            const filteredLocations = {};
            
            // Map detection labels to configuration keys
            const labelMapping = {
                'BREAST_EXPOSED': 'breast_detection',
                'GENITALIA': 'genitalia_detection', 
                'BUTTOCKS_EXPOSED': 'buttocks_detection',
                'ANUS_EXPOSED': 'anus_detection',
                'FACE_DETECTED': 'face_detection'
            };
            
            Object.entries(detectedParts).forEach(([label, confidence]) => {
                const configKey = labelMapping[label];
                if (!configKey || enabledComponents[configKey]) {
                    filteredParts[label] = confidence;
                    if (partLocations[label]) {
                        filteredLocations[label] = partLocations[label];
                    }
                } else {
                    console.log(`🚫 Filtered out ${label} (disabled in config)`);
                }
            });
            
            detectedParts = filteredParts;
            partLocations = filteredLocations;
        }
        
        return {
            // NudeNet results (filtered by configuration)
            detected_parts: detectedParts,
            part_locations: partLocations,
            nudity_score: directResult.nudity_score || 0,
            has_nudity: directResult.has_nudity || false,
            
            // Basic face analysis (not available in direct NudeNet)
            face_analysis: {
                faces_detected: false,
                face_count: 0,
                min_age: null,
                underage_detected: false,
                analysis_note: 'Face analysis not available in direct NudeNet mode'
            },
            face_count: 0,
            min_detected_age: null,
            max_detected_age: null,
            underage_detected: false,
            age_risk_multiplier: 1.0,
            
            // Basic image description
            image_description: {
                description: 'Image analyzed via direct NudeNet',
                tags: [],
                generation_method: 'direct_nudenet_only'
            },
            description_text: 'Analyzed via direct NudeNet - no description available',
            description_tags: [],
            contains_children: false,
            description_risk: 0.0,
            
            // Risk assessment based on nudity score
            final_risk_score: directResult.nudity_score || 0,
            risk_level: this.calculateRiskLevel(directResult.nudity_score || 0),
            risk_reasoning: ['direct_nudenet_analysis', `nudity_score_${directResult.nudity_score || 0}`],
            
            // Combined assessment
            combined_assessment: {
                final_risk_score: directResult.nudity_score || 0,
                risk_level: this.calculateRiskLevel(directResult.nudity_score || 0),
                reasoning: ['direct_nudenet_only', 'no_face_or_description_analysis']
            },
            
            // Pose analysis placeholder
            pose_analysis: {
                pose_detected: false,
                pose_category: 'direct_nudenet_mode',
                suggestive_score: 0,
                details: { reasoning: ['direct_nudenet_analysis_only'] }
            },
            
            // Moderation decision based on nudity score
            moderation_decision: {
                status: directResult.nudity_score > 50 ? 'flagged_for_review' : 'auto_approve',
                action: directResult.nudity_score > 50 ? 'require_human_review' : 'auto_approve',
                human_review_required: directResult.nudity_score > 50
            },
            moderation_status: directResult.nudity_score > 50 ? 'flagged' : 'approved',
            human_review_required: directResult.nudity_score > 50,
            flagged: directResult.nudity_score > 50,
            auto_rejected: false,
            rejection_reason: null,
            
            // Metadata
            success: true,
            analysis_version: 'direct_nudenet_v1'
        };
    }

    /**
     * Calculate risk level based on nudity score
     */
    calculateRiskLevel(nudityScore) {
        if (nudityScore >= 80) return 'critical';
        if (nudityScore >= 60) return 'high';
        if (nudityScore >= 40) return 'medium';
        if (nudityScore >= 20) return 'low';
        return 'minimal';
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
                reasoning: ['LOCAL_ANALYSIS_ERROR', 'NUDENET_FAILED_LOCALLY']
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
     * Transform v1 API response to clean format (no legacy compatibility)
     */
    transformEnhancedResponse(enhancedResult) {
        // Check if this is an analysis error response
        if (enhancedResult.image_analysis?.nudity_detection?.detected_parts?.ANALYSIS_ERROR) {
            console.log('🚨 Server returned ANALYSIS_ERROR - using structured fallback');
            return this.createStructuredFallback();
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

        // Define which parts actually constitute nudity (exclude faces and covered parts)
        const ACTUAL_NUDITY_PARTS = [
            'FEMALE_GENITALIA_EXPOSED',
            'MALE_GENITALIA_EXPOSED', 
            'BUTTOCKS_EXPOSED',
            'FEMALE_BREAST_EXPOSED',
            'ANUS_EXPOSED'
        ];

        // Define non-nudity parts that should not contribute to nudity score
        const NON_NUDITY_PARTS = [
            'FACE_FEMALE',
            'FACE_MALE', 
            'FEMALE_BREAST_COVERED',
            'MALE_BREAST_COVERED',
            'BUTTOCKS_COVERED',
            'BELLY_COVERED',
            'BELLY_EXPOSED',
            'ARMPITS_EXPOSED'
        ];

        if (nudityDetection?.detected_parts) {
            Object.entries(nudityDetection.detected_parts).forEach(([part, confidence]) => {
                detectedParts[part] = confidence;
                
                // Only count actual nude body parts toward nudity score
                if (ACTUAL_NUDITY_PARTS.includes(part)) {
                    maxNudityScore = Math.max(maxNudityScore, confidence);
                    console.log(`🔍 ACTUAL NUDITY DETECTED: ${part} (${confidence.toFixed(1)}%)`);
                } else {
                    console.log(`ℹ️  Non-nudity detection: ${part} (${confidence.toFixed(1)}%) - not counted toward nudity score`);
                }
                
                if (nudityDetection.part_locations?.[part]) {
                    partLocations[part] = nudityDetection.part_locations[part];
                } else {
                    partLocations[part] = {
                        x: 0, y: 0, width: 100, height: 100, confidence: confidence
                    };
                }
            });
        }

        console.log(`📊 NUDITY SCORE CALCULATION: Final score = ${maxNudityScore.toFixed(1)}% (based only on exposed body parts)`);

        // Calculate has_nudity based on actual nudity score (not original detection)
        const hasActualNudity = maxNudityScore > 15; // Threshold for actual nudity
        console.log(`📊 HAS_NUDITY FLAG: ${hasActualNudity} (score: ${maxNudityScore.toFixed(1)}%, threshold: 15%)`);

        // Extract image description details
        const descriptionText = imageDescription?.description || 'No description available';
        const descriptionTags = imageDescription?.tags || [];
        const containsChildren = this.checkForChildrenInDescription(descriptionText, descriptionTags);

        return {
            // NudeNet results
            detected_parts: detectedParts,
            part_locations: partLocations,
            nudity_score: maxNudityScore,
            has_nudity: hasActualNudity,
            
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
    async applyModerationRules(aiAnalysis, usageIntent, modelId = null) {
        // Try new configuration system first
        const analysisConfig = await this.loadAnalysisConfiguration(usageIntent, modelId);
        
        if (analysisConfig) {
            return this.applyNewModerationRules(aiAnalysis, analysisConfig, usageIntent);
        }
        
        // Fallback to legacy system
        console.log('⚠️ Using legacy moderation rules - consider migrating to new configuration system');
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
     * Map NudeNet detection labels to configuration keys
     */
    mapNudeNetToConfigKey(nudeNetLabel) {
        const labelMap = {
            'FEMALE_GENITALIA_EXPOSED': 'GENITALIA',
            'MALE_GENITALIA_EXPOSED': 'GENITALIA',
            'FEMALE_BREAST_EXPOSED': 'BREAST_EXPOSED',
            'MALE_BREAST_EXPOSED': 'BREAST_EXPOSED',
            'BUTTOCKS_EXPOSED': 'BUTTOCKS_EXPOSED',
            'ANUS_EXPOSED': 'ANUS_EXPOSED',
            'FACE_FEMALE': 'FACE_DETECTED',
            'FACE_MALE': 'FACE_DETECTED',
            'ARMPITS_EXPOSED': 'ARMPITS_EXPOSED',
            'BELLY_EXPOSED': 'BELLY_EXPOSED',
            'FEET_EXPOSED': 'FEET_EXPOSED'
        };
        
        return labelMap[nudeNetLabel] || nudeNetLabel;
    }

    /**
     * Apply new configuration-based moderation rules
     */
    applyNewModerationRules(aiAnalysis, analysisConfig, usageIntent) {
        const scoringConfig = analysisConfig.scoring_config;
        const detectionConfig = analysisConfig.detection_config;
        
        console.log(`🎯 Applying new moderation rules for ${usageIntent}`);
        
        const result = {
            ...aiAnalysis,
            usage_intent: usageIntent,
            flagged: false,
            auto_blocked: false,
            human_review_required: false,
            final_location: 'originals',
            config_version: analysisConfig.version || 1
        };

        // Calculate weighted nudity score based on configuration
        let weightedScore = 0;
        const detectionWeights = scoringConfig.detection_weights || {};
        
        if (result.detected_parts) {
            for (const [bodyPart, confidence] of Object.entries(result.detected_parts)) {
                // Map NudeNet detection labels to configuration keys
                const mappedBodyPart = this.mapNudeNetToConfigKey(bodyPart);
                const weight = detectionWeights[mappedBodyPart] || detectionWeights[bodyPart] || 0;
                const contribution = (confidence * weight) / 100;
                weightedScore += contribution;
                
                console.log(`📊 ${bodyPart}: confidence=${confidence}%, weight=${weight}%, contribution=${contribution.toFixed(2)}`);
            }
        }

        // Apply risk multipliers
        const riskMultipliers = scoringConfig.risk_multipliers || {};
        
        if (result.underage_detected && riskMultipliers.underage_detected) {
            weightedScore *= riskMultipliers.underage_detected;
            console.log(`⚠️ Underage detected - applying ${riskMultipliers.underage_detected}x multiplier`);
        }
        
        if (result.contains_children && riskMultipliers.child_content_blip) {
            weightedScore *= riskMultipliers.child_content_blip;
            console.log(`⚠️ Child content detected - applying ${riskMultipliers.child_content_blip}x multiplier`);
        }
        
        // Check Venice.ai child detection results
        if (result.venice_children_detected && riskMultipliers.child_content_blip) {
            weightedScore *= riskMultipliers.child_content_blip;
            console.log(`⚠️ Venice.ai child content detected - applying ${riskMultipliers.child_content_blip}x multiplier`);
        }

        // Update the final score
        result.weighted_nudity_score = Math.min(100, weightedScore);
        result.original_nudity_score = result.nudity_score;
        result.nudity_score = result.weighted_nudity_score;

        console.log(`📈 Score calculation: original=${result.original_nudity_score}%, weighted=${result.weighted_nudity_score}%`);

        // Apply thresholds
        const thresholds = scoringConfig.thresholds || {};
        
        if (result.weighted_nudity_score <= (thresholds.auto_approve_under || 15)) {
            result.moderation_status = 'approved';
            result.final_location = this.getFinalLocation(usageIntent);
            console.log(`✅ Auto-approved (${result.weighted_nudity_score}% <= ${thresholds.auto_approve_under || 15}%)`);
        } else if (result.weighted_nudity_score >= (thresholds.auto_reject_over || 90)) {
            result.flagged = true;
            result.auto_blocked = true;
            result.human_review_required = true;
            result.moderation_status = 'auto_rejected';
            result.rejection_reason = `Weighted nudity score too high: ${result.weighted_nudity_score}%`;
            console.log(`❌ Auto-rejected (${result.weighted_nudity_score}% >= ${thresholds.auto_reject_over || 90}%)`);
        } else if (result.weighted_nudity_score >= (thresholds.auto_flag_over || 70)) {
            result.flagged = true;
            result.human_review_required = true;
            result.moderation_status = 'flagged';
            console.log(`⚠️ Flagged for review (${result.weighted_nudity_score}% >= ${thresholds.auto_flag_over || 70}%)`);
        } else {
            // In the middle range - flag for review to be safe
            result.flagged = true;
            result.human_review_required = true;
            result.moderation_status = 'flagged';
            console.log(`🔍 Flagged for review (middle range: ${result.weighted_nudity_score}%)`);
        }

        // Force high priority for specific conditions
        if (result.underage_detected || result.contains_children || result.venice_children_detected) {
            result.flagged = true;
            result.human_review_required = true;
            result.moderation_status = 'flagged';
            result.priority = 'urgent';
            console.log(`🚨 Forced flagging due to underage/child content detection`);
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
                batch_id, image_path, original_path, model_id, context_type, usage_intent,
                nudity_score, detected_parts, part_locations, has_nudity,
                face_analysis, face_count, min_detected_age, max_detected_age, 
                underage_detected, age_risk_multiplier,
                image_description, description_text, description_tags, 
                contains_children, description_risk,
                final_risk_score, risk_level, risk_reasoning,
                moderation_status, human_review_required, flagged, 
                auto_rejected, rejection_reason, confidence_score, final_location,
                venice_description, venice_brief_description, venice_detailed_description,
                venice_children_detected, venice_children_terms, venice_processing_error,
                venice_seo_keywords, venice_alt_text
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            data.batch_id || null,
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
            data.final_location || 'originals',
            data.venice_description || null,
            data.venice_brief_description || null,
            data.venice_detailed_description || null,
            data.venice_children_detected ? 1 : 0,
            data.venice_children_terms ? JSON.stringify(data.venice_children_terms) : null,
            data.venice_processing_error || null,
            data.venice_seo_keywords || null,
            data.venice_alt_text || null
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

        // CRITICAL FIX: Update media_review_queue status to approved_blurred
        await this.db.execute(`
            UPDATE media_review_queue 
            SET 
                review_status = 'approved_blurred',
                reviewed_at = NOW(),
                updated_at = NOW()
            WHERE content_moderation_id = ?
        `, [contentModerationId]);

        // Remove from moderation queue (legacy table)
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