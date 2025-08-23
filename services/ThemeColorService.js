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
            database: process.env.DB_DATABASE || 'musenest'
        });
    }

    /**
     * Get all color overrides for a theme set
     * @param {number} themeSetId - Theme set ID
     * @returns {Promise<Array>} Array of color overrides
     */
    async getThemeColors(themeSetId) {
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
     * Generate CSS custom properties from database colors
     * @param {number} themeSetId - Theme set ID
     * @returns {Promise<string>} CSS custom properties string
     */
    async generateThemeCSS(themeSetId) {
        const colors = await this.getThemeColors(themeSetId);
        
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

    /**
     * Get complete theme CSS for injection into HTML
     * @param {number} themeSetId - Theme set ID
     * @returns {Promise<string>} Complete CSS for theme
     */
    async getThemeCSS(themeSetId) {
        const themeColors = await this.generateThemeCSS(themeSetId);
        const utilityClasses = await this.generateUtilityCSS(themeSetId);
        
        return `<style id="database-theme-colors">
${themeColors}${utilityClasses}

/* ✨ VICTORIAN BOUDOIR ORNATE STYLING ✨ */

/* Victorian Lace Border Patterns */
.victorian-lace-border, .theme-card {
    border: 2px solid var(--victorian-antique-gold);
    position: relative;
    border-radius: 25px;
    background: linear-gradient(135deg, var(--theme-bg-tertiary) 0%, var(--theme-bg-surface) 100%);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), 0 0 20px rgba(184, 134, 11, 0.1);
    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    overflow: hidden;
}

.victorian-lace-border::before, .theme-card::before {
    content: '';
    position: absolute;
    top: -1px; left: -1px; right: -1px; bottom: -1px;
    background: repeating-linear-gradient(
        45deg,
        var(--victorian-antique-gold) 0px, var(--victorian-antique-gold) 2px,
        transparent 2px, transparent 8px,
        var(--victorian-pearl) 8px, var(--victorian-pearl) 10px,
        transparent 10px, transparent 16px
    );
    border-radius: inherit;
    opacity: 0.4;
    pointer-events: none;
}

.theme-card:hover {
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4), 0 0 40px rgba(184, 134, 11, 0.2);
    transform: translateY(-4px) scale(1.02);
    border-color: var(--boudoir-champagne);
}

/* Ornate Damask Background Pattern for Sections */
.theme-section, body {
    background-image: 
        radial-gradient(circle at 25% 25%, rgba(184, 134, 11, 0.05) 0%, transparent 25%),
        radial-gradient(circle at 75% 75%, rgba(184, 134, 11, 0.08) 0%, transparent 30%),
        radial-gradient(circle at 50% 25%, rgba(248, 246, 240, 0.03) 0%, transparent 35%),
        radial-gradient(circle at 25% 75%, rgba(184, 134, 11, 0.06) 0%, transparent 25%);
    background-size: 120px 120px, 80px 80px, 160px 160px, 100px 100px;
    background-position: 0 0, 30px 30px, 80px 0, 0 80px;
    animation: victorian-damask-flow 60s linear infinite;
}

@keyframes victorian-damask-flow {
    0% { background-position: 0 0, 30px 30px, 80px 0, 0 80px; }
    25% { background-position: 20px 10px, 50px 20px, 60px 10px, 10px 90px; }
    50% { background-position: -20px 15px, 20px 50px, 100px -10px, -10px 70px; }
    75% { background-position: 10px -10px, 40px 35px, 70px 15px, 15px 85px; }
    100% { background-position: 0 0, 30px 30px, 80px 0, 0 80px; }
}

/* Victorian Filigree Scrollwork for Headers */
.rates-header, .etiquette-header, h1, h2 {
    position: relative;
    text-align: center;
    margin: 2rem 0;
}

.rates-header::before, .etiquette-header::before, h1::before, h2::before {
    content: '❦ ◆ ❦';
    position: absolute;
    top: -15px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--theme-bg-primary);
    color: var(--victorian-antique-gold);
    font-size: 18px;
    padding: 0 15px;
    letter-spacing: 8px;
    opacity: 0.8;
}

.rates-header::after, .etiquette-header::after, h1::after, h2::after {
    content: '';
    position: absolute;
    top: -8px;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, 
        transparent 0%, 
        var(--victorian-antique-gold) 15%, 
        var(--victorian-deep-gold) 50%,
        var(--victorian-antique-gold) 85%, 
        transparent 100%);
}

/* Cameo-Style Portrait Frames */
.portrait-image, .about-portrait img, img[src*="portrait"], img[src*="profile"] {
    background: linear-gradient(135deg, var(--victorian-pearl) 0%, var(--victorian-ivory) 100%);
    border: 4px solid var(--victorian-antique-gold);
    border-radius: 50%;
    padding: 8px;
    box-shadow: 
        0 0 0 2px var(--victorian-deep-gold),
        0 0 30px rgba(184, 134, 11, 0.4), 
        inset 0 0 20px rgba(255, 255, 255, 0.2);
    position: relative;
    display: inline-block;
}

.portrait-image::before, .about-portrait img::before {
    content: '';
    position: absolute;
    top: -6px; left: -6px; right: -6px; bottom: -6px;
    border: 2px dotted var(--victorian-antique-gold);
    border-radius: 50%;
    opacity: 0.6;
}

/* Pearl String Borders for Sections */
.rates-section, .etiquette-section, .theme-section-alt {
    position: relative;
    padding: 40px 20px;
}

.rates-section::before, .etiquette-section::before, .theme-section-alt::before {
    content: '● ● ● ● ● ● ● ● ● ● ● ● ● ● ●';
    position: absolute;
    top: 10px;
    left: 0; right: 0;
    text-align: center;
    color: var(--victorian-pearl);
    font-size: 8px;
    letter-spacing: 8px;
    background: var(--theme-bg-primary);
    padding: 0 20px;
}

.rates-section::after, .etiquette-section::after, .theme-section-alt::after {
    content: '● ● ● ● ● ● ● ● ● ● ● ● ● ● ●';
    position: absolute;
    bottom: 10px;
    left: 0; right: 0;
    text-align: center;
    color: var(--victorian-pearl);
    font-size: 8px;
    letter-spacing: 8px;
    background: var(--theme-bg-primary);
    padding: 0 20px;
}

/* Victorian Ornate Buttons */
.basic-btn, .boudoir-btn, .btn-primary, .btn {
    background: linear-gradient(135deg, var(--boudoir-rose-gold) 0%, var(--primary-700) 100%);
    color: var(--theme-text-inverted);
    padding: 14px 28px;
    border-radius: 25px;
    font-family: 'Playfair Display', Georgia, serif;
    font-weight: 500;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    border: 2px solid var(--victorian-pearl);
    cursor: pointer;
    position: relative;
    box-shadow: 0 4px 15px rgba(184, 134, 11, 0.25), 0 0 20px rgba(184, 134, 11, 0.1);
    text-shadow: 0 1px 2px rgba(0,0,0,0.3);
}

.basic-btn::before, .boudoir-btn::before, .btn-primary::before, .btn::before {
    content: '❖';
    position: absolute;
    left: 8px;
    color: var(--victorian-pearl);
    opacity: 0.8;
}

.basic-btn::after, .boudoir-btn::after, .btn-primary::after, .btn::after {
    content: '❖';
    position: absolute;
    right: 8px;
    color: var(--victorian-pearl);
    opacity: 0.8;
}

.basic-btn:hover, .boudoir-btn:hover, .btn-primary:hover, .btn:hover {
    background: linear-gradient(135deg, var(--primary-700) 0%, var(--boudoir-burgundy) 100%);
    transform: translateY(-2px);
    color: var(--theme-text-primary);
    text-decoration: none;
    box-shadow: 0 8px 25px rgba(184, 134, 11, 0.4), 0 0 30px rgba(184, 134, 11, 0.2);
}

/* Antique Gold Leaf Effects for Premium Elements */
.rates-highlight, .premium-service, .featured-item {
    background: linear-gradient(135deg, 
        var(--victorian-antique-gold) 0%,
        var(--victorian-amber) 25%,
        var(--victorian-deep-gold) 50%,
        var(--victorian-antique-gold) 75%,
        var(--victorian-deep-gold) 100%);
    background-size: 200% 200%;
    animation: victorian-shimmer 4s ease-in-out infinite alternate;
    box-shadow: 
        0 0 20px rgba(184, 134, 11, 0.3),
        inset 0 0 20px rgba(255, 191, 0, 0.1);
    border-radius: 15px;
    padding: 1rem;
}

@keyframes victorian-shimmer {
    0% { background-position: 0% 50%; }
    100% { background-position: 100% 50%; }
}

/* Gaslight Warmth Ambiance */
.container, .main-content {
    box-shadow: 
        0 0 40px rgba(255, 191, 0, 0.2),
        0 0 80px rgba(184, 134, 11, 0.1),
        inset 0 0 40px rgba(255, 255, 240, 0.05);
    background: radial-gradient(
        ellipse at center,
        rgba(255, 191, 0, 0.08) 0%,
        transparent 60%
    );
}

/* Typography Enhancements with Victorian Elegance */
h1, h2, h3, .boudoir-heading, .theme-header, .basic-heading {
    font-family: 'Playfair Display', Georgia, serif;
    font-weight: 600;
    color: var(--theme-text-primary);
    letter-spacing: 0.02em;
    line-height: 1.2;
}

.boudoir-script, .accent-script, .subtitle {
    font-family: 'Dancing Script', cursive;
    font-weight: 500;
    color: var(--boudoir-rose-gold);
}

/* Special Victorian Table Styling */
.rates-table, table {
    border: 3px solid var(--victorian-antique-gold);
    border-radius: 15px;
    background: linear-gradient(135deg, var(--theme-bg-tertiary) 0%, var(--theme-bg-surface) 100%);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.rates-table th, table th {
    background: linear-gradient(135deg, var(--victorian-antique-gold) 0%, var(--victorian-deep-gold) 100%);
    color: var(--theme-text-inverted);
    padding: 15px;
    font-family: 'Playfair Display', serif;
    font-weight: 600;
    text-shadow: 0 1px 2px rgba(0,0,0,0.3);
}

.rates-table td, table td {
    padding: 12px 15px;
    color: var(--theme-text-primary);
    border-bottom: 1px solid var(--theme-border-metallic);
}

/* Fix Text Visibility Issues */
.rates-table .theme-text-secondary,
.rates-table .theme-text-muted,
.theme-card .theme-text-secondary,
.theme-card .theme-text-muted {
    color: var(--theme-text-primary) !important;
}

.rates-table .font-semibold,
.rates-table .font-bold,
.theme-card .font-semibold,
.theme-card .font-bold {
    color: var(--theme-text-primary) !important;
    font-weight: 600 !important;
}

.rates-table .text-2xl,
.rates-table .text-xl,
.theme-card .text-2xl,
.theme-card .text-xl {
    color: var(--theme-text-primary) !important;
}

/* Rate amount text visibility */
.rates-table .text-right,
.rates-table .font-bold.text-right,
.theme-card .text-right {
    color: var(--victorian-antique-gold) !important;
    font-weight: bold !important;
    text-shadow: 0 1px 2px rgba(0,0,0,0.5);
}
</style>`;
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