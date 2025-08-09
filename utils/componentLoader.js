/**
 * Component Loader Service
 * Handles loading and rendering of HTML components for admin interface
 * Part of Phase A: Critical Admin Interface Fixes
 */

const fs = require('fs').promises;
const path = require('path');

class ComponentLoader {
    constructor() {
        this.componentsPath = path.join(__dirname, '../admin/components');
        this.componentCache = new Map();
        this.cacheEnabled = process.env.NODE_ENV === 'production';
    }

    /**
     * Load a component HTML file
     * @param {string} componentName - Name of component (without .html extension)
     * @returns {Promise<string>} - Component HTML content
     */
    async loadComponent(componentName) {
        try {
            // Check cache first (in production)
            const cacheKey = `component:${componentName}`;
            if (this.cacheEnabled && this.componentCache.has(cacheKey)) {
                return this.componentCache.get(cacheKey);
            }

            // Sanitize component name to prevent path traversal
            const sanitizedName = this.sanitizeComponentName(componentName);
            const componentPath = path.join(this.componentsPath, `${sanitizedName}.html`);

            // Verify file exists and is within components directory
            await this.validateComponentPath(componentPath);

            // Load component content
            const content = await fs.readFile(componentPath, 'utf8');

            // Cache the component (in production)
            if (this.cacheEnabled) {
                this.componentCache.set(cacheKey, content);
            }

            return content;

        } catch (error) {
            console.error(`ComponentLoader: Failed to load component '${componentName}':`, error.message);
            return this.getErrorPlaceholder(componentName, error.message);
        }
    }

    /**
     * Synchronous version for Handlebars helpers
     * @param {string} componentName - Name of component
     * @returns {string} - Component HTML content or error placeholder
     */
    loadComponentSync(componentName) {
        try {
            // Check cache first
            const cacheKey = `component:${componentName}`;
            if (this.componentCache.has(cacheKey)) {
                return this.componentCache.get(cacheKey);
            }

            // Sanitize component name
            const sanitizedName = this.sanitizeComponentName(componentName);
            const componentPath = path.join(this.componentsPath, `${sanitizedName}.html`);

            // Verify path is safe (synchronous)
            this.validateComponentPathSync(componentPath);

            // Load component content synchronously
            const content = require('fs').readFileSync(componentPath, 'utf8');

            // Cache the component
            this.componentCache.set(cacheKey, content);

            return content;

        } catch (error) {
            console.error(`ComponentLoader: Failed to load component '${componentName}' (sync):`, error.message);
            return this.getErrorPlaceholder(componentName, error.message);
        }
    }

    /**
     * Preload all components into cache
     * @returns {Promise<void>}
     */
    async preloadComponents() {
        try {
            const files = await fs.readdir(this.componentsPath);
            const htmlFiles = files.filter(file => file.endsWith('.html'));

            console.log(`ComponentLoader: Preloading ${htmlFiles.length} components...`);

            const loadPromises = htmlFiles.map(async (file) => {
                const componentName = path.basename(file, '.html');
                await this.loadComponent(componentName);
            });

            await Promise.all(loadPromises);
            console.log(`ComponentLoader: Successfully preloaded ${htmlFiles.length} components`);

        } catch (error) {
            console.error('ComponentLoader: Failed to preload components:', error);
        }
    }

    /**
     * Clear component cache
     */
    clearCache() {
        this.componentCache.clear();
        console.log('ComponentLoader: Cache cleared');
    }

    /**
     * Get list of available components
     * @returns {Promise<string[]>} - Array of component names
     */
    async getAvailableComponents() {
        try {
            const files = await fs.readdir(this.componentsPath);
            return files
                .filter(file => file.endsWith('.html'))
                .map(file => path.basename(file, '.html'));
        } catch (error) {
            console.error('ComponentLoader: Failed to list components:', error);
            return [];
        }
    }

    /**
     * Sanitize component name to prevent path traversal attacks
     * @param {string} componentName - Raw component name
     * @returns {string} - Sanitized component name
     */
    sanitizeComponentName(componentName) {
        // Remove any path separators and keep only alphanumeric, hyphens, underscores
        return componentName.replace(/[^a-zA-Z0-9\-_]/g, '');
    }

    /**
     * Validate that component path is safe and within components directory
     * @param {string} componentPath - Full path to component
     * @returns {Promise<void>}
     */
    async validateComponentPath(componentPath) {
        // Resolve to absolute path
        const resolvedPath = path.resolve(componentPath);
        const resolvedComponentsPath = path.resolve(this.componentsPath);

        // Check if path is within components directory
        if (!resolvedPath.startsWith(resolvedComponentsPath)) {
            throw new Error('Component path is outside of allowed directory');
        }

        // Check if file exists
        try {
            await fs.access(resolvedPath);
        } catch (error) {
            throw new Error(`Component file not found: ${path.basename(componentPath)}`);
        }
    }

    /**
     * Synchronous version of path validation
     * @param {string} componentPath - Full path to component
     */
    validateComponentPathSync(componentPath) {
        // Resolve to absolute path
        const resolvedPath = path.resolve(componentPath);
        const resolvedComponentsPath = path.resolve(this.componentsPath);

        // Check if path is within components directory
        if (!resolvedPath.startsWith(resolvedComponentsPath)) {
            throw new Error('Component path is outside of allowed directory');
        }

        // Check if file exists
        if (!require('fs').existsSync(resolvedPath)) {
            throw new Error(`Component file not found: ${path.basename(componentPath)}`);
        }
    }

    /**
     * Generate error placeholder HTML
     * @param {string} componentName - Component name that failed to load
     * @param {string} errorMessage - Error message
     * @returns {string} - Error placeholder HTML
     */
    getErrorPlaceholder(componentName, errorMessage) {
        const isDevelopment = process.env.NODE_ENV !== 'production';
        const errorDetails = isDevelopment ? ` (${errorMessage})` : '';
        
        return `
            <div class="alert alert-danger" role="alert">
                <h6><i class="fas fa-exclamation-triangle me-2"></i>Component Load Error</h6>
                <p class="mb-0">Failed to load component: <strong>${componentName}</strong>${errorDetails}</p>
                ${isDevelopment ? `<small class="text-muted mt-1 d-block">Check that the file exists at: admin/components/${componentName}.html</small>` : ''}
            </div>
        `;
    }
}

// Create singleton instance
const componentLoader = new ComponentLoader();

module.exports = componentLoader;