const express = require('express');
const router = express.Router();
const templateManager = require('../../services/templateManager');
const { requireAuth, requireRole } = require('../../middleware/auth');

// Get all available templates
router.get('/templates', async (req, res) => {
    try {
        const templates = await templateManager.getAvailableTemplates();
        res.json({
            success: true,
            data: templates
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get templates by category
router.get('/templates/category/:category', async (req, res) => {
    try {
        const { category } = req.params;
        const templates = await templateManager.getTemplatesByCategory(category);
        res.json({
            success: true,
            data: templates
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get specific template information
router.get('/templates/:templateId', async (req, res) => {
    try {
        const { templateId } = req.params;
        const template = await templateManager.getTemplateInfo(templateId);
        res.json({
            success: true,
            data: template
        });
    } catch (error) {
        res.status(404).json({
            success: false,
            error: error.message
        });
    }
});

// Get template preview data
router.get('/templates/:templateId/preview', async (req, res) => {
    try {
        const { templateId } = req.params;
        const previewData = await templateManager.getTemplatePreviewData(templateId);
        res.json({
            success: true,
            data: previewData
        });
    } catch (error) {
        res.status(404).json({
            success: false,
            error: error.message
        });
    }
});

// Validate template
router.get('/templates/:templateId/validate', requireAuth, requireRole(['admin', 'model']), async (req, res) => {
    try {
        const { templateId } = req.params;
        const validation = await templateManager.validateTemplate(templateId);
        res.json({
            success: true,
            data: validation
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Render template preview
router.post('/templates/:templateId/render/:page', async (req, res) => {
    try {
        const { templateId, page } = req.params;
        const { data = {} } = req.body;
        
        const renderedHtml = await templateManager.renderTemplate(templateId, page, data);
        res.json({
            success: true,
            data: {
                html: renderedHtml,
                template: templateId,
                page: page
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Switch template (requires authentication)
router.post('/templates/switch', requireAuth, requireRole(['admin', 'model']), async (req, res) => {
    try {
        const { currentTemplate, newTemplate, modelId } = req.body;
        
        if (!currentTemplate || !newTemplate) {
            return res.status(400).json({
                success: false,
                error: 'Both currentTemplate and newTemplate are required'
            });
        }
        
        const switchResult = await templateManager.switchTemplate(currentTemplate, newTemplate);
        
        // In a real application, you would update the model's template preference in the database
        // For now, we'll just return the switch result
        res.json({
            success: true,
            data: {
                ...switchResult,
                modelId: modelId || req.user?.modelId
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get template statistics (admin only)
router.get('/stats', requireAuth, requireRole(['admin']), async (req, res) => {
    try {
        const stats = await templateManager.getTemplateStats();
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Clear template cache (admin only)
router.post('/cache/clear', requireAuth, requireRole(['admin']), async (req, res) => {
    try {
        await templateManager.clearCache();
        res.json({
            success: true,
            message: 'Template cache cleared successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Reload configuration (admin only)
router.post('/config/reload', requireAuth, requireRole(['admin']), async (req, res) => {
    try {
        await templateManager.reloadConfig();
        res.json({
            success: true,
            message: 'Template configuration reloaded successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get default and fallback templates
router.get('/config/defaults', async (req, res) => {
    try {
        const defaults = {
            defaultTemplate: templateManager.getDefaultTemplate(),
            fallbackTemplate: templateManager.getFallbackTemplate()
        };
        res.json({
            success: true,
            data: defaults
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;