const fs = require('fs').promises;
const path = require('path');

class TemplateEngine {
    constructor() {
        this.templateCache = new Map();
        this.helpers = {};
        this.registerDefaultHelpers();
    }

    // Register template helpers
    registerHelper(name, fn) {
        this.helpers[name] = fn;
    }

    registerDefaultHelpers() {
        // Conditional helper
        this.registerHelper('if', (condition, options) => {
            if (condition) {
                return options.fn ? options.fn(this) : options.truthy || '';
            } else {
                return options.inverse ? options.inverse(this) : options.falsy || '';
            }
        });

        // Each loop helper
        this.registerHelper('each', (context, options) => {
            if (!Array.isArray(context)) return '';
            
            return context.map((item, index) => {
                const itemContext = {
                    ...item,
                    '@index': index,
                    '@first': index === 0,
                    '@last': index === context.length - 1,
                    '@odd': index % 2 === 1,
                    '@even': index % 2 === 0
                };
                return options.fn ? options.fn(itemContext) : this.render(options.template, itemContext);
            }).join('');
        });

        // Equality helper
        this.registerHelper('eq', (a, b) => a === b);

        // Current year helper
        this.registerHelper('currentYear', () => new Date().getFullYear());

        // Truncate text helper
        this.registerHelper('truncate', (text, length = 100) => {
            if (!text || text.length <= length) return text;
            return text.substring(0, length) + '...';
        });

        // URL generation helper
        this.registerHelper('url', (slug, page = '') => {
            return page ? `/${slug}/${page}` : `/${slug}/`;
        });

        // Safe HTML helper (bypass escaping)
        this.registerHelper('safe', (html) => html);
    }

    // Parse template and extract variables
    parseTemplate(template) {
        const variables = new Set();
        const variableRegex = /\{\{(.*?)\}\}/g;
        let match;

        while ((match = variableRegex.exec(template)) !== null) {
            const variable = match[1].trim();
            if (!variable.startsWith('#') && !variable.startsWith('/')) {
                variables.add(variable.split('.')[0]);
            }
        }

        return Array.from(variables);
    }

    // Escape HTML entities
    escapeHtml(text) {
        if (typeof text !== 'string') return text;
        
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        
        return text.replace(/[&<>"']/g, (m) => map[m]);
    }

    // Get nested property from object
    getValue(obj, path) {
        if (!path) return obj;
        
        const keys = path.split('.');
        let current = obj;
        
        for (const key of keys) {
            if (current === null || current === undefined) return undefined;
            current = current[key];
        }
        
        return current;
    }

    // Process conditional blocks
    processConditionals(template, context) {
        // Handle {{#if condition}} blocks
        template = template.replace(/\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, content) => {
            const value = this.getValue(context, condition.trim());
            return value ? content : '';
        });

        // Handle {{#if condition}}...{{else}}...{{/if}} blocks
        template = template.replace(/\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, trueContent, falseContent) => {
            const value = this.getValue(context, condition.trim());
            return value ? trueContent : falseContent;
        });

        return template;
    }

    // Process loops
    processLoops(template, context) {
        return template.replace(/\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, arrayPath, content) => {
            const array = this.getValue(context, arrayPath.trim());
            
            if (!Array.isArray(array) || array.length === 0) {
                return '';
            }

            return array.map((item, index) => {
                const itemContext = {
                    ...context,
                    ...item,
                    '@index': index,
                    '@first': index === 0,
                    '@last': index === array.length - 1,
                    '@odd': index % 2 === 1,
                    '@even': index % 2 === 0
                };

                return this.processVariables(content, itemContext);
            }).join('');
        });
    }

    // Process variables
    processVariables(template, context) {
        return template.replace(/\{\{([^#\/][^}]*)\}\}/g, (match, variable) => {
            const trimmedVar = variable.trim();
            
            // Handle helper functions
            if (trimmedVar.includes('(') && trimmedVar.includes(')')) {
                return this.processHelper(trimmedVar, context);
            }

            // Handle special syntax like {{#if this.is_visible}}
            if (trimmedVar.startsWith('this.')) {
                const path = trimmedVar.substring(5);
                const value = this.getValue(context, path);
                return value !== undefined ? this.escapeHtml(String(value)) : '';
            }

            // Handle regular variables
            const value = this.getValue(context, trimmedVar);
            
            if (value === null || value === undefined) {
                return '';
            }

            // Don't escape HTML if it's marked as safe
            if (typeof value === 'string' && value.startsWith('SAFE:')) {
                return value.substring(5);
            }

            return this.escapeHtml(String(value));
        });
    }

    // Process helper functions
    processHelper(helperString, context) {
        const match = helperString.match(/(\w+)\((.*?)\)/);
        if (!match) return '';

        const [, helperName, argsString] = match;
        const helper = this.helpers[helperName];

        if (!helper) return '';

        // Parse arguments (basic implementation)
        const args = argsString.split(',').map(arg => {
            const trimmed = arg.trim();
            if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
                return trimmed.slice(1, -1);
            }
            if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
                return trimmed.slice(1, -1);
            }
            if (!isNaN(trimmed)) {
                return Number(trimmed);
            }
            return this.getValue(context, trimmed);
        });

        return helper(...args);
    }

    // Main render function
    render(template, context = {}) {
        try {
            // Process in order: conditionals, loops, then variables
            let processed = this.processConditionals(template, context);
            processed = this.processLoops(processed, context);
            processed = this.processVariables(processed, context);
            
            return processed;
        } catch (error) {
            console.error('Template rendering error:', error);
            return `<!-- Template Error: ${error.message} -->`;
        }
    }

    // Render template from file
    async renderFile(templatePath, context = {}) {
        try {
            // Check cache first
            if (this.templateCache.has(templatePath)) {
                const template = this.templateCache.get(templatePath);
                return this.render(template, context);
            }

            // Read template file
            const template = await fs.readFile(templatePath, 'utf8');
            
            // Cache template (in production, you might want cache invalidation)
            if (process.env.NODE_ENV === 'production') {
                this.templateCache.set(templatePath, template);
            }

            return this.render(template, context);
        } catch (error) {
            console.error(`Template file error for ${templatePath}:`, error);
            return `<!-- Template File Error: ${error.message} -->`;
        }
    }

    // Get theme template path
    getThemeTemplatePath(theme, templateName) {
        const templatesDir = path.join(__dirname, '../../templates');
        return path.join(templatesDir, theme, `${templateName}.html`);
    }

    // Render with theme
    async renderWithTheme(theme, templateName, context = {}) {
        const templatePath = this.getThemeTemplatePath(theme, templateName);
        
        try {
            await fs.access(templatePath);
            return await this.renderFile(templatePath, context);
        } catch (error) {
            // Fallback to basic theme if theme template doesn't exist
            if (theme !== 'basic') {
                console.warn(`Template ${templateName} not found for theme ${theme}, falling back to basic theme`);
                return await this.renderWithTheme('basic', templateName, context);
            }
            
            throw new Error(`Template ${templateName} not found in basic theme`);
        }
    }

    // Clear template cache (useful for development)
    clearCache() {
        this.templateCache.clear();
    }
}

module.exports = new TemplateEngine();