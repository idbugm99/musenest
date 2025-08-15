/**
 * Universal Gallery Handlebars Helpers
 * Provides helpers for rendering galleries with the universal system
 */

const UniversalGalleryService = require('../services/UniversalGalleryService');

class GalleryHelpers {
    constructor(db) {
        this.galleryService = new UniversalGalleryService(db);
    }

    /**
     * Initialize the gallery service
     */
    async initialize() {
        return await this.galleryService.initialize();
    }

    /**
     * Register all gallery helpers with Handlebars
     */
    registerHelpers(handlebars) {
        // Main gallery rendering helper - SYNCHRONOUS VERSION
        handlebars.registerHelper('renderUniversalGallery', (modelSlug, options) => {
            try {
                const previewThemeId = options.hash?.previewTheme || null;
                
                console.log(`🎨 Rendering universal gallery for model: ${modelSlug}`);
                
                // Return a placeholder that will be replaced by JavaScript
                const galleryId = `gallery-${modelSlug}-${Date.now()}`;
                const galleryOptions = {
                    page: options.hash?.page || 1,
                    category: options.hash?.category || null,
                    sort: options.hash?.sort || 'recent',
                    layout: options.hash?.layout || null
                };

                // Generate the gallery container with loading state
                const galleryHtml = `
                    <div id="${galleryId}" class="universal-gallery loading" 
                         data-model-slug="${modelSlug}" 
                         data-preview-theme="${previewThemeId || ''}" 
                         data-gallery-options='${JSON.stringify(galleryOptions)}'>
                        
                        <!-- Loading State -->
                        <div class="gallery-loading-state text-center py-12">
                            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
                            <p class="text-gray-600">Loading gallery...</p>
                        </div>
                        
                        <!-- Error State Template -->
                        <div class="gallery-error-state hidden text-center py-12">
                            <div class="text-red-500 text-6xl mb-4">⚠️</div>
                            <h3 class="text-lg font-semibold text-gray-900 mb-2">Gallery Unavailable</h3>
                            <p class="text-gray-600">We're experiencing technical difficulties. Please try again later.</p>
                        </div>
                    </div>
                    
                    <!-- Gallery initialization script -->
                    <script>
                        (function() {
                            const galleryContainer = document.getElementById('${galleryId}');
                            if (galleryContainer && typeof initializeUniversalGallery === 'function') {
                                // Initialize gallery immediately if function is available
                                initializeUniversalGallery('${galleryId}');
                            } else {
                                // Wait for gallery script to load
                                document.addEventListener('DOMContentLoaded', function() {
                                    if (typeof initializeUniversalGallery === 'function') {
                                        initializeUniversalGallery('${galleryId}');
                                    } else {
                                        console.warn('Universal gallery initialization function not found');
                                        // Fallback: show error state
                                        const container = document.getElementById('${galleryId}');
                                        if (container) {
                                            container.querySelector('.gallery-loading-state').classList.add('hidden');
                                            container.querySelector('.gallery-error-state').classList.remove('hidden');
                                        }
                                    }
                                });
                            }
                        })();
                    </script>
                `;

                return new handlebars.SafeString(galleryHtml);

            } catch (error) {
                console.error('❌ Error rendering universal gallery:', error);
                return new handlebars.SafeString(`<div class="gallery-error">Gallery temporarily unavailable: ${error.message}</div>`);
            }
        });

        // Helper to check if model has galleries - SYNCHRONOUS VERSION
        handlebars.registerHelper('hasGalleries', (modelSlug) => {
            // Return true by default, let the gallery component handle the check
            // This prevents async issues in template rendering
            return true;
        });

        // Helper to get gallery configuration - SYNCHRONOUS VERSION
        handlebars.registerHelper('getGalleryConfig', (modelSlug, previewThemeId) => {
            // Return placeholder config, actual config will be loaded by JavaScript
            return {
                layout: 'masonry',
                business_model: 'default',
                theme_name: 'basic'
            };
        });

        // Helper to generate CSS variables for theme
        handlebars.registerHelper('generateGalleryCSSVariables', (galleryConfig) => {
            try {
                return new handlebars.SafeString(this.galleryService.generateCSSVariables(galleryConfig));
            } catch (error) {
                console.error('❌ Error generating CSS variables:', error);
                return '';
            }
        });

        // Helper to generate JavaScript config
        handlebars.registerHelper('generateGalleryJSConfig', (galleryConfig) => {
            try {
                const jsConfig = this.galleryService.generateJavaScriptConfig(galleryConfig);
                return new handlebars.SafeString(JSON.stringify(jsConfig));
            } catch (error) {
                console.error('❌ Error generating JS config:', error);
                return '{}';
            }
        });

        // Helper for conditional rendering based on business model
        handlebars.registerHelper('isBusinessModel', (modelType, businessModel) => {
            return modelType === businessModel;
        });

        // Helper for theme-specific conditionals
        handlebars.registerHelper('isTheme', (currentTheme, targetTheme) => {
            return currentTheme === targetTheme;
        });

        // Helper for layout conditionals
        handlebars.registerHelper('isLayout', (currentLayout, targetLayout) => {
            return currentLayout === targetLayout;
        });

        // Helper to get gallery statistics - SYNCHRONOUS VERSION
        handlebars.registerHelper('getGalleryStats', (modelSlug) => {
            // Return placeholder stats, actual stats will be loaded by JavaScript
            return {
                totalSections: 0,
                totalImages: 0,
                featuredImages: 0
            };
        });

        // Helper for pagination
        handlebars.registerHelper('galleryPagination', (currentPage, totalPages, baseUrl) => {
            const pages = [];
            const showPages = 5; // Number of page links to show
            let startPage = Math.max(1, currentPage - Math.floor(showPages / 2));
            let endPage = Math.min(totalPages, startPage + showPages - 1);
            
            // Adjust start page if we're near the end
            if (endPage - startPage < showPages - 1) {
                startPage = Math.max(1, endPage - showPages + 1);
            }
            
            for (let i = startPage; i <= endPage; i++) {
                pages.push({
                    number: i,
                    url: `${baseUrl}?page=${i}`,
                    current: i === currentPage
                });
            }
            
            return {
                pages: pages,
                hasPrev: currentPage > 1,
                hasNext: currentPage < totalPages,
                prevUrl: currentPage > 1 ? `${baseUrl}?page=${currentPage - 1}` : null,
                nextUrl: currentPage < totalPages ? `${baseUrl}?page=${currentPage + 1}` : null
            };
        });

        // Math helpers for templates
        handlebars.registerHelper('add', (a, b) => parseInt(a) + parseInt(b));
        handlebars.registerHelper('subtract', (a, b) => parseInt(a) - parseInt(b));
        handlebars.registerHelper('multiply', (a, b) => parseInt(a) * parseInt(b));
        handlebars.registerHelper('divide', (a, b) => parseInt(a) / parseInt(b));

        // String helpers
        handlebars.registerHelper('lowercase', (str) => str ? str.toLowerCase() : '');
        handlebars.registerHelper('uppercase', (str) => str ? str.toUpperCase() : '');
        handlebars.registerHelper('capitalize', (str) => {
            if (!str) return '';
            return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
        });

        // Array helpers
        handlebars.registerHelper('first', (array) => Array.isArray(array) && array.length > 0 ? array[0] : null);
        handlebars.registerHelper('last', (array) => Array.isArray(array) && array.length > 0 ? array[array.length - 1] : null);
        handlebars.registerHelper('length', (array) => Array.isArray(array) ? array.length : 0);
        handlebars.registerHelper('slice', (array, start, end) => {
            if (!Array.isArray(array)) return [];
            return array.slice(start, end);
        });

        // Comparison helpers
        handlebars.registerHelper('eq', (a, b) => a === b);
        handlebars.registerHelper('ne', (a, b) => a !== b);
        handlebars.registerHelper('lt', (a, b) => a < b);
        handlebars.registerHelper('le', (a, b) => a <= b);
        handlebars.registerHelper('gt', (a, b) => a > b);
        handlebars.registerHelper('ge', (a, b) => a >= b);
        handlebars.registerHelper('and', (a, b) => a && b);
        handlebars.registerHelper('or', (a, b) => a || b);
        handlebars.registerHelper('not', (a) => !a);

        console.log('✅ Universal Gallery Handlebars helpers registered');
    }

    /**
     * Load the universal gallery template
     */
    async loadGalleryTemplate() {
        const fs = require('fs').promises;
        const path = require('path');
        
        try {
            const templatePath = path.join(__dirname, '../../templates/universal/gallery-base.handlebars');
            return await fs.readFile(templatePath, 'utf8');
        } catch (error) {
            console.error('❌ Error loading gallery template:', error);
            return '<div class="gallery-error">Gallery template not found</div>';
        }
    }

    /**
     * Generate theme-specific CSS based on configuration
     */
    generateThemeCSS(themeConfig, businessConfig) {
        const cssVariables = {
            // Base theme colors
            ...themeConfig.css_variables,
            
            // Business model specific overrides
            ...businessConfig.visual_customizations,
            
            // Layout specific variables
            'grid-columns-desktop': businessConfig.layout_preferences?.grid_columns || 4,
            'images-per-page': businessConfig.gallery_settings?.images_per_page || 20,
        };

        let css = ':root {\n';
        
        Object.entries(cssVariables).forEach(([key, value]) => {
            const varName = key.replace(/_/g, '-');
            css += `  --gallery-${varName}: ${value};\n`;
        });
        
        css += '}\n';

        // Add theme-specific CSS overrides
        if (themeConfig.css_overrides) {
            css += '\n' + themeConfig.css_overrides;
        }

        return css;
    }

    /**
     * Generate JavaScript configuration object
     */
    generateJavaScriptConfig(galleryConfig) {
        return {
            lightbox: {
                enabled: galleryConfig.lightbox?.enabled !== false,
                fullscreen: galleryConfig.lightbox?.fullscreen !== false,
                zoom: galleryConfig.lightbox?.zoom !== false,
                animation: galleryConfig.lightbox?.animation || 'fade'
            },
            carousel: {
                autoplay: galleryConfig.interaction?.carousel_autoplay || false,
                autoplaySpeed: galleryConfig.interaction?.carousel_speed || 3000,
                infinite: galleryConfig.interaction?.infinite_scroll !== false,
                touchEnabled: galleryConfig.interaction?.touch_gestures !== false
            },
            search: {
                enabled: galleryConfig.display?.enable_search || false,
                debounce: 300,
                minLength: 2
            },
            filter: {
                enabled: galleryConfig.display?.show_category_filter || false,
                animation: galleryConfig.performance?.filter_animation !== false
            },
            performance: {
                lazyLoading: galleryConfig.performance?.lazy_loading !== false,
                imagePrefetch: galleryConfig.performance?.image_prefetch || false,
                prefetchStrategy: galleryConfig.performance?.prefetch_strategy || 'balanced'
            },
            accessibility: {
                keyboardNav: galleryConfig.accessibility?.keyboard_navigation !== false,
                ariaLabels: galleryConfig.accessibility?.aria_labels !== false,
                screenReader: galleryConfig.accessibility?.screen_reader_support !== false
            },
            theme: {
                name: galleryConfig.metadata?.theme_name || 'basic',
                businessModel: galleryConfig.metadata?.business_model || 'default'
            }
        };
    }

    /**
     * Get service health status
     */
    async getServiceHealth() {
        return await this.galleryService.getServiceHealth();
    }

    /**
     * Clear service cache
     */
    clearCache() {
        this.galleryService.clearCache();
    }
}

module.exports = GalleryHelpers;