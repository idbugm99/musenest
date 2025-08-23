/**
 * ✨ THEME HANDLEBARS HELPERS ✨
 * Custom Handlebars helpers for database-driven theme system
 */

const ThemeColorService = require('../services/ThemeColorService');

module.exports = {
    /**
     * Inject database theme colors as CSS
     * Usage: {{{themeColors themeSetId}}}
     */
    themeColors: async function(themeSetId) {
        try {
            if (!themeSetId || themeSetId <= 0) {
                return '';
            }
            
            const css = await ThemeColorService.getThemeCSS(themeSetId);
            return css;
        } catch (error) {
            console.error('Error in themeColors helper:', error);
            return '';
        }
    },

    /**
     * Get specific theme color value
     * Usage: {{themeColor themeSetId '--basic-primary'}}
     */
    themeColor: async function(themeSetId, variableName) {
        try {
            if (!themeSetId || !variableName) {
                return '';
            }
            
            const colors = await ThemeColorService.getThemeColors(themeSetId);
            const color = colors.find(c => c.variable_name === variableName);
            
            return color ? color.variable_value : '';
        } catch (error) {
            console.error('Error in themeColor helper:', error);
            return '';
        }
    },

    /**
     * Check if theme has custom colors
     * Usage: {{#if (hasThemeColors themeSetId)}}...{{/if}}
     */
    hasThemeColors: async function(themeSetId) {
        try {
            if (!themeSetId || themeSetId <= 0) {
                return false;
            }
            
            const colors = await ThemeColorService.getThemeColors(themeSetId);
            return colors && colors.length > 0;
        } catch (error) {
            console.error('Error in hasThemeColors helper:', error);
            return false;
        }
    },

    /**
     * Generate CSS class name from color variable
     * Usage: {{colorClassName '--basic-primary'}}
     */
    colorClassName: function(variableName) {
        if (!variableName) return '';
        return variableName.replace('--', '').replace(/-/g, '-');
    }
};