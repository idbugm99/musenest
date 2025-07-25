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
        
        // Check for impersonation session first
        const impersonationStatus = await this.checkImpersonationStatus();
        
        if (impersonationStatus.isImpersonating) {
            console.log('Impersonation session detected, proceeding as impersonated user');
            this.isImpersonating = true;
            this.impersonationData = impersonationStatus.data;
            
            // Generate temporary token for impersonated user
            try {
                const tokenResponse = await fetch('/api/impersonation/generate-token', {
                    method: 'POST',
                    credentials: 'include'
                });
                
                if (tokenResponse.ok) {
                    const tokenData = await tokenResponse.json();
                    if (tokenData.success) {
                        this.authToken = tokenData.token;
                        console.log('Generated impersonation token successfully');
                    }
                }
            } catch (error) {
                console.error('Failed to generate impersonation token:', error);
            }
        } else if (!this.authToken) {
            console.log('No auth token or impersonation session, redirecting to login');
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
            
            // Dispatch ready event for other modules
            window.dispatchEvent(new CustomEvent('adminDashboardReady'));
        } catch (error) {
            console.error('Initialization error:', error);
            if (!this.isImpersonating) {
                this.redirectToLogin();
            }
        }
    }

    async checkImpersonationStatus() {
        try {
            const response = await fetch('/api/impersonation/status', {
                method: 'GET',
                credentials: 'include' // Include cookies
            });
            
            if (response.ok) {
                const data = await response.json();
                return {
                    isImpersonating: data.success && data.data.is_impersonating,
                    data: data.success ? data.data : null
                };
            }
        } catch (error) {
            console.error('Error checking impersonation status:', error);
        }
        
        return { isImpersonating: false, data: null };
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
            case 'pages':
                if (window.pageManager) {
                    await window.pageManager.loadPageContent();
                }
                break;
            case 'calendar':
                if (window.calendarManager) {
                    await window.calendarManager.loadCalendarEvents();
                }
                break;
        }
    }

    async loadDashboardData() {
        try {
            // Load admin stats from the new endpoint
            const statsResponse = await this.apiRequest('/api/admin/stats').catch(() => ({
                gallery_images: 0,
                faq_items: 0,
                testimonials: 0,
                page_sections: 0,
                current_theme: 'basic'
            }));

            // Update stats
            document.getElementById('galleryCount').textContent = statsResponse.gallery_images || '0';
            document.getElementById('faqCount').textContent = statsResponse.faq_items || '0';
            document.getElementById('testimonialsCount').textContent = statsResponse.testimonials || '0';
            document.getElementById('pageSectionsCount').textContent = statsResponse.page_sections || '0';
            document.getElementById('calendarEventsCount').textContent = statsResponse.calendar_events || '0';
            document.getElementById('currentTheme').textContent = statsResponse.current_theme || 'basic';

        } catch (error) {
            console.error('Error loading dashboard data:', error);
            // Set default values on error
            document.getElementById('galleryCount').textContent = '0';
            document.getElementById('faqCount').textContent = '0';
            document.getElementById('testimonialsCount').textContent = '0';
            document.getElementById('pageSectionsCount').textContent = '0';
            document.getElementById('calendarEventsCount').textContent = '0';
            document.getElementById('currentTheme').textContent = 'basic';
        }
    }

    async apiRequest(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        console.log('ApiRequest - URL:', url);
        console.log('ApiRequest - Token:', this.authToken ? 'Present' : 'Missing');
        console.log('ApiRequest - Impersonating:', this.isImpersonating ? 'Yes' : 'No');
        
        const defaultHeaders = {
            'Content-Type': 'application/json'
        };

        // Add Authorization header if we have a token (whether impersonating or not)
        if (this.authToken) {
            defaultHeaders['Authorization'] = `Bearer ${this.authToken}`;
        }

        const config = {
            method: 'GET',
            headers: { ...defaultHeaders, ...options.headers },
            credentials: 'include', // Always include cookies for impersonation
            ...options
        };

        console.log('ApiRequest - Config:', config);

        try {
            console.log('ApiRequest - Making fetch request to:', url);
            const response = await fetch(url, config);
            console.log('ApiRequest - Response status:', response.status);
            console.log('ApiRequest - Response headers:', Object.fromEntries(response.headers.entries()));
            const data = await response.json();
            console.log('ApiRequest - Response data:', data);
            
            if (response.status === 401 && !this.isImpersonating) {
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

// Global utility functions for other modules
window.showNotification = function(message, type = 'info') {
    if (window.adminDashboard) {
        window.adminDashboard.showNotification(message, type);
    }
};

window.showLoading = function(show = true) {
    if (window.adminDashboard) {
        window.adminDashboard.showLoading(show);
    }
};