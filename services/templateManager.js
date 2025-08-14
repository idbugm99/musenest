const fs = require('fs').promises;
const path = require('path');
const handlebars = require('handlebars');

class TemplateManager {
    constructor() {
        this.configPath = path.join(__dirname, '../config/templates.json');
        this.themesPath = path.join(__dirname, '../themes');
        this.config = null;
        this.cache = new Map();
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;
        
        try {
            const configData = await fs.readFile(this.configPath, 'utf8');
            this.config = JSON.parse(configData);
            this.initialized = true;
            console.log('TemplateManager initialized successfully');
        } catch (error) {
            console.error('Failed to initialize TemplateManager:', error);
            throw new Error('Template configuration could not be loaded');
        }
    }

    async getAvailableTemplates() {
        await this.initialize();
        return this.config.templateRegistry.templates;
    }

    async getTemplatesByCategory(category) {
        await this.initialize();
        const templates = this.config.templateRegistry.templates;
        return Object.values(templates).filter(template => template.category === category);
    }

    async getTemplateInfo(templateId) {
        await this.initialize();
        const template = this.config.templateRegistry.templates[templateId];
        if (!template) {
            throw new Error(`Template '${templateId}' not found`);
        }
        return template;
    }

    async validateTemplate(templateId) {
        await this.initialize();
        const template = await this.getTemplateInfo(templateId);
        const templatePath = path.join(this.themesPath, templateId);
        
        try {
            const stats = await fs.stat(templatePath);
            if (!stats.isDirectory()) {
                return { valid: false, error: `Template directory not found: ${templatePath}` };
            }

            // Check required files
            const requiredFiles = template.files.pages || [];
            for (const file of requiredFiles) {
                const filePath = path.join(templatePath, 'pages', file);
                try {
                    await fs.access(filePath);
                } catch {
                    return { valid: false, error: `Missing required file: ${file}` };
                }
            }

            return { valid: true, template };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    async getTemplatePreviewData(templateId) {
        await this.initialize();
        const template = await this.getTemplateInfo(templateId);
        
        return {
            id: template.id,
            name: template.name,
            description: template.description,
            preview: template.preview,
            features: template.features,
            colorScheme: template.colorScheme,
            category: template.category,
            status: template.status
        };
    }

    async loadTemplate(templateId, pageName) {
        await this.initialize();
        
        const cacheKey = `${templateId}-${pageName}`;
        if (this.cache.has(cacheKey) && this.config.settings.cacheTemplates) {
            return this.cache.get(cacheKey);
        }

        const validation = await this.validateTemplate(templateId);
        if (!validation.valid) {
            throw new Error(`Template validation failed: ${validation.error}`);
        }

        const templatePath = path.join(this.themesPath, templateId, 'pages', `${pageName}.handlebars`);
        
        try {
            const templateContent = await fs.readFile(templatePath, 'utf8');
            const compiledTemplate = handlebars.compile(templateContent);
            
            if (this.config.settings.cacheTemplates) {
                this.cache.set(cacheKey, compiledTemplate);
            }
            
            return compiledTemplate;
        } catch (error) {
            throw new Error(`Failed to load template: ${error.message}`);
        }
    }

    async renderTemplate(templateId, pageName, data = {}) {
        const template = await this.loadTemplate(templateId, pageName);
        const templateInfo = await this.getTemplateInfo(templateId);
        
        // Merge template-specific data with provided data
        const renderData = {
            ...data,
            template: {
                id: templateId,
                name: templateInfo.name,
                colorScheme: templateInfo.colorScheme
            }
        };
        
        return template(renderData);
    }

    async switchTemplate(currentTemplateId, newTemplateId) {
        await this.initialize();
        
        // Validate both templates
        const currentValidation = await this.validateTemplate(currentTemplateId);
        const newValidation = await this.validateTemplate(newTemplateId);
        
        if (!currentValidation.valid) {
            throw new Error(`Current template invalid: ${currentValidation.error}`);
        }
        
        if (!newValidation.valid) {
            throw new Error(`New template invalid: ${newValidation.error}`);
        }
        
        // Create backup if enabled
        if (this.config.deployment.backupOnSwitch) {
            await this.createTemplateBackup(currentTemplateId);
        }
        
        return {
            success: true,
            from: currentTemplateId,
            to: newTemplateId,
            backup: this.config.deployment.backupOnSwitch,
            timestamp: new Date().toISOString()
        };
    }

    async createTemplateBackup(templateId) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path.join(__dirname, '../backups/templates');
        const backupPath = path.join(backupDir, `${templateId}-${timestamp}`);
        
        try {
            await fs.mkdir(backupDir, { recursive: true });
            const templatePath = path.join(this.themesPath, templateId);
            
            // Create backup (simplified - in production would use proper backup utility)
            await this.copyDirectory(templatePath, backupPath);
            
            console.log(`Template backup created: ${backupPath}`);
            return backupPath;
        } catch (error) {
            console.error(`Backup creation failed: ${error.message}`);
            throw error;
        }
    }

    async copyDirectory(src, dest) {
        await fs.mkdir(dest, { recursive: true });
        const entries = await fs.readdir(src, { withFileTypes: true });
        
        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            
            if (entry.isDirectory()) {
                await this.copyDirectory(srcPath, destPath);
            } else {
                await fs.copyFile(srcPath, destPath);
            }
        }
    }

    async getTemplateStats() {
        await this.initialize();
        const templates = this.config.templateRegistry.templates;
        const categories = this.config.categories;
        
        const stats = {
            totalTemplates: Object.keys(templates).length,
            categories: Object.keys(categories).length,
            statusBreakdown: {},
            categoryBreakdown: {}
        };
        
        // Count by status
        Object.values(templates).forEach(template => {
            stats.statusBreakdown[template.status] = (stats.statusBreakdown[template.status] || 0) + 1;
            stats.categoryBreakdown[template.category] = (stats.categoryBreakdown[template.category] || 0) + 1;
        });
        
        return stats;
    }

    async clearCache() {
        this.cache.clear();
        console.log('Template cache cleared');
    }

    async reloadConfig() {
        try {
            const configData = await fs.readFile(this.configPath, 'utf8');
            this.config = JSON.parse(configData);
            this.clearCache();
            console.log('Template configuration reloaded');
        } catch (error) {
            console.error('Failed to reload configuration:', error);
            throw error;
        }
    }

    getDefaultTemplate() {
        return this.config?.templateRegistry?.defaultTemplate || 'basic';
    }

    getFallbackTemplate() {
        return this.config?.settings?.fallbackTemplate || 'basic';
    }
}

module.exports = new TemplateManager();