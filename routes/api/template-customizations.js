const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../../middleware/auth');

// Mock database for customizations (in production, use real database)
const customizationsDB = new Map();

// Get template customizations for current user/model
router.get('/:templateId', requireAuth, async (req, res) => {
    try {
        const { templateId } = req.params;
        const modelId = req.user.modelId || req.query.modelId;
        
        if (!modelId) {
            return res.status(400).json({
                success: false,
                error: 'Model ID is required'
            });
        }
        
        const customizationKey = `${modelId}-${templateId}`;
        const customizations = customizationsDB.get(customizationKey) || {};
        
        res.json({
            success: true,
            data: {
                templateId,
                modelId,
                customizations,
                lastModified: customizations.lastModified || null
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Save template customizations
router.post('/', requireAuth, async (req, res) => {
    try {
        const { templateId, customizations } = req.body;
        const modelId = req.user.modelId || req.body.modelId;
        
        if (!templateId || !customizations || !modelId) {
            return res.status(400).json({
                success: false,
                error: 'templateId, customizations, and modelId are required'
            });
        }
        
        // Validate customizations structure
        const validationResult = validateCustomizations(customizations);
        if (!validationResult.valid) {
            return res.status(400).json({
                success: false,
                error: `Invalid customizations: ${validationResult.errors.join(', ')}`
            });
        }
        
        // Compile customizations to CSS
        const compiledCSS = await compileCustomizations(templateId, customizations);
        
        // Save to database (mock implementation)
        const customizationKey = `${modelId}-${templateId}`;
        const customizationData = {
            templateId,
            modelId,
            customizations,
            compiledCSS,
            lastModified: new Date().toISOString(),
            version: 1
        };
        
        customizationsDB.set(customizationKey, customizationData);
        
        // In production, you would save to actual database:
        // await saveCustomizationsToDatabase(modelId, templateId, customizationData);
        
        res.json({
            success: true,
            data: {
                saved: true,
                templateId,
                modelId,
                cssSize: compiledCSS.length,
                lastModified: customizationData.lastModified
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get compiled CSS for template customizations
router.get('/:templateId/css', async (req, res) => {
    try {
        const { templateId } = req.params;
        const modelId = req.query.modelId;
        
        if (!modelId) {
            return res.status(400).json({
                success: false,
                error: 'modelId query parameter is required'
            });
        }
        
        const customizationKey = `${modelId}-${templateId}`;
        const customizationData = customizationsDB.get(customizationKey);
        
        if (!customizationData) {
            // Return empty CSS if no customizations exist
            res.setHeader('Content-Type', 'text/css');
            res.send('/* No customizations found */');
            return;
        }
        
        res.setHeader('Content-Type', 'text/css');
        res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
        res.send(customizationData.compiledCSS);
    } catch (error) {
        res.status(500).setHeader('Content-Type', 'text/css').send('/* Error loading customizations */');
    }
});

// Delete template customizations
router.delete('/:templateId', requireAuth, async (req, res) => {
    try {
        const { templateId } = req.params;
        const modelId = req.user.modelId || req.query.modelId;
        
        if (!modelId) {
            return res.status(400).json({
                success: false,
                error: 'Model ID is required'
            });
        }
        
        const customizationKey = `${modelId}-${templateId}`;
        const existed = customizationsDB.has(customizationKey);
        
        customizationsDB.delete(customizationKey);
        
        res.json({
            success: true,
            data: {
                deleted: existed,
                templateId,
                modelId
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Copy customizations from one template to another
router.post('/copy', requireAuth, async (req, res) => {
    try {
        const { sourceTemplateId, targetTemplateId } = req.body;
        const modelId = req.user.modelId || req.body.modelId;
        
        if (!sourceTemplateId || !targetTemplateId || !modelId) {
            return res.status(400).json({
                success: false,
                error: 'sourceTemplateId, targetTemplateId, and modelId are required'
            });
        }
        
        const sourceKey = `${modelId}-${sourceTemplateId}`;
        const sourceData = customizationsDB.get(sourceKey);
        
        if (!sourceData) {
            return res.status(404).json({
                success: false,
                error: 'Source customizations not found'
            });
        }
        
        // Adapt customizations to target template
        const adaptedCustomizations = await adaptCustomizationsToTemplate(
            sourceData.customizations,
            sourceTemplateId,
            targetTemplateId
        );
        
        // Compile adapted customizations
        const compiledCSS = await compileCustomizations(targetTemplateId, adaptedCustomizations);
        
        // Save adapted customizations
        const targetKey = `${modelId}-${targetTemplateId}`;
        const targetData = {
            templateId: targetTemplateId,
            modelId,
            customizations: adaptedCustomizations,
            compiledCSS,
            lastModified: new Date().toISOString(),
            version: 1,
            copiedFrom: sourceTemplateId
        };
        
        customizationsDB.set(targetKey, targetData);
        
        res.json({
            success: true,
            data: {
                copied: true,
                sourceTemplateId,
                targetTemplateId,
                modelId,
                adaptations: Object.keys(adaptedCustomizations).length
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get customization presets
router.get('/presets/:category', async (req, res) => {
    try {
        const { category } = req.params;
        const presets = getCustomizationPresets(category);
        
        res.json({
            success: true,
            data: {
                category,
                presets
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Apply preset to template
router.post('/apply-preset', requireAuth, async (req, res) => {
    try {
        const { templateId, presetId } = req.body;
        const modelId = req.user.modelId || req.body.modelId;
        
        if (!templateId || !presetId || !modelId) {
            return res.status(400).json({
                success: false,
                error: 'templateId, presetId, and modelId are required'
            });
        }
        
        const preset = getPresetById(presetId);
        if (!preset) {
            return res.status(404).json({
                success: false,
                error: 'Preset not found'
            });
        }
        
        // Apply preset customizations
        const customizations = preset.customizations;
        const compiledCSS = await compileCustomizations(templateId, customizations);
        
        // Save customizations
        const customizationKey = `${modelId}-${templateId}`;
        const customizationData = {
            templateId,
            modelId,
            customizations,
            compiledCSS,
            lastModified: new Date().toISOString(),
            version: 1,
            presetApplied: presetId
        };
        
        customizationsDB.set(customizationKey, customizationData);
        
        res.json({
            success: true,
            data: {
                applied: true,
                templateId,
                modelId,
                presetId,
                presetName: preset.name
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Export customizations
router.get('/:templateId/export', requireAuth, async (req, res) => {
    try {
        const { templateId } = req.params;
        const modelId = req.user.modelId || req.query.modelId;
        
        if (!modelId) {
            return res.status(400).json({
                success: false,
                error: 'Model ID is required'
            });
        }
        
        const customizationKey = `${modelId}-${templateId}`;
        const customizationData = customizationsDB.get(customizationKey);
        
        if (!customizationData) {
            return res.status(404).json({
                success: false,
                error: 'Customizations not found'
            });
        }
        
        const exportData = {
            templateId,
            customizations: customizationData.customizations,
            exportedAt: new Date().toISOString(),
            version: '1.0'
        };
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="template-${templateId}-customizations.json"`);
        res.json(exportData);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Import customizations
router.post('/import', requireAuth, async (req, res) => {
    try {
        const { templateId, customizationData } = req.body;
        const modelId = req.user.modelId || req.body.modelId;
        
        if (!templateId || !customizationData || !modelId) {
            return res.status(400).json({
                success: false,
                error: 'templateId, customizationData, and modelId are required'
            });
        }
        
        // Validate imported data
        const validationResult = validateCustomizations(customizationData.customizations);
        if (!validationResult.valid) {
            return res.status(400).json({
                success: false,
                error: `Invalid imported customizations: ${validationResult.errors.join(', ')}`
            });
        }
        
        // Compile imported customizations
        const compiledCSS = await compileCustomizations(templateId, customizationData.customizations);
        
        // Save imported customizations
        const customizationKey = `${modelId}-${templateId}`;
        const importedData = {
            templateId,
            modelId,
            customizations: customizationData.customizations,
            compiledCSS,
            lastModified: new Date().toISOString(),
            version: 1,
            importedAt: new Date().toISOString(),
            originalExportDate: customizationData.exportedAt
        };
        
        customizationsDB.set(customizationKey, importedData);
        
        res.json({
            success: true,
            data: {
                imported: true,
                templateId,
                modelId,
                customizationsCount: Object.keys(customizationData.customizations).length
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Helper functions
function validateCustomizations(customizations) {
    const errors = [];
    
    // Validate structure
    if (typeof customizations !== 'object') {
        errors.push('Customizations must be an object');
        return { valid: false, errors };
    }
    
    // Validate colors
    if (customizations.colors) {
        const colors = customizations.colors;
        Object.entries(colors).forEach(([key, value]) => {
            if (key.endsWith('Color') && !isValidColor(value)) {
                errors.push(`Invalid color value for ${key}: ${value}`);
            }
        });
    }
    
    // Validate typography
    if (customizations.typography) {
        const typography = customizations.typography;
        if (typography.sizes) {
            Object.entries(typography.sizes).forEach(([key, value]) => {
                if (!isValidSize(value)) {
                    errors.push(`Invalid size value for ${key}: ${value}`);
                }
            });
        }
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

function isValidColor(color) {
    const hexPattern = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    return hexPattern.test(color) || color.startsWith('rgb') || color.startsWith('hsl');
}

function isValidSize(size) {
    const sizePattern = /^\d+(px|em|rem|%|vh|vw)$/;
    return sizePattern.test(size);
}

async function compileCustomizations(templateId, customizations) {
    let css = ':root {\n';
    
    // Compile colors
    if (customizations.colors) {
        Object.entries(customizations.colors).forEach(([key, value]) => {
            if (key.endsWith('Color')) {
                const cssVar = key.replace('Color', '').replace(/([A-Z])/g, '-$1').toLowerCase();
                css += `  --${cssVar}-color: ${value};\n`;
            }
        });
    }
    
    // Compile typography
    if (customizations.typography) {
        const typography = customizations.typography;
        
        if (typography.fontFamily) {
            css += `  --font-family-primary: var(--font-${typography.fontFamily});\n`;
        }
        
        if (typography.lineHeight) {
            css += `  --line-height-base: ${typography.lineHeight};\n`;
        }
        
        if (typography.letterSpacing) {
            css += `  --letter-spacing-base: ${typography.letterSpacing};\n`;
        }
        
        if (typography.sizes) {
            Object.entries(typography.sizes).forEach(([type, size]) => {
                css += `  --font-size-${type}: ${size};\n`;
            });
        }
    }
    
    // Compile layout
    if (customizations.layout) {
        const layout = customizations.layout;
        
        if (layout.containerWidth) {
            const widthMap = {
                full: '100%',
                xl: '1280px',
                lg: '1024px',
                md: '768px'
            };
            css += `  --container-max-width: ${widthMap[layout.containerWidth] || layout.containerWidth};\n`;
        }
        
        if (layout.borderRadius) {
            css += `  --border-radius-base: ${layout.borderRadius};\n`;
        }
        
        if (layout.spacing) {
            Object.entries(layout.spacing).forEach(([type, spacing]) => {
                css += `  --spacing-${type}: ${spacing};\n`;
            });
        }
    }
    
    // Compile animations
    if (customizations.animations) {
        const animations = customizations.animations;
        
        if (animations.speed) {
            const speedMap = {
                fast: '0.2s',
                normal: '0.3s',
                slow: '0.5s',
                disabled: '0s'
            };
            css += `  --animation-duration: ${speedMap[animations.speed] || animations.speed};\n`;
        }
    }
    
    css += '}\n\n';
    
    // Add custom CSS
    if (customizations.advanced?.customCSS) {
        css += customizations.advanced.customCSS + '\n';
    }
    
    // Add template-specific customization styles
    css += generateTemplateSpecificStyles(templateId, customizations);
    
    return css;
}

function generateTemplateSpecificStyles(templateId, customizations) {
    let css = '';
    
    // Template-specific style generation based on customizations
    if (customizations.colors) {
        css += `
.${templateId}-primary { color: var(--primary-color, #6366f1); }
.${templateId}-secondary { color: var(--secondary-color, #06b6d4); }
.${templateId}-accent { color: var(--accent-color, #8b5cf6); }

.${templateId}-bg-primary { background-color: var(--primary-color, #6366f1); }
.${templateId}-bg-secondary { background-color: var(--secondary-color, #06b6d4); }
.${templateId}-bg-accent { background-color: var(--accent-color, #8b5cf6); }
`;
    }
    
    return css;
}

async function adaptCustomizationsToTemplate(customizations, sourceTemplate, targetTemplate) {
    // Create adapted customizations by mapping between template color schemes
    const adapted = { ...customizations };
    
    // In a real implementation, you would have template compatibility mappings
    // For now, return customizations as-is
    return adapted;
}

function getCustomizationPresets(category) {
    const presets = {
        colors: [
            {
                id: 'vibrant',
                name: 'Vibrant',
                description: 'Bold and energetic colors',
                customizations: {
                    colors: {
                        primaryColor: '#ff6b6b',
                        secondaryColor: '#4ecdc4',
                        accentColor: '#ffe66d'
                    }
                }
            },
            {
                id: 'professional',
                name: 'Professional',
                description: 'Clean business colors',
                customizations: {
                    colors: {
                        primaryColor: '#2d3748',
                        secondaryColor: '#4a5568',
                        accentColor: '#3182ce'
                    }
                }
            }
        ],
        typography: [
            {
                id: 'elegant',
                name: 'Elegant',
                description: 'Sophisticated serif fonts',
                customizations: {
                    typography: {
                        fontFamily: 'playfair',
                        lineHeight: '1.6',
                        letterSpacing: '0.05em'
                    }
                }
            }
        ]
    };
    
    return presets[category] || [];
}

function getPresetById(presetId) {
    const allPresets = [
        ...getCustomizationPresets('colors'),
        ...getCustomizationPresets('typography')
    ];
    
    return allPresets.find(preset => preset.id === presetId);
}

module.exports = router;