/**
 * Universal Page System Handlebars Helpers
 * Provides helpers for rendering page components with the universal system
 */

const fs = require('fs').promises;
const path = require('path');
const handlebars = require('handlebars');

class UniversalPageHelpers {
    constructor() {
        this.templateCache = new Map();
    }

    /**
     * Load and cache a template file
     */
    async loadTemplate(templatePath) {
        const fullPath = path.join(__dirname, '../../templates', templatePath);
        
        if (this.templateCache.has(fullPath)) {
            return this.templateCache.get(fullPath);
        }

        try {
            const templateContent = await fs.readFile(fullPath, 'utf8');
            const compiledTemplate = handlebars.compile(templateContent);
            this.templateCache.set(fullPath, compiledTemplate);
            return compiledTemplate;
        } catch (error) {
            console.error(`Error loading template ${templatePath}:`, error);
            return null;
        }
    }

    /**
     * Register helpers with Handlebars
     */
    registerHelpers(handlebars) {
        // Universal Hero Section Helper
        handlebars.registerHelper('renderUniversalHero', async (options) => {
            const template = await this.loadTemplate('universal/pages/universal-hero.handlebars');
            if (!template) return '';

            const context = {
                content: options.hash.content || {},
                model: options.hash.model || {},
                modelSlug: options.hash.modelSlug || '',
                previewParam: options.hash.previewParam || ''
            };

            return new handlebars.SafeString(template(context));
        });

        // Universal About Section Helper
        handlebars.registerHelper('renderUniversalAbout', async (options) => {
            const template = await this.loadTemplate('universal/pages/universal-about-section.handlebars');
            if (!template) return '';

            const context = {
                content: options.hash.content || {},
                model: options.hash.model || {},
                modelSlug: options.hash.modelSlug || ''
            };

            return new handlebars.SafeString(template(context));
        });

        // Universal Services Section Helper
        handlebars.registerHelper('renderUniversalServices', async (options) => {
            const template = await this.loadTemplate('universal/pages/universal-services-section.handlebars');
            if (!template) return '';

            const context = {
                content: options.hash.content || {},
                model: options.hash.model || {},
                modelSlug: options.hash.modelSlug || ''
            };

            return new handlebars.SafeString(template(context));
        });

        // Utility helper for multiplication (used in AOS delays)
        handlebars.registerHelper('multiply', (a, b) => {
            return a * b;
        });

        // Times helper for star ratings
        handlebars.registerHelper('times', function(n, options) {
            let result = '';
            for (let i = 0; i < n; i++) {
                result += options.fn(this);
            }
            return result;
        });
    }
}

module.exports = UniversalPageHelpers;