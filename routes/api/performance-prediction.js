/**
 * Performance Prediction API Routes
 * 
 * RESTful API endpoints for AI-powered performance prediction system.
 * Provides load time prediction, resource usage forecasting, anomaly detection,
 * and optimization recommendations.
 */

const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

// Initialize Performance Prediction Service
let performancePredictionService = null;

async function initializeService() {
    if (!performancePredictionService) {
        const PerformancePredictionService = require('../../src/services/PerformancePredictionService');
        performancePredictionService = new PerformancePredictionService();
        await performancePredictionService.initialize();
    }
    return performancePredictionService;
}

// Middleware to ensure service is initialized
async function ensureServiceReady(req, res, next) {
    try {
        await initializeService();
        next();
    } catch (error) {
        console.error('Failed to initialize Performance Prediction Service:', error);
        res.status(503).json({
            error: 'Performance Prediction Service unavailable',
            details: error.message
        });
    }
}

/**
 * GET /api/performance-prediction/health
 * Get service health status
 */
router.get('/health', ensureServiceReady, async (req, res) => {
    try {
        const health = await performancePredictionService.getHealthStatus();
        res.json(health);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get health status',
            details: error.message
        });
    }
});

/**
 * POST /api/performance-prediction/load-time
 * Predict gallery load time
 * 
 * Body: {
 *   "galleryConfig": { "modelId": 39, "themeId": 5, "imageCount": 25 },
 *   "userContext": { "deviceType": "mobile", "connectionSpeed": "4g" }
 * }
 */
router.post('/load-time', ensureServiceReady, async (req, res) => {
    try {
        const { galleryConfig, userContext = {} } = req.body;
        
        if (!galleryConfig || !galleryConfig.modelId || !galleryConfig.themeId) {
            return res.status(400).json({
                error: 'Missing required gallery configuration',
                required: ['galleryConfig.modelId', 'galleryConfig.themeId']
            });
        }
        
        const prediction = await performancePredictionService.predictLoadTime(
            galleryConfig, 
            userContext
        );
        
        res.json({
            success: true,
            prediction,
            metadata: {
                modelId: galleryConfig.modelId,
                themeId: galleryConfig.themeId,
                requestedAt: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Load time prediction error:', error);
        res.status(500).json({
            error: 'Failed to predict load time',
            details: error.message
        });
    }
});

/**
 * POST /api/performance-prediction/resource-usage
 * Predict resource usage for given load pattern
 * 
 * Body: {
 *   "loadPattern": { "expectedUsers": 100, "peakHour": true },
 *   "timeHorizon": "1h"
 * }
 */
router.post('/resource-usage', ensureServiceReady, async (req, res) => {
    try {
        const { loadPattern, timeHorizon = '1h' } = req.body;
        
        if (!loadPattern) {
            return res.status(400).json({
                error: 'Missing load pattern configuration'
            });
        }
        
        const prediction = await performancePredictionService.predictResourceUsage(
            loadPattern,
            timeHorizon
        );
        
        res.json({
            success: true,
            prediction,
            metadata: {
                timeHorizon,
                requestedAt: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Resource usage prediction error:', error);
        res.status(500).json({
            error: 'Failed to predict resource usage',
            details: error.message
        });
    }
});

/**
 * POST /api/performance-prediction/detect-anomalies
 * Detect performance anomalies in real-time metrics
 * 
 * Body: {
 *   "metrics": {
 *     "responseTime": 2.5,
 *     "errorRate": 0.03,
 *     "throughput": 150,
 *     "cpuUsage": 0.85
 *   }
 * }
 */
router.post('/detect-anomalies', ensureServiceReady, async (req, res) => {
    try {
        const { metrics } = req.body;
        
        if (!metrics || typeof metrics !== 'object') {
            return res.status(400).json({
                error: 'Missing or invalid metrics object'
            });
        }
        
        const anomalies = await performancePredictionService.detectAnomalies(metrics);
        
        res.json({
            success: true,
            anomalies,
            metadata: {
                metricsAnalyzed: Object.keys(metrics),
                requestedAt: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Anomaly detection error:', error);
        res.status(500).json({
            error: 'Failed to detect anomalies',
            details: error.message
        });
    }
});

/**
 * POST /api/performance-prediction/optimize
 * Generate performance optimization recommendations
 * 
 * Body: {
 *   "currentPerformance": { "loadTime": 3.2, "cacheHitRate": 0.65 },
 *   "targetPerformance": { "loadTime": 1.5, "cacheHitRate": 0.85 }
 * }
 */
router.post('/optimize', ensureServiceReady, async (req, res) => {
    try {
        const { currentPerformance, targetPerformance } = req.body;
        
        if (!currentPerformance || !targetPerformance) {
            return res.status(400).json({
                error: 'Missing performance metrics',
                required: ['currentPerformance', 'targetPerformance']
            });
        }
        
        const recommendations = await performancePredictionService.generateOptimizationRecommendations(
            currentPerformance,
            targetPerformance
        );
        
        res.json({
            success: true,
            recommendations,
            metadata: {
                currentPerformance,
                targetPerformance,
                requestedAt: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Optimization recommendation error:', error);
        res.status(500).json({
            error: 'Failed to generate optimization recommendations',
            details: error.message
        });
    }
});

/**
 * GET /api/performance-prediction/models
 * Get ML models status and information
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
                model_name,
                model_type,
                accuracy,
                confidence_threshold,
                last_trained_at,
                training_data_size,
                is_active,
                created_at
            FROM ml_models
            ORDER BY model_name
        `);
        
        await db.end();
        
        res.json({
            success: true,
            models: models.map(model => ({
                ...model,
                healthStatus: getModelHealthStatus(model),
                needsRetraining: needsRetraining(model)
            }))
        });
        
    } catch (error) {
        console.error('Models status error:', error);
        res.status(500).json({
            error: 'Failed to get models status',
            details: error.message
        });
    }
});

/**
 * POST /api/performance-prediction/models/train
 * Trigger manual model training
 * 
 * Body: {
 *   "modelName": "load_time_prediction" (optional, trains all if not specified)
 * }
 */
router.post('/models/train', ensureServiceReady, async (req, res) => {
    try {
        const { modelName } = req.body;
        
        if (modelName) {
            // Train specific model
            await performancePredictionService.trainModel(modelName);
            res.json({
                success: true,
                message: `Model ${modelName} training initiated`,
                timestamp: new Date().toISOString()
            });
        } else {
            // Train all models
            await performancePredictionService.trainModels();
            res.json({
                success: true,
                message: 'All models training initiated',
                timestamp: new Date().toISOString()
            });
        }
        
    } catch (error) {
        console.error('Model training error:', error);
        res.status(500).json({
            error: 'Failed to initiate model training',
            details: error.message
        });
    }
});

/**
 * GET /api/performance-prediction/predictions
 * Get recent predictions with filtering
 * 
 * Query params:
 * - type: prediction type filter
 * - limit: number of results (default 50)
 * - since: ISO timestamp for filtering recent predictions
 */
router.get('/predictions', async (req, res) => {
    try {
        const { type, limit = 50, since } = req.query;
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        let query = `
            SELECT 
                prediction_type,
                model_name,
                confidence_score,
                prediction_key,
                created_at,
                expires_at,
                JSON_EXTRACT(prediction_result, '$.predictedLoadTime') as predicted_load_time,
                JSON_EXTRACT(prediction_result, '$.category') as performance_category
            FROM performance_predictions
        `;
        
        const params = [];
        const conditions = [];
        
        if (type) {
            conditions.push('prediction_type = ?');
            params.push(type);
        }
        
        if (since) {
            conditions.push('created_at >= ?');
            params.push(new Date(since));
        }
        
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ' ORDER BY created_at DESC LIMIT ?';
        params.push(parseInt(limit));
        
        const [predictions] = await db.execute(query, params);
        
        await db.end();
        
        res.json({
            success: true,
            predictions,
            count: predictions.length,
            filters: { type, limit, since }
        });
        
    } catch (error) {
        console.error('Get predictions error:', error);
        res.status(500).json({
            error: 'Failed to get predictions',
            details: error.message
        });
    }
});

/**
 * GET /api/performance-prediction/recommendations
 * Get optimization recommendations with filtering
 */
router.get('/recommendations', async (req, res) => {
    try {
        const { status = 'pending', priority, limit = 20 } = req.query;
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        let query = `
            SELECT 
                id,
                recommendation_type,
                priority,
                impact_level,
                effort_level,
                title,
                description,
                actions,
                expected_improvement,
                confidence_score,
                status,
                created_at,
                updated_at
            FROM optimization_recommendations
        `;
        
        const params = [];
        const conditions = [];
        
        if (status !== 'all') {
            conditions.push('status = ?');
            params.push(status);
        }
        
        if (priority) {
            conditions.push('priority = ?');
            params.push(priority);
        }
        
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ' ORDER BY priority DESC, impact_level DESC, created_at DESC LIMIT ?';
        params.push(parseInt(limit));
        
        const [recommendations] = await db.execute(query, params);
        
        await db.end();
        
        res.json({
            success: true,
            recommendations: recommendations.map(rec => ({
                ...rec,
                actions: JSON.parse(rec.actions || '[]'),
                expected_improvement: JSON.parse(rec.expected_improvement || '{}')
            })),
            count: recommendations.length,
            filters: { status, priority, limit }
        });
        
    } catch (error) {
        console.error('Get recommendations error:', error);
        res.status(500).json({
            error: 'Failed to get recommendations',
            details: error.message
        });
    }
});

/**
 * GET /api/performance-prediction/analytics
 * Get prediction analytics and performance metrics
 */
router.get('/analytics', async (req, res) => {
    try {
        const { timeframe = '24h' } = req.query;
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        // Get prediction accuracy summary
        const [accuracySummary] = await db.execute(`
            SELECT * FROM v_prediction_accuracy_summary
        `);
        
        // Get model performance trends
        const [modelPerformance] = await db.execute(`
            SELECT 
                model_name,
                AVG(accuracy) as avg_accuracy,
                MAX(accuracy) as peak_accuracy,
                COUNT(*) as evaluation_count
            FROM ml_model_performance 
            WHERE evaluation_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY model_name
        `);
        
        // Get optimization impact
        const [optimizationImpact] = await db.execute(`
            SELECT * FROM v_optimization_impact
        `);
        
        // Get recent anomalies
        const [recentAnomalies] = await db.execute(`
            SELECT 
                anomaly_type,
                severity,
                COUNT(*) as count,
                AVG(detection_confidence) as avg_confidence
            FROM performance_anomalies 
            WHERE detected_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            GROUP BY anomaly_type, severity
        `);
        
        await db.end();
        
        res.json({
            success: true,
            analytics: {
                timeframe,
                predictionAccuracy: accuracySummary,
                modelPerformance,
                optimizationImpact,
                recentAnomalies,
                generatedAt: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({
            error: 'Failed to get analytics',
            details: error.message
        });
    }
});

/**
 * DELETE /api/performance-prediction/cache
 * Clear prediction cache
 */
router.delete('/cache', ensureServiceReady, async (req, res) => {
    try {
        // Clear Redis cache
        const redis = performancePredictionService.redis;
        const keys = await redis.keys('prediction:*');
        
        if (keys.length > 0) {
            await redis.del(keys);
        }
        
        // Clean up database cache
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        await db.execute(`CALL CleanupExpiredPredictions()`);
        await db.end();
        
        res.json({
            success: true,
            message: `Cleared ${keys.length} cached predictions`,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Cache clear error:', error);
        res.status(500).json({
            error: 'Failed to clear cache',
            details: error.message
        });
    }
});

// Helper functions
function getModelHealthStatus(model) {
    if (!model.is_active) return 'inactive';
    if (!model.last_trained_at) return 'untrained';
    if (model.accuracy < 0.6) return 'poor';
    if (model.accuracy < 0.7) return 'fair';
    if (model.accuracy < 0.8) return 'good';
    return 'excellent';
}

function needsRetraining(model) {
    if (!model.last_trained_at) return true;
    const hoursSinceTraining = (new Date() - new Date(model.last_trained_at)) / (1000 * 60 * 60);
    return hoursSinceTraining > 48; // Retrain if more than 48 hours old
}

// Error handling middleware
router.use((error, req, res, next) => {
    console.error('Performance Prediction API Error:', error);
    res.status(500).json({
        error: 'Internal server error in Performance Prediction API',
        details: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    });
});

module.exports = router;