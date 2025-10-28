const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const logger = require('../../utils/logger');
const { impersonationManager } = require('../../middleware/impersonation');

// Start impersonation session
router.post('/start', async (req, res) => {
    try {
        const { model_id, restrictions = {}, session_duration_hours = 24, destination = 'paysite' } = req.body;
        // For testing purposes, use a default admin user ID
        // In production, this would come from your authentication system
        const adminUserId = req.user?.id || req.session?.userId || 1; // Default to user ID 1 for testing

        if (!adminUserId) return res.fail(401, 'Authentication required');

        if (!model_id) return res.fail(400, 'Model ID is required');

        // Get session data for audit logging
        const sessionData = {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            sessionDurationHours: session_duration_hours
        };

        // Start impersonation
        const result = await impersonationManager.startImpersonation(
            adminUserId,
            model_id,
            restrictions,
            sessionData
        );

        // Set session data for middleware to pick up
        if (req.session) {
            req.session.impersonationSessionId = result.session_id;
        }

        // Set impersonation session cookie for seamless authentication
        res.cookie('impersonation_session', result.session_id, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: session_duration_hours * 60 * 60 * 1000, // Convert hours to milliseconds
            sameSite: 'lax'
        });

        res.success({
            ...result,
            destination: destination,
            redirect_url: destination === 'admin' 
                ? `/admin/index.html?model=${result.impersonated_model.slug}`
                : `/${result.impersonated_model.slug}`
        }, { message: 'Impersonation session started successfully' });

    } catch (error) {
        logger.warn('impersonation.start error', { error: error.message });
        res.fail(400, 'Failed to start impersonation session', error.message);
    }
});

// End impersonation session
router.post('/end', async (req, res) => {
    try {
        const sessionId = req.cookies?.impersonation_session || 
                         req.session?.impersonationSessionId || 
                         req.body.session_id;

        if (!sessionId) return res.fail(400, 'No active impersonation session found');

        const result = await impersonationManager.endImpersonation(sessionId, 'manual');

        // Clear session data
        if (req.session) {
            delete req.session.impersonationSessionId;
        }

        // Clear impersonation cookie
        res.clearCookie('impersonation_session');

        res.success(result, { message: 'Impersonation session ended successfully' });

    } catch (error) {
        logger.warn('impersonation.end error', { error: error.message });
        res.fail(400, 'Failed to end impersonation session', error.message);
    }
});

// Get current impersonation status
// Generate JWT token for impersonated user
router.post('/generate-token', async (req, res) => {
    try {
        const sessionId = req.cookies?.impersonation_session || 
                         req.session?.impersonationSessionId || 
                         req.headers['x-impersonation-session'];

        if (!sessionId) return res.fail(400, 'No active impersonation session found');

        const status = impersonationManager.getImpersonationStatus(sessionId);

        if (!status) return res.fail(400, 'Invalid impersonation session');

        // Get the impersonated model's user data
        const impersonationData = impersonationManager.activeImpersonations.get(sessionId);
        const modelId = impersonationData ? impersonationData.impersonated_model_id : null;
        
        if (!modelId) return res.fail(400, 'Invalid impersonation data');

        const [users] = await db.execute(`
            SELECT u.id, u.email, u.role, u.is_active
            FROM models m
            JOIN model_users mu ON m.id = mu.model_id
            JOIN users u ON mu.user_id = u.id
            WHERE m.id = ? AND mu.role = 'owner' AND mu.is_active = true
        `, [modelId]);

        if (users.length === 0) return res.fail(400, 'Impersonated user not found');

        // Generate JWT token for the impersonated user
        const { generateToken } = require('../../src/middleware/auth');
        const token = generateToken(users[0]);

        res.success({ token, user: users[0] });

    } catch (error) {
        logger.error('impersonation.generate-token error', { error: error.message });
        res.fail(500, 'Failed to generate impersonation token', error.message);
    }
});

router.get('/status', async (req, res) => {
    try {
        const sessionId = req.cookies?.impersonation_session || 
                         req.session?.impersonationSessionId || 
                         req.headers['x-impersonation-session'];

        if (!sessionId) return res.success({ is_impersonating: false });

        const status = impersonationManager.getImpersonationStatus(sessionId);

        if (!status) return res.success({ is_impersonating: false });

        res.success({ is_impersonating: true, ...status });

    } catch (error) {
        logger.error('impersonation.status error', { error: error.message });
        res.fail(500, 'Failed to get impersonation status', error.message);
    }
});

// Get impersonation audit log
router.get('/audit', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 50,
            admin_user_id,
            model_id,
            session_id,
            action_type,
            start_date,
            end_date
        } = req.query;

        const offset = (page - 1) * limit;
        let whereConditions = [];
        let queryParams = [];

        if (admin_user_id) {
            whereConditions.push('ia.admin_user_id = ?');
            queryParams.push(admin_user_id);
        }

        if (model_id) {
            whereConditions.push('ia.impersonated_model_id = ?');
            queryParams.push(model_id);
        }

        if (session_id) {
            whereConditions.push('ia.session_id = ?');
            queryParams.push(session_id);
        }

        if (action_type) {
            whereConditions.push('ia.action_type = ?');
            queryParams.push(action_type);
        }

        if (start_date) {
            whereConditions.push('ia.created_at >= ?');
            queryParams.push(start_date);
        }

        if (end_date) {
            whereConditions.push('ia.created_at <= ?');
            queryParams.push(end_date);
        }

        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

        // Get total count
        const [totalResult] = await db.execute(`
            SELECT COUNT(*) as total 
            FROM impersonation_audit ia
            ${whereClause}
        `, queryParams);

        const total = totalResult[0].total;

        // Get audit records - using template literal to avoid parameter binding issues
        const limitNum = parseInt(limit);
        const offsetNum = parseInt(offset);
        
        let auditQuery = `
            SELECT 
                ia.*,
                u.email as admin_email,
                u.role as admin_role,
                m.name as model_name,
                m.slug as model_slug
            FROM impersonation_audit ia
            LEFT JOIN users u ON ia.admin_user_id = u.id
            LEFT JOIN models m ON ia.impersonated_model_id = m.id
            ${whereClause}
            ORDER BY ia.created_at DESC
            LIMIT ${limitNum} OFFSET ${offsetNum}
        `;

        const [auditRecords] = await db.execute(auditQuery, queryParams);

        res.json({
            success: true,
            data: {
                audit_records: auditRecords,
                pagination: {
                    current_page: parseInt(page),
                    per_page: parseInt(limit),
                    total: total,
                    total_pages: Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        console.error('Error fetching audit log:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch audit log'
        });
    }
});

// Get active impersonation sessions
router.get('/active-sessions', async (req, res) => {
    try {
        const [sessions] = await db.execute(`
            SELECT 
                ai.*,
                u.email as admin_email,
                u.role as admin_role,
                m.name as model_name,
                m.slug as model_slug,
                m.email as model_email
            FROM active_impersonations ai
            JOIN users u ON ai.admin_user_id = u.id
            JOIN models m ON ai.impersonated_model_id = m.id
            WHERE ai.is_active = TRUE
            ORDER BY ai.started_at DESC
        `);

        const processedSessions = sessions.map(session => ({
            ...session,
            restrictions: session.restrictions ? JSON.parse(session.restrictions) : {},
            duration_minutes: Math.round((Date.now() - new Date(session.started_at)) / 60000),
            expires_in_minutes: Math.round((new Date(session.expires_at) - Date.now()) / 60000)
        }));

        res.success(processedSessions
        );

    } catch (error) {
        console.error('Error fetching active sessions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch active sessions'
        });
    }
});

// Force end impersonation session (admin only)
router.post('/force-end/:session_id', async (req, res) => {
    try {
        const { session_id } = req.params;
        const { reason = 'force_ended_by_admin' } = req.body;

        const result = await impersonationManager.endImpersonation(session_id, reason);

        res.success(result, { message: 'Impersonation session force-ended successfully' });

    } catch (error) {
        logger.warn('impersonation.force-end error', { error: error.message });
        res.fail(400, 'Failed to force-end impersonation session', error.message);
    }
});

// Get impersonation statistics
router.get('/stats', async (req, res) => {
    try {
        // Active sessions count
        const [activeSessions] = await db.execute(
            'SELECT COUNT(*) as count FROM active_impersonations WHERE is_active = TRUE'
        );

        // Total impersonation sessions today
        const [todaySessions] = await db.execute(`
            SELECT COUNT(DISTINCT session_id) as count 
            FROM impersonation_audit 
            WHERE DATE(created_at) = CURDATE() AND action_type = 'start'
        `);

        // Most impersonated models (last 30 days)
        const [topModels] = await db.execute(`
            SELECT 
                m.name,
                m.slug,
                COUNT(DISTINCT ia.session_id) as impersonation_count
            FROM impersonation_audit ia
            JOIN models m ON ia.impersonated_model_id = m.id
            WHERE ia.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                AND ia.action_type = 'start'
            GROUP BY m.id, m.name, m.slug
            ORDER BY impersonation_count DESC
            LIMIT 10
        `);

        // Admin activity (last 30 days)
        const [adminActivity] = await db.execute(`
            SELECT 
                u.email,
                u.role,
                COUNT(DISTINCT ia.session_id) as sessions_started,
                COUNT(CASE WHEN ia.action_type = 'activity' THEN 1 END) as total_actions
            FROM impersonation_audit ia
            JOIN users u ON ia.admin_user_id = u.id
            WHERE ia.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY u.id, u.email, u.role
            ORDER BY sessions_started DESC
            LIMIT 10
        `);

        res.success({
            active_sessions: activeSessions[0].count,
            sessions_today: todaySessions[0].count,
            top_impersonated_models: topModels,
            admin_activity: adminActivity
        });

    } catch (error) {
        logger.error('impersonation.stats error', { error: error.message });
        res.fail(500, 'Failed to fetch impersonation statistics', error.message);
    }
});

// Validate impersonation permissions
router.get('/validate-permissions/:user_id', async (req, res) => {
    try {
        const { user_id } = req.params;

        const [user] = await db.execute(
            'SELECT id, role, can_impersonate FROM users WHERE id = ?',
            [user_id]
        );

        if (!user.length) return res.fail(404, 'User not found');

        const canImpersonate = user[0].can_impersonate && ['admin', 'sysadmin'].includes(user[0].role);

        res.success({
            can_impersonate: canImpersonate,
            user_role: user[0].role,
            explicit_permission: user[0].can_impersonate
        });

    } catch (error) {
        logger.error('impersonation.validate-permissions error', { error: error.message });
        res.fail(500, 'Failed to validate permissions', error.message);
    }
});

module.exports = router;