/**
 * Intelligent Content Recommendation API Routes
 * 
 * RESTful API endpoints for AI-powered content recommendations using collaborative filtering,
 * content-based filtering, and hybrid approaches. Provides personalized recommendations,
 * performance analytics, and A/B testing capabilities.
 */

const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

// Initialize Intelligent Recommendation Service
let recommendationService = null;

async function initializeService() {
    if (!recommendationService) {
        const IntelligentRecommendationService = require('../../src/services/IntelligentRecommendationService');
        recommendationService = new IntelligentRecommendationService();
        await recommendationService.initialize();
    }
    return recommendationService;
}

// Middleware to ensure service is initialized
async function ensureServiceReady(req, res, next) {
    try {
        await initializeService();
        next();
    } catch (error) {
        console.error('Failed to initialize Intelligent Recommendation Service:', error);
        res.status(503).json({
            error: 'Intelligent Recommendation Service unavailable',
            details: error.message
        });
    }
}

/**
 * GET /api/intelligent-recommendations/health
 * Get service health status and model performance
 */
router.get('/health', ensureServiceReady, async (req, res) => {
    try {
        const health = await recommendationService.getHealthStatus();
        res.json(health);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get health status',
            details: error.message
        });
    }
});

/**
 * POST /api/intelligent-recommendations/generate
 * Generate personalized recommendations for a user
 * 
 * Body: {
 *   "userId": "user123",
 *   "type": "homepage_feed" (optional - homepage_feed, gallery_related, user_profile_suggested),
 *   "count": 20 (optional - number of recommendations),
 *   "excludeViewed": true (optional - exclude previously viewed items),
 *   "includeExplanations": false (optional - include recommendation explanations),
 *   "contextItems": [] (optional - array of item IDs for context),
 *   "filters": {} (optional - category, tag, or other filters)
 * }
 */
router.post('/generate', ensureServiceReady, async (req, res) => {
    try {
        const {
            userId,
            type = 'homepage_feed',
            count = 20,
            excludeViewed = true,
            includeExplanations = false,
            contextItems = [],
            filters = {}
        } = req.body;
        
        if (!userId) {
            return res.status(400).json({
                error: 'Missing required field: userId'
            });
        }
        
        console.log(`🎯 Generating ${count} recommendations for user ${userId} (type: ${type})`);
        
        const recommendations = await recommendationService.generateRecommendations(userId, {
            type,
            count: parseInt(count),
            excludeViewed,
            includeExplanations,
            contextItems,
            filters
        });
        
        res.json({
            success: true,
            ...recommendations,
            requestInfo: {
                requestedCount: parseInt(count),
                type,
                includeExplanations,
                filtersApplied: Object.keys(filters).length > 0
            }
        });
        
    } catch (error) {
        console.error('Recommendation generation error:', error);
        res.status(500).json({
            error: 'Failed to generate recommendations',
            details: error.message
        });
    }
});

/**
 * GET /api/intelligent-recommendations/user/:userId
 * Get cached recommendations for a specific user
 * 
 * Query params:
 * - type: recommendation type filter (optional)
 * - fresh: force fresh generation (default false)
 */
router.get('/user/:userId', ensureServiceReady, async (req, res) => {
    try {
        const { userId } = req.params;
        const { type, fresh = 'false' } = req.query;
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        if (fresh === 'true') {
            // Generate fresh recommendations
            const freshRecommendations = await recommendationService.generateRecommendations(userId, {
                type: type || 'homepage_feed',
                forceRefresh: true
            });
            
            await db.end();
            return res.json({
                success: true,
                ...freshRecommendations,
                fresh: true
            });
        }
        
        // Get cached recommendations from database
        let query = `
            SELECT 
                gr.recommendation_id,
                gr.recommendation_type,
                gr.algorithm_combination,
                gr.items_recommended,
                gr.diversity_score,
                gr.novelty_score,
                gr.confidence_score,
                gr.user_segment,
                gr.generation_latency_ms,
                gr.created_at,
                gr.expiry_time
            FROM generated_recommendations gr
            WHERE gr.user_id = ?
              AND gr.expiry_time > NOW()
        `;
        
        const params = [userId];
        
        if (type) {
            query += ' AND gr.recommendation_type = ?';
            params.push(type);
        }
        
        query += ' ORDER BY gr.created_at DESC LIMIT 5';
        
        const [recommendations] = await db.execute(query, params);
        
        // Get user profile information
        const [userProfile] = await db.execute(`
            SELECT * FROM v_user_engagement_summary WHERE user_id = ?
        `, [userId]);
        
        await db.end();
        
        const processedRecommendations = recommendations.map(rec => ({
            ...rec,
            algorithm_combination: JSON.parse(rec.algorithm_combination || '{}'),
            items_recommended: JSON.parse(rec.items_recommended || '[]'),
            isExpired: new Date(rec.expiry_time) < new Date(),
            ageMinutes: Math.round((Date.now() - new Date(rec.created_at)) / (1000 * 60))
        }));
        
        res.json({
            success: true,
            userId,
            recommendations: processedRecommendations,
            userProfile: userProfile[0] || null,
            cached: true,
            metadata: {
                recommendationsFound: processedRecommendations.length,
                typeFilter: type,
                generatedAt: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('User recommendations retrieval error:', error);
        res.status(500).json({
            error: 'Failed to get user recommendations',
            details: error.message
        });
    }
});

/**
 * POST /api/intelligent-recommendations/interaction
 * Track user interaction with recommended content
 * 
 * Body: {
 *   "userId": "user123",
 *   "itemId": 456,
 *   "interactionType": "click" (impression, click, view, like, share, conversion, skip, dismiss),
 *   "recommendationContext": {
 *     "algorithm": "hybrid_ensemble",
 *     "score": 0.85,
 *     "rank": 3
 *   },
 *   "sessionId": "session789" (optional),
 *   "pageContext": "homepage_feed" (optional)
 * }
 */
router.post('/interaction', ensureServiceReady, async (req, res) => {
    try {
        const {
            userId,
            itemId,
            interactionType,
            recommendationContext = {},
            sessionId,
            pageContext
        } = req.body;
        
        // Validate required fields
        if (!userId || !itemId || !interactionType) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['userId', 'itemId', 'interactionType']
            });
        }
        
        const validInteractionTypes = [
            'impression', 'click', 'view', 'like', 'share', 'save', 
            'conversion', 'skip', 'dismiss', 'rating'
        ];
        
        if (!validInteractionTypes.includes(interactionType)) {
            return res.status(400).json({
                error: 'Invalid interaction type',
                validTypes: validInteractionTypes
            });
        }
        
        console.log(`📊 Tracking ${interactionType} interaction: user ${userId} → item ${itemId}`);
        
        // Track the interaction
        await recommendationService.trackRecommendationInteraction(
            userId,
            itemId,
            interactionType,
            {
                ...recommendationContext,
                sessionId,
                pageContext,
                timestamp: new Date().toISOString()
            }
        );
        
        res.json({
            success: true,
            message: 'Interaction tracked successfully',
            interaction: {
                userId,
                itemId,
                interactionType,
                trackedAt: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Interaction tracking error:', error);
        res.status(500).json({
            error: 'Failed to track interaction',
            details: error.message
        });
    }
});

/**
 * GET /api/intelligent-recommendations/similar/:itemId
 * Get items similar to a specific item
 * 
 * Query params:
 * - count: number of similar items (default 12)
 * - method: similarity method (content_based, collaborative, hybrid)
 * - minSimilarity: minimum similarity threshold (default 0.3)
 */
router.get('/similar/:itemId', async (req, res) => {
    try {
        const { itemId } = req.params;
        const { count = 12, method = 'hybrid', minSimilarity = 0.3 } = req.query;
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        let query = `
            SELECT 
                ism.item_b_id as similar_item_id,
                ism.similarity_score,
                ism.similarity_method,
                ism.content_similarity,
                ism.collaborative_similarity,
                ism.common_users_count,
                ism.confidence_score,
                gi.title,
                gi.description,
                gi.image_url,
                gi.category,
                gi.tags,
                ifv.quality_score,
                ifv.popularity_score
            FROM item_similarity_matrix ism
            JOIN gallery_images gi ON ism.item_b_id = gi.id
            LEFT JOIN item_feature_vectors ifv ON ism.item_b_id = ifv.item_id
            WHERE ism.item_a_id = ?
              AND ism.similarity_score >= ?
              AND gi.is_active = TRUE
        `;
        
        const params = [parseInt(itemId), parseFloat(minSimilarity)];
        
        if (method !== 'hybrid') {
            if (method === 'content_based') {
                query += ' AND ism.content_similarity IS NOT NULL';
            } else if (method === 'collaborative') {
                query += ' AND ism.collaborative_similarity IS NOT NULL';
            }
        }
        
        query += ' ORDER BY ism.similarity_score DESC, ism.confidence_score DESC LIMIT ?';
        params.push(parseInt(count));
        
        const [similarItems] = await db.execute(query, params);
        
        // Get source item details
        const [sourceItem] = await db.execute(`
            SELECT gi.*, ifv.quality_score, ifv.popularity_score
            FROM gallery_images gi
            LEFT JOIN item_feature_vectors ifv ON gi.id = ifv.item_id
            WHERE gi.id = ?
        `, [itemId]);
        
        await db.end();
        
        res.json({
            success: true,
            sourceItem: sourceItem[0] || null,
            similarItems: similarItems.map(item => ({
                ...item,
                tags: item.tags ? JSON.parse(item.tags) : [],
                similarity_explanation: generateSimilarityExplanation(item, method)
            })),
            metadata: {
                method,
                minSimilarity: parseFloat(minSimilarity),
                requestedCount: parseInt(count),
                foundCount: similarItems.length,
                generatedAt: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Similar items retrieval error:', error);
        res.status(500).json({
            error: 'Failed to get similar items',
            details: error.message
        });
    }
});

/**
 * GET /api/intelligent-recommendations/trending
 * Get trending content recommendations
 * 
 * Query params:
 * - timeframe: 1d, 3d, 7d, 30d (default 7d)
 * - category: filter by category (optional)
 * - count: number of items (default 20)
 * - minTrendingScore: minimum trending score threshold (default 10.0)
 */
router.get('/trending', async (req, res) => {
    try {
        const { 
            timeframe = '7d', 
            category, 
            count = 20, 
            minTrendingScore = 10.0 
        } = req.query;
        
        const timeframeMap = {
            '1d': 1,
            '3d': 3,
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
        
        let query = `
            SELECT 
                tc.*,
                gi.description,
                gi.image_url,
                gi.tags,
                gi.created_at as item_created_at,
                DATEDIFF(NOW(), gi.created_at) as days_old
            FROM v_trending_content tc
            JOIN gallery_images gi ON tc.item_id = gi.id
            WHERE tc.metric_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
              AND tc.trending_score >= ?
              AND gi.is_active = TRUE
        `;
        
        const params = [days, parseFloat(minTrendingScore)];
        
        if (category) {
            query += ' AND tc.category = ?';
            params.push(category);
        }
        
        query += ' ORDER BY tc.trending_score DESC, tc.velocity_score DESC LIMIT ?';
        params.push(parseInt(count));
        
        const [trendingItems] = await db.execute(query, params);
        
        // Get trending categories summary
        const [categorySummary] = await db.execute(`
            SELECT 
                category,
                COUNT(*) as item_count,
                AVG(trending_score) as avg_trending_score,
                SUM(view_count) as total_views
            FROM v_trending_content
            WHERE metric_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
              AND trending_score >= ?
            GROUP BY category
            ORDER BY avg_trending_score DESC
        `, [days, parseFloat(minTrendingScore)]);
        
        await db.end();
        
        res.json({
            success: true,
            trendingItems: trendingItems.map(item => ({
                ...item,
                tags: item.tags ? JSON.parse(item.tags) : [],
                trend_momentum: calculateTrendMomentum(item),
                freshness_score: calculateFreshnessScore(item.days_old),
                recommendation_reason: generateTrendingReason(item)
            })),
            categorySummary,
            metadata: {
                timeframe,
                category,
                minTrendingScore: parseFloat(minTrendingScore),
                requestedCount: parseInt(count),
                foundCount: trendingItems.length,
                generatedAt: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Trending content retrieval error:', error);
        res.status(500).json({
            error: 'Failed to get trending content',
            details: error.message
        });
    }
});

/**
 * GET /api/intelligent-recommendations/analytics
 * Get recommendation system performance analytics
 * 
 * Query params:
 * - timeframe: 1d, 7d, 30d (default 7d)
 * - algorithm: specific algorithm filter (optional)
 * - userId: specific user filter (optional)
 * - recommendationType: recommendation type filter (optional)
 */
router.get('/analytics', async (req, res) => {
    try {
        const { timeframe = '7d', algorithm, userId, recommendationType } = req.query;
        
        const analytics = await recommendationService.getRecommendationAnalytics(
            timeframe,
            userId
        );
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        // Get algorithm performance comparison
        const [algorithmPerformance] = await db.execute(`
            SELECT * FROM v_recommendation_performance
            ${algorithm ? 'WHERE recommendation_algorithm = ?' : ''}
            ORDER BY engagement_rate DESC, click_through_rate DESC
        `, algorithm ? [algorithm] : []);
        
        // Get user engagement distribution
        const [userEngagement] = await db.execute(`
            SELECT 
                engagement_score_range,
                COUNT(*) as user_count,
                AVG(total_interactions) as avg_interactions
            FROM (
                SELECT 
                    user_id,
                    total_interactions,
                    CASE 
                        WHEN engagement_score >= 80 THEN '80-100 (High)'
                        WHEN engagement_score >= 60 THEN '60-79 (Medium-High)'
                        WHEN engagement_score >= 40 THEN '40-59 (Medium)'
                        WHEN engagement_score >= 20 THEN '20-39 (Low-Medium)'
                        ELSE '0-19 (Low)'
                    END as engagement_score_range
                FROM v_user_engagement_summary
                WHERE last_interaction >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            ) engagement_data
            GROUP BY engagement_score_range
            ORDER BY MIN(CASE engagement_score_range
                WHEN '80-100 (High)' THEN 5
                WHEN '60-79 (Medium-High)' THEN 4  
                WHEN '40-59 (Medium)' THEN 3
                WHEN '20-39 (Low-Medium)' THEN 2
                ELSE 1
            END) DESC
        `);
        
        // Get recommendation type performance
        const [typePerformance] = await db.execute(`
            SELECT 
                gr.recommendation_type,
                COUNT(*) as total_generated,
                AVG(gr.confidence_score) as avg_confidence,
                AVG(gr.diversity_score) as avg_diversity,
                AVG(gr.novelty_score) as avg_novelty,
                AVG(gr.generation_latency_ms) as avg_latency_ms,
                COUNT(DISTINCT gr.user_id) as unique_users
            FROM generated_recommendations gr
            WHERE gr.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
              ${recommendationType ? 'AND gr.recommendation_type = ?' : ''}
            GROUP BY gr.recommendation_type
            ORDER BY total_generated DESC
        `, recommendationType ? [recommendationType] : []);
        
        await db.end();
        
        // Generate insights
        const insights = generateAnalyticsInsights(
            analytics.analytics,
            algorithmPerformance,
            userEngagement,
            typePerformance
        );
        
        res.json({
            success: true,
            analytics: {
                ...analytics,
                algorithmComparison: algorithmPerformance.map(alg => ({
                    ...alg,
                    performance_grade: getPerformanceGrade(alg.engagement_rate),
                    efficiency_score: calculateEfficiencyScore(alg)
                })),
                userEngagementDistribution: userEngagement,
                recommendationTypePerformance: typePerformance.map(type => ({
                    ...type,
                    quality_score: calculateQualityScore(type),
                    efficiency_rating: getRatingFromLatency(type.avg_latency_ms)
                })),
                insights
            },
            metadata: {
                timeframe,
                algorithm,
                userId,
                recommendationType,
                generatedAt: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Analytics retrieval error:', error);
        res.status(500).json({
            error: 'Failed to get recommendation analytics',
            details: error.message
        });
    }
});

/**
 * PUT /api/intelligent-recommendations/user/:userId/preferences
 * Update user preference profile
 * 
 * Body: {
 *   "categoryPreferences": {"portraits": 0.8, "nature": 0.6},
 *   "diversityPreference": 0.7,
 *   "noveltyPreference": 0.5,
 *   "qualityThreshold": 0.6
 * }
 */
router.put('/user/:userId/preferences', async (req, res) => {
    try {
        const { userId } = req.params;
        const {
            categoryPreferences = {},
            diversityPreference = 0.5,
            noveltyPreference = 0.5,
            qualityThreshold = 0.6
        } = req.body;
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        // Update user preferences
        await db.execute(`
            INSERT INTO user_preference_profiles (
                user_id,
                category_preferences,
                diversity_preference,
                novelty_preference,
                quality_threshold,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
                category_preferences = VALUES(category_preferences),
                diversity_preference = VALUES(diversity_preference),
                novelty_preference = VALUES(novelty_preference),
                quality_threshold = VALUES(quality_threshold),
                updated_at = VALUES(updated_at)
        `, [
            userId,
            JSON.stringify(categoryPreferences),
            parseFloat(diversityPreference),
            parseFloat(noveltyPreference),
            parseFloat(qualityThreshold)
        ]);
        
        // Invalidate user's recommendation cache
        if (recommendationService) {
            await recommendationService.invalidateRecommendationCaches(userId);
        }
        
        await db.end();
        
        res.json({
            success: true,
            message: 'User preferences updated successfully',
            userId,
            preferences: {
                categoryPreferences,
                diversityPreference: parseFloat(diversityPreference),
                noveltyPreference: parseFloat(noveltyPreference),
                qualityThreshold: parseFloat(qualityThreshold)
            },
            updatedAt: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('User preferences update error:', error);
        res.status(500).json({
            error: 'Failed to update user preferences',
            details: error.message
        });
    }
});

// Helper functions
function generateSimilarityExplanation(item, method) {
    const explanations = [];
    
    if (method === 'content_based' || method === 'hybrid') {
        if (item.content_similarity > 0.8) {
            explanations.push('Very similar visual style and content');
        } else if (item.content_similarity > 0.6) {
            explanations.push('Similar visual characteristics');
        }
    }
    
    if (method === 'collaborative' || method === 'hybrid') {
        if (item.common_users_count > 10) {
            explanations.push(`Liked by ${item.common_users_count} users with similar taste`);
        } else if (item.common_users_count > 3) {
            explanations.push('Popular among users with similar preferences');
        }
    }
    
    if (explanations.length === 0) {
        explanations.push('Similar based on content analysis');
    }
    
    return explanations.join('; ');
}

function calculateTrendMomentum(item) {
    const trendingScore = item.trending_score || 0;
    const velocityScore = item.velocity_score || 0;
    
    if (trendingScore > 50 && velocityScore > 5) return 'explosive';
    if (trendingScore > 30 && velocityScore > 3) return 'strong';
    if (trendingScore > 15 && velocityScore > 1) return 'moderate';
    return 'steady';
}

function calculateFreshnessScore(daysOld) {
    if (daysOld <= 1) return 1.0;
    if (daysOld <= 3) return 0.9;
    if (daysOld <= 7) return 0.8;
    if (daysOld <= 30) return 0.6;
    return 0.4;
}

function generateTrendingReason(item) {
    const reasons = [];
    
    if (item.velocity_score > 5) {
        reasons.push('rapidly gaining popularity');
    }
    if (item.view_count > 1000) {
        reasons.push(`${item.view_count} views in ${Math.round(item.days_old)} days`);
    }
    if (item.unique_viewers > 500) {
        reasons.push(`${item.unique_viewers} unique viewers`);
    }
    if (item.quality_score > 0.8) {
        reasons.push('high quality content');
    }
    
    return reasons.length > 0 
        ? `Trending because: ${reasons.join(', ')}`
        : 'Currently trending in this category';
}

function getPerformanceGrade(engagementRate) {
    if (engagementRate >= 0.8) return 'A';
    if (engagementRate >= 0.6) return 'B';
    if (engagementRate >= 0.4) return 'C';
    if (engagementRate >= 0.2) return 'D';
    return 'F';
}

function calculateEfficiencyScore(algorithm) {
    const ctr = algorithm.click_through_rate || 0;
    const conversion = algorithm.conversion_rate || 0;
    const engagement = algorithm.engagement_rate || 0;
    
    return Math.round((ctr * 40 + conversion * 30 + engagement * 30) * 100) / 100;
}

function calculateQualityScore(type) {
    const confidence = type.avg_confidence || 0;
    const diversity = type.avg_diversity || 0;
    const novelty = type.avg_novelty || 0;
    
    return Math.round((confidence * 0.5 + diversity * 0.3 + novelty * 0.2) * 100) / 100;
}

function getRatingFromLatency(latencyMs) {
    if (latencyMs <= 100) return 'Excellent';
    if (latencyMs <= 300) return 'Good';
    if (latencyMs <= 500) return 'Fair';
    if (latencyMs <= 1000) return 'Poor';
    return 'Very Poor';
}

function generateAnalyticsInsights(analytics, algorithmPerformance, userEngagement, typePerformance) {
    const insights = [];
    
    // Algorithm performance insights
    const topAlgorithm = algorithmPerformance[0];
    if (topAlgorithm && topAlgorithm.engagement_rate > 0.6) {
        insights.push({
            type: 'positive',
            category: 'algorithm_performance',
            title: 'High-Performing Algorithm',
            description: `${topAlgorithm.recommendation_algorithm} achieving ${(topAlgorithm.engagement_rate * 100).toFixed(1)}% engagement rate`,
            impact: 'recommendation_quality',
            recommendation: 'Consider increasing allocation to this algorithm'
        });
    }
    
    // User engagement insights
    const highEngagementUsers = userEngagement.find(u => u.engagement_score_range.includes('80-100'));
    if (highEngagementUsers && highEngagementUsers.user_count > 100) {
        insights.push({
            type: 'positive',
            category: 'user_engagement',
            title: 'Strong User Engagement',
            description: `${highEngagementUsers.user_count} users in high engagement category`,
            impact: 'user_satisfaction',
            recommendation: 'Analyze patterns of high-engagement users to improve recommendations for others'
        });
    }
    
    // Performance variation insights
    const performanceVariance = algorithmPerformance.length > 1 
        ? Math.max(...algorithmPerformance.map(a => a.engagement_rate)) - 
          Math.min(...algorithmPerformance.map(a => a.engagement_rate))
        : 0;
    
    if (performanceVariance > 0.3) {
        insights.push({
            type: 'warning',
            category: 'algorithm_performance',
            title: 'High Performance Variance',
            description: `${(performanceVariance * 100).toFixed(1)}% difference between best and worst performing algorithms`,
            impact: 'system_efficiency',
            recommendation: 'Consider reallocating traffic from low-performing to high-performing algorithms'
        });
    }
    
    return insights;
}

// Error handling middleware
router.use((error, req, res, next) => {
    console.error('Intelligent Recommendation API Error:', error);
    res.status(500).json({
        error: 'Internal server error in Intelligent Recommendation API',
        details: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    });
});

module.exports = router;