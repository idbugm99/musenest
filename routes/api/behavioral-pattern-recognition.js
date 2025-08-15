/**
 * Behavioral Pattern Recognition API Routes
 * 
 * RESTful API endpoints for behavioral analysis, fraud detection, 
 * abuse pattern recognition, and security threat monitoring.
 */

const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

// Initialize Behavioral Pattern Recognition Service
let behavioralService = null;

async function initializeService() {
    if (!behavioralService) {
        const BehavioralPatternRecognitionService = require('../../src/services/BehavioralPatternRecognitionService');
        
        // Create database connection for the service
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        behavioralService = new BehavioralPatternRecognitionService(db);
        await behavioralService.initialize();
    }
    return behavioralService;
}

// Middleware to ensure service is initialized
async function ensureServiceReady(req, res, next) {
    try {
        await initializeService();
        next();
    } catch (error) {
        console.error('Failed to initialize Behavioral Pattern Recognition Service:', error);
        res.status(503).json({
            error: 'Behavioral Pattern Recognition Service unavailable',
            details: error.message
        });
    }
}

/**
 * GET /api/behavioral-pattern-recognition/health
 * Get service health status and model performance metrics
 */
router.get('/health', ensureServiceReady, async (req, res) => {
    try {
        const health = await behavioralService.getServiceHealthStatus();
        res.json(health);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get health status',
            details: error.message
        });
    }
});

/**
 * POST /api/behavioral-pattern-recognition/analyze
 * Analyze user behavior for anomalies, fraud, and threats
 * 
 * Body: {
 *   "userId": 123,
 *   "behaviorData": {
 *     "session_duration": 1800,
 *     "click_rate": 2.5,
 *     "page_dwell_time": 45,
 *     "navigation_velocity": 3.2,
 *     "interaction_depth": 12,
 *     "feature_usage_pattern": 0.65
 *   },
 *   "context": {
 *     "session_id": "sess_456789",
 *     "device_type": "desktop",
 *     "ip_address": "192.168.1.100",
 *     "user_agent": "Mozilla/5.0...",
 *     "referrer": "https://example.com",
 *     "location": "US-CA"
 *   }
 * }
 */
router.post('/analyze', ensureServiceReady, async (req, res) => {
    try {
        const { userId, behaviorData, context = {} } = req.body;
        
        if (!userId || !behaviorData) {
            return res.status(400).json({
                error: 'Missing required parameters',
                required: ['userId', 'behaviorData']
            });
        }
        
        if (typeof behaviorData !== 'object' || Object.keys(behaviorData).length === 0) {
            return res.status(400).json({
                error: 'Invalid behavior data',
                message: 'behaviorData must be a non-empty object'
            });
        }
        
        console.log(`🔍 Analyzing behavior patterns for user: ${userId}`);
        
        const behaviorAnalysis = await behavioralService.analyzeBehaviorPattern(
            userId, 
            behaviorData, 
            context
        );
        
        res.json({
            success: !behaviorAnalysis.error,
            ...behaviorAnalysis
        });
        
    } catch (error) {
        console.error('Behavior analysis error:', error);
        res.status(500).json({
            error: 'Failed to analyze behavior patterns',
            details: error.message
        });
    }
});

/**
 * POST /api/behavioral-pattern-recognition/monitor-realtime
 * Monitor real-time user activity for immediate threat detection
 * 
 * Body: {
 *   "userId": 123,
 *   "activityEvent": {
 *     "event_type": "login_attempt",
 *     "timestamp": "2025-01-15T10:30:00Z",
 *     "device_info": { ... },
 *     "location_data": { ... },
 *     "session_data": { ... }
 *   }
 * }
 */
router.post('/monitor-realtime', ensureServiceReady, async (req, res) => {
    try {
        const { userId, activityEvent } = req.body;
        
        if (!userId || !activityEvent) {
            return res.status(400).json({
                error: 'Missing required parameters',
                required: ['userId', 'activityEvent']
            });
        }
        
        if (!activityEvent.event_type) {
            return res.status(400).json({
                error: 'Invalid activity event',
                message: 'activityEvent must include event_type'
            });
        }
        
        console.log(`⚡ Real-time monitoring for user: ${userId}, event: ${activityEvent.event_type}`);
        
        const monitoringResult = await behavioralService.monitorRealtimeActivity(
            userId, 
            activityEvent
        );
        
        res.json({
            success: !monitoringResult.error,
            ...monitoringResult
        });
        
    } catch (error) {
        console.error('Real-time monitoring error:', error);
        res.status(500).json({
            error: 'Failed to monitor real-time activity',
            details: error.message
        });
    }
});

/**
 * POST /api/behavioral-pattern-recognition/investigate
 * Investigate suspicious behavior patterns across multiple users
 * 
 * Body: {
 *   "investigationParameters": {
 *     "timeframe": "24h",
 *     "pattern_types": ["fraud", "abuse", "security"],
 *     "minimum_confidence": 0.7,
 *     "cross_user_analysis": true
 *   }
 * }
 */
router.post('/investigate', ensureServiceReady, async (req, res) => {
    try {
        const { investigationParameters = {} } = req.body;
        
        console.log('🕵️ Starting suspicious pattern investigation');
        
        const investigation = await behavioralService.investigateSuspiciousPatterns(
            investigationParameters
        );
        
        res.json({
            success: true,
            ...investigation
        });
        
    } catch (error) {
        console.error('Investigation error:', error);
        res.status(500).json({
            error: 'Failed to investigate suspicious patterns',
            details: error.message
        });
    }
});

/**
 * GET /api/behavioral-pattern-recognition/user-risk/:userId
 * Get comprehensive risk assessment for a specific user
 * 
 * Query params:
 * - analysis_days: number of days to analyze (default 30)
 * - include_history: include historical analysis data
 * - include_details: include detailed analysis breakdown
 */
router.get('/user-risk/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { 
            analysis_days = 30, 
            include_history = 'true', 
            include_details = 'true' 
        } = req.query;
        
        if (!userId || isNaN(parseInt(userId))) {
            return res.status(400).json({
                error: 'Invalid user ID',
                message: 'User ID must be a valid number'
            });
        }
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        // Get user risk assessment using stored procedure
        const [riskAssessment] = await db.execute(
            'CALL GetUserRiskAssessment(?, ?)', 
            [parseInt(userId), parseInt(analysis_days)]
        );
        
        if (!riskAssessment || riskAssessment.length === 0) {
            await db.end();
            return res.status(404).json({
                error: 'User risk profile not found',
                user_id: userId
            });
        }
        
        const userRisk = riskAssessment[0];
        
        // Parse JSON fields
        userRisk.behavior_baselines = JSON.parse(userRisk.behavior_baselines || '{}');
        userRisk.behavior_patterns = JSON.parse(userRisk.behavior_patterns || '{}');
        userRisk.risk_factors = JSON.parse(userRisk.risk_factors || '{}');
        
        // Get recent behavior analyses if requested
        if (include_history === 'true') {
            const [recentAnalyses] = await db.execute(`
                SELECT 
                    composite_risk_score,
                    risk_level,
                    risk_category,
                    confidence_score,
                    escalation_required,
                    created_at
                FROM behavior_pattern_analysis 
                WHERE user_id = ? 
                  AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                ORDER BY created_at DESC 
                LIMIT 20
            `, [parseInt(userId), parseInt(analysis_days)]);
            
            userRisk.recent_analyses = recentAnalyses;
        }
        
        // Get fraud cases if requested
        if (include_details === 'true') {
            const [fraudCases] = await db.execute(`
                SELECT 
                    case_id,
                    fraud_type,
                    severity,
                    fraud_probability,
                    case_status,
                    detected_at
                FROM fraud_detection_cases 
                WHERE user_id = ? 
                  AND detected_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                ORDER BY detected_at DESC 
                LIMIT 10
            `, [parseInt(userId), parseInt(analysis_days)]);
            
            const [abuseIncidents] = await db.execute(`
                SELECT 
                    incident_id,
                    abuse_type,
                    abuse_severity,
                    detection_confidence,
                    incident_status,
                    detected_at
                FROM abuse_detection_incidents 
                WHERE user_id = ? 
                  AND detected_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                ORDER BY detected_at DESC 
                LIMIT 10
            `, [parseInt(userId), parseInt(analysis_days)]);
            
            const [securityThreats] = await db.execute(`
                SELECT 
                    threat_id,
                    threat_type,
                    threat_severity,
                    threat_probability,
                    threat_status,
                    detected_at
                FROM security_threat_monitoring 
                WHERE user_id = ? 
                  AND detected_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                ORDER BY detected_at DESC 
                LIMIT 10
            `, [parseInt(userId), parseInt(analysis_days)]);
            
            userRisk.fraud_cases = fraudCases;
            userRisk.abuse_incidents = abuseIncidents;
            userRisk.security_threats = securityThreats;
        }
        
        await db.end();
        
        res.json({
            success: true,
            user_id: parseInt(userId),
            risk_assessment: userRisk,
            analysis_period_days: parseInt(analysis_days),
            generated_at: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('User risk assessment error:', error);
        res.status(500).json({
            error: 'Failed to get user risk assessment',
            details: error.message
        });
    }
});

/**
 * GET /api/behavioral-pattern-recognition/analytics
 * Generate comprehensive security and fraud analytics
 * 
 * Query params:
 * - timeframe: 7d, 30d, 90d (default 30d)
 * - analytics_type: risk_trends, fraud_patterns, abuse_patterns, security_threats
 * - include_predictions: include predictive analysis
 */
router.get('/analytics', ensureServiceReady, async (req, res) => {
    try {
        const { 
            timeframe = '30d', 
            analytics_type, 
            include_predictions = 'true' 
        } = req.query;
        
        const validTimeframes = ['7d', '30d', '90d'];
        if (!validTimeframes.includes(timeframe)) {
            return res.status(400).json({
                error: 'Invalid timeframe',
                valid_options: validTimeframes
            });
        }
        
        console.log(`📊 Generating behavioral analytics for timeframe: ${timeframe}`);
        
        const analytics = await behavioralService.generateSecurityAnalytics(timeframe);
        
        // Filter by analytics type if specified
        if (analytics_type) {
            analytics.filtered_by_type = analytics_type;
        }
        
        res.json({
            success: true,
            ...analytics
        });
        
    } catch (error) {
        console.error('Analytics generation error:', error);
        res.status(500).json({
            error: 'Failed to generate behavioral analytics',
            details: error.message
        });
    }
});

/**
 * GET /api/behavioral-pattern-recognition/dashboard
 * Get behavioral security dashboard data
 * 
 * Query params:
 * - timeframe: 24h, 7d, 30d (default 7d)
 */
router.get('/dashboard', async (req, res) => {
    try {
        const { timeframe = '7d' } = req.query;
        
        const days = timeframe === '24h' ? 1 : timeframe === '7d' ? 7 : 30;
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        // Get high-risk users
        const [highRiskUsers] = await db.execute(`
            SELECT * FROM v_high_risk_users LIMIT 10
        `);
        
        // Get fraud case summary
        const [fraudSummary] = await db.execute(`
            SELECT * FROM v_fraud_case_summary 
            WHERE detection_date >= DATE_SUB(NOW(), INTERVAL ? DAY)
            ORDER BY detection_date DESC
            LIMIT 20
        `, [days]);
        
        // Get security threat dashboard
        const [threatDashboard] = await db.execute(`
            SELECT * FROM v_security_threat_dashboard
            ORDER BY threat_count DESC
            LIMIT 15
        `);
        
        // Get recent behavioral analyses summary
        const [recentAnalyses] = await db.execute(`
            SELECT 
                DATE(created_at) as analysis_date,
                risk_level,
                COUNT(*) as analysis_count,
                AVG(composite_risk_score) as avg_risk_score,
                COUNT(CASE WHEN escalation_required = TRUE THEN 1 END) as escalations
            FROM behavior_pattern_analysis
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY DATE(created_at), risk_level
            ORDER BY analysis_date DESC, avg_risk_score DESC
        `, [days]);
        
        // Get system performance metrics
        const [performanceMetrics] = await db.execute(`
            SELECT 
                COUNT(CASE WHEN bpa.created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR) THEN 1 END) as analyses_last_hour,
                COUNT(CASE WHEN fdc.detected_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR) THEN 1 END) as fraud_cases_last_hour,
                COUNT(CASE WHEN adi.detected_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR) THEN 1 END) as abuse_incidents_last_hour,
                COUNT(CASE WHEN stm.detected_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR) THEN 1 END) as security_threats_last_hour,
                AVG(bpa.processing_time_ms) as avg_processing_time_ms
            FROM behavior_pattern_analysis bpa
            LEFT JOIN fraud_detection_cases fdc ON DATE(bpa.created_at) = DATE(fdc.detected_at)
            LEFT JOIN abuse_detection_incidents adi ON DATE(bpa.created_at) = DATE(adi.detected_at)
            LEFT JOIN security_threat_monitoring stm ON DATE(bpa.created_at) = DATE(stm.detected_at)
            WHERE bpa.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        `, [days]);
        
        await db.end();
        
        // Process results
        const dashboard = {
            timeframe,
            generated_at: new Date().toISOString(),
            
            high_risk_users: highRiskUsers.map(user => ({
                ...user,
                base_risk_score: parseFloat(user.base_risk_score || 0),
                trust_score: parseFloat(user.trust_score || 0),
                reputation_score: parseFloat(user.reputation_score || 0),
                max_recent_risk_score: parseFloat(user.max_recent_risk_score || 0),
                recent_analyses: parseInt(user.recent_analyses || 0),
                high_risk_analyses: parseInt(user.high_risk_analyses || 0),
                escalations_required: parseInt(user.escalations_required || 0)
            })),
            
            fraud_summary: fraudSummary.map(summary => ({
                ...summary,
                case_count: parseInt(summary.case_count || 0),
                confirmed_cases: parseInt(summary.confirmed_cases || 0),
                false_positives: parseInt(summary.false_positives || 0),
                avg_fraud_probability: parseFloat(summary.avg_fraud_probability || 0),
                avg_detection_time_hours: parseFloat(summary.avg_detection_time_hours || 0),
                avg_resolution_time_hours: parseFloat(summary.avg_resolution_time_hours || 0),
                total_financial_impact: parseFloat(summary.total_financial_impact || 0)
            })),
            
            security_threats: threatDashboard.map(threat => ({
                ...threat,
                threat_count: parseInt(threat.threat_count || 0),
                active_threats: parseInt(threat.active_threats || 0),
                confirmed_threats: parseInt(threat.confirmed_threats || 0),
                avg_threat_probability: parseFloat(threat.avg_threat_probability || 0),
                avg_urgency_score: parseFloat(threat.avg_urgency_score || 0),
                escalated_threats: parseInt(threat.escalated_threats || 0)
            })),
            
            recent_analyses: recentAnalyses.map(analysis => ({
                ...analysis,
                analysis_count: parseInt(analysis.analysis_count || 0),
                avg_risk_score: parseFloat(analysis.avg_risk_score || 0),
                escalations: parseInt(analysis.escalations || 0)
            })),
            
            performance_metrics: performanceMetrics[0] ? {
                analyses_last_hour: parseInt(performanceMetrics[0].analyses_last_hour || 0),
                fraud_cases_last_hour: parseInt(performanceMetrics[0].fraud_cases_last_hour || 0),
                abuse_incidents_last_hour: parseInt(performanceMetrics[0].abuse_incidents_last_hour || 0),
                security_threats_last_hour: parseInt(performanceMetrics[0].security_threats_last_hour || 0),
                avg_processing_time_ms: parseFloat(performanceMetrics[0].avg_processing_time_ms || 0)
            } : {}
        };
        
        res.json({
            success: true,
            dashboard
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
 * POST /api/behavioral-pattern-recognition/test
 * Test behavioral pattern recognition with sample data
 */
router.post('/test', ensureServiceReady, async (req, res) => {
    try {
        const testUsers = [
            { id: 1001, name: 'Normal User', riskProfile: 'low' },
            { id: 1002, name: 'Suspicious User', riskProfile: 'medium' },
            { id: 1003, name: 'High Risk User', riskProfile: 'high' }
        ];
        
        console.log('🧪 Running behavioral pattern recognition test');
        
        const testResults = [];
        
        for (const [index, user] of testUsers.entries()) {
            // Generate mock behavior data based on risk profile
            const mockBehaviorData = {
                session_duration: user.riskProfile === 'high' ? 30 : user.riskProfile === 'medium' ? 900 : 1800,
                click_rate: user.riskProfile === 'high' ? 15.0 : user.riskProfile === 'medium' ? 8.0 : 3.0,
                page_dwell_time: user.riskProfile === 'high' ? 5 : user.riskProfile === 'medium' ? 20 : 45,
                navigation_velocity: user.riskProfile === 'high' ? 25 : user.riskProfile === 'medium' ? 12 : 4,
                interaction_depth: user.riskProfile === 'high' ? 50 : user.riskProfile === 'medium' ? 30 : 15,
                feature_usage_pattern: user.riskProfile === 'high' ? 0.95 : user.riskProfile === 'medium' ? 0.75 : 0.65
            };
            
            const mockContext = {
                session_id: `test_session_${user.id}`,
                device_type: 'desktop',
                ip_address: `192.168.1.${100 + index}`,
                user_agent: 'Mozilla/5.0 (Test Browser)',
                test_mode: true
            };
            
            const analysis = await behavioralService.analyzeBehaviorPattern(
                user.id,
                mockBehaviorData,
                mockContext
            );
            
            testResults.push({
                user: user.name,
                user_id: user.id,
                expected_risk: user.riskProfile,
                analysis: {
                    risk_level: analysis.risk_level,
                    composite_risk_score: analysis.risk_scoring?.composite_score,
                    anomalies_detected: analysis.anomaly_detection?.anomalies_count || 0,
                    fraud_indicators: analysis.fraud_analysis?.fraud_indicators?.length || 0,
                    processing_time: analysis.analysis_metadata?.processing_time_ms
                }
            });
        }
        
        res.json({
            success: true,
            test_users: testUsers.length,
            test_results: testResults,
            message: 'Behavioral pattern recognition test completed successfully'
        });
        
    } catch (error) {
        console.error('Test execution error:', error);
        res.status(500).json({
            error: 'Failed to run test',
            details: error.message
        });
    }
});

// Error handling middleware
router.use((error, req, res, next) => {
    console.error('Behavioral Pattern Recognition API Error:', error);
    res.status(500).json({
        error: 'Internal server error in Behavioral Pattern Recognition API',
        details: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    });
});

module.exports = router;