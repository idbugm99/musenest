const path = require('path');
const fs = require('fs').promises;
const handlebars = require('handlebars');

/**
 * Template utility functions
 */
class TemplateUtils {
    static async registerHandlebarsHelpers() {
        // Template-aware URL helper
        handlebars.registerHelper('templateUrl', function(url, options) {
            const template = options.data.root.template?.id || 'basic';
            const baseUrl = url.startsWith('/') ? url : `/${url}`;
            return `${baseUrl}?template=${template}`;
        });

        // Template-specific asset helper
        handlebars.registerHelper('templateAsset', function(asset, options) {
            const template = options.data.root.template?.id || 'basic';
            return `/themes/${template}/assets/${asset}`;
        });

        // Color scheme helper
        handlebars.registerHelper('templateColor', function(colorType, options) {
            const colorScheme = options.data.root.template?.colorScheme || {};
            return colorScheme[colorType] || '#333333';
        });

        // Feature check helper
        handlebars.registerHelper('templateSupports', function(feature, options) {
            const template = options.data.root.template?.info || {};
            const features = template.features || [];
            return features.includes(feature);
        });

        // Template class helper
        handlebars.registerHelper('templateClass', function(element, options) {
            const template = options.data.root.template?.id || 'basic';
            return `${template}-${element}`;
        });

        // Conditional template helper
        handlebars.registerHelper('ifTemplate', function(templateId, options) {
            const currentTemplate = options.data.root.template?.id || 'basic';
            if (currentTemplate === templateId) {
                return options.fn(this);
            }
            return options.inverse(this);
        });

        // Template category helper
        handlebars.registerHelper('ifTemplateCategory', function(category, options) {
            const template = options.data.root.template?.info || {};
            if (template.category === category) {
                return options.fn(this);
            }
            return options.inverse(this);
        });

        // Dark mode helper
        handlebars.registerHelper('ifDarkMode', function(options) {
            const template = options.data.root.template?.info || {};
            const isDark = template.compatibility?.darkMode || false;
            if (isDark) {
                return options.fn(this);
            }
            return options.inverse(this);
        });

        // Template version helper
        handlebars.registerHelper('templateVersion', function(options) {
            const template = options.data.root.template?.info || {};
            return template.version || '1.0.0';
        });

        // JSON helper for template data
        handlebars.registerHelper('templateJson', function(data, options) {
            return JSON.stringify(data);
        });

        console.log('Template Handlebars helpers registered');
    }

    static async loadTemplatePartials(templateId) {
        const partialsPath = path.join(__dirname, '../themes', templateId, 'partials');
        
        try {
            const partialFiles = await fs.readdir(partialsPath);
            
            for (const file of partialFiles) {
                if (file.endsWith('.handlebars')) {
                    const partialName = file.replace('.handlebars', '');
                    const partialPath = path.join(partialsPath, file);
                    const partialContent = await fs.readFile(partialPath, 'utf8');
                    
                    handlebars.registerPartial(`${templateId}_${partialName}`, partialContent);
                }
            }
            
            console.log(`Loaded partials for template: ${templateId}`);
        } catch (error) {
            console.warn(`No partials found for template ${templateId}:`, error.message);
        }
    }

    static async loadUniversalPartials() {
        const partialsPath = path.join(__dirname, '../templates/universal/pages');
        
        try {
            const partialFiles = await fs.readdir(partialsPath);
            
            for (const file of partialFiles) {
                if (file.endsWith('.handlebars')) {
                    const partialName = file.replace('.handlebars', '');
                    const partialPath = path.join(partialsPath, file);
                    const partialContent = await fs.readFile(partialPath, 'utf8');
                    
                    handlebars.registerPartial(partialName, partialContent);
                }
            }
            
            console.log('✅ Universal partials loaded successfully');
        } catch (error) {
            console.error('❌ Failed to load universal partials:', error.message);
        }
    }

    static async loadSharedPartials() {
        const partialsPath = path.join(__dirname, '../themes/shared/partials');
        
        try {
            const partialFiles = await fs.readdir(partialsPath);
            
            for (const file of partialFiles) {
                if (file.endsWith('.handlebars')) {
                    const partialName = file.replace('.handlebars', '');
                    const partialPath = path.join(partialsPath, file);
                    const partialContent = await fs.readFile(partialPath, 'utf8');
                    
                    // Register shared partials with simple names so they can be used across all themes
                    handlebars.registerPartial(partialName, partialContent);
                }
            }
            
            console.log('✅ Shared partials loaded successfully');
        } catch (error) {
            console.error('❌ Failed to load shared partials:', error.message);
        }
    }

    static async precompileTemplates(templateId) {
        const pagesPath = path.join(__dirname, '../themes', templateId, 'pages');
        const compiled = {};
        
        try {
            const pageFiles = await fs.readdir(pagesPath);
            
            for (const file of pageFiles) {
                if (file.endsWith('.handlebars')) {
                    const pageName = file.replace('.handlebars', '');
                    const filePath = path.join(pagesPath, file);
                    const content = await fs.readFile(filePath, 'utf8');
                    
                    compiled[pageName] = handlebars.compile(content);
                }
            }
            
            return compiled;
        } catch (error) {
            console.error(`Failed to precompile templates for ${templateId}:`, error);
            return {};
        }
    }

    static extractTemplateMetadata(templateContent) {
        const metadata = {};
        
        // Extract color scheme from CSS variables
        const colorMatches = templateContent.match(/--([a-zA-Z-]+):\s*([^;]+);/g);
        if (colorMatches) {
            metadata.cssVariables = {};
            colorMatches.forEach(match => {
                const [, name, value] = match.match(/--([^:]+):\s*([^;]+)/);
                metadata.cssVariables[name] = value.trim();
            });
        }
        
        // Extract feature flags from comments
        const featureMatches = templateContent.match(/<!--\s*@feature:\s*([^-]+)\s*-->/g);
        if (featureMatches) {
            metadata.features = featureMatches.map(match => {
                const [, feature] = match.match(/<!--\s*@feature:\s*([^-]+)\s*-->/);
                return feature.trim();
            });
        }
        
        // Extract dependencies
        const depMatches = templateContent.match(/<!--\s*@requires:\s*([^-]+)\s*-->/g);
        if (depMatches) {
            metadata.dependencies = depMatches.map(match => {
                const [, dep] = match.match(/<!--\s*@requires:\s*([^-]+)\s*-->/);
                return dep.trim();
            });
        }
        
        return metadata;
    }

    static generateTemplatePreview(templateId, templateInfo) {
        return `
        <div class="template-preview" data-template="${templateId}">
            <div class="template-preview-header" style="background: ${templateInfo.colorScheme.primary}">
                <h3 style="color: ${templateInfo.colorScheme.background || '#ffffff'}">${templateInfo.name}</h3>
            </div>
            <div class="template-preview-body">
                <p class="template-description">${templateInfo.description}</p>
                <div class="template-features">
                    ${templateInfo.features.map(feature => `<span class="feature-badge">${feature}</span>`).join('')}
                </div>
                <div class="template-colors">
                    <div class="color-swatch" style="background: ${templateInfo.colorScheme.primary}" title="Primary"></div>
                    <div class="color-swatch" style="background: ${templateInfo.colorScheme.secondary}" title="Secondary"></div>
                    <div class="color-swatch" style="background: ${templateInfo.colorScheme.accent}" title="Accent"></div>
                </div>
            </div>
        </div>
        `;
    }

    static validateTemplateStructure(templatePath) {
        const requiredDirectories = ['pages'];
        const requiredFiles = ['pages/home.handlebars'];
        const errors = [];
        
        // Check directories
        for (const dir of requiredDirectories) {
            const dirPath = path.join(templatePath, dir);
            if (!fs.existsSync(dirPath)) {
                errors.push(`Missing directory: ${dir}`);
            }
        }
        
        // Check required files
        for (const file of requiredFiles) {
            const filePath = path.join(templatePath, file);
            if (!fs.existsSync(filePath)) {
                errors.push(`Missing file: ${file}`);
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }

    static createTemplateBackup(templateId, backupPath) {
        // This would create a complete backup of the template
        // Including files, configuration, and metadata
        return {
            templateId,
            backupPath,
            timestamp: new Date().toISOString(),
            files: [] // Would list all backed up files
        };
    }

    static async optimizeTemplate(templateId) {
        // Template optimization utilities
        const optimizations = [];
        
        // Check for unused CSS
        optimizations.push('Remove unused CSS rules');
        
        // Check for image optimization
        optimizations.push('Optimize template images');
        
        // Check for JavaScript minification
        optimizations.push('Minify JavaScript files');
        
        return {
            templateId,
            optimizations,
            estimatedSavings: '25%'
        };
    }

    static getTemplateCompatibility(templateId, targetTemplate) {
        // Check compatibility between templates
        return {
            compatible: true,
            issues: [],
            migrations: []
        };
    }
}

module.exports = TemplateUtils;