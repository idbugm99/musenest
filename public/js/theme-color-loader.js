/**
 * ✨ THEME COLOR LOADER ✨
 * Client-side theme color injection from database
 */

class ThemeColorLoader {
    constructor() {
        this.currentThemeId = null;
        this.colorsLoaded = false;
    }

    /**
     * Initialize theme color loading
     * @param {number} themeId - Theme set ID
     * @param {boolean} isPreview - Whether this is a preview mode
     */
    async init(themeId, isPreview = false) {
        this.currentThemeId = themeId;
        
        try {
            await this.loadThemeColors(themeId);
            this.colorsLoaded = true;
            
            if (isPreview) {
                console.log(`🎨 Theme ${themeId} colors loaded in preview mode`);
            }
        } catch (error) {
            console.error('Failed to load theme colors:', error);
        }
    }

    /**
     * Load theme colors from API and inject into DOM
     * @param {number} themeId - Theme set ID
     */
    async loadThemeColors(themeId) {
        const response = await fetch(`/api/theme-colors/${themeId}/css`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const themeCSS = await response.text();
        
        // Remove existing theme colors if any
        const existing = document.getElementById('database-theme-colors');
        if (existing) {
            existing.remove();
        }
        
        // Create style element with theme colors
        const styleElement = document.createElement('style');
        styleElement.id = 'database-theme-colors';
        styleElement.textContent = themeCSS;
        
        // Insert into head
        document.head.appendChild(styleElement);
        
        // Trigger custom event for other components
        window.dispatchEvent(new CustomEvent('themeColorsLoaded', {
            detail: { themeId: themeId }
        }));
    }

    /**
     * Update a specific theme color
     * @param {string} variableName - CSS variable name
     * @param {string} variableValue - CSS variable value
     */
    async updateThemeColor(variableName, variableValue) {
        if (!this.currentThemeId) return;
        
        try {
            const response = await fetch(`/api/theme-colors/${this.currentThemeId}/${variableName}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ variableValue })
            });
            
            if (response.ok) {
                // Reload theme colors to reflect changes
                await this.loadThemeColors(this.currentThemeId);
                console.log(`✅ Updated ${variableName} to ${variableValue}`);
            }
        } catch (error) {
            console.error('Failed to update theme color:', error);
        }
    }

    /**
     * Get current theme colors data
     * @returns {Promise<Array>} Array of theme colors
     */
    async getThemeColors() {
        if (!this.currentThemeId) return [];
        
        try {
            const response = await fetch(`/api/theme-colors/${this.currentThemeId}`);
            const result = await response.json();
            return result.success ? result.data : [];
        } catch (error) {
            console.error('Failed to get theme colors:', error);
            return [];
        }
    }

    /**
     * Auto-detect theme from URL parameters
     */
    autoDetectTheme() {
        const urlParams = new URLSearchParams(window.location.search);
        const previewTheme = urlParams.get('preview_theme');
        
        if (previewTheme) {
            return {
                themeId: parseInt(previewTheme),
                isPreview: true
            };
        }
        
        // Get theme from page data attribute
        const bodyThemeId = document.body.getAttribute('data-theme-id');
        const bodyPreviewId = document.body.getAttribute('data-theme-preview');
        
        if (bodyPreviewId) {
            return {
                themeId: parseInt(bodyPreviewId),
                isPreview: true
            };
        }
        
        if (bodyThemeId && bodyThemeId !== '') {
            return {
                themeId: parseInt(bodyThemeId),
                isPreview: false
            };
        }
        
        // Default to theme 5 if no theme detected
        return {
            themeId: 5,
            isPreview: true
        };
    }
}

// Auto-initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    const themeLoader = new ThemeColorLoader();
    const themeConfig = themeLoader.autoDetectTheme();
    
    if (themeConfig) {
        await themeLoader.init(themeConfig.themeId, themeConfig.isPreview);
    }
    
    // Make available globally for debugging
    window.themeLoader = themeLoader;
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThemeColorLoader;
}