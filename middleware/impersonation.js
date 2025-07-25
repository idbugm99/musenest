const db = require('../config/database');

class ImpersonationManager {
    constructor() {
        this.activeImpersonations = new Map(); // In-memory cache for performance
    }

    // Middleware to handle impersonation context
    async impersonationMiddleware(req, res, next) {
        try {
            // Debug: Check if middleware is called for auth routes
            if (req.path.includes('/api/auth/')) {
                console.log('Impersonation middleware called for:', req.path);
            }
            // Check if request has an active impersonation session
            // Priority: cookie > session > header
            const sessionId = req.cookies?.impersonation_session || 
                             req.session?.impersonationSessionId || 
                             req.headers['x-session-id'];
            
            // Debug logs removed for production
            
            if (sessionId && this.activeImpersonations.has(sessionId)) {
                // Get cached impersonation data
                const impersonationData = this.activeImpersonations.get(sessionId);
                req.impersonation = impersonationData;
                req.isImpersonating = true;
                req.originalUserId = impersonationData.admin_user_id;
                req.impersonatedModelId = impersonationData.impersonated_model_id;
                
                // Impersonation context set successfully
                
                // Update last activity
                await this.updateLastActivity(sessionId);
                
                // Log this request for audit purposes
                await this.logActivity(sessionId, {
                    route: req.path,
                    method: req.method,
                    body: this.sanitizeRequestData(req.body),
                    query: req.query,
                    ip: req.ip,
                    userAgent: req.get('User-Agent')
                });
                
                // Apply restrictions if any
                if (impersonationData.restrictions) {
                    this.applyRestrictions(req, impersonationData.restrictions);
                }
            } else {
                req.isImpersonating = false;
            }
            
            next();
        } catch (error) {
            console.error('Impersonation middleware error:', error);
            next(); // Continue without impersonation context
        }
    }

    // Start impersonation session
    async startImpersonation(adminUserId, modelId, restrictions = {}, sessionData = {}) {
        try {
            // Verify admin has impersonation permissions
            const [adminUser] = await db.execute(
                'SELECT id, role, can_impersonate FROM users WHERE id = ?',
                [adminUserId]
            );

            if (!adminUser.length || !adminUser[0].can_impersonate) {
                throw new Error('User does not have impersonation permissions');
            }

            // Verify target model exists
            const [model] = await db.execute(
                'SELECT id, name, slug, email FROM models WHERE id = ?',
                [modelId]
            );

            if (!model.length) {
                throw new Error('Target model not found');
            }

            // Generate unique session ID
            const sessionId = this.generateSessionId();
            const expiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000)); // 24 hours

            // Insert into active impersonations
            await db.execute(`
                INSERT INTO active_impersonations (
                    session_id, admin_user_id, impersonated_model_id, 
                    restrictions, ip_address, user_agent, expires_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                sessionId, adminUserId, modelId,
                JSON.stringify(restrictions),
                sessionData.ip || null,
                sessionData.userAgent || null,
                expiresAt
            ]);

            // Log impersonation start
            await this.logAuditEvent(adminUserId, modelId, sessionId, 'start', {
                target_model: model[0],
                restrictions: restrictions,
                session_duration_hours: 24
            }, sessionData);

            // Cache impersonation data
            const impersonationData = {
                session_id: sessionId,
                admin_user_id: adminUserId,
                impersonated_model_id: modelId,
                model_data: model[0],
                admin_data: adminUser[0],
                restrictions: restrictions,
                started_at: new Date(),
                expires_at: expiresAt
            };

            this.activeImpersonations.set(sessionId, impersonationData);

            return {
                success: true,
                session_id: sessionId,
                expires_at: expiresAt,
                impersonated_model: model[0]
            };

        } catch (error) {
            // Log security event for failed impersonation attempts
            await this.logSecurityEvent(adminUserId, modelId, 'unauthorized', error.message, sessionData);
            throw error;
        }
    }

    // End impersonation session
    async endImpersonation(sessionId, reason = 'manual') {
        try {
            const impersonationData = this.activeImpersonations.get(sessionId);
            
            if (!impersonationData) {
                throw new Error('Impersonation session not found');
            }

            // Deactivate in database
            await db.execute(
                'UPDATE active_impersonations SET is_active = FALSE WHERE session_id = ?',
                [sessionId]
            );

            // Log impersonation end
            await this.logAuditEvent(
                impersonationData.admin_user_id,
                impersonationData.impersonated_model_id,
                sessionId,
                'end',
                { reason: reason, duration_minutes: Math.round((Date.now() - impersonationData.started_at) / 60000) }
            );

            // Remove from cache
            this.activeImpersonations.delete(sessionId);

            return { success: true, message: 'Impersonation session ended' };

        } catch (error) {
            console.error('Error ending impersonation:', error);
            throw error;
        }
    }

    // Get current impersonation status
    getImpersonationStatus(sessionId) {
        const data = this.activeImpersonations.get(sessionId);
        if (!data) return null;

        return {
            is_active: true,
            admin_name: data.admin_data.email || data.admin_data.role,
            impersonated_model: data.model_data.name,
            impersonated_slug: data.model_data.slug,
            started_at: data.started_at,
            expires_at: data.expires_at,
            restrictions: data.restrictions
        };
    }

    // Apply restrictions to request
    applyRestrictions(req, restrictions) {
        if (!restrictions) return;

        // Check blocked routes
        if (restrictions.blocked_routes && restrictions.blocked_routes.length > 0) {
            const isBlocked = restrictions.blocked_routes.some(route => {
                if (route.includes('*')) {
                    const pattern = route.replace(/\*/g, '.*');
                    return new RegExp(`^${pattern}$`).test(req.path);
                }
                return req.path.startsWith(route);
            });

            if (isBlocked) {
                req.impersonationBlocked = true;
                req.blockReason = 'Route access restricted during impersonation';
            }
        }

        // Check blocked actions
        if (restrictions.blocked_actions && restrictions.blocked_actions.includes(req.method.toLowerCase())) {
            req.impersonationBlocked = true;
            req.blockReason = `${req.method} method restricted during impersonation`;
        }

        // Mark read-only fields
        if (restrictions.read_only_fields) {
            req.impersonationReadOnlyFields = restrictions.read_only_fields;
        }
    }

    // Log audit event
    async logAuditEvent(adminUserId, modelId, sessionId, actionType, actionDetails = {}, sessionData = {}) {
        try {
            await db.execute(`
                INSERT INTO impersonation_audit (
                    admin_user_id, impersonated_model_id, session_id, action_type, 
                    action_details, ip_address, user_agent, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
            `, [
                adminUserId, modelId, sessionId, actionType,
                JSON.stringify(actionDetails),
                sessionData.ip || null,
                sessionData.userAgent || null
            ]);
        } catch (error) {
            console.error('Error logging audit event:', error);
        }
    }

    // Log activity during impersonation
    async logActivity(sessionId, activityData) {
        try {
            const impersonationData = this.activeImpersonations.get(sessionId);
            if (!impersonationData) return;

            await db.execute(`
                INSERT INTO impersonation_audit (
                    admin_user_id, impersonated_model_id, session_id, action_type,
                    action_details, route_accessed, request_method, request_data,
                    ip_address, user_agent, created_at
                ) VALUES (?, ?, ?, 'activity', ?, ?, ?, ?, ?, ?, NOW())
            `, [
                impersonationData.admin_user_id,
                impersonationData.impersonated_model_id,
                sessionId,
                JSON.stringify({ activity: 'route_access' }),
                activityData.route,
                activityData.method,
                JSON.stringify(activityData.body || {}),
                activityData.ip,
                activityData.userAgent
            ]);
        } catch (error) {
            console.error('Error logging activity:', error);
        }
    }

    // Log security events
    async logSecurityEvent(userId, modelId, attemptType, reason, sessionData = {}) {
        try {
            await db.execute(`
                INSERT INTO impersonation_security_log (
                    user_id, attempted_model_id, attempt_type, failure_reason,
                    ip_address, user_agent, request_details, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
            `, [
                userId, modelId, attemptType, reason,
                sessionData.ip || null,
                sessionData.userAgent || null,
                JSON.stringify(sessionData)
            ]);
        } catch (error) {
            console.error('Error logging security event:', error);
        }
    }

    // Update last activity timestamp
    async updateLastActivity(sessionId) {
        try {
            await db.execute(
                'UPDATE active_impersonations SET last_activity = NOW() WHERE session_id = ?',
                [sessionId]
            );
        } catch (error) {
            console.error('Error updating last activity:', error);
        }
    }

    // Clean up expired sessions
    async cleanupExpiredSessions() {
        try {
            const [expiredSessions] = await db.execute(`
                SELECT session_id, admin_user_id, impersonated_model_id 
                FROM active_impersonations 
                WHERE is_active = TRUE AND expires_at < NOW()
            `);

            for (const session of expiredSessions) {
                await this.endImpersonation(session.session_id, 'expired');
            }

            console.log(`Cleaned up ${expiredSessions.length} expired impersonation sessions`);
        } catch (error) {
            console.error('Error cleaning up expired sessions:', error);
        }
    }

    // Load active impersonations into cache on startup
    async loadActiveImpersonations() {
        try {
            const [sessions] = await db.execute(`
                SELECT 
                    ai.*, 
                    u.email as admin_email, u.role as admin_role,
                    m.name as model_name, m.slug as model_slug, m.email as model_email
                FROM active_impersonations ai
                JOIN users u ON ai.admin_user_id = u.id
                JOIN models m ON ai.impersonated_model_id = m.id
                WHERE ai.is_active = TRUE AND ai.expires_at > NOW()
            `);

            for (const session of sessions) {
                const impersonationData = {
                    session_id: session.session_id,
                    admin_user_id: session.admin_user_id,
                    impersonated_model_id: session.impersonated_model_id,
                    model_data: {
                        id: session.impersonated_model_id,
                        name: session.model_name,
                        slug: session.model_slug,
                        email: session.model_email
                    },
                    admin_data: {
                        id: session.admin_user_id,
                        email: session.admin_email,
                        role: session.admin_role
                    },
                    restrictions: this.parseRestrictions(session.restrictions),
                    started_at: session.started_at,
                    expires_at: session.expires_at
                };

                this.activeImpersonations.set(session.session_id, impersonationData);
            }

            console.log(`Loaded ${sessions.length} active impersonation sessions`);
        } catch (error) {
            console.error('Error loading active impersonations:', error);
        }
    }

    // Generate secure session ID
    generateSessionId() {
        const crypto = require('crypto');
        return 'imp_' + crypto.randomBytes(32).toString('hex');
    }

    // Sanitize request data for logging
    parseRestrictions(restrictionsData) {
        if (!restrictionsData) return {};
        
        try {
            // If it's already an object, return it
            if (typeof restrictionsData === 'object') {
                return restrictionsData;
            }
            
            // If it's a string, try to parse it
            if (typeof restrictionsData === 'string') {
                return JSON.parse(restrictionsData);
            }
            
            return {};
        } catch (error) {
            console.warn('Failed to parse restrictions data:', restrictionsData, error);
            return {};
        }
    }

    sanitizeRequestData(data) {
        if (!data) return {};
        
        const sensitive = ['password', 'token', 'key', 'secret'];
        const sanitized = { ...data };
        
        Object.keys(sanitized).forEach(key => {
            if (sensitive.some(word => key.toLowerCase().includes(word))) {
                sanitized[key] = '[REDACTED]';
            }
        });
        
        return sanitized;
    }
}

// Create singleton instance
const impersonationManager = new ImpersonationManager();

// Initialize on startup
impersonationManager.loadActiveImpersonations();

// Set up cleanup interval (every hour)
setInterval(() => {
    impersonationManager.cleanupExpiredSessions();
}, 60 * 60 * 1000);

module.exports = {
    impersonationManager,
    impersonationMiddleware: (req, res, next) => impersonationManager.impersonationMiddleware(req, res, next)
};