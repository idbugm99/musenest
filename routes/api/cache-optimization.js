/**
 * Cache Optimization API Routes
 * 
 * RESTful API endpoints for ML-powered cache optimization system.
 * Provides cache performance analysis, optimization recommendations,
 * cache warming management, and automated optimization implementation.
 */

const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

// Initialize Cache Optimization Service
let cacheOptimizationService = null;

async function initializeService() {
    if (!cacheOptimizationService) {
        const CacheOptimizationService = require('../../src/services/CacheOptimizationService');
        cacheOptimizationService = new CacheOptimizationService();
        await cacheOptimizationService.initialize();
    }
    return cacheOptimizationService;
}

// Middleware to ensure service is initialized
async function ensureServiceReady(req, res, next) {
    try {
        await initializeService();
        next();
    } catch (error) {
        console.error('Failed to initialize Cache Optimization Service:', error);
        res.status(503).json({
            error: 'Cache Optimization Service unavailable',
            details: error.message
        });
    }
}

/**
 * GET /api/cache-optimization/health
 * Get service health status
 */
router.get('/health', ensureServiceReady, async (req, res) => {
    try {
        const health = await cacheOptimizationService.getHealthStatus();
        res.json(health);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get health status',
            details: error.message
        });
    }
});

/**
 * GET /api/cache-optimization/analyze
 * Analyze cache performance and generate recommendations
 * 
 * Query params:
 * - strategy: specific strategy to analyze (optional)
 * - timeWindow: analysis time window in hours (default 24)
 */
router.get('/analyze', ensureServiceReady, async (req, res) => {
    try {
        const { strategy, timeWindow = 24 } = req.query;
        
        console.log(`🔍 Analyzing cache performance${strategy ? ` for strategy: ${strategy}` : ''}`);
        
        const analysis = await cacheOptimizationService.analyzeCachePerformance();
        
        // Filter by strategy if specified
        if (strategy && analysis.strategies[strategy]) {
            const filteredAnalysis = {
                ...analysis,
                strategies: { [strategy]: analysis.strategies[strategy] },
                recommendations: analysis.recommendations.filter(r => r.strategy === strategy)
            };
            
            res.json({
                success: true,
                analysis: filteredAnalysis,
                metadata: {
                    strategy,
                    timeWindow: parseInt(timeWindow),
                    analyzedAt: new Date().toISOString()
                }
            });
        } else {
            res.json({
                success: true,
                analysis,
                metadata: {
                    strategiesAnalyzed: Object.keys(analysis.strategies).length,
                    recommendationsGenerated: analysis.recommendations.length,
                    overallScore: analysis.overallScore,
                    analyzedAt: new Date().toISOString()
                }
            });
        }
        
    } catch (error) {
        console.error('Cache analysis error:', error);
        res.status(500).json({
            error: 'Failed to analyze cache performance',
            details: error.message
        });
    }
});

/**
 * GET /api/cache-optimization/strategies
 * Get cache strategies configuration and performance
 */
router.get('/strategies', async (req, res) => {
    try {
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        const [strategies] = await db.execute(`
            SELECT * FROM v_cache_strategy_performance
            ORDER BY priority DESC, current_hit_rate ASC
        `);
        
        await db.end();
        
        res.json({
            success: true,
            strategies: strategies.map(strategy => ({
                ...strategy,
                healthStatus: getStrategyHealthStatus(strategy),
                optimizationNeeded: strategy.current_hit_rate < strategy.warm_threshold
            })),
            count: strategies.length
        });
        
    } catch (error) {
        console.error('Strategies retrieval error:', error);
        res.status(500).json({
            error: 'Failed to get cache strategies',
            details: error.message
        });
    }
});

/**
 * GET /api/cache-optimization/recommendations
 * Get optimization recommendations with filtering
 * 
 * Query params:
 * - status: filter by status (pending, implemented, rejected)
 * - priority: filter by priority (low, medium, high, critical)
 * - strategy: filter by strategy name
 * - limit: number of results (default 50)
 */
router.get('/recommendations', async (req, res) => {
    try {
        const { status, priority, strategy, limit = 50 } = req.query;
        
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
                strategy_name,
                priority,
                confidence_score,
                current_metrics,
                recommended_changes,
                reasoning,
                implementation_plan,
                expected_impact,
                status,
                created_at,
                implemented_at
            FROM cache_optimization_recommendations
        `;
        
        const params = [];
        const conditions = [];
        
        if (status && status !== 'all') {
            conditions.push('status = ?');
            params.push(status);
        }
        
        if (priority) {
            conditions.push('priority = ?');
            params.push(priority);
        }
        
        if (strategy) {
            conditions.push('strategy_name = ?');
            params.push(strategy);
        }
        
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ' ORDER BY priority DESC, confidence_score DESC, created_at DESC LIMIT ?';
        params.push(parseInt(limit));
        
        const [recommendations] = await db.execute(query, params);
        
        await db.end();
        
        res.json({
            success: true,
            recommendations: recommendations.map(rec => ({
                ...rec,
                current_metrics: JSON.parse(rec.current_metrics || '{}'),
                recommended_changes: JSON.parse(rec.recommended_changes || '{}'),
                implementation_plan: JSON.parse(rec.implementation_plan || '{}'),
                expected_impact: JSON.parse(rec.expected_impact || '{}'),
                urgencyScore: calculateUrgencyScore(rec)
            })),
            count: recommendations.length,
            filters: { status, priority, strategy, limit }
        });
        
    } catch (error) {
        console.error('Recommendations retrieval error:', error);
        res.status(500).json({
            error: 'Failed to get optimization recommendations',
            details: error.message
        });
    }
});

/**
 * POST /api/cache-optimization/implement
 * Implement optimization recommendation
 * 
 * Body: {
 *   "recommendationId": 123,
 *   "force": false (optional - bypass safety checks)
 * }
 */
router.post('/implement', ensureServiceReady, async (req, res) => {
    try {
        const { recommendationId, force = false } = req.body;
        
        if (!recommendationId) {
            return res.status(400).json({
                error: 'Missing recommendation ID'
            });
        }
        
        // Get recommendation details
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        const [recommendations] = await db.execute(`
            SELECT * FROM cache_optimization_recommendations WHERE id = ?
        `, [recommendationId]);
        
        if (recommendations.length === 0) {
            await db.end();
            return res.status(404).json({
                error: 'Recommendation not found'
            });
        }
        
        const recommendation = recommendations[0];
        
        // Check if already implemented
        if (recommendation.status === 'implemented') {
            await db.end();
            return res.status(400).json({
                error: 'Recommendation already implemented'
            });
        }
        
        // Safety checks (unless forced)
        if (!force) {
            if (recommendation.confidence_score < 0.7) {
                await db.end();
                return res.status(400).json({
                    error: 'Recommendation confidence too low for automatic implementation',
                    confidence: recommendation.confidence_score,
                    suggestion: 'Use force=true to bypass this check'
                });
            }
        }
        
        // Parse recommendation data
        const recommendationData = {
            type: recommendation.recommendation_type,
            strategy: recommendation.strategy_name,
            priority: recommendation.priority,
            confidence: recommendation.confidence_score,
            current: JSON.parse(recommendation.current_metrics || '{}'),
            recommended: JSON.parse(recommendation.recommended_changes || '{}'),
            reasoning: recommendation.reasoning,
            implementation: JSON.parse(recommendation.implementation_plan || '{}'),
            expectedImpact: JSON.parse(recommendation.expected_impact || '{}')
        };
        
        console.log(`🔧 Implementing optimization: ${recommendationData.type} for ${recommendationData.strategy}`);
        
        // Implement optimization
        const result = await cacheOptimizationService.implementOptimization(recommendationData);
        
        // Update recommendation status
        await db.execute(`
            UPDATE cache_optimization_recommendations 
            SET status = 'implemented',
                implemented_at = NOW(),
                implementation_result = ?
            WHERE id = ?
        `, [JSON.stringify(result), recommendationId]);
        
        await db.end();
        
        res.json({
            success: true,
            message: 'Optimization implemented successfully',
            recommendationId,
            implementationResult: result,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Implementation error:', error);
        res.status(500).json({
            error: 'Failed to implement optimization',
            details: error.message
        });
    }
});

/**
 * POST /api/cache-optimization/warm
 * Trigger cache warming for specific strategy
 * 
 * Body: {
 *   "strategy": "gallery_images",
 *   "immediate": true (optional - warm immediately vs schedule)
 * }
 */
router.post('/warm', ensureServiceReady, async (req, res) => {
    try {
        const { strategy, immediate = true } = req.body;
        
        if (!strategy) {
            return res.status(400).json({
                error: 'Missing strategy name'
            });
        }
        
        console.log(`🔥 ${immediate ? 'Immediate' : 'Scheduled'} cache warming for strategy: ${strategy}`);
        
        let result;
        if (immediate) {
            result = await cacheOptimizationService.performCacheWarming(strategy);
        } else {
            // Schedule warming
            result = await cacheOptimizationService.implementCacheWarming(strategy, {
                schedule: ['06:00', '12:00', '18:00'],
                strategy: 'predictive'
            });
        }
        
        res.json({
            success: true,
            message: `Cache warming ${immediate ? 'completed' : 'scheduled'} for strategy: ${strategy}`,
            result,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Cache warming error:', error);
        res.status(500).json({
            error: 'Failed to warm cache',
            details: error.message
        });
    }
});

/**
 * GET /api/cache-optimization/performance
 * Get cache performance metrics and trends
 * 
 * Query params:
 * - strategy: specific strategy (optional)
 * - timeframe: 1h, 24h, 7d, 30d (default 24h)
 * - metrics: comma-separated list (hit_rate, response_time, memory_usage, throughput)
 */
router.get('/performance', async (req, res) => {
    try {
        const { strategy, timeframe = '24h', metrics = 'hit_rate,response_time,memory_usage' } = req.query;
        
        const timeframeMap = {
            '1h': 1,
            '24h': 24,
            '7d': 168,
            '30d': 720
        };
        
        const hours = timeframeMap[timeframe] || 24;
        const requestedMetrics = metrics.split(',').map(m => m.trim());
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        let query = `
            SELECT 
                strategy_name,
                metric_type,
                metric_value,
                baseline_value,
                improvement_percentage,
                recorded_at
            FROM cache_performance_metrics
            WHERE recorded_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
        `;
        
        const params = [hours];
        
        if (strategy) {
            query += ' AND strategy_name = ?';
            params.push(strategy);
        }
        
        if (requestedMetrics.length > 0 && !requestedMetrics.includes('all')) {
            query += ' AND metric_type IN (' + requestedMetrics.map(() => '?').join(',') + ')';
            params.push(...requestedMetrics);
        }
        
        query += ' ORDER BY strategy_name, metric_type, recorded_at DESC';
        
        const [metrics_data] = await db.execute(query, params);
        
        // Group and analyze metrics
        const performanceData = groupPerformanceMetrics(metrics_data);
        
        await db.end();
        
        res.json({
            success: true,
            performance: performanceData,
            metadata: {
                strategy,
                timeframe,
                requestedMetrics,
                dataPoints: metrics_data.length,
                generatedAt: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Performance metrics error:', error);
        res.status(500).json({
            error: 'Failed to get performance metrics',
            details: error.message
        });
    }
});

/**
 * GET /api/cache-optimization/warming
 * Get cache warming schedules and execution logs
 */
router.get('/warming', async (req, res) => {
    try {
        const { strategy, limit = 20 } = req.query;
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        // Get warming schedules
        let scheduleQuery = 'SELECT * FROM v_cache_warming_effectiveness';
        const scheduleParams = [];
        
        if (strategy) {
            scheduleQuery += ' WHERE strategy_name = ?';
            scheduleParams.push(strategy);
        }
        
        const [schedules] = await db.execute(scheduleQuery, scheduleParams);
        
        // Get recent warming logs
        let logQuery = `
            SELECT 
                cwl.*,
                cws.schedule_type
            FROM cache_warming_logs cwl
            JOIN cache_warming_schedules cws ON cwl.schedule_id = cws.id
            WHERE cwl.executed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        `;
        
        const logParams = [];
        
        if (strategy) {
            logQuery += ' AND cwl.strategy_name = ?';
            logParams.push(strategy);
        }
        
        logQuery += ' ORDER BY cwl.executed_at DESC LIMIT ?';
        logParams.push(parseInt(limit));
        
        const [logs] = await db.execute(logQuery, logParams);
        
        await db.end();
        
        res.json({
            success: true,
            warming: {
                schedules,
                recentExecutions: logs.map(log => ({
                    ...log,
                    error_details: JSON.parse(log.error_details || '{}'),
                    performance_impact: JSON.parse(log.performance_impact || '{}')
                }))
            },
            metadata: {
                strategy,
                scheduleCount: schedules.length,
                executionCount: logs.length
            }
        });
        
    } catch (error) {
        console.error('Warming data retrieval error:', error);
        res.status(500).json({
            error: 'Failed to get warming data',
            details: error.message
        });
    }
});

/**
 * GET /api/cache-optimization/analytics
 * Get cache optimization analytics and insights
 */
router.get('/analytics', async (req, res) => {
    try {
        const { timeframe = '7d' } = req.query;
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        // Get optimization summary
        const [optimizationSummary] = await db.execute(`
            SELECT * FROM v_cache_optimization_summary
            WHERE optimization_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            ORDER BY optimization_date DESC
        `);
        
        // Get strategy performance trends
        const [performanceTrends] = await db.execute(`
            SELECT 
                strategy_name,
                DATE(recorded_at) as date,
                AVG(CASE WHEN metric_type = 'hit_rate' THEN metric_value END) as avg_hit_rate,
                AVG(CASE WHEN metric_type = 'response_time' THEN metric_value END) as avg_response_time,
                AVG(CASE WHEN metric_type = 'memory_usage' THEN metric_value END) as avg_memory_usage
            FROM cache_performance_metrics
            WHERE recorded_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY strategy_name, DATE(recorded_at)
            ORDER BY strategy_name, date DESC
        `);
        
        // Get implementation success rates
        const [implementationStats] = await db.execute(`
            SELECT 
                recommendation_type,
                COUNT(*) as total_recommendations,
                COUNT(CASE WHEN success = TRUE THEN 1 END) as successful_implementations,
                AVG(CASE WHEN success = TRUE THEN 1.0 ELSE 0.0 END) as success_rate
            FROM cache_optimization_results
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY recommendation_type
        `);
        
        await db.end();
        
        // Calculate insights
        const insights = generateOptimizationInsights(optimizationSummary, performanceTrends, implementationStats);
        
        res.json({
            success: true,
            analytics: {
                timeframe,
                optimizationSummary,
                performanceTrends,
                implementationStats,
                insights
            },
            metadata: {
                generatedAt: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Analytics retrieval error:', error);
        res.status(500).json({
            error: 'Failed to get analytics',
            details: error.message
        });
    }
});

/**
 * DELETE /api/cache-optimization/cache
 * Clear optimization cache and analytics data
 * 
 * Query params:
 * - type: 'performance', 'recommendations', 'all' (default 'all')
 */
router.delete('/cache', ensureServiceReady, async (req, res) => {
    try {
        const { type = 'all' } = req.query;
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        let deletedCount = 0;
        
        if (type === 'all' || type === 'performance') {
            const [result1] = await db.execute(`DELETE FROM cache_performance_metrics WHERE recorded_at < NOW()`);
            deletedCount += result1.affectedRows;
        }
        
        if (type === 'all' || type === 'recommendations') {
            const [result2] = await db.execute(`DELETE FROM cache_optimization_recommendations WHERE status = 'expired'`);
            deletedCount += result2.affectedRows;
        }
        
        // Also clear Redis cache
        if (cacheOptimizationService.analyticsRedis) {
            const keys = await cacheOptimizationService.analyticsRedis.keys('*');
            if (keys.length > 0) {
                await cacheOptimizationService.analyticsRedis.del(keys);
                deletedCount += keys.length;
            }
        }
        
        await db.end();
        
        res.json({
            success: true,
            message: `Cache cleared for type: ${type}`,
            deletedCount,
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
function getStrategyHealthStatus(strategy) {
    const hitRate = strategy.current_hit_rate || 0;
    const threshold = strategy.warm_threshold || 0.7;
    
    if (hitRate >= threshold + 0.1) return 'excellent';
    if (hitRate >= threshold) return 'good';
    if (hitRate >= threshold - 0.1) return 'fair';
    return 'poor';
}

function calculateUrgencyScore(recommendation) {
    let score = 0;
    
    // Priority weight
    const priorityWeights = { low: 1, medium: 2, high: 3, critical: 4 };
    score += (priorityWeights[recommendation.priority] || 1) * 25;
    
    // Confidence weight
    score += recommendation.confidence_score * 50;
    
    // Age weight (newer recommendations are more urgent)
    const ageHours = (Date.now() - new Date(recommendation.created_at)) / (1000 * 60 * 60);
    score += Math.max(0, 25 - (ageHours / 24)); // Decrease urgency over time
    
    return Math.min(100, Math.round(score));
}

function groupPerformanceMetrics(metricsData) {
    const grouped = {};
    
    metricsData.forEach(metric => {
        const key = `${metric.strategy_name}_${metric.metric_type}`;
        
        if (!grouped[key]) {
            grouped[key] = {
                strategy: metric.strategy_name,
                metric: metric.metric_type,
                dataPoints: [],
                baseline: metric.baseline_value,
                current: null,
                trend: 'stable',
                improvement: 0
            };
        }
        
        grouped[key].dataPoints.push({
            value: metric.metric_value,
            timestamp: metric.recorded_at,
            improvement: metric.improvement_percentage
        });
        
        // Set current value (most recent)
        if (!grouped[key].current || new Date(metric.recorded_at) > new Date(grouped[key].current.timestamp)) {
            grouped[key].current = {
                value: metric.metric_value,
                timestamp: metric.recorded_at,
                improvement: metric.improvement_percentage
            };
        }
    });
    
    // Calculate trends
    Object.values(grouped).forEach(group => {
        if (group.dataPoints.length >= 2) {
            const recent = group.dataPoints.slice(-5).map(d => d.value);
            const older = group.dataPoints.slice(0, -5).map(d => d.value);
            
            if (recent.length > 0 && older.length > 0) {
                const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
                const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
                
                const change = ((recentAvg - olderAvg) / olderAvg) * 100;
                
                if (change > 5) group.trend = 'improving';
                else if (change < -5) group.trend = 'declining';
                else group.trend = 'stable';
                
                group.improvement = change;
            }
        }
    });
    
    return Object.values(grouped);
}

function generateOptimizationInsights(optimizationSummary, performanceTrends, implementationStats) {
    const insights = [];
    
    // Implementation success insights
    const totalImplementations = implementationStats.reduce((sum, stat) => sum + stat.successful_implementations, 0);
    const totalRecommendations = implementationStats.reduce((sum, stat) => sum + stat.total_recommendations, 0);
    const overallSuccessRate = totalRecommendations > 0 ? totalImplementations / totalRecommendations : 0;
    
    if (overallSuccessRate > 0.8) {
        insights.push({
            type: 'positive',
            title: 'High Implementation Success Rate',
            description: `${(overallSuccessRate * 100).toFixed(1)}% of optimization recommendations have been successfully implemented.`,
            impact: 'system_health'
        });
    }
    
    // Performance trend insights
    const improvingStrategies = performanceTrends.filter(trend => {
        const recentEntries = trend.avg_hit_rate !== null;
        return recentEntries && trend.avg_hit_rate > 0.8;
    });
    
    if (improvingStrategies.length > 0) {
        insights.push({
            type: 'positive',
            title: 'Strong Cache Performance',
            description: `${improvingStrategies.length} cache strategies are performing above 80% hit rate.`,
            impact: 'performance'
        });
    }
    
    return insights;
}

// Error handling middleware
router.use((error, req, res, next) => {
    console.error('Cache Optimization API Error:', error);
    res.status(500).json({
        error: 'Internal server error in Cache Optimization API',
        details: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    });
});

module.exports = router;