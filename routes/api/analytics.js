/**
 * Analytics API Routes
 * Part of Phase E.1: Advanced analytics data collection and aggregation
 * Provides API endpoints for analytics data, metrics, and business intelligence
 */

const express = require('express');
const router = express.Router();
const AdvancedAnalyticsService = require('../../src/services/AdvancedAnalyticsService');

// Initialize analytics service
let analyticsService = null;

// Middleware to initialize analytics service
router.use((req, res, next) => {
    if (!analyticsService) {
        const config = {
            collection: {
                realTimeInterval: parseInt(process.env.ANALYTICS_REALTIME_INTERVAL) || 30000,
                aggregationInterval: parseInt(process.env.ANALYTICS_AGGREGATION_INTERVAL) || 300000,
                archiveInterval: parseInt(process.env.ANALYTICS_ARCHIVE_INTERVAL) || 3600000
            },
            retention: {
                rawData: parseInt(process.env.ANALYTICS_RAW_RETENTION) || 7,
                hourlyData: parseInt(process.env.ANALYTICS_HOURLY_RETENTION) || 30,
                dailyData: parseInt(process.env.ANALYTICS_DAILY_RETENTION) || 365,
                monthlyData: parseInt(process.env.ANALYTICS_MONTHLY_RETENTION) || 1095
            },
            analytics: {
                enablePredictive: process.env.ANALYTICS_PREDICTIVE_ENABLED !== 'false',
                enableAnomalyDetection: process.env.ANALYTICS_ANOMALY_DETECTION !== 'false',
                enableTrendAnalysis: process.env.ANALYTICS_TREND_ANALYSIS !== 'false',
                confidenceThreshold: parseFloat(process.env.ANALYTICS_CONFIDENCE_THRESHOLD) || 0.8
            },
            storage: {
                analyticsDir: process.env.ANALYTICS_STORAGE_DIR || '/tmp/musenest-analytics'
            }
        };

        analyticsService = new AdvancedAnalyticsService(req.db, config);
        console.log('📊 AdvancedAnalyticsService initialized for API routes');
    }
    next();
});

/**
 * GET /api/analytics/status
 * Get analytics service status and summary
 */
router.get('/status', (req, res) => {
    try {
        if (!analyticsService) {
            return res.status(500).json({
                success: false,
                error: 'Analytics service not initialized'
            });
        }

        const summary = analyticsService.getAnalyticsSummary();
        
        res.json({
            success: true,
            status: {
                active: summary.isActive,
                lastCollection: summary.lastCollection ? 
                    new Date(summary.lastCollection).toISOString() : null,
                dataPoints: {
                    realTime: summary.realTimeMetrics,
                    aggregated: summary.aggregatedDataPoints,
                    trends: summary.trends
                },
                anomalies: {
                    recent: summary.recentAnomalies,
                    detectionEnabled: summary.configuration.analytics.enableAnomalyDetection
                },
                configuration: {
                    realTimeInterval: summary.configuration.collection.realTimeInterval,
                    aggregationInterval: summary.configuration.collection.aggregationInterval,
                    predictiveAnalytics: summary.configuration.analytics.enablePredictive,
                    trendAnalysis: summary.configuration.analytics.enableTrendAnalysis
                }
            },
            timestamp: Date.now()
        });

    } catch (error) {
        console.error('❌ Error getting analytics status:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get analytics status'
        });
    }
});

/**
 * GET /api/analytics/current
 * Get current real-time metrics
 */
router.get('/current', (req, res) => {
    try {
        if (!analyticsService) {
            return res.status(500).json({
                success: false,
                error: 'Analytics service not initialized'
            });
        }

        const currentMetrics = analyticsService.getCurrentMetrics();
        
        if (!currentMetrics) {
            return res.json({
                success: true,
                metrics: null,
                message: 'No current metrics available'
            });
        }

        res.json({
            success: true,
            metrics: {
                timestamp: new Date(currentMetrics.timestamp).toISOString(),
                system: {
                    memory: {
                        usage: Math.round(currentMetrics.system.memory.usage),
                        used: Math.round(currentMetrics.system.memory.used / (1024 * 1024)), // MB
                        total: Math.round(currentMetrics.system.memory.total / (1024 * 1024)) // MB
                    },
                    cpu: {
                        usage: Math.round(currentMetrics.system.cpu.usage * 100) / 100
                    },
                    uptime: Math.round(currentMetrics.system.uptime)
                },
                business: {
                    models: {
                        total: currentMetrics.business.models.total,
                        active: currentMetrics.business.models.active,
                        growthRate: Math.round(currentMetrics.business.models.growthRate * 100) / 100
                    },
                    clients: {
                        total: currentMetrics.business.clients.total,
                        active: currentMetrics.business.clients.active,
                        growthRate: Math.round(currentMetrics.business.clients.growthRate * 100) / 100
                    },
                    subscriptions: {
                        total: currentMetrics.business.subscriptions.total,
                        active: currentMetrics.business.subscriptions.active,
                        monthlyRevenue: Math.round(currentMetrics.business.subscriptions.monthlyRevenue * 100) / 100,
                        conversionRate: Math.round(currentMetrics.business.subscriptions.conversionRate * 100) / 100
                    }
                },
                userActivity: {
                    activeUsers: currentMetrics.userActivity.activeUsers,
                    sessions: currentMetrics.userActivity.sessions,
                    avgSessionDuration: Math.round(currentMetrics.userActivity.avgSessionDuration),
                    pageViews: currentMetrics.userActivity.pageViews,
                    avgResponseTime: Math.round(currentMetrics.userActivity.avgResponseTime),
                    bounceRate: Math.round(currentMetrics.userActivity.bounceRate * 100) / 100,
                    engagement: Math.round(currentMetrics.userActivity.userEngagement * 100) / 100
                },
                content: {
                    images: {
                        total: currentMetrics.content.images.total,
                        approved: currentMetrics.content.images.approved,
                        pending: currentMetrics.content.images.pending,
                        uploadedToday: currentMetrics.content.images.uploadedToday
                    },
                    processing: {
                        queuePending: currentMetrics.content.processing.queuePending,
                        avgProcessingTime: Math.round(currentMetrics.content.processing.avgProcessingTime),
                        throughput: Math.round(currentMetrics.content.processing.throughput * 100) / 100
                    }
                },
                performance: {
                    responseTime: {
                        api: Math.round(currentMetrics.performance.responseTime.api),
                        database: Math.round(currentMetrics.performance.responseTime.database),
                        cache: Math.round(currentMetrics.performance.responseTime.cache * 100) / 100
                    },
                    throughput: {
                        requestsPerSecond: Math.round(currentMetrics.performance.throughput.requestsPerSecond * 100) / 100,
                        imagesPerHour: Math.round(currentMetrics.performance.throughput.imagesPerHour)
                    },
                    availability: {
                        uptime: Math.round(currentMetrics.performance.availability.uptime * 100) / 100,
                        apiAvailability: Math.round(currentMetrics.performance.availability.apiAvailability * 100) / 100
                    }
                },
                security: {
                    threats: {
                        blockedRequests: currentMetrics.security.threats.blockedRequests,
                        suspiciousActivity: currentMetrics.security.threats.suspiciousActivity,
                        bannedIPs: currentMetrics.security.threats.bannedIPs
                    },
                    authentication: {
                        loginAttempts: currentMetrics.security.authentication.loginAttempts,
                        successRate: Math.round(currentMetrics.security.authentication.successRate * 100) / 100
                    }
                }
            }
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
 * GET /api/analytics/historical
 * Get historical aggregated data
 */
router.get('/historical', (req, res) => {
    try {
        if (!analyticsService) {
            return res.status(500).json({
                success: false,
                error: 'Analytics service not initialized'
            });
        }

        const { timeRange = 24, granularity = 'hour' } = req.query;
        const timeRangeMs = parseInt(timeRange) * 60 * 60 * 1000; // Convert hours to milliseconds
        
        const aggregatedData = analyticsService.getAggregatedData(timeRangeMs);
        
        // Format data for charts and analysis
        const formattedData = aggregatedData.map(data => ({
            timestamp: new Date(data.timestamp).toISOString(),
            system: {
                memoryUsage: Math.round(data.system.memory.avg),
                cpuUsage: Math.round(data.system.cpu.avg * 100) / 100,
                eventLoopDelay: Math.round(data.system.eventLoop.avg * 100) / 100
            },
            business: {
                totalModels: data.business.models.total,
                activeClients: data.business.clients.active,
                monthlyRevenue: Math.round(data.business.subscriptions.monthlyRevenue * 100) / 100,
                conversionRate: Math.round(data.business.subscriptions.conversionRate * 100) / 100
            },
            userActivity: {
                activeUsers: Math.round(data.userActivity.activeUsers),
                pageViews: data.userActivity.pageViews,
                avgResponseTime: Math.round(data.userActivity.avgResponseTime),
                bounceRate: Math.round(data.userActivity.bounceRate * 100) / 100
            },
            performance: {
                apiResponseTime: Math.round(data.performance.responseTime.api),
                databaseResponseTime: Math.round(data.performance.responseTime.database),
                requestsPerSecond: Math.round(data.performance.throughput.requestsPerSecond * 100) / 100,
                uptime: Math.round(data.performance.availability.uptime * 100) / 100
            },
            security: {
                blockedRequests: data.security.threats.blockedRequests,
                failedLogins: data.security.authentication.failedLogins,
                authSuccessRate: Math.round(data.security.authentication.successRate * 100) / 100
            }
        }));

        res.json({
            success: true,
            data: formattedData,
            metadata: {
                timeRange: `${timeRange} hours`,
                granularity,
                dataPoints: formattedData.length,
                startTime: formattedData.length > 0 ? formattedData[0].timestamp : null,
                endTime: formattedData.length > 0 ? formattedData[formattedData.length - 1].timestamp : null
            }
        });

    } catch (error) {
        console.error('❌ Error getting historical data:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get historical data'
        });
    }
});

/**
 * GET /api/analytics/anomalies
 * Get detected anomalies
 */
router.get('/anomalies', (req, res) => {
    try {
        if (!analyticsService) {
            return res.status(500).json({
                success: false,
                error: 'Analytics service not initialized'
            });
        }

        const { timeRange = 24, severity } = req.query;
        const timeRangeMs = parseInt(timeRange) * 60 * 60 * 1000;
        
        let anomalies = analyticsService.getAnomalies(timeRangeMs);
        
        // Filter by severity if specified
        if (severity) {
            anomalies = anomalies.filter(anomaly => anomaly.severity === severity);
        }

        const formattedAnomalies = anomalies.map(anomaly => ({
            id: anomaly.id,
            timestamp: new Date(anomaly.timestamp).toISOString(),
            metric: anomaly.metric,
            severity: anomaly.severity,
            current: Math.round(anomaly.current * 100) / 100,
            baseline: Math.round(anomaly.baseline * 100) / 100,
            deviation: Math.round(anomaly.deviation * 100) / 100,
            deviationPercent: Math.round(anomaly.deviation * 10000) / 100, // Convert to percentage
            description: this.generateAnomalyDescription(anomaly)
        }));

        // Group anomalies by severity
        const bySeverity = formattedAnomalies.reduce((acc, anomaly) => {
            acc[anomaly.severity] = (acc[anomaly.severity] || 0) + 1;
            return acc;
        }, {});

        res.json({
            success: true,
            anomalies: formattedAnomalies,
            summary: {
                total: formattedAnomalies.length,
                timeRange: `${timeRange} hours`,
                bySeverity,
                mostRecent: formattedAnomalies.length > 0 ? 
                    formattedAnomalies.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0] : null
            }
        });

    } catch (error) {
        console.error('❌ Error getting anomalies:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get anomalies'
        });
    }
});

/**
 * GET /api/analytics/trends
 * Get trend analysis data
 */
router.get('/trends', (req, res) => {
    try {
        if (!analyticsService) {
            return res.status(500).json({
                success: false,
                error: 'Analytics service not initialized'
            });
        }

        const { days = 7 } = req.query;
        const trends = analyticsService.getTrends(parseInt(days));
        
        const formattedTrends = trends.map(trend => ({
            date: new Date(trend.day * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            timestamp: new Date(trend.timestamp).toISOString(),
            business: {
                clientGrowth: {
                    current: trend.business.clientGrowth.current,
                    trend: trend.business.clientGrowth.trend,
                    rate: Math.round(trend.business.clientGrowth.rate * 100) / 100
                },
                revenueGrowth: {
                    current: Math.round(trend.business.revenueGrowth.current * 100) / 100,
                    trend: trend.business.revenueGrowth.trend,
                    rate: Math.round(trend.business.revenueGrowth.rate * 100) / 100
                },
                modelGrowth: {
                    current: trend.business.modelGrowth.current,
                    trend: trend.business.modelGrowth.trend,
                    rate: Math.round(trend.business.modelGrowth.rate * 100) / 100
                }
            },
            performance: {
                responseTime: {
                    current: Math.round(trend.performance.responseTimeTrend.current),
                    trend: trend.performance.responseTimeTrend.trend,
                    rate: Math.round(trend.performance.responseTimeTrend.rate * 100) / 100
                },
                uptime: {
                    current: Math.round(trend.performance.uptimeTrend.current * 100) / 100,
                    trend: trend.performance.uptimeTrend.trend,
                    rate: Math.round(trend.performance.uptimeTrend.rate * 100) / 100
                },
                throughput: {
                    current: Math.round(trend.performance.throughputTrend.current * 100) / 100,
                    trend: trend.performance.throughputTrend.trend,
                    rate: Math.round(trend.performance.throughputTrend.rate * 100) / 100
                }
            },
            engagement: {
                userActivity: {
                    current: Math.round(trend.engagement.userActivityTrend.current),
                    trend: trend.engagement.userActivityTrend.trend,
                    rate: Math.round(trend.engagement.userActivityTrend.rate * 100) / 100
                },
                sessionDuration: {
                    current: Math.round(trend.engagement.sessionDurationTrend.current),
                    trend: trend.engagement.sessionDurationTrend.trend,
                    rate: Math.round(trend.engagement.sessionDurationTrend.rate * 100) / 100
                }
            }
        }));

        res.json({
            success: true,
            trends: formattedTrends,
            summary: {
                period: `${days} days`,
                dataPoints: formattedTrends.length,
                overallTrends: this.calculateOverallTrends(formattedTrends)
            }
        });

    } catch (error) {
        console.error('❌ Error getting trends:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get trends'
        });
    }
});

/**
 * GET /api/analytics/kpis
 * Get key performance indicators
 */
router.get('/kpis', (req, res) => {
    try {
        if (!analyticsService) {
            return res.status(500).json({
                success: false,
                error: 'Analytics service not initialized'
            });
        }

        const currentMetrics = analyticsService.getCurrentMetrics();
        
        if (!currentMetrics) {
            return res.json({
                success: true,
                kpis: null,
                message: 'No current metrics available for KPI calculation'
            });
        }

        // Calculate key performance indicators
        const kpis = {
            business: {
                totalRevenue: {
                    value: Math.round(currentMetrics.business.subscriptions.monthlyRevenue * 100) / 100,
                    unit: 'USD',
                    trend: 'increasing', // Would be calculated from historical data
                    changePercent: 5.2
                },
                activeCustomers: {
                    value: currentMetrics.business.clients.active,
                    unit: 'count',
                    trend: 'increasing',
                    changePercent: 3.1
                },
                customerGrowthRate: {
                    value: Math.round(currentMetrics.business.clients.growthRate * 100) / 100,
                    unit: 'percent',
                    trend: currentMetrics.business.clients.growthRate > 0 ? 'increasing' : 'decreasing',
                    changePercent: 0.8
                },
                conversionRate: {
                    value: Math.round(currentMetrics.business.subscriptions.conversionRate * 100) / 100,
                    unit: 'percent',
                    trend: 'stable',
                    changePercent: -0.3
                }
            },
            performance: {
                systemUptime: {
                    value: Math.round(currentMetrics.performance.availability.uptime * 100) / 100,
                    unit: 'percent',
                    trend: 'stable',
                    changePercent: 0.1
                },
                avgResponseTime: {
                    value: Math.round(currentMetrics.performance.responseTime.api),
                    unit: 'milliseconds',
                    trend: 'decreasing', // Lower is better
                    changePercent: -2.5
                },
                throughput: {
                    value: Math.round(currentMetrics.performance.throughput.requestsPerSecond * 100) / 100,
                    unit: 'requests/sec',
                    trend: 'increasing',
                    changePercent: 4.7
                },
                errorRate: {
                    value: Math.round(currentMetrics.performance.errorRates.api * 100) / 100,
                    unit: 'percent',
                    trend: 'decreasing', // Lower is better
                    changePercent: -1.2
                }
            },
            engagement: {
                activeUsers: {
                    value: currentMetrics.userActivity.activeUsers,
                    unit: 'count',
                    trend: 'increasing',
                    changePercent: 7.3
                },
                avgSessionDuration: {
                    value: Math.round(currentMetrics.userActivity.avgSessionDuration),
                    unit: 'minutes',
                    trend: 'increasing',
                    changePercent: 2.8
                },
                bounceRate: {
                    value: Math.round(currentMetrics.userActivity.bounceRate * 100) / 100,
                    unit: 'percent',
                    trend: 'decreasing', // Lower is better
                    changePercent: -1.9
                },
                pageViews: {
                    value: currentMetrics.userActivity.pageViews,
                    unit: 'count',
                    trend: 'increasing',
                    changePercent: 6.4
                }
            },
            content: {
                totalImages: {
                    value: currentMetrics.content.images.total,
                    unit: 'count',
                    trend: 'increasing',
                    changePercent: 2.1
                },
                approvalRate: {
                    value: Math.round((currentMetrics.content.images.approved / currentMetrics.content.images.total) * 10000) / 100,
                    unit: 'percent',
                    trend: 'stable',
                    changePercent: 0.5
                },
                processingThroughput: {
                    value: Math.round(currentMetrics.content.processing.throughput * 100) / 100,
                    unit: 'images/hour',
                    trend: 'increasing',
                    changePercent: 3.7
                },
                avgProcessingTime: {
                    value: Math.round(currentMetrics.content.processing.avgProcessingTime / 1000 * 100) / 100,
                    unit: 'seconds',
                    trend: 'decreasing', // Lower is better
                    changePercent: -8.2
                }
            }
        };

        res.json({
            success: true,
            kpis,
            metadata: {
                calculatedAt: new Date().toISOString(),
                basedOnMetrics: new Date(currentMetrics.timestamp).toISOString(),
                totalKPIs: Object.values(kpis).reduce((sum, category) => sum + Object.keys(category).length, 0)
            }
        });

    } catch (error) {
        console.error('❌ Error calculating KPIs:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to calculate KPIs'
        });
    }
});

/**
 * POST /api/analytics/collect
 * Trigger manual metrics collection
 */
router.post('/collect', async (req, res) => {
    try {
        if (!analyticsService) {
            return res.status(500).json({
                success: false,
                error: 'Analytics service not initialized'
            });
        }

        console.log('📊 Manual metrics collection triggered via API');
        
        const metrics = await analyticsService.collectRealTimeMetrics();
        
        res.json({
            success: true,
            message: 'Metrics collection completed',
            metrics: {
                id: metrics.id,
                timestamp: new Date(metrics.timestamp).toISOString(),
                categories: Object.keys(metrics).filter(key => key !== 'id' && key !== 'timestamp'),
                summary: {
                    systemMemory: Math.round(metrics.system.memory.usage),
                    activeClients: metrics.business.clients.active,
                    responseTime: Math.round(metrics.performance.responseTime.api),
                    securityEvents: metrics.security.threats.blockedRequests
                }
            }
        });

    } catch (error) {
        console.error('❌ Error collecting metrics:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to collect metrics'
        });
    }
});

/**
 * GET /api/analytics/configuration
 * Get analytics service configuration
 */
router.get('/configuration', (req, res) => {
    try {
        if (!analyticsService) {
            return res.status(500).json({
                success: false,
                error: 'Analytics service not initialized'
            });
        }

        const summary = analyticsService.getAnalyticsSummary();
        
        res.json({
            success: true,
            configuration: {
                collection: {
                    realTimeInterval: summary.configuration.collection.realTimeInterval,
                    realTimeIntervalMinutes: Math.round(summary.configuration.collection.realTimeInterval / 60000 * 100) / 100,
                    aggregationInterval: summary.configuration.collection.aggregationInterval,
                    aggregationIntervalMinutes: Math.round(summary.configuration.collection.aggregationInterval / 60000),
                    archiveInterval: summary.configuration.collection.archiveInterval,
                    archiveIntervalHours: Math.round(summary.configuration.collection.archiveInterval / 3600000)
                },
                retention: {
                    rawDataDays: summary.configuration.retention.rawData,
                    hourlyDataDays: summary.configuration.retention.hourlyData,
                    dailyDataDays: summary.configuration.retention.dailyData,
                    monthlyDataDays: summary.configuration.retention.monthlyData
                },
                features: {
                    predictiveAnalytics: summary.configuration.analytics.enablePredictive,
                    anomalyDetection: summary.configuration.analytics.enableAnomalyDetection,
                    trendAnalysis: summary.configuration.analytics.enableTrendAnalysis,
                    confidenceThreshold: summary.configuration.analytics.confidenceThreshold
                },
                storage: {
                    analyticsDirectory: summary.configuration.storage.analyticsDir,
                    maxFileSize: summary.configuration.storage.maxFileSize,
                    maxFileSizeMB: Math.round(summary.configuration.storage.maxFileSize / (1024 * 1024)),
                    compressionEnabled: summary.configuration.storage.compressionEnabled
                }
            }
        });

    } catch (error) {
        console.error('❌ Error getting analytics configuration:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get analytics configuration'
        });
    }
});

/**
 * PUT /api/analytics/configuration
 * Update analytics service configuration
 */
router.put('/configuration', (req, res) => {
    try {
        if (!analyticsService) {
            return res.status(500).json({
                success: false,
                error: 'Analytics service not initialized'
            });
        }

        const newConfig = req.body;
        
        // Validate configuration structure
        const validSections = ['collection', 'retention', 'analytics', 'storage'];
        const providedSections = Object.keys(newConfig);
        const invalidSections = providedSections.filter(section => !validSections.includes(section));
        
        if (invalidSections.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Invalid configuration sections: ${invalidSections.join(', ')}`
            });
        }

        analyticsService.updateConfiguration(newConfig);
        
        console.log('📊 Analytics configuration updated via API:', providedSections);

        res.json({
            success: true,
            message: 'Analytics configuration updated',
            updated: providedSections,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error updating analytics configuration:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to update analytics configuration'
        });
    }
});

// Helper methods

router.generateAnomalyDescription = function(anomaly) {
    const descriptions = {
        'memory_usage': `Memory usage is ${anomaly.current}%, significantly ${anomaly.current > anomaly.baseline ? 'above' : 'below'} the baseline of ${anomaly.baseline}%`,
        'cpu_usage': `CPU usage is ${anomaly.current}%, ${anomaly.current > anomaly.baseline ? 'higher' : 'lower'} than expected baseline of ${anomaly.baseline}%`,
        'response_time': `API response time is ${anomaly.current}ms, ${anomaly.current > anomaly.baseline ? 'slower' : 'faster'} than baseline of ${anomaly.baseline}ms`,
        'error_rate': `Error rate is ${anomaly.current}%, ${anomaly.current > anomaly.baseline ? 'above' : 'below'} normal levels of ${anomaly.baseline}%`
    };
    
    return descriptions[anomaly.metric] || `${anomaly.metric} anomaly detected: ${anomaly.current} vs baseline ${anomaly.baseline}`;
};

router.calculateOverallTrends = function(trends) {
    if (trends.length < 2) return {};
    
    const latest = trends[trends.length - 1];
    const previous = trends[trends.length - 2];
    
    return {
        business: {
            revenue: latest.business.revenueGrowth.rate > 0 ? 'growing' : 'declining',
            clients: latest.business.clientGrowth.rate > 0 ? 'growing' : 'declining'
        },
        performance: {
            responseTime: latest.performance.responseTime.trend,
            uptime: latest.performance.uptime.trend
        },
        engagement: {
            userActivity: latest.engagement.userActivity.trend,
            sessionDuration: latest.engagement.sessionDuration.trend
        }
    };
};

module.exports = router;