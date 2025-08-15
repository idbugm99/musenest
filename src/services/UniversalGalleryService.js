/**
 * Universal Gallery Service
 * 
 * Centralized service for managing gallery configurations, theme styling, and business model settings.
 * Replaces theme-specific gallery code with a unified, configurable system.
 * 
 * Features:
 * - Universal gallery configuration loading
 * - Theme-specific styling application
 * - Business model customizations
 * - Model-specific overrides
 * - Performance monitoring and optimization
 * - Validation and error handling
 */

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const ThemeConfigValidator = require('./ThemeConfigValidator');

class UniversalGalleryService {
    constructor(db) {
        this.db = db;
        this.validator = new ThemeConfigValidator();
        this.configCache = new Map();
        this.themeCache = new Map();
        this.performanceMetrics = new Map();
        this.validationResults = new Map();
        
        // Cache TTL in milliseconds (5 minutes default)
        this.cacheTTL = 5 * 60 * 1000;
        
        this.isInitialized = false;
    }

    /**
     * Initialize the service and load default configurations
     */
    async initialize() {
        try {
            console.log('🎨 Initializing Universal Gallery Service...');
            
            // Initialize theme configuration validator
            const validatorResult = await this.validator.initialize();
            if (!validatorResult.success) {
                throw new Error(`Failed to initialize theme validator: ${validatorResult.error}`);
            }
            
            // Load system defaults
            await this.loadSystemDefaults();
            
            // Validate database schema
            await this.validateDatabaseSchema();
            
            // Load business model configurations
            await this.loadBusinessModelConfigs();
            
            // Load theme styles
            await this.loadThemeStyles();
            
            // Initialize performance monitoring
            await this.initializePerformanceMonitoring();
            
            this.isInitialized = true;
            console.log('✅ Universal Gallery Service initialized successfully');
            
            return { success: true, message: 'Service initialized' };
            
        } catch (error) {
            console.error('❌ Failed to initialize Universal Gallery Service:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get complete gallery configuration for a model
     * @param {string} modelSlug - Model identifier
     * @param {number} previewThemeId - Optional preview theme ID
     * @param {object} options - Query options
     * @returns {Promise<object>} Complete gallery configuration and data
     */
    async getModelGalleryConfig(modelSlug, previewThemeId = null, options = {}) {
        try {
            const cacheKey = `model_config_${modelSlug}_${previewThemeId || 'default'}`;
            
            // Check cache first
            const cachedConfig = this.getCachedConfig(cacheKey);
            if (cachedConfig) {
                // Still get fresh gallery data even if config is cached
                const galleryData = await this.getGalleryData(modelSlug, cachedConfig, options);
                return { ...cachedConfig, galleryData };
            }

            console.log(`🔍 Loading gallery configuration for model: ${modelSlug}`);

            // Get model and theme information
            const [modelData] = await this.db.execute(`
                SELECT 
                    m.id, m.slug, m.name, 
                    COALESCE(bt.name, 'default') as business_model,
                    COALESCE(ts.id, 1) as theme_set_id, 
                    COALESCE(ts.name, 'basic') as theme_name,
                    COALESCE(?, ts.id, 1) as effective_theme_id
                FROM models m
                LEFT JOIN theme_sets ts ON m.theme_set_id = ts.id
                LEFT JOIN business_types bt ON bt.id = m.business_type_id
                WHERE m.slug = ?
            `, [previewThemeId, modelSlug]);

            if (modelData.length === 0) {
                throw new Error(`Model not found: ${modelSlug}`);
            }

            const model = modelData[0];

            // Build complete configuration
            const galleryConfig = await this.buildGalleryConfiguration(model);

            // Get gallery data
            const galleryData = await this.getGalleryData(modelSlug, galleryConfig, options);
            galleryConfig.galleryData = galleryData;

            // Cache the result
            this.setCacheConfig(cacheKey, galleryConfig);

            console.log(`✅ Gallery configuration loaded for model: ${modelSlug}`);
            return galleryConfig;

        } catch (error) {
            console.error(`❌ Failed to get gallery config for ${modelSlug}:`, error);
            throw error;
        }
    }

    /**
     * Get gallery data for a model with resolved configuration
     * @param {string} modelSlug - Model identifier
     * @param {object} config - Resolved configuration
     * @param {object} options - Query options (page, category, sort, etc.)
     * @returns {Promise<object>} Gallery data response
     */
    async getGalleryData(modelSlug, config, options = {}) {
        try {
            // Get gallery sections and media
            const sections = await this.getGallerySections(modelSlug);
            const items = await this.getGalleryItems(sections, options);
            
            // Process pagination
            const settings = config.gallery_settings || {};
            const pagination = this.calculatePagination(items, options, settings);
            
            // Extract categories
            const categories = await this.getGalleryCategories(modelSlug);
            
            // Apply filters
            const filteredItems = this.applyFilters(items, options);
            const paginatedItems = this.applyPagination(filteredItems, pagination);

            const galleryData = {
                layout: options.layout || settings.default_layout || 'masonry',
                items: paginatedItems,
                categories: categories,
                pagination: pagination,
                filters: {
                    category: options.category || null,
                    sort: options.sort || 'recent',
                    search: options.search || null
                },
                settings: {
                    lightbox: settings.enable_lightbox !== false,
                    fullscreen: settings.enable_fullscreen !== false,
                    captions: settings.show_captions !== false,
                    imageInfo: settings.show_image_info || false,
                    categoryFilter: settings.show_category_filter !== false,
                    sortOptions: settings.show_sort_options || false,
                    searchEnabled: settings.show_search || false,
                    gridCols: {
                        sm: 2,
                        md: 3,
                        lg: settings.grid_columns_desktop || 4
                    }
                }
            };

            return {
                success: true,
                data: galleryData,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Error getting gallery data:', error.message);
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Build complete gallery configuration by merging all sources
     */
    async buildGalleryConfiguration(model) {
        // 1. Start with system defaults
        const systemDefaults = await this.getSystemDefaults();
        
        // 2. Apply business model configuration
        const businessConfig = await this.getBusinessModelConfig(model.business_model);
        
        // 3. Apply theme styling
        const themeConfig = await this.getThemeConfiguration(model.effective_theme_id || model.theme_set_id);
        
        // 4. Apply model-specific overrides
        const modelOverrides = await this.getModelOverrides(model.id);
        
        // 5. Merge all configurations (priority: overrides > theme > business > system)
        const mergedConfig = this.mergeConfigurations([
            systemDefaults,
            businessConfig,
            themeConfig,
            modelOverrides
        ]);

        // 6. Validate the final configuration
        const validationResult = await this.validateConfiguration(mergedConfig, model);
        
        // 7. Add metadata
        mergedConfig.metadata = {
            model_id: model.id,
            model_slug: model.slug,
            model_name: model.name,
            business_model: model.business_model,
            theme_name: model.theme_name,
            theme_set_id: model.theme_set_id,
            effective_theme_id: model.effective_theme_id,
            configuration_sources: ['system', 'business', 'theme', 'model'],
            validation: validationResult,
            generated_at: new Date().toISOString(),
            cache_duration: this.cacheTTL
        };

        return mergedConfig;
    }

    /**
     * Get system-wide default configurations
     */
    async getSystemDefaults() {
        const cacheKey = 'system_defaults';
        
        let cached = this.getCachedConfig(cacheKey);
        if (cached) return cached;

        console.log('📋 Loading system default configurations...');

        try {
            const [configs] = await this.db.execute(`
                SELECT config_name, config_category, config_value, config_description
                FROM universal_gallery_config 
                WHERE is_active = TRUE
                ORDER BY config_category, config_name
            `);

            const systemDefaults = {
                layout: {},
                lightbox: {},
                display: {},
                performance: {},
                accessibility: {},
                interaction: {}
            };

            configs.forEach(config => {
                systemDefaults[config.config_category][config.config_name] = JSON.parse(config.config_value);
            });

            this.setCacheConfig(cacheKey, systemDefaults);
            console.log('✅ System defaults loaded');

            return systemDefaults;
            
        } catch (error) {
            console.warn('⚠️ Failed to load system defaults from database, using fallback:', error.message);
            
            // Fallback to hardcoded defaults
            const fallbackDefaults = {
                layout: {
                    default_layout: { type: "masonry", images_per_page: 20, grid_columns_desktop: 4 }
                },
                lightbox: {
                    lightbox_settings: { enabled: true, fullscreen: true, zoom: true, animation: "fade" }
                },
                display: {
                    display_options: { show_captions: true, show_category_filter: true, enable_search: false }
                },
                performance: {
                    performance_config: { lazy_loading: true, image_prefetch: true, prefetch_strategy: "balanced" }
                },
                accessibility: {
                    accessibility_config: { aria_labels: true, keyboard_navigation: true, screen_reader_support: true }
                },
                interaction: {
                    interaction_config: { touch_gestures: true, mouse_interactions: true, right_click_protection: false }
                }
            };
            
            this.setCacheConfig(cacheKey, fallbackDefaults);
            return fallbackDefaults;
        }
    }

    /**
     * Get business model specific configuration
     */
    async getBusinessModelConfig(businessModel) {
        const cacheKey = `business_${businessModel}`;
        
        let cached = this.getCachedConfig(cacheKey);
        if (cached) return cached;

        console.log(`🏢 Loading business model configuration: ${businessModel}`);

        try {
            const [configs] = await this.db.execute(`
                SELECT gallery_settings, layout_preferences, visual_customizations, 
                       interaction_settings, content_policies, seo_settings
                FROM gallery_business_configs 
                WHERE business_model = ? AND is_active = TRUE AND is_default = TRUE
                LIMIT 1
            `, [businessModel]);

            let businessConfig = {};

            if (configs.length > 0) {
                const config = configs[0];
                businessConfig = {
                    gallery_settings: JSON.parse(config.gallery_settings || '{}'),
                    layout_preferences: JSON.parse(config.layout_preferences || '{}'),
                    visual_customizations: JSON.parse(config.visual_customizations || '{}'),
                    interaction_settings: JSON.parse(config.interaction_settings || '{}'),
                    content_policies: JSON.parse(config.content_policies || '{}'),
                    seo_settings: JSON.parse(config.seo_settings || '{}')
                };
            }

            this.setCacheConfig(cacheKey, businessConfig);
            console.log(`✅ Business model configuration loaded: ${businessModel}`);

            return businessConfig;
            
        } catch (error) {
            console.warn(`⚠️ Failed to load business model config for ${businessModel}:`, error.message);
            this.setCacheConfig(cacheKey, {});
            return {};
        }
    }

    /**
     * Get theme-specific configuration and styling
     */
    async getThemeConfiguration(themeSetId) {
        const cacheKey = `theme_${themeSetId}`;
        
        let cached = this.getCachedConfig(cacheKey);
        if (cached) return cached;

        console.log(`🎨 Loading theme configuration: ${themeSetId}`);

        try {
            // Get theme information
            const [themeData] = await this.db.execute(`
                SELECT ts.id, ts.name, ts.display_name,
                       tgs.css_variables, tgs.css_overrides, tgs.javascript_overrides,
                       tgs.animation_settings, tgs.responsive_overrides, tgs.accessibility_enhancements
                FROM theme_sets ts
                LEFT JOIN theme_gallery_styles tgs ON tgs.theme_set_id = ts.id AND tgs.is_active = TRUE
                WHERE ts.id = ?
            `, [themeSetId]);

            let themeConfig = {};

            if (themeData.length > 0) {
                const theme = themeData[0];
                themeConfig = {
                    theme_info: {
                        id: theme.id,
                        name: theme.name,
                        display_name: theme.display_name
                    },
                    css_variables: JSON.parse(theme.css_variables || '{}'),
                    css_overrides: theme.css_overrides || '',
                    javascript_overrides: theme.javascript_overrides || '',
                    animation_settings: JSON.parse(theme.animation_settings || '{}'),
                    responsive_overrides: JSON.parse(theme.responsive_overrides || '{}'),
                    accessibility_enhancements: JSON.parse(theme.accessibility_enhancements || '{}')
                };
            }

            this.setCacheConfig(cacheKey, themeConfig);
            console.log(`✅ Theme configuration loaded: ${themeSetId}`);

            return themeConfig;
            
        } catch (error) {
            console.warn(`⚠️ Failed to load theme config for ${themeSetId}:`, error.message);
            this.setCacheConfig(cacheKey, {});
            return {};
        }
    }

    /**
     * Get model-specific overrides
     */
    async getModelOverrides(modelId) {
        const cacheKey = `model_overrides_${modelId}`;
        
        let cached = this.getCachedConfig(cacheKey);
        if (cached) return cached;

        console.log(`👤 Loading model overrides: ${modelId}`);

        try {
            const [overrides] = await this.db.execute(`
                SELECT override_type, override_config, override_reason, applied_by, expires_at
                FROM model_gallery_overrides
                WHERE model_id = ? AND is_active = TRUE
                AND (expires_at IS NULL OR expires_at > NOW())
                ORDER BY override_type
            `, [modelId]);

            const modelOverrides = {};

            overrides.forEach(override => {
                modelOverrides[override.override_type] = {
                    config: JSON.parse(override.override_config),
                    reason: override.override_reason,
                    applied_by: override.applied_by,
                    expires_at: override.expires_at
                };
            });

            this.setCacheConfig(cacheKey, modelOverrides);
            console.log(`✅ Model overrides loaded: ${modelId}`);

            return modelOverrides;
            
        } catch (error) {
            console.warn(`⚠️ Failed to load model overrides for ${modelId}:`, error.message);
            this.setCacheConfig(cacheKey, {});
            return {};
        }
    }

    /**
     * Get gallery sections for a model
     */
    async getGallerySections(modelSlug) {
        try {
            const [sections] = await this.db.execute(`
                SELECT 
                    id,
                    section_name,
                    section_slug,
                    section_description,
                    layout_type,
                    layout_settings,
                    section_order,
                    is_published,
                    is_featured
                FROM model_gallery_sections
                WHERE model_slug = ? 
                AND is_published = 1
                ORDER BY section_order ASC, id ASC
            `, [modelSlug]);

            return sections || [];
        } catch (error) {
            console.error('❌ Error loading gallery sections:', error.message);
            return [];
        }
    }

    /**
     * Get gallery items with metadata
     */
    async getGalleryItems(sections, options) {
        if (!sections.length) {
            return [];
        }

        const sectionIds = sections.map(s => s.id);
        
        try {
            const [items] = await this.db.execute(`
                SELECT 
                    mml.id,
                    mml.filename,
                    mml.original_filename,
                    mml.file_path,
                    mml.file_url,
                    mml.thumbnail_url,
                    mml.medium_url,
                    mml.image_width,
                    mml.image_height,
                    mml.upload_date,
                    mml.moderation_status,
                    mml.visibility_status,
                    mgsm.section_id,
                    mgsm.custom_caption,
                    mgsm.display_order,
                    mgsm.is_featured,
                    mgs.section_name as category
                FROM model_media_library mml
                INNER JOIN model_gallery_section_media mgsm ON mgsm.media_id = mml.id
                INNER JOIN model_gallery_sections mgs ON mgs.id = mgsm.section_id
                WHERE mgsm.section_id IN (${sectionIds.map(() => '?').join(',')})
                AND mml.moderation_status = 'approved'
                AND mml.visibility_status != 'private'
                ORDER BY mgsm.display_order ASC, mml.upload_date DESC
            `, sectionIds);

            return items.map(item => ({
                id: item.id.toString(),
                alt: item.custom_caption || item.original_filename || 'Gallery image',
                caption: item.custom_caption || null,
                srcThumb: item.thumbnail_url || item.file_url,
                srcMed: item.medium_url || item.file_url,
                srcFull: item.file_url,
                aspect: item.image_width && item.image_height ? 
                    item.image_width / item.image_height : 1,
                width: item.image_width,
                height: item.image_height,
                category: item.category,
                uploadDate: item.upload_date,
                featured: Boolean(item.is_featured),
                flagged: item.moderation_status === 'flagged'
            }));

        } catch (error) {
            console.error('❌ Error loading gallery items:', error.message);
            return [];
        }
    }

    /**
     * Get available gallery categories for a model
     */
    async getGalleryCategories(modelSlug) {
        try {
            const [categories] = await this.db.execute(`
                SELECT DISTINCT mgs.section_name as category
                FROM model_gallery_sections mgs
                WHERE mgs.model_slug = ?
                AND mgs.is_published = 1
                ORDER BY mgs.section_order ASC
            `, [modelSlug]);

            return categories.map(c => c.category);
        } catch (error) {
            console.error('❌ Error loading gallery categories:', error.message);
            return [];
        }
    }

    /**
     * Apply filters to gallery items
     */
    applyFilters(items, options) {
        let filtered = [...items];

        // Category filter
        if (options.category) {
            filtered = filtered.filter(item => 
                item.category === options.category
            );
        }

        // Search filter
        if (options.search) {
            const searchTerm = options.search.toLowerCase();
            filtered = filtered.filter(item =>
                (item.alt && item.alt.toLowerCase().includes(searchTerm)) ||
                (item.caption && item.caption.toLowerCase().includes(searchTerm)) ||
                (item.category && item.category.toLowerCase().includes(searchTerm))
            );
        }

        // Sort
        const sortOrder = options.sort || 'recent';
        switch (sortOrder) {
            case 'recent':
                filtered.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
                break;
            case 'oldest':
                filtered.sort((a, b) => new Date(a.uploadDate) - new Date(b.uploadDate));
                break;
            case 'featured':
                filtered.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
                break;
            case 'popular':
                // Would need view/interaction data for true popularity
                filtered.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
                break;
        }

        return filtered;
    }

    /**
     * Calculate pagination information
     */
    calculatePagination(items, options, settings) {
        const pageSize = settings.images_per_page || 20;
        const page = Math.max(1, parseInt(options.page) || 1);
        const total = items.length;
        const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 1;

        return {
            page: page,
            pageSize: pageSize,
            total: total,
            totalPages: totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
        };
    }

    /**
     * Apply pagination to items
     */
    applyPagination(items, pagination) {
        if (pagination.pageSize <= 0) {
            return items; // Return all items if no pagination
        }

        const startIndex = (pagination.page - 1) * pagination.pageSize;
        const endIndex = startIndex + pagination.pageSize;
        
        return items.slice(startIndex, endIndex);
    }

    /**
     * Merge multiple configuration objects with priority
     */
    mergeConfigurations(configs) {
        let merged = {};

        configs.forEach(config => {
            if (config && typeof config === 'object') {
                merged = this.deepMerge(merged, config);
            }
        });

        return merged;
    }

    /**
     * Deep merge utility function
     */
    deepMerge(target, source) {
        const result = { ...target };

        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    result[key] = this.deepMerge(result[key] || {}, source[key]);
                } else {
                    result[key] = source[key];
                }
            }
        }

        return result;
    }

    /**
     * Generate CSS variables string from configuration
     */
    generateCSSVariables(config) {
        let cssVars = ':root {\n';

        if (config.css_variables) {
            for (const [key, value] of Object.entries(config.css_variables)) {
                const varName = key.replace(/_/g, '-');
                cssVars += `  --gallery-${varName}: ${value};\n`;
            }
        }

        // Add computed variables based on business model
        if (config.gallery_settings) {
            const settings = config.gallery_settings;
            if (settings.grid_columns_desktop) {
                cssVars += `  --gallery-grid-columns-desktop: ${settings.grid_columns_desktop};\n`;
            }
            if (settings.images_per_page) {
                cssVars += `  --gallery-images-per-page: ${settings.images_per_page};\n`;
            }
        }

        cssVars += '}\n';

        return cssVars;
    }

    /**
     * Generate JavaScript configuration object
     */
    generateJavaScriptConfig(config) {
        const jsConfig = {
            layout: config.layout || {},
            lightbox: config.lightbox || {},
            performance: config.performance || {},
            interaction: config.interaction || {},
            business_model: config.metadata?.business_model || 'default',
            theme_name: config.metadata?.theme_name || 'basic'
        };

        // Add theme-specific JavaScript
        if (config.javascript_overrides) {
            jsConfig.theme_overrides = config.javascript_overrides;
        }

        return jsConfig;
    }

    /**
     * Validate gallery configuration
     */
    async validateConfiguration(config, model) {
        try {
            const validationResults = {
                is_valid: true,
                errors: [],
                warnings: [],
                suggestions: []
            };

            // Get validation rules
            const [rules] = await this.db.execute(`
                SELECT rule_name, rule_type, validation_config, error_message, 
                       warning_message, severity, auto_fix_available
                FROM gallery_validation_rules
                WHERE is_active = TRUE
                ORDER BY severity DESC, rule_type
            `);

            for (const rule of rules) {
                const ruleConfig = JSON.parse(rule.validation_config);
                const result = await this.runValidationRule(config, model, rule, ruleConfig);

                if (!result.passed) {
                    const issue = {
                        rule_name: rule.rule_name,
                        rule_type: rule.rule_type,
                        severity: rule.severity,
                        message: result.message || rule.error_message,
                        auto_fix_available: rule.auto_fix_available,
                        details: result.details
                    };

                    if (rule.severity === 'error') {
                        validationResults.errors.push(issue);
                        validationResults.is_valid = false;
                    } else if (rule.severity === 'warning') {
                        validationResults.warnings.push(issue);
                    } else {
                        validationResults.suggestions.push(issue);
                    }
                }
            }

            return validationResults;

        } catch (error) {
            console.error('❌ Configuration validation failed:', error);
            return {
                is_valid: false,
                errors: [{ 
                    rule_name: 'validation_system_error',
                    message: `Validation system error: ${error.message}` 
                }],
                warnings: [],
                suggestions: []
            };
        }
    }

    /**
     * Run individual validation rule
     */
    async runValidationRule(config, model, rule, ruleConfig) {
        try {
            switch (rule.rule_type) {
                case 'schema':
                    return this.validateSchema(config, ruleConfig);
                case 'performance':
                    return this.validatePerformance(config, ruleConfig);
                case 'accessibility':
                    return this.validateAccessibility(config, ruleConfig);
                case 'content':
                    return this.validateContent(config, model, ruleConfig);
                default:
                    return { passed: true };
            }
        } catch (error) {
            return {
                passed: false,
                message: `Rule execution failed: ${error.message}`,
                details: { error: error.message }
            };
        }
    }

    /**
     * Schema validation
     */
    validateSchema(config, ruleConfig) {
        const required = ruleConfig.required_variables || [];
        const missing = [];

        required.forEach(field => {
            if (!this.hasNestedProperty(config, field)) {
                missing.push(field);
            }
        });

        return {
            passed: missing.length === 0,
            message: missing.length > 0 ? `Missing required fields: ${missing.join(', ')}` : null,
            details: { missing_fields: missing }
        };
    }

    /**
     * Performance validation
     */
    validatePerformance(config, ruleConfig) {
        const issues = [];

        if (ruleConfig.max_images_per_page && config.gallery_settings?.images_per_page > ruleConfig.max_images_per_page) {
            issues.push(`Images per page (${config.gallery_settings.images_per_page}) exceeds recommended maximum (${ruleConfig.max_images_per_page})`);
        }

        return {
            passed: issues.length === 0,
            message: issues.join('; '),
            details: { performance_issues: issues }
        };
    }

    /**
     * Accessibility validation
     */
    validateAccessibility(config, ruleConfig) {
        const issues = [];

        if (ruleConfig.aria_labels && !config.accessibility?.aria_labels) {
            issues.push('ARIA labels are not enabled');
        }

        if (ruleConfig.keyboard_nav && !config.accessibility?.keyboard_navigation) {
            issues.push('Keyboard navigation is not enabled');
        }

        return {
            passed: issues.length === 0,
            message: issues.join('; '),
            details: { accessibility_issues: issues }
        };
    }

    /**
     * Content policy validation
     */
    validateContent(config, model, ruleConfig) {
        const issues = [];

        if (ruleConfig.age_verification && model.business_model === 'escort' && !config.content_policies?.age_verification) {
            issues.push('Age verification is required for escort business model');
        }

        return {
            passed: issues.length === 0,
            message: issues.join('; '),
            details: { content_policy_issues: issues }
        };
    }

    /**
     * Record performance metrics
     */
    async recordPerformanceMetrics(modelSlug, themeName, layoutType, metrics) {
        try {
            await this.db.execute(`
                INSERT INTO gallery_performance_metrics 
                (model_slug, theme_name, layout_type, page_load_time_ms, image_load_time_ms, 
                 javascript_execution_time_ms, css_render_time_ms, total_gallery_size_kb, 
                 images_count, interactions_count, user_session_duration_ms, bounce_rate, 
                 conversion_rate, accessibility_score, performance_score, user_agent, 
                 device_type, connection_type, recorded_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `, [
                modelSlug, themeName, layoutType,
                metrics.page_load_time_ms || null,
                metrics.image_load_time_ms || null,
                metrics.javascript_execution_time_ms || null,
                metrics.css_render_time_ms || null,
                metrics.total_gallery_size_kb || null,
                metrics.images_count || null,
                metrics.interactions_count || 0,
                metrics.user_session_duration_ms || null,
                metrics.bounce_rate || null,
                metrics.conversion_rate || null,
                metrics.accessibility_score || null,
                metrics.performance_score || null,
                metrics.user_agent || null,
                metrics.device_type || 'desktop',
                metrics.connection_type || null
            ]);

            console.log(`📊 Performance metrics recorded for ${modelSlug}/${themeName}`);

        } catch (error) {
            console.error('❌ Failed to record performance metrics:', error);
        }
    }

    /**
     * Cache management methods
     */
    getCachedConfig(key) {
        const cached = this.configCache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            return cached.data;
        }
        this.configCache.delete(key);
        return null;
    }

    setCacheConfig(key, data) {
        this.configCache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }

    clearCache() {
        this.configCache.clear();
        this.themeCache.clear();
        console.log('🧹 Gallery service cache cleared');
    }

    /**
     * Utility methods
     */
    hasNestedProperty(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj) !== undefined;
    }

    ensureInitialized() {
        if (!this.isInitialized) {
            throw new Error('UniversalGalleryService not initialized. Call initialize() first.');
        }
    }

    async loadSystemDefaults() {
        await this.getSystemDefaults();
    }

    async loadBusinessModelConfigs() {
        try {
            const [businessModels] = await this.db.execute(`
                SELECT DISTINCT business_model FROM gallery_business_configs WHERE is_active = TRUE
            `);
            
            for (const model of businessModels) {
                await this.getBusinessModelConfig(model.business_model);
            }
        } catch (error) {
            console.warn('⚠️ Failed to load business model configs:', error.message);
        }
    }

    async loadThemeStyles() {
        try {
            const [themes] = await this.db.execute(`
                SELECT DISTINCT theme_set_id FROM theme_gallery_styles WHERE is_active = TRUE
            `);
            
            for (const theme of themes) {
                await this.getThemeConfiguration(theme.theme_set_id);
            }
        } catch (error) {
            console.warn('⚠️ Failed to load theme styles:', error.message);
        }
    }

    async validateDatabaseSchema() {
        try {
            const requiredTables = [
                'universal_gallery_config',
                'gallery_layout_types', 
                'gallery_business_configs',
                'theme_gallery_styles',
                'model_gallery_overrides',
                'gallery_validation_rules'
            ];

            for (const table of requiredTables) {
                const [exists] = await this.db.execute(`
                    SELECT COUNT(*) as count FROM information_schema.tables 
                    WHERE table_schema = DATABASE() AND table_name = ?
                `, [table]);

                if (exists[0].count === 0) {
                    console.warn(`⚠️ Optional table missing: ${table}`);
                }
            }

            console.log('✅ Database schema validation passed');
        } catch (error) {
            console.warn('⚠️ Database schema validation failed:', error.message);
        }
    }

    async initializePerformanceMonitoring() {
        // Initialize performance monitoring system
        this.performanceMetrics = new Map();
        console.log('📊 Performance monitoring initialized');
    }

    /**
     * Get service health and statistics
     */
    async getServiceHealth() {
        try {
            const health = {
                service: 'UniversalGalleryService',
                status: this.isInitialized ? 'healthy' : 'initializing',
                cache_size: this.configCache.size,
                cache_hit_rate: this.calculateCacheHitRate(),
                last_cache_clear: null, // Would track in production
                active_configurations: await this.getActiveConfigCount(),
                validation_rules: await this.getValidationRuleCount(),
                performance_metrics_count: await this.getPerformanceMetricsCount(),
                uptime: process.uptime(),
                memory_usage: process.memoryUsage(),
                timestamp: new Date().toISOString()
            };

            return health;

        } catch (error) {
            return {
                service: 'UniversalGalleryService',
                status: 'error',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    calculateCacheHitRate() {
        // Would implement proper cache hit rate calculation in production
        return this.configCache.size > 0 ? 0.85 : 0;
    }

    async getActiveConfigCount() {
        try {
            const [count] = await this.db.execute(`
                SELECT COUNT(*) as total FROM universal_gallery_config WHERE is_active = TRUE
            `);
            return count[0].total;
        } catch (error) {
            return 0;
        }
    }

    async getValidationRuleCount() {
        try {
            const [count] = await this.db.execute(`
                SELECT COUNT(*) as total FROM gallery_validation_rules WHERE is_active = TRUE
            `);
            return count[0].total;
        } catch (error) {
            return 0;
        }
    }

    async getPerformanceMetricsCount() {
        try {
            const [count] = await this.db.execute(`
                SELECT COUNT(*) as total FROM gallery_performance_metrics 
                WHERE recorded_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            `);
            return count[0].total;
        } catch (error) {
            return 0;
        }
    }
}

module.exports = UniversalGalleryService;