/**
 * AI-Powered Image Classification and Auto-Tagging Service
 * 
 * This service provides comprehensive computer vision capabilities for automatic image
 * classification, content recognition, and intelligent tagging using multiple ML models
 * and vision APIs.
 * 
 * Features:
 * - Multi-model image classification (objects, scenes, concepts)
 * - NSFW and content safety detection
 * - Visual similarity and clustering
 * - Automated tag generation and confidence scoring
 * - Batch processing with queue management
 * - Model performance tracking and A/B testing
 * - Integration with gallery management system
 */

const mysql = require('mysql2/promise');
const Redis = require('redis');
const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

class ImageClassificationService extends EventEmitter {
    constructor() {
        super();
        
        // Classification model configuration
        this.modelConfig = {
            // Primary classification models
            content_classifier: {
                enabled: true,
                model_name: 'resnet152_imagenet',
                confidence_threshold: 0.3,
                max_predictions: 10,
                categories: ['objects', 'scenes', 'activities'],
                weight: 0.4
            },
            
            // NSFW and safety detection
            safety_classifier: {
                enabled: true,
                model_name: 'nsfw_mobilenet_v2',
                confidence_threshold: 0.7,
                categories: ['safe', 'questionable', 'unsafe', 'explicit'],
                weight: 0.3
            },
            
            // Style and aesthetic classification
            aesthetic_classifier: {
                enabled: true,
                model_name: 'aesthetic_mobilenet',
                confidence_threshold: 0.4,
                categories: ['portrait', 'landscape', 'abstract', 'fashion', 'artistic'],
                weight: 0.2
            },
            
            // Custom domain-specific classifier
            domain_classifier: {
                enabled: true,
                model_name: 'custom_gallery_classifier',
                confidence_threshold: 0.5,
                categories: ['model_photo', 'lifestyle', 'professional', 'artistic', 'casual'],
                weight: 0.3
            }
        };
        
        // Tag generation configuration
        this.tagConfig = {
            // Automatic tag generation
            auto_tagging: {
                enabled: true,
                min_confidence: 0.4,
                max_tags_per_image: 15,
                tag_sources: ['classification', 'object_detection', 'text_extraction', 'metadata'],
                hierarchical_tagging: true,
                semantic_grouping: true
            },
            
            // Tag filtering and quality
            tag_filtering: {
                blacklisted_tags: ['unknown', 'other', 'misc', 'unidentified'],
                minimum_tag_length: 3,
                maximum_tag_length: 30,
                profanity_filter: true,
                duplicate_removal: true
            },
            
            // Tag categories and weights
            tag_categories: {
                content: { weight: 1.0, priority: 'high' },
                style: { weight: 0.8, priority: 'medium' },
                color: { weight: 0.6, priority: 'medium' },
                mood: { weight: 0.7, priority: 'medium' },
                technical: { weight: 0.5, priority: 'low' },
                metadata: { weight: 0.4, priority: 'low' }
            }
        };
        
        // Processing queue configuration
        this.processingConfig = {
            batch_size: 10,
            max_concurrent_jobs: 5,
            retry_attempts: 3,
            retry_delay_ms: 2000,
            processing_timeout_ms: 30000,
            
            // Image preprocessing
            image_preprocessing: {
                resize_for_classification: true,
                target_size: [224, 224],
                normalize: true,
                data_augmentation: false // Only for training
            },
            
            // Performance optimization
            caching: {
                cache_results: true,
                cache_duration_hours: 24,
                cache_by_hash: true
            }
        };
        
        // Feature extraction configuration
        this.featureConfig = {
            visual_features: {
                color_histogram: true,
                edge_detection: true,
                texture_analysis: true,
                shape_descriptors: true,
                deep_features: true // From pre-trained CNN
            },
            
            similarity_matching: {
                enabled: true,
                similarity_threshold: 0.8,
                max_similar_images: 50,
                feature_vector_dimensions: 2048
            },
            
            clustering: {
                enabled: true,
                clustering_algorithm: 'kmeans',
                min_cluster_size: 5,
                max_clusters: 100,
                recalculate_interval_hours: 24
            }
        };
        
        // Processing queues and caches
        this.processingQueue = [];
        this.activeJobs = new Map();
        this.classificationCache = new Map();
        this.featureCache = new Map();
        
        // Model state and performance tracking
        this.modelState = {
            content_classifier: { loaded: false, performance: null },
            safety_classifier: { loaded: false, performance: null },
            aesthetic_classifier: { loaded: false, performance: null },
            domain_classifier: { loaded: false, performance: null }
        };
        
        // Performance metrics
        this.performanceMetrics = {
            images_processed: 0,
            classification_latency: [],
            tagging_accuracy: [],
            queue_processing_time: [],
            model_inference_time: [],
            cache_hit_rate: 0,
            error_rate: 0
        };
    }
    
    /**
     * Initialize the image classification service
     */
    async initialize() {
        try {
            console.log('🖼️ Initializing Image Classification Service...');
            
            // Initialize database connection
            this.db = await mysql.createConnection({
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_DATABASE || 'phoenix4ge'
            });
            
            // Initialize Redis for caching and queue management
            this.redis = Redis.createClient({
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379
            });
            await this.redis.connect();
            
            // Initialize classification-specific Redis (separate DB)
            this.classificationRedis = Redis.createClient({
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                db: 6 // Use database 6 for image classification
            });
            await this.classificationRedis.connect();
            
            // Load and initialize ML models
            await this.loadClassificationModels();
            
            // Initialize feature extraction pipeline
            await this.initializeFeatureExtraction();
            
            // Start processing queue workers
            this.startQueueProcessors();
            
            // Start batch processing scheduler
            this.startBatchProcessor();
            
            // Start performance monitoring
            this.startPerformanceMonitoring();
            
            console.log('✅ Image Classification Service initialized successfully');
            console.log(`📊 Loaded ${Object.keys(this.modelState).filter(k => this.modelState[k].loaded).length} classification models`);
            
            this.emit('initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize Image Classification Service:', error);
            throw error;
        }
    }
    
    /**
     * Classify and tag a single image
     */
    async classifyAndTagImage(imageId, imagePath, options = {}) {
        try {
            const startTime = Date.now();
            
            console.log(`🔍 Classifying image: ${imageId}`);
            
            // Check cache first
            const cacheKey = await this.generateImageHash(imagePath);
            const cachedResult = await this.classificationRedis.get(`classification:${cacheKey}`);
            
            if (cachedResult && !options.forceRefresh) {
                const cached = JSON.parse(cachedResult);
                console.log('📚 Returning cached classification result');
                return cached;
            }
            
            // Load and preprocess image
            const imageData = await this.loadAndPreprocessImage(imagePath);
            
            // Perform multi-model classification
            const classifications = await this.performMultiModelClassification(imageData, options);
            
            // Extract visual features
            const visualFeatures = await this.extractVisualFeatures(imageData);
            
            // Generate automated tags
            const generatedTags = await this.generateAutomatedTags(classifications, visualFeatures, imageId);
            
            // Perform content safety analysis
            const safetyAnalysis = await this.performSafetyAnalysis(imageData, classifications);
            
            // Find similar images
            const similarImages = await this.findSimilarImages(visualFeatures, imageId);
            
            // Calculate confidence scores and quality metrics
            const qualityMetrics = this.calculateQualityMetrics(classifications, visualFeatures);
            
            // Compile final result
            const result = {
                image_id: imageId,
                classifications: classifications,
                visual_features: visualFeatures,
                generated_tags: generatedTags,
                safety_analysis: safetyAnalysis,
                similar_images: similarImages,
                quality_metrics: qualityMetrics,
                processing_metadata: {
                    cache_key: cacheKey,
                    models_used: Object.keys(classifications),
                    processing_time_ms: Date.now() - startTime,
                    processed_at: new Date().toISOString()
                }
            };
            
            // Store results in database
            await this.storeClassificationResults(result);
            
            // Cache results
            await this.classificationRedis.setEx(
                `classification:${cacheKey}`,
                this.processingConfig.caching.cache_duration_hours * 3600,
                JSON.stringify(result)
            );
            
            // Update performance metrics
            const processingTime = Date.now() - startTime;
            this.performanceMetrics.classification_latency.push(processingTime);
            this.performanceMetrics.images_processed++;
            
            console.log(`✅ Classified image ${imageId} in ${processingTime}ms`);
            console.log(`🏷️ Generated ${generatedTags.tags.length} tags with avg confidence ${(generatedTags.average_confidence * 100).toFixed(1)}%`);
            
            this.emit('image-classified', {
                imageId,
                classifications: Object.keys(classifications).length,
                tags: generatedTags.tags.length,
                processingTime,
                safetyScore: safetyAnalysis.safety_score
            });
            
            return result;
            
        } catch (error) {
            console.error(`Error classifying image ${imageId}:`, error);
            this.performanceMetrics.error_rate++;
            
            return {
                image_id: imageId,
                error: true,
                error_message: error.message,
                processed_at: new Date().toISOString()
            };
        }
    }
    
    /**
     * Batch process multiple images
     */
    async batchProcessImages(imageList, options = {}) {
        try {
            const startTime = Date.now();
            console.log(`📦 Starting batch processing of ${imageList.length} images`);
            
            const {
                concurrent = this.processingConfig.max_concurrent_jobs,
                progressCallback = null,
                skipExisting = true
            } = options;
            
            // Filter out already processed images if requested
            let imagesToProcess = imageList;
            if (skipExisting) {
                imagesToProcess = await this.filterUnprocessedImages(imageList);
                console.log(`📋 Filtered to ${imagesToProcess.length} unprocessed images`);
            }
            
            // Process images in batches
            const results = [];
            const errors = [];
            let processed = 0;
            
            // Create processing batches
            const batches = this.createProcessingBatches(imagesToProcess, this.processingConfig.batch_size);
            
            for (const batch of batches) {
                // Process batch with concurrency control
                const batchPromises = batch.map(async (imageInfo) => {
                    try {
                        const result = await this.classifyAndTagImage(
                            imageInfo.id,
                            imageInfo.path,
                            options
                        );
                        processed++;
                        
                        // Call progress callback if provided
                        if (progressCallback) {
                            progressCallback({
                                processed,
                                total: imagesToProcess.length,
                                current: imageInfo,
                                result
                            });
                        }
                        
                        return result;
                    } catch (error) {
                        console.error(`Batch processing error for image ${imageInfo.id}:`, error);
                        errors.push({ imageId: imageInfo.id, error: error.message });
                        return null;
                    }
                });
                
                const batchResults = await Promise.allSettled(batchPromises);
                
                // Collect successful results
                batchResults.forEach((result, index) => {
                    if (result.status === 'fulfilled' && result.value) {
                        results.push(result.value);
                    }
                });
                
                // Brief pause between batches to prevent overwhelming
                if (batch !== batches[batches.length - 1]) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            
            const totalTime = Date.now() - startTime;
            
            // Update batch processing metrics
            this.performanceMetrics.queue_processing_time.push(totalTime);
            
            console.log(`✅ Batch processing completed: ${results.length} successful, ${errors.length} errors in ${totalTime}ms`);
            
            // Generate batch summary and insights
            const summary = this.generateBatchProcessingSummary(results, errors, totalTime);
            
            this.emit('batch-processed', {
                total: imageList.length,
                processed: results.length,
                errors: errors.length,
                duration: totalTime,
                summary
            });
            
            return {
                success: true,
                processed: results.length,
                errors: errors.length,
                results,
                error_details: errors,
                summary,
                processing_time_ms: totalTime
            };
            
        } catch (error) {
            console.error('Batch processing error:', error);
            throw error;
        }
    }
    
    /**
     * Perform multi-model classification on image data
     */
    async performMultiModelClassification(imageData, options = {}) {
        try {
            const classifications = {};
            
            // Content classification
            if (this.modelConfig.content_classifier.enabled) {
                classifications.content = await this.classifyContent(imageData);
            }
            
            // Safety classification
            if (this.modelConfig.safety_classifier.enabled) {
                classifications.safety = await this.classifySafety(imageData);
            }
            
            // Aesthetic classification
            if (this.modelConfig.aesthetic_classifier.enabled) {
                classifications.aesthetic = await this.classifyAesthetics(imageData);
            }
            
            // Domain-specific classification
            if (this.modelConfig.domain_classifier.enabled) {
                classifications.domain = await this.classifyDomain(imageData);
            }
            
            // Calculate ensemble predictions
            classifications.ensemble = this.calculateEnsemblePredictions(classifications);
            
            return classifications;
            
        } catch (error) {
            console.error('Multi-model classification error:', error);
            return {};
        }
    }
    
    /**
     * Generate automated tags from classifications and features
     */
    async generateAutomatedTags(classifications, visualFeatures, imageId) {
        try {
            const allTags = [];
            const tagSources = {};
            
            // Extract tags from classifications
            for (const [source, classResult] of Object.entries(classifications)) {
                if (classResult && classResult.predictions) {
                    const sourceTags = this.extractTagsFromClassification(classResult, source);
                    allTags.push(...sourceTags);
                    tagSources[source] = sourceTags.length;
                }
            }
            
            // Extract tags from visual features
            const visualTags = this.extractTagsFromVisualFeatures(visualFeatures);
            allTags.push(...visualTags);
            tagSources.visual_features = visualTags.length;
            
            // Extract tags from metadata if available
            const metadataTags = await this.extractTagsFromMetadata(imageId);
            allTags.push(...metadataTags);
            tagSources.metadata = metadataTags.length;
            
            // Filter and process tags
            const processedTags = await this.processAndFilterTags(allTags);
            
            // Apply semantic grouping and hierarchical organization
            const organizedTags = await this.organizeTagsHierarchically(processedTags);
            
            // Calculate confidence scores
            const tagConfidences = this.calculateTagConfidences(organizedTags, classifications);
            
            // Final tag selection based on configuration
            const finalTags = this.selectFinalTags(organizedTags, tagConfidences);
            
            return {
                tags: finalTags,
                tag_sources: tagSources,
                total_candidates: allTags.length,
                final_count: finalTags.length,
                average_confidence: finalTags.length > 0 
                    ? finalTags.reduce((sum, tag) => sum + tag.confidence, 0) / finalTags.length 
                    : 0,
                processing_metadata: {
                    hierarchical_organization: organizedTags.hierarchy || {},
                    semantic_groups: organizedTags.groups || [],
                    filtered_count: allTags.length - processedTags.length
                }
            };
            
        } catch (error) {
            console.error('Tag generation error:', error);
            return {
                tags: [],
                error: error.message,
                processing_metadata: { error: true }
            };
        }
    }
    
    /**
     * Find similar images based on visual features
     */
    async findSimilarImages(visualFeatures, currentImageId, maxResults = 10) {
        try {
            // Get feature vector for comparison
            const queryVector = visualFeatures.deep_features || visualFeatures.combined_features;
            
            if (!queryVector || queryVector.length === 0) {
                return { similar_images: [], similarity_method: 'none' };
            }
            
            // Query database for images with similar feature vectors
            const [similarImages] = await this.db.execute(`
                SELECT 
                    ic.image_id,
                    ic.feature_vector,
                    gi.title,
                    gi.image_url,
                    gi.category,
                    ic.visual_similarity_score
                FROM image_classification_results ic
                JOIN gallery_images gi ON ic.image_id = gi.id
                WHERE ic.image_id != ?
                  AND ic.feature_vector IS NOT NULL
                  AND gi.is_active = TRUE
                ORDER BY ic.updated_at DESC
                LIMIT 500
            `, [currentImageId]);
            
            // Calculate similarity scores
            const similarities = [];
            
            for (const candidate of similarImages) {
                try {
                    const candidateVector = JSON.parse(candidate.feature_vector);
                    const similarity = this.calculateCosineSimilarity(queryVector, candidateVector);
                    
                    if (similarity >= this.featureConfig.similarity_matching.similarity_threshold) {
                        similarities.push({
                            image_id: candidate.image_id,
                            title: candidate.title,
                            image_url: candidate.image_url,
                            category: candidate.category,
                            similarity_score: similarity,
                            similarity_method: 'cosine'
                        });
                    }
                } catch (vectorError) {
                    // Skip images with invalid feature vectors
                    continue;
                }
            }
            
            // Sort by similarity and take top results
            similarities.sort((a, b) => b.similarity_score - a.similarity_score);
            const topSimilar = similarities.slice(0, maxResults);
            
            return {
                similar_images: topSimilar,
                similarity_method: 'cosine_similarity',
                total_candidates: similarImages.length,
                matches_found: topSimilar.length,
                threshold_used: this.featureConfig.similarity_matching.similarity_threshold
            };
            
        } catch (error) {
            console.error('Similar images search error:', error);
            return {
                similar_images: [],
                error: error.message
            };
        }
    }
    
    /**
     * Get classification results for image
     */
    async getImageClassification(imageId, includeFeatures = false) {
        try {
            const [results] = await this.db.execute(`
                SELECT * FROM image_classification_results WHERE image_id = ?
            `, [imageId]);
            
            if (results.length === 0) {
                return { error: 'Classification not found', image_id: imageId };
            }
            
            const classification = results[0];
            
            // Parse JSON fields
            const parsedResult = {
                ...classification,
                classifications: JSON.parse(classification.classifications || '{}'),
                generated_tags: JSON.parse(classification.generated_tags || '[]'),
                safety_analysis: JSON.parse(classification.safety_analysis || '{}'),
                quality_metrics: JSON.parse(classification.quality_metrics || '{}'),
                processing_metadata: JSON.parse(classification.processing_metadata || '{}')
            };
            
            if (includeFeatures) {
                parsedResult.visual_features = JSON.parse(classification.visual_features || '{}');
                parsedResult.feature_vector = JSON.parse(classification.feature_vector || '[]');
            }
            
            // Get similar images if requested
            if (includeFeatures && parsedResult.feature_vector.length > 0) {
                parsedResult.similar_images = await this.findSimilarImages(
                    { combined_features: parsedResult.feature_vector },
                    imageId
                );
            }
            
            return parsedResult;
            
        } catch (error) {
            console.error('Error getting image classification:', error);
            return { error: error.message, image_id: imageId };
        }
    }
    
    /**
     * Update image tags based on user feedback
     */
    async updateImageTags(imageId, userTags, userId) {
        try {
            console.log(`🏷️ Updating tags for image ${imageId} by user ${userId}`);
            
            // Get current classification results
            const currentResult = await this.getImageClassification(imageId);
            if (currentResult.error) {
                throw new Error('Image classification not found');
            }
            
            // Store user feedback for model improvement
            await this.db.execute(`
                INSERT INTO image_tag_feedback (
                    image_id,
                    user_id,
                    original_tags,
                    user_tags,
                    feedback_type,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, NOW())
            `, [
                imageId,
                userId,
                JSON.stringify(currentResult.generated_tags),
                JSON.stringify(userTags),
                'manual_correction'
            ]);
            
            // Update the classification results with user tags
            const updatedTags = this.mergeUserAndAutoTags(currentResult.generated_tags, userTags);
            
            await this.db.execute(`
                UPDATE image_classification_results 
                SET generated_tags = ?,
                    user_modified = TRUE,
                    updated_at = NOW()
                WHERE image_id = ?
            `, [JSON.stringify(updatedTags), imageId]);
            
            // Invalidate cache
            const cacheKeys = await this.classificationRedis.keys(`classification:*${imageId}*`);
            if (cacheKeys.length > 0) {
                await this.classificationRedis.del(...cacheKeys);
            }
            
            // Update model training data for improvement
            this.scheduleModelRetraining(imageId, userTags);
            
            this.emit('tags-updated', {
                imageId,
                userId,
                originalTagCount: currentResult.generated_tags.length,
                updatedTagCount: updatedTags.length
            });
            
            return {
                success: true,
                image_id: imageId,
                updated_tags: updatedTags,
                feedback_recorded: true
            };
            
        } catch (error) {
            console.error('Error updating image tags:', error);
            throw error;
        }
    }
    
    // Utility methods
    
    async loadAndPreprocessImage(imagePath) {
        try {
            // Load image using Sharp
            const imageBuffer = await fs.readFile(imagePath);
            const image = sharp(imageBuffer);
            
            // Get image metadata
            const metadata = await image.metadata();
            
            // Resize for classification if needed
            let processedImage = image;
            if (this.processingConfig.image_preprocessing.resize_for_classification) {
                const [targetWidth, targetHeight] = this.processingConfig.image_preprocessing.target_size;
                processedImage = image.resize(targetWidth, targetHeight, {
                    fit: 'cover',
                    position: 'center'
                });
            }
            
            // Convert to RGB and normalize
            const rgbBuffer = await processedImage
                .removeAlpha()
                .toColorspace('srgb')
                .raw()
                .toBuffer();
            
            return {
                original_path: imagePath,
                metadata: metadata,
                processed_buffer: rgbBuffer,
                dimensions: {
                    width: metadata.width,
                    height: metadata.height,
                    channels: metadata.channels
                }
            };
            
        } catch (error) {
            console.error('Image preprocessing error:', error);
            throw error;
        }
    }
    
    calculateCosineSimilarity(vectorA, vectorB) {
        if (vectorA.length !== vectorB.length) {
            return 0;
        }
        
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        
        for (let i = 0; i < vectorA.length; i++) {
            dotProduct += vectorA[i] * vectorB[i];
            normA += vectorA[i] * vectorA[i];
            normB += vectorB[i] * vectorB[i];
        }
        
        normA = Math.sqrt(normA);
        normB = Math.sqrt(normB);
        
        if (normA === 0 || normB === 0) {
            return 0;
        }
        
        return dotProduct / (normA * normB);
    }
    
    async generateImageHash(imagePath) {
        try {
            const buffer = await fs.readFile(imagePath);
            return crypto.createHash('sha256').update(buffer).digest('hex');
        } catch (error) {
            // Fallback to path-based hash
            return crypto.createHash('sha256').update(imagePath).digest('hex');
        }
    }
    
    /**
     * Get service health status
     */
    async getHealthStatus() {
        try {
            const redisConnected = this.redis && this.redis.isReady;
            const classificationRedisConnected = this.classificationRedis && this.classificationRedis.isReady;
            const dbConnected = this.db && await this.db.ping();
            
            const avgClassificationLatency = this.performanceMetrics.classification_latency.length > 0
                ? this.performanceMetrics.classification_latency.reduce((a, b) => a + b, 0) / this.performanceMetrics.classification_latency.length
                : 0;
            
            const modelsLoaded = Object.values(this.modelState).filter(state => state.loaded).length;
            const totalModels = Object.keys(this.modelState).length;
            
            return {
                status: redisConnected && classificationRedisConnected && dbConnected ? 'healthy' : 'degraded',
                components: {
                    redis: redisConnected,
                    classificationRedis: classificationRedisConnected,
                    database: dbConnected
                },
                models: {
                    loaded: modelsLoaded,
                    total: totalModels,
                    loading_status: this.modelState
                },
                processing: {
                    images_processed: this.performanceMetrics.images_processed,
                    queue_size: this.processingQueue.length,
                    active_jobs: this.activeJobs.size,
                    error_rate: this.performanceMetrics.error_rate,
                    avg_classification_latency: Math.round(avgClassificationLatency)
                },
                cache: {
                    classification_cache_size: this.classificationCache.size,
                    feature_cache_size: this.featureCache.size,
                    cache_hit_rate: this.performanceMetrics.cache_hit_rate
                },
                uptime: process.uptime(),
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
            console.log('🔄 Shutting down Image Classification Service...');
            
            // Stop processing queues
            this.processingQueue = [];
            
            // Wait for active jobs to complete (with timeout)
            const activeJobPromises = Array.from(this.activeJobs.values());
            if (activeJobPromises.length > 0) {
                console.log(`⏳ Waiting for ${activeJobPromises.length} active jobs to complete...`);
                await Promise.allSettled(activeJobPromises);
            }
            
            if (this.redis) {
                await this.redis.disconnect();
            }
            
            if (this.classificationRedis) {
                await this.classificationRedis.disconnect();
            }
            
            if (this.db) {
                await this.db.end();
            }
            
            this.removeAllListeners();
            
            console.log('✅ Image Classification Service shutdown complete');
        } catch (error) {
            console.error('Error during service shutdown:', error);
        }
    }
}

module.exports = ImageClassificationService;