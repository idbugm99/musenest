/**
 * Performance Bottleneck Identification API Routes
 * 
 * RESTful API endpoints for real-time performance monitoring and bottleneck detection.
 * Provides bottleneck detection, root cause analysis, predictive monitoring,
 * and optimization recommendations for system performance.
 */

const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

// Initialize Performance Bottleneck Identification Service
let bottleneckService = null;

async function initializeService() {
    if (!bottleneckService) {
        const PerformanceBottleneckIdentificationService = require('../../src/services/PerformanceBottleneckIdentificationService');
        bottleneckService = new PerformanceBottleneckIdentificationService();
        await bottleneckService.initialize();
    }
    return bottleneckService;
}

// Middleware to ensure service is initialized
async function ensureServiceReady(req, res, next) {
    try {
        await initializeService();
        next();
    } catch (error) {
        console.error('Failed to initialize Performance Bottleneck Identification Service:', error);
        res.status(503).json({
            error: 'Performance Bottleneck Identification Service unavailable',
            details: error.message
        });
    }
}

/**
 * GET /api/performance-bottlenecks/health
 * Get service health status and monitoring overview
 */
router.get('/health', ensureServiceReady, async (req, res) => {
    try {
        const health = await bottleneckService.getHealthStatus();
        res.json(health);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get health status',
            details: error.message
        });
    }
});

/**
 * GET /api/performance-bottlenecks/current
 * Get currently active bottlenecks
 * 
 * Query params:
 * - component: filter by component (web_server, database, cache, etc.)
 * - severity: filter by severity (minor, warning, critical)
 * - category: filter by category (resource_exhaustion, performance_degradation, etc.)
 * - limit: number of results (default 50)
 */
router.get('/current', async (req, res) => {
    try {
        const { component, severity, category, limit = 50 } = req.query;
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        let query = `
            SELECT 
                bottleneck_id,
                bottleneck_type,
                component_name,
                severity,
                severity_score,
                category,
                impact_score,
                confidence_score,
                detected_at,
                duration_seconds,
                primary_cause,
                root_cause_confidence,
                recommendation_count
            FROM v_active_bottlenecks
        `;
        
        const params = [];
        const conditions = [];
        
        if (component) {
            conditions.push('component_name = ?');
            params.push(component);
        }
        
        if (severity) {
            conditions.push('severity = ?');
            params.push(severity);
        }
        
        if (category) {
            conditions.push('category = ?');
            params.push(category);
        }
        
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ' ORDER BY severity_score DESC, impact_score DESC, detected_at DESC LIMIT ?';
        params.push(parseInt(limit));
        
        const [bottlenecks] = await db.execute(query, params);
        
        // Get additional details for each bottleneck
        const enrichedBottlenecks = await Promise.all(
            bottlenecks.map(async (bottleneck) => {
                // Get recommendations
                const [recommendations] = await db.execute(`
                    SELECT 
                        recommendation_type,
                        priority,
                        action_type,
                        description,
                        estimated_impact,
                        status
                    FROM bottleneck_recommendations
                    WHERE bottleneck_id = ?
                    ORDER BY priority DESC, created_at DESC
                `, [bottleneck.bottleneck_id]);
                
                return {
                    ...bottleneck,
                    urgencyScore: calculateUrgencyScore(bottleneck),
                    timeAgo: formatTimeAgo(bottleneck.duration_seconds),
                    recommendations: recommendations.slice(0, 3), // Top 3 recommendations
                    status: getBottleneckStatus(bottleneck)
                };
            })
        );
        
        await db.end();
        
        res.json({
            success: true,
            bottlenecks: enrichedBottlenecks,
            count: enrichedBottlenecks.length,
            filters: { component, severity, category, limit },
            summary: generateBottleneckSummary(enrichedBottlenecks)
        });
        
    } catch (error) {
        console.error('Current bottlenecks retrieval error:', error);
        res.status(500).json({
            error: 'Failed to get current bottlenecks',
            details: error.message
        });
    }
});

/**
 * GET /api/performance-bottlenecks/metrics
 * Get current performance metrics
 * 
 * Query params:
 * - component: specific component (optional)
 * - timeWindow: time window in minutes (default 60)
 * - includeBaseline: include baseline comparison (default true)
 */
router.get('/metrics', ensureServiceReady, async (req, res) => {
    try {
        const { component, timeWindow = 60, includeBaseline = 'true' } = req.query;
        
        console.log(`📊 Collecting performance metrics${component ? ` for ${component}` : ''}`);
        
        // Get current metrics from service
        const currentMetrics = await bottleneckService.collectPerformanceMetrics();
        
        if (!currentMetrics) {
            return res.status(500).json({
                error: 'Failed to collect current metrics'
            });
        }
        
        // Get historical data
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        let historicalQuery = `
            SELECT 
                component_name,
                metric_name,
                metric_value,
                is_threshold_exceeded,
                severity_level,
                recorded_at
            FROM system_performance_metrics
            WHERE recorded_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
        `;
        
        const params = [parseInt(timeWindow)];
        
        if (component) {
            historicalQuery += ' AND component_name = ?';
            params.push(component);
        }
        
        historicalQuery += ' ORDER BY component_name, metric_name, recorded_at DESC';
        
        const [historicalMetrics] = await db.execute(historicalQuery, params);
        
        let baselines = {};
        if (includeBaseline === 'true') {
            let baselineQuery = 'SELECT * FROM performance_baselines';
            const baselineParams = [];
            
            if (component) {
                baselineQuery += ' WHERE component_name = ?';
                baselineParams.push(component);
            }
            
            const [baselineData] = await db.execute(baselineQuery, baselineParams);
            baselines = baselineData.reduce((acc, baseline) => {
                const key = `${baseline.component_name}_${baseline.metric_name}`;
                acc[key] = baseline;
                return acc;
            }, {});
        }
        
        await db.end();
        
        // Process and group metrics
        const processedMetrics = processMetricsData(currentMetrics, historicalMetrics, baselines);
        
        res.json({
            success: true,
            metrics: {
                current: processedMetrics.current,
                historical: processedMetrics.historical,
                baselines: includeBaseline === 'true' ? processedMetrics.baselines : undefined,
                trends: processedMetrics.trends,
                thresholdViolations: processedMetrics.violations
            },
            metadata: {
                component,
                timeWindow: parseInt(timeWindow),
                collectedAt: currentMetrics.timestamp,
                dataPoints: historicalMetrics.length,
                includeBaseline: includeBaseline === 'true'
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
 * POST /api/performance-bottlenecks/detect
 * Trigger manual bottleneck detection
 * 
 * Body: {
 *   "component": "database" (optional - detect for specific component),
 *   "includeAnomaly": true (optional - include ML anomaly detection),
 *   "includePrediction": true (optional - include predictive analysis)
 * }
 */
router.post('/detect', ensureServiceReady, async (req, res) => {
    try {
        const { component, includeAnomaly = true, includePrediction = false } = req.body;
        
        console.log(`🔍 Manual bottleneck detection triggered${component ? ` for ${component}` : ''}`);
        
        // Collect current metrics
        const metrics = await bottleneckService.collectPerformanceMetrics();
        
        if (!metrics) {
            return res.status(500).json({
                error: 'Failed to collect metrics for detection'
            });
        }
        
        // Detect bottlenecks
        const detectedBottlenecks = await bottleneckService.detectBottlenecks(metrics);
        
        let predictions = [];
        if (includePrediction) {
            predictions = await bottleneckService.predictFutureBottlenecks();
        }
        
        // Filter by component if specified
        let filteredBottlenecks = detectedBottlenecks;
        let filteredPredictions = predictions;
        
        if (component) {
            filteredBottlenecks = detectedBottlenecks.filter(b => 
                b.component === component || 
                (b.components && b.components.includes(component))
            );
            filteredPredictions = predictions.filter(p => p.component === component);
        }
        
        res.json({
            success: true,
            detection: {
                triggered_at: new Date().toISOString(),
                metrics_collected: Object.keys(metrics).length,
                bottlenecks_detected: filteredBottlenecks.length,
                predictions_generated: filteredPredictions.length,
                bottlenecks: filteredBottlenecks.map(b => ({
                    ...b,
                    urgency: calculateUrgencyScore(b),
                    actionRequired: b.severity === 'critical' || b.severityScore > 80
                })),
                predictions: includePrediction ? filteredPredictions : undefined,
                summary: {
                    critical: filteredBottlenecks.filter(b => b.severity === 'critical').length,
                    warning: filteredBottlenecks.filter(b => b.severity === 'warning').length,
                    minor: filteredBottlenecks.filter(b => b.severity === 'minor').length,
                    anomalies: filteredBottlenecks.filter(b => b.type === 'ml_anomaly').length
                }
            }
        });
        
    } catch (error) {
        console.error('Manual detection error:', error);
        res.status(500).json({
            error: 'Failed to detect bottlenecks',
            details: error.message
        });
    }
});

/**
 * GET /api/performance-bottlenecks/predictions
 * Get bottleneck predictions and forecasts
 * 
 * Query params:
 * - component: specific component (optional)
 * - horizon: prediction horizon in minutes (default 15)
 * - model: specific ML model (optional)
 * - confidence: minimum confidence threshold (default 0.7)
 */
router.get('/predictions', async (req, res) => {
    try {
        const { component, horizon = 15, model, confidence = 0.7 } = req.query;
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        let query = `
            SELECT 
                bp.prediction_id,
                bp.model_name,
                bp.component_name,
                bp.metric_name,
                bp.current_value,
                bp.predicted_value,
                bp.threshold_value,
                bp.time_to_threshold_minutes,
                bp.predicted_severity,
                bp.confidence_score,
                bp.trend_slope,
                bp.input_features,
                bp.predicted_at,
                bp.actual_outcome,
                bpm.model_type,
                bpm.model_accuracy
            FROM bottleneck_predictions bp
            JOIN bottleneck_prediction_models bpm ON bp.model_name = bpm.model_name
            WHERE bp.predicted_at >= DATE_SUB(NOW(), INTERVAL 6 HOUR)
              AND bp.confidence_score >= ?
        `;
        
        const params = [parseFloat(confidence)];
        
        if (component) {
            query += ' AND bp.component_name = ?';
            params.push(component);
        }
        
        if (horizon) {
            query += ' AND bp.prediction_horizon_minutes <= ?';
            params.push(parseInt(horizon));
        }
        
        if (model) {
            query += ' AND bp.model_name = ?';
            params.push(model);
        }
        
        query += ' ORDER BY bp.time_to_threshold_minutes ASC, bp.confidence_score DESC';
        
        const [predictions] = await db.execute(query, params);
        
        // Get model accuracy summary
        const [modelAccuracy] = await db.execute(`
            SELECT * FROM v_prediction_accuracy
            ${model ? 'WHERE model_name = ?' : ''}
            ORDER BY accuracy_percentage DESC
        `, model ? [model] : []);
        
        await db.end();
        
        res.json({
            success: true,
            predictions: predictions.map(pred => ({
                ...pred,
                input_features: JSON.parse(pred.input_features || '{}'),
                reliability_score: calculatePredictionReliability(pred),
                urgency_level: getPredictionUrgencyLevel(pred),
                estimated_impact: estimatePredictionImpact(pred),
                validation_status: pred.actual_outcome ? getValidationStatus(pred.actual_outcome) : 'pending'
            })),
            modelAccuracy: modelAccuracy.map(acc => ({
                ...acc,
                reliability_grade: getModelReliabilityGrade(acc)
            })),
            metadata: {
                component,
                horizon: parseInt(horizon),
                model,
                confidenceThreshold: parseFloat(confidence),
                predictionsReturned: predictions.length,
                modelsEvaluated: modelAccuracy.length
            }
        });
        
    } catch (error) {
        console.error('Predictions retrieval error:', error);
        res.status(500).json({
            error: 'Failed to get bottleneck predictions',
            details: error.message
        });
    }
});

/**
 * GET /api/performance-bottlenecks/root-cause/:bottleneckId
 * Get root cause analysis for specific bottleneck
 */
router.get('/root-cause/:bottleneckId', async (req, res) => {
    try {
        const { bottleneckId } = req.params;
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        // Get bottleneck details
        const [bottleneckData] = await db.execute(`
            SELECT * FROM performance_bottlenecks WHERE bottleneck_id = ?
        `, [bottleneckId]);
        
        if (bottleneckData.length === 0) {
            await db.end();
            return res.status(404).json({
                error: 'Bottleneck not found'
            });
        }
        
        const bottleneck = bottleneckData[0];
        
        // Get root cause analysis
        const [rootCauseData] = await db.execute(`
            SELECT * FROM bottleneck_root_causes WHERE bottleneck_id = ?
        `, [bottleneckId]);
        
        // Get related correlations
        const componentNames = Array.isArray(bottleneck.affected_metrics) 
            ? JSON.parse(bottleneck.affected_metrics).map(m => m.component)
            : [bottleneck.component_name];
        
        const [correlations] = await db.execute(`
            SELECT * FROM performance_correlations
            WHERE component_a IN (${componentNames.map(() => '?').join(',')})
               OR component_b IN (${componentNames.map(() => '?').join(',')})
            ORDER BY correlation_strength DESC, ABS(correlation_coefficient) DESC
        `, [...componentNames, ...componentNames]);
        
        // Get system dependencies
        const [dependencies] = await db.execute(`
            SELECT * FROM system_component_dependencies
            WHERE source_component IN (${componentNames.map(() => '?').join(',')})
               OR target_component IN (${componentNames.map(() => '?').join(',')})
            ORDER BY dependency_strength DESC
        `, [...componentNames, ...componentNames]);
        
        await db.end();
        
        const rootCause = rootCauseData.length > 0 ? {
            ...rootCauseData[0],
            contributing_factors: JSON.parse(rootCauseData[0].contributing_factors || '[]'),
            dependency_chain: JSON.parse(rootCauseData[0].dependency_chain || '[]'),
            correlation_analysis: JSON.parse(rootCauseData[0].correlation_analysis || '{}'),
            supporting_evidence: JSON.parse(rootCauseData[0].supporting_evidence || '{}'),
            alternative_causes: JSON.parse(rootCauseData[0].alternative_causes || '[]')
        } : null;
        
        res.json({
            success: true,
            bottleneck: {
                ...bottleneck,
                detection_details: JSON.parse(bottleneck.detection_details || '{}'),
                current_values: JSON.parse(bottleneck.current_values || '{}'),
                baseline_values: JSON.parse(bottleneck.baseline_values || '{}'),
                threshold_values: JSON.parse(bottleneck.threshold_values || '{}')
            },
            rootCause,
            correlations: correlations.map(corr => ({
                ...corr,
                strength_description: getCorrelationStrengthDescription(corr.correlation_strength)
            })),
            dependencies: dependencies.map(dep => ({
                ...dep,
                impact_level: getDependencyImpactLevel(dep)
            })),
            analysis: {
                hasRootCause: rootCause !== null,
                confidence: rootCause?.confidence_score || 0,
                correlationCount: correlations.length,
                dependencyCount: dependencies.length,
                analysisQuality: calculateAnalysisQuality(rootCause, correlations, dependencies)
            }
        });
        
    } catch (error) {
        console.error('Root cause analysis error:', error);
        res.status(500).json({
            error: 'Failed to get root cause analysis',
            details: error.message
        });
    }
});

/**
 * GET /api/performance-bottlenecks/recommendations/:bottleneckId
 * Get optimization recommendations for specific bottleneck
 */
router.get('/recommendations/:bottleneckId', async (req, res) => {
    try {
        const { bottleneckId } = req.params;
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        const [recommendations] = await db.execute(`
            SELECT 
                br.*,
                pb.component_name,
                pb.severity,
                pb.category
            FROM bottleneck_recommendations br
            JOIN performance_bottlenecks pb ON br.bottleneck_id = pb.bottleneck_id
            WHERE br.bottleneck_id = ?
            ORDER BY br.priority DESC, br.confidence_score DESC, br.created_at DESC
        `, [bottleneckId]);
        
        if (recommendations.length === 0) {
            await db.end();
            return res.status(404).json({
                error: 'No recommendations found for this bottleneck'
            });
        }
        
        await db.end();
        
        res.json({
            success: true,
            recommendations: recommendations.map(rec => ({
                ...rec,
                prerequisites: JSON.parse(rec.prerequisites || '[]'),
                side_effects: JSON.parse(rec.side_effects || '[]'),
                actual_impact: JSON.parse(rec.actual_impact || '{}'),
                implementation_readiness: calculateImplementationReadiness(rec),
                risk_level: calculateRiskLevel(rec),
                effort_estimate: formatEffortEstimate(rec.estimated_time_minutes),
                status_description: getStatusDescription(rec.status)
            })),
            summary: {
                total: recommendations.length,
                pending: recommendations.filter(r => r.status === 'pending').length,
                inProgress: recommendations.filter(r => r.status === 'in_progress').length,
                completed: recommendations.filter(r => r.status === 'completed').length,
                highPriority: recommendations.filter(r => r.priority === 'high' || r.priority === 'critical').length
            }
        });
        
    } catch (error) {
        console.error('Recommendations retrieval error:', error);
        res.status(500).json({
            error: 'Failed to get recommendations',
            details: error.message
        });
    }
});

/**
 * GET /api/performance-bottlenecks/analytics
 * Get comprehensive bottleneck analytics and insights
 * 
 * Query params:
 * - timeframe: 24h, 7d, 30d (default 7d)
 * - component: specific component (optional)
 */
router.get('/analytics', async (req, res) => {
    try {
        const { timeframe = '7d', component } = req.query;
        
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
        
        // Get bottleneck trends
        const [trends] = await db.execute(`
            SELECT * FROM v_bottleneck_trends
            WHERE date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            ${component ? 'AND component_name = ?' : ''}
            ORDER BY date DESC, component_name
        `, component ? [days, component] : [days]);
        
        // Get component health summary
        const [healthSummary] = await db.execute(`
            SELECT * FROM v_component_health_summary
            ${component ? 'WHERE component_name = ?' : ''}
            ORDER BY health_status DESC, component_name
        `, component ? [component] : []);
        
        // Get prediction accuracy
        const [predictionAccuracy] = await db.execute(`
            SELECT * FROM v_prediction_accuracy
            ${component ? 'WHERE target_component = ?' : ''}
            ORDER BY accuracy_percentage DESC
        `, component ? [component] : []);
        
        // Get resolution statistics
        const [resolutionStats] = await db.execute(`
            SELECT 
                component_name,
                category,
                COUNT(*) as total_bottlenecks,
                COUNT(CASE WHEN resolved_at IS NOT NULL THEN 1 END) as resolved_count,
                AVG(CASE WHEN resolved_at IS NOT NULL THEN duration_seconds / 60 END) as avg_resolution_minutes,
                AVG(severity_score) as avg_severity_score,
                AVG(impact_score) as avg_impact_score
            FROM performance_bottlenecks
            WHERE detected_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
              ${component ? 'AND component_name = ?' : ''}
            GROUP BY component_name, category
            ORDER BY total_bottlenecks DESC
        `, component ? [days, component] : [days]);
        
        await db.end();
        
        // Generate insights
        const insights = generatePerformanceInsights(trends, healthSummary, predictionAccuracy, resolutionStats);
        
        res.json({
            success: true,
            analytics: {
                timeframe,
                component,
                trends: processTrendData(trends),
                healthSummary: healthSummary.map(health => ({
                    ...health,
                    health_grade: getHealthGrade(health.health_status),
                    performance_score: calculatePerformanceScore(health)
                })),
                predictionAccuracy: predictionAccuracy.map(acc => ({
                    ...acc,
                    reliability_grade: getModelReliabilityGrade(acc),
                    trend_direction: getPredictionTrend(acc)
                })),
                resolutionStats: resolutionStats.map(stat => ({
                    ...stat,
                    resolution_rate: stat.total_bottlenecks > 0 ? stat.resolved_count / stat.total_bottlenecks : 0,
                    efficiency_score: calculateResolutionEfficiency(stat)
                })),
                insights
            },
            metadata: {
                generatedAt: new Date().toISOString(),
                dataPoints: {
                    trends: trends.length,
                    components: healthSummary.length,
                    models: predictionAccuracy.length,
                    resolutions: resolutionStats.length
                }
            }
        });
        
    } catch (error) {
        console.error('Analytics retrieval error:', error);
        res.status(500).json({
            error: 'Failed to get bottleneck analytics',
            details: error.message
        });
    }
});

// Helper functions
function calculateUrgencyScore(bottleneck) {
    let urgency = bottleneck.severity_score || 50;
    
    // Adjust for impact
    if (bottleneck.impact_score) {
        urgency = (urgency + bottleneck.impact_score) / 2;
    }
    
    // Adjust for duration (longer duration = higher urgency)
    if (bottleneck.duration_seconds) {
        const hours = bottleneck.duration_seconds / 3600;
        if (hours > 24) urgency += 20;
        else if (hours > 4) urgency += 10;
        else if (hours > 1) urgency += 5;
    }
    
    // Adjust for category
    const categoryMultipliers = {
        resource_exhaustion: 1.3,
        dependency_failure: 1.2,
        capacity_saturation: 1.1,
        performance_degradation: 1.0,
        anomaly_detection: 0.9
    };
    
    urgency *= categoryMultipliers[bottleneck.category] || 1.0;
    
    return Math.min(100, Math.round(urgency));
}

function formatTimeAgo(seconds) {
    if (!seconds) return 'Unknown';
    
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return `${seconds} second${seconds > 1 ? 's' : ''} ago`;
}

function getBottleneckStatus(bottleneck) {
    if (bottleneck.severity === 'critical') return 'requires_immediate_attention';
    if (bottleneck.recommendation_count === 0) return 'needs_investigation';
    if (bottleneck.duration_seconds > 3600) return 'long_running';
    return 'monitoring';
}

function generateBottleneckSummary(bottlenecks) {
    return {
        total: bottlenecks.length,
        critical: bottlenecks.filter(b => b.severity === 'critical').length,
        warning: bottlenecks.filter(b => b.severity === 'warning').length,
        minor: bottlenecks.filter(b => b.severity === 'minor').length,
        avgUrgency: bottlenecks.length > 0 
            ? Math.round(bottlenecks.reduce((sum, b) => sum + b.urgencyScore, 0) / bottlenecks.length)
            : 0,
        componentsAffected: [...new Set(bottlenecks.map(b => b.component_name))].length,
        requiresImmediateAction: bottlenecks.filter(b => b.severity === 'critical' || b.urgencyScore > 85).length
    };
}

function processMetricsData(current, historical, baselines) {
    const processed = {
        current: current,
        historical: groupHistoricalMetrics(historical),
        baselines: baselines,
        trends: calculateMetricTrends(historical),
        violations: getThresholdViolations(historical)
    };
    
    return processed;
}

function groupHistoricalMetrics(historical) {
    const grouped = {};
    
    historical.forEach(metric => {
        const key = `${metric.component_name}_${metric.metric_name}`;
        
        if (!grouped[key]) {
            grouped[key] = {
                component: metric.component_name,
                metric: metric.metric_name,
                dataPoints: [],
                violations: 0
            };
        }
        
        grouped[key].dataPoints.push({
            value: metric.metric_value,
            timestamp: metric.recorded_at,
            severity: metric.severity_level,
            exceeded: metric.is_threshold_exceeded
        });
        
        if (metric.is_threshold_exceeded) {
            grouped[key].violations++;
        }
    });
    
    return Object.values(grouped);
}

function calculateMetricTrends(historical) {
    const trends = {};
    
    historical.forEach(metric => {
        const key = `${metric.component_name}_${metric.metric_name}`;
        
        if (!trends[key]) {
            trends[key] = {
                component: metric.component_name,
                metric: metric.metric_name,
                values: []
            };
        }
        
        trends[key].values.push({
            value: metric.metric_value,
            timestamp: new Date(metric.recorded_at).getTime()
        });
    });
    
    // Calculate trend direction for each metric
    Object.values(trends).forEach(trend => {
        if (trend.values.length >= 2) {
            trend.values.sort((a, b) => a.timestamp - b.timestamp);
            
            const first = trend.values[0].value;
            const last = trend.values[trend.values.length - 1].value;
            const change = ((last - first) / first) * 100;
            
            if (change > 5) trend.direction = 'increasing';
            else if (change < -5) trend.direction = 'decreasing';
            else trend.direction = 'stable';
            
            trend.changePercentage = Math.round(change * 100) / 100;
        } else {
            trend.direction = 'insufficient_data';
            trend.changePercentage = 0;
        }
    });
    
    return Object.values(trends);
}

function getThresholdViolations(historical) {
    return historical
        .filter(metric => metric.is_threshold_exceeded)
        .map(metric => ({
            component: metric.component_name,
            metric: metric.metric_name,
            value: metric.metric_value,
            severity: metric.severity_level,
            timestamp: metric.recorded_at
        }))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function calculatePredictionReliability(prediction) {
    let reliability = prediction.confidence_score * 100;
    
    // Adjust based on model accuracy
    if (prediction.model_accuracy) {
        reliability = (reliability + prediction.model_accuracy * 100) / 2;
    }
    
    // Adjust based on time to threshold
    if (prediction.time_to_threshold_minutes < 5) reliability *= 0.8; // Very short predictions less reliable
    
    return Math.round(reliability);
}

function getPredictionUrgencyLevel(prediction) {
    if (prediction.time_to_threshold_minutes <= 5) return 'immediate';
    if (prediction.time_to_threshold_minutes <= 15) return 'high';
    if (prediction.time_to_threshold_minutes <= 60) return 'medium';
    return 'low';
}

function estimatePredictionImpact(prediction) {
    let impact = 'medium';
    
    if (prediction.predicted_severity === 'critical') impact = 'high';
    if (prediction.component_name === 'database' || prediction.component_name === 'web_server') {
        impact = impact === 'high' ? 'critical' : 'high';
    }
    
    return impact;
}

function getValidationStatus(outcome) {
    const statusMap = {
        true_positive: 'accurate_prediction',
        true_negative: 'accurate_no_event',
        false_positive: 'false_alarm',
        false_negative: 'missed_event'
    };
    return statusMap[outcome] || 'unknown';
}

function getModelReliabilityGrade(accuracy) {
    const percentage = accuracy.accuracy_percentage || 0;
    
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
}

function generatePerformanceInsights(trends, healthSummary, predictionAccuracy, resolutionStats) {
    const insights = [];
    
    // Health insights
    const criticalComponents = healthSummary.filter(h => h.health_status === 'critical');
    if (criticalComponents.length > 0) {
        insights.push({
            type: 'critical',
            title: 'Critical Component Health Issues',
            description: `${criticalComponents.length} component(s) are in critical state: ${criticalComponents.map(c => c.component_name).join(', ')}`,
            impact: 'system_stability',
            components: criticalComponents.map(c => c.component_name)
        });
    }
    
    // Prediction insights
    const highAccuracyModels = predictionAccuracy.filter(pred => (pred.accuracy_percentage || 0) > 85);
    if (highAccuracyModels.length > 0) {
        insights.push({
            type: 'positive',
            title: 'High Prediction Accuracy',
            description: `${highAccuracyModels.length} prediction model(s) achieving >85% accuracy`,
            impact: 'proactive_monitoring',
            models: highAccuracyModels.map(m => m.model_name)
        });
    }
    
    // Resolution insights
    const totalBottlenecks = resolutionStats.reduce((sum, stat) => sum + stat.total_bottlenecks, 0);
    const totalResolved = resolutionStats.reduce((sum, stat) => sum + stat.resolved_count, 0);
    const overallResolutionRate = totalBottlenecks > 0 ? totalResolved / totalBottlenecks : 0;
    
    if (overallResolutionRate > 0.8) {
        insights.push({
            type: 'positive',
            title: 'High Resolution Rate',
            description: `${(overallResolutionRate * 100).toFixed(1)}% of bottlenecks are being resolved effectively`,
            impact: 'operational_efficiency'
        });
    }
    
    return insights;
}

// Error handling middleware
router.use((error, req, res, next) => {
    console.error('Performance Bottleneck API Error:', error);
    res.status(500).json({
        error: 'Internal server error in Performance Bottleneck API',
        details: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    });
});

module.exports = router;