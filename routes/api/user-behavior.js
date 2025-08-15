/**
 * User Behavior Analysis API Routes
 * 
 * RESTful API endpoints for user behavior tracking, analysis, and predictive loading.
 * Provides behavior event tracking, personalization, prefetch management,
 * and user journey analytics.
 */

const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

// Initialize User Behavior Analysis Service
let userBehaviorService = null;

async function initializeService() {
    if (!userBehaviorService) {
        const UserBehaviorAnalysisService = require('../../src/services/UserBehaviorAnalysisService');
        userBehaviorService = new UserBehaviorAnalysisService();
        await userBehaviorService.initialize();
    }
    return userBehaviorService;
}

// Middleware to ensure service is initialized
async function ensureServiceReady(req, res, next) {
    try {
        await initializeService();
        next();
    } catch (error) {
        console.error('Failed to initialize User Behavior Service:', error);
        res.status(503).json({
            error: 'User Behavior Service unavailable',
            details: error.message
        });
    }
}

/**
 * GET /api/user-behavior/health
 * Get service health status
 */
router.get('/health', ensureServiceReady, async (req, res) => {
    try {
        const health = await userBehaviorService.getHealthStatus();
        res.json(health);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get health status',
            details: error.message
        });
    }
});

/**
 * POST /api/user-behavior/track
 * Track user behavior event
 * 
 * Body: {
 *   "userId": "user123" (optional - can be anonymous),
 *   "sessionId": "session456",
 *   "eventType": "page_view",
 *   "pageUrl": "/gallery/model123",
 *   "metadata": { "interactionType": "click", "target": "image" }
 * }
 */
router.post('/track', ensureServiceReady, async (req, res) => {
    try {
        const eventData = req.body;
        
        // Validate required fields
        if (!eventData.sessionId || !eventData.eventType || !eventData.pageUrl) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['sessionId', 'eventType', 'pageUrl']
            });
        }
        
        // Add request metadata
        eventData.userAgent = req.get('User-Agent');
        eventData.ipAddress = req.ip;
        eventData.timestamp = new Date().toISOString();
        
        // Determine device type from user agent
        if (!eventData.deviceType) {
            eventData.deviceType = getDeviceType(eventData.userAgent);
        }
        
        // Track the event
        await userBehaviorService.trackBehaviorEvent(eventData);
        
        res.json({
            success: true,
            message: 'Behavior event tracked successfully',
            sessionId: eventData.sessionId,
            timestamp: eventData.timestamp
        });
        
    } catch (error) {
        console.error('Behavior tracking error:', error);
        res.status(500).json({
            error: 'Failed to track behavior event',
            details: error.message
        });
    }
});

/**
 * GET /api/user-behavior/predict/:sessionId
 * Get predictions for active user session
 * 
 * Query params:
 * - types: comma-separated list of prediction types (next_page, content_preference, session_duration)
 */
router.get('/predict/:sessionId', ensureServiceReady, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { types = 'next_page,content_preference' } = req.query;
        
        const requestedTypes = types.split(',').map(t => t.trim());
        
        // Get current session predictions from cache
        const cachedPredictions = await userBehaviorService.behaviorRedis.get(`predictions:${sessionId}`);
        
        if (cachedPredictions) {
            const predictions = JSON.parse(cachedPredictions);
            
            // Filter by requested types
            const filteredPredictions = {};
            requestedTypes.forEach(type => {
                if (predictions[type]) {
                    filteredPredictions[type] = predictions[type];
                }
            });
            
            res.json({
                success: true,
                sessionId,
                predictions: filteredPredictions,
                cached: true,
                timestamp: predictions.timestamp
            });
        } else {
            // Generate fresh predictions
            const currentEvent = {
                pageUrl: '/current', // This would come from session data
                eventType: 'page_view'
            };
            
            const predictions = await userBehaviorService.performPredictiveAnalysis(sessionId, currentEvent);
            
            if (predictions) {
                const filteredPredictions = {};
                requestedTypes.forEach(type => {
                    const camelCaseType = type.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
                    if (predictions[camelCaseType]) {
                        filteredPredictions[type] = predictions[camelCaseType];
                    }
                });
                
                res.json({
                    success: true,
                    sessionId,
                    predictions: filteredPredictions,
                    cached: false,
                    timestamp: predictions.timestamp
                });
            } else {
                res.status(404).json({
                    error: 'No predictions available for session',
                    sessionId
                });
            }
        }
        
    } catch (error) {
        console.error('Prediction retrieval error:', error);
        res.status(500).json({
            error: 'Failed to get predictions',
            details: error.message
        });
    }
});

/**
 * POST /api/user-behavior/prefetch
 * Trigger prefetch for user session
 * 
 * Body: {
 *   "sessionId": "session456",
 *   "strategy": "moderate" (aggressive, moderate, conservative),
 *   "resources": [
 *     { "type": "page", "url": "/gallery/123", "confidence": 0.8 }
 *   ]
 * }
 */
router.post('/prefetch', ensureServiceReady, async (req, res) => {
    try {
        const { sessionId, strategy = 'moderate', resources = [] } = req.body;
        
        if (!sessionId) {
            return res.status(400).json({
                error: 'Missing session ID'
            });
        }
        
        // Validate strategy
        const validStrategies = ['aggressive', 'moderate', 'conservative'];
        if (!validStrategies.includes(strategy)) {
            return res.status(400).json({
                error: 'Invalid strategy',
                validStrategies
            });
        }
        
        console.log(`🚀 Triggering prefetch for session ${sessionId} with strategy: ${strategy}`);
        
        let prefetchResults = [];
        
        if (resources.length > 0) {
            // Use provided resources
            for (const resource of resources) {
                try {
                    const result = await userBehaviorService.executePrefetchTask({
                        ...resource,
                        sessionId,
                        strategy
                    });
                    prefetchResults.push({ ...resource, result });
                } catch (error) {
                    prefetchResults.push({ 
                        ...resource, 
                        result: { success: false, error: error.message } 
                    });
                }
            }
        } else {
            // Generate predictions and prefetch automatically
            const predictions = {
                sessionId,
                nextPage: { predictions: [] },
                contentPreferences: { recommendations: [] }
            };
            
            await userBehaviorService.triggerPredictivePrefetch(predictions);
            
            prefetchResults.push({
                type: 'automatic',
                message: 'Predictive prefetch triggered based on user behavior'
            });
        }
        
        res.json({
            success: true,
            sessionId,
            strategy,
            prefetchResults,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Prefetch trigger error:', error);
        res.status(500).json({
            error: 'Failed to trigger prefetch',
            details: error.message
        });
    }
});

/**
 * GET /api/user-behavior/personalization/:userId
 * Get personalized recommendations for user
 * 
 * Query params:
 * - sessionId: current session ID (optional)
 * - categories: comma-separated list (galleries, themes, content)
 */
router.get('/personalization/:userId', ensureServiceReady, async (req, res) => {
    try {
        const { userId } = req.params;
        const { sessionId, categories = 'galleries,themes,content' } = req.query;
        
        const requestedCategories = categories.split(',').map(c => c.trim());
        
        console.log(`👤 Generating personalized recommendations for user ${userId}`);
        
        const recommendations = await userBehaviorService.generatePersonalizedRecommendations(
            userId, 
            sessionId
        );
        
        // Filter by requested categories
        const filteredRecommendations = {};
        requestedCategories.forEach(category => {
            if (recommendations[category]) {
                filteredRecommendations[category] = recommendations[category];
            }
        });
        
        res.json({
            success: true,
            userId,
            sessionId,
            recommendations: filteredRecommendations,
            confidenceScore: recommendations.confidenceScore,
            personalizedTiming: recommendations.personalizedTiming,
            generatedAt: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Personalization error:', error);
        res.status(500).json({
            error: 'Failed to generate personalized recommendations',
            details: error.message
        });
    }
});

/**
 * GET /api/user-behavior/analytics/sessions
 * Get session analytics and behavior patterns
 * 
 * Query params:
 * - userId: specific user (optional)
 * - timeframe: 1d, 7d, 30d (default 7d)
 * - deviceType: desktop, mobile, tablet (optional)
 * - limit: number of results (default 50)
 */
router.get('/analytics/sessions', async (req, res) => {
    try {
        const { userId, timeframe = '7d', deviceType, limit = 50 } = req.query;
        
        const timeframeMap = {
            '1d': 1,
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
        
        // Build query with filters
        let query = `
            SELECT 
                session_id,
                user_id,
                device_type,
                duration_seconds,
                page_views,
                interaction_count,
                session_quality_score,
                entry_page,
                exit_page,
                referrer_type,
                start_time
            FROM user_sessions
            WHERE start_time >= DATE_SUB(NOW(), INTERVAL ? DAY)
        `;
        
        const params = [days];
        
        if (userId) {
            query += ' AND user_id = ?';
            params.push(userId);
        }
        
        if (deviceType) {
            query += ' AND device_type = ?';
            params.push(deviceType);
        }
        
        query += ' ORDER BY start_time DESC LIMIT ?';
        params.push(parseInt(limit));
        
        const [sessions] = await db.execute(query, params);
        
        // Get aggregated statistics
        const [stats] = await db.execute(`
            SELECT 
                COUNT(*) as total_sessions,
                AVG(duration_seconds) as avg_duration,
                AVG(page_views) as avg_page_views,
                AVG(interaction_count) as avg_interactions,
                AVG(session_quality_score) as avg_quality_score,
                COUNT(DISTINCT user_id) as unique_users
            FROM user_sessions
            WHERE start_time >= DATE_SUB(NOW(), INTERVAL ? DAY)
            ${userId ? 'AND user_id = ?' : ''}
            ${deviceType ? 'AND device_type = ?' : ''}
        `, params.slice(0, -1)); // Remove limit parameter
        
        await db.end();
        
        res.json({
            success: true,
            analytics: {
                sessions,
                statistics: stats[0],
                timeframe,
                filters: { userId, deviceType }
            },
            count: sessions.length
        });
        
    } catch (error) {
        console.error('Session analytics error:', error);
        res.status(500).json({
            error: 'Failed to get session analytics',
            details: error.message
        });
    }
});

/**
 * GET /api/user-behavior/analytics/patterns
 * Get user behavior patterns and insights
 */
router.get('/analytics/patterns', async (req, res) => {
    try {
        const { userId, timeframe = '30d' } = req.query;
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        // Get page transition patterns
        const [transitions] = await db.execute(`
            SELECT 
                from_page_type,
                to_page_type,
                transition_count,
                avg_transition_time,
                conversion_rate,
                confidence_score
            FROM page_transition_patterns
            WHERE confidence_score >= 0.5
            ORDER BY transition_count DESC, confidence_score DESC
            LIMIT 20
        `);
        
        // Get user engagement patterns
        const [engagement] = await db.execute(`
            SELECT 
                device_type,
                HOUR(start_time) as hour_of_day,
                COUNT(*) as session_count,
                AVG(duration_seconds) as avg_duration,
                AVG(session_quality_score) as avg_quality
            FROM user_sessions
            WHERE start_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            ${userId ? 'AND user_id = ?' : ''}
            GROUP BY device_type, HOUR(start_time)
            ORDER BY device_type, hour_of_day
        `, userId ? [userId] : []);
        
        // Get content preferences
        const [contentPrefs] = await db.execute(`
            SELECT 
                page_type,
                COUNT(*) as visit_count,
                AVG(time_on_page) as avg_time_on_page,
                AVG(scroll_depth) as avg_scroll_depth
            FROM user_behavior_events
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
              AND event_type = 'page_view'
              ${userId ? 'AND user_id = ?' : ''}
            GROUP BY page_type
            ORDER BY visit_count DESC
        `, userId ? [userId] : []);
        
        await db.end();
        
        // Process patterns into insights
        const patterns = {
            navigation: {
                common_transitions: transitions,
                conversion_paths: transitions.filter(t => t.conversion_rate > 0.5)
            },
            temporal: {
                engagement_by_hour: processEngagementByHour(engagement),
                peak_usage_times: findPeakUsageTimes(engagement)
            },
            content: {
                preferences: contentPrefs,
                engagement_scores: calculateContentEngagement(contentPrefs)
            }
        };
        
        // Generate insights
        const insights = generateBehaviorInsights(patterns);
        
        res.json({
            success: true,
            patterns,
            insights,
            metadata: {
                userId,
                timeframe,
                generatedAt: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Pattern analytics error:', error);
        res.status(500).json({
            error: 'Failed to get behavior patterns',
            details: error.message
        });
    }
});

/**
 * GET /api/user-behavior/analytics/prefetch
 * Get prefetch effectiveness analytics
 */
router.get('/analytics/prefetch', async (req, res) => {
    try {
        const { timeframe = '7d' } = req.query;
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        // Get prefetch effectiveness summary
        const [effectiveness] = await db.execute(`
            SELECT * FROM v_prefetch_effectiveness
        `);
        
        // Get prediction accuracy
        const [accuracy] = await db.execute(`
            SELECT * FROM v_prediction_accuracy_tracking
        `);
        
        // Get user benefit analysis
        const [userBenefits] = await db.execute(`
            SELECT 
                CASE 
                    WHEN access_time_after_prefetch <= 10 THEN 'immediate'
                    WHEN access_time_after_prefetch <= 60 THEN 'quick'
                    WHEN access_time_after_prefetch <= 300 THEN 'delayed'
                    ELSE 'very_delayed'
                END as access_category,
                COUNT(*) as count,
                AVG(predicted_confidence) as avg_confidence,
                SUM(bandwidth_saved) / 1024 / 1024 as bandwidth_saved_mb
            FROM prefetch_executions
            WHERE executed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
              AND user_accessed = TRUE
            GROUP BY access_category
            ORDER BY count DESC
        `);
        
        await db.end();
        
        res.json({
            success: true,
            analytics: {
                effectiveness,
                predictionAccuracy: accuracy,
                userBenefits,
                summary: {
                    totalPrefetches: effectiveness.reduce((sum, e) => sum + e.total_prefetches, 0),
                    avgSuccessRate: effectiveness.length > 0 
                        ? effectiveness.reduce((sum, e) => sum + (e.successful_prefetches / e.total_prefetches), 0) / effectiveness.length
                        : 0,
                    totalBandwidthSaved: effectiveness.reduce((sum, e) => sum + parseFloat(e.total_bandwidth_saved_mb || 0), 0)
                }
            },
            metadata: {
                timeframe,
                generatedAt: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Prefetch analytics error:', error);
        res.status(500).json({
            error: 'Failed to get prefetch analytics',
            details: error.message
        });
    }
});

/**
 * POST /api/user-behavior/feedback
 * Submit user feedback on predictions/prefetch effectiveness
 * 
 * Body: {
 *   "sessionId": "session456",
 *   "predictionId": "pred123",
 *   "feedback": "helpful|not_helpful|wrong",
 *   "details": "Additional feedback details"
 * }
 */
router.post('/feedback', async (req, res) => {
    try {
        const { sessionId, predictionId, feedback, details } = req.body;
        
        if (!sessionId || !feedback) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['sessionId', 'feedback']
            });
        }
        
        const validFeedback = ['helpful', 'not_helpful', 'wrong'];
        if (!validFeedback.includes(feedback)) {
            return res.status(400).json({
                error: 'Invalid feedback value',
                validValues: validFeedback
            });
        }
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        // Store feedback
        await db.execute(`
            INSERT INTO user_behavior_feedback (
                session_id, 
                prediction_id, 
                feedback_type, 
                feedback_details,
                created_at
            ) VALUES (?, ?, ?, ?, NOW())
        `, [sessionId, predictionId, feedback, details]);
        
        await db.end();
        
        res.json({
            success: true,
            message: 'Feedback submitted successfully',
            sessionId,
            feedback
        });
        
    } catch (error) {
        console.error('Feedback submission error:', error);
        res.status(500).json({
            error: 'Failed to submit feedback',
            details: error.message
        });
    }
});

// Helper functions
function getDeviceType(userAgent) {
    if (!userAgent) return 'desktop';
    
    const ua = userAgent.toLowerCase();
    
    if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
        return 'mobile';
    } else if (/tablet|ipad|playbook|silk/i.test(ua)) {
        return 'tablet';
    } else {
        return 'desktop';
    }
}

function processEngagementByHour(engagement) {
    const hourlyData = new Array(24).fill(0).map(() => ({
        hour: 0,
        sessions: 0,
        avg_duration: 0,
        avg_quality: 0,
        devices: {}
    }));
    
    engagement.forEach(row => {
        const hour = row.hour_of_day;
        if (hour >= 0 && hour < 24) {
            hourlyData[hour].hour = hour;
            hourlyData[hour].sessions += row.session_count;
            hourlyData[hour].avg_duration += row.avg_duration * row.session_count;
            hourlyData[hour].avg_quality += row.avg_quality * row.session_count;
            hourlyData[hour].devices[row.device_type] = row.session_count;
        }
    });
    
    // Calculate weighted averages
    hourlyData.forEach(data => {
        if (data.sessions > 0) {
            data.avg_duration = data.avg_duration / data.sessions;
            data.avg_quality = data.avg_quality / data.sessions;
        }
    });
    
    return hourlyData;
}

function findPeakUsageTimes(engagement) {
    const hourlyTotals = new Array(24).fill(0);
    
    engagement.forEach(row => {
        hourlyTotals[row.hour_of_day] += row.session_count;
    });
    
    const maxSessions = Math.max(...hourlyTotals);
    const threshold = maxSessions * 0.7; // Peak if > 70% of max
    
    const peakHours = [];
    hourlyTotals.forEach((count, hour) => {
        if (count > threshold) {
            peakHours.push({ hour, sessions: count });
        }
    });
    
    return peakHours;
}

function calculateContentEngagement(contentPrefs) {
    return contentPrefs.map(content => ({
        ...content,
        engagement_score: (
            (content.visit_count * 0.4) +
            (content.avg_time_on_page * 0.01) +
            (content.avg_scroll_depth * 0.5)
        ).toFixed(2)
    }));
}

function generateBehaviorInsights(patterns) {
    const insights = [];
    
    // Navigation insights
    const topTransition = patterns.navigation.common_transitions[0];
    if (topTransition) {
        insights.push({
            type: 'navigation',
            title: 'Most Common User Flow',
            description: `Users frequently navigate from ${topTransition.from_page_type} to ${topTransition.to_page_type}`,
            confidence: topTransition.confidence_score,
            recommendation: 'Consider optimizing this transition with predictive loading'
        });
    }
    
    // Temporal insights
    if (patterns.temporal.peak_usage_times.length > 0) {
        const peakHour = patterns.temporal.peak_usage_times[0];
        insights.push({
            type: 'temporal',
            title: 'Peak Usage Time',
            description: `Highest activity occurs at ${peakHour.hour}:00 with ${peakHour.sessions} sessions`,
            recommendation: 'Schedule cache warming and resource optimization for peak hours'
        });
    }
    
    // Content insights
    const topContent = patterns.content.engagement_scores[0];
    if (topContent) {
        insights.push({
            type: 'content',
            title: 'Most Engaging Content',
            description: `${topContent.page_type} pages have highest engagement (${topContent.engagement_score} score)`,
            recommendation: 'Prioritize this content type for prefetching strategies'
        });
    }
    
    return insights;
}

// Error handling middleware
router.use((error, req, res, next) => {
    console.error('User Behavior API Error:', error);
    res.status(500).json({
        error: 'Internal server error in User Behavior API',
        details: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    });
});

module.exports = router;