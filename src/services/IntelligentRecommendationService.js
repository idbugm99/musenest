/**
 * Intelligent Content Recommendation Service
 * 
 * This service provides AI-powered content recommendations using advanced machine learning
 * algorithms including collaborative filtering, content-based filtering, and hybrid approaches.
 * 
 * Features:
 * - Collaborative filtering (user-user and item-item similarity)
 * - Content-based recommendations using feature vectors
 * - Hybrid recommendation system combining multiple approaches
 * - Real-time recommendation updates based on user interactions
 * - A/B testing integration for recommendation algorithm optimization
 * - Personalization based on user behavior patterns and preferences
 */

const mysql = require('mysql2/promise');
const Redis = require('redis');
const EventEmitter = require('events');

class IntelligentRecommendationService extends EventEmitter {
    constructor() {
        super();
        
        // Recommendation Algorithm Configuration
        this.algorithmConfig = {
            collaborative_filtering: {
                user_user: {
                    enabled: true,
                    similarity_threshold: 0.3,
                    max_neighbors: 50,
                    weight: 0.4
                },
                item_item: {
                    enabled: true,
                    similarity_threshold: 0.2,
                    max_similar_items: 100,
                    weight: 0.3
                }
            },
            content_based: {
                enabled: true,
                feature_weight: {
                    category: 0.3,
                    tags: 0.25,
                    style: 0.2,
                    color_palette: 0.15,
                    composition: 0.1
                },
                weight: 0.3
            },
            hybrid: {
                enabled: true,
                combination_method: 'weighted_average', // weighted_average, rank_fusion, cascade
                fallback_strategy: 'popular_items'
            }
        };
        
        // User Segmentation for Personalized Recommendations
        this.userSegments = {
            new_user: {
                recommendations: ['trending', 'popular', 'diverse_sampling'],
                algorithm_weights: { collaborative: 0.1, content: 0.5, popularity: 0.4 },
                explanation_style: 'discovery'
            },
            casual_browser: {
                recommendations: ['similar_to_viewed', 'trending', 'curated'],
                algorithm_weights: { collaborative: 0.3, content: 0.4, popularity: 0.3 },
                explanation_style: 'casual'
            },
            engaged_user: {
                recommendations: ['personalized', 'similar_users', 'advanced_taste'],
                algorithm_weights: { collaborative: 0.5, content: 0.3, popularity: 0.2 },
                explanation_style: 'detailed'
            },
            power_user: {
                recommendations: ['niche_discovery', 'early_access', 'collaborative_deep'],
                algorithm_weights: { collaborative: 0.6, content: 0.3, popularity: 0.1 },
                explanation_style: 'expert'
            }
        };
        
        // Content Feature Extractors
        this.featureExtractors = {
            visual: {
                color_palette: true,
                composition_analysis: true,
                style_classification: true,
                object_detection: false // Requires computer vision service
            },
            metadata: {
                category_embedding: true,
                tag_vectorization: true,
                temporal_features: true,
                popularity_signals: true
            },
            interaction: {
                view_duration: true,
                interaction_patterns: true,
                sharing_behavior: true,
                conversion_signals: true
            }
        };
        
        // Recommendation Types
        this.recommendationTypes = {
            homepage_feed: {
                count: 20,
                diversity_factor: 0.7,
                freshness_weight: 0.3,
                explanation_required: false
            },
            gallery_related: {
                count: 12,
                diversity_factor: 0.5,
                freshness_weight: 0.2,
                explanation_required: true
            },
            user_profile_suggested: {
                count: 15,
                diversity_factor: 0.8,
                freshness_weight: 0.4,
                explanation_required: true
            },
            email_digest: {
                count: 10,
                diversity_factor: 0.9,
                freshness_weight: 0.6,
                explanation_required: true
            }
        };
        
        // Real-time Recommendation Cache
        this.recommendationCache = new Map();
        this.userSimilarityCache = new Map();
        this.itemSimilarityCache = new Map();
        this.contentFeaturesCache = new Map();
        
        // ML Model State
        this.models = {
            user_embeddings: null,
            item_embeddings: null,
            content_features: null,
            interaction_matrix: null,
            last_trained: null,
            model_version: '1.0.0'
        };
        
        // Performance Tracking
        this.performanceMetrics = {
            recommendation_latency: [],
            click_through_rates: new Map(),
            conversion_rates: new Map(),
            diversity_scores: [],
            coverage_metrics: new Map()
        };
    }
    
    /**
     * Initialize the intelligent recommendation service
     */
    async initialize() {
        try {
            console.log('🧠 Initializing Intelligent Recommendation Service...');
            
            // Initialize database connection
            this.db = await mysql.createConnection({
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_DATABASE || 'musenest'
            });
            
            // Initialize Redis for recommendation caching
            this.redis = Redis.createClient({
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379
            });
            await this.redis.connect();
            
            // Initialize recommendation-specific Redis (separate DB)
            this.recommendationRedis = Redis.createClient({
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                db: 4 // Use database 4 for recommendations
            });
            await this.recommendationRedis.connect();
            
            // Load user interaction history
            await this.loadUserInteractionMatrix();
            
            // Load content features
            await this.loadContentFeatures();
            
            // Train initial recommendation models
            await this.trainRecommendationModels();
            
            // Start real-time recommendation updates
            this.startRealTimeUpdates();
            
            // Start performance monitoring
            this.startPerformanceMonitoring();
            
            console.log('✅ Intelligent Recommendation Service initialized successfully');
            this.emit('initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize Intelligent Recommendation Service:', error);
            throw error;
        }
    }
    
    /**
     * Generate personalized recommendations for a user
     */
    async generateRecommendations(userId, options = {}) {
        try {
            const {
                type = 'homepage_feed',
                count,
                excludeViewed = true,
                includeExplanations = false,
                contextItems = [],
                filters = {}
            } = options;
            
            const startTime = Date.now();
            const recommendationType = this.recommendationTypes[type] || this.recommendationTypes.homepage_feed;
            const targetCount = count || recommendationType.count;
            
            console.log(`🎯 Generating ${targetCount} recommendations for user ${userId} (type: ${type})`);
            
            // Check cache first
            const cacheKey = `recommendations:${userId}:${type}:${JSON.stringify(filters)}`;
            const cachedRecommendations = await this.recommendationRedis.get(cacheKey);
            
            if (cachedRecommendations && !options.forceRefresh) {
                const cached = JSON.parse(cachedRecommendations);
                console.log('📚 Returning cached recommendations');
                return cached;
            }
            
            // Get user profile and segment
            const userProfile = await this.getUserProfile(userId);
            const userSegment = this.determineUserSegment(userProfile);
            
            // Generate recommendations using hybrid approach
            const recommendations = await this.generateHybridRecommendations(
                userId,
                userProfile,
                userSegment,
                {
                    ...options,
                    type: recommendationType,
                    targetCount,
                    contextItems
                }
            );
            
            // Apply diversity and freshness
            const optimizedRecommendations = await this.optimizeRecommendations(
                recommendations,
                recommendationType,
                userSegment
            );
            
            // Generate explanations if requested
            if (includeExplanations || recommendationType.explanation_required) {
                for (const rec of optimizedRecommendations) {
                    rec.explanation = await this.generateExplanation(rec, userProfile, userSegment);
                }
            }
            
            // Apply filters
            const filteredRecommendations = this.applyFilters(optimizedRecommendations, filters);
            
            // Take top recommendations
            const finalRecommendations = filteredRecommendations.slice(0, targetCount);
            
            // Track performance
            const latency = Date.now() - startTime;
            this.performanceMetrics.recommendation_latency.push(latency);
            
            const result = {
                userId,
                type,
                recommendations: finalRecommendations,
                metadata: {
                    userSegment,
                    algorithmWeights: userSegment.algorithm_weights,
                    totalCandidates: recommendations.length,
                    finalCount: finalRecommendations.length,
                    latency,
                    generatedAt: new Date().toISOString(),
                    cacheExpiry: 30 * 60 // 30 minutes
                }
            };
            
            // Cache recommendations
            await this.recommendationRedis.setEx(
                cacheKey,
                result.metadata.cacheExpiry,
                JSON.stringify(result)
            );
            
            // Log recommendation event
            await this.logRecommendationEvent(userId, result);
            
            console.log(`✅ Generated ${finalRecommendations.length} recommendations in ${latency}ms`);
            
            return result;
            
        } catch (error) {
            console.error('Error generating recommendations:', error);
            return {
                userId,
                type: options.type || 'homepage_feed',
                recommendations: await this.getFallbackRecommendations(userId, options),
                metadata: {
                    error: true,
                    fallback: true,
                    generatedAt: new Date().toISOString()
                }
            };
        }
    }
    
    /**
     * Generate hybrid recommendations using multiple algorithms
     */
    async generateHybridRecommendations(userId, userProfile, userSegment, options) {
        const candidates = new Map(); // itemId -> recommendation object
        
        // Collaborative Filtering Recommendations
        if (this.algorithmConfig.collaborative_filtering.user_user.enabled) {
            const userUserRecs = await this.generateUserBasedCollaborativeFiltering(userId, userProfile);
            this.mergeRecommendations(candidates, userUserRecs, 'user_collaborative', userSegment.algorithm_weights.collaborative * 0.6);
        }
        
        if (this.algorithmConfig.collaborative_filtering.item_item.enabled) {
            const itemItemRecs = await this.generateItemBasedCollaborativeFiltering(userId, userProfile, options.contextItems);
            this.mergeRecommendations(candidates, itemItemRecs, 'item_collaborative', userSegment.algorithm_weights.collaborative * 0.4);
        }
        
        // Content-Based Recommendations
        if (this.algorithmConfig.content_based.enabled) {
            const contentRecs = await this.generateContentBasedRecommendations(userId, userProfile);
            this.mergeRecommendations(candidates, contentRecs, 'content_based', userSegment.algorithm_weights.content);
        }
        
        // Popularity-Based Recommendations (fallback and cold start)
        const popularityRecs = await this.generatePopularityBasedRecommendations(userProfile);
        this.mergeRecommendations(candidates, popularityRecs, 'popularity', userSegment.algorithm_weights.popularity);
        
        // Convert to array and sort by combined score
        const recommendations = Array.from(candidates.values())
            .sort((a, b) => b.combinedScore - a.combinedScore);
        
        return recommendations;
    }
    
    /**
     * Generate user-based collaborative filtering recommendations
     */
    async generateUserBasedCollaborativeFiltering(userId, userProfile) {
        try {
            // Get similar users
            const similarUsers = await this.findSimilarUsers(userId, 50);
            
            if (similarUsers.length === 0) {
                return [];
            }
            
            // Get items liked by similar users that current user hasn't seen
            const candidateItems = new Map();
            
            for (const similarUser of similarUsers) {
                const userItems = await this.getUserLikedItems(similarUser.userId);
                
                for (const item of userItems) {
                    if (!userProfile.viewedItems.has(item.itemId)) {
                        const key = item.itemId;
                        
                        if (!candidateItems.has(key)) {
                            candidateItems.set(key, {
                                itemId: item.itemId,
                                score: 0,
                                supportingUsers: []
                            });
                        }
                        
                        // Weight by user similarity and item rating
                        const weighted_score = similarUser.similarity * (item.rating || 1);
                        candidateItems.get(key).score += weighted_score;
                        candidateItems.get(key).supportingUsers.push({
                            userId: similarUser.userId,
                            similarity: similarUser.similarity,
                            rating: item.rating
                        });
                    }
                }
            }
            
            // Convert to recommendation format
            const recommendations = [];
            for (const [itemId, data] of candidateItems) {
                const itemDetails = await this.getItemDetails(itemId);
                
                recommendations.push({
                    itemId,
                    score: data.score / data.supportingUsers.length, // Normalize by number of supporting users
                    confidence: Math.min(1, data.supportingUsers.length / 5), // Higher confidence with more supporting users
                    algorithm: 'user_collaborative',
                    details: itemDetails,
                    reasoning: {
                        supportingUsers: data.supportingUsers.length,
                        avgSimilarity: data.supportingUsers.reduce((sum, u) => sum + u.similarity, 0) / data.supportingUsers.length
                    }
                });
            }
            
            return recommendations.sort((a, b) => b.score - a.score).slice(0, 100);
            
        } catch (error) {
            console.error('Error in user-based collaborative filtering:', error);
            return [];
        }
    }
    
    /**
     * Generate item-based collaborative filtering recommendations
     */
    async generateItemBasedCollaborativeFiltering(userId, userProfile, contextItems = []) {
        try {
            const recommendations = [];
            
            // Get user's recent interactions as seed items
            const seedItems = contextItems.length > 0 
                ? contextItems 
                : Array.from(userProfile.recentInteractions).slice(0, 10);
            
            if (seedItems.length === 0) {
                return [];
            }
            
            // For each seed item, find similar items
            const candidateItems = new Map();
            
            for (const seedItem of seedItems) {
                const similarItems = await this.findSimilarItems(seedItem, 20);
                
                for (const similarItem of similarItems) {
                    if (!userProfile.viewedItems.has(similarItem.itemId)) {
                        const key = similarItem.itemId;
                        
                        if (!candidateItems.has(key)) {
                            candidateItems.set(key, {
                                itemId: similarItem.itemId,
                                score: 0,
                                seedItems: []
                            });
                        }
                        
                        candidateItems.get(key).score += similarItem.similarity;
                        candidateItems.get(key).seedItems.push({
                            seedItemId: seedItem,
                            similarity: similarItem.similarity
                        });
                    }
                }
            }
            
            // Convert to recommendation format
            for (const [itemId, data] of candidateItems) {
                const itemDetails = await this.getItemDetails(itemId);
                
                recommendations.push({
                    itemId,
                    score: data.score / data.seedItems.length, // Normalize by number of seed items
                    confidence: Math.min(1, data.seedItems.length / 3),
                    algorithm: 'item_collaborative',
                    details: itemDetails,
                    reasoning: {
                        basedOnItems: data.seedItems.length,
                        avgSimilarity: data.seedItems.reduce((sum, s) => sum + s.similarity, 0) / data.seedItems.length
                    }
                });
            }
            
            return recommendations.sort((a, b) => b.score - a.score).slice(0, 100);
            
        } catch (error) {
            console.error('Error in item-based collaborative filtering:', error);
            return [];
        }
    }
    
    /**
     * Generate content-based recommendations
     */
    async generateContentBasedRecommendations(userId, userProfile) {
        try {
            // Build user preference profile from interaction history
            const userPreferences = await this.buildUserPreferenceProfile(userProfile);
            
            if (!userPreferences || Object.keys(userPreferences).length === 0) {
                return [];
            }
            
            // Get candidate items (items user hasn't seen)
            const candidateItems = await this.getCandidateItems(userId, 1000);
            
            const recommendations = [];
            
            for (const item of candidateItems) {
                const itemFeatures = await this.getItemFeatures(item.id);
                
                if (itemFeatures) {
                    const similarityScore = this.calculateContentSimilarity(userPreferences, itemFeatures);
                    
                    if (similarityScore > 0.3) { // Threshold for relevance
                        recommendations.push({
                            itemId: item.id,
                            score: similarityScore,
                            confidence: 0.8, // Content-based is generally reliable
                            algorithm: 'content_based',
                            details: item,
                            reasoning: {
                                matchingFeatures: this.getMatchingFeatures(userPreferences, itemFeatures),
                                contentSimilarity: similarityScore
                            }
                        });
                    }
                }
            }
            
            return recommendations.sort((a, b) => b.score - a.score).slice(0, 100);
            
        } catch (error) {
            console.error('Error in content-based recommendations:', error);
            return [];
        }
    }
    
    /**
     * Generate popularity-based recommendations (fallback)
     */
    async generatePopularityBasedRecommendations(userProfile) {
        try {
            const [popularItems] = await this.db.execute(`
                SELECT 
                    gi.id as item_id,
                    gi.title,
                    gi.description,
                    gi.image_url,
                    gi.category,
                    gi.tags,
                    COUNT(DISTINCT ui.user_id) as unique_views,
                    AVG(ui.rating) as avg_rating,
                    COUNT(ui.id) as total_interactions
                FROM gallery_images gi
                JOIN user_interactions ui ON gi.id = ui.item_id
                WHERE gi.is_active = TRUE
                  AND ui.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY gi.id, gi.title, gi.description, gi.image_url, gi.category, gi.tags
                HAVING unique_views >= 5
                ORDER BY 
                    (unique_views * 0.4 + COALESCE(avg_rating, 3) * 0.3 + total_interactions * 0.3) DESC
                LIMIT 50
            `);
            
            const recommendations = popularItems.map((item, index) => ({
                itemId: item.item_id,
                score: (50 - index) / 50, // Normalize to 0-1 scale
                confidence: 0.6, // Moderate confidence for popularity-based
                algorithm: 'popularity',
                details: {
                    id: item.item_id,
                    title: item.title,
                    description: item.description,
                    image_url: item.image_url,
                    category: item.category,
                    tags: item.tags
                },
                reasoning: {
                    uniqueViews: item.unique_views,
                    avgRating: parseFloat(item.avg_rating || 0),
                    totalInteractions: item.total_interactions,
                    popularityRank: index + 1
                }
            }));
            
            return recommendations;
            
        } catch (error) {
            console.error('Error in popularity-based recommendations:', error);
            return [];
        }
    }
    
    /**
     * Track recommendation interaction (click, view, etc.)
     */
    async trackRecommendationInteraction(userId, itemId, interactionType, recommendationContext = {}) {
        try {
            console.log(`📊 Tracking ${interactionType} for user ${userId} on item ${itemId}`);
            
            // Store interaction in database
            await this.db.execute(`
                INSERT INTO recommendation_interactions (
                    user_id, 
                    item_id, 
                    interaction_type, 
                    recommendation_algorithm,
                    recommendation_score,
                    recommendation_context,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, NOW())
            `, [
                userId,
                itemId,
                interactionType,
                recommendationContext.algorithm || 'unknown',
                recommendationContext.score || 0,
                JSON.stringify(recommendationContext)
            ]);
            
            // Update real-time metrics
            this.updateInteractionMetrics(userId, itemId, interactionType, recommendationContext);
            
            // Update user profile
            await this.updateUserProfile(userId, itemId, interactionType);
            
            // Invalidate relevant caches
            await this.invalidateRecommendationCaches(userId);
            
            this.emit('recommendation-interaction', {
                userId,
                itemId,
                interactionType,
                context: recommendationContext,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('Error tracking recommendation interaction:', error);
        }
    }
    
    /**
     * Get recommendation performance analytics
     */
    async getRecommendationAnalytics(timeframe = '7d', userId = null) {
        try {
            const timeframeMap = {
                '1d': 1,
                '7d': 7,
                '30d': 30
            };
            
            const days = timeframeMap[timeframe] || 7;
            
            const [analytics] = await this.db.execute(`
                SELECT 
                    ri.recommendation_algorithm,
                    ri.interaction_type,
                    COUNT(*) as total_interactions,
                    COUNT(DISTINCT ri.user_id) as unique_users,
                    COUNT(DISTINCT ri.item_id) as unique_items,
                    AVG(ri.recommendation_score) as avg_recommendation_score,
                    COUNT(CASE WHEN ri.interaction_type = 'click' THEN 1 END) as clicks,
                    COUNT(CASE WHEN ri.interaction_type = 'view' THEN 1 END) as views,
                    COUNT(CASE WHEN ri.interaction_type = 'conversion' THEN 1 END) as conversions
                FROM recommendation_interactions ri
                WHERE ri.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                  ${userId ? 'AND ri.user_id = ?' : ''}
                GROUP BY ri.recommendation_algorithm, ri.interaction_type
                ORDER BY total_interactions DESC
            `, userId ? [days, userId] : [days]);
            
            // Calculate performance metrics
            const performanceMetrics = this.calculatePerformanceMetrics(analytics);
            
            return {
                timeframe,
                userId,
                analytics,
                performanceMetrics,
                generatedAt: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('Error getting recommendation analytics:', error);
            return {
                timeframe,
                userId,
                analytics: [],
                performanceMetrics: {},
                error: error.message
            };
        }
    }
    
    // Utility Methods
    async getUserProfile(userId) {
        // Get user interaction history
        const [interactions] = await this.db.execute(`
            SELECT * FROM user_interactions 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT 500
        `, [userId]);
        
        const profile = {
            userId,
            viewedItems: new Set(),
            recentInteractions: [],
            preferences: {},
            activityLevel: 'low',
            lastSeen: null
        };
        
        interactions.forEach(interaction => {
            profile.viewedItems.add(interaction.item_id);
            if (profile.recentInteractions.length < 50) {
                profile.recentInteractions.push(interaction.item_id);
            }
        });
        
        // Determine activity level
        if (interactions.length > 100) profile.activityLevel = 'high';
        else if (interactions.length > 20) profile.activityLevel = 'medium';
        
        profile.lastSeen = interactions[0]?.created_at || null;
        
        return profile;
    }
    
    determineUserSegment(userProfile) {
        const interactionCount = userProfile.viewedItems.size;
        const daysSinceLastSeen = userProfile.lastSeen 
            ? Math.floor((Date.now() - new Date(userProfile.lastSeen)) / (1000 * 60 * 60 * 24))
            : 365;
        
        if (interactionCount === 0 || daysSinceLastSeen > 90) {
            return this.userSegments.new_user;
        } else if (interactionCount >= 100 || userProfile.activityLevel === 'high') {
            return this.userSegments.power_user;
        } else if (interactionCount >= 20 || userProfile.activityLevel === 'medium') {
            return this.userSegments.engaged_user;
        } else {
            return this.userSegments.casual_browser;
        }
    }
    
    mergeRecommendations(candidates, recommendations, algorithm, weight) {
        recommendations.forEach(rec => {
            const key = rec.itemId;
            
            if (!candidates.has(key)) {
                candidates.set(key, {
                    itemId: rec.itemId,
                    combinedScore: 0,
                    algorithms: {},
                    details: rec.details,
                    confidence: 0
                });
            }
            
            const candidate = candidates.get(key);
            candidate.algorithms[algorithm] = {
                score: rec.score,
                confidence: rec.confidence,
                reasoning: rec.reasoning
            };
            
            candidate.combinedScore += rec.score * weight;
            candidate.confidence = Math.max(candidate.confidence, rec.confidence);
        });
    }
    
    async findSimilarUsers(userId, limit = 50) {
        // Simplified user similarity - in production this would use more sophisticated algorithms
        const [similarUsers] = await this.db.execute(`
            SELECT 
                u2.user_id,
                COUNT(DISTINCT ui1.item_id) as common_items,
                COUNT(DISTINCT ui2.item_id) as total_items_u2,
                (COUNT(DISTINCT ui1.item_id) / COUNT(DISTINCT ui2.item_id)) as similarity
            FROM user_interactions ui1
            JOIN user_interactions ui2 ON ui1.item_id = ui2.item_id
            JOIN (SELECT DISTINCT user_id FROM user_interactions WHERE user_id != ?) u2 ON ui2.user_id = u2.user_id
            WHERE ui1.user_id = ?
            GROUP BY u2.user_id, total_items_u2
            HAVING common_items >= 3 AND similarity >= 0.1
            ORDER BY similarity DESC, common_items DESC
            LIMIT ?
        `, [userId, userId, limit]);
        
        return similarUsers;
    }
    
    async findSimilarItems(itemId, limit = 20) {
        // Simplified item similarity - in production this would use content features
        const [similarItems] = await this.db.execute(`
            SELECT 
                gi2.id as itemId,
                COUNT(DISTINCT ui1.user_id) as common_users,
                COUNT(DISTINCT ui2.user_id) as total_users_i2,
                (COUNT(DISTINCT ui1.user_id) / COUNT(DISTINCT ui2.user_id)) as similarity
            FROM user_interactions ui1
            JOIN user_interactions ui2 ON ui1.user_id = ui2.user_id
            JOIN gallery_images gi2 ON ui2.item_id = gi2.id
            WHERE ui1.item_id = ? AND ui2.item_id != ?
            GROUP BY gi2.id, total_users_i2
            HAVING common_users >= 2 AND similarity >= 0.1
            ORDER BY similarity DESC, common_users DESC
            LIMIT ?
        `, [itemId, itemId, limit]);
        
        return similarItems;
    }
    
    async getItemDetails(itemId) {
        const [items] = await this.db.execute(`
            SELECT * FROM gallery_images WHERE id = ?
        `, [itemId]);
        
        return items[0] || null;
    }
    
    startRealTimeUpdates() {
        // Update user similarities every 30 minutes
        setInterval(async () => {
            try {
                await this.updateUserSimilarities();
            } catch (error) {
                console.error('Error updating user similarities:', error);
            }
        }, 30 * 60 * 1000);
        
        // Update item similarities every hour
        setInterval(async () => {
            try {
                await this.updateItemSimilarities();
            } catch (error) {
                console.error('Error updating item similarities:', error);
            }
        }, 60 * 60 * 1000);
    }
    
    startPerformanceMonitoring() {
        // Track performance metrics every 5 minutes
        setInterval(async () => {
            try {
                await this.updatePerformanceMetrics();
            } catch (error) {
                console.error('Error updating performance metrics:', error);
            }
        }, 5 * 60 * 1000);
    }
    
    /**
     * Get service health status
     */
    async getHealthStatus() {
        try {
            const redisConnected = this.redis && this.redis.isReady;
            const recommendationRedisConnected = this.recommendationRedis && this.recommendationRedis.isReady;
            const dbConnected = this.db && await this.db.ping();
            
            const cacheSize = this.recommendationCache.size;
            const avgLatency = this.performanceMetrics.recommendation_latency.length > 0
                ? this.performanceMetrics.recommendation_latency.reduce((a, b) => a + b, 0) / this.performanceMetrics.recommendation_latency.length
                : 0;
            
            return {
                status: redisConnected && recommendationRedisConnected && dbConnected ? 'healthy' : 'degraded',
                components: {
                    redis: redisConnected,
                    recommendationRedis: recommendationRedisConnected,
                    database: dbConnected
                },
                models: {
                    lastTrained: this.models.last_trained,
                    version: this.models.model_version,
                    userEmbeddings: this.models.user_embeddings !== null,
                    itemEmbeddings: this.models.item_embeddings !== null
                },
                performance: {
                    cacheSize,
                    avgLatency: Math.round(avgLatency),
                    recommendationTypes: Object.keys(this.recommendationTypes).length
                },
                uptime: process.uptime(),
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'error',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    /**
     * Shutdown service gracefully
     */
    async shutdown() {
        try {
            console.log('🔄 Shutting down Intelligent Recommendation Service...');
            
            if (this.redis) {
                await this.redis.disconnect();
            }
            
            if (this.recommendationRedis) {
                await this.recommendationRedis.disconnect();
            }
            
            if (this.db) {
                await this.db.end();
            }
            
            this.removeAllListeners();
            
            console.log('✅ Intelligent Recommendation Service shutdown complete');
        } catch (error) {
            console.error('Error during service shutdown:', error);
        }
    }
}

module.exports = IntelligentRecommendationService;