/**
 * Theme Migration API Routes
 * 
 * RESTful API for managing progressive theme rollouts,
 * A/B testing, and migration monitoring.
 */

const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const ThemeMigrationService = require('../../src/services/ThemeMigrationService');
const PerformanceMonitoringService = require('../../src/services/PerformanceMonitoringService');
const mysql = require('mysql2/promise');

// Initialize services
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'musenest'
});

const performanceMonitor = new PerformanceMonitoringService(db);
const migrationService = new ThemeMigrationService(db, performanceMonitor, console);

// Validation middleware
const validateMigration = [
    body('name').notEmpty().withMessage('Migration name is required'),
    body('description').optional().isString(),
    body('sourceTheme').isInt().withMessage('Source theme ID must be an integer'),
    body('targetTheme').isInt().withMessage('Target theme ID must be an integer'),
    body('targetModels').optional().isArray(),
    body('schedule').optional().isIn(['immediate', 'scheduled']),
    body('testCriteria').optional().isObject(),
    body('rollbackCriteria').optional().isObject()
];

const validateMigrationId = [
    param('migrationId').notEmpty().withMessage('Migration ID is required')
];

// Error handling middleware
function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array()
        });
    }
    next();
}

/**
 * GET /api/theme-migrations
 * List all theme migrations with filtering and pagination
 */
router.get('/', async (req, res) => {
    try {
        const {
            status,
            page = 1,
            limit = 20,
            sortBy = 'created_at',
            sortOrder = 'DESC'
        } = req.query;

        const offset = (page - 1) * limit;
        let whereClause = '';
        const params = [];

        if (status) {
            whereClause = 'WHERE status = ?';
            params.push(status);
        }

        const query = `
            SELECT 
                tm.*,
                JSON_EXTRACT(config, '$.name') as name,
                JSON_EXTRACT(config, '$.sourceTheme') as source_theme,
                JSON_EXTRACT(config, '$.targetTheme') as target_theme,
                JSON_EXTRACT(config, '$.currentPhase') as current_phase,
                COUNT(utm.id) as affected_users
            FROM theme_migrations tm
            LEFT JOIN user_theme_migrations utm ON tm.id = utm.migration_id
            ${whereClause}
            GROUP BY tm.id
            ORDER BY ${sortBy} ${sortOrder}
            LIMIT ? OFFSET ?
        `;

        params.push(parseInt(limit), offset);
        const [migrations] = await db.query(query, params);

        // Get total count
        const countQuery = `SELECT COUNT(*) as total FROM theme_migrations ${whereClause}`;
        const [countResult] = await db.query(countQuery, status ? [status] : []);
        const total = countResult[0].total;

        res.json({
            success: true,
            data: {
                migrations: migrations.map(m => ({
                    ...m,
                    config: JSON.parse(m.config)
                })),
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        console.error('Error listing migrations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to list migrations',
            error: error.message
        });
    }
});

/**
 * POST /api/theme-migrations
 * Create and start a new theme migration
 */
router.post('/', validateMigration, handleValidationErrors, async (req, res) => {
    try {
        const migrationId = `migration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const migrationConfig = {
            id: migrationId,
            name: req.body.name,
            description: req.body.description || '',
            sourceTheme: req.body.sourceTheme,
            targetTheme: req.body.targetTheme,
            targetModels: req.body.targetModels || [],
            schedule: req.body.schedule || 'immediate',
            testCriteria: req.body.testCriteria || {},
            rollbackCriteria: req.body.rollbackCriteria || {},
            selectionStrategy: req.body.selectionStrategy || 'random'
        };

        const result = await migrationService.startMigration(migrationConfig);

        res.status(201).json({
            success: true,
            message: 'Migration started successfully',
            data: {
                migrationId: result.migrationId,
                status: 'preparing'
            }
        });

    } catch (error) {
        console.error('Error starting migration:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to start migration',
            error: error.message
        });
    }
});

/**
 * GET /api/theme-migrations/:migrationId
 * Get detailed migration status and metrics
 */
router.get('/:migrationId', validateMigrationId, handleValidationErrors, async (req, res) => {
    try {
        const { migrationId } = req.params;
        const status = await migrationService.getMigrationStatus(migrationId);

        res.json({
            success: true,
            data: status
        });

    } catch (error) {
        console.error('Error getting migration status:', error);
        if (error.message.includes('not found')) {
            return res.status(404).json({
                success: false,
                message: 'Migration not found'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Failed to get migration status',
            error: error.message
        });
    }
});

/**
 * POST /api/theme-migrations/:migrationId/rollback
 * Manually trigger rollback of a migration
 */
router.post('/:migrationId/rollback', validateMigrationId, handleValidationErrors, async (req, res) => {
    try {
        const { migrationId } = req.params;
        const { reason = 'Manual rollback requested' } = req.body;

        const result = await migrationService.rollbackMigration(migrationId, reason);

        res.json({
            success: true,
            message: 'Migration rollback completed',
            data: result
        });

    } catch (error) {
        console.error('Error rolling back migration:', error);
        if (error.message.includes('not found')) {
            return res.status(404).json({
                success: false,
                message: 'Migration not found'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Failed to rollback migration',
            error: error.message
        });
    }
});

/**
 * GET /api/theme-migrations/:migrationId/metrics
 * Get detailed metrics for a migration
 */
router.get('/:migrationId/metrics', validateMigrationId, handleValidationErrors, async (req, res) => {
    try {
        const { migrationId } = req.params;
        const { timeframe = '24h', phase } = req.query;

        // Get metrics from database
        let metricsQuery = `
            SELECT 
                phase_name,
                metric_name,
                metric_value,
                collected_at
            FROM migration_metrics 
            WHERE migration_id = ?
        `;
        const params = [migrationId];

        // Add timeframe filter
        if (timeframe) {
            const hours = timeframe.endsWith('h') ? parseInt(timeframe) : 24;
            metricsQuery += ' AND collected_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)';
            params.push(hours);
        }

        // Add phase filter
        if (phase) {
            metricsQuery += ' AND phase_name = ?';
            params.push(phase);
        }

        metricsQuery += ' ORDER BY collected_at DESC';

        const [metrics] = await db.query(metricsQuery, params);

        // Get user feedback
        const [feedback] = await db.query(`
            SELECT rating, feedback_text, feedback_type, submitted_at
            FROM migration_user_feedback 
            WHERE migration_id = ?
            ORDER BY submitted_at DESC
            LIMIT 100
        `, [migrationId]);

        // Get rollback triggers
        const [triggers] = await db.query(`
            SELECT trigger_type, trigger_value, threshold_value, severity, triggered_at, action_taken
            FROM migration_rollback_triggers 
            WHERE migration_id = ?
            ORDER BY triggered_at DESC
        `, [migrationId]);

        res.json({
            success: true,
            data: {
                metrics: metrics,
                userFeedback: feedback,
                rollbackTriggers: triggers
            }
        });

    } catch (error) {
        console.error('Error getting migration metrics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get migration metrics',
            error: error.message
        });
    }
});

/**
 * POST /api/theme-migrations/:migrationId/feedback
 * Submit user feedback for a migration
 */
router.post('/:migrationId/feedback', [
    validateMigrationId,
    body('modelId').isInt().withMessage('Model ID must be an integer'),
    body('userId').optional().isInt(),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('feedbackText').optional().isString(),
    body('feedbackType').optional().isIn(['rating', 'complaint', 'compliment', 'suggestion'])
], handleValidationErrors, async (req, res) => {
    try {
        const { migrationId } = req.params;
        const { modelId, userId, rating, feedbackText, feedbackType = 'rating' } = req.body;

        await db.query(`
            INSERT INTO migration_user_feedback 
            (migration_id, model_id, user_id, rating, feedback_text, feedback_type)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [migrationId, modelId, userId || null, rating, feedbackText || null, feedbackType]);

        res.status(201).json({
            success: true,
            message: 'Feedback submitted successfully'
        });

    } catch (error) {
        console.error('Error submitting feedback:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit feedback',
            error: error.message
        });
    }
});

/**
 * GET /api/theme-migrations/dashboard/overview
 * Get migration dashboard overview
 */
router.get('/dashboard/overview', async (req, res) => {
    try {
        // Get active migrations
        const [activeMigrations] = await db.query(`
            SELECT COUNT(*) as count FROM theme_migrations 
            WHERE status IN ('preparing', 'in_progress')
        `);

        // Get completed migrations (last 30 days)
        const [completedMigrations] = await db.query(`
            SELECT COUNT(*) as count FROM theme_migrations 
            WHERE status = 'completed' 
            AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        `);

        // Get rollbacks (last 30 days)
        const [rollbackCount] = await db.query(`
            SELECT COUNT(*) as count FROM theme_migrations 
            WHERE status = 'rolled_back' 
            AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        `);

        // Get total affected users
        const [affectedUsers] = await db.query(`
            SELECT COUNT(DISTINCT CONCAT(model_id, '-', IFNULL(user_id, 'anonymous'))) as count
            FROM user_theme_migrations utm
            JOIN theme_migrations tm ON utm.migration_id = tm.id
            WHERE tm.status IN ('in_progress', 'completed')
        `);

        // Get recent migration activity
        const [recentActivity] = await db.query(`
            SELECT 
                tm.id,
                JSON_EXTRACT(config, '$.name') as name,
                tm.status,
                tm.updated_at,
                COUNT(utm.id) as affected_users
            FROM theme_migrations tm
            LEFT JOIN user_theme_migrations utm ON tm.id = utm.migration_id
            WHERE tm.updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY tm.id
            ORDER BY tm.updated_at DESC
            LIMIT 10
        `);

        // Get performance overview
        const [performanceMetrics] = await db.query(`
            SELECT 
                AVG(CASE WHEN metric_name = 'error_rate' THEN metric_value END) as avg_error_rate,
                AVG(CASE WHEN metric_name = 'response_time' THEN metric_value END) as avg_response_time,
                AVG(CASE WHEN metric_name = 'user_satisfaction' THEN metric_value END) as avg_satisfaction
            FROM migration_metrics 
            WHERE collected_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        `);

        res.json({
            success: true,
            data: {
                summary: {
                    activeMigrations: activeMigrations[0].count,
                    completedMigrations: completedMigrations[0].count,
                    rollbackCount: rollbackCount[0].count,
                    affectedUsers: affectedUsers[0].count
                },
                performance: {
                    avgErrorRate: performanceMetrics[0].avg_error_rate || 0,
                    avgResponseTime: performanceMetrics[0].avg_response_time || 0,
                    avgSatisfaction: performanceMetrics[0].avg_satisfaction || 0
                },
                recentActivity: recentActivity.map(activity => ({
                    ...activity,
                    name: JSON.parse(activity.name || '""')
                }))
            }
        });

    } catch (error) {
        console.error('Error getting dashboard overview:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get dashboard overview',
            error: error.message
        });
    }
});

/**
 * GET /api/theme-migrations/themes/:themeId/performance
 * Get performance comparison data for a theme
 */
router.get('/themes/:themeId/performance', [
    param('themeId').isInt().withMessage('Theme ID must be an integer')
], handleValidationErrors, async (req, res) => {
    try {
        const { themeId } = req.params;
        const { comparison = 'baseline', timeframe = '7d' } = req.query;

        const hours = timeframe.endsWith('d') ? parseInt(timeframe) * 24 : 
                      timeframe.endsWith('h') ? parseInt(timeframe) : 168; // Default 7 days

        // Get performance snapshots
        const [snapshots] = await db.query(`
            SELECT 
                snapshot_type,
                metrics,
                sample_size,
                created_at
            FROM theme_performance_snapshots 
            WHERE theme_id = ? 
            AND created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
            ORDER BY created_at DESC
        `, [themeId, hours]);

        // Get current performance metrics
        const [currentMetrics] = await db.query(`
            SELECT 
                mm.metric_name,
                AVG(mm.metric_value) as avg_value,
                MIN(mm.metric_value) as min_value,
                MAX(mm.metric_value) as max_value
            FROM migration_metrics mm
            JOIN theme_migrations tm ON mm.migration_id = tm.id
            WHERE JSON_EXTRACT(tm.config, '$.targetTheme') = ?
            AND mm.collected_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
            GROUP BY mm.metric_name
        `, [themeId, hours]);

        res.json({
            success: true,
            data: {
                snapshots: snapshots,
                currentMetrics: currentMetrics,
                timeframe: timeframe
            }
        });

    } catch (error) {
        console.error('Error getting theme performance:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get theme performance data',
            error: error.message
        });
    }
});

/**
 * POST /api/theme-migrations/ab-tests
 * Create A/B test configuration
 */
router.post('/ab-tests', [
    body('name').notEmpty().withMessage('Test name is required'),
    body('description').optional().isString(),
    body('controlTheme').isInt().withMessage('Control theme ID must be an integer'),
    body('variantTheme').isInt().withMessage('Variant theme ID must be an integer'),
    body('trafficSplit').optional().isFloat({ min: 0.1, max: 0.9 }),
    body('targetModels').optional().isArray(),
    body('duration').optional().isInt({ min: 1 })
], handleValidationErrors, async (req, res) => {
    try {
        const testId = `abtest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const {
            name,
            description,
            controlTheme,
            variantTheme,
            trafficSplit = 0.5,
            targetModels = [],
            duration = 7 // days
        } = req.body;

        const endDate = new Date();
        endDate.setDate(endDate.getDate() + duration);

        await db.query(`
            INSERT INTO ab_test_configs 
            (id, name, description, control_theme_id, variant_theme_id, traffic_split, target_models, status, start_date, end_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'active', NOW(), ?)
        `, [testId, name, description || null, controlTheme, variantTheme, trafficSplit, JSON.stringify(targetModels), endDate]);

        res.status(201).json({
            success: true,
            message: 'A/B test created successfully',
            data: {
                testId,
                status: 'active',
                endDate
            }
        });

    } catch (error) {
        console.error('Error creating A/B test:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create A/B test',
            error: error.message
        });
    }
});

module.exports = router;