/**
 * User Engagement Optimization API Routes
 * 
 * RESTful API endpoints for predictive user engagement, personalization,
 * and journey optimization with real-time analytics and ML-based insights.
 */

const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

// Initialize User Engagement Optimization Service
let engagementOptimizationService = null;

async function initializeService() {
    if (!engagementOptimizationService) {
        const UserEngagementOptimizationService = require('../../src/services/UserEngagementOptimizationService');
        
        // Create database connection for the service
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        engagementOptimizationService = new UserEngagementOptimizationService(db);
        await engagementOptimizationService.initialize();
    }
    return engagementOptimizationService;
}

// Middleware to ensure service is initialized
async function ensureServiceReady(req, res, next) {
    try {
        await initializeService();
        next();
    } catch (error) {
        console.error('Failed to initialize User Engagement Optimization Service:', error);
        res.status(503).json({
            error: 'User Engagement Optimization Service unavailable',
            details: error.message
        });
    }
}

/**
 * GET /api/user-engagement-optimization/health
 * Get service health status and performance metrics
 */
router.get('/health', ensureServiceReady, async (req, res) => {
    try {
        const health = await engagementOptimizationService.getServiceHealthStatus();
        res.json(health);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get health status',
            details: error.message
        });
    }
});

/**
 * POST /api/user-engagement-optimization/predict/:userId
 * Generate comprehensive engagement prediction for a user
 * 
 * Body: {
 *   "context": {
 *     "session": { "source": "direct", "device": "desktop" },
 *     "journey_context": { "current_path": "/gallery", "goal": "engagement" },
 *     "temporal_context": { "time_of_day": "evening", "day_of_week": "friday" }
 *   },
 *   "options": {
 *     "forceRefresh": false,
 *     "includePredictions": ["churn_risk", "ltv", "engagement_score"],
 *     "personalizationLevel": "full"
 *   }
 * }
 */
router.post('/predict/:userId', ensureServiceReady, async (req, res) => {
    try {
        const { userId } = req.params;
        const { context = {}, options = {} } = req.body;
        
        if (!userId) {
            return res.status(400).json({
                error: 'Missing required parameter',
                required: ['userId']
            });
        }
        
        console.log(`🔮 Generating engagement prediction for user: ${userId}`);
        
        const prediction = await engagementOptimizationService.predictUserEngagement(
            userId, 
            { ...context, ...options }
        );
        
        res.json({
            success: !prediction.error,
            ...prediction
        });
        
    } catch (error) {
        console.error('Engagement prediction error:', error);
        res.status(500).json({
            error: 'Failed to generate engagement prediction',
            details: error.message
        });
    }
});

/**
 * POST /api/user-engagement-optimization/personalize/:userId
 * Apply real-time personalization to user experience
 * 
 * Body: {
 *   "requestContext": {
 *     "page": "/gallery",
 *     "session": { "duration": 300, "page_views": 5 },
 *     "device": { "type": "mobile", "screen_size": "small" },
 *     "user_state": { "mood": "exploring", "intent": "browsing" }
 *   },
 *   "personalizationTypes": ["content", "interface", "communication"],
 *   "options": {
 *     "realtimeAdaptation": true,
 *     "contextAwareness": true
 *   }
 * }
 */
router.post('/personalize/:userId', ensureServiceReady, async (req, res) => {
    try {
        const { userId } = req.params;
        const { requestContext = {}, personalizationTypes = [], options = {} } = req.body;
        
        if (!userId) {
            return res.status(400).json({
                error: 'Missing required parameter',
                required: ['userId']
            });
        }
        
        console.log(`🎨 Applying personalization for user: ${userId}`);
        
        const personalization = await engagementOptimizationService.applyPersonalization(
            userId, 
            { ...requestContext, personalizationTypes, ...options }
        );
        
        res.json({
            success: true,
            ...personalization
        });
        
    } catch (error) {
        console.error('Personalization error:', error);
        res.status(500).json({
            error: 'Failed to apply personalization',
            details: error.message
        });
    }
});

/**
 * POST /api/user-engagement-optimization/optimize-journey/:userId
 * Optimize user journey for specific goals
 * 
 * Body: {
 *   "currentPath": "/gallery/premium",
 *   "goalType": "conversion",
 *   "journeyContext": {
 *     "entry_point": "social_media",
 *     "previous_pages": ["/home", "/gallery"],
 *     "time_on_current_page": 120
 *   },
 *   "constraints": {
 *     "max_steps": 3,
 *     "preserve_user_intent": true
 *   }
 * }
 */
router.post('/optimize-journey/:userId', ensureServiceReady, async (req, res) => {
    try {
        const { userId } = req.params;
        const { currentPath, goalType = 'engagement', journeyContext = {}, constraints = {} } = req.body;
        
        if (!userId || !currentPath) {
            return res.status(400).json({
                error: 'Missing required parameters',
                required: ['userId', 'currentPath']
            });
        }
        
        const validGoalTypes = ['engagement', 'conversion', 'retention', 'feature_adoption', 'satisfaction'];
        if (!validGoalTypes.includes(goalType)) {
            return res.status(400).json({
                error: 'Invalid goal type',
                valid_options: validGoalTypes
            });
        }
        
        console.log(`🛤️ Optimizing journey for user ${userId}, goal: ${goalType}`);
        
        const optimization = await engagementOptimizationService.optimizeUserJourney(
            userId, 
            currentPath, 
            goalType
        );
        
        res.json({
            success: true,
            ...optimization
        });
        
    } catch (error) {
        console.error('Journey optimization error:', error);
        res.status(500).json({
            error: 'Failed to optimize user journey',
            details: error.message
        });
    }
});

/**
 * GET /api/user-engagement-optimization/analytics
 * Get comprehensive engagement analytics and metrics
 * 
 * Query params:
 * - timeframe: 24h, 7d, 30d (default 24h)
 * - metrics: comma-separated list of metrics to include
 * - segment: filter by user segment
 */
router.get('/analytics', ensureServiceReady, async (req, res) => {
    try {
        const { timeframe = '24h', metrics, segment } = req.query;
        
        const validTimeframes = ['24h', '7d', '30d', '90d'];
        if (!validTimeframes.includes(timeframe)) {
            return res.status(400).json({
                error: 'Invalid timeframe',
                valid_options: validTimeframes
            });
        }
        
        console.log(`📊 Generating engagement analytics for timeframe: ${timeframe}`);
        
        const analytics = await engagementOptimizationService.monitorEngagementMetrics(timeframe);
        
        // Filter metrics if specified
        if (metrics) {
            const requestedMetrics = metrics.split(',').map(m => m.trim());
            const filteredAnalytics = this.filterAnalyticsByMetrics(analytics, requestedMetrics);
            return res.json({ success: true, ...filteredAnalytics });
        }
        
        res.json({
            success: true,
            ...analytics
        });
        
    } catch (error) {
        console.error('Analytics generation error:', error);
        res.status(500).json({
            error: 'Failed to generate engagement analytics',
            details: error.message
        });
    }
});

/**
 * GET /api/user-engagement-optimization/user/:userId/profile
 * Get detailed user engagement profile and insights
 * 
 * Query params:
 * - include_predictions: include future predictions (default true)
 * - include_history: include behavior history (default true)
 * - timeframe: historical data timeframe (default 30d)
 */
router.get('/user/:userId/profile', async (req, res) => {
    try {
        const { userId } = req.params;
        const { 
            include_predictions = 'true', 
            include_history = 'true', 
            timeframe = '30d' 
        } = req.query;
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        // Get current engagement score
        const [engagementScore] = await db.execute(`
            SELECT * FROM user_engagement_scores 
            WHERE user_id = ? 
            ORDER BY updated_at DESC 
            LIMIT 1
        `, [userId]);
        
        // Get user segmentation
        const [segmentation] = await db.execute(`
            SELECT * FROM user_segmentation 
            WHERE user_id = ? 
            ORDER BY last_calculated DESC
        `, [userId]);
        
        let predictions = [];
        if (include_predictions === 'true') {
            const [predictionResults] = await db.execute(`
                SELECT * FROM engagement_predictions 
                WHERE user_id = ? 
                  AND (expires_at IS NULL OR expires_at > NOW())
                ORDER BY created_at DESC 
                LIMIT 10
            `, [userId]);
            predictions = predictionResults;
        }
        
        let behaviorHistory = [];
        if (include_history === 'true') {
            const days = timeframe === '7d' ? 7 : timeframe === '90d' ? 90 : 30;
            const [behaviorResults] = await db.execute(`
                SELECT behavior_type, COUNT(*) as count, 
                       AVG(engagement_value) as avg_engagement,
                       MAX(created_at) as last_occurrence
                FROM user_behavior_analytics 
                WHERE user_id = ? 
                  AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                GROUP BY behavior_type
                ORDER BY count DESC
            `, [userId, days]);
            behaviorHistory = behaviorResults;
        }
        
        // Get recent personalization applications
        const [personalizationHistory] = await db.execute(`
            SELECT personalization_type, personalization_strategy,
                   effectiveness_score, is_successful,
                   applied_at
            FROM personalization_applications 
            WHERE user_id = ? 
            ORDER BY applied_at DESC 
            LIMIT 10
        `, [userId]);
        
        await db.end();
        
        const profile = {
            user_id: parseInt(userId),
            engagement_overview: engagementScore[0] || null,
            segmentation: segmentation || [],
            predictions: predictions,
            behavior_history: behaviorHistory,
            personalization_history: personalizationHistory,
            profile_generated_at: new Date().toISOString()
        };
        
        res.json({
            success: true,
            profile: profile
        });
        
    } catch (error) {
        console.error('User profile error:', error);
        res.status(500).json({
            error: 'Failed to get user engagement profile',
            details: error.message
        });
    }
});

/**
 * POST /api/user-engagement-optimization/feedback
 * Submit user feedback on personalization and predictions
 * 
 * Body: {
 *   "userId": 123,
 *   "feedbackType": "personalization_rating",
 *   "feedbackContext": { "personalization_id": 456, "page": "/gallery" },
 *   "feedbackRating": 4,
 *   "feedbackText": "The recommendations were very relevant",
 *   "improvementSuggestions": "Show more variety in content types"
 * }
 */
router.post('/feedback', async (req, res) => {
    try {
        const { 
            userId, 
            feedbackType, 
            feedbackContext = {}, 
            feedbackRating, 
            feedbackText,
            improvementSuggestions 
        } = req.body;
        
        if (!userId || !feedbackType) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['userId', 'feedbackType']
            });
        }
        
        const validFeedbackTypes = [
            'personalization_rating', 
            'recommendation_feedback', 
            'interface_preference', 
            'engagement_improvement', 
            'feature_request'
        ];
        
        if (!validFeedbackTypes.includes(feedbackType)) {
            return res.status(400).json({
                error: 'Invalid feedback type',
                valid_options: validFeedbackTypes
            });
        }
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        // Insert feedback
        await db.execute(`
            INSERT INTO engagement_user_feedback (
                user_id, feedback_type, feedback_context, feedback_rating,
                feedback_text, improvement_suggestions
            ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
            userId,
            feedbackType,
            JSON.stringify(feedbackContext),
            feedbackRating || null,
            feedbackText || null,
            improvementSuggestions || null
        ]);
        
        await db.end();
        
        console.log(`📝 Recorded feedback from user ${userId}: ${feedbackType}`);
        
        res.json({
            success: true,
            message: 'Feedback recorded successfully',
            user_id: userId,
            feedback_type: feedbackType
        });
        
    } catch (error) {
        console.error('Feedback submission error:', error);
        res.status(500).json({
            error: 'Failed to submit feedback',
            details: error.message
        });
    }
});

/**
 * GET /api/user-engagement-optimization/segments
 * Get user segmentation data and statistics
 * 
 * Query params:
 * - segment_type: behavioral, value, lifecycle (default all)
 * - include_stats: include segment statistics (default true)
 */
router.get('/segments', async (req, res) => {
    try {
        const { segment_type, include_stats = 'true' } = req.query;
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        let query = `
            SELECT 
                segmentation_type,
                primary_segment,
                COUNT(*) as user_count,
                AVG(segment_confidence) as avg_confidence,
                personalization_priority,
                MAX(last_calculated) as last_updated
            FROM user_segmentation
        `;
        const params = [];
        
        if (segment_type) {
            query += ' WHERE segmentation_type = ?';
            params.push(segment_type);
        }
        
        query += ' GROUP BY segmentation_type, primary_segment, personalization_priority';
        query += ' ORDER BY segmentation_type, user_count DESC';
        
        const [segments] = await db.execute(query, params);
        
        let statistics = null;
        if (include_stats === 'true') {
            const [statsResults] = await db.execute(`
                SELECT 
                    COUNT(DISTINCT user_id) as total_segmented_users,
                    COUNT(DISTINCT segmentation_type) as segmentation_types,
                    COUNT(DISTINCT primary_segment) as unique_segments,
                    AVG(segment_confidence) as overall_avg_confidence
                FROM user_segmentation
                WHERE last_calculated >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            `);
            statistics = statsResults[0];
        }
        
        await db.end();
        
        res.json({
            success: true,
            segments: segments,
            statistics: statistics,
            generated_at: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Segments retrieval error:', error);
        res.status(500).json({
            error: 'Failed to get segmentation data',
            details: error.message
        });
    }
});

/**
 * POST /api/user-engagement-optimization/test
 * Test engagement optimization with sample user data
 */
router.post('/test', ensureServiceReady, async (req, res) => {
    try {
        const sampleUserId = 'test_' + Date.now();
        const sampleContext = {
            session: { source: 'test', device: 'desktop' },
            journey_context: { current_path: '/gallery', goal: 'engagement' },
            temporal_context: { time_of_day: 'morning', day_of_week: 'monday' }
        };
        
        console.log('🧪 Running engagement optimization test with sample data');
        
        const prediction = await engagementOptimizationService.predictUserEngagement(
            sampleUserId, 
            { ...sampleContext, forceRefresh: true }
        );
        
        const personalization = await engagementOptimizationService.applyPersonalization(
            sampleUserId,
            sampleContext
        );
        
        res.json({
            success: true,
            test_user_id: sampleUserId,
            test_context: sampleContext,
            prediction_result: prediction,
            personalization_result: personalization,
            message: 'Engagement optimization test completed successfully'
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
    console.error('User Engagement Optimization API Error:', error);
    res.status(500).json({
        error: 'Internal server error in User Engagement Optimization API',
        details: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    });
});

module.exports = router;