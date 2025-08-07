/**
 * Analysis Configuration API Routes
 * Allows remote management of NudeNet/BLIP detection settings
 */

const express = require('express');
const router = express.Router();

class AnalysisConfigAPI {
    constructor(dbConnection, apiKeyAuth) {
        this.db = dbConnection;
        this.apiKeyAuth = apiKeyAuth;
        this.configCache = new Map();
        this.cacheExpiry = 10 * 60 * 1000; // 10 minutes
        
        this.setupRoutes();
    }

    setupRoutes() {
        // Get configuration for usage intent
        router.get('/config/:usage_intent', 
            this.apiKeyAuth.authenticate(['analysis_config:read']),
            this.getConfig.bind(this)
        );

        // Get configuration for specific model
        router.get('/config/:usage_intent/:model_id', 
            this.apiKeyAuth.authenticate(['analysis_config:read']),
            this.getConfig.bind(this)
        );

        // Update configuration
        router.put('/config/:usage_intent', 
            this.apiKeyAuth.authenticate(['analysis_config:write']),
            this.updateConfig.bind(this)
        );

        // Update model-specific configuration
        router.put('/config/:usage_intent/:model_id', 
            this.apiKeyAuth.authenticate(['analysis_config:write']),
            this.updateConfig.bind(this)
        );

        // Delete configuration (sets inactive)
        router.delete('/config/:usage_intent', 
            this.apiKeyAuth.authenticate(['analysis_config:delete']),
            this.deleteConfig.bind(this)
        );

        // Get audit trail
        router.get('/config/:usage_intent/audit', 
            this.apiKeyAuth.authenticate(['audit_trail:read']),
            this.getAuditTrail.bind(this)
        );

        // Validate configuration without saving
        router.post('/config/validate', 
            this.apiKeyAuth.authenticate(['analysis_config:read']),
            this.validateConfig.bind(this)
        );

        // Clear cache (admin function)
        router.post('/config/cache/clear', 
            this.apiKeyAuth.authenticate(['analysis_config:write']),
            this.clearCache.bind(this)
        );
    }

    /**
     * Get configuration for usage intent (with optional model override)
     */
    async getConfig(req, res) {
        try {
            const { usage_intent, model_id } = req.params;
            
            if (!this.isValidUsageIntent(usage_intent)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid usage_intent',
                    valid_options: ['public_site', 'paysite', 'store', 'private']
                });
            }

            const config = await this.loadConfiguration(usage_intent, model_id || null);
            
            if (!config) {
                return res.status(404).json({
                    success: false,
                    error: 'Configuration not found',
                    usage_intent,
                    model_id: model_id || null
                });
            }

            res.json({
                success: true,
                data: config,
                cache_status: this.getCacheStatus(usage_intent, model_id)
            });

        } catch (error) {
            console.error('Get config error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }

    /**
     * Update configuration
     */
    async updateConfig(req, res) {
        try {
            const { usage_intent, model_id } = req.params;
            const configData = req.body;

            if (!this.isValidUsageIntent(usage_intent)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid usage_intent'
                });
            }

            // Validate configuration structure
            const validation = this.validateConfigurationData(configData);
            if (!validation.valid) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid configuration data',
                    validation_errors: validation.errors
                });
            }

            // Get current config for audit trail
            const currentConfig = await this.loadConfiguration(usage_intent, model_id || null);
            
            // Save new configuration
            const newConfig = await this.saveConfiguration(
                usage_intent, 
                model_id || null, 
                configData,
                req.apiKey.key_name,
                req.clientIp,
                req.headers['user-agent']
            );

            // Log the change
            await this.logConfigChange(
                newConfig.id,
                'update',
                req.apiKey.key_name,
                req.clientIp,
                req.headers['user-agent'],
                configData,
                currentConfig,
                usage_intent,
                model_id || null
            );

            // Clear cache for this config
            this.clearConfigCache(usage_intent, model_id);

            res.json({
                success: true,
                data: newConfig,
                message: 'Configuration updated successfully'
            });

        } catch (error) {
            console.error('Update config error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update configuration'
            });
        }
    }

    /**
     * Delete (deactivate) configuration
     */
    async deleteConfig(req, res) {
        try {
            const { usage_intent, model_id } = req.params;

            const currentConfig = await this.loadConfiguration(usage_intent, model_id || null);
            
            if (!currentConfig) {
                return res.status(404).json({
                    success: false,
                    error: 'Configuration not found'
                });
            }

            // Deactivate configuration
            await this.db.execute(`
                UPDATE analysis_configurations 
                SET is_active = false, updated_at = NOW()
                WHERE usage_intent = ? AND model_id <=> ?
            `, [usage_intent, model_id || null]);

            // Log the change
            await this.logConfigChange(
                currentConfig.id,
                'delete',
                req.apiKey.key_name,
                req.clientIp,
                req.headers['user-agent'],
                null,
                currentConfig,
                usage_intent,
                model_id || null
            );

            // Clear cache
            this.clearConfigCache(usage_intent, model_id);

            res.json({
                success: true,
                message: 'Configuration deactivated successfully'
            });

        } catch (error) {
            console.error('Delete config error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to delete configuration'
            });
        }
    }

    /**
     * Get audit trail for configuration changes
     */
    async getAuditTrail(req, res) {
        try {
            const { usage_intent } = req.params;
            const { limit = 50, offset = 0 } = req.query;

            const [rows] = await this.db.execute(`
                SELECT 
                    aca.*, ac.version
                FROM analysis_config_audit aca
                LEFT JOIN analysis_configurations ac ON aca.config_id = ac.id
                WHERE aca.usage_intent = ?
                ORDER BY aca.timestamp DESC
                LIMIT ? OFFSET ?
            `, [usage_intent, parseInt(limit), parseInt(offset)]);

            res.json({
                success: true,
                data: rows,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    total: rows.length
                }
            });

        } catch (error) {
            console.error('Get audit trail error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve audit trail'
            });
        }
    }

    /**
     * Validate configuration without saving
     */
    async validateConfig(req, res) {
        try {
            const configData = req.body;
            const validation = this.validateConfigurationData(configData);

            res.json({
                success: true,
                valid: validation.valid,
                errors: validation.errors,
                warnings: validation.warnings || []
            });

        } catch (error) {
            console.error('Validate config error:', error);
            res.status(500).json({
                success: false,
                error: 'Validation failed'
            });
        }
    }

    /**
     * Clear configuration cache
     */
    async clearCache(req, res) {
        try {
            this.configCache.clear();
            
            res.json({
                success: true,
                message: 'Configuration cache cleared'
            });

        } catch (error) {
            console.error('Clear cache error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to clear cache'
            });
        }
    }

    /**
     * Load configuration with caching
     */
    async loadConfiguration(usageIntent, modelId = null) {
        const cacheKey = `config_${usageIntent}_${modelId || 'global'}`;
        const cached = this.configCache.get(cacheKey);

        if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
            return cached.data;
        }

        try {
            // Try model-specific first, then global
            const queries = modelId 
                ? [
                    [usageIntent, modelId],    // Model-specific
                    [usageIntent, null]        // Global fallback
                  ]
                : [[usageIntent, null]];       // Global only

            for (const [intent, mId] of queries) {
                const [rows] = await this.db.execute(`
                    SELECT * FROM analysis_configurations 
                    WHERE usage_intent = ? AND model_id <=> ? AND is_active = true
                    ORDER BY created_at DESC 
                    LIMIT 1
                `, [intent, mId]);

                if (rows.length > 0) {
                    const config = rows[0];
                    
                    // Parse JSON fields (handle both string and object formats)
                    config.detection_config = typeof config.detection_config === 'string' 
                        ? JSON.parse(config.detection_config) 
                        : config.detection_config;
                    config.scoring_config = typeof config.scoring_config === 'string' 
                        ? JSON.parse(config.scoring_config) 
                        : config.scoring_config;
                    config.blip_config = typeof config.blip_config === 'string' 
                        ? JSON.parse(config.blip_config) 
                        : config.blip_config;

                    // Cache the result
                    this.configCache.set(cacheKey, {
                        data: config,
                        timestamp: Date.now()
                    });

                    return config;
                }
            }

            return null;

        } catch (error) {
            console.error('Load configuration error:', error);
            return null;
        }
    }

    /**
     * Save configuration to database
     */
    async saveConfiguration(usageIntent, modelId, configData, changedBy, sourceIp, userAgent) {
        try {
            // Deactivate existing configuration
            await this.db.execute(`
                UPDATE analysis_configurations 
                SET is_active = false 
                WHERE usage_intent = ? AND model_id <=> ?
            `, [usageIntent, modelId]);

            // Insert new configuration
            const [result] = await this.db.execute(`
                INSERT INTO analysis_configurations (
                    usage_intent, model_id, detection_config, scoring_config, blip_config, is_active
                ) VALUES (?, ?, ?, ?, ?, true)
            `, [
                usageIntent,
                modelId,
                JSON.stringify(configData.detection_config),
                JSON.stringify(configData.scoring_config),
                JSON.stringify(configData.blip_config)
            ]);

            return {
                id: result.insertId,
                usage_intent: usageIntent,
                model_id: modelId,
                ...configData
            };

        } catch (error) {
            console.error('Save configuration error:', error);
            throw error;
        }
    }

    /**
     * Log configuration changes for audit trail
     */
    async logConfigChange(configId, action, changedBy, sourceIp, userAgent, newValues, previousValues, usageIntent, modelId) {
        try {
            await this.db.execute(`
                INSERT INTO analysis_config_audit (
                    config_id, action, changed_by, source_ip, user_agent, 
                    changes, previous_values, usage_intent, model_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                configId,
                action,
                changedBy,
                sourceIp,
                userAgent,
                JSON.stringify(newValues),
                JSON.stringify(previousValues),
                usageIntent,
                modelId
            ]);

        } catch (error) {
            console.error('Log config change error:', error);
        }
    }

    /**
     * Validate configuration data structure
     */
    validateConfigurationData(configData) {
        const errors = [];
        const warnings = [];

        // Check required top-level fields
        const requiredFields = ['detection_config', 'scoring_config', 'blip_config'];
        for (const field of requiredFields) {
            if (!configData[field]) {
                errors.push(`Missing required field: ${field}`);
            }
        }

        if (errors.length > 0) {
            return { valid: false, errors, warnings };
        }

        // Validate detection_config
        const detectionConfig = configData.detection_config;
        if (detectionConfig.nudenet_components) {
            for (const [key, value] of Object.entries(detectionConfig.nudenet_components)) {
                if (typeof value !== 'boolean') {
                    errors.push(`detection_config.nudenet_components.${key} must be boolean, got ${typeof value}`);
                }
            }
        }

        // Validate scoring_config
        const scoringConfig = configData.scoring_config;
        if (scoringConfig.detection_weights) {
            for (const [key, value] of Object.entries(scoringConfig.detection_weights)) {
                if (typeof value !== 'number' || value < 0 || value > 100) {
                    errors.push(`scoring_config.detection_weights.${key} must be number 0-100, got ${value}`);
                }
            }
        }

        if (scoringConfig.thresholds) {
            const thresholds = scoringConfig.thresholds;
            if (thresholds.auto_approve_under >= thresholds.auto_flag_over) {
                warnings.push('auto_approve_under should be less than auto_flag_over');
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Check if usage intent is valid
     */
    isValidUsageIntent(intent) {
        return ['public_site', 'paysite', 'store', 'private'].includes(intent);
    }

    /**
     * Clear cache for specific configuration
     */
    clearConfigCache(usageIntent, modelId) {
        const cacheKey = `config_${usageIntent}_${modelId || 'global'}`;
        this.configCache.delete(cacheKey);
    }

    /**
     * Get cache status for debugging
     */
    getCacheStatus(usageIntent, modelId) {
        const cacheKey = `config_${usageIntent}_${modelId || 'global'}`;
        const cached = this.configCache.get(cacheKey);
        
        return cached ? {
            cached: true,
            age_ms: Date.now() - cached.timestamp,
            expires_in_ms: this.cacheExpiry - (Date.now() - cached.timestamp)
        } : {
            cached: false
        };
    }

    getRouter() {
        return router;
    }
}

module.exports = AnalysisConfigAPI;