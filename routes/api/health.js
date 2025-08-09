/**
 * Health Check API Routes
 * Part of Phase D.3: Health check and diagnostic systems
 * Provides API endpoints for system health checks, diagnostics, and status monitoring
 */

const express = require('express');
const router = express.Router();
const HealthCheckService = require('../../src/services/HealthCheckService');
const GalleryCacheService = require('../../src/services/GalleryCacheService');

// Initialize services
let healthService = null;

// Middleware to initialize health check service
router.use((req, res, next) => {
    if (!healthService) {
        const cacheService = new GalleryCacheService();
        healthService = new HealthCheckService(req.db, cacheService);
        console.log('🏥 HealthCheckService initialized for API routes');
    }
    next();
});

/**
 * GET /api/health
 * Quick health check endpoint (lightweight)
 */
router.get('/', (req, res) => {
    try {
        const currentHealth = healthService.getCurrentHealth();
        const summary = healthService.getHealthSummary();
        
        // Quick status determination
        let status = 'healthy';
        let httpStatus = 200;
        
        if (currentHealth?.overall) {
            status = currentHealth.overall;
            
            // Map health status to HTTP status codes
            switch (status) {
                case 'critical':
                    httpStatus = 503; // Service Unavailable
                    break;
                case 'degraded':
                    httpStatus = 500; // Internal Server Error
                    break;
                case 'warn':
                    httpStatus = 200; // OK but with warnings
                    break;
                case 'healthy':
                default:
                    httpStatus = 200; // OK
                    break;
            }
        }
        
        res.status(httpStatus).json({
            status,
            timestamp: Date.now(),
            uptime: process.uptime(),
            version: require('../../package.json').version,
            environment: process.env.NODE_ENV || 'development',
            lastCheck: summary.lastCheck,
            checks: {
                total: summary.totalChecks,
                successRate: summary.successRate
            }
        });

    } catch (error) {
        console.error('❌ Error in quick health check:', error.message);
        res.status(500).json({
            status: 'error',
            timestamp: Date.now(),
            error: 'Health check service unavailable'
        });
    }
});

/**
 * POST /api/health/check
 * Perform comprehensive health check
 */
router.post('/check', async (req, res) => {
    try {
        if (!healthService) {
            return res.status(500).json({
                success: false,
                error: 'Health check service not initialized'
            });
        }

        const options = req.body || {};
        
        console.log('🏥 Running comprehensive health check via API');
        
        const healthResults = await healthService.performHealthCheck(options);
        
        // Determine HTTP status code based on health
        let httpStatus = 200;
        switch (healthResults.overall) {
            case 'critical':
                httpStatus = 503; // Service Unavailable
                break;
            case 'degraded':
                httpStatus = 500; // Internal Server Error
                break;
            case 'warn':
                httpStatus = 200; // OK with warnings
                break;
            case 'healthy':
            default:
                httpStatus = 200; // OK
                break;
        }

        res.status(httpStatus).json({
            success: true,
            health: {
                id: healthResults.id,
                overall: healthResults.overall,
                timestamp: healthResults.timestamp,
                duration: healthResults.duration,
                categories: Object.fromEntries(
                    Object.entries(healthResults.categories).map(([name, category]) => [
                        name,
                        {
                            status: category.status,
                            passed: category.passed,
                            failed: category.failed,
                            warnings: category.warnings,
                            duration: category.duration,
                            checks: category.checks.map(check => ({
                                name: check.name,
                                status: check.status,
                                critical: check.critical,
                                message: check.message,
                                duration: check.duration,
                                error: check.error
                            }))
                        }
                    ])
                ),
                summary: healthResults.summary
            }
        });

    } catch (error) {
        console.error('❌ Error performing health check:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to perform health check'
        });
    }
});

/**
 * GET /api/health/status
 * Get current health status and summary
 */
router.get('/status', (req, res) => {
    try {
        if (!healthService) {
            return res.status(500).json({
                success: false,
                error: 'Health check service not initialized'
            });
        }

        const currentHealth = healthService.getCurrentHealth();
        const summary = healthService.getHealthSummary();
        
        res.json({
            success: true,
            status: {
                overall: currentHealth?.overall || 'unknown',
                lastCheck: summary.lastCheck,
                uptime: summary.uptime,
                systemUptime: process.uptime(),
                checks: {
                    total: summary.totalChecks,
                    passed: summary.passedChecks,
                    failed: summary.failedChecks,
                    successRate: summary.successRate
                },
                lastResults: currentHealth ? {
                    id: currentHealth.id,
                    timestamp: currentHealth.timestamp,
                    duration: currentHealth.duration,
                    categorySummary: Object.fromEntries(
                        Object.entries(currentHealth.categories || {}).map(([name, cat]) => [
                            name,
                            {
                                status: cat.status,
                                checks: cat.checks?.length || 0,
                                passed: cat.passed || 0,
                                failed: cat.failed || 0,
                                warnings: cat.warnings || 0
                            }
                        ])
                    )
                } : null
            }
        });

    } catch (error) {
        console.error('❌ Error getting health status:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get health status'
        });
    }
});

/**
 * GET /api/health/history
 * Get health check history
 */
router.get('/history', (req, res) => {
    try {
        if (!healthService) {
            return res.status(500).json({
                success: false,
                error: 'Health check service not initialized'
            });
        }

        const { limit = 20 } = req.query;
        const history = healthService.getHealthHistory(parseInt(limit));
        
        const formattedHistory = history.map(check => ({
            id: check.id,
            overall: check.overall,
            timestamp: check.timestamp,
            duration: check.duration,
            summary: check.summary,
            categoryStatus: Object.fromEntries(
                Object.entries(check.categories || {}).map(([name, cat]) => [
                    name,
                    cat.status
                ])
            )
        }));

        res.json({
            success: true,
            history: formattedHistory,
            total: formattedHistory.length,
            limit: parseInt(limit)
        });

    } catch (error) {
        console.error('❌ Error getting health history:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get health history'
        });
    }
});

/**
 * GET /api/health/diagnostics
 * Get detailed diagnostic information
 */
router.get('/diagnostics', async (req, res) => {
    try {
        if (!healthService) {
            return res.status(500).json({
                success: false,
                error: 'Health check service not initialized'
            });
        }

        console.log('🔍 Collecting diagnostic data');
        
        const diagnostics = await healthService.collectDiagnosticData();
        
        res.json({
            success: true,
            diagnostics: {
                ...diagnostics,
                // Add additional runtime diagnostics
                runtime: {
                    nodeVersion: process.version,
                    platform: process.platform,
                    architecture: process.arch,
                    pid: process.pid,
                    ppid: process.ppid,
                    execPath: process.execPath,
                    cwd: process.cwd()
                },
                environment: {
                    nodeEnv: process.env.NODE_ENV || 'development',
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    locale: Intl.DateTimeFormat().resolvedOptions().locale
                }
            },
            generatedAt: Date.now()
        });

    } catch (error) {
        console.error('❌ Error collecting diagnostics:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to collect diagnostic data'
        });
    }
});

/**
 * GET /api/health/check/:checkName
 * Run individual health check
 */
router.get('/check/:checkName', async (req, res) => {
    try {
        if (!healthService) {
            return res.status(500).json({
                success: false,
                error: 'Health check service not initialized'
            });
        }

        const { checkName } = req.params;
        
        console.log(`🏥 Running individual health check: ${checkName}`);

        try {
            const checkResult = await healthService.executeHealthCheck(checkName, {});
            
            let httpStatus = 200;
            if (checkResult.status === 'fail') {
                httpStatus = 500;
            } else if (checkResult.status === 'warn') {
                httpStatus = 200; // Still OK, just a warning
            }
            
            res.status(httpStatus).json({
                success: true,
                check: {
                    name: checkName,
                    ...checkResult,
                    executedAt: Date.now()
                }
            });

        } catch (error) {
            if (error.message.includes('Unknown health check')) {
                res.status(404).json({
                    success: false,
                    error: `Unknown health check: ${checkName}`,
                    availableChecks: [
                        'database', 'fileSystem', 'memory', 'diskSpace',
                        'cache', 'imageProcessing', 'backgroundQueue', 'apiEndpoints',
                        'networkConnectivity', 'dnsResolution'
                    ]
                });
            } else {
                throw error;
            }
        }

    } catch (error) {
        console.error('❌ Error running individual health check:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to run health check'
        });
    }
});

/**
 * GET /api/health/readiness
 * Kubernetes/Docker readiness probe endpoint
 */
router.get('/readiness', async (req, res) => {
    try {
        if (!healthService) {
            return res.status(503).json({
                ready: false,
                reason: 'Health service not initialized'
            });
        }

        // Run essential checks only for readiness
        const essentialChecks = ['database', 'fileSystem', 'memory'];
        let allReady = true;
        const checkResults = [];

        for (const checkName of essentialChecks) {
            try {
                const result = await healthService.executeHealthCheck(checkName, {});
                checkResults.push({
                    name: checkName,
                    status: result.status,
                    ready: result.status === 'pass' || result.status === 'warn'
                });
                
                if (result.status === 'fail') {
                    allReady = false;
                }
            } catch (error) {
                checkResults.push({
                    name: checkName,
                    status: 'fail',
                    ready: false,
                    error: error.message
                });
                allReady = false;
            }
        }

        const httpStatus = allReady ? 200 : 503;
        
        res.status(httpStatus).json({
            ready: allReady,
            timestamp: Date.now(),
            checks: checkResults
        });

    } catch (error) {
        console.error('❌ Error in readiness check:', error.message);
        res.status(503).json({
            ready: false,
            reason: 'Readiness check failed',
            error: error.message
        });
    }
});

/**
 * GET /api/health/liveness
 * Kubernetes/Docker liveness probe endpoint
 */
router.get('/liveness', (req, res) => {
    try {
        // Simple liveness check - just verify the process is responding
        const uptime = process.uptime();
        
        res.json({
            alive: true,
            uptime,
            timestamp: Date.now(),
            pid: process.pid
        });

    } catch (error) {
        console.error('❌ Error in liveness check:', error.message);
        res.status(500).json({
            alive: false,
            error: error.message
        });
    }
});

/**
 * GET /api/health/metrics
 * Health metrics for monitoring systems (Prometheus format optional)
 */
router.get('/metrics', (req, res) => {
    try {
        if (!healthService) {
            return res.status(500).json({
                success: false,
                error: 'Health check service not initialized'
            });
        }

        const { format } = req.query;
        const summary = healthService.getHealthSummary();
        const currentHealth = healthService.getCurrentHealth();
        
        if (format === 'prometheus') {
            // Simple Prometheus-style metrics
            let metrics = `# HELP musenest_health_checks_total Total number of health checks performed
# TYPE musenest_health_checks_total counter
musenest_health_checks_total ${summary.totalChecks}

# HELP musenest_health_checks_passed_total Number of passed health checks
# TYPE musenest_health_checks_passed_total counter
musenest_health_checks_passed_total ${summary.passedChecks}

# HELP musenest_health_checks_failed_total Number of failed health checks
# TYPE musenest_health_checks_failed_total counter
musenest_health_checks_failed_total ${summary.failedChecks}

# HELP musenest_uptime_seconds System uptime in seconds
# TYPE musenest_uptime_seconds gauge
musenest_uptime_seconds ${process.uptime()}

# HELP musenest_health_status Current health status (0=unknown, 1=healthy, 2=warn, 3=degraded, 4=critical)
# TYPE musenest_health_status gauge
musenest_health_status ${this.healthStatusToNumber(currentHealth?.overall)}
`;

            res.set('Content-Type', 'text/plain');
            res.send(metrics);
        } else {
            // JSON format
            res.json({
                success: true,
                metrics: {
                    healthChecks: {
                        total: summary.totalChecks,
                        passed: summary.passedChecks,
                        failed: summary.failedChecks,
                        successRate: summary.successRate
                    },
                    system: {
                        uptime: summary.uptime,
                        processUptime: process.uptime(),
                        lastHealthCheck: summary.lastCheck
                    },
                    status: {
                        overall: currentHealth?.overall || 'unknown',
                        lastCheckDuration: currentHealth?.duration || 0
                    }
                },
                timestamp: Date.now()
            });
        }

    } catch (error) {
        console.error('❌ Error getting health metrics:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get health metrics'
        });
    }
});

// Helper method for Prometheus metrics
router.healthStatusToNumber = function(status) {
    const statusMap = {
        'unknown': 0,
        'healthy': 1,
        'warn': 2,
        'degraded': 3,
        'critical': 4
    };
    return statusMap[status] || 0;
};

module.exports = router;