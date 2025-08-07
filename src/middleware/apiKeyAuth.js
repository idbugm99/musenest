/**
 * API Key Authentication Middleware
 * Handles authentication for remote configuration management
 */

class ApiKeyAuth {
    constructor(dbConnection) {
        this.db = dbConnection;
        this.keyCache = new Map(); // Cache active keys for performance
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Express middleware for API key authentication
     */
    authenticate(requiredPermissions = []) {
        return async (req, res, next) => {
            try {
                const apiKey = this.extractApiKey(req);
                
                if (!apiKey) {
                    return res.status(401).json({
                        success: false,
                        error: 'API key required',
                        code: 'MISSING_API_KEY'
                    });
                }

                const keyData = await this.validateApiKey(apiKey);
                
                if (!keyData) {
                    return res.status(401).json({
                        success: false,
                        error: 'Invalid or expired API key',
                        code: 'INVALID_API_KEY'
                    });
                }

                // Check permissions
                if (requiredPermissions.length > 0) {
                    const hasPermission = this.checkPermissions(keyData.permissions, requiredPermissions);
                    
                    if (!hasPermission) {
                        return res.status(403).json({
                            success: false,
                            error: 'Insufficient permissions',
                            code: 'INSUFFICIENT_PERMISSIONS',
                            required: requiredPermissions,
                            granted: keyData.permissions
                        });
                    }
                }

                // Log API key usage
                await this.logKeyUsage(keyData.key_name, req);

                // Attach key info to request
                req.apiKey = keyData;
                req.clientIp = this.getClientIp(req);
                
                next();
                
            } catch (error) {
                console.error('API key authentication error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Internal authentication error',
                    code: 'AUTH_ERROR'
                });
            }
        };
    }

    /**
     * Extract API key from request
     */
    extractApiKey(req) {
        // Check Authorization header: Bearer <key>
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }

        // Check X-API-Key header
        const apiKeyHeader = req.headers['x-api-key'];
        if (apiKeyHeader) {
            return apiKeyHeader;
        }

        // Check query parameter (less secure, for development)
        if (req.query.api_key) {
            return req.query.api_key;
        }

        return null;
    }

    /**
     * Validate API key against database
     */
    async validateApiKey(apiKey) {
        // Check cache first
        const cacheKey = `api_key_${apiKey}`;
        const cached = this.keyCache.get(cacheKey);
        
        if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
            return cached.data;
        }

        try {
            const [rows] = await this.db.execute(`
                SELECT 
                    id, key_name, api_key, permissions, is_active,
                    expires_at, created_by, last_used_at
                FROM api_keys 
                WHERE api_key = ? AND is_active = true
            `, [apiKey]);

            if (rows.length === 0) {
                return null;
            }

            const keyData = rows[0];

            // Check expiry
            if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
                console.log(`API key ${keyData.key_name} has expired`);
                return null;
            }

            // Parse permissions JSON
            let permissions = {};
            try {
                permissions = typeof keyData.permissions === 'string' 
                    ? JSON.parse(keyData.permissions) 
                    : keyData.permissions;
            } catch (parseError) {
                console.error('Failed to parse API key permissions:', parseError);
                return null;
            }

            const validatedKey = {
                ...keyData,
                permissions
            };

            // Cache the result
            this.keyCache.set(cacheKey, {
                data: validatedKey,
                timestamp: Date.now()
            });

            return validatedKey;

        } catch (error) {
            console.error('Database error validating API key:', error);
            return null;
        }
    }

    /**
     * Check if API key has required permissions
     */
    checkPermissions(keyPermissions, requiredPermissions) {
        for (const required of requiredPermissions) {
            const [resource, action] = required.split(':');
            
            if (!keyPermissions[resource]) {
                return false;
            }

            if (!keyPermissions[resource].includes(action)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Log API key usage
     */
    async logKeyUsage(keyName, req) {
        try {
            await this.db.execute(`
                UPDATE api_keys 
                SET last_used_at = NOW() 
                WHERE key_name = ?
            `, [keyName]);
            
            console.log(`API key used: ${keyName} from ${this.getClientIp(req)} - ${req.method} ${req.path}`);
        } catch (error) {
            console.error('Failed to log API key usage:', error);
        }
    }

    /**
     * Get client IP address
     */
    getClientIp(req) {
        return req.headers['x-forwarded-for'] ||
               req.headers['x-real-ip'] ||
               req.connection.remoteAddress ||
               req.socket.remoteAddress ||
               (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
               'unknown';
    }

    /**
     * Generate new API key
     */
    generateApiKey(prefix = 'mns') {
        const crypto = require('crypto');
        const timestamp = Date.now().toString(36);
        const random = crypto.randomBytes(32).toString('hex');
        return `${prefix}_${timestamp}_${random}`;
    }

    /**
     * Create new API key
     */
    async createApiKey(keyData) {
        const {
            key_name,
            permissions,
            expires_at = null,
            created_by = 'system'
        } = keyData;

        const api_key = this.generateApiKey();

        try {
            const [result] = await this.db.execute(`
                INSERT INTO api_keys (
                    key_name, api_key, permissions, expires_at, created_by
                ) VALUES (?, ?, ?, ?, ?)
            `, [
                key_name,
                api_key,
                JSON.stringify(permissions),
                expires_at,
                created_by
            ]);

            console.log(`Created new API key: ${key_name}`);
            
            return {
                id: result.insertId,
                key_name,
                api_key,
                permissions,
                expires_at,
                created_by
            };

        } catch (error) {
            console.error('Failed to create API key:', error);
            throw error;
        }
    }

    /**
     * Revoke API key
     */
    async revokeApiKey(keyName) {
        try {
            await this.db.execute(`
                UPDATE api_keys 
                SET is_active = false, updated_at = NOW()
                WHERE key_name = ?
            `, [keyName]);

            // Remove from cache
            this.keyCache.delete(`api_key_${keyName}`);
            
            console.log(`Revoked API key: ${keyName}`);
            return true;

        } catch (error) {
            console.error('Failed to revoke API key:', error);
            return false;
        }
    }

    /**
     * Clear cache (useful for testing or forced refresh)
     */
    clearCache() {
        this.keyCache.clear();
        console.log('API key cache cleared');
    }
}

module.exports = ApiKeyAuth;