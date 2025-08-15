/**
 * Universal Gallery API Routes
 * 
 * Comprehensive API endpoints for managing gallery configurations,
 * themes, validation, and performance monitoring.
 */

const express = require('express');
const mysql = require('mysql2/promise');
const router = express.Router();

// Import services
const ThemeConfigValidator = require('../../src/services/ThemeConfigValidator');
const UniversalGalleryService = require('../../src/services/UniversalGalleryService');

// Initialize services
const validator = new ThemeConfigValidator();
const galleryService = new UniversalGalleryService();

// Database connection helper
const getDbConnection = async () => {
    return await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_DATABASE || 'musenest',
        charset: 'utf8mb4'
    });
};

// Error handling middleware
const handleApiError = (error, res) => {
    console.error('API Error:', error);
    
    if (error.code === 'ER_NO_SUCH_TABLE') {
        return res.status(503).json({
            error: 'Database not properly initialized',
            message: 'Please run the universal gallery migration first'
        });
    }
    
    if (error.code === 'ECONNREFUSED') {
        return res.status(503).json({
            error: 'Database connection failed',
            message: 'Unable to connect to database'
        });
    }
    
    res.status(500).json({
        error: 'Internal server error',
        message: error.message || 'An unexpected error occurred'
    });
};

// ===== System Configuration Endpoints =====

/**
 * GET /api/universal-gallery/config/system
 * Get current system configuration
 */
router.get('/config/system', async (req, res) => {
    let db;
    try {
        db = await getDbConnection();
        
        const [rows] = await db.execute(
            'SELECT setting_value FROM gallery_system_defaults WHERE setting_name = ? AND is_active = TRUE',
            ['default_gallery_config']
        );
        
        if (rows.length === 0) {
            // Return default configuration if none found
            const defaultConfig = {
                defaultLayout: 'masonry',
                imagesPerPage: 20,
                gridColumns: 4,
                enableLightbox: true,
                enableFullscreen: true,
                enableZoom: true,
                lightboxAnimation: 'fade',
                showCaptions: true,
                showImageInfo: false,
                showCategoryFilter: true,
                enableSearch: false,
                enableLazyLoading: true,
                enablePrefetch: true,
                prefetchStrategy: 'balanced',
                respectReducedMotion: true
            };
            
            return res.json(defaultConfig);
        }
        
        const config = JSON.parse(rows[0].setting_value);
        res.json(config);
        
    } catch (error) {
        handleApiError(error, res);
    } finally {
        if (db) await db.end();
    }
});

/**
 * PUT /api/universal-gallery/config/system
 * Update system configuration
 */
router.put('/config/system', async (req, res) => {
    let db;
    try {
        db = await getDbConnection();
        
        const config = req.body;
        
        // Validate configuration
        const validationResult = await validator.validateConfig(config);
        if (!validationResult.valid) {
            return res.status(400).json({
                error: 'Configuration validation failed',
                errors: validationResult.errors
            });
        }
        
        // Update or insert configuration
        await db.execute(`
            INSERT INTO gallery_system_defaults (setting_name, setting_value, description, updated_at)
            VALUES (?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE 
                setting_value = VALUES(setting_value),
                updated_at = NOW()
        `, [
            'default_gallery_config',
            JSON.stringify(config),
            'System-wide gallery configuration'
        ]);
        
        // Log configuration change
        await db.execute(`
            INSERT INTO gallery_migration_log (migration_name, migration_version, affected_rows, success)
            VALUES (?, ?, ?, ?)
        `, [
            'system_config_update',
            '1.0.0',
            1,
            true
        ]);
        
        res.json({ 
            success: true, 
            message: 'System configuration updated successfully',
            config: config
        });
        
    } catch (error) {
        handleApiError(error, res);
    } finally {
        if (db) await db.end();
    }
});

/**
 * GET /api/universal-gallery/config/defaults
 * Get factory default configuration
 */
router.get('/config/defaults', async (req, res) => {
    try {
        const defaultConfig = {
            defaultLayout: 'masonry',
            imagesPerPage: 20,
            gridColumns: 4,
            enableLightbox: true,
            enableFullscreen: true,
            enableZoom: true,
            lightboxAnimation: 'fade',
            showCaptions: true,
            showImageInfo: false,
            showCategoryFilter: true,
            enableSearch: false,
            enableLazyLoading: true,
            enablePrefetch: true,
            prefetchStrategy: 'balanced',
            respectReducedMotion: true
        };
        
        res.json(defaultConfig);
        
    } catch (error) {
        handleApiError(error, res);
    }
});

// ===== Theme Configuration Endpoints =====

/**
 * GET /api/universal-gallery/themes
 * Get all available themes
 */
router.get('/themes', async (req, res) => {
    let db;
    try {
        db = await getDbConnection();
        
        const [themes] = await db.execute(`
            SELECT 
                ts.id,
                ts.name,
                ts.display_name,
                ts.description,
                ts.category,
                ts.pricing_tier,
                ts.is_active,
                COUNT(tsp.id) as page_count
            FROM theme_sets ts
            LEFT JOIN theme_set_pages tsp ON ts.id = tsp.theme_set_id
            WHERE ts.is_active = TRUE
            GROUP BY ts.id
            ORDER BY ts.display_name
        `);
        
        res.json(themes);
        
    } catch (error) {
        handleApiError(error, res);
    } finally {
        if (db) await db.end();
    }
});

/**
 * GET /api/universal-gallery/themes/:themeId/config
 * Get theme-specific configuration
 */
router.get('/themes/:themeId/config', async (req, res) => {
    let db;
    try {
        db = await getDbConnection();
        const { themeId } = req.params;
        
        // Check if theme exists
        const [themeRows] = await db.execute(
            'SELECT * FROM theme_sets WHERE id = ? OR name = ?',
            [themeId, themeId]
        );
        
        if (themeRows.length === 0) {
            return res.status(404).json({
                error: 'Theme not found',
                message: `Theme "${themeId}" does not exist`
            });
        }
        
        // Get theme configuration from universal_gallery_configs
        const [configRows] = await db.execute(
            'SELECT config_json FROM universal_gallery_configs WHERE config_name = ? AND is_active = TRUE',
            [`${themeRows[0].name}_theme_config`]
        );
        
        let config = {};
        if (configRows.length > 0) {
            config = JSON.parse(configRows[0].config_json);
        }
        
        res.json({
            theme: themeRows[0],
            config: config
        });
        
    } catch (error) {
        handleApiError(error, res);
    } finally {
        if (db) await db.end();
    }
});

/**
 * PUT /api/universal-gallery/themes/:themeId/config
 * Update theme-specific configuration
 */
router.put('/themes/:themeId/config', async (req, res) => {
    let db;
    try {
        db = await getDbConnection();
        const { themeId } = req.params;
        const config = req.body;
        
        // Check if theme exists
        const [themeRows] = await db.execute(
            'SELECT * FROM theme_sets WHERE id = ? OR name = ?',
            [themeId, themeId]
        );
        
        if (themeRows.length === 0) {
            return res.status(404).json({
                error: 'Theme not found',
                message: `Theme "${themeId}" does not exist`
            });
        }
        
        const theme = themeRows[0];
        
        // Validate configuration
        const validationResult = await validator.validateConfig(config);
        if (!validationResult.valid) {
            return res.status(400).json({
                error: 'Theme configuration validation failed',
                errors: validationResult.errors
            });
        }
        
        // Update theme configuration
        await db.execute(`
            INSERT INTO universal_gallery_configs (config_name, config_json, description, updated_at)
            VALUES (?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE 
                config_json = VALUES(config_json),
                updated_at = NOW()
        `, [
            `${theme.name}_theme_config`,
            JSON.stringify(config),
            `Configuration for ${theme.display_name || theme.name} theme`
        ]);
        
        res.json({
            success: true,
            message: `Theme configuration updated for ${theme.name}`,
            theme: theme.name,
            config: config
        });
        
    } catch (error) {
        handleApiError(error, res);
    } finally {
        if (db) await db.end();
    }
});

/**
 * POST /api/universal-gallery/themes
 * Create new theme configuration
 */
router.post('/themes', async (req, res) => {
    let db;
    try {
        db = await getDbConnection();
        const { name, display_name, description, config } = req.body;
        
        if (!name || !config) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'Theme name and configuration are required'
            });
        }
        
        // Check if theme already exists
        const [existingTheme] = await db.execute(
            'SELECT id FROM theme_sets WHERE name = ?',
            [name]
        );
        
        if (existingTheme.length > 0) {
            return res.status(409).json({
                error: 'Theme already exists',
                message: `Theme "${name}" already exists`
            });
        }
        
        // Validate configuration
        const validationResult = await validator.validateConfig(config);
        if (!validationResult.valid) {
            return res.status(400).json({
                error: 'Theme configuration validation failed',
                errors: validationResult.errors
            });
        }
        
        // Create theme entry
        const [themeResult] = await db.execute(`
            INSERT INTO theme_sets (name, display_name, description, category, pricing_tier, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
        `, [
            name,
            display_name || name,
            description || `Custom theme: ${name}`,
            'custom',
            'free',
            1
        ]);
        
        // Save theme configuration
        await db.execute(`
            INSERT INTO universal_gallery_configs (config_name, config_json, description, created_at, updated_at)
            VALUES (?, ?, ?, NOW(), NOW())
        `, [
            `${name}_theme_config`,
            JSON.stringify(config),
            `Configuration for ${display_name || name} theme`
        ]);
        
        res.status(201).json({
            success: true,
            message: 'Theme created successfully',
            theme_id: themeResult.insertId,
            theme_name: name
        });
        
    } catch (error) {
        handleApiError(error, res);
    } finally {
        if (db) await db.end();
    }
});

// ===== Model Override Endpoints =====

/**
 * GET /api/universal-gallery/models
 * Get all models with their gallery configurations
 */
router.get('/models', async (req, res) => {
    let db;
    try {
        db = await getDbConnection();
        
        const { search, filter, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        
        let whereClause = 'WHERE m.id IS NOT NULL';
        let queryParams = [];
        
        // Apply search filter
        if (search) {
            whereClause += ' AND (m.name LIKE ? OR m.slug LIKE ?)';
            queryParams.push(`%${search}%`, `%${search}%`);
        }
        
        // Apply status filter
        if (filter === 'with-overrides') {
            whereClause += ' AND mgpc.model_id IS NOT NULL';
        } else if (filter === 'using-defaults') {
            whereClause += ' AND mgpc.model_id IS NULL';
        }
        
        const [models] = await db.execute(`
            SELECT 
                m.id,
                m.name,
                m.slug,
                m.status,
                ts.name as theme_name,
                ts.display_name as theme_display_name,
                CASE WHEN mgpc.model_id IS NOT NULL THEN TRUE ELSE FALSE END as has_custom_config,
                mgpc.enable_lightbox,
                mgpc.show_captions,
                mgpc.default_layout
            FROM models m
            LEFT JOIN theme_sets ts ON m.theme_set_id = ts.id
            LEFT JOIN model_gallery_page_content mgpc ON m.id = mgpc.model_id
            ${whereClause}
            ORDER BY m.name
            LIMIT ? OFFSET ?
        `, [...queryParams, parseInt(limit), parseInt(offset)]);
        
        // Get total count
        const [countResult] = await db.execute(`
            SELECT COUNT(*) as total
            FROM models m
            LEFT JOIN model_gallery_page_content mgpc ON m.id = mgpc.model_id
            ${whereClause}
        `, queryParams);
        
        res.json({
            models: models,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult[0].total,
                pages: Math.ceil(countResult[0].total / limit)
            }
        });
        
    } catch (error) {
        handleApiError(error, res);
    } finally {
        if (db) await db.end();
    }
});

/**
 * GET /api/universal-gallery/models/:modelId/config
 * Get model-specific gallery configuration
 */
router.get('/models/:modelId/config', async (req, res) => {
    let db;
    try {
        db = await getDbConnection();
        const { modelId } = req.params;
        
        // Get model info
        const [modelRows] = await db.execute(
            'SELECT * FROM models WHERE id = ?',
            [modelId]
        );
        
        if (modelRows.length === 0) {
            return res.status(404).json({
                error: 'Model not found',
                message: `Model with ID "${modelId}" does not exist`
            });
        }
        
        // Get model gallery configuration
        const [configRows] = await db.execute(
            'SELECT * FROM model_gallery_page_content WHERE model_id = ?',
            [modelId]
        );
        
        const model = modelRows[0];
        const config = configRows.length > 0 ? configRows[0] : null;
        
        res.json({
            model: model,
            config: config,
            has_custom_config: config !== null
        });
        
    } catch (error) {
        handleApiError(error, res);
    } finally {
        if (db) await db.end();
    }
});

/**
 * PUT /api/universal-gallery/models/:modelId/config
 * Update model-specific gallery configuration
 */
router.put('/models/:modelId/config', async (req, res) => {
    let db;
    try {
        db = await getDbConnection();
        const { modelId } = req.params;
        const config = req.body;
        
        // Check if model exists
        const [modelRows] = await db.execute(
            'SELECT * FROM models WHERE id = ?',
            [modelId]
        );
        
        if (modelRows.length === 0) {
            return res.status(404).json({
                error: 'Model not found',
                message: `Model with ID "${modelId}" does not exist`
            });
        }
        
        // Validate configuration
        const validationResult = await validator.validateConfig(config);
        if (!validationResult.valid) {
            return res.status(400).json({
                error: 'Model configuration validation failed',
                errors: validationResult.errors
            });
        }
        
        // Update or insert model gallery configuration
        const configFields = Object.keys(config);
        const configValues = Object.values(config);
        
        await db.execute(`
            INSERT INTO model_gallery_page_content (
                model_id, 
                ${configFields.join(', ')}, 
                updated_at
            )
            VALUES (?, ${configFields.map(() => '?').join(', ')}, NOW())
            ON DUPLICATE KEY UPDATE
                ${configFields.map(field => `${field} = VALUES(${field})`).join(', ')},
                updated_at = NOW()
        `, [modelId, ...configValues]);
        
        res.json({
            success: true,
            message: 'Model gallery configuration updated successfully',
            model_id: modelId,
            config: config
        });
        
    } catch (error) {
        handleApiError(error, res);
    } finally {
        if (db) await db.end();
    }
});

// ===== Statistics and Monitoring Endpoints =====

/**
 * GET /api/universal-gallery/stats
 * Get dashboard statistics
 */
router.get('/stats', async (req, res) => {
    let db;
    try {
        db = await getDbConnection();
        
        // Get various statistics
        const [galleryStats] = await db.execute(`
            SELECT 
                (SELECT COUNT(*) FROM model_gallery_page_content) as total_galleries,
                (SELECT COUNT(*) FROM theme_sets WHERE is_active = TRUE) as active_themes,
                (SELECT COUNT(*) FROM models WHERE status = 'active') as active_models
        `);
        
        // Get validation issues (placeholder - would need actual validation logic)
        const validationIssues = 0;
        
        // Get average performance (placeholder - would need actual performance data)
        const avgPerformance = 1250; // ms
        
        res.json({
            totalGalleries: galleryStats[0].total_galleries,
            activeThemes: galleryStats[0].active_themes,
            activeModels: galleryStats[0].active_models,
            validationIssues: validationIssues,
            avgPerformance: avgPerformance
        });
        
    } catch (error) {
        handleApiError(error, res);
    } finally {
        if (db) await db.end();
    }
});

/**
 * GET /api/universal-gallery/activity/recent
 * Get recent configuration changes
 */
router.get('/activity/recent', async (req, res) => {
    let db;
    try {
        db = await getDbConnection();
        const { limit = 10 } = req.query;
        
        const [activities] = await db.execute(`
            SELECT 
                migration_name as type,
                CONCAT('System updated: ', migration_name) as title,
                CONCAT('Migration version ', migration_version, ' applied successfully') as description,
                applied_at as timestamp
            FROM gallery_migration_log
            ORDER BY applied_at DESC
            LIMIT ?
        `, [parseInt(limit)]);
        
        res.json(activities);
        
    } catch (error) {
        handleApiError(error, res);
    } finally {
        if (db) await db.end();
    }
});

// ===== Configuration Validation Endpoints =====

/**
 * POST /api/universal-gallery/validate
 * Validate a configuration object
 */
router.post('/validate', async (req, res) => {
    try {
        const config = req.body;
        
        // Validate using our validation service
        const result = await validator.validateConfig(config);
        
        res.json({
            valid: result.valid,
            errors: result.errors || [],
            warnings: result.warnings || [],
            suggestions: result.suggestions || []
        });
        
    } catch (error) {
        handleApiError(error, res);
    }
});

/**
 * POST /api/universal-gallery/validate/all
 * Validate all configurations
 */
router.post('/validate/all', async (req, res) => {
    let db;
    try {
        db = await getDbConnection();
        
        const results = {
            system: { valid: true, errors: [] },
            themes: {},
            models: {}
        };
        
        // Validate system configuration
        const [systemConfig] = await db.execute(
            'SELECT setting_value FROM gallery_system_defaults WHERE setting_name = ?',
            ['default_gallery_config']
        );
        
        if (systemConfig.length > 0) {
            const config = JSON.parse(systemConfig[0].setting_value);
            results.system = await validator.validateConfig(config);
        }
        
        // Validate theme configurations
        const [themeConfigs] = await db.execute(`
            SELECT uc.config_name, uc.config_json, ts.name
            FROM universal_gallery_configs uc
            JOIN theme_sets ts ON uc.config_name = CONCAT(ts.name, '_theme_config')
            WHERE uc.is_active = TRUE
        `);
        
        for (const themeConfig of themeConfigs) {
            const config = JSON.parse(themeConfig.config_json);
            results.themes[themeConfig.name] = await validator.validateConfig(config);
        }
        
        res.json({
            success: true,
            results: results,
            summary: {
                total_validated: 1 + Object.keys(results.themes).length,
                valid_count: Object.values(results).filter(r => r.valid || Object.values(r).every(v => v.valid)).length,
                error_count: Object.values(results).reduce((sum, r) => 
                    sum + (r.errors ? r.errors.length : Object.values(r).reduce((s, v) => s + (v.errors || []).length, 0)), 0)
            }
        });
        
    } catch (error) {
        handleApiError(error, res);
    } finally {
        if (db) await db.end();
    }
});

// ===== Export/Import Endpoints =====

/**
 * GET /api/universal-gallery/export
 * Export all configurations
 */
router.get('/export', async (req, res) => {
    let db;
    try {
        db = await getDbConnection();
        
        // Export system configuration
        const [systemConfig] = await db.execute(
            'SELECT setting_value FROM gallery_system_defaults WHERE setting_name = ?',
            ['default_gallery_config']
        );
        
        // Export theme configurations
        const [themeConfigs] = await db.execute(
            'SELECT * FROM universal_gallery_configs WHERE is_active = TRUE'
        );
        
        // Export model configurations
        const [modelConfigs] = await db.execute(`
            SELECT m.id, m.name, m.slug, mgpc.*
            FROM models m
            JOIN model_gallery_page_content mgpc ON m.id = mgpc.model_id
        `);
        
        const exportData = {
            version: '1.0.0',
            exported_at: new Date().toISOString(),
            system: systemConfig.length > 0 ? JSON.parse(systemConfig[0].setting_value) : null,
            themes: themeConfigs.map(config => ({
                name: config.config_name,
                config: JSON.parse(config.config_json),
                description: config.description,
                version: config.version
            })),
            models: modelConfigs
        };
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="universal-gallery-config-${Date.now()}.json"`);
        res.json(exportData);
        
    } catch (error) {
        handleApiError(error, res);
    } finally {
        if (db) await db.end();
    }
});

module.exports = router;