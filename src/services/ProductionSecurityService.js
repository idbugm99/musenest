/**
 * Production Security Service
 * Part of Phase D.6: Production security enhancements
 * Provides comprehensive security monitoring, threat detection, and protection for production environments
 */

const EventEmitter = require('events');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class ProductionSecurityService extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            // Rate limiting
            rateLimit: {
                enabled: config.rateLimit?.enabled !== false,
                window: config.rateLimit?.window || 60000, // 1 minute
                maxRequests: config.rateLimit?.maxRequests || 100,
                blockDuration: config.rateLimit?.blockDuration || 300000 // 5 minutes
            },
            
            // Authentication security
            auth: {
                maxLoginAttempts: config.auth?.maxLoginAttempts || 5,
                lockoutDuration: config.auth?.lockoutDuration || 900000, // 15 minutes
                sessionTimeout: config.auth?.sessionTimeout || 3600000, // 1 hour
                requireStrongPasswords: config.auth?.requireStrongPasswords !== false,
                enable2FA: config.auth?.enable2FA || false
            },
            
            // Input validation and sanitization
            validation: {
                maxFileSize: config.validation?.maxFileSize || 50 * 1024 * 1024, // 50MB
                allowedFileTypes: config.validation?.allowedFileTypes || [
                    'image/jpeg', 'image/png', 'image/gif', 'image/webp'
                ],
                maxFieldLength: config.validation?.maxFieldLength || 1000,
                sanitizeHtml: config.validation?.sanitizeHtml !== false
            },
            
            // Security headers
            headers: {
                hsts: config.headers?.hsts !== false,
                csp: config.headers?.csp !== false,
                nosniff: config.headers?.nosniff !== false,
                frameOptions: config.headers?.frameOptions !== false,
                xssProtection: config.headers?.xssProtection !== false
            },
            
            // Threat detection
            threatDetection: {
                enabled: config.threatDetection?.enabled !== false,
                suspiciousPatterns: config.threatDetection?.suspiciousPatterns || [
                    'script', 'javascript:', 'vbscript:', 'onload', 'onerror',
                    'union select', 'drop table', 'truncate', '--', ';--',
                    '../', '..\\', '/etc/passwd', '/proc/version'
                ],
                maxSuspiciousActions: config.threatDetection?.maxSuspiciousActions || 10,
                banDuration: config.threatDetection?.banDuration || 3600000 // 1 hour
            },
            
            // Audit logging
            audit: {
                enabled: config.audit?.enabled !== false,
                logLevel: config.audit?.logLevel || 'info',
                logFile: config.audit?.logFile || path.join(__dirname, '../../logs/security.log'),
                maxLogSize: config.audit?.maxLogSize || 100 * 1024 * 1024, // 100MB
                retention: config.audit?.retention || 30 * 24 * 60 * 60 * 1000 // 30 days
            }
        };

        // Security state tracking
        this.rateLimitStore = new Map();
        this.loginAttempts = new Map();
        this.suspiciousIPs = new Map();
        this.bannedIPs = new Set();
        this.activeSessions = new Map();
        this.securityEvents = [];
        
        // Security statistics
        this.securityStats = {
            totalRequests: 0,
            blockedRequests: 0,
            suspiciousActivity: 0,
            loginAttempts: 0,
            failedLogins: 0,
            bannedIPs: 0,
            securityAlerts: 0,
            uptime: Date.now()
        };

        console.log('🛡️  ProductionSecurityService initialized');
        this.initialize();
    }

    /**
     * Initialize security service
     */
    async initialize() {
        try {
            // Ensure log directory exists
            const logDir = path.dirname(this.config.audit.logFile);
            await fs.mkdir(logDir, { recursive: true });

            // Setup security event cleanup
            setInterval(() => {
                this.cleanupSecurityEvents();
            }, 300000); // Every 5 minutes

            // Setup banned IP cleanup
            setInterval(() => {
                this.cleanupBannedIPs();
            }, 60000); // Every minute

            this.emit('securityServiceInitialized');
            console.log('🛡️  Security service initialized');

        } catch (error) {
            console.error('❌ Failed to initialize security service:', error.message);
            this.emit('securityServiceError', error);
        }
    }

    /**
     * Middleware for rate limiting
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     * @param {Function} next - Next middleware function
     */
    rateLimitMiddleware() {
        return (req, res, next) => {
            if (!this.config.rateLimit.enabled) {
                return next();
            }

            const clientIP = this.getClientIP(req);
            const now = Date.now();
            const windowStart = now - this.config.rateLimit.window;

            // Check if IP is banned
            if (this.bannedIPs.has(clientIP)) {
                this.logSecurityEvent('rate_limit_banned', {
                    ip: clientIP,
                    url: req.url,
                    method: req.method
                }, 'high');
                
                return res.status(429).json({
                    error: 'Too many requests',
                    retryAfter: this.config.rateLimit.blockDuration / 1000
                });
            }

            // Get or create rate limit data for this IP
            if (!this.rateLimitStore.has(clientIP)) {
                this.rateLimitStore.set(clientIP, []);
            }

            const requests = this.rateLimitStore.get(clientIP);
            
            // Remove old requests outside the window
            const recentRequests = requests.filter(timestamp => timestamp > windowStart);
            this.rateLimitStore.set(clientIP, recentRequests);

            this.securityStats.totalRequests++;

            // Check if rate limit exceeded
            if (recentRequests.length >= this.config.rateLimit.maxRequests) {
                this.securityStats.blockedRequests++;
                
                // Add to suspicious IPs
                this.addSuspiciousActivity(clientIP, 'rate_limit_exceeded');
                
                this.logSecurityEvent('rate_limit_exceeded', {
                    ip: clientIP,
                    requests: recentRequests.length,
                    limit: this.config.rateLimit.maxRequests,
                    url: req.url,
                    method: req.method
                }, 'medium');

                return res.status(429).json({
                    error: 'Rate limit exceeded',
                    limit: this.config.rateLimit.maxRequests,
                    window: this.config.rateLimit.window,
                    retryAfter: this.config.rateLimit.window / 1000
                });
            }

            // Add current request timestamp
            recentRequests.push(now);
            next();
        };
    }

    /**
     * Middleware for security headers
     */
    securityHeadersMiddleware() {
        return (req, res, next) => {
            if (this.config.headers.hsts) {
                res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
            }

            if (this.config.headers.csp) {
                res.setHeader('Content-Security-Policy', 
                    "default-src 'self'; " +
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
                    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
                    "font-src 'self' https://fonts.gstatic.com; " +
                    "img-src 'self' data: blob:; " +
                    "media-src 'self' blob:; " +
                    "connect-src 'self';"
                );
            }

            if (this.config.headers.nosniff) {
                res.setHeader('X-Content-Type-Options', 'nosniff');
            }

            if (this.config.headers.frameOptions) {
                res.setHeader('X-Frame-Options', 'DENY');
            }

            if (this.config.headers.xssProtection) {
                res.setHeader('X-XSS-Protection', '1; mode=block');
            }

            res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
            res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

            next();
        };
    }

    /**
     * Middleware for threat detection
     */
    threatDetectionMiddleware() {
        return (req, res, next) => {
            if (!this.config.threatDetection.enabled) {
                return next();
            }

            const clientIP = this.getClientIP(req);
            const userAgent = req.headers['user-agent'] || '';
            const referer = req.headers['referer'] || '';

            // Check for suspicious patterns in various request parts
            const suspiciousData = [
                JSON.stringify(req.query),
                JSON.stringify(req.body),
                req.url,
                userAgent,
                referer
            ].join(' ').toLowerCase();

            let suspiciousPatternFound = false;
            let detectedPattern = null;

            for (const pattern of this.config.threatDetection.suspiciousPatterns) {
                if (suspiciousData.includes(pattern.toLowerCase())) {
                    suspiciousPatternFound = true;
                    detectedPattern = pattern;
                    break;
                }
            }

            if (suspiciousPatternFound) {
                this.securityStats.suspiciousActivity++;
                
                this.addSuspiciousActivity(clientIP, 'malicious_pattern', {
                    pattern: detectedPattern,
                    url: req.url,
                    method: req.method,
                    userAgent,
                    referer
                });

                this.logSecurityEvent('threat_detected', {
                    ip: clientIP,
                    pattern: detectedPattern,
                    url: req.url,
                    method: req.method,
                    userAgent,
                    data: suspiciousData.substring(0, 200)
                }, 'high');

                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'Suspicious activity detected'
                });
            }

            next();
        };
    }

    /**
     * Authentication security middleware
     */
    authSecurityMiddleware() {
        return (req, res, next) => {
            const clientIP = this.getClientIP(req);

            // Check if IP is temporarily locked out
            if (this.loginAttempts.has(clientIP)) {
                const attempts = this.loginAttempts.get(clientIP);
                if (attempts.count >= this.config.auth.maxLoginAttempts) {
                    const lockoutEnd = attempts.lastAttempt + this.config.auth.lockoutDuration;
                    if (Date.now() < lockoutEnd) {
                        this.logSecurityEvent('login_lockout', {
                            ip: clientIP,
                            attempts: attempts.count,
                            lockoutEnd: new Date(lockoutEnd).toISOString()
                        }, 'medium');

                        return res.status(423).json({
                            error: 'Account temporarily locked',
                            retryAfter: Math.ceil((lockoutEnd - Date.now()) / 1000)
                        });
                    } else {
                        // Lockout expired, reset attempts
                        this.loginAttempts.delete(clientIP);
                    }
                }
            }

            next();
        };
    }

    /**
     * File upload security validation
     * @param {Object} file - Uploaded file object
     * @returns {Object} Validation result
     */
    validateFileUpload(file) {
        const errors = [];
        const warnings = [];

        // Check file size
        if (file.size > this.config.validation.maxFileSize) {
            errors.push(`File size exceeds limit (${this.formatBytes(this.config.validation.maxFileSize)})`);
        }

        // Check file type
        if (!this.config.validation.allowedFileTypes.includes(file.mimetype)) {
            errors.push(`File type not allowed: ${file.mimetype}`);
        }

        // Check file extension vs MIME type consistency
        const extension = path.extname(file.originalname).toLowerCase();
        const expectedExtensions = {
            'image/jpeg': ['.jpg', '.jpeg'],
            'image/png': ['.png'],
            'image/gif': ['.gif'],
            'image/webp': ['.webp']
        };

        if (expectedExtensions[file.mimetype] && !expectedExtensions[file.mimetype].includes(extension)) {
            warnings.push('File extension does not match MIME type');
        }

        // Check for suspicious file names
        const suspiciousNames = ['script', 'php', 'exe', 'bat', 'cmd', 'sh'];
        if (suspiciousNames.some(name => file.originalname.toLowerCase().includes(name))) {
            errors.push('Suspicious filename detected');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            sanitizedName: this.sanitizeFilename(file.originalname)
        };
    }

    /**
     * Input sanitization and validation
     * @param {string} input - Input string to sanitize
     * @param {Object} options - Sanitization options
     * @returns {string} Sanitized input
     */
    sanitizeInput(input, options = {}) {
        if (typeof input !== 'string') {
            return input;
        }

        let sanitized = input;

        // Trim whitespace
        sanitized = sanitized.trim();

        // Check length
        if (sanitized.length > this.config.validation.maxFieldLength) {
            sanitized = sanitized.substring(0, this.config.validation.maxFieldLength);
        }

        // HTML sanitization if enabled
        if (this.config.validation.sanitizeHtml && !options.allowHtml) {
            sanitized = this.sanitizeHtml(sanitized);
        }

        // SQL injection prevention
        sanitized = this.preventSQLInjection(sanitized);

        // XSS prevention
        sanitized = this.preventXSS(sanitized);

        return sanitized;
    }

    /**
     * Record login attempt
     * @param {string} clientIP - Client IP address
     * @param {boolean} success - Whether login was successful
     * @param {Object} details - Additional details
     */
    recordLoginAttempt(clientIP, success, details = {}) {
        this.securityStats.loginAttempts++;

        if (!success) {
            this.securityStats.failedLogins++;
            
            // Track failed attempts per IP
            if (!this.loginAttempts.has(clientIP)) {
                this.loginAttempts.set(clientIP, { count: 0, lastAttempt: 0 });
            }

            const attempts = this.loginAttempts.get(clientIP);
            attempts.count++;
            attempts.lastAttempt = Date.now();

            this.logSecurityEvent('login_failed', {
                ip: clientIP,
                attempts: attempts.count,
                ...details
            }, attempts.count >= this.config.auth.maxLoginAttempts ? 'high' : 'medium');

            if (attempts.count >= this.config.auth.maxLoginAttempts) {
                this.addSuspiciousActivity(clientIP, 'brute_force_login');
            }
        } else {
            // Successful login, reset attempts
            this.loginAttempts.delete(clientIP);
            
            this.logSecurityEvent('login_success', {
                ip: clientIP,
                ...details
            }, 'info');
        }
    }

    /**
     * Password strength validation
     * @param {string} password - Password to validate
     * @returns {Object} Validation result
     */
    validatePasswordStrength(password) {
        if (!this.config.auth.requireStrongPasswords) {
            return { valid: true, score: 0, suggestions: [] };
        }

        const checks = {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /\d/.test(password),
            special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\?]/.test(password)
        };

        const score = Object.values(checks).filter(Boolean).length;
        const suggestions = [];

        if (!checks.length) suggestions.push('Use at least 8 characters');
        if (!checks.uppercase) suggestions.push('Include uppercase letters');
        if (!checks.lowercase) suggestions.push('Include lowercase letters');
        if (!checks.number) suggestions.push('Include numbers');
        if (!checks.special) suggestions.push('Include special characters');

        // Check against common passwords
        const commonPasswords = ['password', '123456', 'qwerty', 'admin', 'letmein'];
        if (commonPasswords.includes(password.toLowerCase())) {
            suggestions.push('Avoid common passwords');
        }

        return {
            valid: score >= 4,
            score,
            suggestions,
            checks
        };
    }

    /**
     * Add suspicious activity for an IP
     * @param {string} clientIP - Client IP address
     * @param {string} activityType - Type of suspicious activity
     * @param {Object} details - Additional details
     */
    addSuspiciousActivity(clientIP, activityType, details = {}) {
        if (!this.suspiciousIPs.has(clientIP)) {
            this.suspiciousIPs.set(clientIP, {
                activities: [],
                score: 0,
                firstSeen: Date.now()
            });
        }

        const ipData = this.suspiciousIPs.get(clientIP);
        ipData.activities.push({
            type: activityType,
            timestamp: Date.now(),
            details
        });

        // Increase suspicion score based on activity type
        const scoreIncrease = {
            'rate_limit_exceeded': 2,
            'malicious_pattern': 5,
            'brute_force_login': 8,
            'file_upload_violation': 3,
            'suspicious_behavior': 1
        };

        ipData.score += scoreIncrease[activityType] || 1;

        // Ban IP if score exceeds threshold
        if (ipData.score >= this.config.threatDetection.maxSuspiciousActions) {
            this.banIP(clientIP, `Suspicious score: ${ipData.score}`);
        }
    }

    /**
     * Ban an IP address
     * @param {string} clientIP - IP address to ban
     * @param {string} reason - Reason for ban
     */
    banIP(clientIP, reason) {
        this.bannedIPs.add(clientIP);
        this.securityStats.bannedIPs++;

        // Schedule unban
        setTimeout(() => {
            this.bannedIPs.delete(clientIP);
            this.suspiciousIPs.delete(clientIP);
            console.log(`🛡️  IP unbanned: ${clientIP}`);
        }, this.config.threatDetection.banDuration);

        this.logSecurityEvent('ip_banned', {
            ip: clientIP,
            reason,
            duration: this.config.threatDetection.banDuration
        }, 'critical');

        console.warn(`🚫 IP banned: ${clientIP} (${reason})`);
    }

    /**
     * Log security event
     * @param {string} eventType - Type of security event
     * @param {Object} details - Event details
     * @param {string} severity - Event severity (info, low, medium, high, critical)
     */
    async logSecurityEvent(eventType, details, severity = 'info') {
        const event = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            type: eventType,
            severity,
            details,
            environment: process.env.NODE_ENV || 'development'
        };

        this.securityEvents.push(event);
        this.securityStats.securityAlerts++;

        // Emit event for external monitoring
        this.emit('securityEvent', event);

        // Write to audit log
        if (this.config.audit.enabled) {
            try {
                const logEntry = `${event.timestamp} [${severity.toUpperCase()}] ${eventType}: ${JSON.stringify(details)}\n`;
                await fs.appendFile(this.config.audit.logFile, logEntry);
            } catch (error) {
                console.error('❌ Failed to write security audit log:', error.message);
            }
        }

        console.log(`🛡️  Security event [${severity}]: ${eventType}`, details);
    }

    // Utility methods

    getClientIP(req) {
        return req.ip || 
               req.connection.remoteAddress || 
               req.socket.remoteAddress ||
               (req.headers['x-forwarded-for'] && req.headers['x-forwarded-for'].split(',')[0]) ||
               '127.0.0.1';
    }

    sanitizeHtml(input) {
        return input
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/vbscript:/gi, '')
            .replace(/on\w+\s*=/gi, '');
    }

    preventSQLInjection(input) {
        return input
            .replace(/(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/gi, '')
            .replace(/[';--]/g, '');
    }

    preventXSS(input) {
        return input
            .replace(/[<>]/g, (match) => {
                return match === '<' ? '&lt;' : '&gt;';
            })
            .replace(/['"]/g, (match) => {
                return match === '"' ? '&quot;' : '&#x27;';
            });
    }

    sanitizeFilename(filename) {
        return filename
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .replace(/_{2,}/g, '_')
            .substring(0, 255);
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    cleanupSecurityEvents() {
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        this.securityEvents = this.securityEvents.filter(event => 
            now - new Date(event.timestamp).getTime() < maxAge
        );
    }

    cleanupBannedIPs() {
        // Rate limit cleanup
        const now = Date.now();
        for (const [ip, requests] of this.rateLimitStore.entries()) {
            const recentRequests = requests.filter(timestamp => 
                now - timestamp < this.config.rateLimit.window
            );
            
            if (recentRequests.length === 0) {
                this.rateLimitStore.delete(ip);
            } else {
                this.rateLimitStore.set(ip, recentRequests);
            }
        }

        // Login attempts cleanup
        for (const [ip, attempts] of this.loginAttempts.entries()) {
            if (now - attempts.lastAttempt > this.config.auth.lockoutDuration) {
                this.loginAttempts.delete(ip);
            }
        }
    }

    // API methods

    getSecurityStatus() {
        return {
            statistics: {
                ...this.securityStats,
                uptime: Date.now() - this.securityStats.uptime,
                currentTime: Date.now()
            },
            activeThreats: {
                bannedIPs: Array.from(this.bannedIPs),
                suspiciousIPs: Array.from(this.suspiciousIPs.entries()).map(([ip, data]) => ({
                    ip,
                    score: data.score,
                    activities: data.activities.length,
                    firstSeen: data.firstSeen
                })),
                rateLimitedIPs: Array.from(this.rateLimitStore.entries()).map(([ip, requests]) => ({
                    ip,
                    recentRequests: requests.length
                }))
            },
            configuration: {
                rateLimitEnabled: this.config.rateLimit.enabled,
                threatDetectionEnabled: this.config.threatDetection.enabled,
                auditEnabled: this.config.audit.enabled,
                strongPasswordsRequired: this.config.auth.requireStrongPasswords
            }
        };
    }

    getRecentSecurityEvents(limit = 50) {
        return this.securityEvents
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, limit);
    }

    getSecurityConfiguration() {
        return {
            rateLimit: this.config.rateLimit,
            auth: this.config.auth,
            validation: this.config.validation,
            headers: this.config.headers,
            threatDetection: this.config.threatDetection,
            audit: this.config.audit
        };
    }

    updateConfiguration(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('🛡️  Security configuration updated');
        this.emit('configurationUpdated', this.config);
    }

    async generateSecurityReport() {
        const report = {
            generatedAt: new Date().toISOString(),
            timeRange: '24h',
            statistics: this.securityStats,
            threats: {
                bannedIPs: this.bannedIPs.size,
                suspiciousActivity: this.suspiciousIPs.size,
                recentEvents: this.securityEvents.length
            },
            recommendations: []
        };

        // Add recommendations based on current state
        if (this.securityStats.blockedRequests > 100) {
            report.recommendations.push('High number of blocked requests detected. Consider reviewing rate limit settings.');
        }

        if (this.securityStats.failedLogins > 50) {
            report.recommendations.push('High number of failed login attempts. Consider implementing additional authentication measures.');
        }

        if (this.bannedIPs.size > 10) {
            report.recommendations.push('Large number of banned IPs. Review threat detection thresholds.');
        }

        return report;
    }
}

module.exports = ProductionSecurityService;