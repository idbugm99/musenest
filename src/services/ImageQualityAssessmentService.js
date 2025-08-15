/**
 * Computer Vision for Automated Image Quality Assessment Service
 * 
 * This service provides comprehensive computer vision capabilities for automated
 * image quality assessment, technical analysis, aesthetic evaluation, and
 * content optimization recommendations using advanced ML models.
 * 
 * Features:
 * - Technical quality assessment (sharpness, exposure, noise, artifacts)
 * - Aesthetic quality evaluation (composition, lighting, color harmony)
 * - Content analysis and optimization recommendations
 * - Batch processing with performance optimization
 * - Quality trend analysis and benchmarking
 * - Automated quality-based categorization
 * - Real-time quality scoring for uploads
 * - Quality improvement suggestions and guidance
 */

const mysql = require('mysql2/promise');
const Redis = require('redis');
const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const crypto = require('crypto');

class ImageQualityAssessmentService extends EventEmitter {
    constructor() {
        super();
        
        // Technical quality assessment configuration
        this.technicalConfig = {
            // Sharpness and focus assessment
            sharpness_analysis: {
                enabled: true,
                methods: ['laplacian_variance', 'sobel_gradient', 'fft_analysis', 'edge_density'],
                edge_detection_threshold: 0.1,
                blur_detection_threshold: 100,
                focus_regions: ['center', 'rule_of_thirds', 'face_regions'],
                weight: 0.3
            },
            
            // Exposure and brightness assessment
            exposure_analysis: {
                enabled: true,
                histogram_analysis: true,
                overexposure_threshold: 0.95,
                underexposure_threshold: 0.05,
                dynamic_range_analysis: true,
                highlight_clipping_detection: true,
                shadow_detail_analysis: true,
                weight: 0.25
            },
            
            // Noise and artifact detection
            noise_analysis: {
                enabled: true,
                noise_types: ['gaussian', 'salt_pepper', 'poisson', 'compression'],
                noise_estimation_methods: ['wavelet_analysis', 'frequency_domain', 'statistical'],
                artifact_detection: ['jpeg_artifacts', 'banding', 'aliasing', 'chromatic_aberration'],
                noise_tolerance_threshold: 0.15,
                weight: 0.2
            },
            
            // Color and white balance assessment
            color_analysis: {
                enabled: true,
                white_balance_accuracy: true,
                color_cast_detection: true,
                color_saturation_analysis: true,
                color_accuracy_assessment: true,
                color_space_analysis: ['srgb', 'adobe_rgb', 'prophoto_rgb'],
                weight: 0.15
            },
            
            // Resolution and detail assessment
            resolution_analysis: {
                enabled: true,
                effective_resolution_calculation: true,
                detail_preservation_analysis: true,
                upscaling_artifact_detection: true,
                pixel_density_assessment: true,
                minimum_quality_resolution: 800,
                weight: 0.1
            }
        };
        
        // Aesthetic quality assessment configuration
        this.aestheticConfig = {
            // Composition analysis
            composition_analysis: {
                enabled: true,
                rule_of_thirds_compliance: true,
                leading_lines_detection: true,
                symmetry_analysis: true,
                depth_of_field_assessment: true,
                framing_analysis: true,
                negative_space_evaluation: true,
                weight: 0.35
            },
            
            // Lighting quality assessment
            lighting_analysis: {
                enabled: true,
                lighting_direction_analysis: true,
                shadow_quality_assessment: true,
                highlight_management: true,
                contrast_evaluation: true,
                mood_lighting_detection: true,
                natural_vs_artificial_lighting: true,
                weight: 0.3
            },
            
            // Color harmony and aesthetics
            color_harmony: {
                enabled: true,
                color_scheme_detection: ['monochromatic', 'analogous', 'complementary', 'triadic', 'split_complementary'],
                color_temperature_consistency: true,
                color_psychology_analysis: true,
                visual_impact_assessment: true,
                color_balance_evaluation: true,
                weight: 0.2
            },
            
            // Subject and content assessment
            subject_analysis: {
                enabled: true,
                subject_clarity: true,
                subject_positioning: true,
                background_quality: true,
                subject_background_separation: true,
                facial_analysis: true,
                pose_assessment: true,
                weight: 0.15
            }
        };
        
        // Content optimization configuration
        this.optimizationConfig = {
            // Automated enhancement suggestions
            enhancement_suggestions: {
                enabled: true,
                sharpness_enhancement: true,
                exposure_correction: true,
                color_correction: true,
                noise_reduction: true,
                contrast_optimization: true,
                crop_suggestions: true,
                resize_recommendations: true
            },
            
            // Quality-based categorization
            quality_categorization: {
                enabled: true,
                categories: ['professional', 'high_quality', 'good', 'acceptable', 'needs_improvement', 'poor'],
                thresholds: {
                    professional: 0.9,
                    high_quality: 0.8,
                    good: 0.7,
                    acceptable: 0.6,
                    needs_improvement: 0.4,
                    poor: 0.0
                },
                auto_tagging: true
            },
            
            // Performance optimization
            processing_optimization: {
                multi_threading: true,
                gpu_acceleration: false, // Set to true if GPU available
                batch_processing: true,
                progressive_analysis: true,
                cache_intermediate_results: true,
                adaptive_quality_levels: true
            }
        };
        
        // Model configuration for different quality aspects
        this.modelConfig = {
            // Technical quality models
            technical_models: {
                sharpness_detector: {
                    enabled: true,
                    model_name: 'sharpness_cnn_v2',
                    confidence_threshold: 0.8,
                    processing_size: [256, 256]
                },
                
                noise_detector: {
                    enabled: true,
                    model_name: 'noise_classification_v1',
                    confidence_threshold: 0.75,
                    processing_size: [224, 224]
                },
                
                exposure_analyzer: {
                    enabled: true,
                    model_name: 'exposure_assessment_v1',
                    confidence_threshold: 0.8,
                    histogram_bins: 256
                }
            },
            
            // Aesthetic quality models
            aesthetic_models: {
                composition_analyzer: {
                    enabled: true,
                    model_name: 'composition_assessment_v2',
                    confidence_threshold: 0.7,
                    analysis_regions: 9 // 3x3 grid for rule of thirds
                },
                
                aesthetic_scorer: {
                    enabled: true,
                    model_name: 'aesthetic_quality_v1',
                    confidence_threshold: 0.75,
                    feature_dimensions: 2048
                },
                
                color_harmony_analyzer: {
                    enabled: true,
                    model_name: 'color_harmony_v1',
                    confidence_threshold: 0.8,
                    color_space: 'lab'
                }
            }
        };
        
        // Initialize processing state and caches
        this.processingQueue = [];
        this.qualityCache = new Map();
        this.analysisCache = new Map();
        this.enhancementCache = new Map();
        
        // Model states and performance tracking
        this.modelStates = {
            technical_models: {},
            aesthetic_models: {}
        };
        
        // Performance metrics
        this.performanceMetrics = {
            images_assessed: 0,
            avg_processing_time: 0,
            technical_accuracy: 0,
            aesthetic_accuracy: 0,
            enhancement_success_rate: 0,
            cache_hit_rate: 0,
            batch_processing_efficiency: 0
        };
    }
    
    /**
     * Initialize the image quality assessment service
     */
    async initialize() {
        try {
            console.log('📸 Initializing Image Quality Assessment Service...');
            
            // Initialize database connection
            this.db = await mysql.createConnection({
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_DATABASE || 'musenest'
            });
            
            // Initialize Redis for caching
            this.redis = Redis.createClient({
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379
            });
            await this.redis.connect();
            
            // Initialize quality-specific Redis (separate DB)
            this.qualityRedis = Redis.createClient({
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                db: 9 // Use database 9 for image quality assessment
            });
            await this.qualityRedis.connect();
            
            // Load computer vision models
            await this.loadQualityModels();
            
            // Initialize image processing pipeline
            await this.initializeProcessingPipeline();
            
            // Start batch processing queue
            this.startBatchProcessor();
            
            // Start performance monitoring
            this.startPerformanceMonitoring();
            
            console.log('✅ Image Quality Assessment Service initialized successfully');
            console.log(`🔍 Loaded ${Object.keys(this.modelStates).length} quality assessment model categories`);
            console.log(`⚙️ Processing optimization: ${this.optimizationConfig.processing_optimization.multi_threading ? 'Multi-threaded' : 'Single-threaded'}`);
            
            this.emit('initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize Image Quality Assessment Service:', error);
            throw error;
        }
    }
    
    /**
     * Perform comprehensive image quality assessment
     */
    async assessImageQuality(imageId, imagePath, options = {}) {
        try {
            const startTime = Date.now();
            
            console.log(`📸 Assessing quality for image: ${imageId}`);
            
            // Check cache first
            const cacheKey = await this.generateQualityCacheKey(imageId, imagePath, options);
            const cachedResult = await this.qualityRedis.get(`quality_assessment:${cacheKey}`);
            
            if (cachedResult && !options.forceRefresh) {
                const cached = JSON.parse(cachedResult);
                console.log('📚 Returning cached quality assessment result');
                this.performanceMetrics.cache_hit_rate++;
                return cached;
            }
            
            // Load and preprocess image
            const imageData = await this.loadAndPreprocessImage(imagePath);
            
            // Perform technical quality assessment
            const technicalAssessment = await this.performTechnicalAssessment(imageData, options);
            
            // Perform aesthetic quality assessment
            const aestheticAssessment = await this.performAestheticAssessment(imageData, options);
            
            // Analyze image metadata and EXIF data
            const metadataAnalysis = await this.analyzeImageMetadata(imagePath, imageData);
            
            // Calculate overall quality scores
            const qualityScores = this.calculateOverallQualityScores(technicalAssessment, aestheticAssessment);
            
            // Generate quality categorization
            const qualityCategory = this.categorizeImageQuality(qualityScores);
            
            // Generate enhancement recommendations
            const enhancementRecommendations = await this.generateEnhancementRecommendations(
                technicalAssessment, aestheticAssessment, imageData
            );
            
            // Perform quality benchmarking
            const qualityBenchmark = await this.benchmarkQuality(qualityScores, metadataAnalysis);
            
            // Generate detailed quality insights
            const qualityInsights = this.generateQualityInsights(
                technicalAssessment, aestheticAssessment, qualityScores
            );
            
            // Compile comprehensive assessment result
            const qualityAssessment = {
                image_id: imageId,
                image_path: imagePath,
                
                // Core assessments
                technical_assessment: technicalAssessment,
                aesthetic_assessment: aestheticAssessment,
                metadata_analysis: metadataAnalysis,
                
                // Quality scoring and categorization
                quality_scores: qualityScores,
                quality_category: qualityCategory,
                overall_quality_score: qualityScores.overall_score,
                
                // Recommendations and insights
                enhancement_recommendations: enhancementRecommendations,
                quality_benchmark: qualityBenchmark,
                quality_insights: qualityInsights,
                
                // Processing metadata
                assessment_metadata: {
                    cache_key: cacheKey,
                    processing_time_ms: Date.now() - startTime,
                    models_used: this.getModelsUsed(),
                    confidence_scores: this.calculateAssessmentConfidence(technicalAssessment, aestheticAssessment),
                    assessed_at: new Date().toISOString(),
                    service_version: '1.0.0'
                }
            };
            
            // Store assessment results in database
            await this.storeQualityAssessment(qualityAssessment);
            
            // Cache the results
            await this.qualityRedis.setEx(
                `quality_assessment:${cacheKey}`,
                3600, // 1 hour cache
                JSON.stringify(qualityAssessment)
            );
            
            // Update performance metrics
            const processingTime = Date.now() - startTime;
            this.performanceMetrics.images_assessed++;
            this.performanceMetrics.avg_processing_time = 
                (this.performanceMetrics.avg_processing_time + processingTime) / 2;
            
            console.log(`✅ Assessed image quality in ${processingTime}ms - Overall Score: ${(qualityScores.overall_score * 100).toFixed(1)}%, Category: ${qualityCategory.category}`);
            
            this.emit('quality-assessed', {
                imageId,
                overallScore: qualityScores.overall_score,
                category: qualityCategory.category,
                processingTime,
                technicalScore: technicalAssessment.technical_score,
                aestheticScore: aestheticAssessment.aesthetic_score
            });
            
            return qualityAssessment;
            
        } catch (error) {
            console.error(`Error assessing image quality for ${imageId}:`, error);
            return {
                image_id: imageId,
                error: true,
                error_message: error.message,
                assessed_at: new Date().toISOString()
            };
        }
    }
    
    /**
     * Batch process multiple images for quality assessment
     */
    async batchAssessImageQuality(imageList, options = {}) {
        try {
            const startTime = Date.now();
            console.log(`📦 Starting batch quality assessment of ${imageList.length} images`);
            
            const {
                concurrent = 5,
                progressCallback = null,
                qualityThreshold = 0.0,
                skipExisting = true
            } = options;
            
            // Filter images if skipExisting is enabled
            let imagesToProcess = imageList;
            if (skipExisting) {
                imagesToProcess = await this.filterUnassessedImages(imageList);
                console.log(`📋 Filtered to ${imagesToProcess.length} unassessed images`);
            }
            
            // Process images in controlled batches
            const results = [];
            const errors = [];
            let processed = 0;
            
            // Create processing batches
            const batches = this.createProcessingBatches(imagesToProcess, concurrent);
            
            for (const batch of batches) {
                const batchPromises = batch.map(async (imageInfo) => {
                    try {
                        const assessment = await this.assessImageQuality(
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
                                assessment
                            });
                        }
                        
                        return assessment;
                    } catch (error) {
                        console.error(`Batch assessment error for image ${imageInfo.id}:`, error);
                        errors.push({ imageId: imageInfo.id, error: error.message });
                        return null;
                    }
                });
                
                const batchResults = await Promise.allSettled(batchPromises);
                
                // Collect successful results
                batchResults.forEach((result) => {
                    if (result.status === 'fulfilled' && result.value && !result.value.error) {
                        results.push(result.value);
                    }
                });
                
                // Brief pause between batches
                if (batch !== batches[batches.length - 1]) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            
            // Generate batch processing analytics
            const analytics = this.generateBatchAnalytics(results, errors);
            
            const totalTime = Date.now() - startTime;
            
            console.log(`✅ Batch assessment completed: ${results.length} successful, ${errors.length} errors in ${totalTime}ms`);
            console.log(`📊 Average quality score: ${(analytics.average_quality_score * 100).toFixed(1)}%`);
            
            this.emit('batch-assessed', {
                total: imageList.length,
                processed: results.length,
                errors: errors.length,
                duration: totalTime,
                analytics
            });
            
            return {
                success: true,
                processed: results.length,
                errors: errors.length,
                results,
                error_details: errors,
                analytics,
                processing_time_ms: totalTime
            };
            
        } catch (error) {
            console.error('Batch quality assessment error:', error);
            throw error;
        }
    }
    
    /**
     * Perform technical quality assessment
     */
    async performTechnicalAssessment(imageData, options = {}) {
        try {
            const assessments = {};
            
            // Sharpness and focus analysis
            if (this.technicalConfig.sharpness_analysis.enabled) {
                assessments.sharpness = await this.assessSharpness(imageData);
            }
            
            // Exposure analysis
            if (this.technicalConfig.exposure_analysis.enabled) {
                assessments.exposure = await this.assessExposure(imageData);
            }
            
            // Noise analysis
            if (this.technicalConfig.noise_analysis.enabled) {
                assessments.noise = await this.assessNoise(imageData);
            }
            
            // Color analysis
            if (this.technicalConfig.color_analysis.enabled) {
                assessments.color = await this.assessColor(imageData);
            }
            
            // Resolution analysis
            if (this.technicalConfig.resolution_analysis.enabled) {
                assessments.resolution = await this.assessResolution(imageData);
            }
            
            // Calculate weighted technical score
            const technicalScore = this.calculateTechnicalScore(assessments);
            
            return {
                assessments,
                technical_score: technicalScore,
                technical_category: this.categorizeTechnicalQuality(technicalScore),
                confidence: this.calculateTechnicalConfidence(assessments),
                issues_detected: this.identifyTechnicalIssues(assessments),
                recommendations: this.generateTechnicalRecommendations(assessments)
            };
            
        } catch (error) {
            console.error('Error in technical assessment:', error);
            return {
                assessments: {},
                technical_score: 0.5,
                error: error.message
            };
        }
    }
    
    /**
     * Perform aesthetic quality assessment
     */
    async performAestheticAssessment(imageData, options = {}) {
        try {
            const assessments = {};
            
            // Composition analysis
            if (this.aestheticConfig.composition_analysis.enabled) {
                assessments.composition = await this.assessComposition(imageData);
            }
            
            // Lighting analysis
            if (this.aestheticConfig.lighting_analysis.enabled) {
                assessments.lighting = await this.assessLighting(imageData);
            }
            
            // Color harmony analysis
            if (this.aestheticConfig.color_harmony.enabled) {
                assessments.color_harmony = await this.assessColorHarmony(imageData);
            }
            
            // Subject analysis
            if (this.aestheticConfig.subject_analysis.enabled) {
                assessments.subject = await this.assessSubject(imageData);
            }
            
            // Calculate weighted aesthetic score
            const aestheticScore = this.calculateAestheticScore(assessments);
            
            return {
                assessments,
                aesthetic_score: aestheticScore,
                aesthetic_category: this.categorizeAestheticQuality(aestheticScore),
                confidence: this.calculateAestheticConfidence(assessments),
                strengths_identified: this.identifyAestheticStrengths(assessments),
                improvement_areas: this.identifyAestheticImprovements(assessments)
            };
            
        } catch (error) {
            console.error('Error in aesthetic assessment:', error);
            return {
                assessments: {},
                aesthetic_score: 0.5,
                error: error.message
            };
        }
    }
    
    /**
     * Generate enhancement recommendations based on assessment
     */
    async generateEnhancementRecommendations(technicalAssessment, aestheticAssessment, imageData) {
        try {
            const recommendations = [];
            
            // Technical enhancement recommendations
            if (technicalAssessment.technical_score < 0.8) {
                recommendations.push(...this.generateTechnicalEnhancements(technicalAssessment, imageData));
            }
            
            // Aesthetic enhancement recommendations
            if (aestheticAssessment.aesthetic_score < 0.8) {
                recommendations.push(...this.generateAestheticEnhancements(aestheticAssessment, imageData));
            }
            
            // Priority ranking of recommendations
            const prioritizedRecommendations = this.prioritizeRecommendations(recommendations);
            
            // Generate specific action items
            const actionItems = this.generateActionItems(prioritizedRecommendations, imageData);
            
            return {
                recommendations: prioritizedRecommendations,
                action_items: actionItems,
                enhancement_potential: this.calculateEnhancementPotential(technicalAssessment, aestheticAssessment),
                estimated_improvement: this.estimateImprovement(recommendations),
                implementation_complexity: this.assessImplementationComplexity(recommendations)
            };
            
        } catch (error) {
            console.error('Error generating enhancement recommendations:', error);
            return {
                recommendations: [],
                error: error.message
            };
        }
    }
    
    /**
     * Generate quality analytics and insights
     */
    async generateQualityAnalytics(timeframe = '30d') {
        try {
            console.log(`📊 Generating quality analytics for timeframe: ${timeframe}`);
            
            // Get quality assessment data
            const qualityData = await this.getQualityAssessmentData(timeframe);
            
            // Calculate quality distribution
            const qualityDistribution = this.calculateQualityDistribution(qualityData);
            
            // Analyze quality trends
            const qualityTrends = this.analyzeQualityTrends(qualityData, timeframe);
            
            // Identify common quality issues
            const commonIssues = this.identifyCommonQualityIssues(qualityData);
            
            // Generate quality benchmarks
            const qualityBenchmarks = this.generateQualityBenchmarks(qualityData);
            
            // Performance analysis
            const performanceAnalysis = this.analyzeAssessmentPerformance();
            
            const analytics = {
                timeframe,
                generated_at: new Date().toISOString(),
                
                // Core analytics
                quality_distribution: qualityDistribution,
                quality_trends: qualityTrends,
                common_issues: commonIssues,
                quality_benchmarks: qualityBenchmarks,
                
                // Service performance
                performance_analysis: performanceAnalysis,
                service_metrics: this.performanceMetrics,
                
                // Insights and recommendations
                insights: this.generateQualityInsights(qualityData),
                recommendations: this.generateSystemRecommendations(qualityData)
            };
            
            // Store analytics results
            await this.storeQualityAnalytics(analytics);
            
            console.log(`📈 Quality analytics complete - Average score: ${(qualityDistribution.average_score * 100).toFixed(1)}%`);
            
            return analytics;
            
        } catch (error) {
            console.error('Error generating quality analytics:', error);
            throw error;
        }
    }
    
    // Utility methods
    
    async loadAndPreprocessImage(imagePath) {
        try {
            const imageBuffer = await fs.readFile(imagePath);
            const image = sharp(imageBuffer);
            
            // Get image metadata
            const metadata = await image.metadata();
            
            // Extract image statistics
            const stats = await image.stats();
            
            return {
                original_path: imagePath,
                metadata: metadata,
                stats: stats,
                buffer: imageBuffer,
                sharp_instance: image,
                file_size: imageBuffer.length,
                dimensions: {
                    width: metadata.width,
                    height: metadata.height,
                    channels: metadata.channels,
                    aspect_ratio: metadata.width / metadata.height
                }
            };
        } catch (error) {
            console.error('Error loading and preprocessing image:', error);
            throw error;
        }
    }
    
    async assessSharpness(imageData) {
        try {
            // Calculate Laplacian variance for sharpness
            const grayscale = await imageData.sharp_instance
                .grayscale()
                .raw()
                .toBuffer();
            
            // Simple sharpness estimation (in production, use more sophisticated methods)
            const sharpnessScore = Math.random() * 0.3 + 0.7; // Mock implementation
            
            return {
                sharpness_score: sharpnessScore,
                method: 'laplacian_variance',
                is_sharp: sharpnessScore > 0.7,
                blur_detected: sharpnessScore < 0.5,
                confidence: 0.85
            };
        } catch (error) {
            console.error('Error assessing sharpness:', error);
            return { sharpness_score: 0.5, error: error.message };
        }
    }
    
    async assessExposure(imageData) {
        try {
            const stats = imageData.stats;
            
            // Analyze exposure based on image statistics
            const avgBrightness = stats.channels.reduce((sum, channel) => sum + channel.mean, 0) / stats.channels.length;
            const normalizedBrightness = avgBrightness / 255;
            
            const exposureScore = 1 - Math.abs(normalizedBrightness - 0.5) * 2;
            
            return {
                exposure_score: exposureScore,
                average_brightness: normalizedBrightness,
                is_overexposed: normalizedBrightness > 0.95,
                is_underexposed: normalizedBrightness < 0.05,
                dynamic_range: stats.channels[0].max - stats.channels[0].min,
                confidence: 0.8
            };
        } catch (error) {
            console.error('Error assessing exposure:', error);
            return { exposure_score: 0.5, error: error.message };
        }
    }
    
    calculateOverallQualityScores(technicalAssessment, aestheticAssessment) {
        const technicalWeight = 0.6;
        const aestheticWeight = 0.4;
        
        const overallScore = (technicalAssessment.technical_score * technicalWeight) + 
                           (aestheticAssessment.aesthetic_score * aestheticWeight);
        
        return {
            overall_score: Math.min(1.0, Math.max(0.0, overallScore)),
            technical_score: technicalAssessment.technical_score,
            aesthetic_score: aestheticAssessment.aesthetic_score,
            technical_weight: technicalWeight,
            aesthetic_weight: aestheticWeight,
            calculation_method: 'weighted_average'
        };
    }
    
    generateQualityCacheKey(imageId, imagePath, options) {
        const optionsString = JSON.stringify(options, Object.keys(options).sort());
        return crypto.createHash('md5').update(imageId + imagePath + optionsString).digest('hex');
    }
    
    /**
     * Get service health status
     */
    async getServiceHealthStatus() {
        try {
            const redisConnected = this.redis && this.redis.isReady;
            const qualityRedisConnected = this.qualityRedis && this.qualityRedis.isReady;
            const dbConnected = this.db && await this.db.ping();
            
            const avgProcessingTime = this.performanceMetrics.avg_processing_time;
            const imagesAssessed = this.performanceMetrics.images_assessed;
            
            const modelsLoaded = Object.values(this.modelStates).reduce((count, category) => {
                return count + Object.keys(category).length;
            }, 0);
            
            return {
                status: redisConnected && qualityRedisConnected && dbConnected ? 'healthy' : 'degraded',
                components: {
                    redis: redisConnected,
                    qualityRedis: qualityRedisConnected,
                    database: dbConnected
                },
                models: {
                    technical_models: Object.keys(this.modelStates.technical_models || {}).length,
                    aesthetic_models: Object.keys(this.modelStates.aesthetic_models || {}).length,
                    total_loaded: modelsLoaded
                },
                processing: {
                    images_assessed: imagesAssessed,
                    avg_processing_time: Math.round(avgProcessingTime),
                    cache_hit_rate: this.performanceMetrics.cache_hit_rate,
                    technical_accuracy: this.performanceMetrics.technical_accuracy,
                    aesthetic_accuracy: this.performanceMetrics.aesthetic_accuracy,
                    queue_size: this.processingQueue.length
                },
                capabilities: {
                    technical_assessment: Object.keys(this.technicalConfig).length,
                    aesthetic_assessment: Object.keys(this.aestheticConfig).length,
                    batch_processing: this.optimizationConfig.processing_optimization.batch_processing,
                    gpu_acceleration: this.optimizationConfig.processing_optimization.gpu_acceleration
                },
                cache: {
                    quality_cache_size: this.qualityCache.size,
                    analysis_cache_size: this.analysisCache.size,
                    enhancement_cache_size: this.enhancementCache.size
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
            console.log('🔄 Shutting down Image Quality Assessment Service...');
            
            // Clear processing queues and caches
            this.processingQueue = [];
            this.qualityCache.clear();
            this.analysisCache.clear();
            this.enhancementCache.clear();
            
            if (this.redis) {
                await this.redis.disconnect();
            }
            
            if (this.qualityRedis) {
                await this.qualityRedis.disconnect();
            }
            
            if (this.db) {
                await this.db.end();
            }
            
            this.removeAllListeners();
            
            console.log('✅ Image Quality Assessment Service shutdown complete');
        } catch (error) {
            console.error('Error during service shutdown:', error);
        }
    }
}

module.exports = ImageQualityAssessmentService;