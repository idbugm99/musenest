class ImpersonationManager {
    constructor() {
        this.isImpersonating = false;
        this.impersonationData = null;
        this.checkInterval = null;
        
        this.init();
    }

    init() {
        this.checkImpersonationStatus();
        this.setupEventListeners();
        
        // Check status every 30 seconds
        this.checkInterval = setInterval(() => {
            this.checkImpersonationStatus();
        }, 30000);
    }

    setupEventListeners() {
        // End impersonation button
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-end-impersonation]')) {
                this.endImpersonation();
            }
        });

        // ESC key to end impersonation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isImpersonating && e.ctrlKey) {
                this.endImpersonation();
            }
        });
    }

    async checkImpersonationStatus() {
        try {
            const response = await fetch('/api/impersonation/status');
            const data = await response.json();

            if (data.success && data.data.is_impersonating) {
                this.isImpersonating = true;
                this.impersonationData = data.data;
                this.showImpersonationBanner();
            } else {
                this.isImpersonating = false;
                this.impersonationData = null;
                this.hideImpersonationBanner();
            }
        } catch (error) {
            console.error('Error checking impersonation status:', error);
        }
    }

    showImpersonationBanner() {
        // Remove existing banner
        this.hideImpersonationBanner();

        const banner = document.createElement('div');
        banner.id = 'impersonation-banner';
        banner.className = 'fixed top-0 left-0 right-0 z-50 bg-red-600 text-white px-4 py-3 shadow-lg';
        banner.innerHTML = `
            <div class="flex items-center justify-between max-w-7xl mx-auto">
                <div class="flex items-center space-x-4">
                    <div class="flex items-center space-x-2">
                        <i class="fas fa-user-shield text-xl"></i>
                        <span class="font-semibold">IMPERSONATION MODE</span>
                    </div>
                    <div class="text-sm">
                        <span>Viewing as: <strong>${this.impersonationData.impersonated_model}</strong></span>
                        <span class="ml-4">Admin: <strong>${this.impersonationData.admin_name}</strong></span>
                        <span class="ml-4">Started: ${new Date(this.impersonationData.started_at).toLocaleTimeString()}</span>
                    </div>
                </div>
                <div class="flex items-center space-x-3">
                    ${this.impersonationData.restrictions && Object.keys(this.impersonationData.restrictions).length > 0 ? 
                        '<span class="bg-red-700 px-2 py-1 rounded text-xs">RESTRICTED</span>' : 
                        '<span class="bg-red-700 px-2 py-1 rounded text-xs">FULL ACCESS</span>'
                    }
                    <button data-end-impersonation class="bg-red-700 hover:bg-red-800 px-3 py-1 rounded text-sm font-medium transition-colors">
                        <i class="fas fa-times mr-1"></i>
                        End Impersonation
                    </button>
                </div>
            </div>
        `;

        // Add to top of body and adjust page layout
        document.body.insertBefore(banner, document.body.firstChild);
        document.body.style.paddingTop = '60px';

        // Add impersonation class to body for styling
        document.body.classList.add('impersonating');
    }

    hideImpersonationBanner() {
        const banner = document.getElementById('impersonation-banner');
        if (banner) {
            banner.remove();
            document.body.style.paddingTop = '';
            document.body.classList.remove('impersonating');
        }
    }

    async startImpersonation(modelId, restrictions = {}, destination = 'paysite') {
        try {
            const response = await fetch('/api/impersonation/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model_id: modelId,
                    restrictions: restrictions,
                    destination: destination
                })
            });

            const data = await response.json();

            if (data.success) {
                const modelSlug = data.data.impersonated_model.slug;
                const redirectUrl = data.data.redirect_url;
                
                // Show different messages based on destination
                if (destination === 'admin') {
                    this.showNotification(`Impersonation started - Redirecting to ${modelSlug}'s admin panel`, 'success');
                } else {
                    this.showNotification(`Impersonation started - Redirecting to ${modelSlug}'s paysite`, 'success');
                }
                
                // Redirect using the provided URL from server
                setTimeout(() => {
                    window.location.href = redirectUrl || `/${modelSlug}`;
                }, 1000);
                
                return data;
            } else {
                this.showNotification(data.error || 'Failed to start impersonation', 'error');
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Error starting impersonation:', error);
            this.showNotification('Failed to start impersonation', 'error');
            throw error;
        }
    }

    async endImpersonation() {
        try {
            const response = await fetch('/api/impersonation/end', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success) {
                this.isImpersonating = false;
                this.impersonationData = null;
                this.hideImpersonationBanner();
                this.showNotification('Impersonation ended successfully', 'success');
                
                // Redirect back to admin
                setTimeout(() => {
                    window.location.href = '/admin/system-management.html';
                }, 1000);
                
                return data;
            } else {
                this.showNotification(data.error || 'Failed to end impersonation', 'error');
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Error ending impersonation:', error);
            this.showNotification('Failed to end impersonation', 'error');
            throw error;
        }
    }

    showNotification(message, type = 'info') {
        // Create notification container if it doesn't exist
        let container = document.getElementById('impersonation-notifications');
        if (!container) {
            container = document.createElement('div');
            container.id = 'impersonation-notifications';
            container.className = 'fixed top-20 right-4 z-50 space-y-2';
            document.body.appendChild(container);
        }

        const id = Math.random().toString(36).substr(2, 9);
        
        const colors = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            warning: 'bg-yellow-500',
            info: 'bg-blue-500'
        };

        const notification = document.createElement('div');
        notification.id = id;
        notification.className = `${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg flex items-center justify-between max-w-sm`;
        notification.innerHTML = `
            <span>${message}</span>
            <button onclick="document.getElementById('${id}').remove()" class="ml-4 text-white hover:text-gray-200">
                <i class="fas fa-times"></i>
            </button>
        `;

        container.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            const el = document.getElementById(id);
            if (el) el.remove();
        }, 5000);
    }

    // Add visual restrictions indicator to forms
    addRestrictionIndicators() {
        if (!this.isImpersonating || !this.impersonationData.restrictions) return;

        const restrictions = this.impersonationData.restrictions;

        // Mark read-only fields
        if (restrictions.read_only_fields) {
            restrictions.read_only_fields.forEach(fieldName => {
                const inputs = document.querySelectorAll(`[name="${fieldName}"], #${fieldName}`);
                inputs.forEach(input => {
                    input.readOnly = true;
                    input.classList.add('bg-gray-100', 'cursor-not-allowed');
                    
                    // Add visual indicator
                    const indicator = document.createElement('span');
                    indicator.className = 'text-red-500 text-xs ml-2';
                    indicator.innerHTML = '<i class="fas fa-lock"></i> Read-only during impersonation';
                    input.parentNode.appendChild(indicator);
                });
            });
        }

        // Disable blocked actions
        if (restrictions.blocked_actions) {
            restrictions.blocked_actions.forEach(action => {
                const buttons = document.querySelectorAll(`[data-action="${action}"], .${action}-btn`);
                buttons.forEach(button => {
                    button.disabled = true;
                    button.classList.add('opacity-50', 'cursor-not-allowed');
                    button.title = `Action blocked during impersonation`;
                });
            });
        }
    }

    // Check if current route is blocked
    isCurrentRouteBlocked() {
        if (!this.isImpersonating || !this.impersonationData.restrictions) return false;

        const restrictions = this.impersonationData.restrictions;
        if (!restrictions.blocked_routes) return false;

        const currentPath = window.location.pathname;
        
        return restrictions.blocked_routes.some(route => {
            if (route.includes('*')) {
                const pattern = route.replace(/\*/g, '.*');
                return new RegExp(`^${pattern}$`).test(currentPath);
            }
            return currentPath.startsWith(route);
        });
    }

    // Block page access if restricted
    blockRestrictedPage() {
        if (this.isCurrentRouteBlocked()) {
            document.body.innerHTML = `
                <div class="min-h-screen flex items-center justify-center bg-gray-100">
                    <div class="text-center">
                        <div class="text-red-500 text-6xl mb-4">
                            <i class="fas fa-ban"></i>
                        </div>
                        <h1 class="text-2xl font-bold text-gray-800 mb-2">Access Restricted</h1>
                        <p class="text-gray-600 mb-4">This page is not accessible during impersonation.</p>
                        <button data-end-impersonation class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded">
                            End Impersonation
                        </button>
                    </div>
                </div>
            `;
        }
    }

    destroy() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }
        this.hideImpersonationBanner();
    }
}

// Global instance
let impersonationManager;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    impersonationManager = new ImpersonationManager();
    
    // Export to window object after initialization
    window.impersonationManager = impersonationManager;
    
    // Add restriction indicators after a short delay to ensure forms are loaded
    setTimeout(() => {
        impersonationManager.addRestrictionIndicators();
        impersonationManager.blockRestrictedPage();
    }, 500);
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (impersonationManager) {
        impersonationManager.destroy();
    }
});

// Export class for use in other scripts
window.ImpersonationManager = ImpersonationManager;