/**
 * AI-Powered Image Classification and Auto-Tagging API Routes
 * 
 * RESTful API endpoints for automated image analysis, classification, and intelligent tagging.
 * Provides computer vision capabilities, content safety analysis, and automated tag generation
 * with model performance tracking and user feedback integration.
 */

const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const multer = require('multer');
const path = require('path');

// Initialize Image Classification Service
let classificationService = null;

async function initializeService() {
    if (!classificationService) {
        const ImageClassificationService = require('../../src/services/ImageClassificationService');
        classificationService = new ImageClassificationService();
        await classificationService.initialize();
    }
    return classificationService;
}

// Middleware to ensure service is initialized
async function ensureServiceReady(req, res, next) {
    try {
        await initializeService();
        next();
    } catch (error) {
        console.error('Failed to initialize Image Classification Service:', error);
        res.status(503).json({
            error: 'Image Classification Service unavailable',
            details: error.message
        });
    }
}

// Configure multer for image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, process.env.UPLOAD_PATH || '/tmp/uploads');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'classification-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
        }
    }
});

/**
 * GET /api/image-classification/health
 * Get service health status and model information
 */
router.get('/health', ensureServiceReady, async (req, res) => {
    try {
        const health = await classificationService.getHealthStatus();
        res.json(health);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get health status',
            details: error.message
        });
    }
});

/**
 * POST /api/image-classification/classify/:imageId
 * Classify and tag an existing gallery image
 * 
 * Body: {
 *   "forceRefresh": false,
 *   "includeFeatures": true,
 *   "generateTags": true
 * }
 */
router.post('/classify/:imageId', ensureServiceReady, async (req, res) => {
    try {
        const { imageId } = req.params;
        const { forceRefresh = false, includeFeatures = true, generateTags = true } = req.body;
        
        console.log(`🔍 Classifying gallery image: ${imageId}`);
        
        // Get image details from database
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        const [images] = await db.execute(`
            SELECT id, image_url, file_path FROM gallery_images WHERE id = ?
        `, [imageId]);
        
        await db.end();
        
        if (images.length === 0) {
            return res.status(404).json({
                error: 'Image not found',
                image_id: imageId
            });
        }
        
        const image = images[0];
        const imagePath = image.file_path || image.image_url;
        
        if (!imagePath) {
            return res.status(400).json({
                error: 'Image path not available',
                image_id: imageId
            });
        }
        
        // Perform classification
        const result = await classificationService.classifyAndTagImage(
            imageId,
            imagePath,
            { forceRefresh, includeFeatures, generateTags }
        );
        
        res.json({
            success: !result.error,
            ...result
        });
        
    } catch (error) {
        console.error('Classification error:', error);
        res.status(500).json({
            error: 'Failed to classify image',
            details: error.message
        });
    }
});

/**
 * POST /api/image-classification/classify-upload
 * Upload and classify a new image
 */
router.post('/classify-upload', ensureServiceReady, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'No image file provided'
            });
        }
        
        console.log(`📤 Classifying uploaded image: ${req.file.filename}`);
        
        // Generate temporary image ID for uploaded file
        const tempImageId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Perform classification
        const result = await classificationService.classifyAndTagImage(
            tempImageId,
            req.file.path,
            { includeFeatures: true, generateTags: true }
        );
        
        // Clean up uploaded file after processing
        try {
            const fs = require('fs').promises;
            await fs.unlink(req.file.path);
        } catch (cleanupError) {
            console.warn('Failed to clean up uploaded file:', cleanupError);
        }
        
        res.json({
            success: !result.error,
            upload_info: {
                original_name: req.file.originalname,
                file_size: req.file.size,
                mime_type: req.file.mimetype
            },
            ...result
        });
        
    } catch (error) {
        console.error('Upload classification error:', error);
        res.status(500).json({
            error: 'Failed to classify uploaded image',
            details: error.message
        });
    }
});

/**
 * POST /api/image-classification/batch
 * Batch process multiple images
 * 
 * Body: {
 *   "imageIds": [1, 2, 3, 4, 5],
 *   "concurrent": 3,
 *   "skipExisting": true
 * }
 */
router.post('/batch', ensureServiceReady, async (req, res) => {
    try {
        const { imageIds, concurrent = 3, skipExisting = true } = req.body;
        
        if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
            return res.status(400).json({
                error: 'Invalid or empty imageIds array provided'
            });
        }
        
        console.log(`📦 Starting batch classification of ${imageIds.length} images`);
        
        // Get image details from database
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        const placeholders = imageIds.map(() => '?').join(',');
        const [images] = await db.execute(`
            SELECT id, image_url, file_path, title FROM gallery_images 
            WHERE id IN (${placeholders}) AND is_active = TRUE
        `, imageIds);
        
        await db.end();
        
        if (images.length === 0) {
            return res.status(404).json({
                error: 'No valid images found for provided IDs'
            });
        }
        
        // Convert to format expected by batch processor
        const imageList = images.map(img => ({
            id: img.id,
            path: img.file_path || img.image_url,
            title: img.title
        }));
        
        // Set up progress tracking
        let progressUpdates = [];
        const progressCallback = (progress) => {
            progressUpdates.push({
                processed: progress.processed,
                total: progress.total,
                current_image: progress.current.id,
                timestamp: new Date().toISOString()
            });
        };
        
        // Perform batch processing
        const batchResult = await classificationService.batchProcessImages(
            imageList,
            { concurrent, skipExisting, progressCallback }
        );
        
        res.json({
            ...batchResult,
            progress_updates: progressUpdates,
            images_requested: imageIds.length,
            images_found: images.length
        });
        
    } catch (error) {
        console.error('Batch classification error:', error);
        res.status(500).json({
            error: 'Failed to perform batch classification',
            details: error.message
        });
    }
});

/**
 * GET /api/image-classification/results/:imageId
 * Get classification results for an image
 * 
 * Query params:
 * - include_features: include visual features (default false)
 * - include_similar: include similar images (default false)
 */
router.get('/results/:imageId', async (req, res) => {
    try {
        const { imageId } = req.params;
        const { include_features = 'false', include_similar = 'false' } = req.query;
        
        if (!classificationService) {
            return res.status(503).json({
                error: 'Classification service not available'
            });
        }
        
        const includeFeatures = include_features === 'true' || include_similar === 'true';
        const result = await classificationService.getImageClassification(imageId, includeFeatures);
        
        if (result.error) {
            return res.status(404).json(result);
        }
        
        res.json({
            success: true,
            ...result,
            metadata: {
                include_features: includeFeatures,
                include_similar: include_similar === 'true',
                retrieved_at: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Classification results error:', error);
        res.status(500).json({
            error: 'Failed to get classification results',
            details: error.message
        });
    }
});

/**
 * PUT /api/image-classification/tags/:imageId
 * Update image tags based on user feedback
 * 
 * Body: {
 *   "tags": [
 *     {"name": "portrait", "confidence": 0.95, "verified": true},
 *     {"name": "professional", "confidence": 0.88, "verified": true}
 *   ],
 *   "userId": "user123",
 *   "feedback": "Corrected misclassified tags"
 * }
 */
router.put('/tags/:imageId', async (req, res) => {
    try {
        const { imageId } = req.params;
        const { tags, userId, feedback = '' } = req.body;
        
        if (!tags || !Array.isArray(tags) || !userId) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['tags', 'userId']
            });
        }
        
        if (!classificationService) {
            return res.status(503).json({
                error: 'Classification service not available'
            });
        }
        
        console.log(`🏷️ Updating tags for image ${imageId} by user ${userId}`);
        
        const result = await classificationService.updateImageTags(imageId, tags, userId);
        
        res.json(result);
        
    } catch (error) {
        console.error('Tag update error:', error);
        res.status(500).json({
            error: 'Failed to update image tags',
            details: error.message
        });
    }
});

/**
 * GET /api/image-classification/similar/:imageId
 * Get visually similar images
 * 
 * Query params:
 * - limit: maximum number of similar images (default 10)
 * - threshold: minimum similarity threshold (default 0.7)
 * - method: similarity method (default 'cosine')
 */
router.get('/similar/:imageId', async (req, res) => {
    try {
        const { imageId } = req.params;
        const { limit = 10, threshold = 0.7, method = 'cosine' } = req.query;
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        // Get similar images from pre-computed similarity matrix
        let query = `
            SELECT 
                ivs.image_b_id as similar_image_id,
                ivs.similarity_score,
                ivs.similarity_method,
                gi.title,
                gi.image_url,
                gi.category,
                icr.overall_category,
                icr.aesthetic_score,
                icr.safety_score
            FROM image_visual_similarity ivs
            JOIN gallery_images gi ON ivs.image_b_id = gi.id
            LEFT JOIN image_classification_results icr ON gi.id = icr.image_id
            WHERE ivs.image_a_id = ?
              AND ivs.similarity_score >= ?
              AND gi.is_active = TRUE
        `;
        
        const params = [parseInt(imageId), parseFloat(threshold)];
        
        if (method !== 'any') {
            query += ' AND ivs.similarity_method = ?';
            params.push(method);
        }
        
        query += ' ORDER BY ivs.similarity_score DESC LIMIT ?';
        params.push(parseInt(limit));
        
        const [similarImages] = await db.execute(query, params);
        
        // Get source image details
        const [sourceImage] = await db.execute(`
            SELECT gi.*, icr.overall_category, icr.aesthetic_score, icr.safety_score
            FROM gallery_images gi
            LEFT JOIN image_classification_results icr ON gi.id = icr.image_id
            WHERE gi.id = ?
        `, [imageId]);
        
        await db.end();
        
        if (sourceImage.length === 0) {
            return res.status(404).json({
                error: 'Source image not found',
                image_id: imageId
            });
        }
        
        res.json({
            success: true,
            source_image: {
                ...sourceImage[0],
                aesthetic_score: parseFloat(sourceImage[0].aesthetic_score || 0),
                safety_score: parseFloat(sourceImage[0].safety_score || 0)
            },
            similar_images: similarImages.map(img => ({
                ...img,
                similarity_score: parseFloat(img.similarity_score),
                aesthetic_score: parseFloat(img.aesthetic_score || 0),
                safety_score: parseFloat(img.safety_score || 0)
            })),
            search_parameters: {
                threshold: parseFloat(threshold),
                method,
                limit: parseInt(limit)
            },
            results_count: similarImages.length
        });
        
    } catch (error) {
        console.error('Similar images error:', error);
        res.status(500).json({
            error: 'Failed to get similar images',
            details: error.message
        });
    }
});

/**
 * GET /api/image-classification/tags
 * Get tag vocabulary and usage statistics
 * 
 * Query params:
 * - category: filter by tag category (optional)
 * - active_only: only active tags (default true)
 * - min_usage: minimum usage count (default 0)
 * - limit: number of results (default 100)
 */
router.get('/tags', async (req, res) => {
    try {
        const { category, active_only = 'true', min_usage = 0, limit = 100 } = req.query;
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        let query = `
            SELECT 
                tv.tag_name,
                tv.tag_category,
                tv.tag_description,
                tv.usage_count,
                tv.quality_score,
                tv.confidence_threshold,
                tv.synonyms,
                COUNT(DISTINCT it.image_id) as current_usage,
                AVG(it.confidence_score) as avg_confidence,
                COUNT(CASE WHEN it.is_verified = TRUE THEN 1 END) as verified_count
            FROM tag_vocabulary tv
            LEFT JOIN image_tags it ON tv.tag_name = it.tag_name
        `;
        
        const params = [];
        const conditions = [];
        
        if (active_only === 'true') {
            conditions.push('tv.is_active = TRUE');
        }
        
        if (category) {
            conditions.push('tv.tag_category = ?');
            params.push(category);
        }
        
        if (parseInt(min_usage) > 0) {
            conditions.push('tv.usage_count >= ?');
            params.push(parseInt(min_usage));
        }
        
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += `
            GROUP BY tv.tag_name, tv.tag_category, tv.tag_description, 
                     tv.usage_count, tv.quality_score, tv.confidence_threshold, tv.synonyms
            ORDER BY tv.usage_count DESC, tv.quality_score DESC
            LIMIT ?
        `;
        params.push(parseInt(limit));
        
        const [tags] = await db.execute(query, params);
        
        // Get tag category summary
        const [categorySummary] = await db.execute(`
            SELECT 
                tag_category,
                COUNT(*) as tag_count,
                AVG(quality_score) as avg_quality,
                SUM(usage_count) as total_usage
            FROM tag_vocabulary
            WHERE is_active = TRUE
            GROUP BY tag_category
            ORDER BY total_usage DESC
        `);
        
        await db.end();
        
        res.json({
            success: true,
            tags: tags.map(tag => ({
                ...tag,
                synonyms: JSON.parse(tag.synonyms || '[]'),
                quality_score: parseFloat(tag.quality_score || 0),
                confidence_threshold: parseFloat(tag.confidence_threshold || 0),
                current_usage: parseInt(tag.current_usage || 0),
                avg_confidence: parseFloat(tag.avg_confidence || 0),
                verified_count: parseInt(tag.verified_count || 0)
            })),
            category_summary: categorySummary.map(cat => ({
                ...cat,
                avg_quality: parseFloat(cat.avg_quality || 0)
            })),
            filters: { category, active_only, min_usage: parseInt(min_usage), limit: parseInt(limit) }
        });
        
    } catch (error) {
        console.error('Tag vocabulary error:', error);
        res.status(500).json({
            error: 'Failed to get tag vocabulary',
            details: error.message
        });
    }
});

/**
 * GET /api/image-classification/analytics
 * Get comprehensive classification analytics
 * 
 * Query params:
 * - timeframe: 24h, 7d, 30d (default 7d)
 * - category: filter by image category (optional)
 */
router.get('/analytics', async (req, res) => {
    try {
        const { timeframe = '7d', category } = req.query;
        
        const timeframeMap = {
            '24h': 1,
            '7d': 7,
            '30d': 30
        };
        
        const days = timeframeMap[timeframe] || 7;
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        // Get overall statistics
        const [overallStats] = await db.execute(`
            CALL GetImageClassificationStats()
        `);
        
        // Get recent processing activity
        const [recentActivity] = await db.execute(`
            SELECT 
                DATE(icr.created_at) as date,
                COUNT(*) as images_processed,
                AVG(icr.confidence_score) as avg_confidence,
                AVG(icr.safety_score) as avg_safety_score,
                AVG(icr.aesthetic_score) as avg_aesthetic_score,
                COUNT(CASE WHEN icr.user_modified = TRUE THEN 1 END) as user_modifications
            FROM image_classification_results icr
            WHERE icr.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY DATE(icr.created_at)
            ORDER BY date DESC
        `, [days]);
        
        // Get model performance
        const [modelPerformance] = await db.execute(`
            SELECT * FROM v_model_accuracy_summary
            ORDER BY avg_processing_time_ms ASC, model_accuracy DESC
        `);
        
        // Get tag performance
        const [tagPerformance] = await db.execute(`
            CALL AnalyzeTaggingPerformance(?)
        `, [days]);
        
        await db.end();
        
        res.json({
            success: true,
            analytics: {
                timeframe,
                category,
                overall_statistics: overallStats,
                recent_activity: recentActivity.map(activity => ({
                    ...activity,
                    avg_confidence: parseFloat(activity.avg_confidence || 0),
                    avg_safety_score: parseFloat(activity.avg_safety_score || 0),
                    avg_aesthetic_score: parseFloat(activity.avg_aesthetic_score || 0)
                })),
                model_performance: modelPerformance.map(model => ({
                    ...model,
                    model_accuracy: parseFloat(model.model_accuracy || 0),
                    avg_prediction_confidence: parseFloat(model.avg_prediction_confidence || 0),
                    avg_processing_time_ms: parseFloat(model.avg_processing_time_ms || 0)
                })),
                tag_performance: tagPerformance
            },
            generated_at: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({
            error: 'Failed to get classification analytics',
            details: error.message
        });
    }
});

/**
 * GET /api/image-classification/models
 * Get information about available classification models
 */
router.get('/models', async (req, res) => {
    try {
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        const [models] = await db.execute(`
            SELECT 
                icm.*,
                COUNT(DISTINCT icp.image_id) as images_processed,
                AVG(icp.confidence_score) as avg_confidence,
                AVG(icp.processing_time_ms) as avg_processing_time,
                MAX(icp.predicted_at) as last_used,
                COUNT(DISTINCT mpm.id) as performance_measurements
            FROM image_classification_models icm
            LEFT JOIN image_classification_predictions icp ON icm.model_name = icp.model_name
            LEFT JOIN model_performance_metrics mpm ON icm.model_name = mpm.model_name
            GROUP BY icm.id, icm.model_name, icm.model_type, icm.model_version, 
                     icm.model_architecture, icm.model_accuracy, icm.is_production, icm.is_active
            ORDER BY icm.is_production DESC, icm.model_accuracy DESC
        `);
        
        await db.end();
        
        res.json({
            success: true,
            models: models.map(model => ({
                ...model,
                supported_classes: JSON.parse(model.supported_classes || '[]'),
                preprocessing_config: JSON.parse(model.preprocessing_config || '{}'),
                postprocessing_config: JSON.parse(model.postprocessing_config || '{}'),
                confidence_calibration: JSON.parse(model.confidence_calibration || '{}'),
                model_accuracy: parseFloat(model.model_accuracy || 0),
                precision_score: parseFloat(model.precision_score || 0),
                recall_score: parseFloat(model.recall_score || 0),
                f1_score: parseFloat(model.f1_score || 0),
                model_size_mb: parseFloat(model.model_size_mb || 0),
                inference_time_ms: parseFloat(model.inference_time_ms || 0),
                images_processed: parseInt(model.images_processed || 0),
                avg_confidence: parseFloat(model.avg_confidence || 0),
                avg_processing_time: parseFloat(model.avg_processing_time || 0)
            })),
            summary: {
                total_models: models.length,
                production_models: models.filter(m => m.is_production).length,
                active_models: models.filter(m => m.is_active).length
            }
        });
        
    } catch (error) {
        console.error('Models information error:', error);
        res.status(500).json({
            error: 'Failed to get model information',
            details: error.message
        });
    }
});

// Error handling middleware
router.use((error, req, res, next) => {
    console.error('Image Classification API Error:', error);
    
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                error: 'File too large',
                details: 'Maximum file size is 10MB'
            });
        }
    }
    
    res.status(500).json({
        error: 'Internal server error in Image Classification API',
        details: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    });
});

module.exports = router;