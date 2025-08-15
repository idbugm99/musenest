/**
 * Universal Gallery Service
 * 
 * Data-only service that provides gallery information without HTML/JS generation.
 * This service maintains strict separation of concerns - it returns structured data
 * that can be consumed by any rendering system.
 */

const ThemeConfigValidator = require('./ThemeConfigValidator');

class UniversalGalleryService {
    constructor(dbConnection) {
        this.db = dbConnection;
        this.validator = new ThemeConfigValidator();
        this.initialized = false;
        
        // Cache for theme configurations
        this.themeConfigCache = new Map();
        this.systemDefaultsCache = null;
    }

    /**
     * Initialize the service
     */
    async initialize() {
        try {
            // Initialize theme configuration validator
            const validatorResult = await this.validator.initialize();
            if (!validatorResult.success) {
                throw new Error(`Failed to initialize theme validator: ${validatorResult.error}`);
            }

            // Load system defaults
            await this.loadSystemDefaults();
            
            this.initialized = true;
            console.log('✅ UniversalGalleryService initialized');
            return { success: true };
        } catch (error) {
            console.error('❌ UniversalGalleryService initialization failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Load system-wide gallery defaults
     */
    async loadSystemDefaults() {
        try {
            const [rows] = await this.db.execute(`
                SELECT setting_value 
                FROM gallery_system_defaults 
                WHERE setting_name = 'default_gallery_config' 
                AND is_active = 1
            `);

            if (rows.length > 0) {
                this.systemDefaultsCache = JSON.parse(rows[0].setting_value);
            } else {
                // Fallback to hardcoded defaults if not in database
                this.systemDefaultsCache = {
                    enable_lightbox: true,
                    enable_fullscreen: true,
                    show_captions: true,
                    show_image_info: false,
                    show_category_filter: true,
                    show_sort_options: false,
                    show_search: false,
                    default_layout: 'masonry',
                    images_per_page: 20,
                    enable_keyboard_navigation: true,
                    enable_touch_navigation: true
                };
            }

            console.log('📋 System defaults loaded:', this.systemDefaultsCache);
        } catch (error) {
            console.error('❌ Failed to load system defaults:', error.message);
            // Use hardcoded fallback
            this.systemDefaultsCache = {
                enable_lightbox: true,
                enable_fullscreen: true,
                show_captions: true,
                show_image_info: false,
                show_category_filter: true,
                show_sort_options: false,
                show_search: false,
                default_layout: 'masonry',
                images_per_page: 20
            };
        }
    }

    /**
     * Get gallery data for a model with full configuration resolution
     * @param {string} modelSlug - Model identifier
     * @param {string} themeId - Theme identifier
     * @param {object} options - Query options (page, category, sort, etc.)
     * @returns {Promise<object>} Gallery data response
     */
    async getGalleryData(modelSlug, themeId, options = {}) {
        this.ensureInitialized();

        try {
            // Resolve configuration with precedence: System → Theme → Model
            const settings = await this.resolveGalleryConfig(modelSlug, themeId);
            
            // Get gallery sections and media
            const sections = await this.getGallerySections(modelSlug, settings);
            const items = await this.getGalleryItems(sections, options, settings);
            
            // Process pagination
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
                    lightbox: settings.enable_lightbox,
                    fullscreen: settings.enable_fullscreen,
                    captions: settings.show_captions,
                    imageInfo: settings.show_image_info,
                    categoryFilter: settings.show_category_filter,
                    sortOptions: settings.show_sort_options,
                    searchEnabled: settings.show_search,
                    gridCols: {
                        sm: 2,
                        md: 3,
                        lg: settings.grid_columns || 4
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
     * Resolve gallery configuration with precedence model
     * System defaults → Theme overrides → Model overrides
     * @param {string} modelSlug - Model identifier
     * @param {string} themeId - Theme identifier
     * @returns {Promise<object>} Resolved configuration
     */
    async resolveGalleryConfig(modelSlug, themeId) {
        // Start with system defaults
        let config = { ...this.systemDefaultsCache };

        // Apply theme-specific overrides
        const themeConfig = await this.getThemeGalleryConfig(themeId);
        if (themeConfig) {
            config = { ...config, ...themeConfig.galleryDefaults };
        }

        // Apply model-specific overrides (highest priority)
        const modelConfig = await this.getModelGalleryConfig(modelSlug);
        if (modelConfig) {
            config = { ...config, ...modelConfig };
        }

        return config;
    }

    /**
     * Get theme-specific gallery configuration
     * @param {string} themeId - Theme identifier
     * @returns {Promise<object|null>} Theme configuration
     */
    async getThemeGalleryConfig(themeId) {
        // Check cache first
        if (this.themeConfigCache.has(themeId)) {
            return this.themeConfigCache.get(themeId);
        }

        try {
            // Try to load from theme configuration file
            const themeConfigPath = `themes/${themeId}/gallery-config.json`;
            const validationResult = await this.validator.validateFile(themeConfigPath, themeId);
            
            if (validationResult.valid) {
                this.themeConfigCache.set(themeId, validationResult.config);
                return validationResult.config;
            } else {
                console.warn(`⚠️ Invalid theme config for ${themeId}:`, validationResult.errors);
                return null;
            }
        } catch (error) {
            console.warn(`⚠️ No theme config found for ${themeId}:`, error.message);
            return null;
        }
    }

    /**
     * Get model-specific gallery configuration
     * @param {string} modelSlug - Model identifier
     * @returns {Promise<object|null>} Model configuration
     */
    async getModelGalleryConfig(modelSlug) {
        try {
            const [rows] = await this.db.execute(`
                SELECT m.id, mgpc.*
                FROM models m
                LEFT JOIN model_gallery_page_content mgpc ON mgpc.model_id = m.id
                WHERE m.slug = ?
            `, [modelSlug]);

            if (rows.length === 0) {
                return null;
            }

            const row = rows[0];
            return {
                enable_lightbox: row.enable_lightbox,
                enable_fullscreen: row.enable_fullscreen,
                show_captions: row.show_captions,
                show_image_info: row.show_image_info,
                show_category_filter: row.show_category_filter,
                show_sort_options: row.show_sort_options,
                show_search: row.show_search,
                default_layout: row.default_layout,
                images_per_page: row.images_per_page,
                grid_columns: row.default_grid_columns
            };
        } catch (error) {
            console.error('❌ Error loading model gallery config:', error.message);
            return null;
        }
    }

    /**
     * Get gallery sections for a model
     * @param {string} modelSlug - Model identifier
     * @param {object} settings - Resolved settings
     * @returns {Promise<Array>} Gallery sections
     */
    async getGallerySections(modelSlug, settings) {
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
     * @param {Array} sections - Gallery sections
     * @param {object} options - Query options
     * @param {object} settings - Resolved settings
     * @returns {Promise<Array>} Gallery items
     */
    async getGalleryItems(sections, options, settings) {
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
     * @param {string} modelSlug - Model identifier
     * @returns {Promise<Array>} Category list
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
     * @param {Array} items - All gallery items
     * @param {object} options - Filter options
     * @returns {Array} Filtered items
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
     * @param {Array} items - Filtered items
     * @param {object} options - Query options
     * @param {object} settings - Resolved settings
     * @returns {object} Pagination data
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
     * @param {Array} items - Filtered items
     * @param {object} pagination - Pagination data
     * @returns {Array} Paginated items
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
     * Ensure service is initialized
     */
    ensureInitialized() {
        if (!this.initialized) {
            throw new Error('UniversalGalleryService not initialized. Call initialize() first.');
        }
    }

    /**
     * Clear theme configuration cache
     */
    clearCache() {
        this.themeConfigCache.clear();
        this.systemDefaultsCache = null;
        console.log('🧹 Gallery service cache cleared');
    }
}

module.exports = UniversalGalleryService;