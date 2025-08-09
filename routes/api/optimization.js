/**
 * Performance Optimization API Routes
 * Part of Phase E.6: Add performance optimization recommendations
 * Provides API endpoints for performance analysis and optimization recommendations
 */

const express = require('express');
const router = express.Router();
const PerformanceOptimizationService = require('../../src/services/PerformanceOptimizationService');
const AdvancedAnalyticsService = require('../../src/services/AdvancedAnalyticsService');

// Initialize services
let optimizationService = null;
let analyticsService = null;

// Middleware to initialize optimization service
router.use((req, res, next) => {
    if (!optimizationService) {
        // Initialize analytics service first if not already done
        if (!analyticsService) {
            analyticsService = new AdvancedAnalyticsService(req.db, {
                collection: {
                    realTimeInterval: 30000,
                    aggregationInterval: 300000
                }
            });
        }

        const config = {
            optimization: {
                enableContinuous: process.env.OPTIMIZATION_CONTINUOUS !== 'false',
                analysisInterval: parseInt(process.env.OPTIMIZATION_ANALYSIS_INTERVAL) || 900000, // 15 minutes
                recommendationThreshold: parseFloat(process.env.OPTIMIZATION_THRESHOLD) || 0.7,
                maxRecommendations: parseInt(process.env.OPTIMIZATION_MAX_RECOMMENDATIONS) || 20
            },
            analysis: {
                performanceWindow: parseInt(process.env.OPTIMIZATION_PERFORMANCE_WINDOW) || 3600000, // 1 hour
                trendWindow: parseInt(process.env.OPTIMIZATION_TREND_WINDOW) || 7 * 24 * 3600000, // 7 days
                baselineWindow: parseInt(process.env.OPTIMIZATION_BASELINE_WINDOW) || 30 * 24 * 3600000, // 30 days
                anomalyThreshold: parseFloat(process.env.OPTIMIZATION_ANOMALY_THRESHOLD) || 2.0
            },
            thresholds: {
                cpu: {
                    warning: parseInt(process.env.CPU_WARNING_THRESHOLD) || 70,
                    critical: parseInt(process.env.CPU_CRITICAL_THRESHOLD) || 85
                },
                memory: {
                    warning: parseInt(process.env.MEMORY_WARNING_THRESHOLD) || 75,
                    critical: parseInt(process.env.MEMORY_CRITICAL_THRESHOLD) || 90
                },
                responseTime: {
                    warning: parseInt(process.env.RESPONSE_TIME_WARNING) || 1000,
                    critical: parseInt(process.env.RESPONSE_TIME_CRITICAL) || 3000
                },
                errorRate: {
                    warning: parseFloat(process.env.ERROR_RATE_WARNING) || 1.0,
                    critical: parseFloat(process.env.ERROR_RATE_CRITICAL) || 5.0
                }
            },
            storage: {
                optimizationDir: process.env.OPTIMIZATION_STORAGE_DIR || '/tmp/musenest-optimization'
            }
        };

        optimizationService = new PerformanceOptimizationService(req.db, analyticsService, config);
        console.log('⚡ PerformanceOptimizationService initialized for API routes');
    }
    next();
});

/**
 * GET /api/optimization/status
 * Get optimization service status and overview
 */
router.get('/status', (req, res) => {
    try {
        if (!optimizationService) {
            return res.status(500).json({
                success: false,
                error: 'Optimization service not initialized'
            });
        }

        const status = optimizationService.getOptimizationStatus();
        
        res.json({
            success: true,
            status: {
                service: {
                    active: status.isActive,
                    continuousAnalysis: status.configuration.optimization.enableContinuous,
                    analysisInterval: status.configuration.optimization.analysisInterval,
                    analysisIntervalMinutes: Math.round(status.configuration.optimization.analysisInterval / 60000)
                },
                recommendations: {
                    total: status.totalRecommendations,
                    active: status.activeRecommendations,
                    completed: status.completedRecommendations,
                    maxRecommendations: status.configuration.optimization.maxRecommendations,
                    threshold: status.configuration.optimization.recommendationThreshold
                },
                analysis: {
                    performanceBaselines: status.performanceBaselines,
                    analysisResults: status.analysisResults,
                    performanceWindow: status.configuration.analysis.performanceWindow,
                    performanceWindowHours: Math.round(status.configuration.analysis.performanceWindow / 3600000),
                    trendWindow: status.configuration.analysis.trendWindow,
                    trendWindowDays: Math.round(status.configuration.analysis.trendWindow / (24 * 3600000))
                },
                thresholds: {
                    cpu: {
                        warning: status.configuration.thresholds.cpu.warning,
                        critical: status.configuration.thresholds.cpu.critical
                    },
                    memory: {
                        warning: status.configuration.thresholds.memory.warning,
                        critical: status.configuration.thresholds.memory.critical
                    },
                    responseTime: {
                        warning: status.configuration.thresholds.responseTime.warning,
                        critical: status.configuration.thresholds.responseTime.critical
                    },
                    errorRate: {
                        warning: status.configuration.thresholds.errorRate.warning,
                        critical: status.configuration.thresholds.errorRate.critical
                    }
                }
            },
            timestamp: Date.now()
        });

    } catch (error) {
        console.error('❌ Error getting optimization status:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get optimization status'
        });
    }
});

/**
 * GET /api/optimization/recommendations
 * Get performance optimization recommendations
 */
router.get('/recommendations', (req, res) => {
    try {
        if (!optimizationService) {
            return res.status(500).json({
                success: false,
                error: 'Optimization service not initialized'
            });
        }

        const { category, priority, status, limit = 50 } = req.query;
        const filters = {};
        
        if (category) filters.category = category;
        if (priority) filters.priority = priority;
        if (status) filters.status = status;

        let recommendations = optimizationService.getRecommendations(filters);
        recommendations = recommendations.slice(0, parseInt(limit));
        
        res.json({
            success: true,
            recommendations: recommendations.map(rec => ({
                id: rec.id,
                title: rec.title,
                description: rec.description,
                category: rec.category,
                type: rec.type,
                priority: rec.priority,
                status: rec.status,
                confidence: rec.confidence,
                estimatedImprovement: rec.estimatedImprovement,
                effort: rec.effort,
                timeline: rec.timeline,
                impact: {
                    performance: rec.impact.performance,
                    stability: rec.impact.stability,
                    cost: rec.impact.cost
                },
                actions: rec.actions,
                metrics: rec.metrics,
                created: new Date(rec.createdAt).toISOString(),
                implementationStarted: rec.implementationStarted ? 
                    new Date(rec.implementationStarted).toISOString() : null,
                implementationCompleted: rec.implementationCompleted ? 
                    new Date(rec.implementationCompleted).toISOString() : null,
                implementationTime: rec.implementationTime ? 
                    Math.round(rec.implementationTime / 1000) : null
            })),
            summary: {
                total: recommendations.length,
                byCategory: recommendations.reduce((acc, r) => {
                    acc[r.category] = (acc[r.category] || 0) + 1;
                    return acc;
                }, {}),
                byPriority: recommendations.reduce((acc, r) => {
                    acc[r.priority] = (acc[r.priority] || 0) + 1;
                    return acc;
                }, {}),
                byStatus: recommendations.reduce((acc, r) => {
                    acc[r.status] = (acc[r.status] || 0) + 1;
                    return acc;
                }, {}),
                byEffort: recommendations.reduce((acc, r) => {
                    acc[r.effort] = (acc[r.effort] || 0) + 1;
                    return acc;
                }, {}),
                avgConfidence: recommendations.length > 0 ? 
                    Math.round(recommendations.reduce((sum, r) => sum + r.confidence, 0) / recommendations.length * 100) / 100 : 0,
                highPriorityCount: recommendations.filter(r => r.priority === 'critical' || r.priority === 'high').length
            }
        });

    } catch (error) {
        console.error('❌ Error getting recommendations:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get recommendations'
        });
    }
});

/**
 * GET /api/optimization/recommendations/:recommendationId
 * Get detailed information about a specific recommendation
 */
router.get('/recommendations/:recommendationId', (req, res) => {
    try {
        if (!optimizationService) {
            return res.status(500).json({
                success: false,
                error: 'Optimization service not initialized'
            });
        }

        const { recommendationId } = req.params;
        const recommendations = optimizationService.getRecommendations();
        const recommendation = recommendations.find(r => r.id === recommendationId);
        
        if (!recommendation) {
            return res.status(404).json({
                success: false,
                error: 'Recommendation not found'
            });
        }

        res.json({
            success: true,
            recommendation: {
                id: recommendation.id,
                title: recommendation.title,
                description: recommendation.description,
                category: recommendation.category,
                type: recommendation.type,
                priority: recommendation.priority,
                status: recommendation.status,
                confidence: recommendation.confidence,
                estimatedImprovement: recommendation.estimatedImprovement,
                effort: recommendation.effort,
                timeline: recommendation.timeline,
                impact: recommendation.impact,
                actions: recommendation.actions,
                metrics: recommendation.metrics,
                created: new Date(recommendation.createdAt).toISOString(),
                implementationDetails: recommendation.implementationDetails || null,
                implementationStarted: recommendation.implementationStarted ? 
                    new Date(recommendation.implementationStarted).toISOString() : null,
                implementationCompleted: recommendation.implementationCompleted ? 
                    new Date(recommendation.implementationCompleted).toISOString() : null,
                implementationTime: recommendation.implementationTime ? 
                    Math.round(recommendation.implementationTime / 1000) : null,
                implementationTimeMinutes: recommendation.implementationTime ? 
                    Math.round(recommendation.implementationTime / 60000 * 100) / 100 : null
            }
        });

    } catch (error) {
        console.error('❌ Error getting recommendation details:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get recommendation details'
        });
    }
});

/**
 * POST /api/optimization/recommendations/:recommendationId/implement
 * Mark a recommendation as being implemented
 */
router.post('/recommendations/:recommendationId/implement', async (req, res) => {
    try {
        if (!optimizationService) {
            return res.status(500).json({
                success: false,
                error: 'Optimization service not initialized'
            });
        }

        const { recommendationId } = req.params;
        const implementationDetails = req.body;
        
        console.log(`⚡ Implementing recommendation: ${recommendationId}`);
        
        const recommendation = await optimizationService.implementRecommendation(
            recommendationId, 
            implementationDetails
        );
        
        res.json({
            success: true,
            message: 'Recommendation implementation started',
            recommendation: {
                id: recommendation.id,
                title: recommendation.title,
                status: recommendation.status,
                implementationStarted: new Date(recommendation.implementationStarted).toISOString(),
                implementationDetails: recommendation.implementationDetails
            }
        });

    } catch (error) {
        console.error('❌ Error implementing recommendation:', error.message);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/optimization/baselines
 * Get performance baselines
 */
router.get('/baselines', (req, res) => {
    try {
        if (!optimizationService) {
            return res.status(500).json({
                success: false,
                error: 'Optimization service not initialized'
            });
        }

        const baselines = optimizationService.getPerformanceBaselines();
        
        res.json({
            success: true,
            baselines: Object.entries(baselines).map(([metric, data]) => ({
                metric,
                average: Math.round(data.average * 100) / 100,
                min: Math.round(data.min * 100) / 100,
                max: Math.round(data.max * 100) / 100,
                samples: data.samples,
                lastUpdated: new Date(data.lastUpdated).toISOString(),
                variability: data.max - data.min,
                variabilityPercent: data.average > 0 ? 
                    Math.round(((data.max - data.min) / data.average) * 100) : 0
            })),
            summary: {
                totalMetrics: Object.keys(baselines).length,
                oldestBaseline: Object.values(baselines).length > 0 ? 
                    new Date(Math.min(...Object.values(baselines).map(b => b.lastUpdated))).toISOString() : null,
                newestBaseline: Object.values(baselines).length > 0 ? 
                    new Date(Math.max(...Object.values(baselines).map(b => b.lastUpdated))).toISOString() : null,
                totalSamples: Object.values(baselines).reduce((sum, b) => sum + b.samples, 0)
            }
        });

    } catch (error) {
        console.error('❌ Error getting performance baselines:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get performance baselines'
        });
    }
});

/**
 * GET /api/optimization/analysis
 * Get recent performance analysis results
 */
router.get('/analysis', (req, res) => {
    try {
        if (!optimizationService) {
            return res.status(500).json({
                success: false,
                error: 'Optimization service not initialized'
            });
        }

        const { limit = 10 } = req.query;
        const analysisResults = optimizationService.getAnalysisResults(parseInt(limit));
        
        res.json({
            success: true,
            analyses: analysisResults.map(analysis => ({
                id: analysis.id,
                timestamp: new Date(analysis.timestamp).toISOString(),
                recommendations: analysis.recommendations,
                systemAnalysis: {
                    category: analysis.systemAnalysis.category,
                    metrics: analysis.systemAnalysis.metrics,
                    issues: analysis.systemAnalysis.issues,
                    recommendations: analysis.systemAnalysis.recommendations
                },
                databaseAnalysis: {
                    category: analysis.databaseAnalysis.category,
                    metrics: analysis.databaseAnalysis.metrics,
                    issues: analysis.databaseAnalysis.issues,
                    recommendations: analysis.databaseAnalysis.recommendations
                },
                applicationAnalysis: {
                    category: analysis.applicationAnalysis.category,
                    metrics: analysis.applicationAnalysis.metrics,
                    issues: analysis.applicationAnalysis.issues,
                    recommendations: analysis.applicationAnalysis.recommendations
                },
                infrastructureAnalysis: {
                    category: analysis.infrastructureAnalysis.category,
                    metrics: analysis.infrastructureAnalysis.metrics,
                    issues: analysis.infrastructureAnalysis.issues,
                    recommendations: analysis.infrastructureAnalysis.recommendations
                },
                performanceSnapshot: {
                    cpu: analysis.performanceData.current?.system?.cpu?.usage || 0,
                    memory: analysis.performanceData.current?.system?.memory?.usage || 0,
                    responseTime: analysis.performanceData.current?.performance?.responseTime?.api || 0,
                    errorRate: analysis.performanceData.current?.performance?.errorRates?.api || 0
                }
            })),
            summary: {
                total: analysisResults.length,
                totalRecommendations: analysisResults.reduce((sum, a) => sum + a.recommendations, 0),
                avgRecommendationsPerAnalysis: analysisResults.length > 0 ? 
                    Math.round(analysisResults.reduce((sum, a) => sum + a.recommendations, 0) / analysisResults.length) : 0,
                timeRange: analysisResults.length > 0 ? {
                    oldest: new Date(analysisResults[analysisResults.length - 1].timestamp).toISOString(),
                    newest: new Date(analysisResults[0].timestamp).toISOString()
                } : null
            }
        });

    } catch (error) {
        console.error('❌ Error getting analysis results:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get analysis results'
        });
    }
});

/**
 * POST /api/optimization/analyze
 * Trigger manual performance analysis
 */
router.post('/analyze', async (req, res) => {
    try {
        if (!optimizationService) {
            return res.status(500).json({
                success: false,
                error: 'Optimization service not initialized'
            });
        }

        console.log('⚡ Manual performance analysis triggered via API');
        
        // Trigger immediate analysis
        await optimizationService.performContinuousAnalysis();
        
        // Get the latest analysis results
        const latestAnalysis = optimizationService.getAnalysisResults(1)[0];
        const newRecommendations = optimizationService.getRecommendations({ status: 'pending' })
            .filter(r => Date.now() - r.createdAt < 60000); // Created in last minute
        
        res.json({
            success: true,
            message: 'Performance analysis completed',
            analysis: {
                id: latestAnalysis?.id,
                timestamp: latestAnalysis ? new Date(latestAnalysis.timestamp).toISOString() : null,
                recommendations: latestAnalysis?.recommendations || 0,
                newRecommendations: newRecommendations.length
            },
            recommendations: newRecommendations.slice(0, 5).map(r => ({
                id: r.id,
                title: r.title,
                category: r.category,
                priority: r.priority,
                estimatedImprovement: r.estimatedImprovement
            }))
        });

    } catch (error) {
        console.error('❌ Error performing analysis:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to perform analysis'
        });
    }
});

/**
 * GET /api/optimization/report
 * Generate comprehensive optimization report
 */
router.get('/report', async (req, res) => {
    try {
        if (!optimizationService) {
            return res.status(500).json({
                success: false,
                error: 'Optimization service not initialized'
            });
        }

        console.log('⚡ Generating optimization report');
        
        const report = await optimizationService.generateOptimizationReport();
        
        res.json({
            success: true,
            report: {
                generated: new Date(report.generatedAt).toISOString(),
                summary: report.summary,
                actionPlan: report.actionPlan,
                topRecommendations: report.recommendations.slice(0, 10).map(r => ({
                    title: r.title,
                    category: r.category,
                    priority: r.priority,
                    confidence: r.confidence,
                    estimatedImprovement: r.estimatedImprovement,
                    effort: r.effort,
                    timeline: r.timeline
                })),
                performanceBaselines: report.performanceBaselines,
                recentAnalysisSummary: {
                    count: report.recentAnalysis.length,
                    totalRecommendations: report.recentAnalysis.reduce((sum, a) => sum + a.recommendations, 0)
                }
            }
        });

    } catch (error) {
        console.error('❌ Error generating optimization report:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to generate optimization report'
        });
    }
});

/**
 * GET /api/optimization/templates
 * Get optimization templates and best practices
 */
router.get('/templates', (req, res) => {
    try {
        const { category = 'all' } = req.query;
        
        const templates = {
            system: [
                {
                    id: 'memory-optimization',
                    title: 'Memory Usage Optimization',
                    category: 'system',
                    description: 'Comprehensive memory optimization strategies',
                    actions: [
                        'Implement memory pooling',
                        'Add garbage collection tuning',
                        'Optimize object lifecycle management',
                        'Implement memory monitoring and alerts'
                    ],
                    expectedImprovement: '15-30%',
                    effort: 'Medium',
                    timeline: '2-3 weeks'
                },
                {
                    id: 'cpu-optimization',
                    title: 'CPU Utilization Optimization',
                    category: 'system',
                    description: 'CPU performance improvement strategies',
                    actions: [
                        'Implement worker threads',
                        'Add request queuing',
                        'Optimize algorithms',
                        'Add CPU monitoring'
                    ],
                    expectedImprovement: '20-35%',
                    effort: 'High',
                    timeline: '3-4 weeks'
                }
            ],
            database: [
                {
                    id: 'query-optimization',
                    title: 'Database Query Optimization',
                    category: 'database',
                    description: 'Comprehensive database performance optimization',
                    actions: [
                        'Add appropriate indexes',
                        'Optimize query structure',
                        'Implement connection pooling',
                        'Add query monitoring'
                    ],
                    expectedImprovement: '30-50%',
                    effort: 'High',
                    timeline: '3-5 weeks'
                },
                {
                    id: 'caching-strategy',
                    title: 'Advanced Caching Strategy',
                    category: 'database',
                    description: 'Multi-level caching implementation',
                    actions: [
                        'Implement Redis caching',
                        'Add application-level caching',
                        'Optimize cache invalidation',
                        'Add cache monitoring'
                    ],
                    expectedImprovement: '25-45%',
                    effort: 'Medium',
                    timeline: '2-4 weeks'
                }
            ],
            application: [
                {
                    id: 'api-optimization',
                    title: 'API Performance Optimization',
                    category: 'application',
                    description: 'Comprehensive API performance improvements',
                    actions: [
                        'Implement response caching',
                        'Add request/response compression',
                        'Optimize middleware pipeline',
                        'Add API monitoring'
                    ],
                    expectedImprovement: '35-55%',
                    effort: 'High',
                    timeline: '3-6 weeks'
                },
                {
                    id: 'image-processing',
                    title: 'Image Processing Optimization',
                    category: 'application',
                    description: 'Specialized image processing improvements',
                    actions: [
                        'Implement advanced compression',
                        'Add WebP support',
                        'Optimize resizing algorithms',
                        'Add CDN integration'
                    ],
                    expectedImprovement: '40-60%',
                    effort: 'High',
                    timeline: '4-6 weeks'
                }
            ],
            infrastructure: [
                {
                    id: 'scaling-strategy',
                    title: 'Auto-Scaling Implementation',
                    category: 'infrastructure',
                    description: 'Comprehensive auto-scaling setup',
                    actions: [
                        'Implement horizontal scaling',
                        'Add load balancing',
                        'Set up container orchestration',
                        'Add scaling monitoring'
                    ],
                    expectedImprovement: '50-80%',
                    effort: 'Very High',
                    timeline: '6-10 weeks'
                },
                {
                    id: 'monitoring-enhancement',
                    title: 'Enhanced Monitoring and Observability',
                    category: 'infrastructure',
                    description: 'Comprehensive monitoring implementation',
                    actions: [
                        'Add APM integration',
                        'Implement distributed tracing',
                        'Add custom dashboards',
                        'Set up proactive alerting'
                    ],
                    expectedImprovement: '20-35%',
                    effort: 'Medium',
                    timeline: '2-4 weeks'
                }
            ]
        };

        let result = {};
        if (category === 'all') {
            result = templates;
        } else if (templates[category]) {
            result[category] = templates[category];
        }

        const bestPractices = {
            general: [
                'Always establish performance baselines before optimization',
                'Implement monitoring and alerting for all optimizations',
                'Test optimizations in staging environment first',
                'Monitor the impact of each optimization separately',
                'Document all performance changes and their effects'
            ],
            system: [
                'Monitor memory allocation patterns',
                'Profile CPU usage during peak loads',
                'Implement graceful degradation strategies',
                'Use appropriate data structures for your use case'
            ],
            database: [
                'Regularly analyze query execution plans',
                'Monitor database connection pool utilization',
                'Implement proper indexing strategies',
                'Use database-specific optimization features'
            ],
            application: [
                'Implement proper error handling and retry logic',
                'Use asynchronous processing for heavy operations',
                'Optimize API payload sizes',
                'Implement proper validation and sanitization'
            ]
        };

        res.json({
            success: true,
            templates: result,
            bestPractices,
            metadata: {
                categories: Object.keys(templates),
                totalTemplates: Object.values(templates).reduce((sum, cat) => sum + cat.length, 0),
                requestedCategory: category
            }
        });

    } catch (error) {
        console.error('❌ Error getting optimization templates:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get optimization templates'
        });
    }
});

/**
 * GET /api/optimization/configuration
 * Get optimization service configuration
 */
router.get('/configuration', (req, res) => {
    try {
        if (!optimizationService) {
            return res.status(500).json({
                success: false,
                error: 'Optimization service not initialized'
            });
        }

        const status = optimizationService.getOptimizationStatus();
        
        res.json({
            success: true,
            configuration: {
                optimization: {
                    enableContinuous: status.configuration.optimization.enableContinuous,
                    analysisInterval: status.configuration.optimization.analysisInterval,
                    analysisIntervalMinutes: Math.round(status.configuration.optimization.analysisInterval / 60000),
                    recommendationThreshold: status.configuration.optimization.recommendationThreshold,
                    maxRecommendations: status.configuration.optimization.maxRecommendations,
                    priorityLevels: status.configuration.optimization.priorityLevels
                },
                analysis: {
                    performanceWindow: status.configuration.analysis.performanceWindow,
                    performanceWindowHours: Math.round(status.configuration.analysis.performanceWindow / 3600000),
                    trendWindow: status.configuration.analysis.trendWindow,
                    trendWindowDays: Math.round(status.configuration.analysis.trendWindow / (24 * 3600000)),
                    baselineWindow: status.configuration.analysis.baselineWindow,
                    baselineWindowDays: Math.round(status.configuration.analysis.baselineWindow / (24 * 3600000)),
                    anomalyThreshold: status.configuration.analysis.anomalyThreshold,
                    improvementThreshold: status.configuration.analysis.improvementThreshold
                },
                thresholds: {
                    cpu: status.configuration.thresholds.cpu,
                    memory: status.configuration.thresholds.memory,
                    responseTime: status.configuration.thresholds.responseTime,
                    errorRate: status.configuration.thresholds.errorRate
                },
                storage: {
                    optimizationDirectory: status.configuration.storage.optimizationDir,
                    reportsDirectory: status.configuration.storage.reportsDir,
                    cacheDirectory: status.configuration.storage.cacheDir
                }
            }
        });

    } catch (error) {
        console.error('❌ Error getting optimization configuration:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get optimization configuration'
        });
    }
});

/**
 * PUT /api/optimization/configuration
 * Update optimization service configuration
 */
router.put('/configuration', (req, res) => {
    try {
        if (!optimizationService) {
            return res.status(500).json({
                success: false,
                error: 'Optimization service not initialized'
            });
        }

        const newConfig = req.body;
        
        // Validate configuration structure
        const validSections = ['optimization', 'analysis', 'thresholds', 'storage'];
        const providedSections = Object.keys(newConfig);
        const invalidSections = providedSections.filter(section => !validSections.includes(section));
        
        if (invalidSections.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Invalid configuration sections: ${invalidSections.join(', ')}`
            });
        }

        optimizationService.updateConfiguration(newConfig);
        
        console.log('⚡ Optimization configuration updated via API:', providedSections);

        res.json({
            success: true,
            message: 'Optimization configuration updated',
            updated: providedSections,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error updating optimization configuration:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to update optimization configuration'
        });
    }
});

module.exports = router;