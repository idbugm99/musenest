/**
 * Universal Gallery Admin Interface JavaScript
 * 
 * Handles all admin interface interactions, API calls, and dynamic content
 * for the universal gallery system management dashboard.
 */

class UniversalGalleryAdmin {
    constructor() {
        this.currentTab = 'dashboard';
        this.config = {
            apiBaseUrl: '/api/universal-gallery',
            updateInterval: 30000, // 30 seconds
            maxRetries: 3
        };
        
        this.state = {
            systemConfig: null,
            themes: new Map(),
            models: new Map(),
            stats: {},
            validationResults: {},
            isLoading: false
        };

        this.boundHandlers = {};
        
        this.init();
    }

    /**
     * Initialize the admin interface
     */
    async init() {
        try {
            this.bindEvents();
            await this.loadInitialData();
            this.startAutoRefresh();
            console.log('✅ Universal Gallery Admin initialized');
        } catch (error) {
            console.error('❌ Failed to initialize admin interface:', error);
            this.showToast('Failed to initialize admin interface', 'error');
        }
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Bootstrap tab navigation - updated for new structure
        document.querySelectorAll('[data-bs-toggle="pill"]').forEach(tab => {
            tab.addEventListener('shown.bs.tab', (e) => {
                const targetId = e.target.getAttribute('data-bs-target');
                const tabName = targetId.replace('#', '').replace('-pane', '');
                this.currentTab = tabName;
                this.onTabChanged(tabName);
            });
        });

        // System configuration form
        const systemForm = document.getElementById('systemConfigForm');
        if (systemForm) {
            systemForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveSystemConfiguration();
            });
        }

        // Reset system config
        const resetBtn = document.getElementById('resetSystemConfig');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetSystemConfiguration();
            });
        }

        // Header actions
        document.getElementById('validateAllConfigs')?.addEventListener('click', () => {
            this.validateAllConfigurations();
        });

        document.getElementById('exportConfigs')?.addEventListener('click', () => {
            this.exportConfigurations();
        });

        // Quick actions
        document.getElementById('createThemeConfig')?.addEventListener('click', () => {
            this.createThemeConfiguration();
        });

        document.getElementById('runPerformanceAudit')?.addEventListener('click', () => {
            this.runPerformanceAudit();
        });

        document.getElementById('validateAllThemes')?.addEventListener('click', () => {
            this.validateAllThemes();
        });

        document.getElementById('exportSystemConfig')?.addEventListener('click', () => {
            this.exportSystemConfiguration();
        });

        // Refresh activity
        document.getElementById('refreshActivity')?.addEventListener('click', () => {
            this.loadRecentActivity();
        });

        // Theme selector
        document.getElementById('themeSelector')?.addEventListener('change', (e) => {
            this.loadThemeConfiguration(e.target.value);
        });

        // Model search and filters
        document.getElementById('modelSearch')?.addEventListener('input', (e) => {
            this.filterModels(e.target.value, document.getElementById('modelFilter')?.value);
        });

        document.getElementById('modelFilter')?.addEventListener('change', (e) => {
            this.filterModels(document.getElementById('modelSearch')?.value, e.target.value);
        });
    }

    /**
     * Handle tab changes (Bootstrap handles UI, we handle data loading)
     */
    onTabChanged(tabName) {
        if (this.currentTab === tabName) return;
        
        console.log(`Switching to tab: ${tabName}`);
        
        // Load tab-specific data
        this.loadTabData(tabName);
    }

    /**
     * Legacy method for backwards compatibility
     */
    switchTab(tabName) {
        // Bootstrap 5 tab switching
        const targetTab = document.querySelector(`[data-bs-target="#${tabName}-pane"]`);
        if (targetTab) {
            const tab = new bootstrap.Tab(targetTab);
            tab.show();
        }
    }

    /**
     * Load initial data for the dashboard
     */
    async loadInitialData() {
        this.setLoading(true);
        
        try {
            // Load in parallel for better performance
            const [systemConfig, themes, stats, activity] = await Promise.all([
                this.fetchSystemConfiguration(),
                this.fetchThemes(),
                this.fetchStatistics(),
                this.fetchRecentActivity()
            ]);

            this.state.systemConfig = systemConfig;
            this.state.themes = new Map(themes.map(theme => [theme.id, theme]));
            this.state.stats = stats;

            this.updateDashboard();
            this.populateSystemConfigForm();
            this.populateThemeSelector();
            this.updateRecentActivity(activity);

        } catch (error) {
            console.error('Failed to load initial data:', error);
            this.showToast('Failed to load dashboard data', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Load data specific to the current tab
     */
    async loadTabData(tabName) {
        switch (tabName) {
            case 'dashboard':
                await this.loadDashboardData();
                break;
            case 'system-config':
                await this.loadSystemConfigData();
                break;
            case 'theme-config':
                await this.loadThemeConfigData();
                break;
            case 'model-overrides':
                await this.loadModelOverridesData();
                break;
            case 'performance':
                await this.loadPerformanceData();
                break;
            case 'validation':
                await this.loadValidationData();
                break;
        }
    }

    /**
     * Update dashboard statistics
     */
    updateDashboard() {
        const stats = this.state.stats;
        
        document.getElementById('totalGalleries').textContent = stats.totalGalleries || '--';
        document.getElementById('activeThemes').textContent = stats.activeThemes || '--';
        document.getElementById('validationIssues').textContent = stats.validationIssues || '--';
        document.getElementById('avgPerformance').textContent = stats.avgPerformance ? 
            `${Math.round(stats.avgPerformance)}ms` : '--';
    }

    /**
     * Populate system configuration form
     */
    populateSystemConfigForm() {
        if (!this.state.systemConfig) return;

        const config = this.state.systemConfig;
        
        // Gallery Behavior
        this.setFormValue('defaultLayout', config.defaultLayout);
        this.setFormValue('imagesPerPage', config.imagesPerPage);
        this.setFormValue('gridColumns', config.gridColumns);

        // Lightbox Configuration  
        this.setFormValue('enableLightbox', config.enableLightbox);
        this.setFormValue('enableFullscreen', config.enableFullscreen);
        this.setFormValue('enableZoom', config.enableZoom);
        this.setFormValue('lightboxAnimation', config.lightboxAnimation);

        // Display Options
        this.setFormValue('showCaptions', config.showCaptions);
        this.setFormValue('showImageInfo', config.showImageInfo);
        this.setFormValue('showCategoryFilter', config.showCategoryFilter);
        this.setFormValue('enableSearch', config.enableSearch);

        // Performance Settings
        this.setFormValue('enableLazyLoading', config.enableLazyLoading);
        this.setFormValue('enablePrefetch', config.enablePrefetch);
        this.setFormValue('prefetchStrategy', config.prefetchStrategy);
        this.setFormValue('respectReducedMotion', config.respectReducedMotion);
    }

    /**
     * Set form field value
     */
    setFormValue(fieldName, value) {
        const field = document.getElementById(fieldName);
        if (!field) return;

        if (field.type === 'checkbox') {
            field.checked = Boolean(value);
        } else {
            field.value = value || '';
        }
    }

    /**
     * Get form field value
     */
    getFormValue(fieldName) {
        const field = document.getElementById(fieldName);
        if (!field) return null;

        if (field.type === 'checkbox') {
            return field.checked;
        } else if (field.type === 'number') {
            return parseInt(field.value) || 0;
        } else {
            return field.value;
        }
    }

    /**
     * Save system configuration
     */
    async saveSystemConfiguration() {
        try {
            this.setLoading(true);

            // Collect form data
            const config = {
                // Gallery Behavior
                defaultLayout: this.getFormValue('defaultLayout'),
                imagesPerPage: this.getFormValue('imagesPerPage'),
                gridColumns: this.getFormValue('gridColumns'),

                // Lightbox Configuration
                enableLightbox: this.getFormValue('enableLightbox'),
                enableFullscreen: this.getFormValue('enableFullscreen'),
                enableZoom: this.getFormValue('enableZoom'),
                lightboxAnimation: this.getFormValue('lightboxAnimation'),

                // Display Options
                showCaptions: this.getFormValue('showCaptions'),
                showImageInfo: this.getFormValue('showImageInfo'),
                showCategoryFilter: this.getFormValue('showCategoryFilter'),
                enableSearch: this.getFormValue('enableSearch'),

                // Performance Settings
                enableLazyLoading: this.getFormValue('enableLazyLoading'),
                enablePrefetch: this.getFormValue('enablePrefetch'),
                prefetchStrategy: this.getFormValue('prefetchStrategy'),
                respectReducedMotion: this.getFormValue('respectReducedMotion')
            };

            // Validate configuration
            const validation = await this.validateConfiguration(config);
            if (!validation.valid) {
                throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
            }

            // Save configuration
            await this.saveConfiguration('system', config);
            
            this.state.systemConfig = config;
            this.showToast('System configuration saved successfully', 'success');

        } catch (error) {
            console.error('Failed to save system configuration:', error);
            this.showToast(`Failed to save configuration: ${error.message}`, 'error');
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Reset system configuration to defaults
     */
    async resetSystemConfiguration() {
        if (!confirm('Are you sure you want to reset the system configuration to defaults? This cannot be undone.')) {
            return;
        }

        try {
            this.setLoading(true);
            
            const defaultConfig = await this.fetchDefaultConfiguration();
            await this.saveConfiguration('system', defaultConfig);
            
            this.state.systemConfig = defaultConfig;
            this.populateSystemConfigForm();
            
            this.showToast('System configuration reset to defaults', 'success');
            
        } catch (error) {
            console.error('Failed to reset configuration:', error);
            this.showToast('Failed to reset configuration', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Populate theme selector dropdown
     */
    populateThemeSelector() {
        const selector = document.getElementById('themeSelector');
        if (!selector) return;

        // Clear existing options
        selector.innerHTML = '<option value="">Select a theme...</option>';

        // Add theme options
        this.state.themes.forEach((theme, themeId) => {
            const option = document.createElement('option');
            option.value = themeId;
            option.textContent = `${theme.display_name || theme.name} (${themeId})`;
            selector.appendChild(option);
        });
    }

    /**
     * Update recent activity list
     */
    updateRecentActivity(activities) {
        const activityList = document.getElementById('activityList');
        if (!activityList) return;

        activityList.innerHTML = '';

        if (!activities || activities.length === 0) {
            activityList.innerHTML = `
                <div class="d-flex align-items-center py-3">
                    <div class="bg-info bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center me-3" style="width: 40px; height: 40px;">
                        <i class="fas fa-info-circle text-info"></i>
                    </div>
                    <div>
                        <p class="mb-0 text-muted">No recent configuration changes</p>
                    </div>
                </div>
            `;
            return;
        }

        activities.forEach(activity => {
            const item = document.createElement('div');
            item.className = 'd-flex align-items-center py-3 border-bottom';
            const iconColor = this.getActivityIconColor(activity.type);
            const timeAgo = this.getTimeAgo(activity.timestamp);
            
            item.innerHTML = `
                <div class="bg-${iconColor} bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center me-3" style="width: 40px; height: 40px;">
                    <i class="fas fa-${this.getActivityIcon(activity.type)} text-${iconColor}"></i>
                </div>
                <div class="flex-grow-1">
                    <h6 class="mb-1 fw-semibold">${activity.title}</h6>
                    <p class="mb-1 text-muted small">${activity.description}</p>
                    <small class="text-muted">${timeAgo} • ${activity.user}</small>
                </div>
            `;
            activityList.appendChild(item);
        });
    }

    /**
     * Get icon for activity type
     */
    getActivityIcon(type) {
        const icons = {
            'config-update': 'cog',
            'theme-config': 'palette',
            'validation': 'shield-alt',
            'performance': 'tachometer-alt',
            'system-update': 'sync-alt'
        };
        return icons[type] || 'circle';
    }

    /**
     * Get icon color for activity type
     */
    getActivityIconColor(type) {
        const colors = {
            'config-update': 'primary',
            'theme-config': 'success',
            'validation': 'info',
            'performance': 'warning',
            'system-update': 'secondary'
        };
        return colors[type] || 'secondary';
    }

    /**
     * Format time ago from timestamp
     */
    getTimeAgo(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diff = Math.floor((now - time) / 1000);
        
        if (diff < 60) return `${diff}s ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    }

    /**
     * Format timestamp as time ago
     */
    formatTimeAgo(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diffMs = now - time;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor(diffMs / (1000 * 60));

        if (diffHours > 24) {
            return `${Math.floor(diffHours / 24)} days ago`;
        } else if (diffHours > 0) {
            return `${diffHours} hours ago`;
        } else if (diffMinutes > 0) {
            return `${diffMinutes} minutes ago`;
        } else {
            return 'Just now';
        }
    }

    /**
     * Set loading state
     */
    setLoading(isLoading) {
        this.state.isLoading = isLoading;
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = isLoading ? 'flex' : 'none';
        }
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas fa-${this.getToastIcon(type)}"></i>
            <span>${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;

        container.appendChild(toast);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 5000);
    }

    /**
     * Get icon for toast type
     */
    getToastIcon(type) {
        const icons = {
            'success': 'check-circle',
            'error': 'exclamation-triangle',
            'warning': 'exclamation-circle',
            'info': 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    /**
     * Start auto-refresh for dashboard data
     */
    startAutoRefresh() {
        setInterval(() => {
            if (this.currentTab === 'dashboard' && !this.state.isLoading) {
                this.refreshDashboardData();
            }
        }, this.config.updateInterval);
    }

    /**
     * Refresh dashboard data
     */
    async refreshDashboardData() {
        try {
            const [stats, activity] = await Promise.all([
                this.fetchStatistics(),
                this.fetchRecentActivity()
            ]);

            this.state.stats = stats;
            this.updateDashboard();
            this.updateRecentActivity(activity);

        } catch (error) {
            console.error('Failed to refresh dashboard data:', error);
        }
    }

    // ===== API Methods =====

    /**
     * Fetch system configuration
     */
    async fetchSystemConfiguration() {
        const response = await fetch(`${this.config.apiBaseUrl}/config/system`);
        if (!response.ok) throw new Error('Failed to fetch system configuration');
        return response.json();
    }

    /**
     * Fetch available themes
     */
    async fetchThemes() {
        const response = await fetch(`${this.config.apiBaseUrl}/themes`);
        if (!response.ok) throw new Error('Failed to fetch themes');
        return response.json();
    }

    /**
     * Fetch dashboard statistics
     */
    async fetchStatistics() {
        const response = await fetch(`${this.config.apiBaseUrl}/stats`);
        if (!response.ok) throw new Error('Failed to fetch statistics');
        return response.json();
    }

    /**
     * Fetch recent activity
     */
    async fetchRecentActivity() {
        const response = await fetch(`${this.config.apiBaseUrl}/activity/recent`);
        if (!response.ok) throw new Error('Failed to fetch activity');
        return response.json();
    }

    /**
     * Fetch default configuration
     */
    async fetchDefaultConfiguration() {
        const response = await fetch(`${this.config.apiBaseUrl}/config/defaults`);
        if (!response.ok) throw new Error('Failed to fetch default configuration');
        return response.json();
    }

    /**
     * Save configuration
     */
    async saveConfiguration(type, config) {
        const response = await fetch(`${this.config.apiBaseUrl}/config/${type}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to save configuration');
        }

        return response.json();
    }

    /**
     * Validate configuration
     */
    async validateConfiguration(config) {
        const response = await fetch(`${this.config.apiBaseUrl}/validate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });

        if (!response.ok) throw new Error('Failed to validate configuration');
        return response.json();
    }

    // ===== Placeholder methods for other functionality =====

    async loadDashboardData() {
        // Dashboard data is loaded in loadInitialData
    }

    async loadSystemConfigData() {
        // System config is loaded in loadInitialData
    }

    async loadThemeConfigData() {
        // Implementation for theme configuration tab
        console.log('Loading theme configuration data...');
    }

    async loadModelOverridesData() {
        // Implementation for model overrides tab
        console.log('Loading model overrides data...');
    }

    async loadPerformanceData() {
        // Implementation for performance tab
        console.log('Loading performance data...');
    }

    async loadValidationData() {
        // Implementation for validation tab
        console.log('Loading validation data...');
    }

    async validateAllConfigurations() {
        console.log('Validating all configurations...');
        this.showToast('Configuration validation started', 'info');
    }

    async exportConfigurations() {
        console.log('Exporting configurations...');
        this.showToast('Export started', 'info');
    }

    async createThemeConfiguration() {
        console.log('Creating theme configuration...');
        this.showToast('Theme configuration wizard opened', 'info');
    }

    async runPerformanceAudit() {
        console.log('Running performance audit...');
        this.showToast('Performance audit started', 'info');
    }

    async validateAllThemes() {
        console.log('Validating all themes...');
        this.showToast('Theme validation started', 'info');
    }

    async exportSystemConfiguration() {
        console.log('Exporting system configuration...');
        this.showToast('System configuration exported', 'success');
    }

    async loadRecentActivity() {
        try {
            const activity = await this.fetchRecentActivity();
            this.updateRecentActivity(activity);
        } catch (error) {
            console.error('Failed to load recent activity:', error);
        }
    }

    async loadThemeConfiguration(themeId) {
        if (!themeId) return;
        console.log(`Loading theme configuration for: ${themeId}`);
    }

    async filterModels(searchTerm, filter) {
        console.log(`Filtering models: search="${searchTerm}", filter="${filter}"`);
    }
}

// Initialize admin interface when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.universalGalleryAdmin = new UniversalGalleryAdmin();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UniversalGalleryAdmin;
}