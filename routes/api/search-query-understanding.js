/**
 * Search Query Understanding API Routes
 * 
 * RESTful API endpoints for natural language processing of search queries,
 * semantic search, intent recognition, and intelligent search optimization.
 */

const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

// Initialize Search Query Understanding Service
let searchQueryService = null;

async function initializeService() {
    if (!searchQueryService) {
        const SearchQueryUnderstandingService = require('../../src/services/SearchQueryUnderstandingService');
        
        // Create database connection for the service
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        searchQueryService = new SearchQueryUnderstandingService(db);
        await searchQueryService.initialize();
    }
    return searchQueryService;
}

// Middleware to ensure service is initialized
async function ensureServiceReady(req, res, next) {
    try {
        await initializeService();
        next();
    } catch (error) {
        console.error('Failed to initialize Search Query Understanding Service:', error);
        res.status(503).json({
            error: 'Search Query Understanding Service unavailable',
            details: error.message
        });
    }
}

/**
 * GET /api/search-query-understanding/health
 * Get service health status and NLP model performance
 */
router.get('/health', ensureServiceReady, async (req, res) => {
    try {
        const health = await searchQueryService.getServiceHealthStatus();
        res.json(health);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get health status',
            details: error.message
        });
    }
});

/**
 * POST /api/search-query-understanding/process
 * Process and understand a search query using NLP
 * 
 * Body: {
 *   "query": "find brunette models with premium galleries",
 *   "context": {
 *     "user_id": 123,
 *     "session_id": "sess_456",
 *     "language": "en",
 *     "device_type": "desktop",
 *     "previous_searches": ["models", "gallery"],
 *     "user_preferences": { "content_type": "premium" }
 *   },
 *   "options": {
 *     "forceRefresh": false,
 *     "includeExpansions": true,
 *     "includePersonalization": true,
 *     "generateSuggestions": true
 *   }
 * }
 */
router.post('/process', ensureServiceReady, async (req, res) => {
    try {
        const { query, context = {}, options = {} } = req.body;
        
        if (!query || query.trim().length === 0) {
            return res.status(400).json({
                error: 'Missing or empty query',
                required: ['query']
            });
        }
        
        if (query.length > 1000) {
            return res.status(400).json({
                error: 'Query too long',
                max_length: 1000
            });
        }
        
        console.log(`🔍 Processing search query: "${query}"`);
        
        const queryUnderstanding = await searchQueryService.processSearchQuery(
            query.trim(), 
            { ...context, ...options }
        );
        
        res.json({
            success: !queryUnderstanding.error,
            ...queryUnderstanding
        });
        
    } catch (error) {
        console.error('Query processing error:', error);
        res.status(500).json({
            error: 'Failed to process search query',
            details: error.message
        });
    }
});

/**
 * POST /api/search-query-understanding/semantic-search
 * Perform semantic search using processed query understanding
 * 
 * Body: {
 *   "queryUnderstanding": { ... }, // Result from /process endpoint
 *   "searchOptions": {
 *     "maxResults": 50,
 *     "includePersonalization": true,
 *     "filterCategories": ["gallery", "profile"],
 *     "sortBy": "relevance", // relevance, popularity, recency
 *     "includeExplanations": true
 *   }
 * }
 */
router.post('/semantic-search', ensureServiceReady, async (req, res) => {
    try {
        const { queryUnderstanding, searchOptions = {} } = req.body;
        
        if (!queryUnderstanding || !queryUnderstanding.original_query) {
            return res.status(400).json({
                error: 'Missing or invalid query understanding data',
                required: ['queryUnderstanding']
            });
        }
        
        console.log(`🎯 Performing semantic search for: "${queryUnderstanding.original_query}"`);
        
        const searchResults = await searchQueryService.performSemanticSearch(
            queryUnderstanding, 
            searchOptions
        );
        
        res.json({
            success: true,
            ...searchResults
        });
        
    } catch (error) {
        console.error('Semantic search error:', error);
        res.status(500).json({
            error: 'Failed to perform semantic search',
            details: error.message
        });
    }
});

/**
 * GET /api/search-query-understanding/autocomplete
 * Generate intelligent search auto-complete suggestions
 * 
 * Query params:
 * - q: partial query text
 * - limit: number of suggestions (default 10, max 20)
 * - user_id: for personalized suggestions
 * - context: additional context (device, location, etc.)
 */
router.get('/autocomplete', ensureServiceReady, async (req, res) => {
    try {
        const { q: partialQuery, limit = 10, user_id, context } = req.query;
        
        if (!partialQuery || partialQuery.trim().length === 0) {
            return res.status(400).json({
                error: 'Missing partial query',
                required: ['q']
            });
        }
        
        if (partialQuery.length < 2) {
            return res.json({
                success: true,
                partial_query: partialQuery,
                completions: [],
                message: 'Minimum 2 characters required for suggestions'
            });
        }
        
        const maxLimit = Math.min(parseInt(limit) || 10, 20);
        
        console.log(`💭 Generating auto-complete for: "${partialQuery}"`);
        
        const contextData = {
            user_id: user_id ? parseInt(user_id) : null,
            device_type: context || 'unknown',
            timestamp: new Date().toISOString()
        };
        
        const autoComplete = await searchQueryService.generateSearchAutoComplete(
            partialQuery.trim(),
            contextData
        );
        
        // Limit results to requested amount
        const limitedCompletions = autoComplete.completions.slice(0, maxLimit);
        
        res.json({
            success: true,
            partial_query: partialQuery,
            completions: limitedCompletions,
            completion_metadata: autoComplete.completion_metadata
        });
        
    } catch (error) {
        console.error('Auto-complete error:', error);
        res.status(500).json({
            error: 'Failed to generate auto-complete suggestions',
            details: error.message
        });
    }
});

/**
 * GET /api/search-query-understanding/analytics
 * Get comprehensive search analytics and performance metrics
 * 
 * Query params:
 * - timeframe: 24h, 7d, 30d, 90d (default 24h)
 * - user_id: filter by specific user (optional)
 * - intent: filter by search intent (optional)
 * - include_trends: include trend analysis (default true)
 */
router.get('/analytics', ensureServiceReady, async (req, res) => {
    try {
        const { 
            timeframe = '24h', 
            user_id, 
            intent, 
            include_trends = 'true' 
        } = req.query;
        
        const validTimeframes = ['24h', '7d', '30d', '90d'];
        if (!validTimeframes.includes(timeframe)) {
            return res.status(400).json({
                error: 'Invalid timeframe',
                valid_options: validTimeframes
            });
        }
        
        console.log(`📊 Generating search analytics for timeframe: ${timeframe}`);
        
        const analytics = await searchQueryService.analyzeSearchPerformance(timeframe);
        
        // Filter by user if specified
        if (user_id) {
            analytics.user_id = parseInt(user_id);
            // Additional user-specific filtering would be implemented here
        }
        
        // Filter by intent if specified
        if (intent) {
            analytics.filtered_by_intent = intent;
            // Additional intent filtering would be implemented here
        }
        
        res.json({
            success: true,
            ...analytics
        });
        
    } catch (error) {
        console.error('Search analytics error:', error);
        res.status(500).json({
            error: 'Failed to generate search analytics',
            details: error.message
        });
    }
});

/**
 * GET /api/search-query-understanding/vocabulary
 * Get search vocabulary and domain-specific terms
 * 
 * Query params:
 * - term_type: keyword, synonym, category, entity (optional)
 * - language: language code (default en)
 * - limit: number of terms to return (default 100)
 * - sort_by: frequency, importance, alphabetical (default frequency)
 */
router.get('/vocabulary', async (req, res) => {
    try {
        const { 
            term_type, 
            language = 'en', 
            limit = 100, 
            sort_by = 'frequency' 
        } = req.query;
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        let query = `
            SELECT 
                term,
                term_type,
                canonical_term,
                synonyms,
                term_frequency,
                term_importance_score,
                language_code,
                is_validated
            FROM search_vocabulary
            WHERE language_code = ?
        `;
        const params = [language];
        
        if (term_type) {
            const validTypes = ['keyword', 'synonym', 'category', 'entity', 'concept', 'domain_specific'];
            if (validTypes.includes(term_type)) {
                query += ' AND term_type = ?';
                params.push(term_type);
            }
        }
        
        // Add sorting
        const sortOptions = {
            'frequency': 'term_frequency DESC',
            'importance': 'term_importance_score DESC',
            'alphabetical': 'term ASC'
        };
        const sortClause = sortOptions[sort_by] || sortOptions['frequency'];
        query += ` ORDER BY ${sortClause}`;
        
        // Add limit
        query += ' LIMIT ?';
        params.push(parseInt(limit) || 100);
        
        const [vocabulary] = await db.execute(query, params);
        
        // Parse JSON fields
        const processedVocabulary = vocabulary.map(term => ({
            ...term,
            synonyms: term.synonyms ? JSON.parse(term.synonyms) : [],
            term_frequency: parseInt(term.term_frequency || 0),
            term_importance_score: parseFloat(term.term_importance_score || 0),
            is_validated: Boolean(term.is_validated)
        }));
        
        await db.end();
        
        res.json({
            success: true,
            vocabulary: processedVocabulary,
            metadata: {
                language: language,
                term_type: term_type || 'all',
                total_terms: processedVocabulary.length,
                sort_by: sort_by
            }
        });
        
    } catch (error) {
        console.error('Vocabulary retrieval error:', error);
        res.status(500).json({
            error: 'Failed to get search vocabulary',
            details: error.message
        });
    }
});

/**
 * POST /api/search-query-understanding/feedback
 * Submit search result feedback for model improvement
 * 
 * Body: {
 *   "queryUnderstandingId": 123,
 *   "userSatisfactionScore": 0.85,
 *   "searchSuccess": true,
 *   "clickedResults": [1, 3, 7],
 *   "dwellTimeSeconds": 45,
 *   "refinementQueries": ["refined query 1"],
 *   "conversionAchieved": false
 * }
 */
router.post('/feedback', async (req, res) => {
    try {
        const {
            queryUnderstandingId,
            userSatisfactionScore,
            searchSuccess,
            clickedResults = [],
            dwellTimeSeconds,
            refinementQueries = [],
            conversionAchieved = false,
            sessionId
        } = req.body;
        
        if (!queryUnderstandingId) {
            return res.status(400).json({
                error: 'Missing required field',
                required: ['queryUnderstandingId']
            });
        }
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        // Verify the query understanding record exists
        const [queryCheck] = await db.execute(`
            SELECT id, user_id FROM search_query_understanding WHERE id = ?
        `, [queryUnderstandingId]);
        
        if (queryCheck.length === 0) {
            await db.end();
            return res.status(404).json({
                error: 'Query understanding record not found',
                query_understanding_id: queryUnderstandingId
            });
        }
        
        const userId = queryCheck[0].user_id;
        
        // Calculate derived metrics
        const clickThroughRate = clickedResults.length > 0 ? 1.0 : 0.0;
        const bounceRate = clickedResults.length === 0 ? 1.0 : 0.0;
        
        // Insert search result interaction record
        await db.execute(`
            INSERT INTO search_result_interactions (
                query_understanding_id,
                user_id,
                session_id,
                search_results_count,
                search_strategy,
                ranking_algorithm,
                results_clicked,
                click_through_rate,
                dwell_time_seconds,
                bounce_rate,
                refinement_queries,
                user_satisfaction_score,
                search_success,
                conversion_achieved
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            queryUnderstandingId,
            userId,
            sessionId || null,
            0, // Will be updated by actual search results count
            'semantic_hybrid', // Default strategy
            'relevance_ranking', // Default algorithm
            JSON.stringify(clickedResults),
            clickThroughRate,
            dwellTimeSeconds || null,
            bounceRate,
            JSON.stringify(refinementQueries),
            userSatisfactionScore || null,
            searchSuccess || null,
            conversionAchieved || false
        ]);
        
        await db.end();
        
        console.log(`📝 Recorded search feedback for query understanding ID: ${queryUnderstandingId}`);
        
        res.json({
            success: true,
            message: 'Search feedback recorded successfully',
            query_understanding_id: queryUnderstandingId,
            feedback_recorded: true
        });
        
    } catch (error) {
        console.error('Search feedback error:', error);
        res.status(500).json({
            error: 'Failed to record search feedback',
            details: error.message
        });
    }
});

/**
 * GET /api/search-query-understanding/popular-queries
 * Get popular and trending search queries
 * 
 * Query params:
 * - timeframe: 24h, 7d, 30d (default 7d)
 * - limit: number of queries to return (default 20, max 100)
 * - min_frequency: minimum query frequency (default 2)
 * - include_success_rate: include success rate data (default true)
 */
router.get('/popular-queries', async (req, res) => {
    try {
        const { 
            timeframe = '7d', 
            limit = 20, 
            min_frequency = 2,
            include_success_rate = 'true'
        } = req.query;
        
        const validTimeframes = ['24h', '7d', '30d'];
        if (!validTimeframes.includes(timeframe)) {
            return res.status(400).json({
                error: 'Invalid timeframe',
                valid_options: validTimeframes
            });
        }
        
        const days = timeframe === '24h' ? 1 : timeframe === '7d' ? 7 : 30;
        const maxLimit = Math.min(parseInt(limit) || 20, 100);
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        let query = `
            SELECT 
                squ.processed_query,
                squ.primary_intent,
                COUNT(*) as query_frequency,
                AVG(squ.intent_confidence) as avg_confidence,
                COUNT(DISTINCT squ.user_id) as unique_users,
                MAX(squ.created_at) as last_searched
        `;
        
        if (include_success_rate === 'true') {
            query += `,
                COUNT(CASE WHEN sri.search_success = TRUE THEN 1 END) as success_count,
                AVG(CASE WHEN sri.user_satisfaction_score IS NOT NULL THEN sri.user_satisfaction_score END) as avg_satisfaction,
                CASE 
                    WHEN COUNT(sri.id) > 0 THEN 
                        COUNT(CASE WHEN sri.search_success = TRUE THEN 1 END) / COUNT(sri.id)
                    ELSE NULL 
                END as success_rate
            `;
        }
        
        query += `
            FROM search_query_understanding squ
        `;
        
        if (include_success_rate === 'true') {
            query += `
                LEFT JOIN search_result_interactions sri ON squ.id = sri.query_understanding_id
            `;
        }
        
        query += `
            WHERE squ.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
              AND squ.processed_query IS NOT NULL
              AND squ.processed_query != ''
            GROUP BY squ.processed_query, squ.primary_intent
            HAVING COUNT(*) >= ?
            ORDER BY query_frequency DESC, avg_confidence DESC
            LIMIT ?
        `;
        
        const [popularQueries] = await db.execute(query, [days, parseInt(min_frequency), maxLimit]);
        
        // Process results
        const processedQueries = popularQueries.map(row => ({
            ...row,
            query_frequency: parseInt(row.query_frequency),
            avg_confidence: parseFloat(row.avg_confidence || 0),
            unique_users: parseInt(row.unique_users || 0),
            success_count: parseInt(row.success_count || 0),
            avg_satisfaction: row.avg_satisfaction ? parseFloat(row.avg_satisfaction) : null,
            success_rate: row.success_rate ? parseFloat(row.success_rate) : null
        }));
        
        await db.end();
        
        res.json({
            success: true,
            popular_queries: processedQueries,
            metadata: {
                timeframe,
                total_queries: processedQueries.length,
                min_frequency: parseInt(min_frequency),
                includes_success_metrics: include_success_rate === 'true'
            }
        });
        
    } catch (error) {
        console.error('Popular queries error:', error);
        res.status(500).json({
            error: 'Failed to get popular queries',
            details: error.message
        });
    }
});

/**
 * POST /api/search-query-understanding/test
 * Test search query understanding with sample data
 */
router.post('/test', ensureServiceReady, async (req, res) => {
    try {
        const testQueries = [
            'find premium galleries with brunette models',
            'show me popular content',
            'brunette model profiles',
            'search for exclusive photos',
            'trending models this week'
        ];
        
        console.log('🧪 Running search query understanding test with sample queries');
        
        const testResults = [];
        
        for (const query of testQueries) {
            const testContext = {
                user_id: 999, // Test user
                session_id: 'test_session_' + Date.now(),
                device_type: 'desktop',
                forceRefresh: true
            };
            
            const understanding = await searchQueryService.processSearchQuery(query, testContext);
            
            testResults.push({
                query,
                understanding: {
                    primary_intent: understanding.intent_classification?.primary_intent,
                    confidence: understanding.intent_classification?.confidence,
                    entities: understanding.entity_extraction?.entities?.length || 0,
                    language: understanding.language_detection?.detected_language,
                    processing_time: understanding.processing_metadata?.processing_time_ms
                }
            });
        }
        
        res.json({
            success: true,
            test_queries: testQueries.length,
            test_results: testResults,
            message: 'Search query understanding test completed successfully'
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
    console.error('Search Query Understanding API Error:', error);
    res.status(500).json({
        error: 'Internal server error in Search Query Understanding API',
        details: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    });
});

module.exports = router;