/**
 * MuseNest Admin Dashboard - Theme Management
 */

class ThemesManager {
    constructor() {
        this.themes = [
            {
                id: 'basic',
                name: 'Basic',
                description: 'Clean and simple design perfect for professional portfolios',
                preview: '/admin/previews/basic-preview.jpg',
                color: '#3B82F6'
            },
            {
                id: 'glamour',
                name: 'Glamour',
                description: 'Elegant gold accents and dark backgrounds for luxury appeal',
                preview: '/admin/previews/glamour-preview.jpg',
                color: '#D4AF37'
            },
            {
                id: 'luxury',
                name: 'Luxury',
                description: 'Premium design with sophisticated typography and layouts',
                preview: '/admin/previews/luxury-preview.jpg',
                color: '#8B5CF6'
            },
            {
                id: 'modern',
                name: 'Modern',
                description: 'Contemporary design with bold colors and dynamic layouts',
                preview: '/admin/previews/modern-preview.jpg',
                color: '#10B981'
            },
            {
                id: 'dark',
                name: 'Dark',
                description: 'Sleek dark theme with neon accents for edgy portfolios',
                preview: '/admin/previews/dark-preview.jpg',
                color: '#EF4444'
            }
        ];
        this.currentTheme = 'basic';
        
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Theme switching will be handled by individual theme cards
    }

    async loadThemes() {
        try {
            // Get current theme from settings
            const response = await window.adminDashboard.apiRequest('/api/settings/theme');
            if (response.success) {
                this.currentTheme = response.setting.value;
            }
        } catch (error) {
            console.error('Error loading current theme:', error);
        }
        
        this.renderThemes();
    }

    renderThemes() {
        const container = document.getElementById('themesGrid');
        if (!container) return;

        container.innerHTML = this.themes.map(theme => `
            <div class="theme-card bg-white rounded-lg shadow-sm border-2 ${theme.id === this.currentTheme ? 'border-blue-500' : 'border-gray-200'} overflow-hidden hover:shadow-lg transition-all">
                <div class="aspect-w-16 aspect-h-10 bg-gray-100">
                    <div class="w-full h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center" style="background: linear-gradient(135deg, ${theme.color}20, ${theme.color}10)">
                        <div class="text-center">
                            <div class="w-16 h-16 mx-auto mb-2 rounded-lg" style="background-color: ${theme.color}"></div>
                            <div class="w-20 h-2 bg-gray-300 rounded mx-auto mb-1"></div>
                            <div class="w-16 h-2 bg-gray-200 rounded mx-auto"></div>
                        </div>
                    </div>
                </div>
                
                <div class="p-6">
                    <div class="flex items-center justify-between mb-2">
                        <h3 class="text-lg font-semibold text-gray-900">${theme.name}</h3>
                        ${theme.id === this.currentTheme ? `
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                <i class="fas fa-check mr-1"></i>
                                Active
                            </span>
                        ` : ''}
                    </div>
                    
                    <p class="text-sm text-gray-600 mb-4">${theme.description}</p>
                    
                    <div class="flex space-x-2">
                        ${theme.id === this.currentTheme ? `
                            <button class="flex-1 px-4 py-2 bg-gray-100 text-gray-500 rounded-lg cursor-not-allowed">
                                Current Theme
                            </button>
                        ` : `
                            <button onclick="themesManager.switchTheme('${theme.id}')" class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                                Activate Theme
                            </button>
                        `}
                        <button onclick="themesManager.previewTheme('${theme.id}')" class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    async switchTheme(themeId) {
        if (!confirm(`Switch to ${this.themes.find(t => t.id === themeId)?.name} theme? This will change your site's appearance immediately.`)) {
            return;
        }

        try {
            window.adminDashboard.showLoading(true);
            
            const response = await window.adminDashboard.apiRequest('/api/settings/theme', {
                method: 'POST',
                body: JSON.stringify({
                    theme: themeId
                })
            });

            if (response.success) {
                this.currentTheme = themeId;
                window.adminDashboard.showNotification(`Successfully switched to ${response.theme} theme`, 'success');
                this.renderThemes();
                
                // Update dashboard stats
                document.getElementById('currentTheme').textContent = themeId;
            } else {
                window.adminDashboard.showNotification('Failed to switch theme', 'error');
            }
        } catch (error) {
            console.error('Error switching theme:', error);
            window.adminDashboard.showNotification('Failed to switch theme', 'error');
        } finally {
            window.adminDashboard.showLoading(false);
        }
    }

    previewTheme(themeId) {
        const theme = this.themes.find(t => t.id === themeId);
        if (!theme || !window.adminDashboard.currentUser) return;

        // Open preview in new window
        const previewUrl = `${window.location.origin}/${window.adminDashboard.currentUser.slug}/?preview_theme=${themeId}`;
        window.open(previewUrl, '_blank', 'width=1200,height=800');
    }
}

// Initialize themes manager
document.addEventListener('DOMContentLoaded', () => {
    window.themesManager = new ThemesManager();
});