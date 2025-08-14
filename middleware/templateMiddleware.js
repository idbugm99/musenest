const templateManager = require('../services/templateManager');

/**
 * Middleware to inject template context into requests
 */
const injectTemplateContext = async (req, res, next) => {
    try {
        await templateManager.initialize();
        
        // Get current template from various sources (in priority order)
        let currentTemplate = null;
        
        // 1. Check URL parameter
        if (req.query.template) {
            currentTemplate = req.query.template;
        }
        // 2. Check session/user preference
        else if (req.session?.template) {
            currentTemplate = req.session.template;
        }
        // 3. Check user model settings
        else if (req.user?.template) {
            currentTemplate = req.user.template;
        }
        // 4. Use default
        else {
            currentTemplate = templateManager.getDefaultTemplate();
        }
        
        // Validate template exists
        try {
            await templateManager.getTemplateInfo(currentTemplate);
        } catch (error) {
            console.warn(`Template '${currentTemplate}' not found, falling back to default`);
            currentTemplate = templateManager.getFallbackTemplate();
        }
        
        // Inject into request context
        req.template = {
            current: currentTemplate,
            manager: templateManager
        };
        
        // Make template context available to views
        res.locals.currentTemplate = currentTemplate;
        res.locals.templateManager = templateManager;
        
        next();
    } catch (error) {
        console.error('Template middleware error:', error);
        
        // Fallback to basic template on error
        req.template = {
            current: 'basic',
            manager: templateManager
        };
        res.locals.currentTemplate = 'basic';
        
        next();
    }
};

/**
 * Middleware to handle template switching
 */
const handleTemplateSwitch = (req, res, next) => {
    if (req.query.switchTemplate && req.query.switchTemplate !== req.template?.current) {
        const newTemplate = req.query.switchTemplate;
        
        // Validate new template (basic check)
        templateManager.getTemplateInfo(newTemplate)
            .then(() => {
                // Update session
                if (req.session) {
                    req.session.template = newTemplate;
                }
                
                // Update template context
                req.template.current = newTemplate;
                res.locals.currentTemplate = newTemplate;
                
                console.log(`Template switched to: ${newTemplate}`);
                next();
            })
            .catch(error => {
                console.warn(`Template switch failed: ${error.message}`);
                next(); // Continue with current template
            });
    } else {
        next();
    }
};

/**
 * Middleware to add template helper functions to response locals
 */
const addTemplateHelpers = async (req, res, next) => {
    try {
        const currentTemplate = req.template?.current || 'basic';
        const templateInfo = await templateManager.getTemplateInfo(currentTemplate);
        
        res.locals.templateHelpers = {
            // Get current template info
            getCurrentTemplate: () => templateInfo,
            
            // Get template color scheme
            getColorScheme: () => templateInfo.colorScheme,
            
            // Check if template supports feature
            supportsFeature: (feature) => {
                return templateInfo.features?.includes(feature) || false;
            },
            
            // Get template-specific CSS classes
            getTemplateClasses: (element) => {
                return `${currentTemplate}-${element}`;
            },
            
            // Check if dark mode
            isDarkMode: () => {
                return templateInfo.compatibility?.darkMode || false;
            },
            
            // Get template preview URL
            getPreviewUrl: () => {
                return templateInfo.preview || '/assets/previews/default-preview.jpg';
            }
        };
        
        next();
    } catch (error) {
        console.error('Template helpers middleware error:', error);
        
        // Provide fallback helpers
        res.locals.templateHelpers = {
            getCurrentTemplate: () => ({ id: 'basic', name: 'Basic' }),
            getColorScheme: () => ({ primary: '#333333', secondary: '#666666' }),
            supportsFeature: () => false,
            getTemplateClasses: (element) => `basic-${element}`,
            isDarkMode: () => false,
            getPreviewUrl: () => '/assets/previews/default-preview.jpg'
        };
        
        next();
    }
};

/**
 * Middleware to handle template-specific routing
 */
const templateRouter = (req, res, next) => {
    const currentTemplate = req.template?.current || 'basic';
    
    // Add template path to view resolution
    const originalRender = res.render;
    res.render = function(view, options = {}, callback) {
        // Try template-specific view first
        const templateView = `../themes/${currentTemplate}/pages/${view}`;
        
        // Merge template info into view options
        const mergedOptions = {
            ...options,
            template: {
                id: currentTemplate,
                info: res.locals.templateHelpers?.getCurrentTemplate(),
                colorScheme: res.locals.templateHelpers?.getColorScheme()
            }
        };
        
        // Try to render template-specific view first
        originalRender.call(this, templateView, mergedOptions, (err, html) => {
            if (err) {
                // Fallback to default view
                console.warn(`Template-specific view not found: ${templateView}, falling back to default`);
                originalRender.call(res, view, mergedOptions, callback);
            } else {
                if (callback) callback(null, html);
                else res.send(html);
            }
        });
    };
    
    next();
};

/**
 * Error handler for template-related errors
 */
const templateErrorHandler = (error, req, res, next) => {
    if (error.message.includes('Template') || error.message.includes('template')) {
        console.error('Template error:', error);
        
        // Try to render with fallback template
        try {
            const fallbackTemplate = templateManager.getFallbackTemplate();
            req.template.current = fallbackTemplate;
            res.locals.currentTemplate = fallbackTemplate;
            
            console.log(`Falling back to template: ${fallbackTemplate}`);
            next(); // Continue with fallback
        } catch (fallbackError) {
            console.error('Fallback template also failed:', fallbackError);
            res.status(500).json({
                error: 'Template system unavailable',
                message: 'Please try again later'
            });
        }
    } else {
        next(error); // Pass non-template errors to next handler
    }
};

module.exports = {
    injectTemplateContext,
    handleTemplateSwitch,
    addTemplateHelpers,
    templateRouter,
    templateErrorHandler
};