/**
 * Smart Content Moderation API Routes
 * 
 * RESTful API endpoints for ML-based content violation detection and automated moderation.
 * Provides comprehensive violation detection, automated action execution, and appeals processing
 * with real-time monitoring and analytics.
 */

const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

// Initialize Content Moderation Service
let contentModerationService = null;

async function initializeService() {
    if (!contentModerationService) {
        const ContentModerationService = require('../../src/services/ContentModerationService');
        
        // Create database connection for the service
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        contentModerationService = new ContentModerationService(db);
        await contentModerationService.initializeRedisConnection();
    }
    return contentModerationService;
}

// Middleware to ensure service is initialized
async function ensureServiceReady(req, res, next) {
    try {
        await initializeService();
        next();
    } catch (error) {
        console.error('Failed to initialize Content Moderation Service:', error);
        res.status(503).json({
            error: 'Content Moderation Service unavailable',
            details: error.message
        });
    }
}

/**
 * GET /api/smart-content-moderation/health
 * Get service health status and performance metrics
 */
router.get('/health', ensureServiceReady, async (req, res) => {
    try {
        const health = await contentModerationService.getServiceHealthStatus();
        res.json(health);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get health status',
            details: error.message
        });
    }
});

/**
 * POST /api/smart-content-moderation/detect-violations
 * Run comprehensive violation detection on content
 * 
 * Body: {
 *   "contentId": "content123",
 *   "contentData": {
 *     "id": "content123",
 *     "hash": "sha256hash",
 *     "nudity_score": 85.5,
 *     "detected_parts": {"GENITALIA": 90.0},
 *     "description_text": "Image description...",
 *     "venice_description": "AI-generated description...",
 *     "title": "Content title"
 *   },
 *   "options": {
 *     "forceRefresh": false
 *   }
 * }
 */
router.post('/detect-violations', ensureServiceReady, async (req, res) => {
    try {
        const { contentData, options = {} } = req.body;
        
        if (!contentData || !contentData.id) {
            return res.status(400).json({
                error: 'Missing required field',
                required: ['contentData.id']
            });
        }
        
        console.log(`🔍 Detecting violations for content: ${contentData.id}`);
        
        const violationResults = await contentModerationService.detectViolations(contentData, options);
        
        res.json({
            success: !violationResults.error,
            ...violationResults
        });
        
    } catch (error) {
        console.error('Violation detection error:', error);
        res.status(500).json({
            error: 'Failed to detect violations',
            details: error.message
        });
    }
});

/**
 * POST /api/smart-content-moderation/execute-action
 * Execute automated moderation action
 * 
 * Body: {
 *   "contentId": "content123",
 *   "violationResults": {
 *     "recommended_action": "content_removal",
 *     "risk_level": "high",
 *     "violations": [...],
 *     "severity_score": 0.85
 *   },
 *   "options": {
 *     "forceExecute": false
 *   }
 * }
 */
router.post('/execute-action', ensureServiceReady, async (req, res) => {
    try {
        const { contentId, violationResults, options = {} } = req.body;
        
        if (!contentId || !violationResults) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['contentId', 'violationResults']
            });
        }
        
        console.log(`🤖 Executing action for content ${contentId}: ${violationResults.recommended_action}`);
        
        const actionResult = await contentModerationService.executeAutomatedAction(
            contentId, 
            violationResults, 
            options
        );
        
        res.json({
            success: true,
            ...actionResult
        });
        
    } catch (error) {
        console.error('Action execution error:', error);
        res.status(500).json({
            error: 'Failed to execute moderation action',
            details: error.message
        });
    }
});

/**
 * POST /api/smart-content-moderation/appeals/:appealId/process
 * Process a content moderation appeal
 * 
 * Body: {
 *   "reviewDecision": "approved|rejected|partial_approval",
 *   "reviewerNotes": "Detailed review notes...",
 *   "reviewedBy": "reviewer_id"
 * }
 */
router.post('/appeals/:appealId/process', ensureServiceReady, async (req, res) => {
    try {
        const { appealId } = req.params;
        const { reviewDecision, reviewerNotes, reviewedBy } = req.body;
        
        if (!reviewDecision || !reviewedBy) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['reviewDecision', 'reviewedBy']
            });
        }
        
        const validDecisions = ['approved', 'rejected', 'partial_approval'];
        if (!validDecisions.includes(reviewDecision)) {
            return res.status(400).json({
                error: 'Invalid review decision',
                valid_options: validDecisions
            });
        }
        
        console.log(`📋 Processing appeal ${appealId} with decision: ${reviewDecision}`);
        
        const processingResult = await contentModerationService.processAppeal(
            appealId,
            reviewDecision,
            reviewerNotes || '',
            reviewedBy
        );
        
        res.json({
            success: true,
            ...processingResult
        });
        
    } catch (error) {
        console.error('Appeal processing error:', error);
        res.status(500).json({
            error: 'Failed to process appeal',
            details: error.message
        });
    }
});

/**
 * GET /api/smart-content-moderation/analytics
 * Get comprehensive moderation analytics
 * 
 * Query params:
 * - timeframe: 24h, 7d, 30d (default 24h)
 */
router.get('/analytics', ensureServiceReady, async (req, res) => {
    try {
        const { timeframe = '24h' } = req.query;
        
        const validTimeframes = ['24h', '7d', '30d'];
        if (!validTimeframes.includes(timeframe)) {
            return res.status(400).json({
                error: 'Invalid timeframe',
                valid_options: validTimeframes
            });
        }
        
        console.log(`📊 Generating moderation analytics for timeframe: ${timeframe}`);
        
        const analytics = await contentModerationService.getModerationAnalytics(timeframe);
        
        res.json({
            success: true,
            ...analytics
        });
        
    } catch (error) {
        console.error('Analytics generation error:', error);
        res.status(500).json({
            error: 'Failed to get moderation analytics',
            details: error.message
        });
    }
});

/**
 * GET /api/smart-content-moderation/violations
 * Get violation detection results for content
 * 
 * Query params:
 * - content_ids: comma-separated list of content IDs
 * - risk_level: filter by risk level (minimal, low, medium, high, critical)
 * - violation_type: filter by violation type
 * - limit: number of results (default 50)
 * - include_resolved: include resolved violations (default false)
 */
router.get('/violations', async (req, res) => {
    try {
        const { 
            content_ids, 
            risk_level, 
            violation_type, 
            limit = 50, 
            include_resolved = 'false' 
        } = req.query;
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        let query = `
            SELECT 
                cv.id,
                cv.content_id,
                cv.violation_type,
                cv.severity,
                cv.confidence_score,
                cv.description,
                cv.detected_elements,
                cv.policy_violation,
                cv.is_resolved,
                cv.created_at,
                cm.model_id,
                cm.moderation_status,
                cm.final_risk_score
            FROM content_violations cv
            LEFT JOIN content_moderation cm ON cv.content_id = cm.id
        `;
        
        const params = [];
        const conditions = [];
        
        if (content_ids) {
            const contentIdList = content_ids.split(',').map(id => id.trim());
            conditions.push(`cv.content_id IN (${contentIdList.map(() => '?').join(',')})`);
            params.push(...contentIdList);
        }
        
        if (risk_level) {
            conditions.push('cv.severity = ?');
            params.push(risk_level);
        }
        
        if (violation_type) {
            conditions.push('cv.violation_type = ?');
            params.push(violation_type);
        }
        
        if (include_resolved === 'false') {
            conditions.push('cv.is_resolved = FALSE');
        }
        
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ' ORDER BY cv.created_at DESC LIMIT ?';
        params.push(parseInt(limit));
        
        const [violations] = await db.execute(query, params);
        
        // Parse JSON fields
        const parsedViolations = violations.map(violation => ({
            ...violation,
            detected_elements: JSON.parse(violation.detected_elements || '[]'),
            confidence_score: parseFloat(violation.confidence_score || 0),
            final_risk_score: parseFloat(violation.final_risk_score || 0)
        }));
        
        await db.end();
        
        res.json({
            success: true,
            violations: parsedViolations,
            count: parsedViolations.length,
            filters: { content_ids, risk_level, violation_type, limit: parseInt(limit) }
        });
        
    } catch (error) {
        console.error('Violations retrieval error:', error);
        res.status(500).json({
            error: 'Failed to get violations',
            details: error.message
        });
    }
});

/**
 * GET /api/smart-content-moderation/appeals
 * Get moderation appeals with filtering
 * 
 * Query params:
 * - status: filter by appeal status (pending, approved, rejected)
 * - model_id: filter by model ID
 * - limit: number of results (default 20)
 */
router.get('/appeals', async (req, res) => {
    try {
        const { status, model_id, limit = 20 } = req.query;
        
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'musenest'
        });
        
        let query = `
            SELECT 
                ma.id,
                ma.content_moderation_id,
                ma.model_id,
                ma.appeal_reason,
                ma.appeal_message,
                ma.appeal_status,
                ma.review_decision,
                ma.reviewer_notes,
                ma.reviewed_by,
                ma.created_at,
                ma.reviewed_at,
                cm.moderation_status,
                cm.flagged,
                cm.auto_rejected,
                m.name as model_name,
                m.slug as model_slug
            FROM moderation_appeals ma
            LEFT JOIN content_moderation cm ON ma.content_moderation_id = cm.id
            LEFT JOIN models m ON ma.model_id = m.id
        `;
        
        const params = [];
        const conditions = [];
        
        if (status) {
            conditions.push('ma.appeal_status = ?');
            params.push(status);
        }
        
        if (model_id) {
            conditions.push('ma.model_id = ?');
            params.push(model_id);
        }
        
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ' ORDER BY ma.created_at DESC LIMIT ?';
        params.push(parseInt(limit));
        
        const [appeals] = await db.execute(query, params);
        
        await db.end();
        
        res.json({
            success: true,
            appeals,
            count: appeals.length,
            filters: { status, model_id, limit: parseInt(limit) }
        });
        
    } catch (error) {
        console.error('Appeals retrieval error:', error);
        res.status(500).json({
            error: 'Failed to get appeals',
            details: error.message
        });
    }
});

/**
 * POST /api/smart-content-moderation/test
 * Test violation detection with sample data
 */
router.post('/test', ensureServiceReady, async (req, res) => {
    try {
        const sampleContent = {
            id: 'test_' + Date.now(),
            hash: 'sample_hash_' + Math.random().toString(36).substr(2, 9),
            nudity_score: 75.5,
            detected_parts: {
                "FEMALE_BREAST_EXPOSED": 80.0,
                "FACE_FEMALE": 95.0
            },
            description_text: "Sample image for testing violation detection",
            venice_description: "AI-generated description of sample content",
            title: "Test Content"
        };
        
        console.log('🧪 Running violation detection test with sample data');
        
        const violationResults = await contentModerationService.detectViolations(sampleContent, { forceRefresh: true });
        
        res.json({
            success: true,
            test_data: sampleContent,
            results: violationResults,
            message: 'Violation detection test completed successfully'
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
    console.error('Smart Content Moderation API Error:', error);
    res.status(500).json({
        error: 'Internal server error in Smart Content Moderation API',
        details: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    });
});

module.exports = router;