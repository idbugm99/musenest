/**
 * MuseNest Admin Dashboard - Main Controller
 */

class AdminDashboard {
    constructor() {
        this.currentUser = null;
        this.authToken = localStorage.getItem('musenest_token');
        // Force HTTP in development to avoid HTTPS issues
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            this.baseURL = `http://${window.location.hostname}:${window.location.port || 3000}`;
        } else {
            this.baseURL = window.location.origin;
        }
        this.currentTab = 'dashboard';
        this.isRedirecting = false;
        
        this.init();
    }

    async init() {
        console.log('Initializing admin dashboard...');
        console.log('Auth token:', this.authToken ? 'Present' : 'Missing');
        
        // Check authentication
        if (!this.authToken) {
            console.log('No auth token, redirecting to login');
            this.redirectToLogin();
            return;
        }

        // Verify token and load user
        try {
            await this.loadCurrentUser();
            console.log('User loaded, setting up event listeners...');
            this.setupEventListeners();
            console.log('Loading dashboard data...');
            this.loadDashboardData();
            console.log('Dashboard initialization complete');
        } catch (error) {
            console.error('Initialization error:', error);
            this.redirectToLogin();
        }
    }

    async loadCurrentUser() {
        try {
            console.log('Loading current user...');
            const response = await this.apiRequest('/api/auth/me');
            console.log('API response:', response);
            if (response.user) {
                this.currentUser = response.user;
                console.log('User loaded successfully:', this.currentUser);
                this.updateUserDisplay();
                this.updateViewSiteLink();
            } else {
                console.error('No user in response:', response);
                throw new Error('Failed to load user');
            }
        } catch (error) {
            console.error('loadCurrentUser error:', error);
            throw new Error('Authentication failed');
        }
    }

    updateUserDisplay() {
        console.log('Updating user display...');
        const userName = document.getElementById('userName');
        const userInitials = document.getElementById('userInitials');
        console.log('userName element:', userName);
        console.log('userInitials element:', userInitials);
        
        if (this.currentUser) {
            // Use email as display name if name is not available
            const displayName = this.currentUser.name || this.currentUser.email;
            userName.textContent = displayName;
            
            // Generate initials from display name
            const initials = displayName
                .replace(/@.*$/, '') // Remove email domain if it's an email
                .split(/[\s@.]/)
                .filter(part => part.length > 0)
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .substring(0, 2);
            userInitials.textContent = initials;
        }
    }

    updateViewSiteLink() {
        const viewSiteBtn = document.getElementById('viewSiteBtn');
        if (this.currentUser && this.currentUser.models && this.currentUser.models.length > 0) {
            // Use the first model's slug
            viewSiteBtn.href = `${this.baseURL}/${this.currentUser.models[0].slug}/`;
        } else {
            // Fallback or disable the button
            if (viewSiteBtn) {
                viewSiteBtn.style.display = 'none';
            }
        }
    }

    setupEventListeners() {
        // Sidebar toggle
        document.getElementById('sidebarToggle').addEventListener('click', this.toggleSidebar.bind(this));
        
        // Logout
        document.getElementById('logoutBtn').addEventListener('click', this.logout.bind(this));
        
        // Navigation tabs
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = item.dataset.tab;
                this.switchTab(tab);
            });
        });

        // Quick action buttons
        document.querySelectorAll('.quick-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = btn.dataset.tab;
                this.switchTab(tab);
            });
        });

        // Handle responsive sidebar
        this.handleResponsiveSidebar();
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('mainContent');
        
        sidebar.classList.toggle('collapsed');
        
        if (sidebar.classList.contains('collapsed')) {
            mainContent.classList.remove('ml-64');
            mainContent.classList.add('ml-0');
        } else {
            mainContent.classList.remove('ml-0');
            mainContent.classList.add('ml-64');
        }
    }

    handleResponsiveSidebar() {
        const mediaQuery = window.matchMedia('(max-width: 768px)');
        
        const handleMediaChange = (e) => {
            const sidebar = document.getElementById('sidebar');
            const mainContent = document.getElementById('mainContent');
            
            if (e.matches) {
                // Mobile view
                sidebar.classList.add('collapsed');
                mainContent.classList.remove('ml-64');
                mainContent.classList.add('ml-0');
            } else {
                // Desktop view
                sidebar.classList.remove('collapsed');
                mainContent.classList.remove('ml-0');
                mainContent.classList.add('ml-64');
            }
        };

        mediaQuery.addListener(handleMediaChange);
        handleMediaChange(mediaQuery); // Initial call
    }

    switchTab(tabName) {
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active', 'bg-blue-100', 'text-blue-700');
            item.classList.add('text-gray-700');
        });
        
        const activeNavItem = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeNavItem) {
            activeNavItem.classList.add('active', 'bg-blue-100', 'text-blue-700');
            activeNavItem.classList.remove('text-gray-700');
        }

        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });
        
        const targetTab = document.getElementById(`${tabName}-tab`);
        if (targetTab) {
            targetTab.classList.remove('hidden');
            this.currentTab = tabName;
            
            // Load tab-specific data
            this.loadTabData(tabName);
        }
    }

    async loadTabData(tabName) {
        switch (tabName) {
            case 'dashboard':
                await this.loadDashboardData();
                break;
            case 'gallery':
                if (window.galleryManager) {
                    await window.galleryManager.loadGalleryData();
                }
                break;
            case 'faq':
                if (window.faqManager) {
                    await window.faqManager.loadFAQs();
                }
                break;
            case 'testimonials':
                if (window.testimonialsManager) {
                    await window.testimonialsManager.loadTestimonials();
                }
                break;
            case 'settings':
                if (window.settingsManager) {
                    await window.settingsManager.loadSettings();
                }
                break;
            case 'themes':
                if (window.themesManager) {
                    await window.themesManager.loadThemes();
                }
                break;
        }
    }

    async loadDashboardData() {
        try {
            // Load stats in parallel
            const [galleryResponse, faqResponse, testimonialsResponse, settingsResponse] = await Promise.all([
                this.apiRequest('/api/gallery/images').catch(() => ({ success: false, images: [] })),
                this.apiRequest('/api/faq').catch(() => ({ success: false, faqs: [] })),
                this.apiRequest('/api/testimonials').catch(() => ({ success: false, testimonials: [] })),
                this.apiRequest('/api/settings').catch(() => ({ success: false, settings: {} }))
            ]);

            // Update stats
            document.getElementById('galleryCount').textContent = 
                galleryResponse.success ? galleryResponse.images.length : '0';
            
            document.getElementById('faqCount').textContent = 
                faqResponse.success ? faqResponse.faqs.length : '0';
            
            document.getElementById('testimonialsCount').textContent = 
                testimonialsResponse.success ? testimonialsResponse.testimonials.length : '0';

            // Update current theme
            if (settingsResponse.success && settingsResponse.settings.theme) {
                document.getElementById('currentTheme').textContent = 
                    settingsResponse.settings.theme.value;
            }

        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    }

    async apiRequest(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const defaultHeaders = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.authToken}`
        };

        const config = {
            method: 'GET',
            headers: { ...defaultHeaders, ...options.headers },
            ...options
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();
            
            if (response.status === 401) {
                console.warn('Authentication failed, redirecting to login');
                this.redirectToLogin();
                throw new Error('Authentication required');
            }
            
            return data;
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    }

    logout() {
        localStorage.removeItem('musenest_token');
        this.redirectToLogin();
    }

    redirectToLogin() {
        if (this.isRedirecting) {
            return; // Prevent multiple redirects
        }
        this.isRedirecting = true;
        localStorage.removeItem('musenest_token');
        window.location.href = 'login.html';
    }

    showNotification(message, type = 'info') {
        const container = document.getElementById('notifications');
        const notification = document.createElement('div');
        
        const bgColor = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            warning: 'bg-yellow-500',
            info: 'bg-blue-500'
        }[type] || 'bg-blue-500';

        notification.className = `notification ${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center justify-between max-w-sm`;
        notification.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()" class="ml-4 text-white hover:text-gray-200">
                <i class="fas fa-times"></i>
            </button>
        `;

        container.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    showLoading(show = true) {
        const overlay = document.getElementById('loadingOverlay');
        if (show) {
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    }

    // Utility method for formatting dates
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Utility method for file size formatting
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Initialize admin dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.adminDashboard = new AdminDashboard();
});