class TemplateCustomizer {
    constructor() {
        this.currentTemplate = 'modern';
        this.customizations = {};
        this.originalSettings = {};
        this.previewTimeout = null;
        this.hasUnsavedChanges = false;
        
        this.initializeEventListeners();
        this.loadTemplateCustomizations();
    }

    initializeEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Color controls
        this.initializeColorControls();
        
        // Typography controls
        this.initializeTypographyControls();
        
        // Layout controls
        this.initializeLayoutControls();
        
        // Animation controls
        this.initializeAnimationControls();
        
        // Advanced controls
        this.initializeAdvancedControls();

        // Actions
        document.getElementById('resetCustomizations').addEventListener('click', () => {
            this.resetCustomizations();
        });
        
        document.getElementById('previewChanges').addEventListener('click', () => {
            this.openPreviewModal();
        });
        
        document.getElementById('cancelCustomizations').addEventListener('click', () => {
            this.cancelCustomizations();
        });
        
        document.getElementById('saveCustomizations').addEventListener('click', () => {
            this.saveCustomizations();
        });

        // Preview modal
        document.getElementById('closeCustomizationPreview').addEventListener('click', () => {
            this.closePreviewModal();
        });

        // Prevent data loss
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = 'You have unsaved customizations. Are you sure you want to leave?';
            }
        });
    }

    initializeColorControls() {
        // Color presets
        document.querySelectorAll('.color-preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const preset = e.currentTarget.dataset.preset;
                this.applyColorPreset(preset);
            });
        });

        // Individual color inputs
        const colorInputs = ['primaryColor', 'secondaryColor', 'accentColor', 'backgroundColor'];
        colorInputs.forEach(inputId => {
            const colorPicker = document.getElementById(inputId);
            const textInput = colorPicker.nextElementSibling;
            
            colorPicker.addEventListener('change', (e) => {
                this.updateColor(inputId, e.target.value);
                textInput.value = e.target.value;
            });
            
            textInput.addEventListener('change', (e) => {
                if (this.isValidColor(e.target.value)) {
                    this.updateColor(inputId, e.target.value);
                    colorPicker.value = e.target.value;
                }
            });
        });

        // Opacity sliders
        document.querySelectorAll('.opacity-slider').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const value = e.target.value;
                const valueSpan = slider.nextElementSibling;
                valueSpan.textContent = `${value}%`;
                
                // Update color with opacity
                const colorGroup = slider.closest('.color-control-group');
                const colorType = this.getColorTypeFromGroup(colorGroup);
                this.updateColorOpacity(colorType, value / 100);
            });
        });

        // Background type selector
        document.querySelector('.background-type-select').addEventListener('change', (e) => {
            this.updateBackgroundType(e.target.value);
        });
    }

    initializeTypographyControls() {
        // Font family selector
        document.getElementById('fontFamily').addEventListener('change', (e) => {
            this.updateFontFamily(e.target.value);
            this.updateFontPreview();
        });

        // Font size sliders
        document.querySelectorAll('.size-slider').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const value = e.target.value;
                const valueSpan = slider.nextElementSibling;
                valueSpan.textContent = `${value}px`;
                
                const sizeType = this.getSizeTypeFromSlider(slider);
                this.updateFontSize(sizeType, value);
            });
        });

        // Line height and letter spacing
        document.querySelector('.line-height-select').addEventListener('change', (e) => {
            this.updateLineHeight(e.target.value);
        });

        document.querySelector('.letter-spacing-select').addEventListener('change', (e) => {
            this.updateLetterSpacing(e.target.value);
        });
    }

    initializeLayoutControls() {
        // Container width
        document.querySelector('.container-width-select').addEventListener('change', (e) => {
            this.updateContainerWidth(e.target.value);
        });

        // Spacing controls
        document.querySelectorAll('.spacing-slider').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const value = e.target.value;
                const valueSpan = slider.nextElementSibling;
                valueSpan.textContent = `${value}px`;
                
                const spacingType = this.getSpacingTypeFromSlider(slider);
                this.updateSpacing(spacingType, value);
            });
        });

        // Border radius
        document.querySelectorAll('.radius-preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const radius = e.currentTarget.dataset.radius;
                this.updateBorderRadius(radius);
                this.updateRadiusPresetSelection(btn);
            });
        });

        document.querySelector('.radius-slider').addEventListener('input', (e) => {
            const value = e.target.value;
            const valueSpan = e.target.nextElementSibling;
            valueSpan.textContent = `${value}px`;
            this.updateBorderRadius(value);
        });
    }

    initializeAnimationControls() {
        // Animation speed
        document.querySelector('.animation-speed-select').addEventListener('change', (e) => {
            this.updateAnimationSpeed(e.target.value);
        });

        // Hover effects
        document.querySelectorAll('.effect-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const effectType = this.getEffectTypeFromCheckbox(checkbox);
                this.updateHoverEffect(effectType, e.target.checked);
            });
        });

        // Page transitions
        document.querySelector('.transition-type-select').addEventListener('change', (e) => {
            this.updatePageTransition(e.target.value);
        });
    }

    initializeAdvancedControls() {
        // Custom CSS
        const customCSSTextarea = document.getElementById('customCSS');
        customCSSTextarea.addEventListener('input', (e) => {
            clearTimeout(this.cssValidationTimeout);
            this.cssValidationTimeout = setTimeout(() => {
                this.updateCustomCSS(e.target.value);
            }, 500);
        });

        // CSS tools
        document.querySelector('.css-tool-btn[title="Format CSS"]').addEventListener('click', () => {
            this.formatCustomCSS();
        });

        document.querySelector('.css-tool-btn[title="Validate CSS"]').addEventListener('click', () => {
            this.validateCustomCSS();
        });

        // Feature toggles
        document.querySelectorAll('.feature-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const featureType = this.getFeatureTypeFromCheckbox(checkbox);
                this.updateFeatureToggle(featureType, e.target.checked);
            });
        });

        // Performance settings
        document.querySelectorAll('.performance-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const settingType = this.getPerformanceSettingFromCheckbox(checkbox);
                this.updatePerformanceSetting(settingType, e.target.checked);
            });
        });
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}Tab`);
        });
    }

    applyColorPreset(preset) {
        const presets = {
            default: {
                primary: '#6366f1',
                secondary: '#06b6d4', 
                accent: '#8b5cf6',
                background: '#ffffff'
            },
            warm: {
                primary: '#ea580c',
                secondary: '#dc2626',
                accent: '#ec4899',
                background: '#fef7f0'
            },
            cool: {
                primary: '#0891b2',
                secondary: '#3b82f6',
                accent: '#8b5cf6',
                background: '#f0f9ff'
            },
            monochrome: {
                primary: '#1f2937',
                secondary: '#4b5563',
                accent: '#6b7280',
                background: '#f9fafb'
            }
        };

        const colors = presets[preset];
        if (colors) {
            Object.entries(colors).forEach(([type, color]) => {
                this.updateColor(`${type}Color`, color);
                const input = document.getElementById(`${type}Color`);
                const textInput = input.nextElementSibling;
                input.value = color;
                textInput.value = color;
            });

            // Update preset selection
            document.querySelectorAll('.color-preset-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.preset === preset);
            });
        }
    }

    updateColor(colorType, value) {
        if (!this.customizations.colors) {
            this.customizations.colors = {};
        }
        
        this.customizations.colors[colorType] = value;
        this.markAsChanged();
        this.queuePreviewUpdate();
    }

    updateColorOpacity(colorType, opacity) {
        if (!this.customizations.colors) {
            this.customizations.colors = {};
        }
        
        if (!this.customizations.colors[colorType + 'Opacity']) {
            this.customizations.colors[colorType + 'Opacity'] = {};
        }
        
        this.customizations.colors[colorType + 'Opacity'] = opacity;
        this.markAsChanged();
        this.queuePreviewUpdate();
    }

    updateBackgroundType(type) {
        if (!this.customizations.colors) {
            this.customizations.colors = {};
        }
        
        this.customizations.colors.backgroundType = type;
        this.markAsChanged();
        this.queuePreviewUpdate();
    }

    updateFontFamily(family) {
        if (!this.customizations.typography) {
            this.customizations.typography = {};
        }
        
        this.customizations.typography.fontFamily = family;
        this.markAsChanged();
        this.queuePreviewUpdate();
    }

    updateFontPreview() {
        const fontFamily = this.customizations.typography?.fontFamily || 'inter';
        const previewText = document.querySelector('.preview-text');
        
        const fontMap = {
            inter: '"Inter", sans-serif',
            playfair: '"Playfair Display", serif',
            roboto: '"Roboto", sans-serif',
            merriweather: '"Merriweather", serif',
            montserrat: '"Montserrat", sans-serif',
            lora: '"Lora", serif'
        };
        
        previewText.style.fontFamily = fontMap[fontFamily] || fontMap.inter;
    }

    updateFontSize(sizeType, value) {
        if (!this.customizations.typography) {
            this.customizations.typography = {};
        }
        
        if (!this.customizations.typography.sizes) {
            this.customizations.typography.sizes = {};
        }
        
        this.customizations.typography.sizes[sizeType] = value + 'px';
        this.markAsChanged();
        this.queuePreviewUpdate();
    }

    updateLineHeight(value) {
        if (!this.customizations.typography) {
            this.customizations.typography = {};
        }
        
        this.customizations.typography.lineHeight = value;
        this.markAsChanged();
        this.queuePreviewUpdate();
    }

    updateLetterSpacing(value) {
        if (!this.customizations.typography) {
            this.customizations.typography = {};
        }
        
        this.customizations.typography.letterSpacing = value;
        this.markAsChanged();
        this.queuePreviewUpdate();
    }

    updateContainerWidth(width) {
        if (!this.customizations.layout) {
            this.customizations.layout = {};
        }
        
        this.customizations.layout.containerWidth = width;
        this.markAsChanged();
        this.queuePreviewUpdate();
    }

    updateSpacing(spacingType, value) {
        if (!this.customizations.layout) {
            this.customizations.layout = {};
        }
        
        if (!this.customizations.layout.spacing) {
            this.customizations.layout.spacing = {};
        }
        
        this.customizations.layout.spacing[spacingType] = value + 'px';
        this.markAsChanged();
        this.queuePreviewUpdate();
    }

    updateBorderRadius(value) {
        if (!this.customizations.layout) {
            this.customizations.layout = {};
        }
        
        this.customizations.layout.borderRadius = value + 'px';
        this.markAsChanged();
        this.queuePreviewUpdate();
        
        // Update slider value
        document.querySelector('.radius-slider').value = value;
        document.querySelector('.radius-value').textContent = value + 'px';
    }

    updateRadiusPresetSelection(selectedBtn) {
        document.querySelectorAll('.radius-preset-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        selectedBtn.classList.add('active');
    }

    updateAnimationSpeed(speed) {
        if (!this.customizations.animations) {
            this.customizations.animations = {};
        }
        
        this.customizations.animations.speed = speed;
        this.markAsChanged();
        this.queuePreviewUpdate();
    }

    updateHoverEffect(effectType, enabled) {
        if (!this.customizations.animations) {
            this.customizations.animations = {};
        }
        
        if (!this.customizations.animations.hoverEffects) {
            this.customizations.animations.hoverEffects = {};
        }
        
        this.customizations.animations.hoverEffects[effectType] = enabled;
        this.markAsChanged();
        this.queuePreviewUpdate();
    }

    updatePageTransition(transition) {
        if (!this.customizations.animations) {
            this.customizations.animations = {};
        }
        
        this.customizations.animations.pageTransition = transition;
        this.markAsChanged();
        this.queuePreviewUpdate();
    }

    updateCustomCSS(css) {
        if (!this.customizations.advanced) {
            this.customizations.advanced = {};
        }
        
        this.customizations.advanced.customCSS = css;
        this.markAsChanged();
        this.queuePreviewUpdate();
    }

    updateFeatureToggle(featureType, enabled) {
        if (!this.customizations.advanced) {
            this.customizations.advanced = {};
        }
        
        if (!this.customizations.advanced.features) {
            this.customizations.advanced.features = {};
        }
        
        this.customizations.advanced.features[featureType] = enabled;
        this.markAsChanged();
        this.queuePreviewUpdate();
    }

    updatePerformanceSetting(settingType, enabled) {
        if (!this.customizations.advanced) {
            this.customizations.advanced = {};
        }
        
        if (!this.customizations.advanced.performance) {
            this.customizations.advanced.performance = {};
        }
        
        this.customizations.advanced.performance[settingType] = enabled;
        this.markAsChanged();
    }

    // Helper methods for extracting types from DOM elements
    getColorTypeFromGroup(group) {
        const label = group.querySelector('.color-label').textContent.toLowerCase().replace(' ', '');
        return label + 'Color';
    }

    getSizeTypeFromSlider(slider) {
        const label = slider.closest('.size-control').querySelector('.size-label').textContent.toLowerCase();
        return label.replace(' ', '');
    }

    getSpacingTypeFromSlider(slider) {
        const label = slider.closest('.spacing-control').querySelector('.spacing-label').textContent.toLowerCase();
        return label.replace(' ', '').replace(/\s/g, '');
    }

    getEffectTypeFromCheckbox(checkbox) {
        const label = checkbox.closest('.effect-toggle').querySelector('.toggle-label').textContent.toLowerCase();
        return label.replace(' ', '').replace(/\s/g, '');
    }

    getFeatureTypeFromCheckbox(checkbox) {
        const label = checkbox.closest('.feature-toggle').querySelector('.feature-toggle-label').textContent.toLowerCase();
        return label.replace(' ', '').replace(/\s/g, '');
    }

    getPerformanceSettingFromCheckbox(checkbox) {
        const label = checkbox.closest('.performance-toggle').querySelector('.performance-label').textContent.toLowerCase();
        return label.replace(' ', '').replace(/\s/g, '');
    }

    // Utility methods
    isValidColor(color) {
        const hexPattern = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
        return hexPattern.test(color);
    }

    formatCustomCSS() {
        const textarea = document.getElementById('customCSS');
        let css = textarea.value;
        
        // Basic CSS formatting
        css = css.replace(/\{/g, ' {\n    ');
        css = css.replace(/;/g, ';\n    ');
        css = css.replace(/\}/g, '\n}\n\n');
        css = css.replace(/,/g, ',\n');
        
        textarea.value = css.trim();
        this.updateCustomCSS(css.trim());
    }

    validateCustomCSS() {
        const css = document.getElementById('customCSS').value;
        // Basic CSS validation (in production, you might use a proper CSS parser)
        const errors = [];
        
        const braces = css.split('').filter(char => char === '{' || char === '}');
        let openBraces = 0;
        
        for (const brace of braces) {
            if (brace === '{') openBraces++;
            else openBraces--;
            
            if (openBraces < 0) {
                errors.push('Mismatched closing brace');
                break;
            }
        }
        
        if (openBraces > 0) {
            errors.push('Missing closing brace(s)');
        }
        
        if (errors.length > 0) {
            this.showNotification(`CSS Validation Errors: ${errors.join(', ')}`, 'error');
        } else {
            this.showNotification('CSS is valid', 'success');
        }
    }

    markAsChanged() {
        this.hasUnsavedChanges = true;
        
        // Update UI to show unsaved changes
        const saveBtn = document.getElementById('saveCustomizations');
        saveBtn.textContent = 'Save Changes*';
        saveBtn.classList.add('bg-orange-600', 'hover:bg-orange-700');
        saveBtn.classList.remove('bg-green-600', 'hover:bg-green-700');
    }

    queuePreviewUpdate() {
        clearTimeout(this.previewTimeout);
        this.previewTimeout = setTimeout(() => {
            this.updateLivePreview();
        }, 300);
    }

    updateLivePreview() {
        // Generate preview CSS from customizations
        const previewCSS = this.generatePreviewCSS();
        
        // Inject into preview frame if it exists
        const previewFrame = document.getElementById('customizationPreviewFrame');
        if (previewFrame && previewFrame.contentDocument) {
            this.injectPreviewStyles(previewFrame.contentDocument, previewCSS);
        }
    }

    generatePreviewCSS() {
        let css = ':root {\n';
        
        // Colors
        if (this.customizations.colors) {
            const colors = this.customizations.colors;
            if (colors.primaryColor) css += `  --primary-color: ${colors.primaryColor};\n`;
            if (colors.secondaryColor) css += `  --secondary-color: ${colors.secondaryColor};\n`;
            if (colors.accentColor) css += `  --accent-color: ${colors.accentColor};\n`;
            if (colors.backgroundColor) css += `  --bg-color: ${colors.backgroundColor};\n`;
        }
        
        // Typography
        if (this.customizations.typography) {
            const typo = this.customizations.typography;
            if (typo.fontFamily) css += `  --font-family: var(--font-${typo.fontFamily});\n`;
            if (typo.lineHeight) css += `  --line-height: ${typo.lineHeight};\n`;
            if (typo.letterSpacing) css += `  --letter-spacing: ${typo.letterSpacing};\n`;
            
            if (typo.sizes) {
                Object.entries(typo.sizes).forEach(([type, size]) => {
                    css += `  --font-size-${type}: ${size};\n`;
                });
            }
        }
        
        // Layout
        if (this.customizations.layout) {
            const layout = this.customizations.layout;
            if (layout.containerWidth) css += `  --container-width: var(--width-${layout.containerWidth});\n`;
            if (layout.borderRadius) css += `  --border-radius: ${layout.borderRadius};\n`;
            
            if (layout.spacing) {
                Object.entries(layout.spacing).forEach(([type, spacing]) => {
                    css += `  --spacing-${type}: ${spacing};\n`;
                });
            }
        }
        
        css += '}\n\n';
        
        // Custom CSS
        if (this.customizations.advanced?.customCSS) {
            css += this.customizations.advanced.customCSS + '\n';
        }
        
        return css;
    }

    injectPreviewStyles(doc, css) {
        let styleElement = doc.getElementById('preview-styles');
        if (!styleElement) {
            styleElement = doc.createElement('style');
            styleElement.id = 'preview-styles';
            doc.head.appendChild(styleElement);
        }
        
        styleElement.textContent = css;
    }

    async loadTemplateCustomizations() {
        try {
            const response = await fetch(`/api/template-customizations/${this.currentTemplate}`);
            const result = await response.json();
            
            if (result.success) {
                this.customizations = result.data.customizations || {};
                this.originalSettings = { ...this.customizations };
                this.populateFormFromCustomizations();
            }
        } catch (error) {
            console.error('Failed to load customizations:', error);
        }
    }

    populateFormFromCustomizations() {
        // Populate color controls
        if (this.customizations.colors) {
            Object.entries(this.customizations.colors).forEach(([key, value]) => {
                if (key.endsWith('Color')) {
                    const input = document.getElementById(key);
                    const textInput = input?.nextElementSibling;
                    if (input) {
                        input.value = value;
                        if (textInput) textInput.value = value;
                    }
                }
            });
        }
        
        // Populate other form fields based on customizations...
        // This would be extensive for all controls
    }

    openPreviewModal() {
        const modal = document.getElementById('customizationPreviewModal');
        const frame = document.getElementById('customizationPreviewFrame');
        
        // Load current template page in preview
        frame.src = `/preview/${this.currentTemplate}/home?customize=true`;
        
        modal.classList.remove('hidden');
        
        // Inject current customizations when frame loads
        frame.onload = () => {
            const css = this.generatePreviewCSS();
            this.injectPreviewStyles(frame.contentDocument, css);
        };
    }

    closePreviewModal() {
        document.getElementById('customizationPreviewModal').classList.add('hidden');
        document.getElementById('customizationPreviewFrame').src = '';
    }

    async saveCustomizations() {
        try {
            const response = await fetch('/api/template-customizations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    templateId: this.currentTemplate,
                    customizations: this.customizations
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.hasUnsavedChanges = false;
                this.originalSettings = { ...this.customizations };
                this.resetSaveButtonState();
                this.showNotification('Customizations saved successfully', 'success');
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Save failed:', error);
            this.showNotification(`Failed to save: ${error.message}`, 'error');
        }
    }

    resetCustomizations() {
        if (confirm('Are you sure you want to reset all customizations? This action cannot be undone.')) {
            this.customizations = {};
            this.populateFormFromCustomizations();
            this.markAsChanged();
            this.showNotification('Customizations reset', 'info');
        }
    }

    cancelCustomizations() {
        if (this.hasUnsavedChanges) {
            if (confirm('You have unsaved changes. Are you sure you want to cancel?')) {
                this.customizations = { ...this.originalSettings };
                this.populateFormFromCustomizations();
                this.hasUnsavedChanges = false;
                this.resetSaveButtonState();
            }
        }
    }

    resetSaveButtonState() {
        const saveBtn = document.getElementById('saveCustomizations');
        saveBtn.textContent = 'Save Changes';
        saveBtn.classList.remove('bg-orange-600', 'hover:bg-orange-700');
        saveBtn.classList.add('bg-green-600', 'hover:bg-green-700');
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm transition-all transform ${
            type === 'success' ? 'bg-green-500 text-white' :
            type === 'error' ? 'bg-red-500 text-white' :
            'bg-blue-500 text-white'
        }`;
        
        notification.innerHTML = `
            <div class="flex items-center justify-between">
                <p class="mr-2">${message}</p>
                <button onclick="this.parentElement.parentElement.remove()" class="text-white hover:text-gray-200">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
}

// Initialize the template customizer when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.templateCustomizer = new TemplateCustomizer();
});