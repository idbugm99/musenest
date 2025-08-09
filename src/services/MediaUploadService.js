/**
 * Media Upload Service for Model Media Library
 * Handles image upload, processing, watermarking, and moderation integration
 * Part of Phase 2: Backend Implementation for Media Library System
 */

const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');
const crypto = require('crypto');

// Import existing MuseNest services
const ContentModerationService = require('./ContentModerationService');
const AdminWatermarkService = require('./AdminWatermarkService');
const MediaLogger = require('./MediaLogger');

class MediaUploadService {
    constructor(dbConnection) {
        this.db = dbConnection;
        this.baseUploadPath = path.join(__dirname, '../../public/uploads');
        
        // Initialize dependent services
        this.moderationService = new ContentModerationService(dbConnection);
        this.watermarkService = new AdminWatermarkService();
        this.logger = new MediaLogger(dbConnection, {
            logLevel: process.env.MEDIA_LOG_LEVEL || 'info',
            enableDatabaseLogging: true,
            enableFileLogging: process.env.MEDIA_ENABLE_FILE_LOGGING === 'true'
        });
        
        // Configuration
        this.config = {
            // File constraints
            maxFileSize: 50 * 1024 * 1024, // 50MB
            allowedMimeTypes: [
                'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 
                'image/webp', 'image/bmp', 'image/tiff'
            ],
            allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'],
            
            // Image processing
            maxImageDimension: 4000,
            thumbnailSize: 400,
            compressionQuality: 95,
            
            // Upload directories
            tempDir: 'media-temp',
            mediaDir: 'media',
            thumbsDir: 'media/thumbs',
            
            // Processing options
            enableWatermark: true,
            enableModeration: true,
            generateThumbnails: true,
            autoOptimize: true
        };
    }

    /**
     * Initialize the media upload service
     */
    async initialize() {
        try {
            // Initialize dependent services
            await this.watermarkService.initialize();
            
            // Test database connectivity
            await this.testDatabaseConnection();
            
            console.log('✅ MediaUploadService initialized successfully');
            return { success: true };
        } catch (error) {
            console.error('❌ MediaUploadService initialization failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Test database connectivity
     */
    async testDatabaseConnection() {
        try {
            await this.db.execute('SELECT 1');
            console.log('✅ Database connection verified');
        } catch (error) {
            throw new Error(`Database connection failed: ${error.message}`);
        }
    }

    /**
     * Upload and process multiple files
     * @param {Array} files - Array of uploaded files from multer
     * @param {Object} options - Upload options
     * @returns {Object} Upload results
     */
    async uploadFiles(files, options = {}) {
        const {
            modelSlug,
            categoryId = null,
            applyWatermark = true,
            usageIntent = 'public_site',
            contextType = 'media_library',
            title = null,
            description = null
        } = options;

        console.log(`🚀 Starting media upload for model: ${modelSlug}`);
        console.log(`📁 Files to process: ${files.length}`);
        console.log(`⚙️ Options: watermark=${applyWatermark}, category=${categoryId}, intent=${usageIntent}`);

        // Validate inputs
        const validation = await this.validateUploadRequest(files, options);
        if (!validation.valid) {
            return {
                success: false,
                error: validation.error,
                results: []
            };
        }

        const model = validation.model;
        const uploadResults = [];

        // Ensure directory structure exists
        await this.createMediaDirectoryStructure(modelSlug);

        // Process each file
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            console.log(`\n📸 Processing file ${i + 1}/${files.length}: ${file.originalname}`);
            
            try {
                const result = await this.processSingleFile(file, {
                    model,
                    categoryId,
                    applyWatermark,
                    usageIntent,
                    contextType,
                    title: title || `Upload ${i + 1}: ${file.originalname}`,
                    description: description || `Media upload from ${file.originalname}`
                });

                uploadResults.push(result);
                console.log(`✅ File ${i + 1} processed: ${result.success ? 'SUCCESS' : 'FAILED'}`);

            } catch (fileError) {
                console.error(`❌ File ${i + 1} processing error:`, fileError);
                uploadResults.push({
                    success: false,
                    originalFilename: file.originalname,
                    error: fileError.message,
                    processingStage: 'file_processing'
                });
            }

            // Clean up temp file regardless of success/failure
            await this.cleanupTempFile(file.path);
        }

        // Generate summary
        const successful = uploadResults.filter(r => r.success);
        const failed = uploadResults.filter(r => !r.success);

        const summary = {
            success: successful.length > 0,
            message: `${successful.length} files uploaded successfully${failed.length > 0 ? `, ${failed.length} failed` : ''}`,
            totalFiles: files.length,
            successfulUploads: successful.length,
            failedUploads: failed.length,
            results: uploadResults
        };

        console.log(`\n🎯 Upload Summary: ${successful.length}/${files.length} successful`);
        return summary;
    }

    /**
     * Process a single uploaded file
     */
    async processSingleFile(file, options) {
        const { model, categoryId, applyWatermark, usageIntent, contextType, title, description } = options;
        const startTime = Date.now();

        try {
            // 1. Validate file
            const fileValidation = await this.validateSingleFile(file);
            if (!fileValidation.valid) {
                throw new Error(`File validation failed: ${fileValidation.error}`);
            }

            // 2. Generate secure filename
            const secureFilename = this.generateSecureFilename(file.originalname);
            console.log(`🔄 Generated secure filename: ${secureFilename}`);

            // 3. Get image metadata
            const metadata = await this.getImageMetadata(file.path);
            console.log(`📏 Image dimensions: ${metadata.width}x${metadata.height}, format: ${metadata.format}`);

            // 4. Apply watermark if requested
            let processedImagePath = file.path;
            let watermarkApplied = false;
            if (applyWatermark && this.config.enableWatermark) {
                try {
                    const watermarkResult = await this.applyWatermark(file.path, model.slug, metadata);
                    if (watermarkResult.success) {
                        processedImagePath = watermarkResult.watermarkedPath;
                        watermarkApplied = true;
                        console.log(`💧 Watermark applied successfully`);
                    } else {
                        console.warn(`⚠️ Watermark failed: ${watermarkResult.error}`);
                    }
                } catch (watermarkError) {
                    console.warn(`⚠️ Watermark error: ${watermarkError.message}`);
                    // Continue without watermark rather than failing upload
                }
            }

            // 5. Process and optimize image
            const imageProcessingResult = await this.processImage(
                processedImagePath, 
                model.slug, 
                secureFilename, 
                metadata
            );
            
            if (!imageProcessingResult.success) {
                throw new Error(`Image processing failed: ${imageProcessingResult.error}`);
            }

            // 6. Submit to moderation if enabled
            let moderationResult = null;
            if (this.config.enableModeration) {
                try {
                    moderationResult = await this.submitToModeration(
                        imageProcessingResult.finalPath,
                        {
                            modelId: model.id,
                            modelSlug: model.slug,
                            originalName: file.originalname,
                            usageIntent,
                            contextType,
                            title,
                            description
                        }
                    );
                    console.log(`🔍 Moderation result: ${moderationResult.success ? moderationResult.moderation_status : 'FAILED'}`);
                } catch (moderationError) {
                    console.warn(`⚠️ Moderation failed: ${moderationError.message}`);
                    // Continue with pending status if moderation fails
                    moderationResult = {
                        success: false,
                        moderation_status: 'pending',
                        moderation_notes: `Moderation failed: ${moderationError.message}`
                    };
                }
            }

            // 7. Store in media library database
            const databaseResult = await this.storeInMediaLibrary({
                modelSlug: model.slug,
                filename: secureFilename,
                originalFilename: file.originalname,
                filePath: imageProcessingResult.webPath,
                fileSize: (await fs.stat(imageProcessingResult.finalPath)).size,
                dimensions: metadata,
                mimeType: file.mimetype,
                categoryId,
                watermarkApplied,
                moderationResult,
                processingTime: Date.now() - startTime
            });

            if (!databaseResult.success) {
                throw new Error(`Database storage failed: ${databaseResult.error}`);
            }

            // 8. Log successful upload
            const totalTime = Date.now() - startTime;
            await this.logger.logUpload({
                modelSlug: model.slug,
                filename: secureFilename,
                originalFilename: file.originalname,
                fileSize: (await fs.stat(imageProcessingResult.finalPath)).size,
                processingTime: totalTime,
                watermarkApplied,
                moderationStatus: moderationResult?.moderation_status || 'pending',
                trackingId: moderationResult?.moderationTrackingId,
                batchId: moderationResult?.batch_id,
                uploadMethod: 'media_library_bulk',
                metadata: {
                    dimensions: { width: metadata.width, height: metadata.height },
                    categoryId,
                    usageIntent,
                    contextType
                }
            });

            // 9. Return success result
            return {
                success: true,
                mediaId: databaseResult.mediaId,
                filename: secureFilename,
                originalFilename: file.originalname,
                fileUrl: imageProcessingResult.webPath,
                thumbnailUrl: imageProcessingResult.thumbnailWebPath,
                dimensions: {
                    width: metadata.width,
                    height: metadata.height
                },
                fileSize: (await fs.stat(imageProcessingResult.finalPath)).size,
                watermarkApplied,
                moderationStatus: moderationResult?.moderation_status || 'pending',
                processingTime: totalTime,
                processingStages: {
                    validation: '✅',
                    watermark: watermarkApplied ? '✅' : '⏭️',
                    processing: '✅',
                    moderation: moderationResult?.success ? '✅' : '⚠️',
                    database: '✅'
                }
            };

        } catch (error) {
            const totalTime = Date.now() - startTime;
            console.error(`❌ Single file processing failed after ${totalTime}ms:`, error);
            
            // Log the error
            await this.logger.logError({
                modelSlug: model.slug,
                filename: file.originalname,
                errorType: 'upload_processing_error',
                error: error.message,
                errorStack: error.stack,
                operation: 'single_file_processing',
                processingStage: 'upload_pipeline',
                processingTime: totalTime,
                escalationPriority: 'medium',
                contextData: {
                    fileSize: file.size,
                    mimeType: file.mimetype,
                    categoryId,
                    usageIntent,
                    contextType
                }
            });
            
            return {
                success: false,
                originalFilename: file.originalname,
                error: error.message,
                processingTime: totalTime,
                processingStage: 'single_file_processing'
            };
        }
    }

    /**
     * Validate upload request
     */
    async validateUploadRequest(files, options) {
        const { modelSlug } = options;

        // Check if model exists
        if (!modelSlug) {
            return { valid: false, error: 'Model slug is required' };
        }

        try {
            const rows = await this.db.query('SELECT id, slug, name FROM models WHERE slug = ? LIMIT 1', [modelSlug]);
            if (!rows || rows.length === 0) {
                return { valid: false, error: `Model not found: ${modelSlug}` };
            }

            // Validate files array
            if (!files || !Array.isArray(files) || files.length === 0) {
                return { valid: false, error: 'No files provided for upload' };
            }

            if (files.length > 20) {
                return { valid: false, error: 'Maximum 20 files per upload batch' };
            }

            return { 
                valid: true, 
                model: rows[0]
            };

        } catch (error) {
            console.error('Model validation error:', error);
            return { valid: false, error: 'Database error during validation' };
        }
    }

    /**
     * Validate single file
     */
    async validateSingleFile(file) {
        // Check file size
        if (file.size > this.config.maxFileSize) {
            return {
                valid: false,
                error: `File too large: ${Math.round(file.size / (1024 * 1024))}MB (max ${Math.round(this.config.maxFileSize / (1024 * 1024))}MB)`
            };
        }

        // Check MIME type
        if (!this.config.allowedMimeTypes.includes(file.mimetype)) {
            return {
                valid: false,
                error: `Invalid file type: ${file.mimetype}. Allowed: ${this.config.allowedMimeTypes.join(', ')}`
            };
        }

        // Check file extension
        const ext = path.extname(file.originalname).toLowerCase();
        if (!this.config.allowedExtensions.includes(ext)) {
            return {
                valid: false,
                error: `Invalid file extension: ${ext}. Allowed: ${this.config.allowedExtensions.join(', ')}`
            };
        }

        // Check if file exists and is readable
        try {
            await fs.access(file.path, fs.constants.R_OK);
        } catch (accessError) {
            return {
                valid: false,
                error: 'Uploaded file is not accessible'
            };
        }

        return { valid: true };
    }

    /**
     * Generate secure filename
     */
    generateSecureFilename(originalFilename) {
        const ext = path.extname(originalFilename || '').toLowerCase();
        const timestamp = Date.now();
        const random = crypto.randomBytes(8).toString('hex');
        const base = path.basename(originalFilename || 'upload', ext)
            .replace(/[^a-z0-9_-]+/gi, '_')
            .substring(0, 50);
        return `${timestamp}_${random}_${base}${ext}`;
    }

    /**
     * Get image metadata using Sharp
     */
    async getImageMetadata(imagePath) {
        try {
            const metadata = await sharp(imagePath).metadata();
            return {
                width: metadata.width,
                height: metadata.height,
                format: metadata.format,
                channels: metadata.channels,
                hasAlpha: metadata.hasAlpha,
                orientation: metadata.orientation
            };
        } catch (error) {
            throw new Error(`Failed to read image metadata: ${error.message}`);
        }
    }

    /**
     * Apply watermark to image
     */
    async applyWatermark(imagePath, modelSlug, metadata) {
        try {
            // Create model-specific watermark if it doesn't exist
            await this.ensureModelWatermarkSettings(modelSlug);

            // Use AdminWatermarkService for consistency with existing system
            const watermarkResult = await this.watermarkService.applyWatermark(imagePath, modelSlug);
            
            if (watermarkResult && watermarkResult.success) {
                return {
                    success: true,
                    watermarkedPath: watermarkResult.watermarkedPath
                };
            } else {
                return {
                    success: false,
                    error: watermarkResult?.error || 'Watermark application failed'
                };
            }

        } catch (error) {
            return {
                success: false,
                error: `Watermark error: ${error.message}`
            };
        }
    }

    /**
     * Ensure model has watermark settings
     */
    async ensureModelWatermarkSettings(modelSlug) {
        try {
            // Check if watermark settings exist
            const existing = await this.db.query(
                'SELECT id FROM model_watermark_settings WHERE model_slug = ?',
                [modelSlug]
            );

            if (!existing || existing.length === 0) {
                // Create default watermark settings for model
                await this.db.execute(`
                    INSERT INTO model_watermark_settings (
                        model_slug, watermark_enabled, watermark_position, 
                        watermark_opacity, watermark_size_percent, apply_to_uploads
                    ) VALUES (?, ?, ?, ?, ?, ?)
                `, [
                    modelSlug,
                    1, // enabled
                    'bottom-right',
                    0.8, // 80% opacity
                    15, // 15% size
                    1 // apply to uploads
                ]);
                
                console.log(`✅ Created default watermark settings for model: ${modelSlug}`);
            }
        } catch (error) {
            console.warn(`⚠️ Failed to ensure watermark settings for ${modelSlug}:`, error.message);
        }
    }

    /**
     * Process and optimize image
     */
    async processImage(imagePath, modelSlug, filename, metadata) {
        try {
            // Create paths
            const mediaDir = path.join(this.baseUploadPath, modelSlug, this.config.mediaDir);
            const thumbsDir = path.join(this.baseUploadPath, modelSlug, this.config.thumbsDir);
            const finalPath = path.join(mediaDir, filename);
            const thumbnailPath = path.join(thumbsDir, filename);

            // Ensure directories exist
            await fs.mkdir(mediaDir, { recursive: true });
            await fs.mkdir(thumbsDir, { recursive: true });

            // Process main image
            let imageProcessor = sharp(imagePath);

            // Auto-rotate based on EXIF orientation
            imageProcessor = imageProcessor.rotate();

            // Resize if too large
            if (metadata.width > this.config.maxImageDimension || metadata.height > this.config.maxImageDimension) {
                console.log(`📏 Resizing large image from ${metadata.width}x${metadata.height}`);
                imageProcessor = imageProcessor.resize(
                    this.config.maxImageDimension,
                    this.config.maxImageDimension,
                    { 
                        fit: 'inside', 
                        withoutEnlargement: true 
                    }
                );
            }

            // Optimize and save main image
            await imageProcessor
                .jpeg({ 
                    quality: this.config.compressionQuality,
                    progressive: true,
                    mozjpeg: true
                })
                .toFile(finalPath);

            // Generate thumbnail
            await sharp(imagePath)
                .rotate() // Auto-rotate
                .resize(this.config.thumbnailSize, this.config.thumbnailSize, { 
                    fit: 'cover',
                    position: 'center'
                })
                .jpeg({ quality: 85, progressive: true })
                .toFile(thumbnailPath);

            console.log(`✅ Image processed: main image and thumbnail created`);

            return {
                success: true,
                finalPath,
                thumbnailPath,
                webPath: `/uploads/${modelSlug}/${this.config.mediaDir}/${filename}`,
                thumbnailWebPath: `/uploads/${modelSlug}/${this.config.thumbsDir}/${filename}`
            };

        } catch (error) {
            return {
                success: false,
                error: `Image processing failed: ${error.message}`
            };
        }
    }

    /**
     * Submit to moderation system with enhanced error handling, retry logic, and webhook support
     */
    async submitToModeration(imagePath, options) {
        const { modelId, modelSlug, originalName, usageIntent, contextType, title, description } = options;
        const maxRetries = 3;
        let attempt = 0;
        const moderationStartTime = Date.now();
        
        // Generate unique moderation tracking ID
        const moderationTrackingId = `mod_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
        console.log(`🔍 Starting moderation for ${originalName} (Tracking ID: ${moderationTrackingId})`);
        
        while (attempt < maxRetries) {
            try {
                console.log(`🔍 Moderation attempt ${attempt + 1}/${maxRetries} for ${originalName}`);
                
                // Enhanced moderation request with comprehensive metadata
                const moderationRequest = {
                    filePath: imagePath,
                    originalName,
                    modelId,
                    modelSlug,
                    usageIntent,
                    contextType,
                    title: title || originalName,
                    description: description || `Media upload: ${originalName}`,
                    // Enhanced metadata for better analysis
                    uploadTimestamp: Date.now(),
                    uploadSource: 'media_library',
                    processingContext: 'batch_upload',
                    moderationTrackingId,
                    // Webhook configuration for async results
                    webhookUrl: process.env.MODERATION_WEBHOOK_URL || `${process.env.BASE_URL || 'http://localhost:3000'}/api/moderation-webhooks/result`,
                    webhookSecret: process.env.MODERATION_WEBHOOK_SECRET || 'musenest_webhook_secret',
                    // Additional context for better moderation
                    fileMetadata: {
                        size: require('fs').statSync(imagePath).size,
                        uploadMethod: 'media_library_bulk',
                        clientTimestamp: moderationStartTime,
                        retryAttempt: attempt + 1
                    },
                    // Quality assurance flags
                    qualityChecks: {
                        enableFaceDetection: true,
                        enableBodyPartDetection: true,
                        enableTextDetection: false,
                        enableObjectDetection: true,
                        strictModeEnabled: usageIntent === 'public_site'
                    }
                };

                const moderationResult = await this.moderationService.processUploadedImage(moderationRequest);

                if (moderationResult.success) {
                    // Enhanced success response with comprehensive data
                    const enhancedResult = {
                        success: true,
                        moderationTrackingId,
                        contentModerationId: moderationResult.contentModerationId,
                        batch_id: moderationResult.batch_id || null,
                        moderation_status: moderationResult.moderation_status,
                        moderation_score: moderationResult.nudity_score || moderationResult.final_risk_score || 0,
                        moderation_notes: moderationResult.moderation_notes || null,
                        human_review_required: moderationResult.human_review_required || false,
                        
                        // Enhanced analysis data
                        risk_level: moderationResult.risk_level || 'unknown',
                        confidence_score: moderationResult.confidence_score || 0,
                        detected_parts: moderationResult.detected_parts || {},
                        face_analysis: moderationResult.face_analysis || {},
                        violation_types: moderationResult.violation_types || [],
                        final_location: moderationResult.final_location || 'originals',
                        
                        // Processing metadata
                        processing_time: moderationResult.processing_time || (Date.now() - moderationStartTime),
                        analysis_version: moderationResult.analysis_version || 'unknown',
                        retry_attempts: attempt + 1,
                        
                        // Webhook information
                        webhook_registered: !!moderationRequest.webhookUrl,
                        callback_expected: moderationResult.moderation_status === 'pending',
                        
                        // Quality metrics
                        image_quality_score: moderationResult.image_quality_score || null,
                        technical_issues: moderationResult.technical_issues || []
                    };
                    
                    console.log(`✅ Moderation successful: ${moderationResult.moderation_status} (score: ${enhancedResult.moderation_score}, tracking: ${moderationTrackingId})`);
                    
                    // Log successful moderation for analytics
                    await this.logModerationSuccess({
                        moderationTrackingId,
                        modelId,
                        modelSlug,
                        originalName,
                        status: moderationResult.moderation_status,
                        score: enhancedResult.moderation_score,
                        processingTime: enhancedResult.processing_time,
                        retryAttempts: attempt + 1
                    });
                    
                    // Enhanced moderation logging
                    await this.logger.logModeration({
                        modelSlug,
                        filename: originalName,
                        trackingId: moderationTrackingId,
                        batchId: enhancedResult.batch_id,
                        moderationStatus: moderationResult.moderation_status,
                        moderationScore: enhancedResult.moderation_score,
                        confidenceScore: enhancedResult.confidence_score,
                        riskLevel: enhancedResult.risk_level,
                        humanReviewRequired: enhancedResult.human_review_required,
                        processingTime: enhancedResult.processing_time,
                        retryAttempts: attempt + 1,
                        analysisVersion: enhancedResult.analysis_version,
                        detectedParts: enhancedResult.detected_parts,
                        faceAnalysis: enhancedResult.face_analysis,
                        violationTypes: enhancedResult.violation_types,
                        technicalIssues: enhancedResult.technical_issues
                    });
                    
                    return enhancedResult;
                } else {
                    throw new Error(moderationResult.error || 'Moderation processing failed');
                }

            } catch (error) {
                attempt++;
                console.error(`❌ Moderation attempt ${attempt} failed:`, error.message);
                
                // Enhanced error logging with more context
                await this.logModerationAttemptFailure({
                    moderationTrackingId,
                    modelId,
                    modelSlug,
                    originalName,
                    attempt,
                    error: error.message,
                    imagePath,
                    timestamp: new Date().toISOString()
                });
                
                // If this is the last attempt, return comprehensive error response
                if (attempt >= maxRetries) {
                    console.error(`💥 All ${maxRetries} moderation attempts failed for ${originalName} (Tracking: ${moderationTrackingId})`);
                    
                    // Log the final failure for debugging and monitoring
                    await this.logModerationError({
                        moderationTrackingId,
                        modelId,
                        modelSlug,
                        originalName,
                        imagePath,
                        usageIntent,
                        error: error.message,
                        attempts: attempt,
                        totalProcessingTime: Date.now() - moderationStartTime,
                        timestamp: new Date().toISOString()
                    });
                    
                    return {
                        success: false,
                        moderationTrackingId,
                        error: `Moderation failed after ${maxRetries} attempts: ${error.message}`,
                        moderation_status: 'error',
                        moderation_notes: `Failed after ${maxRetries} attempts: ${error.message}`,
                        human_review_required: true, // Always require review for failed moderation
                        risk_level: 'unknown',
                        retry_attempts: attempt,
                        processing_time: Date.now() - moderationStartTime,
                        final_error: error.message,
                        requires_manual_review: true,
                        escalation_priority: 'high' // Flag for immediate attention
                    };
                }
                
                // Enhanced backoff with jitter to prevent thundering herd
                const baseDelay = 1000 * Math.pow(2, attempt - 1);
                const jitter = Math.random() * 1000; // Add up to 1 second of jitter
                const backoffDelay = Math.min(baseDelay + jitter, 5000); // Max 5 seconds
                
                console.log(`⏳ Waiting ${Math.round(backoffDelay)}ms before retry ${attempt + 1}... (with jitter)`);
                await new Promise(resolve => setTimeout(resolve, backoffDelay));
            }
        }
    }

    /**
     * Log successful moderation for analytics and monitoring
     */
    async logModerationSuccess(successData) {
        try {
            const query = `
                INSERT INTO moderation_success_log (
                    moderation_tracking_id, model_id, model_slug, original_filename,
                    moderation_status, moderation_score, processing_time_ms, retry_attempts,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `;
            
            await this.db.execute(query, [
                successData.moderationTrackingId,
                successData.modelId,
                successData.modelSlug,
                successData.originalName,
                successData.status,
                successData.score,
                successData.processingTime,
                successData.retryAttempts
            ]);
            
            console.log(`📊 Moderation success logged: ${successData.status} (${successData.moderationTrackingId})`);
        } catch (logError) {
            console.error('⚠️ Failed to log moderation success:', logError.message);
            // Don't throw - logging failures shouldn't break the process
        }
    }

    /**
     * Log individual moderation attempt failures for debugging
     */
    async logModerationAttemptFailure(attemptData) {
        try {
            const query = `
                INSERT INTO moderation_attempt_failures (
                    moderation_tracking_id, model_id, model_slug, original_filename, image_path,
                    attempt_number, error_message, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
            `;
            
            await this.db.execute(query, [
                attemptData.moderationTrackingId,
                attemptData.modelId,
                attemptData.modelSlug,
                attemptData.originalName,
                attemptData.imagePath,
                attemptData.attempt,
                attemptData.error
            ]);
            
            console.log(`⚠️ Moderation attempt failure logged: attempt ${attemptData.attempt} (${attemptData.moderationTrackingId})`);
        } catch (logError) {
            console.error('⚠️ Failed to log attempt failure:', logError.message);
            // Don't throw - logging failures shouldn't break the process
        }
    }

    /**
     * Log final moderation errors for debugging and monitoring
     */
    async logModerationError(errorData) {
        try {
            const query = `
                INSERT INTO moderation_error_log (
                    moderation_tracking_id, model_id, model_slug, original_filename, image_path, 
                    usage_intent, error_message, retry_attempts, total_processing_time_ms,
                    escalation_priority, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'high', NOW())
            `;
            
            await this.db.execute(query, [
                errorData.moderationTrackingId,
                errorData.modelId,
                errorData.modelSlug,
                errorData.originalName,
                errorData.imagePath,
                errorData.usageIntent,
                errorData.error,
                errorData.attempts,
                errorData.totalProcessingTime
            ]);
            
            console.log(`💥 Final moderation error logged: ${errorData.moderationTrackingId}`);
        } catch (logError) {
            console.error('⚠️ Failed to log moderation error:', logError.message);
            // Don't throw - logging failures shouldn't break the upload process
        }
    }

    /**
     * Store media in database with enhanced moderation data
     */
    async storeInMediaLibrary(data) {
        try {
            const {
                modelSlug,
                filename,
                originalFilename,
                filePath,
                fileSize,
                dimensions,
                mimeType,
                categoryId,
                watermarkApplied,
                moderationResult,
                processingTime
            } = data;

            const insertQuery = `
                INSERT INTO model_media_library (
                    model_slug, filename, original_filename, file_path, 
                    file_size, image_width, image_height, mime_type,
                    category_id, watermark_applied, processing_status,
                    moderation_status, moderation_notes, moderation_score
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const insertParams = [
                modelSlug,
                filename,
                originalFilename,
                filePath,
                fileSize,
                dimensions.width,
                dimensions.height,
                mimeType,
                categoryId || null,
                watermarkApplied ? 1 : 0,
                'completed',
                moderationResult?.moderation_status || 'pending',
                moderationResult?.moderation_notes || null,
                moderationResult?.moderation_score || null
            ];
            
            console.log(`💾 Storing media with moderation status: ${moderationResult?.moderation_status || 'pending'}`);
            console.log(`📊 Moderation score: ${moderationResult?.moderation_score || 'N/A'}`);
            console.log(`🔒 Human review required: ${moderationResult?.human_review_required || false}`);

            const result = await this.db.query(insertQuery, insertParams);
            const mediaId = result.insertId;

            console.log(`✅ Media stored in database with ID: ${mediaId}`);
            
            // Store additional moderation metadata if available
            if (moderationResult && moderationResult.contentModerationId) {
                await this.linkMediaToModeration(mediaId, moderationResult);
            }
            
            // Handle callback registration for pending moderation
            if (moderationResult?.batch_id && moderationResult?.moderation_status === 'pending') {
                await this.registerModerationCallback(mediaId, moderationResult.batch_id, modelSlug);
            }

            return {
                success: true,
                mediaId,
                moderation_data: {
                    status: moderationResult?.moderation_status || 'pending',
                    score: moderationResult?.moderation_score || null,
                    batch_id: moderationResult?.batch_id || null,
                    human_review_required: moderationResult?.human_review_required || false
                }
            };

        } catch (error) {
            console.error('Database storage error:', error);
            return {
                success: false,
                error: `Database error: ${error.message}`
            };
        }
    }

    /**
     * Create media directory structure for model
     */
    async createMediaDirectoryStructure(modelSlug) {
        const baseDir = path.join(this.baseUploadPath, modelSlug);
        const directories = [
            this.config.tempDir,
            this.config.mediaDir,
            this.config.thumbsDir
        ];

        try {
            for (const dir of directories) {
                const dirPath = path.join(baseDir, dir);
                await fs.mkdir(dirPath, { recursive: true });
            }
            console.log(`✅ Media directory structure created for: ${modelSlug}`);
        } catch (error) {
            console.error(`❌ Failed to create directory structure:`, error);
            throw new Error(`Directory creation failed: ${error.message}`);
        }
    }

    /**
     * Clean up temporary files
     */
    async cleanupTempFile(tempPath) {
        try {
            await fs.unlink(tempPath);
        } catch (error) {
            // Ignore cleanup errors - file may already be deleted
            console.warn(`⚠️ Cleanup warning: ${error.message}`);
        }
    }

    /**
     * Link media library entry to content moderation record
     */
    async linkMediaToModeration(mediaId, moderationResult) {
        try {
            // Create link between media library and content moderation
            const linkQuery = `
                INSERT INTO media_moderation_links (
                    media_id, content_moderation_id, batch_id, created_at
                ) VALUES (?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                content_moderation_id = VALUES(content_moderation_id),
                batch_id = VALUES(batch_id),
                updated_at = NOW()
            `;
            
            await this.db.execute(linkQuery, [
                mediaId,
                moderationResult.contentModerationId || null,
                moderationResult.batch_id || null
            ]);
            
            console.log(`🔗 Linked media ${mediaId} to moderation ${moderationResult.contentModerationId}`);
        } catch (linkError) {
            console.error('⚠️ Failed to link media to moderation:', linkError.message);
            // Don't throw - linking failures shouldn't break the upload process
        }
    }

    /**
     * Register callback for pending moderation results
     */
    async registerModerationCallback(mediaId, batchId, modelSlug) {
        try {
            const callbackQuery = `
                INSERT INTO moderation_callbacks (
                    media_id, batch_id, model_slug, status, created_at
                ) VALUES (?, ?, ?, 'pending', NOW())
                ON DUPLICATE KEY UPDATE
                status = 'pending',
                updated_at = NOW()
            `;
            
            await this.db.execute(callbackQuery, [mediaId, batchId, modelSlug]);
            console.log(`📞 Registered moderation callback for media ${mediaId}, batch ${batchId}`);
        } catch (callbackError) {
            console.error('⚠️ Failed to register moderation callback:', callbackError.message);
            // Don't throw - callback registration failures shouldn't break the upload process
        }
    }

    /**
     * Get upload statistics for a model with enhanced moderation metrics
     */
    async getUploadStatistics(modelSlug) {
        try {
            const stats = await this.db.query(`
                SELECT 
                    COUNT(*) as total_media,
                    COUNT(CASE WHEN moderation_status = 'approved' THEN 1 END) as approved_count,
                    COUNT(CASE WHEN moderation_status = 'pending' THEN 1 END) as pending_count,
                    COUNT(CASE WHEN moderation_status = 'rejected' THEN 1 END) as rejected_count,
                    COUNT(CASE WHEN moderation_status = 'flagged' THEN 1 END) as flagged_count,
                    COUNT(CASE WHEN moderation_status = 'error' THEN 1 END) as error_count,
                    SUM(file_size) as total_size_bytes,
                    AVG(CASE WHEN moderation_score > 0 THEN moderation_score END) as avg_moderation_score,
                    MAX(upload_date) as last_upload,
                    COUNT(CASE WHEN upload_date >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) as uploads_last_24h
                FROM model_media_library 
                WHERE model_slug = ? AND is_deleted = 0
            `, [modelSlug]);

            if (stats && stats.length > 0) {
                const stat = stats[0];
                return {
                    success: true,
                    statistics: {
                        total_media: stat.total_media || 0,
                        approved_count: stat.approved_count || 0,
                        pending_count: stat.pending_count || 0,
                        rejected_count: stat.rejected_count || 0,
                        flagged_count: stat.flagged_count || 0,
                        error_count: stat.error_count || 0,
                        total_size_mb: Math.round((stat.total_size_bytes || 0) / (1024 * 1024) * 100) / 100,
                        avg_moderation_score: Math.round((stat.avg_moderation_score || 0) * 100) / 100,
                        last_upload: stat.last_upload,
                        uploads_last_24h: stat.uploads_last_24h || 0,
                        moderation_health: {
                            approval_rate: stat.total_media > 0 ? Math.round((stat.approved_count / stat.total_media) * 100) : 0,
                            error_rate: stat.total_media > 0 ? Math.round((stat.error_count / stat.total_media) * 100) : 0,
                            pending_rate: stat.total_media > 0 ? Math.round((stat.pending_count / stat.total_media) * 100) : 0
                        }
                    }
                };
            }

            return {
                success: true,
                statistics: {
                    total_media: 0,
                    approved_count: 0,
                    pending_count: 0,
                    rejected_count: 0,
                    flagged_count: 0,
                    error_count: 0,
                    total_size_mb: 0,
                    avg_moderation_score: 0,
                    last_upload: null,
                    uploads_last_24h: 0,
                    moderation_health: {
                        approval_rate: 0,
                        error_rate: 0,
                        pending_rate: 0
                    }
                }
            };

        } catch (error) {
            console.error('Statistics query error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Batch delete media items
     */
    async batchDeleteMedia(modelSlug, mediaIds) {
        try {
            if (!Array.isArray(mediaIds) || mediaIds.length === 0) {
                return { success: false, error: 'No media IDs provided' };
            }

            const placeholders = mediaIds.map(() => '?').join(',');
            const query = `
                UPDATE model_media_library 
                SET is_deleted = 1, last_modified = NOW()
                WHERE model_slug = ? AND id IN (${placeholders}) AND is_deleted = 0
            `;

            const result = await this.db.query(query, [modelSlug, ...mediaIds]);
            
            // Also remove from gallery sections
            await this.db.query(`
                DELETE FROM model_gallery_section_media 
                WHERE media_id IN (${placeholders})
            `, mediaIds);

            return {
                success: true,
                deletedCount: result.affectedRows || 0
            };

        } catch (error) {
            console.error('Batch delete error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = MediaUploadService;