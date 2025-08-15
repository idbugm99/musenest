/**
 * Dynamic Resource Allocation API Routes
 * 
 * RESTful API endpoints for intelligent resource management and allocation.
 * Provides resource pool monitoring, scaling decisions, performance tracking,
 * and automated resource optimization based on usage patterns.
 */

const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

// Initialize Dynamic Resource Allocation Service
let resourceAllocationService = null;

async function initializeService() {
    if (!resourceAllocationService) {
        const DynamicResourceAllocationService = require('../../src/services/DynamicResourceAllocationService');
        resourceAllocationService = new DynamicResourceAllocationService();
        await resourceAllocationService.initialize();
    }
    return resourceAllocationService;
}

// Middleware to ensure service is initialized
async function ensureServiceReady(req, res, next) {
    try {
        await initializeService();
        next();
    } catch (error) {
        console.error('Failed to initialize Dynamic Resource Allocation Service:', error);
        res.status(503).json({
            error: 'Dynamic Resource Allocation Service unavailable',
            details: error.message
        });
    }
}

/**
 * GET /api/resource-allocation/health
 * Get service health status and resource pool overview
 */
router.get('/health', ensureServiceReady, async (req, res) => {
    try {
        const health = await resourceAllocationService.getHealthStatus();
        res.json(health);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get health status',
            details: error.message
        });
    }
});

/**
 * GET /api/resource-allocation/pools
 * Get resource pools status and allocation
 * 
 * Query params:
 * - pool: specific pool name (cpu, memory, database_connections, storage_io)
 * - includeSegments: include segment details (default true)
 */
router.get('/pools', async (req, res) => {
    try {
        const { pool, includeSegments = 'true' } = req.query;
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        // Get resource pools
        let poolQuery = 'SELECT * FROM v_resource_allocation_summary';
        const poolParams = [];
        
        if (pool) {
            poolQuery += ' WHERE pool_name = ?';
            poolParams.push(pool);
        }
        
        const [pools] = await db.execute(poolQuery, poolParams);
        
        let result = {
            success: true,
            pools: pools.map(p => ({
                ...p,
                healthStatus: getPoolHealthStatus(p),
                recommendations: generatePoolRecommendations(p)
            })),
            count: pools.length
        };
        
        // Include segment details if requested
        if (includeSegments === 'true') {
            let segmentQuery = `
                SELECT 
                    pool_name,
                    segment_name,
                    min_allocation,
                    max_allocation,
                    current_allocation,
                    target_allocation,
                    priority,
                    elasticity_factor,
                    performance_threshold,
                    last_scaled,
                    CASE 
                        WHEN current_allocation > performance_threshold THEN 'over_threshold'
                        WHEN current_allocation > performance_threshold * 0.8 THEN 'near_threshold'
                        ELSE 'healthy'
                    END as status
                FROM resource_pool_segments
            `;
            const segmentParams = [];
            
            if (pool) {
                segmentQuery += ' WHERE pool_name = ?';
                segmentParams.push(pool);
            }
            
            segmentQuery += ' ORDER BY pool_name, priority DESC, current_allocation DESC';
            
            const [segments] = await db.execute(segmentQuery, segmentParams);
            
            // Group segments by pool
            const segmentsByPool = segments.reduce((acc, segment) => {
                if (!acc[segment.pool_name]) {
                    acc[segment.pool_name] = [];
                }
                acc[segment.pool_name].push(segment);
                return acc;
            }, {});
            
            result.pools = result.pools.map(pool => ({
                ...pool,
                segments: segmentsByPool[pool.pool_name] || []
            }));
            
            result.totalSegments = segments.length;
        }
        
        await db.end();
        res.json(result);
        
    } catch (error) {
        console.error('Resource pools retrieval error:', error);
        res.status(500).json({
            error: 'Failed to get resource pools',
            details: error.message
        });
    }
});

/**
 * GET /api/resource-allocation/analyze
 * Analyze resource utilization and generate optimization recommendations
 * 
 * Query params:
 * - pool: specific pool to analyze (optional)
 * - timeWindow: analysis window in hours (default 24)
 */
router.get('/analyze', ensureServiceReady, async (req, res) => {
    try {
        const { pool, timeWindow = 24 } = req.query;
        
        console.log(`📊 Analyzing resource allocation${pool ? ` for pool: ${pool}` : ''}`);
        
        // Get comprehensive resource analysis
        const analysis = await resourceAllocationService.analyzeResourceUtilization();
        
        // Filter by pool if specified
        let filteredAnalysis = analysis;
        if (pool) {
            filteredAnalysis = {
                ...analysis,
                pools: analysis.pools.filter(p => p.name === pool),
                segments: analysis.segments.filter(s => s.poolName === pool),
                recommendations: analysis.recommendations.filter(r => r.targetPool === pool)
            };
        }
        
        res.json({
            success: true,
            analysis: filteredAnalysis,
            metadata: {
                pool,
                timeWindow: parseInt(timeWindow),
                analyzedAt: new Date().toISOString(),
                poolsAnalyzed: filteredAnalysis.pools.length,
                segmentsAnalyzed: filteredAnalysis.segments.length,
                recommendationsGenerated: filteredAnalysis.recommendations.length
            }
        });
        
    } catch (error) {
        console.error('Resource analysis error:', error);
        res.status(500).json({
            error: 'Failed to analyze resource allocation',
            details: error.message
        });
    }
});

/**
 * GET /api/resource-allocation/predictions
 * Get demand predictions for resource pools
 * 
 * Query params:
 * - pool: specific pool name (optional)
 * - horizon: prediction horizon (1min, 5min, 15min, 1hour, 6hour, 24hour)
 * - limit: number of predictions (default 50)
 */
router.get('/predictions', async (req, res) => {
    try {
        const { pool, horizon, limit = 50 } = req.query;
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        let query = `
            SELECT 
                rdp.pool_name,
                rdp.segment_name,
                rdp.prediction_horizon,
                rdp.predicted_demand,
                rdp.predicted_utilization,
                rdp.confidence_score,
                rdp.prediction_factors,
                rdp.algorithm_used,
                rdp.actual_demand,
                rdp.prediction_accuracy,
                rdp.created_at,
                rdp.validated_at
            FROM resource_demand_predictions rdp
            WHERE rdp.created_at >= DATE_SUB(NOW(), INTERVAL 6 HOUR)
        `;
        
        const params = [];
        
        if (pool) {
            query += ' AND rdp.pool_name = ?';
            params.push(pool);
        }
        
        if (horizon) {
            query += ' AND rdp.prediction_horizon = ?';
            params.push(horizon);
        }
        
        query += ' ORDER BY rdp.created_at DESC, rdp.confidence_score DESC LIMIT ?';
        params.push(parseInt(limit));
        
        const [predictions] = await db.execute(query, params);
        
        // Get prediction accuracy summary
        const [accuracySummary] = await db.execute(`
            SELECT * FROM v_resource_prediction_accuracy
            ${pool ? 'WHERE pool_name = ?' : ''}
            ORDER BY avg_accuracy DESC
        `, pool ? [pool] : []);
        
        await db.end();
        
        res.json({
            success: true,
            predictions: predictions.map(pred => ({
                ...pred,
                prediction_factors: JSON.parse(pred.prediction_factors || '{}'),
                reliabilityScore: calculateReliabilityScore(pred),
                status: pred.actual_demand !== null ? 'validated' : 'pending'
            })),
            accuracySummary,
            metadata: {
                pool,
                horizon,
                predictionsReturned: predictions.length,
                accuracyModels: accuracySummary.length
            }
        });
        
    } catch (error) {
        console.error('Predictions retrieval error:', error);
        res.status(500).json({
            error: 'Failed to get resource predictions',
            details: error.message
        });
    }
});

/**
 * POST /api/resource-allocation/scale
 * Trigger resource scaling for specific segment
 * 
 * Body: {
 *   "pool": "cpu",
 *   "segment": "web_server",
 *   "action": "scale_up|scale_down|rebalance",
 *   "factor": 1.5 (optional scaling factor),
 *   "reason": "manual scaling for performance improvement"
 * }
 */
router.post('/scale', ensureServiceReady, async (req, res) => {
    try {
        const { pool, segment, action, factor = 1.2, reason = 'Manual scaling request' } = req.body;
        
        // Validate required fields
        if (!pool || !segment || !action) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['pool', 'segment', 'action']
            });
        }
        
        const validActions = ['scale_up', 'scale_down', 'rebalance'];
        if (!validActions.includes(action)) {
            return res.status(400).json({
                error: 'Invalid scaling action',
                validActions
            });
        }
        
        console.log(`⚡ Manual scaling request: ${action} ${pool}.${segment} by factor ${factor}`);
        
        // Execute scaling operation
        const scalingRequest = {
            pool,
            segment,
            action,
            factor: parseFloat(factor),
            reason,
            requestId: `manual_${Date.now()}`,
            timestamp: new Date().toISOString()
        };
        
        const result = await resourceAllocationService.executeResourceScaling(scalingRequest);
        
        res.json({
            success: true,
            message: `Resource scaling ${action} completed for ${pool}.${segment}`,
            scalingRequest,
            result,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Resource scaling error:', error);
        res.status(500).json({
            error: 'Failed to execute resource scaling',
            details: error.message
        });
    }
});

/**
 * POST /api/resource-allocation/optimize
 * Trigger automatic resource optimization
 * 
 * Body: {
 *   "pool": "cpu" (optional - optimize specific pool),
 *   "strategy": "performance|efficiency|balanced" (default: balanced),
 *   "dryRun": false (optional - preview changes without applying)
 * }
 */
router.post('/optimize', ensureServiceReady, async (req, res) => {
    try {
        const { pool, strategy = 'balanced', dryRun = false } = req.body;
        
        const validStrategies = ['performance', 'efficiency', 'balanced'];
        if (!validStrategies.includes(strategy)) {
            return res.status(400).json({
                error: 'Invalid optimization strategy',
                validStrategies
            });
        }
        
        console.log(`🎯 ${dryRun ? 'Simulating' : 'Executing'} resource optimization with strategy: ${strategy}`);
        
        const optimizationRequest = {
            targetPool: pool,
            strategy,
            dryRun,
            requestId: `optimize_${Date.now()}`,
            timestamp: new Date().toISOString()
        };
        
        let result;
        if (dryRun) {
            result = await resourceAllocationService.simulateOptimization(optimizationRequest);
        } else {
            result = await resourceAllocationService.optimizeResourceAllocation(optimizationRequest);
        }
        
        res.json({
            success: true,
            message: `Resource optimization ${dryRun ? 'simulation' : 'execution'} completed`,
            optimizationRequest,
            result,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Resource optimization error:', error);
        res.status(500).json({
            error: 'Failed to optimize resource allocation',
            details: error.message
        });
    }
});

/**
 * GET /api/resource-allocation/performance
 * Get resource performance metrics and trends
 * 
 * Query params:
 * - pool: specific pool name (optional)
 * - segment: specific segment name (optional)
 * - timeframe: 1h, 6h, 24h, 7d (default 24h)
 * - metrics: comma-separated list (utilization, response_time, throughput, error_rate)
 */
router.get('/performance', async (req, res) => {
    try {
        const { pool, segment, timeframe = '24h', metrics = 'utilization,response_time' } = req.query;
        
        const timeframeMap = {
            '1h': 1,
            '6h': 6,
            '24h': 24,
            '7d': 168
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
                pool_name,
                segment_name,
                metric_type,
                metric_value,
                baseline_value,
                threshold_value,
                is_threshold_exceeded,
                measurement_context,
                recorded_at
            FROM resource_performance_metrics
            WHERE recorded_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
        `;
        
        const params = [hours];
        
        if (pool) {
            query += ' AND pool_name = ?';
            params.push(pool);
        }
        
        if (segment) {
            query += ' AND segment_name = ?';
            params.push(segment);
        }
        
        if (requestedMetrics.length > 0 && !requestedMetrics.includes('all')) {
            query += ' AND metric_type IN (' + requestedMetrics.map(() => '?').join(',') + ')';
            params.push(...requestedMetrics);
        }
        
        query += ' ORDER BY pool_name, segment_name, metric_type, recorded_at DESC';
        
        const [performanceData] = await db.execute(query, params);
        
        // Get performance trends
        const [trends] = await db.execute(`
            SELECT * FROM v_resource_performance_trends
            WHERE date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            ${pool ? 'AND pool_name = ?' : ''}
            ${segment ? 'AND segment_name = ?' : ''}
            ORDER BY date DESC, pool_name, segment_name
        `, [Math.ceil(hours / 24)].concat(pool ? [pool] : []).concat(segment ? [segment] : []));
        
        await db.end();
        
        // Process and group performance data
        const groupedPerformance = groupPerformanceData(performanceData);
        
        res.json({
            success: true,
            performance: {
                metrics: groupedPerformance,
                trends: trends.map(trend => ({
                    ...trend,
                    performance_score: calculatePerformanceScore(trend)
                })),
                summary: generatePerformanceSummary(groupedPerformance, trends)
            },
            metadata: {
                pool,
                segment,
                timeframe,
                requestedMetrics,
                dataPoints: performanceData.length,
                trendDataPoints: trends.length
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
 * GET /api/resource-allocation/scaling-events
 * Get resource scaling events history
 * 
 * Query params:
 * - pool: specific pool name (optional)
 * - segment: specific segment name (optional)
 * - action: scaling action (optional)
 * - limit: number of events (default 100)
 */
router.get('/scaling-events', async (req, res) => {
    try {
        const { pool, segment, action, limit = 100 } = req.query;
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        let query = `
            SELECT 
                rse.*,
                TIMESTAMPDIFF(SECOND, executed_at, NOW()) as seconds_ago
            FROM resource_scaling_events rse
            WHERE executed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        `;
        
        const params = [];
        
        if (pool) {
            query += ' AND pool_name = ?';
            params.push(pool);
        }
        
        if (segment) {
            query += ' AND segment_name = ?';
            params.push(segment);
        }
        
        if (action) {
            query += ' AND scaling_action = ?';
            params.push(action);
        }
        
        query += ' ORDER BY executed_at DESC LIMIT ?';
        params.push(parseInt(limit));
        
        const [events] = await db.execute(query, params);
        
        // Get scaling effectiveness summary
        const [effectiveness] = await db.execute(`
            SELECT * FROM v_resource_scaling_effectiveness
            ${pool ? 'WHERE pool_name = ?' : ''}
            ORDER BY total_scaling_events DESC
        `, pool ? [pool] : []);
        
        await db.end();
        
        res.json({
            success: true,
            scalingEvents: events.map(event => ({
                ...event,
                trigger_metrics: JSON.parse(event.trigger_metrics || '{}'),
                performance_impact: JSON.parse(event.performance_impact || '{}'),
                effectiveness_score: calculateScalingEffectiveness(event),
                time_ago: formatTimeAgo(event.seconds_ago)
            })),
            effectiveness: effectiveness.map(eff => ({
                ...eff,
                success_rate: eff.failed_events > 0 ? eff.successful_events / (eff.successful_events + eff.failed_events) : 1.0,
                efficiency_score: calculateEfficiencyScore(eff)
            })),
            metadata: {
                pool,
                segment,
                action,
                eventsReturned: events.length,
                effectivenessMetrics: effectiveness.length
            }
        });
        
    } catch (error) {
        console.error('Scaling events retrieval error:', error);
        res.status(500).json({
            error: 'Failed to get scaling events',
            details: error.message
        });
    }
});

/**
 * GET /api/resource-allocation/policies
 * Get resource allocation policies and rules
 */
router.get('/policies', async (req, res) => {
    try {
        const { active = 'true', type } = req.query;
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        let query = 'SELECT * FROM resource_allocation_policies';
        const params = [];
        const conditions = [];
        
        if (active === 'true') {
            conditions.push('is_active = TRUE');
        }
        
        if (type) {
            conditions.push('policy_type = ?');
            params.push(type);
        }
        
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ' ORDER BY priority DESC, policy_name';
        
        const [policies] = await db.execute(query, params);
        
        await db.end();
        
        res.json({
            success: true,
            policies: policies.map(policy => ({
                ...policy,
                conditions: JSON.parse(policy.conditions || '{}'),
                actions: JSON.parse(policy.actions || '{}'),
                effectiveness: policy.execution_count > 0 ? policy.success_rate : null,
                next_eligible_execution: policy.last_executed 
                    ? new Date(policy.last_executed.getTime() + (policy.cooldown_minutes * 60000))
                    : new Date()
            })),
            count: policies.length
        });
        
    } catch (error) {
        console.error('Policies retrieval error:', error);
        res.status(500).json({
            error: 'Failed to get resource allocation policies',
            details: error.message
        });
    }
});

/**
 * GET /api/resource-allocation/analytics
 * Get comprehensive resource allocation analytics
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
        
        // Get allocation summary
        const [allocationSummary] = await db.execute(`
            SELECT * FROM v_resource_allocation_summary
            ORDER BY utilization_percentage DESC
        `);
        
        // Get scaling effectiveness
        const [scalingEffectiveness] = await db.execute(`
            SELECT * FROM v_resource_scaling_effectiveness
            ORDER BY total_scaling_events DESC
        `);
        
        // Get prediction accuracy
        const [predictionAccuracy] = await db.execute(`
            SELECT * FROM v_resource_prediction_accuracy
            ORDER BY avg_accuracy DESC
        `);
        
        // Get recent decisions impact
        const [decisionsImpact] = await db.execute(`
            SELECT 
                trigger_type,
                COUNT(*) as total_decisions,
                COUNT(CASE WHEN success = TRUE THEN 1 END) as successful_decisions,
                AVG(confidence_score) as avg_confidence,
                COUNT(CASE WHEN implementation_status = 'completed' THEN 1 END) as completed_implementations
            FROM resource_allocation_decisions
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY trigger_type
        `);
        
        await db.end();
        
        // Generate insights
        const insights = generateResourceInsights(
            allocationSummary, 
            scalingEffectiveness, 
            predictionAccuracy, 
            decisionsImpact
        );
        
        res.json({
            success: true,
            analytics: {
                timeframe,
                allocationSummary: allocationSummary.map(summary => ({
                    ...summary,
                    health_status: getPoolHealthStatus(summary),
                    optimization_potential: calculateOptimizationPotential(summary)
                })),
                scalingEffectiveness: scalingEffectiveness.map(eff => ({
                    ...eff,
                    success_rate: eff.failed_events > 0 ? eff.successful_events / (eff.successful_events + eff.failed_events) : 1.0
                })),
                predictionAccuracy,
                decisionsImpact: decisionsImpact.map(impact => ({
                    ...impact,
                    success_rate: impact.successful_decisions / impact.total_decisions,
                    implementation_rate: impact.completed_implementations / impact.total_decisions
                })),
                insights
            },
            metadata: {
                generatedAt: new Date().toISOString(),
                pools: allocationSummary.length,
                scalingEvents: scalingEffectiveness.length,
                predictionModels: predictionAccuracy.length
            }
        });
        
    } catch (error) {
        console.error('Analytics retrieval error:', error);
        res.status(500).json({
            error: 'Failed to get resource allocation analytics',
            details: error.message
        });
    }
});

// Helper functions
function getPoolHealthStatus(pool) {
    const utilization = pool.utilization_percentage || 0;
    const efficiency = pool.efficiency_score || 0;
    
    if (utilization > 90 || efficiency < 0.5) return 'critical';
    if (utilization > 80 || efficiency < 0.7) return 'warning';
    if (utilization > 70 && efficiency > 0.8) return 'good';
    return 'excellent';
}

function generatePoolRecommendations(pool) {
    const recommendations = [];
    
    if (pool.utilization_percentage > 85) {
        recommendations.push({
            type: 'scale_up',
            priority: 'high',
            message: `Pool utilization at ${pool.utilization_percentage.toFixed(1)}% - consider scaling up`
        });
    }
    
    if (pool.segments_over_threshold > 0) {
        recommendations.push({
            type: 'rebalance',
            priority: 'medium',
            message: `${pool.segments_over_threshold} segments over threshold - rebalancing recommended`
        });
    }
    
    if (pool.efficiency_score < 0.6) {
        recommendations.push({
            type: 'optimize',
            priority: 'medium',
            message: `Low efficiency score ${(pool.efficiency_score * 100).toFixed(1)}% - optimization needed`
        });
    }
    
    return recommendations;
}

function calculateReliabilityScore(prediction) {
    let score = prediction.confidence_score * 100;
    
    // Adjust based on prediction accuracy if available
    if (prediction.prediction_accuracy !== null) {
        score = (score + prediction.prediction_accuracy * 100) / 2;
    }
    
    // Adjust based on algorithm used
    const algorithmWeights = {
        neural_network: 1.1,
        ensemble: 1.0,
        linear_regression: 0.9,
        arima: 0.95
    };
    
    score *= algorithmWeights[prediction.algorithm_used] || 1.0;
    
    return Math.min(100, Math.round(score));
}

function groupPerformanceData(performanceData) {
    const grouped = {};
    
    performanceData.forEach(metric => {
        const key = `${metric.pool_name}_${metric.segment_name}_${metric.metric_type}`;
        
        if (!grouped[key]) {
            grouped[key] = {
                pool: metric.pool_name,
                segment: metric.segment_name,
                metric: metric.metric_type,
                dataPoints: [],
                baseline: metric.baseline_value,
                threshold: metric.threshold_value,
                current: null,
                violations: 0,
                trend: 'stable'
            };
        }
        
        grouped[key].dataPoints.push({
            value: metric.metric_value,
            timestamp: metric.recorded_at,
            context: JSON.parse(metric.measurement_context || '{}'),
            exceeded: metric.is_threshold_exceeded
        });
        
        if (metric.is_threshold_exceeded) {
            grouped[key].violations++;
        }
        
        // Set current value (most recent)
        if (!grouped[key].current || new Date(metric.recorded_at) > new Date(grouped[key].current.timestamp)) {
            grouped[key].current = {
                value: metric.metric_value,
                timestamp: metric.recorded_at,
                exceeded: metric.is_threshold_exceeded
            };
        }
    });
    
    // Calculate trends
    Object.values(grouped).forEach(group => {
        if (group.dataPoints.length >= 3) {
            const recent = group.dataPoints.slice(-3).map(d => d.value);
            const older = group.dataPoints.slice(0, -3).map(d => d.value);
            
            if (recent.length > 0 && older.length > 0) {
                const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
                const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
                const change = ((recentAvg - olderAvg) / olderAvg) * 100;
                
                if (change > 10) group.trend = 'increasing';
                else if (change < -10) group.trend = 'decreasing';
                else group.trend = 'stable';
            }
        }
    });
    
    return Object.values(grouped);
}

function calculatePerformanceScore(trend) {
    let score = 50; // Base score
    
    // Adjust based on violations
    if (trend.threshold_violations === 0) score += 30;
    else score -= Math.min(20, trend.threshold_violations * 5);
    
    // Adjust based on measurement count (consistency)
    if (trend.total_measurements >= 100) score += 10;
    else if (trend.total_measurements >= 50) score += 5;
    
    // Adjust based on metric type
    if (trend.metric_type === 'utilization') {
        if (trend.avg_value <= 80) score += 10;
        else if (trend.avg_value <= 90) score += 5;
        else score -= 15;
    }
    
    return Math.max(0, Math.min(100, Math.round(score)));
}

function generatePerformanceSummary(metrics, trends) {
    const totalMetrics = metrics.length;
    const healthyMetrics = metrics.filter(m => !m.current?.exceeded).length;
    const avgViolations = metrics.reduce((sum, m) => sum + m.violations, 0) / totalMetrics;
    
    return {
        totalMetrics,
        healthyMetrics,
        healthScore: Math.round((healthyMetrics / totalMetrics) * 100),
        avgViolations: Math.round(avgViolations * 100) / 100,
        trendsAnalyzed: trends.length,
        overallTrend: calculateOverallTrend(trends)
    };
}

function calculateOverallTrend(trends) {
    if (trends.length === 0) return 'unknown';
    
    const improvingCount = trends.filter(t => t.avg_value < t.max_value * 0.8).length;
    const decliningCount = trends.filter(t => t.threshold_violations > 0).length;
    
    if (improvingCount > decliningCount * 1.5) return 'improving';
    if (decliningCount > improvingCount * 1.5) return 'declining';
    return 'stable';
}

function calculateScalingEffectiveness(event) {
    let score = event.success ? 50 : 0;
    
    // Duration impact
    if (event.scaling_duration_ms < 1000) score += 20;
    else if (event.scaling_duration_ms < 5000) score += 10;
    
    // Scaling factor appropriateness
    if (event.scaling_factor >= 1.1 && event.scaling_factor <= 1.5) score += 15;
    else if (event.scaling_factor > 1.5) score += 5;
    
    // Performance impact
    const impact = JSON.parse(event.performance_impact || '{}');
    if (impact.improvement > 0.1) score += 15;
    
    return Math.min(100, score);
}

function calculateEfficiencyScore(effectiveness) {
    const successRate = effectiveness.failed_events > 0 
        ? effectiveness.successful_events / (effectiveness.successful_events + effectiveness.failed_events)
        : 1.0;
    
    const avgDuration = effectiveness.avg_duration_ms || 0;
    const durationScore = Math.max(0, 100 - (avgDuration / 100)); // Lower duration = higher score
    
    return Math.round((successRate * 70) + (durationScore * 0.3));
}

function formatTimeAgo(seconds) {
    if (seconds < 60) return `${seconds} seconds ago`;
    if (seconds < 3600) return `${Math.round(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.round(seconds / 3600)} hours ago`;
    return `${Math.round(seconds / 86400)} days ago`;
}

function calculateOptimizationPotential(summary) {
    let potential = 0;
    
    // Based on utilization
    if (summary.utilization_percentage < 60) potential += 20; // Under-utilized
    if (summary.utilization_percentage > 90) potential += 30; // Over-utilized
    
    // Based on efficiency
    if (summary.efficiency_score < 0.7) potential += 25;
    
    // Based on segments over threshold
    potential += Math.min(25, summary.segments_over_threshold * 5);
    
    return Math.min(100, potential);
}

function generateResourceInsights(allocationSummary, scalingEffectiveness, predictionAccuracy, decisionsImpact) {
    const insights = [];
    
    // Pool health insights
    const criticalPools = allocationSummary.filter(pool => pool.utilization_percentage > 90);
    if (criticalPools.length > 0) {
        insights.push({
            type: 'warning',
            title: 'High Resource Utilization',
            description: `${criticalPools.length} resource pool(s) are operating above 90% capacity.`,
            impact: 'performance_risk',
            pools: criticalPools.map(p => p.pool_name)
        });
    }
    
    // Scaling effectiveness insights
    const totalScalingEvents = scalingEffectiveness.reduce((sum, eff) => sum + eff.total_scaling_events, 0);
    const successfulScaling = scalingEffectiveness.reduce((sum, eff) => sum + eff.successful_events, 0);
    const overallScalingSuccess = totalScalingEvents > 0 ? successfulScaling / totalScalingEvents : 0;
    
    if (overallScalingSuccess > 0.9) {
        insights.push({
            type: 'positive',
            title: 'Excellent Scaling Success Rate',
            description: `${(overallScalingSuccess * 100).toFixed(1)}% of scaling operations completed successfully.`,
            impact: 'system_reliability'
        });
    }
    
    // Prediction accuracy insights
    const highAccuracyModels = predictionAccuracy.filter(pred => pred.avg_accuracy > 0.8);
    if (highAccuracyModels.length > 0) {
        insights.push({
            type: 'positive',
            title: 'High Prediction Accuracy',
            description: `${highAccuracyModels.length} prediction model(s) achieving >80% accuracy.`,
            impact: 'optimization_effectiveness',
            models: highAccuracyModels.map(m => m.pool_name)
        });
    }
    
    return insights;
}

// Error handling middleware
router.use((error, req, res, next) => {
    console.error('Dynamic Resource Allocation API Error:', error);
    res.status(500).json({
        error: 'Internal server error in Dynamic Resource Allocation API',
        details: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    });
});

module.exports = router;