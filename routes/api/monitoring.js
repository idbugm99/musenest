/**
 * Monitoring API Routes
 * Part of Phase D.2: Comprehensive system monitoring and alerting
 * Provides API endpoints for system monitoring, metrics, and alerts
 */

const express = require('express');
const router = express.Router();
const SystemMonitoringService = require('../../src/services/SystemMonitoringService');
const AlertingService = require('../../src/services/AlertingService');

// Initialize services
let monitoringService = null;
let alertingService = null;

// Middleware to initialize monitoring services
router.use((req, res, next) => {
    if (!monitoringService) {
        // Initialize alerting service first
        alertingService = new AlertingService({
            email: {
                enabled: process.env.ALERT_EMAIL_ENABLED === 'true',
                recipients: process.env.ALERT_EMAIL_RECIPIENTS ? process.env.ALERT_EMAIL_RECIPIENTS.split(',') : []
            },
            webhook: {
                enabled: process.env.ALERT_WEBHOOK_ENABLED === 'true',
                urls: process.env.ALERT_WEBHOOK_URLS ? process.env.ALERT_WEBHOOK_URLS.split(',') : []
            },
            slack: {
                enabled: process.env.ALERT_SLACK_ENABLED === 'true',
                webhookUrl: process.env.ALERT_SLACK_WEBHOOK_URL,
                channel: process.env.ALERT_SLACK_CHANNEL || '#alerts'
            }
        });
        
        // Initialize monitoring service with alerting
        monitoringService = new SystemMonitoringService(alertingService);
        
        console.log('📊 System monitoring services initialized for API routes');
        
        // Auto-start monitoring in production
        if (process.env.NODE_ENV === 'production') {
            monitoringService.startMonitoring();
        }
    }
    next();
});

/**
 * POST /api/monitoring/start
 * Start system monitoring
 */
router.post('/start', async (req, res) => {
    try {
        if (!monitoringService) {
            return res.status(500).json({
                success: false,
                error: 'Monitoring service not initialized'
            });
        }

        const { interval, thresholds } = req.body;
        const options = {};
        
        if (interval) options.interval = parseInt(interval);
        if (thresholds) options.thresholds = thresholds;

        await monitoringService.startMonitoring(options);

        console.log('📊 Monitoring started via API');

        res.json({
            success: true,
            message: 'System monitoring started',
            configuration: {
                interval: options.interval || 5000,
                thresholds: monitoringService.alertThresholds,
                alertingEnabled: !!alertingService
            }
        });

    } catch (error) {
        console.error('❌ Error starting monitoring:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to start monitoring'
        });
    }
});

/**
 * POST /api/monitoring/stop
 * Stop system monitoring
 */
router.post('/stop', (req, res) => {
    try {
        if (!monitoringService) {
            return res.status(500).json({
                success: false,
                error: 'Monitoring service not initialized'
            });
        }

        monitoringService.stopMonitoring();

        console.log('📊 Monitoring stopped via API');

        res.json({
            success: true,
            message: 'System monitoring stopped'
        });

    } catch (error) {
        console.error('❌ Error stopping monitoring:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to stop monitoring'
        });
    }
});

/**
 * GET /api/monitoring/status
 * Get monitoring service status
 */
router.get('/status', (req, res) => {
    try {
        if (!monitoringService) {
            return res.status(500).json({
                success: false,
                error: 'Monitoring service not initialized'
            });
        }

        const summary = monitoringService.getMetricsSummary();
        const currentMetrics = monitoringService.getCurrentMetrics();
        const activeAlerts = monitoringService.getActiveAlerts();

        res.json({
            success: true,
            status: {
                monitoring: {
                    active: monitoringService.isMonitoring(),
                    uptime: summary.monitoringUptime,
                    interval: monitoringService.monitoringInterval
                },
                metrics: {
                    lastCollection: currentMetrics?.timestamp || null,
                    systemUptime: summary.uptime,
                    peakMemoryUsage: summary.peakMemoryUsage,
                    peakCpuUsage: summary.peakCpuUsage
                },
                alerts: {
                    active: activeAlerts.length,
                    totalTriggered: summary.totalAlertsTriggered
                },
                alerting: {
                    enabled: !!alertingService,
                    channels: alertingService ? alertingService.getEnabledChannels() : []
                }
            }
        });

    } catch (error) {
        console.error('❌ Error getting monitoring status:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get monitoring status'
        });
    }
});

/**
 * GET /api/monitoring/metrics/current
 * Get current system metrics
 */
router.get('/metrics/current', (req, res) => {
    try {
        if (!monitoringService) {
            return res.status(500).json({
                success: false,
                error: 'Monitoring service not initialized'
            });
        }

        const currentMetrics = monitoringService.getCurrentMetrics();
        
        if (!currentMetrics) {
            return res.json({
                success: true,
                metrics: null,
                message: 'No metrics collected yet'
            });
        }

        res.json({
            success: true,
            metrics: {
                timestamp: currentMetrics.timestamp,
                system: {
                    uptime: currentMetrics.system.uptime,
                    memory: {
                        used: currentMetrics.system.memory.used,
                        total: currentMetrics.system.memory.total,
                        usage: currentMetrics.system.memory.usage
                    },
                    cpu: {
                        usage: currentMetrics.system.cpu.usage,
                        loadAverage: currentMetrics.system.cpu.loadAverage
                    },
                    disk: currentMetrics.system.disk
                },
                application: {
                    environment: currentMetrics.application.environment,
                    nodeVersion: currentMetrics.application.nodeVersion,
                    requests: currentMetrics.application.requests,
                    eventLoop: currentMetrics.application.eventLoop
                },
                database: {
                    connected: currentMetrics.database.connected,
                    connectionPool: currentMetrics.database.connectionPool,
                    performance: currentMetrics.database.performance
                },
                cache: {
                    type: currentMetrics.cache.type,
                    connected: currentMetrics.cache.connected,
                    performance: currentMetrics.cache.performance,
                    usage: currentMetrics.cache.usage
                },
                queue: {
                    jobs: currentMetrics.queue.jobs,
                    performance: currentMetrics.queue.performance,
                    workers: currentMetrics.queue.workers
                }
            },
            collectedAt: new Date(currentMetrics.timestamp).toISOString()
        });

    } catch (error) {
        console.error('❌ Error getting current metrics:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get current metrics'
        });
    }
});

/**
 * GET /api/monitoring/metrics/history
 * Get metrics history
 */
router.get('/metrics/history', (req, res) => {
    try {
        if (!monitoringService) {
            return res.status(500).json({
                success: false,
                error: 'Monitoring service not initialized'
            });
        }

        const { timeRange = 3600000 } = req.query; // 1 hour default
        const history = monitoringService.getMetricsHistory(parseInt(timeRange));
        
        // Format history for API response
        const formattedHistory = Object.entries(history).map(([timestamp, metrics]) => ({
            timestamp: parseInt(timestamp),
            system: {
                cpu: metrics.system?.cpu?.usage || 0,
                memory: metrics.system?.memory?.usage || 0,
                disk: metrics.system?.disk?.usage || 0
            },
            application: {
                errorRate: metrics.application?.requests?.errorRate || 0,
                responseTime: metrics.application?.requests?.averageResponseTime || 0,
                eventLoopDelay: metrics.application?.eventLoop?.delay || 0
            },
            database: {
                connectionUsage: metrics.database?.connectionPool?.usage || 0,
                queryTime: metrics.database?.performance?.averageQueryTime || 0
            },
            cache: {
                hitRate: (metrics.cache?.performance?.hitRate || 0) * 100,
                responseTime: metrics.cache?.performance?.averageGetTime || 0
            },
            queue: {
                pending: metrics.queue?.jobs?.pending || 0,
                running: metrics.queue?.jobs?.running || 0,
                throughput: metrics.queue?.performance?.throughput || 0
            }
        })).sort((a, b) => a.timestamp - b.timestamp);

        res.json({
            success: true,
            history: formattedHistory,
            timeRange: parseInt(timeRange),
            dataPoints: formattedHistory.length
        });

    } catch (error) {
        console.error('❌ Error getting metrics history:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get metrics history'
        });
    }
});

/**
 * GET /api/monitoring/alerts/active
 * Get active alerts
 */
router.get('/alerts/active', (req, res) => {
    try {
        if (!monitoringService) {
            return res.status(500).json({
                success: false,
                error: 'Monitoring service not initialized'
            });
        }

        const activeAlerts = monitoringService.getActiveAlerts();
        
        const formattedAlerts = activeAlerts.map(alert => ({
            id: alert.id,
            type: alert.type,
            level: alert.level,
            message: alert.message,
            value: alert.value,
            threshold: alert.threshold,
            count: alert.count,
            firstSeen: alert.firstSeen,
            lastSeen: alert.lastSeen,
            duration: Date.now() - alert.firstSeen,
            acknowledged: alert.acknowledged || false
        }));

        res.json({
            success: true,
            alerts: formattedAlerts,
            total: formattedAlerts.length
        });

    } catch (error) {
        console.error('❌ Error getting active alerts:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get active alerts'
        });
    }
});

/**
 * GET /api/monitoring/alerts/history
 * Get alert history
 */
router.get('/alerts/history', (req, res) => {
    try {
        if (!monitoringService || !alertingService) {
            return res.status(500).json({
                success: false,
                error: 'Monitoring services not initialized'
            });
        }

        const { limit = 50 } = req.query;
        const alertHistory = monitoringService.getAlertHistory(parseInt(limit));
        const alertingHistory = alertingService.getAlertHistory(parseInt(limit));
        
        // Combine and deduplicate alert histories
        const combinedHistory = [...alertHistory, ...alertingHistory];
        const uniqueHistory = combinedHistory
            .filter((alert, index, arr) => 
                arr.findIndex(a => a.id === alert.id) === index
            )
            .sort((a, b) => (b.timestamp || b.sentAt) - (a.timestamp || a.sentAt))
            .slice(0, parseInt(limit));

        res.json({
            success: true,
            history: uniqueHistory.map(alert => ({
                id: alert.id,
                type: alert.type,
                level: alert.level,
                message: alert.message,
                timestamp: alert.timestamp || alert.sentAt,
                channels: alert.channels,
                success: alert.success,
                resolved: !!alert.resolvedAt
            })),
            total: uniqueHistory.length,
            limit: parseInt(limit)
        });

    } catch (error) {
        console.error('❌ Error getting alert history:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get alert history'
        });
    }
});

/**
 * POST /api/monitoring/alerts/:alertType/acknowledge
 * Acknowledge an active alert
 */
router.post('/alerts/:alertType/acknowledge', (req, res) => {
    try {
        if (!monitoringService) {
            return res.status(500).json({
                success: false,
                error: 'Monitoring service not initialized'
            });
        }

        const { alertType } = req.params;
        
        const acknowledged = monitoringService.acknowledgeAlert(alertType);
        
        if (acknowledged) {
            console.log(`📋 Alert acknowledged via API: ${alertType}`);
            res.json({
                success: true,
                message: `Alert acknowledged: ${alertType}`,
                alertType,
                acknowledgedAt: Date.now()
            });
        } else {
            res.status(404).json({
                success: false,
                error: `Alert not found: ${alertType}`
            });
        }

    } catch (error) {
        console.error('❌ Error acknowledging alert:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to acknowledge alert'
        });
    }
});

/**
 * GET /api/monitoring/thresholds
 * Get current alert thresholds
 */
router.get('/thresholds', (req, res) => {
    try {
        if (!monitoringService) {
            return res.status(500).json({
                success: false,
                error: 'Monitoring service not initialized'
            });
        }

        res.json({
            success: true,
            thresholds: monitoringService.alertThresholds,
            descriptions: {
                cpu: 'CPU usage percentage threshold',
                memory: 'Memory usage percentage threshold',
                disk: 'Disk usage percentage threshold',
                responseTime: 'Response time threshold in milliseconds',
                errorRate: 'Error rate percentage threshold',
                databaseConnections: 'Database connection pool usage percentage',
                cacheHitRate: 'Minimum cache hit rate (0.0 - 1.0)',
                queueSize: 'Maximum background job queue size'
            }
        });

    } catch (error) {
        console.error('❌ Error getting thresholds:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get thresholds'
        });
    }
});

/**
 * PUT /api/monitoring/thresholds
 * Update alert thresholds
 */
router.put('/thresholds', (req, res) => {
    try {
        if (!monitoringService) {
            return res.status(500).json({
                success: false,
                error: 'Monitoring service not initialized'
            });
        }

        const newThresholds = req.body;
        
        // Validate thresholds
        const validKeys = ['cpu', 'memory', 'disk', 'responseTime', 'errorRate', 'databaseConnections', 'cacheHitRate', 'queueSize'];
        const invalidKeys = Object.keys(newThresholds).filter(key => !validKeys.includes(key));
        
        if (invalidKeys.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Invalid threshold keys: ${invalidKeys.join(', ')}`
            });
        }

        // Update thresholds
        monitoringService.updateAlertThresholds(newThresholds);
        
        console.log('📊 Alert thresholds updated via API:', newThresholds);

        res.json({
            success: true,
            message: 'Alert thresholds updated',
            thresholds: monitoringService.alertThresholds,
            updated: Object.keys(newThresholds)
        });

    } catch (error) {
        console.error('❌ Error updating thresholds:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to update thresholds'
        });
    }
});

/**
 * GET /api/monitoring/statistics
 * Get monitoring and alerting statistics
 */
router.get('/statistics', (req, res) => {
    try {
        if (!monitoringService) {
            return res.status(500).json({
                success: false,
                error: 'Monitoring service not initialized'
            });
        }

        const summary = monitoringService.getMetricsSummary();
        const alertStats = alertingService ? alertingService.getAlertStatistics() : {};
        
        res.json({
            success: true,
            statistics: {
                monitoring: {
                    active: monitoringService.isMonitoring(),
                    uptime: summary.monitoringUptime,
                    systemUptime: summary.uptime,
                    peakMemoryUsage: summary.peakMemoryUsage,
                    peakCpuUsage: summary.peakCpuUsage,
                    totalRequests: summary.totalRequests,
                    totalErrors: summary.totalErrors,
                    averageResponseTime: summary.averageResponseTime
                },
                alerting: {
                    totalAlerts: alertStats.total || 0,
                    successfulAlerts: alertStats.successful || 0,
                    successRate: alertStats.successRate || 0,
                    activeAlerts: summary.activeAlertsCount,
                    escalatedAlerts: alertStats.escalatedCount || 0,
                    byLevel: alertStats.byLevel || {},
                    byType: alertStats.byType || {},
                    enabledChannels: alertingService ? alertingService.getEnabledChannels() : []
                },
                system: {
                    nodeVersion: process.version,
                    platform: process.platform,
                    environment: process.env.NODE_ENV || 'development',
                    pid: process.pid
                }
            }
        });

    } catch (error) {
        console.error('❌ Error getting statistics:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get statistics'
        });
    }
});

module.exports = router;