/**
 * Advanced Authentication API Routes
 * Part of Phase F.3: Add advanced authentication and authorization systems
 * Provides API endpoints for authentication, authorization, MFA, and session management
 */

const express = require('express');
const router = express.Router();
const AdvancedAuthenticationService = require('../../src/services/AdvancedAuthenticationService');
const SecurityMonitoringService = require('../../src/services/SecurityMonitoringService');
const AdvancedAnalyticsService = require('../../src/services/AdvancedAnalyticsService');

// Initialize services
let authService = null;
let securityService = null;
let analyticsService = null;

// Middleware to initialize authentication service
router.use((req, res, next) => {
    if (!authService) {
        // Initialize dependencies first
        if (!analyticsService) {
            analyticsService = new AdvancedAnalyticsService(req.db, {
                collection: {
                    realTimeInterval: 30000,
                    aggregationInterval: 300000
                }
            });
        }

        if (!securityService) {
            securityService = new SecurityMonitoringService(req.db, analyticsService, {
                monitoring: { enableRealTime: true }
            });
        }

        const config = {
            authentication: {
                enableMFA: process.env.AUTH_ENABLE_MFA !== 'false',
                sessionTimeout: parseInt(process.env.AUTH_SESSION_TIMEOUT) || 3600000,
                maxConcurrentSessions: parseInt(process.env.AUTH_MAX_SESSIONS) || 10,
                passwordComplexity: {
                    minLength: parseInt(process.env.AUTH_PASSWORD_MIN_LENGTH) || 12,
                    requireUppercase: process.env.AUTH_PASSWORD_REQUIRE_UPPER !== 'false',
                    requireLowercase: process.env.AUTH_PASSWORD_REQUIRE_LOWER !== 'false',
                    requireNumbers: process.env.AUTH_PASSWORD_REQUIRE_NUMBERS !== 'false',
                    requireSymbols: process.env.AUTH_PASSWORD_REQUIRE_SYMBOLS !== 'false',
                    maxAge: parseInt(process.env.AUTH_PASSWORD_MAX_AGE) || 90 * 24 * 3600000
                },
                lockoutPolicy: {
                    maxAttempts: parseInt(process.env.AUTH_LOCKOUT_MAX_ATTEMPTS) || 5,
                    lockoutDuration: parseInt(process.env.AUTH_LOCKOUT_DURATION) || 900000,
                    progressiveLockout: process.env.AUTH_PROGRESSIVE_LOCKOUT !== 'false'
                },
                enableBiometrics: process.env.AUTH_ENABLE_BIOMETRICS !== 'false',
                enableSSO: process.env.AUTH_ENABLE_SSO !== 'false'
            },
            authorization: {
                enableRBAC: process.env.AUTH_ENABLE_RBAC !== 'false',
                enableABAC: process.env.AUTH_ENABLE_ABAC !== 'false',
                defaultRole: process.env.AUTH_DEFAULT_ROLE || 'user',
                roleHierarchy: process.env.AUTH_ROLE_HIERARCHY !== 'false',
                permissionCaching: process.env.AUTH_PERMISSION_CACHING !== 'false',
                cacheTTL: parseInt(process.env.AUTH_CACHE_TTL) || 300000
            },
            mfa: {
                methods: (process.env.AUTH_MFA_METHODS || 'totp,sms,email,backup_codes').split(','),
                totpIssuer: process.env.AUTH_TOTP_ISSUER || 'MuseNest',
                backupCodesCount: parseInt(process.env.AUTH_BACKUP_CODES_COUNT) || 10,
                smsProvider: process.env.AUTH_SMS_PROVIDER || 'twilio',
                enforceForRoles: (process.env.AUTH_MFA_ENFORCE_ROLES || 'admin,moderator').split(',')
            },
            sessions: {
                enableSecureCookies: process.env.AUTH_SECURE_COOKIES !== 'false',
                cookieName: process.env.AUTH_COOKIE_NAME || 'musenest_session',
                sameSitePolicy: process.env.AUTH_SAMESITE_POLICY || 'strict',
                rotateOnLogin: process.env.AUTH_ROTATE_ON_LOGIN !== 'false',
                fingerprinting: process.env.AUTH_SESSION_FINGERPRINTING !== 'false'
            },
            security: {
                hashingAlgorithm: process.env.AUTH_HASHING_ALGORITHM || 'argon2id',
                hashingSaltLength: parseInt(process.env.AUTH_SALT_LENGTH) || 32,
                hashingIterations: parseInt(process.env.AUTH_HASHING_ITERATIONS) || 100000,
                encryptionAlgorithm: process.env.AUTH_ENCRYPTION_ALGORITHM || 'aes-256-gcm',
                jwtAlgorithm: process.env.AUTH_JWT_ALGORITHM || 'HS512',
                jwtSecret: process.env.AUTH_JWT_SECRET || require('crypto').randomBytes(64).toString('hex')
            }
        };

        authService = new AdvancedAuthenticationService(req.db, securityService, config);
        console.log('🔐 AdvancedAuthenticationService initialized for API routes');
    }
    next();
});

/**
 * POST /api/authentication/login
 * Authenticate user with credentials
 */
router.post('/login', async (req, res) => {
    try {
        if (!authService) {
            return res.status(500).json({
                success: false,
                error: 'Authentication service not initialized'
            });
        }

        const { identifier, password, rememberMe = false } = req.body;
        
        // Validate required fields
        if (!identifier || !password) {
            return res.status(400).json({
                success: false,
                error: 'identifier and password are required'
            });
        }

        const authOptions = {
            sourceIP: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            acceptLanguage: req.get('Accept-Language'),
            acceptEncoding: req.get('Accept-Encoding'),
            rememberMe,
            deviceInfo: req.body.deviceInfo,
            geolocation: req.body.geolocation,
            loginMethod: 'password'
        };

        console.log(`🔐 Login attempt for: ${identifier}`);
        
        const authResult = await authService.authenticate(identifier, password, authOptions);
        
        if (authResult.success) {
            // Set session cookie
            const cookieOptions = {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: authService.configuration.sessions.sameSitePolicy,
                maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : null // 30 days if remember me
            };

            res.cookie(authService.configuration.sessions.cookieName, authResult.session.token, cookieOptions);

            res.json({
                success: true,
                message: 'Authentication successful',
                user: authResult.user,
                session: {
                    id: authResult.session.id,
                    expiresAt: new Date(authResult.session.expiresAt).toISOString()
                },
                passwordExpired: authResult.passwordExpired,
                timestamp: new Date().toISOString()
            });
        } else if (authResult.requiresMFA) {
            res.json({
                success: false,
                requiresMFA: true,
                mfaToken: authResult.mfaToken,
                availableMethods: authResult.availableMethods,
                message: 'Multi-factor authentication required'
            });
        } else {
            res.status(401).json({
                success: false,
                error: authResult.error,
                message: authResult.message
            });
        }

    } catch (error) {
        console.error('❌ Error during login:', error.message);
        res.status(500).json({
            success: false,
            error: 'authentication_error',
            message: 'Authentication service error'
        });
    }
});

/**
 * POST /api/authentication/mfa-verify
 * Verify multi-factor authentication
 */
router.post('/mfa-verify', async (req, res) => {
    try {
        if (!authService) {
            return res.status(500).json({
                success: false,
                error: 'Authentication service not initialized'
            });
        }

        const { mfaToken, code, method } = req.body;
        
        // Validate required fields
        if (!mfaToken || !code || !method) {
            return res.status(400).json({
                success: false,
                error: 'mfaToken, code, and method are required'
            });
        }

        const verificationOptions = {
            sourceIP: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            deviceInfo: req.body.deviceInfo
        };

        console.log(`🔐 MFA verification attempt with method: ${method}`);
        
        const verificationResult = await authService.verifyMFA(mfaToken, code, method, verificationOptions);
        
        if (verificationResult.success) {
            // Set session cookie
            const cookieOptions = {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: authService.configuration.sessions.sameSitePolicy
            };

            res.cookie(authService.configuration.sessions.cookieName, verificationResult.session.token, cookieOptions);

            res.json({
                success: true,
                message: 'MFA verification successful',
                user: verificationResult.user,
                session: {
                    id: verificationResult.session.id,
                    expiresAt: new Date(verificationResult.session.expiresAt).toISOString()
                },
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(401).json({
                success: false,
                error: verificationResult.error,
                message: verificationResult.message
            });
        }

    } catch (error) {
        console.error('❌ Error during MFA verification:', error.message);
        res.status(500).json({
            success: false,
            error: 'mfa_verification_error',
            message: 'MFA verification service error'
        });
    }
});

/**
 * POST /api/authentication/logout
 * Logout user and invalidate session
 */
router.post('/logout', async (req, res) => {
    try {
        if (!authService) {
            return res.status(500).json({
                success: false,
                error: 'Authentication service not initialized'
            });
        }

        const sessionToken = req.cookies[authService.configuration.sessions.cookieName] || req.headers.authorization?.replace('Bearer ', '');
        
        if (sessionToken) {
            const session = authService.validateSession(sessionToken);
            if (session) {
                await authService.invalidateSession(session.id);
                console.log(`🔐 User logged out: ${session.userId}`);
            }
        }

        // Clear session cookie
        res.clearCookie(authService.configuration.sessions.cookieName);

        res.json({
            success: true,
            message: 'Logout successful',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error during logout:', error.message);
        res.status(500).json({
            success: false,
            error: 'logout_error',
            message: 'Logout service error'
        });
    }
});

/**
 * GET /api/authentication/session
 * Validate current session and get user info
 */
router.get('/session', (req, res) => {
    try {
        if (!authService) {
            return res.status(500).json({
                success: false,
                error: 'Authentication service not initialized'
            });
        }

        const sessionToken = req.cookies[authService.configuration.sessions.cookieName] || req.headers.authorization?.replace('Bearer ', '');
        
        if (!sessionToken) {
            return res.status(401).json({
                success: false,
                error: 'no_session',
                message: 'No session token provided'
            });
        }

        const session = authService.validateSession(sessionToken);
        
        if (!session) {
            res.clearCookie(authService.configuration.sessions.cookieName);
            return res.status(401).json({
                success: false,
                error: 'invalid_session',
                message: 'Session is invalid or expired'
            });
        }

        res.json({
            success: true,
            session: {
                id: session.id,
                userId: session.userId,
                expiresAt: new Date(session.expiresAt).toISOString(),
                lastActivity: new Date(session.lastActivity).toISOString(),
                mfaVerified: session.mfaVerified,
                permissions: session.permissions
            },
            user: {
                id: session.userId,
                permissions: session.permissions
            }
        });

    } catch (error) {
        console.error('❌ Error validating session:', error.message);
        res.status(500).json({
            success: false,
            error: 'session_validation_error',
            message: 'Session validation service error'
        });
    }
});

/**
 * GET /api/authentication/permissions/:userId
 * Get user permissions
 */
router.get('/permissions/:userId', async (req, res) => {
    try {
        if (!authService) {
            return res.status(500).json({
                success: false,
                error: 'Authentication service not initialized'
            });
        }

        const { userId } = req.params;
        const permissions = await authService.getUserPermissions(userId);
        
        res.json({
            success: true,
            userId,
            permissions,
            count: permissions.length
        });

    } catch (error) {
        console.error('❌ Error getting user permissions:', error.message);
        res.status(500).json({
            success: false,
            error: 'permissions_error',
            message: 'Failed to get user permissions'
        });
    }
});

/**
 * POST /api/authentication/permissions/check
 * Check if user has specific permission
 */
router.post('/permissions/check', async (req, res) => {
    try {
        if (!authService) {
            return res.status(500).json({
                success: false,
                error: 'Authentication service not initialized'
            });
        }

        const { userId, permission, context = {} } = req.body;
        
        if (!userId || !permission) {
            return res.status(400).json({
                success: false,
                error: 'userId and permission are required'
            });
        }

        const hasPermission = await authService.hasPermission(userId, permission, context);
        
        res.json({
            success: true,
            userId,
            permission,
            hasPermission,
            context,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error checking permission:', error.message);
        res.status(500).json({
            success: false,
            error: 'permission_check_error',
            message: 'Failed to check permission'
        });
    }
});

/**
 * POST /api/authentication/mfa/setup
 * Set up MFA for user
 */
router.post('/mfa/setup', async (req, res) => {
    try {
        if (!authService) {
            return res.status(500).json({
                success: false,
                error: 'Authentication service not initialized'
            });
        }

        const { userId, method, options = {} } = req.body;
        
        if (!userId || !method) {
            return res.status(400).json({
                success: false,
                error: 'userId and method are required'
            });
        }

        console.log(`🔐 Setting up MFA for user ${userId} with method: ${method}`);
        
        const setupResult = await authService.setupMFA(userId, method, options);
        
        if (setupResult.success) {
            res.json({
                success: true,
                message: `${method.toUpperCase()} MFA setup successful`,
                method,
                ...setupResult
            });
        } else {
            res.status(400).json({
                success: false,
                error: setupResult.error,
                message: setupResult.message
            });
        }

    } catch (error) {
        console.error('❌ Error setting up MFA:', error.message);
        res.status(500).json({
            success: false,
            error: 'mfa_setup_error',
            message: 'MFA setup service error'
        });
    }
});

/**
 * GET /api/authentication/roles
 * Get all available roles
 */
router.get('/roles', (req, res) => {
    try {
        if (!authService) {
            return res.status(500).json({
                success: false,
                error: 'Authentication service not initialized'
            });
        }

        const roles = Array.from(authService.roles.values())
            .filter(role => role.active)
            .map(role => ({
                id: role.id,
                name: role.name,
                description: role.description,
                hierarchy: role.hierarchy,
                systemRole: role.systemRole,
                permissions: role.permissions,
                userCount: role.userCount,
                createdAt: new Date(role.createdAt).toISOString()
            }))
            .sort((a, b) => b.hierarchy - a.hierarchy);

        res.json({
            success: true,
            roles,
            summary: {
                total: roles.length,
                systemRoles: roles.filter(r => r.systemRole).length,
                customRoles: roles.filter(r => !r.systemRole).length,
                totalPermissions: roles.reduce((sum, r) => sum + r.permissions.length, 0)
            }
        });

    } catch (error) {
        console.error('❌ Error getting roles:', error.message);
        res.status(500).json({
            success: false,
            error: 'roles_error',
            message: 'Failed to get roles'
        });
    }
});

/**
 * GET /api/authentication/permissions
 * Get all available permissions
 */
router.get('/permissions', (req, res) => {
    try {
        if (!authService) {
            return res.status(500).json({
                success: false,
                error: 'Authentication service not initialized'
            });
        }

        const { category } = req.query;
        let permissions = Array.from(authService.permissions.values())
            .filter(permission => permission.active);

        if (category) {
            permissions = permissions.filter(p => p.category === category);
        }

        const formattedPermissions = permissions.map(permission => ({
            id: permission.id,
            name: permission.name,
            category: permission.category,
            description: permission.description,
            createdAt: new Date(permission.createdAt).toISOString()
        }));

        const categories = [...new Set(permissions.map(p => p.category))];

        res.json({
            success: true,
            permissions: formattedPermissions,
            categories,
            summary: {
                total: formattedPermissions.length,
                byCategory: permissions.reduce((acc, p) => {
                    acc[p.category] = (acc[p.category] || 0) + 1;
                    return acc;
                }, {})
            }
        });

    } catch (error) {
        console.error('❌ Error getting permissions:', error.message);
        res.status(500).json({
            success: false,
            error: 'permissions_error',
            message: 'Failed to get permissions'
        });
    }
});

/**
 * GET /api/authentication/status
 * Get authentication service status
 */
router.get('/status', (req, res) => {
    try {
        if (!authService) {
            return res.status(500).json({
                success: false,
                error: 'Authentication service not initialized'
            });
        }

        const status = authService.getAuthenticationStatus();
        
        res.json({
            success: true,
            status: {
                service: {
                    active: status.isActive,
                    lastActivity: new Date(status.lastActivity).toISOString()
                },
                authentication: {
                    mfaEnabled: status.configuration.authentication.enableMFA,
                    sessionTimeout: status.configuration.authentication.sessionTimeout,
                    sessionTimeoutMinutes: Math.round(status.configuration.authentication.sessionTimeout / 60000),
                    maxConcurrentSessions: status.configuration.authentication.maxConcurrentSessions,
                    lockoutMaxAttempts: status.configuration.authentication.lockoutPolicy.maxAttempts,
                    lockoutDurationMinutes: Math.round(status.configuration.authentication.lockoutPolicy.lockoutDuration / 60000)
                },
                authorization: {
                    rbacEnabled: status.configuration.authorization.enableRBAC,
                    abacEnabled: status.configuration.authorization.enableABAC,
                    defaultRole: status.configuration.authorization.defaultRole,
                    permissionCachingEnabled: status.configuration.authorization.permissionCaching,
                    cacheTTLMinutes: Math.round(status.configuration.authorization.cacheTTL / 60000)
                },
                mfa: {
                    availableMethods: status.configuration.mfa.methods,
                    totpIssuer: status.configuration.mfa.totpIssuer,
                    enforceForRoles: status.configuration.mfa.enforceForRoles,
                    backupCodesCount: status.configuration.mfa.backupCodesCount
                },
                metrics: status.metrics,
                cacheMetrics: {
                    permissionCacheSize: status.permissionCacheSize,
                    sessionStoreSize: status.sessionStoreSize,
                    authEventsStored: status.authEvents
                }
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error getting authentication status:', error.message);
        res.status(500).json({
            success: false,
            error: 'status_error',
            message: 'Failed to get authentication status'
        });
    }
});

/**
 * GET /api/authentication/sessions
 * Get active sessions (admin only)
 */
router.get('/sessions', async (req, res) => {
    try {
        if (!authService) {
            return res.status(500).json({
                success: false,
                error: 'Authentication service not initialized'
            });
        }

        // TODO: Add authorization check for admin access

        const { userId, limit = 50 } = req.query;
        let sessions = Array.from(authService.sessions.values())
            .filter(session => session.active);

        if (userId) {
            sessions = sessions.filter(session => session.userId === userId);
        }

        sessions = sessions
            .sort((a, b) => b.lastActivity - a.lastActivity)
            .slice(0, parseInt(limit));

        const formattedSessions = sessions.map(session => ({
            id: session.id,
            userId: session.userId,
            userAgent: session.userAgent,
            sourceIP: session.sourceIP,
            createdAt: new Date(session.createdAt).toISOString(),
            expiresAt: new Date(session.expiresAt).toISOString(),
            lastActivity: new Date(session.lastActivity).toISOString(),
            mfaVerified: session.mfaVerified,
            metadata: session.metadata,
            age: Date.now() - session.createdAt,
            ageMinutes: Math.round((Date.now() - session.createdAt) / 60000),
            timeToExpiry: session.expiresAt - Date.now(),
            minutesToExpiry: Math.round((session.expiresAt - Date.now()) / 60000)
        }));

        res.json({
            success: true,
            sessions: formattedSessions,
            summary: {
                total: formattedSessions.length,
                byUser: formattedSessions.reduce((acc, s) => {
                    acc[s.userId] = (acc[s.userId] || 0) + 1;
                    return acc;
                }, {}),
                avgSessionAge: formattedSessions.length > 0 ? 
                    Math.round(formattedSessions.reduce((sum, s) => sum + s.ageMinutes, 0) / formattedSessions.length) : 0,
                mfaVerifiedSessions: formattedSessions.filter(s => s.mfaVerified).length
            }
        });

    } catch (error) {
        console.error('❌ Error getting sessions:', error.message);
        res.status(500).json({
            success: false,
            error: 'sessions_error',
            message: 'Failed to get sessions'
        });
    }
});

module.exports = router;