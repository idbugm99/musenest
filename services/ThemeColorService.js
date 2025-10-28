/**
 * ✨ THEME COLOR SERVICE ✨
 * Database-driven theme color management system
 * Injects database colors as CSS variables for flexible theme customization
 */

const mysql = require('mysql2/promise');

class ThemeColorService {
    constructor() {
        this.colorCache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
    }

    /**
     * Get database connection
     */
    async getConnection() {
        return await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'phoenix4ge'
        });
    }

    /**
     * Get all color overrides for a theme set
     * @param {number} themeSetId - Theme set ID
     * @returns {Promise<Array>} Array of color overrides
     */
    async getThemeColors(themeSetId, previewPaletteId = null) {
        // Debug logging
        console.log(`🔍 ThemeColorService.getThemeColors called with themeSetId=${themeSetId}, previewPaletteId=${previewPaletteId}`);
        
        // If preview palette is specified, use it directly instead of theme colors
        if (previewPaletteId) {
            console.log(`🎨 Using preview palette ${previewPaletteId} for theme ${themeSetId}`);
            return await this.getPaletteColors(previewPaletteId);
        }

        const cacheKey = `theme_${themeSetId}`;
        
        // Check cache first
        if (this.colorCache.has(cacheKey)) {
            const cached = this.colorCache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.colors;
            }
        }

        const db = await this.getConnection();
        try {
            const [colors] = await db.execute(`
                SELECT 
                    variable_name, 
                    variable_value, 
                    variable_category,
                    variable_description,
                    display_order
                FROM theme_color_overrides 
                WHERE theme_set_id = ? AND is_active = 1
                ORDER BY display_order ASC
            `, [themeSetId]);

            // If no overrides exist, fall back to theme's default color palette
            if (!colors || colors.length === 0) {
                console.log(`🎨 No color overrides found for theme ${themeSetId}, falling back to default palette`);
                const paletteColors = await this.getDefaultPaletteColors(themeSetId, db);
                if (paletteColors && paletteColors.length > 0) {
                    // Cache the results
                    this.colorCache.set(cacheKey, {
                        colors: paletteColors,
                        timestamp: Date.now()
                    });
                    return paletteColors;
                }
            }

            // Cache the results
            this.colorCache.set(cacheKey, {
                colors,
                timestamp: Date.now()
            });

            return colors;
        } finally {
            await db.end();
        }
    }

    /**
     * Get theme's default palette colors and convert to theme variables format
     * @param {number} themeSetId - Theme set ID  
     * @param {Object} db - Database connection
     * @returns {Promise<Array>} Array of color variables
     */
    async getDefaultPaletteColors(themeSetId, db) {
        try {
            // Get theme's default palette ID
            const [themeInfo] = await db.execute(`
                SELECT default_palette_id FROM theme_sets 
                WHERE id = ? AND is_active = 1
            `, [themeSetId]);

            if (!themeInfo || themeInfo.length === 0 || !themeInfo[0].default_palette_id) {
                console.log(`🎨 No default palette found for theme ${themeSetId}`);
                return [];
            }

            const paletteId = themeInfo[0].default_palette_id;
            console.log(`🎨 Using default palette ${paletteId} for theme ${themeSetId}`);

            // Get palette colors
            const [paletteTokens] = await db.execute(`
                SELECT token_name, token_value 
                FROM color_palette_values 
                WHERE palette_id = ?
                ORDER BY token_name
            `, [paletteId]);

            // Convert palette tokens to theme variables format
            const themeVariables = [];
            let displayOrder = 1;

            paletteTokens.forEach(token => {
                // Map palette tokens to theme variable names
                const variableName = this.mapTokenToThemeVariable(token.token_name);
                const category = this.getVariableCategory(variableName);

                themeVariables.push({
                    variable_name: variableName,
                    variable_value: token.token_value,
                    variable_category: category,
                    variable_description: `${token.token_name} from palette ${paletteId}`,
                    display_order: displayOrder++
                });
            });

            return themeVariables;
        } catch (error) {
            console.error('Error getting default palette colors:', error);
            return [];
        }
    }

    /**
     * Map palette token names to theme variable names
     * @param {string} tokenName - Palette token name
     * @returns {string} Theme variable name
     */
    mapTokenToThemeVariable(tokenName) {
        const tokenMap = {
            'accent': '--theme-accent',
            'primary': '--theme-primary', 
            'secondary': '--theme-secondary',
            'text': '--theme-text',
            'text-subtle': '--theme-text-subtle',
            'bg': '--theme-bg',
            'background': '--theme-bg',
            'surface': '--theme-surface',
            'border': '--theme-border',
            'link': '--theme-link',
            'success': '--theme-success',
            'warning': '--theme-warning',
            'error': '--theme-error'
        };

        return tokenMap[tokenName] || `--theme-${tokenName}`;
    }

    /**
     * Get variable category from variable name
     * @param {string} variableName - Theme variable name
     * @returns {string} Category name
     */
    getVariableCategory(variableName) {
        if (variableName.includes('primary') || variableName.includes('secondary')) return 'primary';
        if (variableName.includes('accent')) return 'accent';
        if (variableName.includes('bg') || variableName.includes('surface')) return 'background';
        if (variableName.includes('text')) return 'text';
        if (variableName.includes('border')) return 'border';
        return 'accent';
    }

    /**
     * Generate CSS custom properties from database colors
     * @param {number} themeSetId - Theme set ID
     * @returns {Promise<string>} CSS custom properties string
     */
    async generateThemeCSS(themeSetId, previewPaletteId = null) {
        const colors = await this.getThemeColors(themeSetId, previewPaletteId);
        
        if (!colors || colors.length === 0) {
            return '';
        }

        let css = '/* 🎨 Database-Generated Theme Colors */\n:root {\n';
        
        // Group colors by category for better organization
        const categories = {
            primary: [],
            secondary: [],
            accent: [],
            background: [],
            text: [],
            border: []
        };

        colors.forEach(color => {
            categories[color.variable_category] = categories[color.variable_category] || [];
            categories[color.variable_category].push(color);
        });

        // Generate CSS for each category
        Object.keys(categories).forEach(category => {
            if (categories[category].length > 0) {
                css += `\n    /* ${category.charAt(0).toUpperCase() + category.slice(1)} Colors */\n`;
                categories[category].forEach(color => {
                    css += `    ${color.variable_name}: ${color.variable_value}; /* ${color.variable_description || category} */\n`;
                });
            }
        });

        css += '\n}\n';
        return css;
    }

    /**
     * Generate theme-specific utility classes
     * @param {number} themeSetId - Theme set ID
     * @returns {Promise<string>} CSS utility classes
     */
    async generateUtilityCSS(themeSetId) {
        const colors = await this.getThemeColors(themeSetId);
        
        if (!colors || colors.length === 0) {
            return '';
        }

        let css = '\n/* 🎨 Theme Utility Classes */\n';
        
        colors.forEach(color => {
            const className = color.variable_name.replace('--', '').replace(/-/g, '-');
            const varName = color.variable_name;
            
            // Generate text, background, and border classes
            css += `.text-${className} { color: var(${varName}) !important; }\n`;
            css += `.bg-${className} { background-color: var(${varName}) !important; }\n`;
            css += `.border-${className} { border-color: var(${varName}) !important; }\n`;
        });

        return css;
    }

    async getPaletteColors(paletteId) {
        try {
            const db = await this.getConnection();
            const [tokens] = await db.execute(
                `SELECT token_name, token_value FROM color_palette_values WHERE palette_id = ? ORDER BY token_name`,
                [paletteId]
            );
            await db.end();
            if (!tokens || tokens.length === 0) return [];

            const themeVariables = [];
            let displayOrder = 1;
            tokens.forEach(token => {
                const variableName = this.mapTokenToThemeVariable(token.token_name);
                const category = this.getVariableCategory(variableName);
                themeVariables.push({
                    variable_name: variableName,
                    variable_value: token.token_value,
                    variable_category: category,
                    variable_description: `${token.token_name} from preview palette ${paletteId}`,
                    display_order: displayOrder++
                });
            });
            return themeVariables;
        } catch (e) {
            console.error('Error loading palette colors:', e);
            return [];
        }
    }

    async generateThemeCSSFromVariables(variables) {
        if (!variables || variables.length === 0) return '';
        let css = '/* 🎨 Database-Generated Theme Colors */\n:root {\n';
        const categories = { primary: [], secondary: [], accent: [], background: [], text: [], border: [] };
        variables.forEach(color => {
            categories[color.variable_category] = categories[color.variable_category] || [];
            categories[color.variable_category].push(color);
        });
        Object.keys(categories).forEach(category => {
            if (categories[category].length > 0) {
                css += `\n    /* ${category.charAt(0).toUpperCase() + category.slice(1)} Colors */\n`;
                categories[category].forEach(color => {
                    css += `    ${color.variable_name}: ${color.variable_value}; /* ${color.variable_description || category} */\n`;
                });
            }
        });
        css += '\n}\n';
        return css;
    }

    /**
     * Get complete theme CSS for injection into HTML
     * @param {number} themeSetId - Theme set ID
     * @returns {Promise<string>} Complete CSS for theme
     */
    async getThemeCSS(themeSetId, paletteId = null) {
        // If a preview palette is specified, build CSS from that palette directly
        if (paletteId) {
            const variables = await this.getPaletteColors(paletteId);
            const themeColors = await this.generateThemeCSSFromVariables(variables);
            // Utilities should still refer to the same variable set
            let utilityCss = '';
            variables.forEach(color => {
                const className = color.variable_name.replace('--', '').replace(/-/g, '-');
                const varName = color.variable_name;
                utilityCss += `.text-${className} { color: var(${varName}) !important; }\n`;
                utilityCss += `.bg-${className} { background-color: var(${varName}) !important; }\n`;
                utilityCss += `.border-${className} { border-color: var(${varName}) !important; }\n`;
            });
            return `${themeColors}${utilityCss}`;
        }

        // Default behavior: use theme overrides (with fallback to theme default palette)
        const themeColors = await this.generateThemeCSS(themeSetId, paletteId);
        const utilityClasses = await this.generateUtilityCSS(themeSetId);
        return `${themeColors}${utilityClasses}`; 
    }

    /**
     * Clear cache for a specific theme or all themes
     * @param {number|null} themeSetId - Theme set ID or null for all
     */
    clearCache(themeSetId = null) {
        if (themeSetId) {
            this.colorCache.delete(`theme_${themeSetId}`);
        } else {
            this.colorCache.clear();
        }
    }

    /**
     * Update theme color in database
     * @param {number} themeSetId - Theme set ID
     * @param {string} variableName - CSS variable name
     * @param {string} variableValue - CSS variable value
     * @returns {Promise<boolean>} Success status
     */
    async updateThemeColor(themeSetId, variableName, variableValue) {
        const db = await this.getConnection();
        try {
            await db.execute(`
                UPDATE theme_color_overrides 
                SET variable_value = ?, updated_at = NOW()
                WHERE theme_set_id = ? AND variable_name = ?
            `, [variableValue, themeSetId, variableName]);

            // Clear cache for this theme
            this.clearCache(themeSetId);
            return true;
        } catch (error) {
            console.error('Error updating theme color:', error);
            return false;
        } finally {
            await db.end();
        }
    }
}

module.exports = new ThemeColorService();