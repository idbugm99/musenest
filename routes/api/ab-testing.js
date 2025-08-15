/**
 * A/B Testing Framework API Routes
 * 
 * RESTful API endpoints for automated A/B testing with statistical significance tracking.
 * Provides experiment management, user assignment, event tracking, and statistical analysis
 * with real-time monitoring and optimization recommendations.
 */

const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

// Initialize A/B Testing Framework Service
let abTestingService = null;

async function initializeService() {
    if (!abTestingService) {
        const ABTestingFrameworkService = require('../../src/services/ABTestingFrameworkService');
        abTestingService = new ABTestingFrameworkService();
        await abTestingService.initialize();
    }
    return abTestingService;
}

// Middleware to ensure service is initialized
async function ensureServiceReady(req, res, next) {
    try {
        await initializeService();
        next();
    } catch (error) {
        console.error('Failed to initialize A/B Testing Framework Service:', error);
        res.status(503).json({
            error: 'A/B Testing Framework Service unavailable',
            details: error.message
        });
    }
}

/**
 * GET /api/ab-testing/health
 * Get service health status and experiment overview
 */
router.get('/health', ensureServiceReady, async (req, res) => {
    try {
        const health = await abTestingService.getHealthStatus();
        res.json(health);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get health status',
            details: error.message
        });
    }
});

/**
 * POST /api/ab-testing/experiments
 * Create a new A/B test experiment
 * 
 * Body: {
 *   "name": "Recommendation Algorithm Test",
 *   "description": "Testing collaborative vs content-based filtering",
 *   "experimentType": "recommendation_algorithm",
 *   "variants": [
 *     {"name": "control", "isControl": true, "configuration": {"algorithm": "collaborative"}},
 *     {"name": "treatment", "configuration": {"algorithm": "content_based"}}
 *   ],
 *   "primaryMetric": "click_through_rate",
 *   "secondaryMetrics": ["conversion_rate", "engagement_rate"],
 *   "trafficAllocation": {"control": 0.5, "treatment": 0.5},
 *   "durationDays": 14,
 *   "minimumSampleSize": 1000
 * }
 */
router.post('/experiments', ensureServiceReady, async (req, res) => {
    try {
        const experimentDefinition = req.body;
        
        // Validate required fields
        const requiredFields = ['name', 'experimentType', 'variants', 'primaryMetric'];
        const missingFields = requiredFields.filter(field => !experimentDefinition[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({
                error: 'Missing required fields',
                missing: missingFields
            });
        }
        
        console.log(`🧪 Creating new experiment: ${experimentDefinition.name}`);
        
        const result = await abTestingService.createExperiment(experimentDefinition);
        
        res.status(201).json(result);
        
    } catch (error) {
        console.error('Experiment creation error:', error);
        res.status(400).json({
            error: 'Failed to create experiment',
            details: error.message
        });
    }
});

/**
 * GET /api/ab-testing/experiments
 * Get list of experiments with optional filtering
 * 
 * Query params:
 * - status: filter by status (draft, running, completed, etc.)
 * - type: filter by experiment type
 * - limit: number of results (default 50)
 * - include_stats: include basic statistics (default false)
 */
router.get('/experiments', async (req, res) => {
    try {
        const { status, type, limit = 50, include_stats = 'false' } = req.query;
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        let query = `
            SELECT 
                e.experiment_id,
                e.name,
                e.description,
                e.experiment_type,
                e.status,
                e.primary_metric,
                e.start_date,
                e.end_date,
                e.planned_end_date,
                e.minimum_sample_size,
                e.calculated_sample_size,
                e.winning_variant,
                e.conclusion,
                e.created_at,
                COUNT(DISTINCT p.user_id) as participants,
                COUNT(DISTINCT v.variant_name) as variant_count
            FROM ab_test_experiments e
            LEFT JOIN ab_test_participants p ON e.experiment_id = p.experiment_id
            LEFT JOIN ab_test_variants v ON e.experiment_id = v.experiment_id
        `;
        
        const params = [];
        const conditions = [];
        
        if (status) {
            conditions.push('e.status = ?');
            params.push(status);
        }
        
        if (type) {
            conditions.push('e.experiment_type = ?');
            params.push(type);
        }
        
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ` 
            GROUP BY e.experiment_id, e.name, e.description, e.experiment_type, e.status, 
                     e.primary_metric, e.start_date, e.end_date, e.planned_end_date,
                     e.minimum_sample_size, e.calculated_sample_size, e.winning_variant, 
                     e.conclusion, e.created_at
            ORDER BY 
                CASE e.status 
                    WHEN 'running' THEN 1 
                    WHEN 'draft' THEN 2 
                    WHEN 'completed' THEN 3 
                    ELSE 4 
                END, 
                e.created_at DESC 
            LIMIT ?
        `;
        params.push(parseInt(limit));
        
        const [experiments] = await db.execute(query, params);
        
        // Include statistics if requested
        if (include_stats === 'true') {
            for (const experiment of experiments) {
                const [statsResult] = await db.execute(`
                    SELECT 
                        sr.is_significant,
                        sr.p_value,
                        sr.effect_size,
                        sr.confidence_level,
                        sr.statistical_power
                    FROM ab_test_statistical_results sr
                    WHERE sr.experiment_id = ?
                    ORDER BY sr.calculated_at DESC
                    LIMIT 1
                `, [experiment.experiment_id]);
                
                experiment.statistical_results = statsResult[0] || null;
            }
        }
        
        await db.end();
        
        res.json({
            success: true,
            experiments: experiments.map(exp => ({
                ...exp,
                participants: parseInt(exp.participants || 0),
                variant_count: parseInt(exp.variant_count || 0)
            })),
            filters: { status, type, limit: parseInt(limit) },
            count: experiments.length
        });
        
    } catch (error) {
        console.error('Experiments retrieval error:', error);
        res.status(500).json({
            error: 'Failed to get experiments',
            details: error.message
        });
    }
});

/**
 * GET /api/ab-testing/experiments/:experimentId
 * Get detailed experiment information
 */
router.get('/experiments/:experimentId', async (req, res) => {
    try {
        const { experimentId } = req.params;
        const { include_raw_data = 'false' } = req.query;
        
        if (!abTestingService) {
            return res.status(503).json({
                error: 'A/B Testing service not available'
            });
        }
        
        const results = await abTestingService.getExperimentResults(
            experimentId, 
            include_raw_data === 'true'
        );
        
        res.json(results);
        
    } catch (error) {
        console.error('Experiment details error:', error);
        if (error.message.includes('not found')) {
            res.status(404).json({
                error: 'Experiment not found',
                experimentId: req.params.experimentId
            });
        } else {
            res.status(500).json({
                error: 'Failed to get experiment details',
                details: error.message
            });
        }
    }
});

/**
 * POST /api/ab-testing/experiments/:experimentId/start
 * Start a draft experiment
 */
router.post('/experiments/:experimentId/start', ensureServiceReady, async (req, res) => {
    try {
        const { experimentId } = req.params;
        
        console.log(`🚀 Starting experiment: ${experimentId}`);
        
        const result = await abTestingService.startExperiment(experimentId);
        
        res.json(result);
        
    } catch (error) {
        console.error('Experiment start error:', error);
        res.status(400).json({
            error: 'Failed to start experiment',
            details: error.message
        });
    }
});

/**
 * POST /api/ab-testing/assign
 * Assign user to experiment variant
 * 
 * Body: {
 *   "experimentId": "exp_recommendation_001",
 *   "userId": "user123",
 *   "userContext": {
 *     "user_segment": "engaged_user",
 *     "device_type": "desktop",
 *     "location": "US"
 *   }
 * }
 */
router.post('/assign', ensureServiceReady, async (req, res) => {
    try {
        const { experimentId, userId, userContext = {} } = req.body;
        
        if (!experimentId || !userId) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['experimentId', 'userId']
            });
        }
        
        const assignment = await abTestingService.assignUserToVariant(
            experimentId, 
            userId, 
            userContext
        );
        
        res.json(assignment);
        
    } catch (error) {
        console.error('User assignment error:', error);
        res.status(500).json({
            error: 'Failed to assign user to variant',
            details: error.message
        });
    }
});

/**
 * POST /api/ab-testing/track
 * Track experiment event (conversion, interaction, etc.)
 * 
 * Body: {
 *   "experimentId": "exp_recommendation_001",
 *   "userId": "user123",
 *   "eventType": "click_through_rate",
 *   "eventData": {
 *     "value": 1,
 *     "item_id": "item456",
 *     "session_id": "sess789"
 *   }
 * }
 */
router.post('/track', ensureServiceReady, async (req, res) => {
    try {
        const { experimentId, userId, eventType, eventData = {} } = req.body;
        
        if (!experimentId || !userId || !eventType) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['experimentId', 'userId', 'eventType']
            });
        }
        
        console.log(`📊 Tracking ${eventType} for user ${userId} in experiment ${experimentId}`);
        
        const result = await abTestingService.trackExperimentEvent(
            experimentId, 
            userId, 
            eventType, 
            eventData
        );
        
        res.json(result);
        
    } catch (error) {
        console.error('Event tracking error:', error);
        res.status(500).json({
            error: 'Failed to track experiment event',
            details: error.message
        });
    }
});

/**
 * POST /api/ab-testing/experiments/:experimentId/analyze
 * Trigger statistical analysis for experiment
 */
router.post('/experiments/:experimentId/analyze', ensureServiceReady, async (req, res) => {
    try {
        const { experimentId } = req.params;
        
        console.log(`📈 Triggering statistical analysis for experiment: ${experimentId}`);
        
        const analysis = await abTestingService.calculateStatisticalSignificance(experimentId);
        
        res.json(analysis);
        
    } catch (error) {
        console.error('Statistical analysis error:', error);
        res.status(500).json({
            error: 'Failed to perform statistical analysis',
            details: error.message
        });
    }
});

/**
 * GET /api/ab-testing/dashboard
 * Get comprehensive A/B testing dashboard data
 * 
 * Query params:
 * - timeframe: 24h, 7d, 30d (default 7d)
 * - status: filter by experiment status (optional)
 */
router.get('/dashboard', async (req, res) => {
    try {
        const { timeframe = '7d', status } = req.query;
        
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
        
        // Get experiment overview
        const [experimentOverview] = await db.execute(`
            CALL GetExperimentDashboard(?)
        `, [status]);
        
        // Get performance metrics
        const [performanceMetrics] = await db.execute(`
            SELECT 
                e.experiment_type,
                COUNT(*) as total_experiments,
                COUNT(CASE WHEN e.status = 'running' THEN 1 END) as running_experiments,
                COUNT(CASE WHEN e.status = 'completed' THEN 1 END) as completed_experiments,
                COUNT(CASE WHEN sr.is_significant = TRUE THEN 1 END) as significant_results,
                AVG(CASE WHEN e.status = 'completed' THEN DATEDIFF(e.end_date, e.start_date) END) as avg_duration_days,
                AVG(CASE WHEN sr.statistical_power IS NOT NULL THEN sr.statistical_power END) as avg_statistical_power
            FROM ab_test_experiments e
            LEFT JOIN ab_test_statistical_results sr ON e.experiment_id = sr.experiment_id
            WHERE e.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY e.experiment_type
            ORDER BY total_experiments DESC
        `, [days]);
        
        // Get recent activity
        const [recentActivity] = await db.execute(`
            SELECT 
                'experiment_created' as activity_type,
                e.experiment_id,
                e.name,
                e.created_at as timestamp,
                JSON_OBJECT('type', e.experiment_type, 'variants', JSON_LENGTH(e.variants)) as metadata
            FROM ab_test_experiments e
            WHERE e.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            
            UNION ALL
            
            SELECT 
                'experiment_started' as activity_type,
                e.experiment_id,
                e.name,
                e.start_date as timestamp,
                JSON_OBJECT('duration_days', e.planned_duration_days, 'sample_size', e.minimum_sample_size) as metadata
            FROM ab_test_experiments e
            WHERE e.start_date >= DATE_SUB(NOW(), INTERVAL ? DAY)
            
            UNION ALL
            
            SELECT 
                'statistical_significance' as activity_type,
                sr.experiment_id,
                e.name,
                sr.calculated_at as timestamp,
                JSON_OBJECT('is_significant', sr.is_significant, 'p_value', sr.p_value, 'winning_variant', sr.winning_variant) as metadata
            FROM ab_test_statistical_results sr
            JOIN ab_test_experiments e ON sr.experiment_id = e.experiment_id
            WHERE sr.calculated_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
              AND sr.is_significant = TRUE
            
            ORDER BY timestamp DESC
            LIMIT 20
        `, [days, days, days]);
        
        await db.end();
        
        res.json({
            success: true,
            dashboard: {
                timeframe,
                status,
                overview: experimentOverview,
                performance_metrics: performanceMetrics.map(metric => ({
                    ...metric,
                    avg_duration_days: parseFloat(metric.avg_duration_days || 0),
                    avg_statistical_power: parseFloat(metric.avg_statistical_power || 0),
                    success_rate: metric.completed_experiments > 0 
                        ? metric.significant_results / metric.completed_experiments 
                        : 0
                })),
                recent_activity: recentActivity.map(activity => ({
                    ...activity,
                    metadata: JSON.parse(activity.metadata || '{}')
                }))
            },
            generated_at: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Dashboard data error:', error);
        res.status(500).json({
            error: 'Failed to get dashboard data',
            details: error.message
        });
    }
});

/**
 * GET /api/ab-testing/statistics/:experimentId
 * Get detailed statistical analysis for an experiment
 */
router.get('/statistics/:experimentId', async (req, res) => {
    try {
        const { experimentId } = req.params;
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        // Get comprehensive statistical analysis
        const [analysisResults] = await db.execute(`
            CALL AnalyzeExperimentPerformance(?)
        `, [experimentId]);
        
        // Get power analysis
        const [powerAnalysis] = await db.execute(`
            SELECT * FROM v_statistical_power_analysis WHERE experiment_id = ?
        `, [experimentId]);
        
        // Get sequential analysis if available
        const [sequentialAnalysis] = await db.execute(`
            SELECT 
                analysis_time,
                cumulative_sample_size,
                sequential_p_value,
                should_stop_for_futility,
                should_stop_for_efficacy,
                recommendation,
                confidence_sequence
            FROM ab_test_sequential_analysis
            WHERE experiment_id = ?
            ORDER BY analysis_time DESC
            LIMIT 10
        `, [experimentId]);
        
        await db.end();
        
        res.json({
            success: true,
            experiment_id: experimentId,
            analysis: {
                detailed_results: analysisResults,
                power_analysis: powerAnalysis[0] || null,
                sequential_analysis: sequentialAnalysis.map(seq => ({
                    ...seq,
                    confidence_sequence: JSON.parse(seq.confidence_sequence || '{}')
                }))
            },
            generated_at: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Statistical analysis error:', error);
        res.status(500).json({
            error: 'Failed to get statistical analysis',
            details: error.message
        });
    }
});

/**
 * GET /api/ab-testing/insights
 * Get automated insights and recommendations across all experiments
 * 
 * Query params:
 * - severity: filter by severity (info, warning, critical)
 * - acknowledged: filter by acknowledgment status (default false)
 * - limit: number of results (default 20)
 */
router.get('/insights', async (req, res) => {
    try {
        const { severity, acknowledged = 'false', limit = 20 } = req.query;
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        let query = `
            SELECT 
                i.id,
                i.experiment_id,
                e.name as experiment_name,
                e.status as experiment_status,
                i.insight_type,
                i.insight_category,
                i.title,
                i.description,
                i.severity,
                i.confidence_score,
                i.supporting_data,
                i.actionable_recommendations,
                i.generated_by,
                i.generated_at
            FROM ab_test_insights i
            JOIN ab_test_experiments e ON i.experiment_id = e.experiment_id
        `;
        
        const params = [];
        const conditions = [];
        
        conditions.push('i.acknowledged = ?');
        params.push(acknowledged === 'true');
        
        if (severity) {
            conditions.push('i.severity = ?');
            params.push(severity);
        }
        
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ` 
            ORDER BY 
                CASE i.severity 
                    WHEN 'critical' THEN 1 
                    WHEN 'warning' THEN 2 
                    ELSE 3 
                END,
                i.confidence_score DESC,
                i.generated_at DESC
            LIMIT ?
        `;
        params.push(parseInt(limit));
        
        const [insights] = await db.execute(query, params);
        
        // Get summary statistics
        const [summary] = await db.execute(`
            SELECT 
                COUNT(*) as total_insights,
                COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_count,
                COUNT(CASE WHEN severity = 'warning' THEN 1 END) as warning_count,
                COUNT(CASE WHEN severity = 'info' THEN 1 END) as info_count,
                COUNT(CASE WHEN acknowledged = FALSE THEN 1 END) as unacknowledged_count,
                AVG(confidence_score) as avg_confidence
            FROM ab_test_insights
            WHERE generated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        `);
        
        await db.end();
        
        res.json({
            success: true,
            insights: insights.map(insight => ({
                ...insight,
                supporting_data: JSON.parse(insight.supporting_data || '{}'),
                actionable_recommendations: JSON.parse(insight.actionable_recommendations || '[]'),
                confidence_score: parseFloat(insight.confidence_score || 0)
            })),
            summary: {
                ...summary[0],
                avg_confidence: parseFloat(summary[0].avg_confidence || 0)
            },
            filters: { severity, acknowledged, limit: parseInt(limit) }
        });
        
    } catch (error) {
        console.error('Insights retrieval error:', error);
        res.status(500).json({
            error: 'Failed to get insights',
            details: error.message
        });
    }
});

// Error handling middleware
router.use((error, req, res, next) => {
    console.error('A/B Testing API Error:', error);
    res.status(500).json({
        error: 'Internal server error in A/B Testing API',
        details: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    });
});

module.exports = router;