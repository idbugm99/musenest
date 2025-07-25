/**
 * MuseNest Admin Dashboard - Settings Management
 */

class SettingsManager {
    constructor() {
        this.settings = {};
        this.currentCategory = 'general';
        this.categories = {
            general: {
                name: 'General',
                icon: 'fas fa-cog',
                fields: [
                    { key: 'site_name', label: 'Site Name', type: 'text', placeholder: 'Your Portfolio Name' },
                    { key: 'model_name', label: 'Your Name', type: 'text', placeholder: 'Your Display Name' },
                    { key: 'tagline', label: 'Tagline', type: 'text', placeholder: 'Your Professional Tagline' }
                ]
            },
            contact: {
                name: 'Contact Information',
                icon: 'fas fa-envelope',
                fields: [
                    { key: 'contact_email', label: 'Email Address', type: 'email', placeholder: 'your@email.com' },
                    { key: 'contact_phone', label: 'Phone Number', type: 'tel', placeholder: '+1 (555) 123-4567' },
                    { key: 'city', label: 'City/Location', type: 'text', placeholder: 'New York, NY' }
                ]
            },
            appearance: {
                name: 'Appearance',
                icon: 'fas fa-paint-brush',
                fields: [
                    { key: 'theme', label: 'Current Theme', type: 'select', options: [
                        { value: 'basic', label: 'Basic' },
                        { value: 'glamour', label: 'Glamour' },
                        { value: 'luxury', label: 'Luxury' },
                        { value: 'modern', label: 'Modern' },
                        { value: 'dark', label: 'Dark' }
                    ]},
                    { key: 'primary_color', label: 'Primary Color', type: 'color' }
                ]
            },
            seo: {
                name: 'SEO Settings',
                icon: 'fas fa-search',
                fields: [
                    { key: 'meta_description', label: 'Meta Description', type: 'textarea', placeholder: 'Brief description for search engines' },
                    { key: 'meta_keywords', label: 'Keywords', type: 'text', placeholder: 'keyword1, keyword2, keyword3' }
                ]
            }
        };
        
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Category navigation
        document.querySelectorAll('.settings-category-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const category = btn.dataset.category;
                this.switchCategory(category);
            });
        });
    }

    async loadSettings() {
        try {
            window.adminDashboard.showLoading(true);
            
            const response = await window.adminDashboard.apiRequest('/api/settings');
            if (response.success) {
                this.settings = response.settings;
                this.renderSettingsForm();
            } else {
                window.adminDashboard.showNotification('Failed to load settings', 'error');
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            window.adminDashboard.showNotification('Failed to load settings', 'error');
        } finally {
            window.adminDashboard.showLoading(false);
        }
    }

    switchCategory(category) {
        this.currentCategory = category;
        
        // Update navigation
        document.querySelectorAll('.settings-category-btn').forEach(btn => {
            btn.classList.remove('bg-blue-50', 'text-blue-700');
            btn.classList.add('text-gray-600', 'hover:text-gray-900');
        });
        
        const activeBtn = document.querySelector(`[data-category="${category}"]`);
        if (activeBtn) {
            activeBtn.classList.add('bg-blue-50', 'text-blue-700');
            activeBtn.classList.remove('text-gray-600', 'hover:text-gray-900');
        }

        this.renderSettingsForm();
    }

    renderSettingsForm() {
        const container = document.getElementById('settingsContent');
        if (!container) return;

        const categoryConfig = this.categories[this.currentCategory];
        if (!categoryConfig) return;

        container.innerHTML = `
            <div class="mb-6">
                <h3 class="text-lg font-semibold text-gray-900 mb-2">${categoryConfig.name}</h3>
                <p class="text-sm text-gray-600">Configure your ${categoryConfig.name.toLowerCase()} settings</p>
            </div>

            <form id="settingsForm" class="space-y-6">
                ${categoryConfig.fields.map(field => this.renderField(field)).join('')}
                
                <div class="pt-6 border-t border-gray-200">
                    <div class="flex justify-end space-x-3">
                        <button type="button" onclick="settingsManager.resetCategory()" class="px-4 py-2 text-gray-600 hover:text-gray-800">
                            Reset to Defaults
                        </button>
                        <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                            Save Settings
                        </button>
                    </div>
                </div>
            </form>
        `;

        // Setup form submission
        const form = container.querySelector('#settingsForm');
        form.addEventListener('submit', this.saveSettings.bind(this));
    }

    renderField(field) {
        const currentValue = this.settings[field.key]?.value || '';
        
        switch (field.type) {
            case 'textarea':
                return `
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">${field.label}</label>
                        <textarea name="${field.key}" rows="3" class="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="${field.placeholder || ''}">${currentValue}</textarea>
                    </div>
                `;
                
            case 'select':
                return `
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">${field.label}</label>
                        <select name="${field.key}" class="w-full border border-gray-300 rounded-md px-3 py-2">
                            ${field.options.map(option => 
                                `<option value="${option.value}" ${option.value === currentValue ? 'selected' : ''}>${option.label}</option>`
                            ).join('')}
                        </select>
                    </div>
                `;
                
            case 'color':
                return `
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">${field.label}</label>
                        <div class="flex items-center space-x-3">
                            <input type="color" name="${field.key}" value="${currentValue || '#3B82F6'}" class="h-10 w-20 border border-gray-300 rounded-md">
                            <input type="text" name="${field.key}_hex" value="${currentValue || '#3B82F6'}" class="flex-1 border border-gray-300 rounded-md px-3 py-2" placeholder="#000000">
                        </div>
                    </div>
                `;
                
            default:
                return `
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">${field.label}</label>
                        <input type="${field.type}" name="${field.key}" value="${currentValue}" class="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="${field.placeholder || ''}">
                    </div>
                `;
        }
    }

    async saveSettings(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const settings = {};
        
        for (const [key, value] of formData.entries()) {
            if (!key.endsWith('_hex')) {
                settings[key] = {
                    value: value,
                    category: this.currentCategory
                };
            }
        }

        try {
            window.adminDashboard.showLoading(true);
            
            const response = await window.adminDashboard.apiRequest('/api/settings/bulk', {
                method: 'POST',
                body: JSON.stringify({ settings })
            });

            if (response.success) {
                window.adminDashboard.showNotification('Settings saved successfully', 'success');
                await this.loadSettings();
                
                // Update dashboard if theme was changed
                if (settings.theme) {
                    document.getElementById('currentTheme').textContent = settings.theme.value;
                }
            } else {
                window.adminDashboard.showNotification('Failed to save settings', 'error');
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            window.adminDashboard.showNotification('Failed to save settings', 'error');
        } finally {
            window.adminDashboard.showLoading(false);
        }
    }

    async resetCategory() {
        if (!confirm(`Reset all ${this.categories[this.currentCategory].name.toLowerCase()} settings to defaults?`)) {
            return;
        }

        try {
            window.adminDashboard.showLoading(true);
            
            const response = await window.adminDashboard.apiRequest('/api/settings/reset', {
                method: 'POST',
                body: JSON.stringify({ category: this.currentCategory })
            });

            if (response.success) {
                window.adminDashboard.showNotification('Settings reset successfully', 'success');
                await this.loadSettings();
            } else {
                window.adminDashboard.showNotification('Failed to reset settings', 'error');
            }
        } catch (error) {
            console.error('Error resetting settings:', error);
            window.adminDashboard.showNotification('Failed to reset settings', 'error');
        } finally {
            window.adminDashboard.showLoading(false);
        }
    }
}

// Initialize settings manager
document.addEventListener('DOMContentLoaded', () => {
    window.settingsManager = new SettingsManager();
});