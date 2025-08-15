/**
 * Production Monitoring API Routes
 * 
 * RESTful API for production monitoring, alerting, and health checks.
 * Integrates ProductionMonitoringService with AlertingService.
 */

const express = require('express');
const router = express.Router();
const { query, validationResult } = require('express-validator');
const ProductionMonitoringService = require('../../src/services/ProductionMonitoringService');
const AlertingService = require('../../src/services/AlertingService');
const mysql = require('mysql2/promise');

// Initialize database connection
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'musenest'
});

// Initialize services
const monitoringService = new ProductionMonitoringService(db);
const alertingService = new AlertingService({
    email: {
        enabled: process.env.ALERTS_EMAIL_ENABLED === 'true',
        smtp: {
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: process.env.SMTP_SECURE === 'true',
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        },
        from: process.env.ALERT_FROM_EMAIL,
        to: process.env.ALERT_TO_EMAIL?.split(',') || []
    },
    slack: {
        enabled: process.env.ALERTS_SLACK_ENABLED === 'true',
        webhook: process.env.SLACK_WEBHOOK_URL,
        channel: process.env.SLACK_ALERT_CHANNEL || '#alerts'
    },
    webhook: {
        enabled: process.env.ALERTS_WEBHOOK_ENABLED === 'true',
        url: process.env.WEBHOOK_ALERT_URL,
        headers: JSON.parse(process.env.WEBHOOK_HEADERS || '{}')
    }
});

// Connect monitoring service to alerting service
monitoringService.on('alert', async (alert) => {
    try {
        await alertingService.sendAlert(alert);
    } catch (error) {
        console.error('❌ Failed to send monitoring alert:', error);
    }
});

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
 * GET /api/production-monitoring/health
 * Get current system health overview
 */
router.get('/health', async (req, res) => {
    try {
        const healthChecks = await monitoringService.performHealthChecks();
        const healthOverview = await db.query(`
            SELECT * FROM v_system_health_overview
        `);

        res.json({
            success: true,
            data: {
                currentChecks: healthChecks,
                overview: healthOverview[0]
            }
        });

    } catch (error) {
        console.error('Error getting health status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get health status',
            error: error.message
        });
    }
});

/**
 * GET /api/production-monitoring/metrics
 * Get production metrics with filtering
 */
router.get('/metrics', [
    query('category').optional().isIn(['system', 'database', 'api', 'gallery', 'theme', 'user_experience', 'migration']),
    query('timeframe').optional().isIn(['1h', '6h', '24h', '7d', '30d']),
    query('aggregation').optional().isIn(['avg', 'min', 'max', 'sum'])
], handleValidationErrors, async (req, res) => {
    try {
        const {
            category,
            timeframe = '24h',
            aggregation = 'avg'
        } = req.query;

        // Parse timeframe
        const timeframeHours = {
            '1h': 1, '6h': 6, '24h': 24, '7d': 168, '30d': 720
        }[timeframe] || 24;

        let query = `
            SELECT 
                metric_category,
                metric_name,
                ${aggregation.toUpperCase()}(metric_value) as value,
                metric_unit,
                COUNT(*) as sample_count,
                MIN(collected_at) as period_start,
                MAX(collected_at) as period_end
            FROM production_metrics 
            WHERE collected_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
        `;
        
        const params = [timeframeHours];
        
        if (category) {
            query += ' AND metric_category = ?';
            params.push(category);
        }
        
        query += ' GROUP BY metric_category, metric_name ORDER BY metric_category, metric_name';
        
        const [metrics] = await db.query(query, params);

        res.json({
            success: true,
            data: {
                metrics,
                timeframe,
                aggregation,
                category: category || 'all'
            }
        });

    } catch (error) {
        console.error('Error getting metrics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get metrics',
            error: error.message
        });
    }
});

/**
 * GET /api/production-monitoring/alerts
 * Get alert history and statistics
 */
router.get('/alerts', [
    query('status').optional().isIn(['active', 'resolved', 'all']),
    query('severity').optional().isIn(['low', 'medium', 'high', 'critical']),
    query('source').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 100 })
], handleValidationErrors, async (req, res) => {
    try {
        const {
            status = 'all',
            severity,
            source,
            limit = 50
        } = req.query;

        let query = 'SELECT * FROM alert_history WHERE 1=1';
        const params = [];

        // Status filter
        if (status === 'active') {
            query += ' AND resolved_at IS NULL';
        } else if (status === 'resolved') {
            query += ' AND resolved_at IS NOT NULL';
        }

        // Severity filter
        if (severity) {
            query += ' AND severity = ?';
            params.push(severity);
        }

        // Source filter
        if (source) {
            query += ' AND source = ?';
            params.push(source);
        }

        query += ' ORDER BY created_at DESC LIMIT ?';
        params.push(parseInt(limit));

        const [alerts] = await db.query(query, params);

        // Get alert statistics
        const [stats] = await db.query(`
            SELECT 
                COUNT(*) as total_alerts,
                COUNT(CASE WHEN resolved_at IS NULL THEN 1 END) as active_alerts,
                COUNT(CASE WHEN resolved_at IS NOT NULL THEN 1 END) as resolved_alerts,
                COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_alerts,
                AVG(TIMESTAMPDIFF(MINUTE, created_at, resolved_at)) as avg_resolution_time
            FROM alert_history
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        `);

        res.json({
            success: true,
            data: {
                alerts: alerts.map(alert => ({
                    ...alert,
                    metadata: JSON.parse(alert.metadata || '{}')
                })),
                statistics: stats[0],
                filters: { status, severity, source, limit }
            }
        });

    } catch (error) {
        console.error('Error getting alerts:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get alerts',
            error: error.message
        });
    }
});

/**
 * POST /api/production-monitoring/alerts/:alertId/resolve
 * Mark an alert as resolved
 */
router.post('/alerts/:alertId/resolve', async (req, res) => {
    try {
        const { alertId } = req.params;
        const { resolution_notes } = req.body;

        await db.query(`
            UPDATE alert_history 
            SET resolved_at = NOW(), 
                metadata = JSON_SET(IFNULL(metadata, '{}'), '$.resolution_notes', ?)
            WHERE alert_id = ?
        `, [resolution_notes || 'Manually resolved', alertId]);

        // Send resolution notification
        const [alert] = await db.query(
            'SELECT * FROM alert_history WHERE alert_id = ?',
            [alertId]
        );

        if (alert.length > 0) {
            await alertingService.sendResolutionNotification({
                id: alertId,
                type: alert[0].alert_type,
                message: alert[0].description
            });
        }

        res.json({
            success: true,
            message: 'Alert marked as resolved'
        });

    } catch (error) {
        console.error('Error resolving alert:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to resolve alert',
            error: error.message
        });
    }
});

/**
 * GET /api/production-monitoring/dashboard
 * Get dashboard overview data
 */
router.get('/dashboard', async (req, res) => {
    try {
        // Get system health overview
        const [healthOverview] = await db.query('SELECT * FROM v_system_health_overview');
        
        // Get active alerts
        const [activeAlerts] = await db.query('SELECT * FROM v_active_alerts LIMIT 10');
        
        // Get recent metrics trends
        const [metricsTrends] = await db.query(`
            SELECT * FROM v_performance_trends 
            WHERE metric_date >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)
            ORDER BY metric_date DESC, metric_hour DESC
            LIMIT 50
        `);
        
        // Get alert statistics
        const [alertStats] = await db.query(`
            SELECT * FROM v_alert_statistics 
            WHERE alert_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            ORDER BY alert_date DESC
        `);

        // Get system uptime
        const [uptimeStats] = await db.query(`
            SELECT 
                component_name,
                uptime_start,
                CASE 
                    WHEN uptime_end IS NULL THEN TIMESTAMPDIFF(SECOND, uptime_start, NOW())
                    ELSE TIMESTAMPDIFF(SECOND, uptime_start, uptime_end)
                END as uptime_seconds
            FROM system_uptime
            WHERE uptime_end IS NULL OR uptime_end >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            ORDER BY component_name
        `);

        res.json({
            success: true,
            data: {
                systemHealth: healthOverview,
                activeAlerts: activeAlerts.map(alert => ({
                    ...alert,
                    metadata: JSON.parse(alert.metadata || '{}')
                })),
                metricsTrends,
                alertStatistics: alertStats,
                systemUptime: uptimeStats
            }
        });

    } catch (error) {
        console.error('Error getting dashboard data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get dashboard data',
            error: error.message
        });
    }
});

/**
 * POST /api/production-monitoring/test-alert
 * Send a test alert through all configured channels
 */
router.post('/test-alert', async (req, res) => {
    try {
        const result = await alertingService.testAlerts();
        
        res.json({
            success: true,
            message: 'Test alert sent',
            data: result
        });

    } catch (error) {
        console.error('Error sending test alert:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send test alert',
            error: error.message
        });
    }
});

/**
 * GET /api/production-monitoring/performance-trends/:metric
 * Get detailed performance trends for a specific metric
 */
router.get('/performance-trends/:metric', [
    query('timeframe').optional().isIn(['1h', '6h', '24h', '7d', '30d']),
    query('category').optional().isString()
], handleValidationErrors, async (req, res) => {
    try {
        const { metric } = req.params;
        const { timeframe = '24h', category } = req.query;
        
        const timeframeHours = {
            '1h': 1, '6h': 6, '24h': 24, '7d': 168, '30d': 720
        }[timeframe] || 24;

        let query = `
            SELECT 
                metric_category,
                metric_name,
                metric_value,
                metric_unit,
                tags,
                collected_at
            FROM production_metrics
            WHERE metric_name = ? 
            AND collected_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
        `;
        
        const params = [metric, timeframeHours];
        
        if (category) {
            query += ' AND metric_category = ?';
            params.push(category);
        }
        
        query += ' ORDER BY collected_at ASC';
        
        const [trends] = await db.query(query, params);

        // Get baseline for comparison
        const [baseline] = await db.query(`
            SELECT * FROM performance_baselines 
            WHERE metric_name = ? 
            AND (metric_category = ? OR ? IS NULL)
            AND is_active = TRUE
            LIMIT 1
        `, [metric, category, category]);

        res.json({
            success: true,
            data: {
                trends: trends.map(row => ({
                    ...row,
                    tags: JSON.parse(row.tags || '{}')
                })),
                baseline: baseline[0] || null,
                metric,
                category,
                timeframe
            }
        });

    } catch (error) {
        console.error('Error getting performance trends:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get performance trends',
            error: error.message
        });
    }
});

/**
 * POST /api/production-monitoring/start
 * Start the monitoring service
 */
router.post('/start', async (req, res) => {
    try {
        monitoringService.start();
        
        res.json({
            success: true,
            message: 'Production monitoring started'
        });

    } catch (error) {
        console.error('Error starting monitoring:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to start monitoring',
            error: error.message
        });
    }
});

/**
 * POST /api/production-monitoring/stop
 * Stop the monitoring service
 */
router.post('/stop', async (req, res) => {
    try {
        monitoringService.stop();
        
        res.json({
            success: true,
            message: 'Production monitoring stopped'
        });

    } catch (error) {
        console.error('Error stopping monitoring:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to stop monitoring',
            error: error.message
        });
    }
});

module.exports = router;