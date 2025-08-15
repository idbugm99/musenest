/**
 * Theme Configuration Validator
 * Provides runtime validation for theme gallery configurations
 * using the ThemeConfigSchema.json
 */

const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const fs = require('fs').promises;
const path = require('path');

class ThemeConfigValidator {
    constructor() {
        this.ajv = new Ajv({ 
            allErrors: true, 
            verbose: true,
            strict: false // Allow additional properties in some cases
        });
        addFormats(this.ajv);
        this.schema = null;
        this.validate = null;
    }

    /**
     * Initialize the validator by loading the schema
     */
    async initialize() {
        try {
            const schemaPath = path.join(__dirname, '../../schemas/ThemeConfigSchema.json');
            const schemaContent = await fs.readFile(schemaPath, 'utf8');
            this.schema = JSON.parse(schemaContent);
            this.validate = this.ajv.compile(this.schema);
            
            console.log('✅ ThemeConfigValidator initialized with schema v' + this.schema.version);
            return { success: true };
        } catch (error) {
            console.error('❌ Failed to initialize ThemeConfigValidator:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Validate a theme configuration object
     * @param {object} config - Theme configuration to validate
     * @param {string} themeName - Theme name for error context
     * @returns {object} Validation result with detailed errors
     */
    validateConfig(config, themeName = 'unknown') {
        if (!this.validate) {
            throw new Error('ThemeConfigValidator not initialized. Call initialize() first.');
        }

        const isValid = this.validate(config);
        
        const result = {
            valid: isValid,
            themeName: themeName,
            errors: [],
            warnings: [],
            config: isValid ? this.normalizeConfig(config) : null
        };

        if (!isValid) {
            // Process validation errors with context
            result.errors = this.validate.errors.map(error => {
                return this.formatValidationError(error, themeName);
            });

            // Add critical error categories
            result.criticalErrors = result.errors.filter(error => 
                error.severity === 'critical'
            );
        }

        // Add warnings for best practices
        if (isValid) {
            result.warnings = this.checkBestPractices(config, themeName);
        }

        return result;
    }

    /**
     * Format a single validation error with context and suggestions
     * @param {object} error - AJV error object
     * @param {string} themeName - Theme name for context
     * @returns {object} Formatted error with suggestions
     */
    formatValidationError(error, themeName) {
        const formattedError = {
            field: error.instancePath || error.schemaPath,
            message: error.message,
            severity: this.getErrorSeverity(error),
            value: error.data,
            allowedValues: error.schema,
            suggestion: this.getErrorSuggestion(error),
            theme: themeName
        };

        // Add specific handling for common error types
        switch (error.keyword) {
            case 'required':
                formattedError.suggestion = `Add the required field '${error.params.missingProperty}' to your ${themeName} theme configuration.`;
                formattedError.severity = 'critical';
                break;
                
            case 'pattern':
                formattedError.suggestion = `The value '${error.data}' doesn't match the required pattern. Use only lowercase letters, numbers, hyphens, and underscores.`;
                break;
                
            case 'enum':
                formattedError.suggestion = `Use one of the allowed values: ${error.schema.join(', ')}`;
                break;
                
            case 'additionalProperties':
                formattedError.suggestion = `Remove the unknown property '${error.params.additionalProperty}' or check for typos.`;
                formattedError.severity = 'warning';
                break;
        }

        return formattedError;
    }

    /**
     * Determine error severity based on error type
     * @param {object} error - AJV error object
     * @returns {string} Severity level
     */
    getErrorSeverity(error) {
        const criticalKeywords = ['required', 'type', 'const'];
        const warningKeywords = ['additionalProperties'];
        
        if (criticalKeywords.includes(error.keyword)) {
            return 'critical';
        } else if (warningKeywords.includes(error.keyword)) {
            return 'warning';
        } else {
            return 'error';
        }
    }

    /**
     * Generate helpful suggestions for common errors
     * @param {object} error - AJV error object
     * @returns {string} Suggestion text
     */
    getErrorSuggestion(error) {
        const suggestions = {
            'required': 'This field is required for the theme to function properly.',
            'pattern': 'Check the format requirements for this field.',
            'enum': 'Use one of the predefined values.',
            'type': 'Check the data type - expecting ' + error.schema,
            'additionalProperties': 'This property is not recognized in the schema.'
        };

        return suggestions[error.keyword] || 'Check the schema documentation for requirements.';
    }

    /**
     * Check best practices and provide warnings
     * @param {object} config - Valid theme configuration
     * @param {string} themeName - Theme name
     * @returns {array} Array of warning objects
     */
    checkBestPractices(config, themeName) {
        const warnings = [];

        // Check if displayName is provided
        if (!config.displayName) {
            warnings.push({
                type: 'missing_display_name',
                message: 'Consider adding a displayName for better admin UI experience',
                suggestion: `Add "displayName": "Your Theme Name" to the ${themeName} configuration`
            });
        }

        // Check if animations are defined
        if (!config.animations || Object.keys(config.animations).length === 0) {
            warnings.push({
                type: 'missing_animations',
                message: 'No animations defined - theme may feel less polished',
                suggestion: 'Consider defining hover and transition animations'
            });
        }

        // Check for accessibility considerations
        if (config.customizations?.enableAnimations === true && 
            !config.customizations?.respectReducedMotion) {
            warnings.push({
                type: 'accessibility_concern',
                message: 'Animations enabled without reduced motion consideration',
                suggestion: 'Consider respecting prefers-reduced-motion CSS media query'
            });
        }

        // Check CSS class naming consistency
        if (config.cssClasses) {
            const prefix = config.prefix;
            const inconsistentClasses = Object.entries(config.cssClasses)
                .filter(([key, value]) => !value.startsWith(prefix + '-'))
                .map(([key]) => key);

            if (inconsistentClasses.length > 0) {
                warnings.push({
                    type: 'naming_consistency',
                    message: `CSS classes don't follow prefix convention: ${inconsistentClasses.join(', ')}`,
                    suggestion: `Consider prefixing all CSS classes with '${prefix}-' for consistency`
                });
            }
        }

        return warnings;
    }

    /**
     * Normalize and apply defaults to a valid configuration
     * @param {object} config - Valid theme configuration
     * @returns {object} Normalized configuration with defaults applied
     */
    normalizeConfig(config) {
        const normalized = { ...config };

        // Apply default icons if not provided
        if (!normalized.icons) {
            normalized.icons = {};
        }
        
        const defaultIcons = {
            close: '✕',
            fullscreen: '⤢',
            prev: '‹',
            next: '›',
            grid: '⊞',
            masonry: '⊡',
            carousel: '⊲'
        };

        Object.entries(defaultIcons).forEach(([key, defaultValue]) => {
            if (!normalized.icons[key]) {
                normalized.icons[key] = defaultValue;
            }
        });

        // Apply default breakpoints if not provided
        if (!normalized.breakpoints) {
            normalized.breakpoints = {
                sm: 576,
                md: 768,
                lg: 992,
                xl: 1200
            };
        }

        // Apply default layout configurations
        if (!normalized.layouts) {
            normalized.layouts = {};
        }

        if (!normalized.layouts.grid) {
            normalized.layouts.grid = {
                defaultColumns: { sm: 2, md: 3, lg: 4 },
                aspectRatio: '1:1'
            };
        }

        if (!normalized.layouts.masonry) {
            normalized.layouts.masonry = {
                columnWidth: 280,
                gutter: 20
            };
        }

        if (!normalized.layouts.carousel) {
            normalized.layouts.carousel = {
                autoplay: false,
                autoplaySpeed: 5000,
                slidesToShow: 1,
                infinite: true
            };
        }

        // Apply default customizations
        if (!normalized.customizations) {
            normalized.customizations = {
                enableHoverEffects: true,
                enableAnimations: true,
                enableParallax: false,
                enableBlurBackground: false,
                colorScheme: 'light'
            };
        }

        // Apply default assets
        if (!normalized.assets) {
            normalized.assets = {
                cssFile: 'style.css'
            };
        }

        return normalized;
    }

    /**
     * Validate multiple theme configurations at once
     * @param {object} configs - Object with theme names as keys and configs as values
     * @returns {object} Validation results for each theme
     */
    validateMultiple(configs) {
        const results = {};
        
        Object.entries(configs).forEach(([themeName, config]) => {
            results[themeName] = this.validateConfig(config, themeName);
        });

        // Aggregate statistics
        const stats = {
            total: Object.keys(configs).length,
            valid: Object.values(results).filter(r => r.valid).length,
            invalid: Object.values(results).filter(r => !r.valid).length,
            totalErrors: Object.values(results).reduce((sum, r) => sum + r.errors.length, 0),
            totalWarnings: Object.values(results).reduce((sum, r) => sum + r.warnings.length, 0)
        };

        return {
            results,
            stats,
            summary: `${stats.valid}/${stats.total} themes valid, ${stats.totalErrors} errors, ${stats.totalWarnings} warnings`
        };
    }

    /**
     * Load and validate a theme configuration file
     * @param {string} configPath - Path to theme configuration JSON file
     * @param {string} themeName - Theme name for error context
     * @returns {object} Validation result
     */
    async validateFile(configPath, themeName) {
        try {
            const configContent = await fs.readFile(configPath, 'utf8');
            const config = JSON.parse(configContent);
            return this.validateConfig(config, themeName);
        } catch (error) {
            return {
                valid: false,
                themeName,
                errors: [{
                    field: 'file',
                    message: `Failed to load configuration file: ${error.message}`,
                    severity: 'critical',
                    suggestion: 'Check that the file exists and contains valid JSON'
                }],
                warnings: [],
                config: null
            };
        }
    }
}

module.exports = ThemeConfigValidator;