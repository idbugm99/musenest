/**
 * Gallery Theme Hooks System
 * 
 * Provides a hook-based architecture for themes to customize gallery rendering
 * while maintaining universal functionality. Allows themes to override specific
 * rendering behaviors without breaking core features.
 * 
 * Features:
 * - Hook registration and management
 * - Theme-specific override system
 * - Fallback to universal defaults
 * - Handlebars helper integration
 * - CSS class mapping
 * - Event system integration
 * - Performance monitoring
 */

const fs = require('fs').promises;
const path = require('path');
const Handlebars = require('handlebars');

class GalleryThemeHooks {
    constructor() {
        this.hooks = new Map();
        this.themeOverrides = new Map();
        this.registeredHelpers = new Set();
        this.cache = new Map();
        this.initialized = false;
        
        // Available hook points
        this.availableHooks = [
            'gallery:beforeRender',
            'gallery:afterRender',
            'gallery:itemRender',
            'gallery:paginationRender',
            'gallery:filterRender',
            'gallery:lightboxRender',
            'gallery:cssClassMapping',
            'gallery:dataTransform',
            'gallery:layoutConfig',
            'gallery:animationConfig'
        ];
    }

    /**
     * Initialize the hooks system
     */
    async initialize() {
        try {
            await this.registerUniversalHelpers();
            await this.loadThemeHooks();
            
            this.initialized = true;
            console.log('✅ GalleryThemeHooks initialized');
            
            return { success: true };
        } catch (error) {
            console.error('❌ Failed to initialize GalleryThemeHooks:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Register universal Handlebars helpers
     */
    async registerUniversalHelpers() {
        // JSON helper for safe JSON stringification
        if (!this.registeredHelpers.has('json')) {
            Handlebars.registerHelper('json', function(context) {
                try {
                    return JSON.stringify(context);
                } catch (error) {
                    console.warn('Failed to stringify JSON in template:', error);
                    return '{}';
                }
            });
            this.registeredHelpers.add('json');
        }

        // CSS class resolver helper
        if (!this.registeredHelpers.has('galleryClass')) {
            Handlebars.registerHelper('galleryClass', (classType, themeConfig) => {
                return this.resolveCSSClass(classType, themeConfig);
            });
            this.registeredHelpers.add('galleryClass');
        }

        // Icon resolver helper
        if (!this.registeredHelpers.has('galleryIcon')) {
            Handlebars.registerHelper('galleryIcon', (iconType, themeConfig) => {
                return this.resolveIcon(iconType, themeConfig);
            });
            this.registeredHelpers.add('galleryIcon');
        }

        // Gallery data hook helper
        if (!this.registeredHelpers.has('galleryHook')) {
            Handlebars.registerHelper('galleryHook', (hookName, data, options) => {
                return this.executeHook(hookName, data, options);
            });
            this.registeredHelpers.add('galleryHook');
        }

        // Array helper for template loops
        if (!this.registeredHelpers.has('array')) {
            Handlebars.registerHelper('array', function(...items) {
                return items.slice(0, -1); // Remove Handlebars options object
            });
            this.registeredHelpers.add('array');
        }

        // Comparison helpers
        const comparisonHelpers = ['eq', 'ne', 'lt', 'gt', 'lte', 'gte'];
        comparisonHelpers.forEach(helper => {
            if (!this.registeredHelpers.has(helper)) {
                Handlebars.registerHelper(helper, function(a, b, options) {
                    let result;
                    switch (helper) {
                        case 'eq': result = a == b; break;
                        case 'ne': result = a != b; break;
                        case 'lt': result = a < b; break;
                        case 'gt': result = a > b; break;
                        case 'lte': result = a <= b; break;
                        case 'gte': result = a >= b; break;
                    }
                    return result ? options.fn(this) : options.inverse(this);
                });
                this.registeredHelpers.add(helper);
            }
        });

        // Math helpers
        const mathHelpers = ['add', 'subtract', 'multiply', 'min', 'max'];
        mathHelpers.forEach(helper => {
            if (!this.registeredHelpers.has(helper)) {
                Handlebars.registerHelper(helper, function(a, b) {
                    const numA = parseFloat(a) || 0;
                    const numB = parseFloat(b) || 0;
                    switch (helper) {
                        case 'add': return numA + numB;
                        case 'subtract': return numA - numB;
                        case 'multiply': return numA * numB;
                        case 'min': return Math.min(numA, numB);
                        case 'max': return Math.max(numA, numB);
                    }
                });
                this.registeredHelpers.add(helper);
            }
        });

        // Date formatting helper
        if (!this.registeredHelpers.has('formatDate')) {
            Handlebars.registerHelper('formatDate', function(date, format) {
                if (!date) return '';
                
                const d = new Date(date);
                if (isNaN(d.getTime())) return '';
                
                // Simple format mapping
                const formats = {
                    'MMM dd, yyyy': d.toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: '2-digit' 
                    }),
                    'yyyy-MM-dd': d.toISOString().split('T')[0],
                    'relative': this.getRelativeTimeString(d)
                };
                
                return formats[format] || d.toLocaleDateString();
            });
            this.registeredHelpers.add('formatDate');
        }

        // Object property picker helper
        if (!this.registeredHelpers.has('pick')) {
            Handlebars.registerHelper('pick', function(obj, ...keys) {
                const result = {};
                const keyList = keys.slice(0, -1); // Remove Handlebars options
                
                keyList.forEach(key => {
                    if (obj && obj.hasOwnProperty(key)) {
                        result[key] = obj[key];
                    }
                });
                
                return result;
            });
            this.registeredHelpers.add('pick');
        }
    }

    /**
     * Load theme-specific hooks from filesystem
     */
    async loadThemeHooks() {
        try {
            const themesDir = path.join(process.cwd(), 'themes');
            const themes = await fs.readdir(themesDir, { withFileTypes: true });
            
            for (const theme of themes) {
                if (theme.isDirectory()) {
                    await this.loadThemeHook(theme.name);
                }
            }
        } catch (error) {
            console.warn('Failed to load theme hooks:', error.message);
        }
    }

    /**
     * Load hooks for a specific theme
     */
    async loadThemeHook(themeName) {
        try {
            const hooksFile = path.join(process.cwd(), 'themes', themeName, 'gallery-hooks.js');
            
            try {
                await fs.access(hooksFile);
                
                // Clear require cache to allow hot reloading
                const resolvedPath = require.resolve(hooksFile);
                delete require.cache[resolvedPath];
                
                // Load hooks
                const themeHooks = require(hooksFile);
                
                if (typeof themeHooks === 'object' && themeHooks !== null) {
                    this.themeOverrides.set(themeName, themeHooks);
                    console.log(`📁 Loaded gallery hooks for theme: ${themeName}`);
                }
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    console.warn(`Failed to load hooks for theme ${themeName}:`, error.message);
                }
            }
        } catch (error) {
            console.warn(`Error loading theme hook for ${themeName}:`, error.message);
        }
    }

    /**
     * Register a hook function
     */
    registerHook(hookName, hookFunction, priority = 10) {
        if (!this.availableHooks.includes(hookName)) {
            throw new Error(`Unknown hook: ${hookName}. Available hooks: ${this.availableHooks.join(', ')}`);
        }

        if (typeof hookFunction !== 'function') {
            throw new Error('Hook function must be a function');
        }

        if (!this.hooks.has(hookName)) {
            this.hooks.set(hookName, []);
        }

        this.hooks.get(hookName).push({
            function: hookFunction,
            priority,
            id: Math.random().toString(36).substr(2, 9)
        });

        // Sort by priority (lower numbers = higher priority)
        this.hooks.get(hookName).sort((a, b) => a.priority - b.priority);

        return true;
    }

    /**
     * Unregister a hook function
     */
    unregisterHook(hookName, hookId) {
        if (!this.hooks.has(hookName)) return false;

        const hooks = this.hooks.get(hookName);
        const index = hooks.findIndex(hook => hook.id === hookId);
        
        if (index !== -1) {
            hooks.splice(index, 1);
            return true;
        }

        return false;
    }

    /**
     * Execute all registered hooks for a given hook point
     */
    async executeHook(hookName, data, context = {}) {
        let result = data;

        // Execute universal hooks
        if (this.hooks.has(hookName)) {
            const hooks = this.hooks.get(hookName);
            
            for (const hook of hooks) {
                try {
                    const hookResult = await hook.function(result, context);
                    if (hookResult !== undefined) {
                        result = hookResult;
                    }
                } catch (error) {
                    console.error(`Hook execution failed for ${hookName}:`, error);
                }
            }
        }

        // Execute theme-specific overrides
        const themeId = context.themeId || context.theme;
        if (themeId && this.themeOverrides.has(themeId)) {
            const themeHooks = this.themeOverrides.get(themeId);
            
            if (themeHooks[hookName] && typeof themeHooks[hookName] === 'function') {
                try {
                    const themeResult = await themeHooks[hookName](result, context);
                    if (themeResult !== undefined) {
                        result = themeResult;
                    }
                } catch (error) {
                    console.error(`Theme hook execution failed for ${themeId}:${hookName}:`, error);
                }
            }
        }

        return result;
    }

    /**
     * Resolve CSS class with theme overrides
     */
    resolveCSSClass(classType, themeConfig) {
        // Check theme configuration first
        if (themeConfig && themeConfig.cssClasses && themeConfig.cssClasses[classType]) {
            return themeConfig.cssClasses[classType];
        }

        // Fallback to universal defaults
        const universalClasses = {
            gallery: 'universal-gallery',
            section: 'gallery-section',
            item: 'gallery-item',
            grid: 'gallery-grid',
            lightbox: 'gallery-lightbox',
            pagination: 'gallery-pagination',
            filters: 'gallery-filters',
            loading: 'gallery-loading',
            error: 'gallery-error',
            empty: 'gallery-empty',
            header: 'gallery-header',
            controls: 'gallery-controls',
            navigation: 'gallery-nav',
            caption: 'gallery-caption',
            overlay: 'gallery-overlay',
            image: 'gallery-image',
            imageContainer: 'gallery-image-container',
            spinner: 'gallery-spinner',
            button: 'gallery-btn',
            input: 'gallery-input',
            select: 'gallery-select',
            paginationButton: 'gallery-pagination-btn'
        };

        return universalClasses[classType] || `gallery-${classType}`;
    }

    /**
     * Resolve icon with theme overrides
     */
    resolveIcon(iconType, themeConfig) {
        // Check theme configuration first
        if (themeConfig && themeConfig.icons && themeConfig.icons[iconType]) {
            return themeConfig.icons[iconType];
        }

        // Fallback to universal defaults
        const universalIcons = {
            close: '✕',
            fullscreen: '⤢',
            prev: '‹',
            next: '›',
            grid: '⊞',
            masonry: '⊡',
            carousel: '⊲',
            search: '🔍',
            filter: '🔻',
            sort: '↕',
            category: '📁'
        };

        return universalIcons[iconType] || '';
    }

    /**
     * Transform gallery data through hooks
     */
    async transformGalleryData(data, context) {
        return await this.executeHook('gallery:dataTransform', data, context);
    }

    /**
     * Get layout configuration through hooks
     */
    async getLayoutConfig(baseConfig, context) {
        return await this.executeHook('gallery:layoutConfig', baseConfig, context);
    }

    /**
     * Get animation configuration through hooks
     */
    async getAnimationConfig(baseConfig, context) {
        return await this.executeHook('gallery:animationConfig', baseConfig, context);
    }

    /**
     * Render gallery item with hooks
     */
    async renderGalleryItem(item, context) {
        // Pre-render hook
        const processedItem = await this.executeHook('gallery:itemRender', item, context);
        
        // The actual rendering would be handled by Handlebars partials
        // This hook allows themes to modify the item data before rendering
        return processedItem;
    }

    /**
     * Process CSS class mapping through hooks
     */
    async processCSSMapping(classMap, context) {
        return await this.executeHook('gallery:cssClassMapping', classMap, context);
    }

    /**
     * Get theme-specific rendering context
     */
    getThemeRenderContext(themeId, baseContext) {
        const themeOverrides = this.themeOverrides.get(themeId);
        
        if (!themeOverrides || !themeOverrides.renderContext) {
            return baseContext;
        }

        try {
            if (typeof themeOverrides.renderContext === 'function') {
                return themeOverrides.renderContext(baseContext);
            } else if (typeof themeOverrides.renderContext === 'object') {
                return { ...baseContext, ...themeOverrides.renderContext };
            }
        } catch (error) {
            console.error(`Error processing theme render context for ${themeId}:`, error);
        }

        return baseContext;
    }

    /**
     * Get relative time string helper
     */
    getRelativeTimeString(date) {
        const now = new Date();
        const diff = now - date;
        
        const minute = 60 * 1000;
        const hour = 60 * minute;
        const day = 24 * hour;
        const week = 7 * day;
        const month = 30 * day;
        const year = 365 * day;

        if (diff < minute) return 'just now';
        if (diff < hour) return `${Math.floor(diff / minute)} minutes ago`;
        if (diff < day) return `${Math.floor(diff / hour)} hours ago`;
        if (diff < week) return `${Math.floor(diff / day)} days ago`;
        if (diff < month) return `${Math.floor(diff / week)} weeks ago`;
        if (diff < year) return `${Math.floor(diff / month)} months ago`;
        
        return `${Math.floor(diff / year)} years ago`;
    }

    /**
     * Register theme-specific Handlebars helpers
     */
    registerThemeHelpers(themeId) {
        const themeOverrides = this.themeOverrides.get(themeId);
        
        if (!themeOverrides || !themeOverrides.helpers) {
            return;
        }

        try {
            Object.entries(themeOverrides.helpers).forEach(([name, helper]) => {
                const helperName = `${themeId}_${name}`;
                
                if (!this.registeredHelpers.has(helperName)) {
                    if (typeof helper === 'function') {
                        Handlebars.registerHelper(helperName, helper);
                        this.registeredHelpers.add(helperName);
                        console.log(`📝 Registered theme helper: ${helperName}`);
                    }
                }
            });
        } catch (error) {
            console.error(`Failed to register helpers for theme ${themeId}:`, error);
        }
    }

    /**
     * Get available hooks list
     */
    getAvailableHooks() {
        return [...this.availableHooks];
    }

    /**
     * Get registered hooks for debugging
     */
    getRegisteredHooks() {
        const result = {};
        
        this.hooks.forEach((hooks, hookName) => {
            result[hookName] = hooks.map(hook => ({
                id: hook.id,
                priority: hook.priority
            }));
        });
        
        return result;
    }

    /**
     * Get theme overrides for debugging
     */
    getThemeOverrides() {
        const result = {};
        
        this.themeOverrides.forEach((overrides, themeName) => {
            result[themeName] = Object.keys(overrides).filter(key => 
                this.availableHooks.includes(key) || key === 'helpers' || key === 'renderContext'
            );
        });
        
        return result;
    }

    /**
     * Clear cache for theme hot reloading
     */
    clearCache(themeId = null) {
        if (themeId) {
            // Clear cache for specific theme
            for (const [key] of this.cache) {
                if (key.startsWith(`${themeId}:`)) {
                    this.cache.delete(key);
                }
            }
            
            // Reload theme hooks
            this.loadThemeHook(themeId);
        } else {
            // Clear all cache
            this.cache.clear();
            
            // Reload all theme hooks
            this.loadThemeHooks();
        }
    }

    /**
     * Get system status
     */
    getStatus() {
        return {
            initialized: this.initialized,
            totalHooks: this.hooks.size,
            totalThemes: this.themeOverrides.size,
            registeredHelpers: this.registeredHelpers.size,
            cacheSize: this.cache.size,
            availableHooks: this.availableHooks.length,
            themes: Array.from(this.themeOverrides.keys())
        };
    }

    /**
     * Cleanup and destroy
     */
    destroy() {
        // Clear all hooks
        this.hooks.clear();
        this.themeOverrides.clear();
        this.cache.clear();
        
        // Unregister custom helpers (keep built-in ones)
        // Note: Handlebars doesn't provide a way to unregister helpers
        // This would need to be handled by the application restart
        
        this.initialized = false;
        
        console.log('🧹 GalleryThemeHooks destroyed');
    }
}

module.exports = GalleryThemeHooks;