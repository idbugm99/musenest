const fs = require('fs').promises;
const path = require('path');
const templateManager = require('./templateManager');

class TemplateCustomizationService {
    constructor() {
        this.customizationCache = new Map();
        this.compiledCSSCache = new Map();
        this.presets = this.loadPresets();
    }

    /**
     * Get customizations for a specific model and template
     */
    async getCustomizations(modelId, templateId) {
        const cacheKey = `${modelId}-${templateId}`;
        
        if (this.customizationCache.has(cacheKey)) {
            return this.customizationCache.get(cacheKey);
        }
        
        try {
            // In production, this would query the database
            const customizations = await this.loadCustomizationsFromDatabase(modelId, templateId);
            
            // Cache the result
            this.customizationCache.set(cacheKey, customizations);
            
            return customizations;
        } catch (error) {
            console.error('Failed to get customizations:', error);
            return this.getDefaultCustomizations(templateId);
        }
    }

    /**
     * Save customizations for a specific model and template
     */
    async saveCustomizations(modelId, templateId, customizations) {
        try {
            // Validate customizations
            const validation = this.validateCustomizations(customizations);
            if (!validation.valid) {
                throw new Error(`Invalid customizations: ${validation.errors.join(', ')}`);
            }

            // Compile to CSS
            const compiledCSS = await this.compileCustomizations(templateId, customizations);
            
            // Save to database
            await this.saveCustomizationsToDatabase(modelId, templateId, customizations, compiledCSS);
            
            // Update cache
            const cacheKey = `${modelId}-${templateId}`;
            const customizationData = {
                customizations,
                compiledCSS,
                lastModified: new Date().toISOString()
            };
            
            this.customizationCache.set(cacheKey, customizationData);
            this.compiledCSSCache.set(cacheKey, compiledCSS);
            
            return customizationData;
        } catch (error) {
            console.error('Failed to save customizations:', error);
            throw error;
        }
    }

    /**
     * Get compiled CSS for customizations
     */
    async getCompiledCSS(modelId, templateId) {
        const cacheKey = `${modelId}-${templateId}`;
        
        if (this.compiledCSSCache.has(cacheKey)) {
            return this.compiledCSSCache.get(cacheKey);
        }
        
        const customizationData = await this.getCustomizations(modelId, templateId);
        
        if (customizationData && customizationData.compiledCSS) {
            this.compiledCSSCache.set(cacheKey, customizationData.compiledCSS);
            return customizationData.compiledCSS;
        }
        
        // Generate CSS from customizations
        const css = await this.compileCustomizations(templateId, customizationData?.customizations || {});
        this.compiledCSSCache.set(cacheKey, css);
        
        return css;
    }

    /**
     * Compile customizations to CSS
     */
    async compileCustomizations(templateId, customizations) {
        const templateInfo = await templateManager.getTemplateInfo(templateId);
        let css = '';
        
        // Add CSS custom properties
        css += this.generateCSSCustomProperties(customizations, templateInfo);
        
        // Add component styles
        css += this.generateComponentStyles(templateId, customizations);
        
        // Add responsive styles
        css += this.generateResponsiveStyles(customizations);
        
        // Add custom CSS if provided
        if (customizations.advanced?.customCSS) {
            css += '\n/* Custom CSS */\n';
            css += customizations.advanced.customCSS + '\n';
        }
        
        return css;
    }

    generateCSSCustomProperties(customizations, templateInfo) {
        let css = ':root {\n';
        
        // Color properties
        if (customizations.colors) {
            const colors = customizations.colors;
            
            // Primary colors
            if (colors.primaryColor) {
                css += `  --color-primary: ${colors.primaryColor};\n`;
                css += `  --color-primary-rgb: ${this.hexToRgb(colors.primaryColor)};\n`;
            }
            
            if (colors.secondaryColor) {
                css += `  --color-secondary: ${colors.secondaryColor};\n`;
                css += `  --color-secondary-rgb: ${this.hexToRgb(colors.secondaryColor)};\n`;
            }
            
            if (colors.accentColor) {
                css += `  --color-accent: ${colors.accentColor};\n`;
                css += `  --color-accent-rgb: ${this.hexToRgb(colors.accentColor)};\n`;
            }
            
            if (colors.backgroundColor) {
                css += `  --color-background: ${colors.backgroundColor};\n`;
            }
            
            // Generate color variations (lighter/darker)
            if (colors.primaryColor) {
                css += `  --color-primary-light: ${this.lightenColor(colors.primaryColor, 20)};\n`;
                css += `  --color-primary-dark: ${this.darkenColor(colors.primaryColor, 20)};\n`;
            }
        }
        
        // Typography properties
        if (customizations.typography) {
            const typography = customizations.typography;
            
            if (typography.fontFamily) {
                css += `  --font-family-primary: ${this.getFontFamilyCSS(typography.fontFamily)};\n`;
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
        
        // Layout properties
        if (customizations.layout) {
            const layout = customizations.layout;
            
            if (layout.containerWidth) {
                css += `  --container-max-width: ${this.getContainerWidth(layout.containerWidth)};\n`;
            }
            
            if (layout.borderRadius) {
                css += `  --border-radius-base: ${layout.borderRadius};\n`;
                css += `  --border-radius-sm: calc(${layout.borderRadius} * 0.5);\n`;
                css += `  --border-radius-lg: calc(${layout.borderRadius} * 1.5);\n`;
            }
            
            if (layout.spacing) {
                Object.entries(layout.spacing).forEach(([type, spacing]) => {
                    css += `  --spacing-${type}: ${spacing};\n`;
                });
            }
        }
        
        // Animation properties
        if (customizations.animations) {
            const animations = customizations.animations;
            
            if (animations.speed) {
                css += `  --animation-duration: ${this.getAnimationDuration(animations.speed)};\n`;
            }
            
            if (animations.pageTransition) {
                css += `  --page-transition: ${animations.pageTransition};\n`;
            }
        }
        
        css += '}\n\n';
        return css;
    }

    generateComponentStyles(templateId, customizations) {
        let css = '';
        
        // Button styles
        css += this.generateButtonStyles(templateId, customizations);
        
        // Card styles
        css += this.generateCardStyles(templateId, customizations);
        
        // Navigation styles
        css += this.generateNavigationStyles(templateId, customizations);
        
        // Form styles
        css += this.generateFormStyles(templateId, customizations);
        
        return css;
    }

    generateButtonStyles(templateId, customizations) {
        let css = '/* Button Styles */\n';
        
        css += `.${templateId}-btn-primary {\n`;
        css += '  background-color: var(--color-primary);\n';
        css += '  border-color: var(--color-primary);\n';
        css += '  color: white;\n';
        css += '  border-radius: var(--border-radius-base, 0.375rem);\n';
        css += '  transition: all var(--animation-duration, 0.3s) ease;\n';
        css += '}\n\n';
        
        css += `.${templateId}-btn-primary:hover {\n`;
        css += '  background-color: var(--color-primary-dark);\n';
        css += '  border-color: var(--color-primary-dark);\n';
        css += '  transform: translateY(-1px);\n';
        css += '}\n\n';
        
        css += `.${templateId}-btn-secondary {\n`;
        css += '  background-color: var(--color-secondary);\n';
        css += '  border-color: var(--color-secondary);\n';
        css += '  color: white;\n';
        css += '  border-radius: var(--border-radius-base, 0.375rem);\n';
        css += '  transition: all var(--animation-duration, 0.3s) ease;\n';
        css += '}\n\n';
        
        return css;
    }

    generateCardStyles(templateId, customizations) {
        let css = '/* Card Styles */\n';
        
        css += `.${templateId}-card {\n`;
        css += '  background-color: var(--color-background, #ffffff);\n';
        css += '  border-radius: var(--border-radius-base, 0.5rem);\n';
        css += '  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);\n';
        css += '  transition: all var(--animation-duration, 0.3s) ease;\n';
        css += '}\n\n';
        
        if (customizations.animations?.hoverEffects?.cardHover !== false) {
            css += `.${templateId}-card:hover {\n`;
            css += '  transform: translateY(-2px);\n';
            css += '  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06);\n';
            css += '}\n\n';
        }
        
        return css;
    }

    generateNavigationStyles(templateId, customizations) {
        let css = '/* Navigation Styles */\n';
        
        css += `.${templateId}-nav {\n`;
        css += '  background-color: var(--color-background, #ffffff);\n';
        css += '}\n\n';
        
        css += `.${templateId}-nav-link {\n`;
        css += '  color: var(--color-primary);\n';
        css += '  transition: color var(--animation-duration, 0.3s) ease;\n';
        css += '}\n\n';
        
        css += `.${templateId}-nav-link:hover {\n`;
        css += '  color: var(--color-primary-dark);\n';
        css += '}\n\n';
        
        css += `.${templateId}-nav-link.active {\n`;
        css += '  color: var(--color-accent);\n';
        css += '  font-weight: 600;\n';
        css += '}\n\n';
        
        return css;
    }

    generateFormStyles(templateId, customizations) {
        let css = '/* Form Styles */\n';
        
        css += `.${templateId}-input {\n`;
        css += '  border-color: var(--color-secondary, #d1d5db);\n';
        css += '  border-radius: var(--border-radius-base, 0.375rem);\n';
        css += '  transition: border-color var(--animation-duration, 0.3s) ease;\n';
        css += '}\n\n';
        
        css += `.${templateId}-input:focus {\n`;
        css += '  border-color: var(--color-primary);\n';
        css += '  box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.1);\n';
        css += '}\n\n';
        
        return css;
    }

    generateResponsiveStyles(customizations) {
        let css = '/* Responsive Styles */\n';
        
        // Mobile styles
        css += '@media (max-width: 768px) {\n';
        css += '  :root {\n';
        
        if (customizations.typography?.sizes) {
            Object.entries(customizations.typography.sizes).forEach(([type, size]) => {
                const mobileSize = this.calculateMobileSize(size);
                css += `    --font-size-${type}: ${mobileSize};\n`;
            });
        }
        
        if (customizations.layout?.spacing) {
            Object.entries(customizations.layout.spacing).forEach(([type, spacing]) => {
                const mobileSpacing = this.calculateMobileSpacing(spacing);
                css += `    --spacing-${type}: ${mobileSpacing};\n`;
            });
        }
        
        css += '  }\n';
        css += '}\n\n';
        
        return css;
    }

    validateCustomizations(customizations) {
        const errors = [];
        
        // Validate structure
        if (typeof customizations !== 'object') {
            errors.push('Customizations must be an object');
            return { valid: false, errors };
        }
        
        // Validate colors
        if (customizations.colors) {
            Object.entries(customizations.colors).forEach(([key, value]) => {
                if (key.endsWith('Color') && !this.isValidColor(value)) {
                    errors.push(`Invalid color value for ${key}: ${value}`);
                }
            });
        }
        
        // Validate typography
        if (customizations.typography) {
            const typography = customizations.typography;
            
            if (typography.sizes) {
                Object.entries(typography.sizes).forEach(([key, value]) => {
                    if (!this.isValidSize(value)) {
                        errors.push(`Invalid size value for ${key}: ${value}`);
                    }
                });
            }
            
            if (typography.lineHeight && !this.isValidLineHeight(typography.lineHeight)) {
                errors.push(`Invalid line height: ${typography.lineHeight}`);
            }
        }
        
        // Validate layout
        if (customizations.layout) {
            const layout = customizations.layout;
            
            if (layout.spacing) {
                Object.entries(layout.spacing).forEach(([key, value]) => {
                    if (!this.isValidSize(value)) {
                        errors.push(`Invalid spacing value for ${key}: ${value}`);
                    }
                });
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }

    // Utility methods
    isValidColor(color) {
        const hexPattern = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
        const rgbPattern = /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/;
        const rgbaPattern = /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)$/;
        const hslPattern = /^hsl\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*\)$/;
        
        return hexPattern.test(color) || rgbPattern.test(color) || 
               rgbaPattern.test(color) || hslPattern.test(color);
    }

    isValidSize(size) {
        const sizePattern = /^\d*\.?\d+(px|em|rem|%|vh|vw|ex|ch|vmin|vmax)$/;
        return sizePattern.test(size);
    }

    isValidLineHeight(lineHeight) {
        const numberPattern = /^\d*\.?\d+$/;
        return numberPattern.test(lineHeight) || this.isValidSize(lineHeight);
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? 
            `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : 
            '0, 0, 0';
    }

    lightenColor(hex, percent) {
        const num = parseInt(hex.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        
        return '#' + (0x1000000 + (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
                     (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
                     (B < 255 ? (B < 1 ? 0 : B) : 255))
                     .toString(16)
                     .slice(1);
    }

    darkenColor(hex, percent) {
        const num = parseInt(hex.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) - amt;
        const G = (num >> 8 & 0x00FF) - amt;
        const B = (num & 0x0000FF) - amt;
        
        return '#' + (0x1000000 + (R > 0 ? R : 0) * 0x10000 +
                     (G > 0 ? G : 0) * 0x100 +
                     (B > 0 ? B : 0))
                     .toString(16)
                     .slice(1);
    }

    getFontFamilyCSS(fontFamily) {
        const fontMap = {
            inter: '"Inter", sans-serif',
            playfair: '"Playfair Display", serif',
            roboto: '"Roboto", sans-serif',
            merriweather: '"Merriweather", serif',
            montserrat: '"Montserrat", sans-serif',
            lora: '"Lora", serif'
        };
        
        return fontMap[fontFamily] || fontMap.inter;
    }

    getContainerWidth(width) {
        const widthMap = {
            full: '100%',
            xl: '1280px',
            lg: '1024px',
            md: '768px'
        };
        
        return widthMap[width] || width;
    }

    getAnimationDuration(speed) {
        const speedMap = {
            fast: '0.2s',
            normal: '0.3s',
            slow: '0.5s',
            disabled: '0s'
        };
        
        return speedMap[speed] || speed;
    }

    calculateMobileSize(size) {
        const value = parseFloat(size);
        const unit = size.replace(value.toString(), '');
        
        // Reduce font sizes by 10% on mobile
        const mobileValue = Math.max(value * 0.9, value - 2);
        return mobileValue + unit;
    }

    calculateMobileSpacing(spacing) {
        const value = parseFloat(spacing);
        const unit = spacing.replace(value.toString(), '');
        
        // Reduce spacing by 20% on mobile
        const mobileValue = Math.max(value * 0.8, 8);
        return mobileValue + unit;
    }

    getDefaultCustomizations(templateId) {
        // Return default customizations for the template
        return {
            customizations: {},
            compiledCSS: '',
            lastModified: null
        };
    }

    async loadCustomizationsFromDatabase(modelId, templateId) {
        // In production, this would query the database
        // For now, return empty customizations
        return this.getDefaultCustomizations(templateId);
    }

    async saveCustomizationsToDatabase(modelId, templateId, customizations, compiledCSS) {
        // In production, this would save to the database
        console.log(`Saving customizations for model ${modelId}, template ${templateId}`);
    }

    loadPresets() {
        // Load customization presets
        return {
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
    }

    clearCache(modelId = null, templateId = null) {
        if (modelId && templateId) {
            const cacheKey = `${modelId}-${templateId}`;
            this.customizationCache.delete(cacheKey);
            this.compiledCSSCache.delete(cacheKey);
        } else {
            this.customizationCache.clear();
            this.compiledCSSCache.clear();
        }
    }
}

module.exports = new TemplateCustomizationService();