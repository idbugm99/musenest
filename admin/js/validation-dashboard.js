/**
 * Theme Validation Dashboard JavaScript
 * 
 * Handles all validation dashboard functionality including system, theme,
 * and model configuration validation with real-time feedback and editing capabilities.
 */

class ValidationDashboard {
    constructor() {
        this.config = {
            apiBaseUrl: '/api/universal-gallery',
            autoRefreshInterval: 60000, // 1 minute
            validationDebounce: 500 // 0.5 seconds
        };
        
        this.state = {
            validationResults: {
                system: null,
                themes: new Map(),
                models: new Map()
            },
            validationHistory: [],
            isValidating: false,
            currentEditor: {
                type: null,
                id: null,
                config: null
            }
        };

        this.boundHandlers = {};
        this.templates = {};
        
        this.init();
    }

    /**
     * Initialize the validation dashboard
     */
    async init() {
        try {
            this.compileTemplates();
            this.bindEvents();
            await this.loadInitialValidationData();
            this.startAutoRefresh();
            console.log('✅ Validation Dashboard initialized');
        } catch (error) {
            console.error('❌ Failed to initialize validation dashboard:', error);
            this.showError('Failed to initialize validation dashboard');
        }
    }

    /**
     * Compile Handlebars templates
     */
    compileTemplates() {
        // Check if Handlebars is available
        if (typeof Handlebars === 'undefined') {
            console.warn('Handlebars not available, using basic templating');
            return;
        }

        // Compile templates
        const templates = [
            'validationResultTemplate',
            'themeValidationItemTemplate', 
            'validationHistoryItemTemplate'
        ];

        templates.forEach(templateId => {
            const templateElement = document.getElementById(templateId);
            if (templateElement) {
                this.templates[templateId] = Handlebars.compile(templateElement.innerHTML);
            }
        });

        // Register Handlebars helpers
        Handlebars.registerHelper('gt', (a, b) => a > b);
        Handlebars.registerHelper('if_eq', function(a, b, opts) {
            return a === b ? opts.fn(this) : opts.inverse(this);
        });
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Main validation buttons
        document.getElementById('validateAllBtn')?.addEventListener('click', () => {
            this.validateAll();
        });

        document.getElementById('refreshValidationBtn')?.addEventListener('click', () => {
            this.refreshValidation();
        });

        // System validation
        document.getElementById('validateSystemBtn')?.addEventListener('click', () => {
            this.validateSystem();
        });

        // Theme validation
        document.getElementById('validateThemesBtn')?.addEventListener('click', () => {
            this.validateThemes();
        });

        document.getElementById('themeValidationFilter')?.addEventListener('change', (e) => {
            this.filterThemeResults(e.target.value);
        });

        // Model validation
        document.getElementById('validateModelsBtn')?.addEventListener('click', () => {
            this.validateModels();
        });

        document.getElementById('modelValidationSearch')?.addEventListener('input', (e) => {
            this.debounce(() => this.searchModelResults(e.target.value), this.config.validationDebounce)();
        });

        document.getElementById('modelValidationFilter')?.addEventListener('change', (e) => {
            this.filterModelResults(e.target.value);
        });

        // History
        document.getElementById('clearHistoryBtn')?.addEventListener('click', () => {
            this.clearValidationHistory();
        });

        // Modal events
        document.getElementById('modalCloseBtn')?.addEventListener('click', () => {
            this.closeConfigEditor();
        });

        document.getElementById('modalBackdrop')?.addEventListener('click', () => {
            this.closeConfigEditor();
        });

        document.getElementById('modalCancelBtn')?.addEventListener('click', () => {
            this.closeConfigEditor();
        });

        document.getElementById('modalSaveBtn')?.addEventListener('click', () => {
            this.saveConfiguration();
        });

        // Editor tabs
        document.querySelectorAll('.editor-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchEditorTab(e.target.dataset.editor);
            });
        });

        // JSON editor validation
        document.getElementById('jsonTextarea')?.addEventListener('input', () => {
            this.debounce(() => this.validateJsonEditor(), this.config.validationDebounce)();
        });

        // Delegate events for dynamic content
        document.addEventListener('click', (e) => {
            this.handleDynamicClicks(e);
        });
    }

    /**
     * Handle clicks on dynamically generated content
     */
    handleDynamicClicks(event) {
        const target = event.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        const type = target.dataset.type;
        const id = target.dataset.id;

        switch (action) {
            case 'edit-config':
                this.openConfigEditor(type, id);
                break;
            case 'revalidate':
                this.revalidateItem(type, id);
                break;
            case 'view-details':
                this.viewValidationDetails(id);
                break;
            case 'toggle-details':
                this.toggleDetails(target.dataset.target);
                break;
        }
    }

    /**
     * Load initial validation data
     */
    async loadInitialValidationData() {
        this.setValidationLoading(true);
        
        try {
            // Load existing validation results if any
            await this.loadValidationHistory();
            await this.refreshValidationStatus();
            
        } catch (error) {
            console.error('Failed to load validation data:', error);
            this.showError('Failed to load validation data');
        } finally {
            this.setValidationLoading(false);
        }
    }

    /**
     * Validate all configurations
     */
    async validateAll() {
        if (this.state.isValidating) return;

        this.setValidationLoading(true);
        this.addToHistory('Validation', 'System-wide validation started', 'info');

        try {
            const response = await fetch(`${this.config.apiBaseUrl}/validate/all`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) throw new Error('Validation request failed');
            
            const results = await response.json();
            
            // Update state with results
            this.state.validationResults.system = results.results.system;
            
            // Update theme results
            Object.entries(results.results.themes).forEach(([themeName, result]) => {
                this.state.validationResults.themes.set(themeName, result);
            });

            // Update model results  
            Object.entries(results.results.models || {}).forEach(([modelId, result]) => {
                this.state.validationResults.models.set(modelId, result);
            });

            // Update UI
            this.updateValidationOverview();
            this.updateValidationSections();
            
            // Add to history
            const errorCount = results.summary.error_count || 0;
            const status = errorCount > 0 ? 'error' : 'success';
            const message = errorCount > 0 ? 
                `Validation completed with ${errorCount} issues` :
                'All configurations valid';
                
            this.addToHistory('System Validation', message, status);
            this.showSuccess('Validation completed successfully');
            
        } catch (error) {
            console.error('Failed to validate all configurations:', error);
            this.showError('Failed to validate configurations');
            this.addToHistory('System Validation', 'Validation failed', 'error');
        } finally {
            this.setValidationLoading(false);
        }
    }

    /**
     * Validate system configuration only
     */
    async validateSystem() {
        try {
            this.setSystemValidating(true);
            
            // Get system configuration
            const configResponse = await fetch(`${this.config.apiBaseUrl}/config/system`);
            if (!configResponse.ok) throw new Error('Failed to fetch system config');
            
            const config = await configResponse.json();
            
            // Validate configuration
            const validateResponse = await fetch(`${this.config.apiBaseUrl}/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            
            if (!validateResponse.ok) throw new Error('Validation failed');
            
            const result = await validateResponse.json();
            
            // Update state and UI
            this.state.validationResults.system = result;
            this.updateSystemValidation();
            
            const status = result.valid ? 'success' : 'error';
            const message = result.valid ? 
                'System configuration is valid' :
                `System configuration has ${result.errors.length} errors`;
                
            this.addToHistory('System Config', message, status);
            
        } catch (error) {
            console.error('Failed to validate system configuration:', error);
            this.showError('Failed to validate system configuration');
        } finally {
            this.setSystemValidating(false);
        }
    }

    /**
     * Validate theme configurations
     */
    async validateThemes() {
        try {
            this.setThemesValidating(true);
            
            // Get all themes
            const themesResponse = await fetch(`${this.config.apiBaseUrl}/themes`);
            if (!themesResponse.ok) throw new Error('Failed to fetch themes');
            
            const themes = await themesResponse.json();
            
            // Validate each theme
            for (const theme of themes) {
                try {
                    const configResponse = await fetch(`${this.config.apiBaseUrl}/themes/${theme.id}/config`);
                    if (!configResponse.ok) continue;
                    
                    const { config } = await configResponse.json();
                    
                    const validateResponse = await fetch(`${this.config.apiBaseUrl}/validate`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(config)
                    });
                    
                    if (!validateResponse.ok) continue;
                    
                    const result = await validateResponse.json();
                    this.state.validationResults.themes.set(theme.name, {
                        ...result,
                        theme: theme
                    });
                    
                } catch (error) {
                    console.error(`Failed to validate theme ${theme.name}:`, error);
                }
            }
            
            // Update UI
            this.updateThemeValidation();
            this.addToHistory('Theme Validation', 'Theme configurations validated', 'info');
            
        } catch (error) {
            console.error('Failed to validate themes:', error);
            this.showError('Failed to validate themes');
        } finally {
            this.setThemesValidating(false);
        }
    }

    /**
     * Validate model configurations
     */
    async validateModels() {
        try {
            this.setModelsValidating(true);
            
            // Get models with configurations
            const modelsResponse = await fetch(`${this.config.apiBaseUrl}/models?filter=with-overrides`);
            if (!modelsResponse.ok) throw new Error('Failed to fetch models');
            
            const { models } = await modelsResponse.json();
            
            // Validate each model with custom config
            for (const model of models.filter(m => m.has_custom_config)) {
                try {
                    const configResponse = await fetch(`${this.config.apiBaseUrl}/models/${model.id}/config`);
                    if (!configResponse.ok) continue;
                    
                    const { config } = await configResponse.json();
                    if (!config) continue;
                    
                    const validateResponse = await fetch(`${this.config.apiBaseUrl}/validate`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(config)
                    });
                    
                    if (!validateResponse.ok) continue;
                    
                    const result = await validateResponse.json();
                    this.state.validationResults.models.set(model.id.toString(), {
                        ...result,
                        model: model
                    });
                    
                } catch (error) {
                    console.error(`Failed to validate model ${model.name}:`, error);
                }
            }
            
            // Update UI
            this.updateModelValidation();
            this.addToHistory('Model Validation', 'Model configurations validated', 'info');
            
        } catch (error) {
            console.error('Failed to validate models:', error);
            this.showError('Failed to validate models');
        } finally {
            this.setModelsValidating(false);
        }
    }

    /**
     * Update validation overview section
     */
    updateValidationOverview() {
        const systemResult = this.state.validationResults.system;
        const themeResults = Array.from(this.state.validationResults.themes.values());
        const modelResults = Array.from(this.state.validationResults.models.values());

        // Update system status
        this.updateStatusCard('system', systemResult);
        
        // Update theme status
        const themeErrors = themeResults.filter(r => !r.valid).length;
        const themeStatus = {
            valid: themeErrors === 0,
            errors: themeResults.reduce((sum, r) => sum + (r.errors?.length || 0), 0),
            warnings: themeResults.reduce((sum, r) => sum + (r.warnings?.length || 0), 0),
            total: themeResults.length
        };
        this.updateStatusCard('theme', themeStatus);

        // Update model status  
        const modelErrors = modelResults.filter(r => !r.valid).length;
        const modelStatus = {
            valid: modelErrors === 0,
            errors: modelResults.reduce((sum, r) => sum + (r.errors?.length || 0), 0),
            warnings: modelResults.reduce((sum, r) => sum + (r.warnings?.length || 0), 0),
            total: modelResults.length
        };
        this.updateStatusCard('model', modelStatus);
    }

    /**
     * Update a status card
     */
    updateStatusCard(type, result) {
        const iconElement = document.getElementById(`${type}StatusIcon`);
        const textElement = document.getElementById(`${type}StatusText`);
        const detailsElement = document.getElementById(`${type}StatusDetails`);

        if (!result) {
            textElement.textContent = 'Not validated';
            return;
        }

        if (result.valid) {
            iconElement.className = 'fas fa-check-circle';
            textElement.textContent = 'All configurations valid';
            textElement.style.color = '#10b981';
        } else {
            iconElement.className = 'fas fa-exclamation-triangle';
            textElement.textContent = `${result.errors || 0} errors, ${result.warnings || 0} warnings`;
            textElement.style.color = '#ef4444';
        }

        // Update details
        if (detailsElement) {
            detailsElement.innerHTML = `
                <div style="display: flex; justify-content: space-between; font-size: 0.875rem; color: #64748b;">
                    <span>Total: ${result.total || 1}</span>
                    <span>Issues: ${(result.errors || 0) + (result.warnings || 0)}</span>
                </div>
            `;
        }
    }

    /**
     * Update validation sections
     */
    updateValidationSections() {
        this.updateSystemValidation();
        this.updateThemeValidation();
        this.updateModelValidation();
    }

    /**
     * Update system validation section
     */
    updateSystemValidation() {
        const container = document.getElementById('systemValidationResults');
        if (!container) return;

        const result = this.state.validationResults.system;
        if (!result) {
            container.innerHTML = '<p class="text-muted">System configuration not validated yet.</p>';
            return;
        }

        if (this.templates.validationResultTemplate) {
            const html = this.templates.validationResultTemplate({
                status: result.valid ? 'valid' : (result.errors?.length ? 'error' : 'warning'),
                icon: result.valid ? 'check-circle' : 'exclamation-triangle',
                title: 'System Configuration',
                summary: result.valid ? 
                    'System configuration is valid and ready to use.' :
                    `Found ${result.errors?.length || 0} errors and ${result.warnings?.length || 0} warnings.`,
                type: 'system',
                id: 'system',
                canEdit: true,
                canRevalidate: true,
                errors: result.errors || [],
                warnings: result.warnings || [],
                suggestions: result.suggestions || []
            });
            container.innerHTML = html;
        } else {
            // Fallback template
            const statusClass = result.valid ? 'valid' : 'error';
            container.innerHTML = `
                <div class="validation-result ${statusClass}">
                    <div class="result-header">
                        <div class="result-icon">
                            <i class="fas fa-${result.valid ? 'check-circle' : 'exclamation-triangle'}"></i>
                        </div>
                        <div class="result-info">
                            <h4>System Configuration</h4>
                            <p class="result-summary">${result.valid ? 'Valid' : 'Has issues'}</p>
                        </div>
                        <div class="result-actions">
                            <button class="btn btn-sm btn-outline" data-action="edit-config" data-type="system" data-id="system">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    /**
     * Update theme validation section
     */
    updateThemeValidation() {
        const container = document.getElementById('themeValidationList');
        if (!container) return;

        const results = Array.from(this.state.validationResults.themes.entries());
        
        if (results.length === 0) {
            container.innerHTML = '<p class="text-muted">No theme configurations validated yet.</p>';
            return;
        }

        let html = '';
        results.forEach(([themeName, result]) => {
            const theme = result.theme || { name: themeName, display_name: themeName };
            const statusClass = result.valid ? 'valid' : (result.errors?.length ? 'error' : 'warning');
            
            if (this.templates.themeValidationItemTemplate) {
                html += this.templates.themeValidationItemTemplate({
                    id: theme.id || themeName,
                    name: theme.name,
                    display_name: theme.display_name || theme.name,
                    category: theme.category || 'Unknown',
                    page_count: theme.page_count || 0,
                    status: statusClass,
                    statusIcon: result.valid ? 'check-circle' : 'exclamation-triangle',
                    statusText: result.valid ? 'Valid' : 'Has Issues',
                    hasIssues: !result.valid,
                    errors: result.errors || [],
                    warnings: result.warnings || []
                });
            } else {
                // Fallback template
                html += `
                    <div class="theme-validation-item ${statusClass}">
                        <div class="item-header">
                            <div class="theme-info">
                                <h4>${theme.display_name || theme.name}</h4>
                                <p class="theme-meta">${theme.name}</p>
                            </div>
                            <div class="validation-status">
                                <div class="status-badge ${statusClass}">
                                    <i class="fas fa-${result.valid ? 'check-circle' : 'exclamation-triangle'}"></i>
                                    ${result.valid ? 'Valid' : 'Issues'}
                                </div>
                            </div>
                        </div>
                        <div class="item-actions">
                            <button class="btn btn-sm btn-primary" data-action="edit-config" data-type="theme" data-id="${theme.id || themeName}">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                        </div>
                    </div>
                `;
            }
        });

        container.innerHTML = html;
    }

    /**
     * Update model validation section
     */
    updateModelValidation() {
        const container = document.getElementById('modelValidationList');
        if (!container) return;

        const results = Array.from(this.state.validationResults.models.entries());
        
        if (results.length === 0) {
            container.innerHTML = '<p class="text-muted">No model configurations validated yet.</p>';
            return;
        }

        let html = '';
        results.forEach(([modelId, result]) => {
            const model = result.model || { id: modelId, name: `Model ${modelId}` };
            const statusClass = result.valid ? 'valid' : (result.errors?.length ? 'error' : 'warning');
            
            html += `
                <div class="model-validation-item ${statusClass}">
                    <div class="item-header">
                        <div class="model-info">
                            <h4>${model.name}</h4>
                            <p class="model-meta">${model.slug || ''} • ${model.theme_display_name || 'Default Theme'}</p>
                        </div>
                        <div class="validation-status">
                            <div class="status-badge ${statusClass}">
                                <i class="fas fa-${result.valid ? 'check-circle' : 'exclamation-triangle'}"></i>
                                ${result.valid ? 'Valid' : 'Issues'}
                            </div>
                        </div>
                    </div>
                    <div class="item-actions">
                        <button class="btn btn-sm btn-primary" data-action="edit-config" data-type="model" data-id="${model.id}">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    /**
     * Open configuration editor modal
     */
    async openConfigEditor(type, id) {
        try {
            this.state.currentEditor = { type, id, config: null };
            
            // Fetch current configuration
            let config;
            if (type === 'system') {
                const response = await fetch(`${this.config.apiBaseUrl}/config/system`);
                config = await response.json();
            } else if (type === 'theme') {
                const response = await fetch(`${this.config.apiBaseUrl}/themes/${id}/config`);
                const data = await response.json();
                config = data.config;
            } else if (type === 'model') {
                const response = await fetch(`${this.config.apiBaseUrl}/models/${id}/config`);
                const data = await response.json();
                config = data.config;
            }
            
            this.state.currentEditor.config = config;
            
            // Update modal title
            const modalTitle = document.getElementById('modalTitle');
            modalTitle.textContent = `Edit ${type.charAt(0).toUpperCase() + type.slice(1)} Configuration`;
            
            // Populate JSON editor
            const jsonTextarea = document.getElementById('jsonTextarea');
            jsonTextarea.value = JSON.stringify(config, null, 2);
            
            // Show modal
            document.getElementById('configEditorModal').style.display = 'flex';
            
        } catch (error) {
            console.error('Failed to open config editor:', error);
            this.showError('Failed to load configuration for editing');
        }
    }

    /**
     * Close configuration editor modal
     */
    closeConfigEditor() {
        document.getElementById('configEditorModal').style.display = 'none';
        this.state.currentEditor = { type: null, id: null, config: null };
    }

    /**
     * Switch editor tabs
     */
    switchEditorTab(editorType) {
        document.querySelectorAll('.editor-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.editor === editorType);
        });
        
        document.querySelectorAll('.editor-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === `${editorType}Editor`);
        });
    }

    /**
     * Validate JSON editor content
     */
    validateJsonEditor() {
        const textarea = document.getElementById('jsonTextarea');
        const validation = document.getElementById('editorValidation');
        
        try {
            const config = JSON.parse(textarea.value);
            
            // TODO: Add actual validation logic here
            validation.className = 'editor-validation valid show';
            validation.innerHTML = '<i class="fas fa-check-circle"></i> JSON is valid';
            
            this.state.currentEditor.config = config;
            
        } catch (error) {
            validation.className = 'editor-validation error show';
            validation.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Invalid JSON: ${error.message}`;
        }
    }

    /**
     * Save configuration from editor
     */
    async saveConfiguration() {
        if (!this.state.currentEditor.type || !this.state.currentEditor.config) {
            this.showError('No configuration to save');
            return;
        }

        try {
            const { type, id, config } = this.state.currentEditor;
            
            let endpoint;
            if (type === 'system') {
                endpoint = `${this.config.apiBaseUrl}/config/system`;
            } else if (type === 'theme') {
                endpoint = `${this.config.apiBaseUrl}/themes/${id}/config`;
            } else if (type === 'model') {
                endpoint = `${this.config.apiBaseUrl}/models/${id}/config`;
            }
            
            const response = await fetch(endpoint, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            
            if (!response.ok) throw new Error('Failed to save configuration');
            
            this.showSuccess('Configuration saved successfully');
            this.closeConfigEditor();
            
            // Revalidate the updated configuration
            this.revalidateItem(type, id);
            
        } catch (error) {
            console.error('Failed to save configuration:', error);
            this.showError('Failed to save configuration');
        }
    }

    /**
     * Revalidate a specific item
     */
    async revalidateItem(type, id) {
        try {
            if (type === 'system') {
                await this.validateSystem();
            } else if (type === 'theme') {
                // TODO: Implement individual theme validation
                await this.validateThemes();
            } else if (type === 'model') {
                // TODO: Implement individual model validation
                await this.validateModels();
            }
        } catch (error) {
            console.error(`Failed to revalidate ${type}:`, error);
            this.showError(`Failed to revalidate ${type}`);
        }
    }

    /**
     * Add item to validation history
     */
    addToHistory(title, description, status = 'info') {
        const historyItem = {
            id: Date.now().toString(),
            title,
            description,
            status,
            timestamp: new Date().toISOString()
        };
        
        this.state.validationHistory.unshift(historyItem);
        
        // Limit history to 50 items
        if (this.state.validationHistory.length > 50) {
            this.state.validationHistory = this.state.validationHistory.slice(0, 50);
        }
        
        this.updateValidationHistory();
    }

    /**
     * Update validation history display
     */
    updateValidationHistory() {
        const container = document.getElementById('validationHistoryList');
        if (!container) return;

        if (this.state.validationHistory.length === 0) {
            container.innerHTML = '<p class="text-muted">No validation history yet.</p>';
            return;
        }

        let html = '';
        this.state.validationHistory.forEach(item => {
            const timeAgo = this.timeAgo(new Date(item.timestamp));
            
            html += `
                <div class="history-item ${item.status}">
                    <div class="item-icon">
                        <i class="fas fa-${this.getHistoryIcon(item.status)}"></i>
                    </div>
                    <div class="item-content">
                        <div class="item-header">
                            <h5>${item.title}</h5>
                            <span class="item-time">${timeAgo}</span>
                        </div>
                        <p class="item-description">${item.description}</p>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    /**
     * Get history icon for status
     */
    getHistoryIcon(status) {
        const icons = {
            'success': 'check-circle',
            'error': 'exclamation-triangle',
            'warning': 'exclamation-circle',
            'info': 'info-circle'
        };
        return icons[status] || 'circle';
    }

    /**
     * Clear validation history
     */
    clearValidationHistory() {
        if (!confirm('Are you sure you want to clear the validation history?')) {
            return;
        }
        
        this.state.validationHistory = [];
        this.updateValidationHistory();
        this.showSuccess('Validation history cleared');
    }

    /**
     * Set loading state for validation
     */
    setValidationLoading(isLoading) {
        this.state.isValidating = isLoading;
        
        const buttons = [
            'validateAllBtn',
            'validateSystemBtn', 
            'validateThemesBtn',
            'validateModelsBtn'
        ];
        
        buttons.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.disabled = isLoading;
                if (isLoading) {
                    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Validating...';
                }
            }
        });
    }

    /**
     * Set system validation loading state
     */
    setSystemValidating(isValidating) {
        const button = document.getElementById('validateSystemBtn');
        if (button) {
            button.disabled = isValidating;
            button.innerHTML = isValidating ? 
                '<i class="fas fa-spinner fa-spin"></i> Validating...' :
                '<i class="fas fa-check"></i> Validate System Config';
        }
    }

    /**
     * Set themes validation loading state
     */
    setThemesValidating(isValidating) {
        const button = document.getElementById('validateThemesBtn');
        if (button) {
            button.disabled = isValidating;
            button.innerHTML = isValidating ? 
                '<i class="fas fa-spinner fa-spin"></i> Validating...' :
                '<i class="fas fa-check"></i> Validate Themes';
        }
    }

    /**
     * Set models validation loading state
     */
    setModelsValidating(isValidating) {
        const button = document.getElementById('validateModelsBtn');
        if (button) {
            button.disabled = isValidating;
            button.innerHTML = isValidating ? 
                '<i class="fas fa-spinner fa-spin"></i> Validating...' :
                '<i class="fas fa-check"></i> Validate Models';
        }
    }

    /**
     * Utility function to create debounced functions
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Calculate time ago string
     */
    timeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    }

    /**
     * Show success message
     */
    showSuccess(message) {
        // TODO: Integrate with main admin toast system
        console.log('✅', message);
    }

    /**
     * Show error message
     */
    showError(message) {
        // TODO: Integrate with main admin toast system
        console.error('❌', message);
    }

    /**
     * Start auto-refresh
     */
    startAutoRefresh() {
        setInterval(() => {
            if (!this.state.isValidating) {
                this.refreshValidationStatus();
            }
        }, this.config.autoRefreshInterval);
    }

    /**
     * Refresh validation status
     */
    async refreshValidationStatus() {
        // TODO: Implement status refresh without full validation
        console.log('Refreshing validation status...');
    }

    /**
     * Refresh validation (force re-check)
     */
    refreshValidation() {
        this.validateAll();
    }

    /**
     * Load validation history
     */
    async loadValidationHistory() {
        // TODO: Load from API or localStorage
        console.log('Loading validation history...');
    }

    /**
     * Filter theme results
     */
    filterThemeResults(filter) {
        // TODO: Implement theme filtering
        console.log('Filtering themes:', filter);
    }

    /**
     * Search model results
     */
    searchModelResults(searchTerm) {
        // TODO: Implement model search
        console.log('Searching models:', searchTerm);
    }

    /**
     * Filter model results
     */
    filterModelResults(filter) {
        // TODO: Implement model filtering
        console.log('Filtering models:', filter);
    }

    /**
     * Toggle details visibility
     */
    toggleDetails(targetId) {
        const element = document.getElementById(targetId);
        if (element) {
            element.style.display = element.style.display === 'none' ? 'block' : 'none';
        }
    }

    /**
     * View validation details
     */
    viewValidationDetails(id) {
        // TODO: Implement details view
        console.log('Viewing validation details for:', id);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ValidationDashboard;
} else {
    window.ValidationDashboard = ValidationDashboard;
}