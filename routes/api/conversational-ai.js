/**
 * Conversational AI and Customer Support API Routes
 * 
 * RESTful API endpoints for conversational AI, chatbot interactions,
 * customer support automation, and AI-powered assistance.
 */

const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

// Initialize Conversational AI Service
let conversationalService = null;

async function initializeService() {
    if (!conversationalService) {
        const ConversationalAIService = require('../../src/services/ConversationalAIService');
        
        // Create database connection for the service
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        conversationalService = new ConversationalAIService(db);
        await conversationalService.initialize();
    }
    return conversationalService;
}

// Middleware to ensure service is initialized
async function ensureServiceReady(req, res, next) {
    try {
        await initializeService();
        next();
    } catch (error) {
        console.error('Failed to initialize Conversational AI Service:', error);
        res.status(503).json({
            error: 'Conversational AI Service unavailable',
            details: error.message
        });
    }
}

/**
 * GET /api/conversational-ai/health
 * Get service health status and AI performance metrics
 */
router.get('/health', ensureServiceReady, async (req, res) => {
    try {
        const health = await conversationalService.getServiceHealthStatus();
        res.json(health);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get health status',
            details: error.message
        });
    }
});

/**
 * POST /api/conversational-ai/start-conversation
 * Start a new conversation session with the AI
 * 
 * Body: {
 *   "userId": 123,
 *   "initialContext": {
 *     "channel": "web",
 *     "device_type": "desktop",
 *     "language": "en",
 *     "user_agent": "Mozilla/5.0...",
 *     "ip_address": "192.168.1.100"
 *   }
 * }
 */
router.post('/start-conversation', ensureServiceReady, async (req, res) => {
    try {
        const { userId, initialContext = {} } = req.body;
        
        if (!userId) {
            return res.status(400).json({
                error: 'Missing required parameter',
                required: ['userId']
            });
        }
        
        console.log(`🆕 Starting conversation for user: ${userId}`);
        
        const conversation = await conversationalService.startConversation(userId, initialContext);
        
        res.json({
            success: true,
            ...conversation
        });
        
    } catch (error) {
        console.error('Start conversation error:', error);
        res.status(500).json({
            error: 'Failed to start conversation',
            details: error.message
        });
    }
});

/**
 * POST /api/conversational-ai/message
 * Send a message to the AI and get a response
 * 
 * Body: {
 *   "userId": 123,
 *   "message": "Hello, I need help with my account",
 *   "conversationContext": {
 *     "conversation_id": "CONV_123456_789",
 *     "language": "en",
 *     "channel": "web"
 *   }
 * }
 */
router.post('/message', ensureServiceReady, async (req, res) => {
    try {
        const { userId, message, conversationContext = {} } = req.body;
        
        if (!userId || !message) {
            return res.status(400).json({
                error: 'Missing required parameters',
                required: ['userId', 'message']
            });
        }
        
        if (typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({
                error: 'Invalid message',
                message: 'Message must be a non-empty string'
            });
        }
        
        console.log(`💬 Processing message from user: ${userId}`);
        
        const conversationResult = await conversationalService.processUserMessage(
            userId, 
            message.trim(), 
            conversationContext
        );
        
        res.json({
            success: !conversationResult.error,
            ...conversationResult
        });
        
    } catch (error) {
        console.error('Message processing error:', error);
        res.status(500).json({
            error: 'Failed to process message',
            details: error.message
        });
    }
});

/**
 * POST /api/conversational-ai/end-conversation
 * End a conversation session
 * 
 * Body: {
 *   "userId": 123,
 *   "endReason": "user_initiated"
 * }
 */
router.post('/end-conversation', ensureServiceReady, async (req, res) => {
    try {
        const { userId, endReason = 'user_initiated' } = req.body;
        
        if (!userId) {
            return res.status(400).json({
                error: 'Missing required parameter',
                required: ['userId']
            });
        }
        
        console.log(`🏁 Ending conversation for user: ${userId}`);
        
        const result = await conversationalService.endConversation(userId, endReason);
        
        res.json(result);
        
    } catch (error) {
        console.error('End conversation error:', error);
        res.status(500).json({
            error: 'Failed to end conversation',
            details: error.message
        });
    }
});

/**
 * GET /api/conversational-ai/conversation/:conversationId
 * Get conversation details and history
 * 
 * Query params:
 * - include_turns: include conversation turns (default true)
 * - include_analytics: include conversation analytics (default false)
 */
router.get('/conversation/:conversationId', async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { 
            include_turns = 'true', 
            include_analytics = 'false' 
        } = req.query;
        
        if (!conversationId) {
            return res.status(400).json({
                error: 'Invalid conversation ID',
                message: 'Conversation ID is required'
            });
        }
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        // Get conversation session
        const [conversation] = await db.execute(`
            SELECT * FROM conversation_sessions WHERE conversation_id = ?
        `, [conversationId]);
        
        if (conversation.length === 0) {
            await db.end();
            return res.status(404).json({
                error: 'Conversation not found',
                conversation_id: conversationId
            });
        }
        
        const conversationData = conversation[0];
        
        // Parse JSON fields
        conversationData.conversation_context = JSON.parse(conversationData.conversation_context || '{}');
        conversationData.user_profile_data = JSON.parse(conversationData.user_profile_data || '{}');
        conversationData.session_metadata = JSON.parse(conversationData.session_metadata || '{}');
        
        // Get conversation turns if requested
        if (include_turns === 'true') {
            const [turns] = await db.execute(`
                SELECT 
                    turn_number,
                    message_type,
                    message_content,
                    user_intent,
                    intent_confidence,
                    sentiment_score,
                    sentiment_label,
                    response_type,
                    response_confidence,
                    user_feedback,
                    created_at
                FROM conversation_turns 
                WHERE conversation_id = ? 
                ORDER BY turn_number ASC
            `, [conversationId]);
            
            conversationData.conversation_turns = turns.map(turn => ({
                ...turn,
                intent_confidence: parseFloat(turn.intent_confidence || 0),
                sentiment_score: parseFloat(turn.sentiment_score || 0),
                response_confidence: parseFloat(turn.response_confidence || 0)
            }));
        }
        
        // Get analytics if requested
        if (include_analytics === 'true') {
            // Get intent distribution
            const [intentStats] = await db.execute(`
                SELECT 
                    user_intent,
                    COUNT(*) as count,
                    AVG(intent_confidence) as avg_confidence
                FROM conversation_turns 
                WHERE conversation_id = ? AND user_intent IS NOT NULL
                GROUP BY user_intent
                ORDER BY count DESC
            `, [conversationId]);
            
            // Get sentiment analysis
            const [sentimentStats] = await db.execute(`
                SELECT 
                    sentiment_label,
                    COUNT(*) as count,
                    AVG(sentiment_score) as avg_score
                FROM conversation_turns 
                WHERE conversation_id = ? AND sentiment_label IS NOT NULL
                GROUP BY sentiment_label
                ORDER BY count DESC
            `, [conversationId]);
            
            conversationData.analytics = {
                intent_distribution: intentStats,
                sentiment_analysis: sentimentStats.map(stat => ({
                    ...stat,
                    avg_score: parseFloat(stat.avg_score || 0)
                }))
            };
        }
        
        await db.end();
        
        res.json({
            success: true,
            conversation: conversationData
        });
        
    } catch (error) {
        console.error('Get conversation error:', error);
        res.status(500).json({
            error: 'Failed to get conversation',
            details: error.message
        });
    }
});

/**
 * GET /api/conversational-ai/knowledge-base
 * Get knowledge base entries for customer support
 * 
 * Query params:
 * - category: filter by category (optional)
 * - content_type: filter by content type (optional)
 * - search: search query (optional)
 * - limit: number of results (default 20, max 100)
 */
router.get('/knowledge-base', async (req, res) => {
    try {
        const { 
            category, 
            content_type, 
            search, 
            limit = 20 
        } = req.query;
        
        const limitNum = Math.min(parseInt(limit) || 20, 100);
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        let query = `
            SELECT 
                knowledge_id,
                title,
                content,
                content_type,
                category,
                subcategory,
                tags,
                keywords,
                accuracy_score,
                usefulness_score,
                usage_count,
                success_rate,
                last_used_at,
                created_at,
                updated_at
            FROM ai_knowledge_base 
            WHERE is_active = TRUE
        `;
        const params = [];
        
        if (category) {
            query += ' AND category = ?';
            params.push(category);
        }
        
        if (content_type) {
            query += ' AND content_type = ?';
            params.push(content_type);
        }
        
        if (search) {
            query += ' AND (title LIKE ? OR content LIKE ? OR category LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }
        
        query += ' ORDER BY usefulness_score DESC, usage_count DESC LIMIT ?';
        params.push(limitNum);
        
        const [knowledgeEntries] = await db.execute(query, params);
        
        await db.end();
        
        // Process results
        const processedEntries = knowledgeEntries.map(entry => ({
            ...entry,
            tags: JSON.parse(entry.tags || '[]'),
            keywords: JSON.parse(entry.keywords || '[]'),
            accuracy_score: parseFloat(entry.accuracy_score || 0),
            usefulness_score: parseFloat(entry.usefulness_score || 0),
            usage_count: parseInt(entry.usage_count || 0),
            success_rate: parseFloat(entry.success_rate || 0)
        }));
        
        res.json({
            success: true,
            knowledge_entries: processedEntries,
            total_results: processedEntries.length,
            search_params: { category, content_type, search, limit: limitNum }
        });
        
    } catch (error) {
        console.error('Knowledge base query error:', error);
        res.status(500).json({
            error: 'Failed to query knowledge base',
            details: error.message
        });
    }
});

/**
 * GET /api/conversational-ai/analytics
 * Get comprehensive conversation analytics
 * 
 * Query params:
 * - timeframe: 7d, 30d, 90d (default 30d)
 * - user_id: filter by specific user (optional)
 * - channel: filter by channel (optional)
 */
router.get('/analytics', ensureServiceReady, async (req, res) => {
    try {
        const { 
            timeframe = '30d', 
            user_id,
            channel 
        } = req.query;
        
        const validTimeframes = ['7d', '30d', '90d'];
        if (!validTimeframes.includes(timeframe)) {
            return res.status(400).json({
                error: 'Invalid timeframe',
                valid_options: validTimeframes
            });
        }
        
        console.log(`📊 Generating conversational AI analytics for timeframe: ${timeframe}`);
        
        const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        // Get conversation performance metrics
        const [performanceMetrics] = await db.execute(`
            SELECT * FROM v_conversation_performance_summary 
            WHERE conversation_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            ${channel ? 'AND channel = ?' : ''}
            ORDER BY conversation_date DESC
        `, channel ? [days, channel] : [days]);
        
        // Get intent classification performance
        const [intentPerformance] = await db.execute(`
            SELECT * FROM v_intent_classification_performance 
            WHERE total_classifications > 0
            ORDER BY total_classifications DESC
            LIMIT 20
        `);
        
        // Get knowledge base effectiveness
        const [knowledgeEffectiveness] = await db.execute(`
            SELECT * FROM v_knowledge_base_effectiveness 
            ORDER BY usage_count DESC
            LIMIT 15
        `);
        
        // Get user satisfaction trends
        const [satisfactionTrends] = await db.execute(`
            SELECT 
                DATE(started_at) as date,
                AVG(satisfaction_rating) as avg_satisfaction,
                COUNT(CASE WHEN satisfaction_rating >= 4.0 THEN 1 END) as high_satisfaction_count,
                COUNT(*) as total_conversations
            FROM conversation_sessions 
            WHERE started_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
              AND satisfaction_rating IS NOT NULL
              ${user_id ? 'AND user_id = ?' : ''}
              ${channel ? 'AND channel = ?' : ''}
            GROUP BY DATE(started_at)
            ORDER BY date DESC
        `, [days, user_id, channel].filter(Boolean));
        
        await db.end();
        
        // Process results
        const analytics = {
            timeframe,
            generated_at: new Date().toISOString(),
            
            performance_metrics: performanceMetrics.map(metric => ({
                ...metric,
                total_conversations: parseInt(metric.total_conversations || 0),
                successful_resolutions: parseInt(metric.successful_resolutions || 0),
                agent_handoffs: parseInt(metric.agent_handoffs || 0),
                avg_conversation_length: parseFloat(metric.avg_conversation_length || 0),
                avg_duration_seconds: parseFloat(metric.avg_duration_seconds || 0),
                avg_satisfaction_rating: parseFloat(metric.avg_satisfaction_rating || 0),
                avg_ai_performance: parseFloat(metric.avg_ai_performance || 0)
            })),
            
            intent_performance: intentPerformance.map(intent => ({
                ...intent,
                total_classifications: parseInt(intent.total_classifications || 0),
                avg_confidence: parseFloat(intent.avg_confidence || 0),
                helpful_responses: parseInt(intent.helpful_responses || 0),
                unhelpful_responses: parseInt(intent.unhelpful_responses || 0),
                classification_accuracy: parseFloat(intent.classification_accuracy || 0),
                resolution_rate: parseFloat(intent.resolution_rate || 0),
                user_satisfaction: parseFloat(intent.user_satisfaction || 0)
            })),
            
            knowledge_effectiveness: knowledgeEffectiveness.map(knowledge => ({
                ...knowledge,
                usage_count: parseInt(knowledge.usage_count || 0),
                accuracy_score: parseFloat(knowledge.accuracy_score || 0),
                usefulness_score: parseFloat(knowledge.usefulness_score || 0),
                success_rate: parseFloat(knowledge.success_rate || 0),
                positive_feedback_count: parseInt(knowledge.positive_feedback_count || 0),
                negative_feedback_count: parseInt(knowledge.negative_feedback_count || 0),
                feedback_ratio: parseFloat(knowledge.feedback_ratio || 0),
                days_since_review: parseInt(knowledge.days_since_review || 0)
            })),
            
            satisfaction_trends: satisfactionTrends.map(trend => ({
                ...trend,
                avg_satisfaction: parseFloat(trend.avg_satisfaction || 0),
                high_satisfaction_count: parseInt(trend.high_satisfaction_count || 0),
                total_conversations: parseInt(trend.total_conversations || 0)
            }))
        };
        
        res.json({
            success: true,
            ...analytics
        });
        
    } catch (error) {
        console.error('Analytics generation error:', error);
        res.status(500).json({
            error: 'Failed to generate analytics',
            details: error.message
        });
    }
});

/**
 * GET /api/conversational-ai/dashboard
 * Get conversational AI dashboard data
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
        
        // Get conversation summary
        const [conversationSummary] = await db.execute(`
            SELECT 
                COUNT(*) as total_conversations,
                COUNT(CASE WHEN session_status = 'ended' THEN 1 END) as completed_conversations,
                COUNT(CASE WHEN escalated_to_agent = TRUE THEN 1 END) as agent_handoffs,
                AVG(satisfaction_rating) as avg_satisfaction,
                AVG(turn_count) as avg_conversation_length,
                COUNT(CASE WHEN started_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR) THEN 1 END) as conversations_last_hour
            FROM conversation_sessions 
            WHERE started_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        `, [days]);
        
        // Get top intents
        const [topIntents] = await db.execute(`
            SELECT 
                user_intent,
                COUNT(*) as frequency,
                AVG(intent_confidence) as avg_confidence,
                COUNT(CASE WHEN user_feedback = 'helpful' THEN 1 END) as helpful_count
            FROM conversation_turns 
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
              AND user_intent IS NOT NULL
            GROUP BY user_intent 
            ORDER BY frequency DESC 
            LIMIT 10
        `, [days]);
        
        // Get knowledge base performance
        const [knowledgePerformance] = await db.execute(`
            SELECT 
                COUNT(*) as total_articles,
                AVG(usage_count) as avg_usage,
                AVG(success_rate) as avg_success_rate,
                COUNT(CASE WHEN last_used_at >= DATE_SUB(NOW(), INTERVAL ? DAY) THEN 1 END) as articles_used_recently
            FROM ai_knowledge_base 
            WHERE is_active = TRUE
        `, [days]);
        
        // Get recent conversations
        const [recentConversations] = await db.execute(`
            SELECT 
                conversation_id,
                user_id,
                session_status,
                satisfaction_rating,
                turn_count,
                started_at,
                ended_at
            FROM conversation_sessions 
            WHERE started_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            ORDER BY started_at DESC 
            LIMIT 20
        `, [days]);
        
        await db.end();
        
        // Process results
        const dashboard = {
            timeframe,
            generated_at: new Date().toISOString(),
            
            conversation_summary: conversationSummary[0] ? {
                total_conversations: parseInt(conversationSummary[0].total_conversations || 0),
                completed_conversations: parseInt(conversationSummary[0].completed_conversations || 0),
                agent_handoffs: parseInt(conversationSummary[0].agent_handoffs || 0),
                avg_satisfaction: parseFloat(conversationSummary[0].avg_satisfaction || 0),
                avg_conversation_length: parseFloat(conversationSummary[0].avg_conversation_length || 0),
                conversations_last_hour: parseInt(conversationSummary[0].conversations_last_hour || 0)
            } : {},
            
            top_intents: topIntents.map(intent => ({
                ...intent,
                frequency: parseInt(intent.frequency || 0),
                avg_confidence: parseFloat(intent.avg_confidence || 0),
                helpful_count: parseInt(intent.helpful_count || 0)
            })),
            
            knowledge_performance: knowledgePerformance[0] ? {
                total_articles: parseInt(knowledgePerformance[0].total_articles || 0),
                avg_usage: parseFloat(knowledgePerformance[0].avg_usage || 0),
                avg_success_rate: parseFloat(knowledgePerformance[0].avg_success_rate || 0),
                articles_used_recently: parseInt(knowledgePerformance[0].articles_used_recently || 0)
            } : {},
            
            recent_conversations: recentConversations.map(conv => ({
                ...conv,
                user_id: parseInt(conv.user_id || 0),
                satisfaction_rating: parseFloat(conv.satisfaction_rating || 0),
                turn_count: parseInt(conv.turn_count || 0)
            }))
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
 * POST /api/conversational-ai/test
 * Test conversational AI with sample interactions
 */
router.post('/test', ensureServiceReady, async (req, res) => {
    try {
        const testScenarios = [
            { 
                user_id: 2001, 
                message: 'Hello, I need help with my account', 
                expected_intent: 'account_help' 
            },
            { 
                user_id: 2002, 
                message: 'I can\'t log into my account', 
                expected_intent: 'technical_support_issue' 
            },
            { 
                user_id: 2003, 
                message: 'How much does the premium subscription cost?', 
                expected_intent: 'billing_question' 
            }
        ];
        
        console.log('🧪 Running conversational AI test');
        
        const testResults = [];
        
        for (const scenario of testScenarios) {
            // Start conversation
            const conversation = await conversationalService.startConversation(
                scenario.user_id, 
                { channel: 'test', test_mode: true }
            );
            
            // Process message
            const result = await conversationalService.processUserMessage(
                scenario.user_id,
                scenario.message,
                { conversation_id: conversation.conversation_id, test_mode: true }
            );
            
            // End conversation
            await conversationalService.endConversation(scenario.user_id, 'test_completed');
            
            testResults.push({
                user_id: scenario.user_id,
                test_message: scenario.message,
                expected_intent: scenario.expected_intent,
                detected_intent: result.nlu_analysis?.primary_intent,
                intent_confidence: result.nlu_analysis?.confidence,
                response_generated: result.ai_response?.message || 'No response',
                response_confidence: result.response_confidence,
                processing_time_ms: result.processing_time_ms,
                test_passed: result.nlu_analysis?.primary_intent === scenario.expected_intent
            });
        }
        
        const successRate = testResults.filter(r => r.test_passed).length / testResults.length;
        
        res.json({
            success: true,
            test_scenarios: testScenarios.length,
            test_results: testResults,
            success_rate: successRate,
            avg_processing_time: testResults.reduce((sum, r) => sum + r.processing_time_ms, 0) / testResults.length,
            message: 'Conversational AI test completed successfully'
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
    console.error('Conversational AI API Error:', error);
    res.status(500).json({
        error: 'Internal server error in Conversational AI API',
        details: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    });
});

module.exports = router;