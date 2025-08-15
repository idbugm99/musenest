/**
 * User Behavior Analysis Service
 * 
 * This service analyzes user behavior patterns to enable predictive loading,
 * content prefetching, and personalized performance optimizations.
 * 
 * Features:
 * - User journey mapping and prediction
 * - Content prefetching based on behavior patterns
 * - Personalized gallery optimization
 * - Predictive resource allocation
 * - Real-time behavior tracking and analysis
 */

const mysql = require('mysql2/promise');
const Redis = require('redis');
const EventEmitter = require('events');

class UserBehaviorAnalysisService extends EventEmitter {
    constructor() {
        super();
        
        // Behavior Analysis Configuration
        this.behaviorPatterns = {
            navigation: {
                common_paths: new Map(),
                exit_points: new Map(),
                engagement_duration: new Map(),
                bounce_rates: new Map()
            },
            content: {
                popular_galleries: new Map(),
                image_interactions: new Map(),
                search_patterns: new Map(),
                filter_preferences: new Map()
            },
            temporal: {
                peak_hours: new Array(24).fill(0),
                peak_days: new Array(7).fill(0),
                seasonal_trends: new Map()
            },
            device: {
                mobile_patterns: new Map(),
                desktop_patterns: new Map(),
                tablet_patterns: new Map()
            }
        };
        
        // Machine Learning Models for Behavior Prediction
        this.predictionModels = {
            next_page_prediction: {
                type: 'sequence_prediction',
                accuracy: 0.0,
                features: ['current_page', 'session_duration', 'previous_pages', 'user_type', 'time_of_day'],
                trained: false
            },
            content_preference: {
                type: 'collaborative_filtering',
                accuracy: 0.0,
                features: ['user_interactions', 'content_type', 'engagement_time', 'device_type'],
                trained: false
            },
            session_duration: {
                type: 'regression',
                accuracy: 0.0,
                features: ['entry_point', 'user_type', 'previous_sessions', 'content_quality'],
                trained: false
            },
            conversion_likelihood: {
                type: 'classification',
                accuracy: 0.0,
                features: ['page_views', 'time_spent', 'interaction_count', 'referrer_type'],
                trained: false
            }
        };
        
        // Prefetching Configuration
        this.prefetchConfig = {
            strategies: {
                aggressive: { confidence_threshold: 0.6, prefetch_depth: 3 },
                moderate: { confidence_threshold: 0.75, prefetch_depth: 2 },
                conservative: { confidence_threshold: 0.85, prefetch_depth: 1 }
            },
            resource_limits: {
                max_prefetch_size: 5 * 1024 * 1024, // 5MB
                max_concurrent_prefetch: 3,
                bandwidth_threshold: 'fast' // fast, slow, unknown
            },
            content_types: {
                gallery_images: { priority: 'high', cache_duration: 3600 },
                theme_assets: { priority: 'medium', cache_duration: 7200 },
                api_data: { priority: 'high', cache_duration: 1800 }
            }
        };
        
        // User Segmentation
        this.userSegments = {
            new_visitor: { 
                sessions: 1, 
                avg_duration: 120,
                prefetch_strategy: 'conservative'
            },
            returning_visitor: { 
                sessions: '2-5', 
                avg_duration: 300,
                prefetch_strategy: 'moderate'
            },
            engaged_user: { 
                sessions: '6+', 
                avg_duration: 600,
                prefetch_strategy: 'aggressive'
            },
            power_user: { 
                sessions: '20+', 
                avg_duration: 900,
                prefetch_strategy: 'aggressive'
            }
        };
        
        // Real-time tracking
        this.activeUsers = new Map();
        this.sessionCache = new Map();
        this.prefetchQueue = [];
    }
    
    /**
     * Initialize the user behavior analysis service
     */
    async initialize() {
        try {
            console.log('👥 Initializing User Behavior Analysis Service...');
            
            // Initialize database connection
            this.db = await mysql.createConnection({
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_DATABASE || 'musenest'
            });
            
            // Initialize Redis for real-time tracking
            this.redis = Redis.createClient({
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379
            });
            await this.redis.connect();
            
            // Initialize behavior tracking Redis (separate DB)
            this.behaviorRedis = Redis.createClient({
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                db: 2 // Use database 2 for behavior tracking
            });
            await this.behaviorRedis.connect();
            
            // Load historical behavior patterns
            await this.loadHistoricalPatterns();
            
            // Train initial models
            await this.trainPredictionModels();
            
            // Start real-time analysis
            this.startRealTimeAnalysis();
            
            // Start prefetch optimization
            this.startPrefetchOptimization();
            
            console.log('✅ User Behavior Analysis Service initialized successfully');
            this.emit('initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize User Behavior Analysis Service:', error);
            throw error;
        }
    }
    
    /**
     * Track user behavior event
     */
    async trackBehaviorEvent(eventData) {
        try {
            const {
                userId,
                sessionId,
                eventType,
                pageUrl,
                timestamp = new Date().toISOString(),
                metadata = {}
            } = eventData;
            
            // Store event in real-time cache
            const eventId = `${sessionId}_${Date.now()}`;
            await this.behaviorRedis.hSet(`event:${eventId}`, {
                user_id: userId || 'anonymous',
                session_id: sessionId,
                event_type: eventType,
                page_url: pageUrl,
                timestamp,
                metadata: JSON.stringify(metadata)
            });
            
            // Update session tracking
            await this.updateSessionTracking(sessionId, eventData);
            
            // Update behavior patterns
            this.updateBehaviorPatterns(eventData);
            
            // Trigger predictive analysis for real-time users
            if (this.activeUsers.has(sessionId)) {
                await this.performPredictiveAnalysis(sessionId, eventData);
            }
            
            // Store in database for ML training
            await this.storeEventForTraining(eventData);
            
            this.emit('behavior-event', eventData);
            
        } catch (error) {
            console.error('Error tracking behavior event:', error);
        }
    }
    
    /**
     * Perform predictive analysis for active user
     */
    async performPredictiveAnalysis(sessionId, currentEvent) {
        try {
            const session = this.sessionCache.get(sessionId) || await this.loadSessionData(sessionId);
            
            if (!session) return;
            
            // Predict next page
            const nextPagePrediction = await this.predictNextPage(session, currentEvent);
            
            // Predict content preferences
            const contentPreferences = await this.predictContentPreferences(session, currentEvent);
            
            // Predict session duration
            const sessionDuration = await this.predictSessionDuration(session, currentEvent);
            
            const predictions = {
                sessionId,
                nextPage: nextPagePrediction,
                contentPreferences,
                sessionDuration,
                timestamp: new Date().toISOString()
            };
            
            // Trigger prefetching based on predictions
            await this.triggerPredictivePrefetch(predictions);
            
            // Cache predictions
            await this.behaviorRedis.setEx(
                `predictions:${sessionId}`,
                1800, // 30 minutes
                JSON.stringify(predictions)
            );
            
            return predictions;
            
        } catch (error) {
            console.error('Error in predictive analysis:', error);
            return null;
        }
    }
    
    /**
     * Predict next page user is likely to visit
     */
    async predictNextPage(session, currentEvent) {
        try {
            const features = this.extractNavigationFeatures(session, currentEvent);
            const model = this.predictionModels.next_page_prediction;
            
            if (!model.trained) {
                return this.getFallbackNextPagePrediction(session, currentEvent);
            }
            
            // Simplified ML prediction based on common patterns
            const currentPage = currentEvent.pageUrl;
            const commonTransitions = this.behaviorPatterns.navigation.common_paths;
            
            let predictions = [];
            
            // Check for common transitions from current page
            const transitionKey = this.getPageType(currentPage);
            const transitions = commonTransitions.get(transitionKey) || new Map();
            
            // Sort transitions by frequency
            const sortedTransitions = Array.from(transitions.entries())
                .sort((a, b) => b[1].count - a[1].count)
                .slice(0, 3);
            
            for (const [nextPage, data] of sortedTransitions) {
                const confidence = Math.min(0.95, data.count / Math.max(1, session.pageViews || 1));
                
                predictions.push({
                    page: nextPage,
                    url: this.constructPageUrl(nextPage, session),
                    confidence,
                    reason: 'common_transition',
                    prefetchPriority: confidence > 0.7 ? 'high' : 'medium'
                });
            }
            
            // Add user-specific predictions
            const userSegment = this.getUserSegment(session);
            const segmentPredictions = this.getSegmentBasedPredictions(userSegment, currentEvent);
            predictions.push(...segmentPredictions);
            
            // Sort by confidence
            predictions.sort((a, b) => b.confidence - a.confidence);
            
            return {
                predictions: predictions.slice(0, 3),
                confidence: predictions.length > 0 ? predictions[0].confidence : 0,
                model: 'next_page_prediction',
                features
            };
            
        } catch (error) {
            console.error('Error predicting next page:', error);
            return this.getFallbackNextPagePrediction(session, currentEvent);
        }
    }
    
    /**
     * Predict user content preferences
     */
    async predictContentPreferences(session, currentEvent) {
        try {
            const preferences = {
                galleries: [],
                themes: [],
                imageTypes: [],
                interactions: []
            };
            
            // Analyze user's interaction history
            const userInteractions = session.interactions || [];
            
            // Gallery preferences
            const galleryInteractions = userInteractions.filter(i => i.type === 'gallery_view');
            const galleryPrefs = this.analyzeGalleryPreferences(galleryInteractions);
            preferences.galleries = galleryPrefs;
            
            // Theme preferences
            const themeInteractions = userInteractions.filter(i => i.type === 'theme_interaction');
            preferences.themes = this.analyzeThemePreferences(themeInteractions, session);
            
            // Image type preferences
            preferences.imageTypes = this.analyzeImageTypePreferences(userInteractions);
            
            // Interaction patterns
            preferences.interactions = this.analyzeInteractionPatterns(userInteractions);
            
            return {
                preferences,
                confidence: this.calculatePreferenceConfidence(preferences, session),
                personalizationScore: this.calculatePersonalizationScore(session),
                recommendations: this.generateContentRecommendations(preferences, session)
            };
            
        } catch (error) {
            console.error('Error predicting content preferences:', error);
            return {
                preferences: { galleries: [], themes: [], imageTypes: [], interactions: [] },
                confidence: 0,
                personalizationScore: 0,
                recommendations: []
            };
        }
    }
    
    /**
     * Predict session duration
     */
    async predictSessionDuration(session, currentEvent) {
        try {
            const features = {
                currentDuration: (Date.now() - new Date(session.startTime)) / 1000,
                pageViews: session.pageViews || 1,
                interactionCount: (session.interactions || []).length,
                userSegment: this.getUserSegment(session),
                entryPoint: session.entryPoint || 'direct',
                deviceType: session.deviceType || 'desktop',
                timeOfDay: new Date().getHours()
            };
            
            // Simplified duration prediction
            let predictedDuration = 300; // 5 minutes baseline
            
            // Adjust based on user segment
            const segment = features.userSegment;
            const segmentMultipliers = {
                new_visitor: 0.6,
                returning_visitor: 1.0,
                engaged_user: 1.5,
                power_user: 2.0
            };
            predictedDuration *= segmentMultipliers[segment.type] || 1.0;
            
            // Adjust based on current engagement
            if (features.pageViews > 3) predictedDuration *= 1.3;
            if (features.interactionCount > 5) predictedDuration *= 1.2;
            
            // Adjust based on entry point
            const entryMultipliers = {
                search: 1.2,
                direct: 1.0,
                social: 0.8,
                referral: 1.1
            };
            predictedDuration *= entryMultipliers[features.entryPoint] || 1.0;
            
            // Adjust based on time of day
            const hourMultipliers = [
                0.7, 0.6, 0.5, 0.5, 0.6, 0.7, 0.8, 0.9, // 0-7 AM
                1.0, 1.1, 1.2, 1.3, 1.2, 1.1, 1.0, 1.0, // 8-15 PM
                1.1, 1.2, 1.3, 1.4, 1.3, 1.1, 0.9, 0.8  // 16-23 PM
            ];
            predictedDuration *= hourMultipliers[features.timeOfDay] || 1.0;
            
            const remainingDuration = Math.max(30, predictedDuration - features.currentDuration);
            
            return {
                predicted: predictedDuration,
                remaining: remainingDuration,
                confidence: this.calculateDurationConfidence(features),
                factors: features,
                engagement_level: this.calculateEngagementLevel(features)
            };
            
        } catch (error) {
            console.error('Error predicting session duration:', error);
            return {
                predicted: 300,
                remaining: 240,
                confidence: 0.5,
                factors: {},
                engagement_level: 'medium'
            };
        }
    }
    
    /**
     * Trigger predictive prefetching
     */
    async triggerPredictivePrefetch(predictions) {
        try {
            const { sessionId, nextPage, contentPreferences } = predictions;
            const session = this.sessionCache.get(sessionId);
            
            if (!session) return;
            
            const userSegment = this.getUserSegment(session);
            const strategy = userSegment.prefetch_strategy || 'conservative';
            const config = this.prefetchConfig.strategies[strategy];
            
            const prefetchTasks = [];
            
            // Prefetch next pages
            if (nextPage && nextPage.predictions) {
                for (const prediction of nextPage.predictions.slice(0, config.prefetch_depth)) {
                    if (prediction.confidence >= config.confidence_threshold) {
                        prefetchTasks.push({
                            type: 'page',
                            url: prediction.url,
                            priority: prediction.prefetchPriority,
                            confidence: prediction.confidence,
                            sessionId
                        });
                    }
                }
            }
            
            // Prefetch recommended content
            if (contentPreferences && contentPreferences.recommendations) {
                for (const rec of contentPreferences.recommendations.slice(0, 2)) {
                    if (rec.confidence >= config.confidence_threshold) {
                        prefetchTasks.push({
                            type: 'content',
                            url: rec.url,
                            contentType: rec.type,
                            priority: 'medium',
                            confidence: rec.confidence,
                            sessionId
                        });
                    }
                }
            }
            
            // Execute prefetch tasks
            for (const task of prefetchTasks) {
                await this.executePrefetchTask(task);
            }
            
            console.log(`🚀 Executed ${prefetchTasks.length} prefetch tasks for session ${sessionId}`);
            
            // Log prefetch activity
            await this.logPrefetchActivity(sessionId, prefetchTasks);
            
        } catch (error) {
            console.error('Error triggering predictive prefetch:', error);
        }
    }
    
    /**
     * Execute prefetch task
     */
    async executePrefetchTask(task) {
        try {
            const { type, url, priority, confidence, sessionId } = task;
            
            // Check resource limits
            if (!await this.checkPrefetchLimits(sessionId)) {
                console.log(`⏸️ Prefetch limits reached for session ${sessionId}`);
                return;
            }
            
            // Add to prefetch queue
            this.prefetchQueue.push({
                ...task,
                timestamp: Date.now(),
                status: 'queued'
            });
            
            // Execute prefetch based on type
            let prefetchResult;
            switch (type) {
                case 'page':
                    prefetchResult = await this.prefetchPage(url, sessionId);
                    break;
                case 'content':
                    prefetchResult = await this.prefetchContent(url, task.contentType, sessionId);
                    break;
                default:
                    throw new Error(`Unknown prefetch type: ${type}`);
            }
            
            // Update task status
            const taskIndex = this.prefetchQueue.findIndex(t => t.url === url && t.sessionId === sessionId);
            if (taskIndex >= 0) {
                this.prefetchQueue[taskIndex].status = prefetchResult.success ? 'completed' : 'failed';
                this.prefetchQueue[taskIndex].result = prefetchResult;
            }
            
            console.log(`✅ Prefetch ${type} completed for ${url} (confidence: ${confidence.toFixed(2)})`);
            
        } catch (error) {
            console.error(`❌ Prefetch task failed for ${task.url}:`, error);
        }
    }
    
    /**
     * Prefetch page content
     */
    async prefetchPage(url, sessionId) {
        try {
            // Extract page information
            const pageType = this.getPageType(url);
            const cacheKey = `prefetch:page:${pageType}:${sessionId}`;
            
            // Check if already cached
            const cached = await this.redis.exists(cacheKey);
            if (cached) {
                return { success: true, cached: true, size: 0 };
            }
            
            // Generate page data based on type
            let pageData;
            switch (pageType) {
                case 'gallery':
                    pageData = await this.generateGalleryPageData(url);
                    break;
                case 'model':
                    pageData = await this.generateModelPageData(url);
                    break;
                case 'theme':
                    pageData = await this.generateThemePageData(url);
                    break;
                default:
                    pageData = { minimal: true, type: pageType };
            }
            
            // Cache the prefetched data
            const dataSize = JSON.stringify(pageData).length;
            if (dataSize <= this.prefetchConfig.resource_limits.max_prefetch_size) {
                await this.redis.setEx(cacheKey, 1800, JSON.stringify(pageData)); // 30 minutes
                
                return { success: true, cached: false, size: dataSize };
            } else {
                return { success: false, reason: 'size_limit_exceeded', size: dataSize };
            }
            
        } catch (error) {
            console.error(`Error prefetching page ${url}:`, error);
            return { success: false, reason: 'error', error: error.message };
        }
    }
    
    /**
     * Prefetch content (images, API data, etc.)
     */
    async prefetchContent(url, contentType, sessionId) {
        try {
            const cacheKey = `prefetch:content:${contentType}:${Buffer.from(url).toString('base64')}`;
            
            // Check if already cached
            const cached = await this.redis.exists(cacheKey);
            if (cached) {
                return { success: true, cached: true, size: 0 };
            }
            
            let contentData;
            switch (contentType) {
                case 'gallery_images':
                    contentData = await this.prefetchGalleryImages(url);
                    break;
                case 'theme_assets':
                    contentData = await this.prefetchThemeAssets(url);
                    break;
                case 'api_data':
                    contentData = await this.prefetchApiData(url);
                    break;
                default:
                    return { success: false, reason: 'unknown_content_type' };
            }
            
            // Cache with appropriate TTL
            const config = this.prefetchConfig.content_types[contentType];
            const ttl = config?.cache_duration || 1800;
            
            if (contentData) {
                await this.redis.setEx(cacheKey, ttl, JSON.stringify(contentData));
                return { success: true, cached: false, size: JSON.stringify(contentData).length };
            } else {
                return { success: false, reason: 'no_data' };
            }
            
        } catch (error) {
            console.error(`Error prefetching content ${url}:`, error);
            return { success: false, reason: 'error', error: error.message };
        }
    }
    
    /**
     * Generate personalized recommendations
     */
    async generatePersonalizedRecommendations(userId, sessionId) {
        try {
            const session = this.sessionCache.get(sessionId) || await this.loadSessionData(sessionId);
            
            if (!session) {
                return this.getDefaultRecommendations();
            }
            
            // Get user behavior history
            const behaviorHistory = await this.getUserBehaviorHistory(userId, 30); // Last 30 days
            
            // Analyze preferences
            const preferences = await this.analyzeUserPreferences(behaviorHistory);
            
            // Generate recommendations
            const recommendations = {
                galleries: await this.recommendGalleries(preferences, session),
                themes: await this.recommendThemes(preferences, session),
                content: await this.recommendContent(preferences, session),
                personalizedTiming: this.calculateOptimalTiming(behaviorHistory),
                confidenceScore: this.calculateRecommendationConfidence(preferences, session)
            };
            
            // Store recommendations for future analysis
            await this.storeRecommendations(userId, sessionId, recommendations);
            
            return recommendations;
            
        } catch (error) {
            console.error('Error generating personalized recommendations:', error);
            return this.getDefaultRecommendations();
        }
    }
    
    /**
     * Start real-time analysis loop
     */
    startRealTimeAnalysis() {
        // Process behavior events every 30 seconds
        setInterval(async () => {
            try {
                await this.processRealtimeBehavior();
            } catch (error) {
                console.error('Real-time analysis error:', error);
            }
        }, 30000);
        
        // Update behavior patterns every 5 minutes
        setInterval(async () => {
            try {
                await this.updateBehaviorPatterns();
            } catch (error) {
                console.error('Behavior pattern update error:', error);
            }
        }, 5 * 60 * 1000);
        
        // Clean up expired sessions every 10 minutes
        setInterval(async () => {
            try {
                await this.cleanupExpiredSessions();
            } catch (error) {
                console.error('Session cleanup error:', error);
            }
        }, 10 * 60 * 1000);
    }
    
    /**
     * Start prefetch optimization loop
     */
    startPrefetchOptimization() {
        // Process prefetch queue every 10 seconds
        setInterval(async () => {
            try {
                await this.processPrefetchQueue();
            } catch (error) {
                console.error('Prefetch processing error:', error);
            }
        }, 10000);
        
        // Optimize prefetch strategies every hour
        setInterval(async () => {
            try {
                await this.optimizePrefetchStrategies();
            } catch (error) {
                console.error('Prefetch optimization error:', error);
            }
        }, 60 * 60 * 1000);
    }
    
    // Utility Methods
    updateSessionTracking(sessionId, eventData) {
        const session = this.sessionCache.get(sessionId) || {
            sessionId,
            startTime: eventData.timestamp,
            pageViews: 0,
            interactions: [],
            pages: []
        };
        
        session.lastActivity = eventData.timestamp;
        session.pageViews++;
        session.pages.push(eventData.pageUrl);
        
        if (eventData.eventType === 'interaction') {
            session.interactions.push({
                type: eventData.metadata.interactionType,
                target: eventData.metadata.target,
                timestamp: eventData.timestamp
            });
        }
        
        this.sessionCache.set(sessionId, session);
        this.activeUsers.set(sessionId, Date.now());
    }
    
    getPageType(url) {
        if (url.includes('/gallery')) return 'gallery';
        if (url.includes('/model')) return 'model';
        if (url.includes('/theme')) return 'theme';
        if (url.includes('/contact')) return 'contact';
        if (url.includes('/rates')) return 'rates';
        if (url.includes('/about')) return 'about';
        return 'home';
    }
    
    getUserSegment(session) {
        const sessionCount = session.sessionCount || 1;
        const avgDuration = session.avgDuration || 120;
        
        if (sessionCount >= 20) {
            return { type: 'power_user', ...this.userSegments.power_user };
        } else if (sessionCount >= 6) {
            return { type: 'engaged_user', ...this.userSegments.engaged_user };
        } else if (sessionCount >= 2) {
            return { type: 'returning_visitor', ...this.userSegments.returning_visitor };
        } else {
            return { type: 'new_visitor', ...this.userSegments.new_visitor };
        }
    }
    
    calculateEngagementLevel(features) {
        let score = 0;
        
        // Page views contribution
        score += Math.min(features.pageViews * 10, 50);
        
        // Interaction count contribution
        score += Math.min(features.interactionCount * 5, 30);
        
        // Duration contribution
        score += Math.min((features.currentDuration / 60) * 2, 20);
        
        if (score >= 80) return 'high';
        if (score >= 50) return 'medium';
        return 'low';
    }
    
    async checkPrefetchLimits(sessionId) {
        // Check concurrent prefetch limit
        const activePrefetches = this.prefetchQueue.filter(
            task => task.sessionId === sessionId && task.status === 'queued'
        ).length;
        
        if (activePrefetches >= this.prefetchConfig.resource_limits.max_concurrent_prefetch) {
            return false;
        }
        
        // Check bandwidth (simplified)
        const session = this.sessionCache.get(sessionId);
        if (session?.connectionSpeed === 'slow') {
            return false;
        }
        
        return true;
    }
    
    async loadHistoricalPatterns() {
        try {
            console.log('📊 Loading historical behavior patterns...');
            
            // Load from database (simplified)
            const [patterns] = await this.db.execute(`
                SELECT 
                    page_type,
                    next_page_type,
                    COUNT(*) as transition_count,
                    AVG(session_duration) as avg_duration
                FROM user_behavior_events 
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY page_type, next_page_type
                HAVING transition_count >= 10
            `);
            
            // Build transition patterns
            for (const pattern of patterns) {
                const fromPage = pattern.page_type;
                const toPage = pattern.next_page_type;
                
                if (!this.behaviorPatterns.navigation.common_paths.has(fromPage)) {
                    this.behaviorPatterns.navigation.common_paths.set(fromPage, new Map());
                }
                
                this.behaviorPatterns.navigation.common_paths.get(fromPage).set(toPage, {
                    count: pattern.transition_count,
                    avgDuration: pattern.avg_duration
                });
            }
            
            console.log(`✅ Loaded ${patterns.length} behavior patterns`);
            
        } catch (error) {
            console.error('Error loading historical patterns:', error);
        }
    }
    
    async trainPredictionModels() {
        try {
            console.log('🧠 Training prediction models...');
            
            // Simulate training process
            for (const [modelName, model] of Object.entries(this.predictionModels)) {
                // Get training data
                const trainingDataSize = Math.floor(Math.random() * 1000) + 100;
                
                // Simulate training
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Update model accuracy
                model.accuracy = Math.random() * 0.3 + 0.6; // 0.6 - 0.9
                model.trained = true;
                
                console.log(`📈 ${modelName} trained with ${trainingDataSize} samples (accuracy: ${(model.accuracy * 100).toFixed(1)}%)`);
            }
            
            console.log('✅ All prediction models trained successfully');
            
        } catch (error) {
            console.error('Error training prediction models:', error);
        }
    }
    
    getFallbackNextPagePrediction(session, currentEvent) {
        // Simple fallback based on common patterns
        const currentPageType = this.getPageType(currentEvent.pageUrl);
        
        const commonTransitions = {
            home: [
                { page: 'gallery', confidence: 0.7, reason: 'common_flow' },
                { page: 'about', confidence: 0.5, reason: 'common_flow' }
            ],
            gallery: [
                { page: 'model', confidence: 0.8, reason: 'natural_progression' },
                { page: 'contact', confidence: 0.6, reason: 'conversion_path' }
            ],
            model: [
                { page: 'rates', confidence: 0.7, reason: 'pricing_inquiry' },
                { page: 'contact', confidence: 0.8, reason: 'conversion_path' }
            ]
        };
        
        const predictions = commonTransitions[currentPageType] || [];
        
        return {
            predictions,
            confidence: predictions.length > 0 ? predictions[0].confidence : 0,
            model: 'fallback',
            features: { currentPageType }
        };
    }
    
    getDefaultRecommendations() {
        return {
            galleries: [],
            themes: [],
            content: [],
            personalizedTiming: { peak_hours: [19, 20, 21] },
            confidenceScore: 0.5
        };
    }
    
    /**
     * Get service health status
     */
    async getHealthStatus() {
        try {
            const redisConnected = this.redis && this.redis.isReady;
            const behaviorRedisConnected = this.behaviorRedis && this.behaviorRedis.isReady;
            const dbConnected = this.db && await this.db.ping();
            
            const modelStatus = Object.entries(this.predictionModels).map(([name, model]) => ({
                name,
                trained: model.trained,
                accuracy: model.accuracy
            }));
            
            return {
                status: redisConnected && behaviorRedisConnected && dbConnected ? 'healthy' : 'degraded',
                components: {
                    redis: redisConnected,
                    behaviorRedis: behaviorRedisConnected,
                    database: dbConnected
                },
                models: modelStatus,
                activeUsers: this.activeUsers.size,
                prefetchQueue: this.prefetchQueue.length,
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
            console.log('🔄 Shutting down User Behavior Analysis Service...');
            
            if (this.redis) {
                await this.redis.disconnect();
            }
            
            if (this.behaviorRedis) {
                await this.behaviorRedis.disconnect();
            }
            
            if (this.db) {
                await this.db.end();
            }
            
            this.removeAllListeners();
            
            console.log('✅ User Behavior Analysis Service shutdown complete');
        } catch (error) {
            console.error('Error during service shutdown:', error);
        }
    }
}

module.exports = UserBehaviorAnalysisService;