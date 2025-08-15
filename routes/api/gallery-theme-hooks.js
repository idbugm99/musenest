/**
 * Gallery Theme Hooks API
 * 
 * Provides API endpoints for managing theme hooks, registering custom behaviors,
 * and debugging theme integration with the universal gallery system.
 */

const express = require('express');
const router = express.Router();
const GalleryThemeHooks = require('../../src/services/GalleryThemeHooks');

// Initialize hooks system (singleton)
let hooksSystem = null;

/**
 * Initialize hooks system
 */
async function initializeHooksSystem() {
    if (!hooksSystem) {
        hooksSystem = new GalleryThemeHooks();
        await hooksSystem.initialize();
    }
    return hooksSystem;
}

/**
 * GET /api/gallery-theme-hooks/status
 * Get theme hooks system status
 */
router.get('/status', async (req, res) => {
    try {
        const hooks = await initializeHooksSystem();
        const status = hooks.getStatus();
        
        res.json({
            success: true,
            data: {
                ...status,
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage()
            }
        });
    } catch (error) {
        console.error('Error getting theme hooks status:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/gallery-theme-hooks/hooks
 * List all available hooks and registered handlers
 */
router.get('/hooks', async (req, res) => {
    try {
        const hooks = await initializeHooksSystem();
        
        res.json({
            success: true,
            data: {
                available: hooks.getAvailableHooks(),
                registered: hooks.getRegisteredHooks(),
                themes: hooks.getThemeOverrides()
            }
        });
    } catch (error) {
        console.error('Error getting hooks list:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/gallery-theme-hooks/execute
 * Execute a specific hook for testing
 */
router.post('/execute', async (req, res) => {
    try {
        const { hookName, data, context } = req.body;
        
        if (!hookName) {
            return res.status(400).json({
                success: false,
                error: 'Hook name is required'
            });
        }
        
        const hooks = await initializeHooksSystem();
        const result = await hooks.executeHook(hookName, data || {}, context || {});
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error executing hook:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/gallery-theme-hooks/transform-data
 * Transform gallery data using theme hooks
 */
router.post('/transform-data', async (req, res) => {
    try {
        const { data, themeId, modelSlug } = req.body;
        
        if (!data) {
            return res.status(400).json({
                success: false,
                error: 'Data is required'
            });
        }
        
        const hooks = await initializeHooksSystem();
        const context = {
            themeId,
            modelSlug,
            timestamp: new Date().toISOString()
        };
        
        const transformedData = await hooks.transformGalleryData(data, context);
        
        res.json({
            success: true,
            data: transformedData,
            context
        });
    } catch (error) {
        console.error('Error transforming gallery data:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/gallery-theme-hooks/theme/:themeId/config
 * Get theme-specific configuration and hooks
 */
router.get('/theme/:themeId/config', async (req, res) => {
    try {
        const { themeId } = req.params;
        const hooks = await initializeHooksSystem();
        
        // Get layout config
        const layoutConfig = await hooks.getLayoutConfig({}, { themeId });
        
        // Get animation config
        const animationConfig = await hooks.getAnimationConfig({}, { themeId });
        
        // Get render context
        const renderContext = hooks.getThemeRenderContext(themeId, {});
        
        // Get theme overrides info
        const themeOverrides = hooks.getThemeOverrides();
        
        res.json({
            success: true,
            data: {
                themeId,
                layoutConfig,
                animationConfig,
                renderContext,
                availableHooks: themeOverrides[themeId] || [],
                hasCustomHelpers: !!(themeOverrides[themeId] && themeOverrides[themeId].includes('helpers'))
            }
        });
    } catch (error) {
        console.error('Error getting theme config:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/gallery-theme-hooks/theme/:themeId/reload
 * Reload theme hooks (for development)
 */
router.post('/theme/:themeId/reload', async (req, res) => {
    try {
        const { themeId } = req.params;
        const hooks = await initializeHooksSystem();
        
        // Clear cache and reload theme hooks
        hooks.clearCache(themeId);
        
        // Register theme helpers
        hooks.registerThemeHelpers(themeId);
        
        res.json({
            success: true,
            message: `Theme hooks reloaded for ${themeId}`,
            data: {
                themeId,
                reloadedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error reloading theme hooks:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/gallery-theme-hooks/css-classes
 * Get resolved CSS classes for all themes
 */
router.get('/css-classes', async (req, res) => {
    try {
        const { themeId } = req.query;
        const hooks = await initializeHooksSystem();
        
        const classTypes = [
            'gallery', 'section', 'item', 'grid', 'lightbox', 'pagination',
            'filters', 'loading', 'error', 'empty', 'header', 'controls',
            'navigation', 'caption', 'overlay', 'image', 'imageContainer',
            'spinner', 'button', 'input', 'select', 'paginationButton'
        ];
        
        const resolvedClasses = {};
        
        if (themeId) {
            // Get classes for specific theme
            const themeConfig = { 
                cssClasses: {} // Would be loaded from theme configuration
            };
            
            classTypes.forEach(classType => {
                resolvedClasses[classType] = hooks.resolveCSSClass(classType, themeConfig);
            });
        } else {
            // Get classes for all themes
            const themes = ['basic', 'luxury', 'modern', 'glamour', 'dark', 'rose'];
            
            themes.forEach(theme => {
                resolvedClasses[theme] = {};
                classTypes.forEach(classType => {
                    resolvedClasses[theme][classType] = hooks.resolveCSSClass(classType, null);
                });
            });
        }
        
        res.json({
            success: true,
            data: {
                classes: resolvedClasses,
                themeId: themeId || 'all',
                classTypes
            }
        });
    } catch (error) {
        console.error('Error getting CSS classes:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/gallery-theme-hooks/icons
 * Get resolved icons for themes
 */
router.get('/icons', async (req, res) => {
    try {
        const { themeId } = req.query;
        const hooks = await initializeHooksSystem();
        
        const iconTypes = [
            'close', 'fullscreen', 'prev', 'next', 'grid', 'masonry',
            'carousel', 'search', 'filter', 'sort', 'category'
        ];
        
        const resolvedIcons = {};
        
        iconTypes.forEach(iconType => {
            const themeConfig = themeId ? { icons: {} } : null; // Would load actual theme config
            resolvedIcons[iconType] = hooks.resolveIcon(iconType, themeConfig);
        });
        
        res.json({
            success: true,
            data: {
                icons: resolvedIcons,
                themeId: themeId || 'universal',
                iconTypes
            }
        });
    } catch (error) {
        console.error('Error getting icons:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/gallery-theme-hooks/test-rendering
 * Test gallery rendering with theme hooks
 */
router.post('/test-rendering', async (req, res) => {
    try {
        const { 
            galleryData, 
            themeId, 
            modelSlug, 
            testHooks = [] 
        } = req.body;
        
        if (!galleryData) {
            return res.status(400).json({
                success: false,
                error: 'Gallery data is required'
            });
        }
        
        const hooks = await initializeHooksSystem();
        const context = {
            themeId,
            modelSlug,
            testMode: true,
            timestamp: new Date().toISOString()
        };
        
        let processedData = { ...galleryData };
        const executionLog = [];
        
        // Execute before render hook
        if (testHooks.includes('beforeRender') || testHooks.length === 0) {
            const startTime = Date.now();
            processedData = await hooks.executeHook('gallery:beforeRender', processedData, context);
            executionLog.push({
                hook: 'gallery:beforeRender',
                executionTime: Date.now() - startTime,
                dataChanged: JSON.stringify(processedData) !== JSON.stringify(galleryData)
            });
        }
        
        // Execute data transform hook
        if (testHooks.includes('dataTransform') || testHooks.length === 0) {
            const startTime = Date.now();
            processedData = await hooks.executeHook('gallery:dataTransform', processedData, context);
            executionLog.push({
                hook: 'gallery:dataTransform',
                executionTime: Date.now() - startTime
            });
        }
        
        // Execute item render hook for first item
        if (processedData.items && processedData.items.length > 0) {
            if (testHooks.includes('itemRender') || testHooks.length === 0) {
                const startTime = Date.now();
                const processedItem = await hooks.executeHook('gallery:itemRender', processedData.items[0], context);
                executionLog.push({
                    hook: 'gallery:itemRender',
                    executionTime: Date.now() - startTime,
                    sampleItem: processedItem
                });
            }
        }
        
        // Execute after render hook
        if (testHooks.includes('afterRender') || testHooks.length === 0) {
            const startTime = Date.now();
            processedData = await hooks.executeHook('gallery:afterRender', processedData, context);
            executionLog.push({
                hook: 'gallery:afterRender',
                executionTime: Date.now() - startTime
            });
        }
        
        res.json({
            success: true,
            data: {
                originalData: galleryData,
                processedData,
                executionLog,
                context,
                totalExecutionTime: executionLog.reduce((sum, log) => sum + log.executionTime, 0)
            }
        });
        
    } catch (error) {
        console.error('Error testing gallery rendering:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DELETE /api/gallery-theme-hooks/cache
 * Clear theme hooks cache
 */
router.delete('/cache', async (req, res) => {
    try {
        const { themeId } = req.query;
        const hooks = await initializeHooksSystem();
        
        hooks.clearCache(themeId || null);
        
        res.json({
            success: true,
            message: themeId ? `Cache cleared for theme: ${themeId}` : 'All cache cleared',
            data: {
                clearedAt: new Date().toISOString(),
                themeId: themeId || 'all'
            }
        });
    } catch (error) {
        console.error('Error clearing cache:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/gallery-theme-hooks/debug/:themeId
 * Get detailed debugging information for a theme
 */
router.get('/debug/:themeId', async (req, res) => {
    try {
        const { themeId } = req.params;
        const hooks = await initializeHooksSystem();
        
        // Sample data for testing
        const sampleData = {
            items: [
                {
                    id: '1',
                    alt: 'Sample image',
                    caption: 'Test caption',
                    srcThumb: '/test-thumb.jpg',
                    srcFull: '/test-full.jpg',
                    category: 'portraits'
                }
            ],
            pagination: { total: 1, page: 1 },
            categories: ['portraits']
        };
        
        const context = { themeId, debug: true };
        
        // Test all hooks
        const results = {};
        const availableHooks = hooks.getAvailableHooks();
        
        for (const hookName of availableHooks) {
            try {
                const startTime = Date.now();
                const result = await hooks.executeHook(hookName, sampleData, context);
                results[hookName] = {
                    executed: true,
                    executionTime: Date.now() - startTime,
                    result: typeof result === 'object' ? 'Object returned' : result,
                    dataKeys: typeof result === 'object' && result ? Object.keys(result) : []
                };
            } catch (error) {
                results[hookName] = {
                    executed: false,
                    error: error.message
                };
            }
        }
        
        res.json({
            success: true,
            data: {
                themeId,
                hookResults: results,
                themeStatus: hooks.getThemeOverrides()[themeId] || [],
                systemStatus: hooks.getStatus(),
                sampleData,
                debuggedAt: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Error debugging theme:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Error handling middleware
router.use((error, req, res, next) => {
    console.error('Gallery Theme Hooks API Error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error in theme hooks system',
        details: error.message
    });
});

module.exports = router;