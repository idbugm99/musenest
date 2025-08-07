/**
 * MuseNest System Admin Dashboard - Main Controller
 * Comprehensive system administration interface
 */

if (window.ComponentRegistryClient) {
    window.ComponentRegistryClient.register('system-admin-dashboard', 'admin/js/system-admin-dashboard.js');
}

class SystemAdminDashboard {
    constructor() {
        this.currentUser = null;
        this.authToken = localStorage.getItem('musenest_token');
        this.currentTab = 'overview';
        this.isRedirecting = false;
        
        this.init();
    }

    // Media queue pagination controls
    mqPrevPage() {
        if ((this.mediaQueuePage || 1) > 1) {
            this.mediaQueuePage -= 1;
            this.loadTabContent('media-queue');
        }
    }
    mqNextPage() {
        this.mediaQueuePage = (this.mediaQueuePage || 1) + 1;
        this.loadTabContent('media-queue');
    }
    mqChangePageSize(val) {
        const n = parseInt(val) || 20;
        this.mediaQueueLimit = n;
        localStorage.setItem('mq_page_size', String(n));
        this.mediaQueuePage = 1;
        this.loadTabContent('media-queue');
    }

    async init() {
        console.log('Initializing System Admin Dashboard...');
        
        // Verify admin access
        await this.verifyAdminAccess();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load initial content
        this.switchTab('overview');
        
        console.log('System Admin Dashboard initialized');
    }

    async verifyAdminAccess() {
        try {
            if (!this.authToken) {
                this.redirectToLogin();
                return;
            }

            const response = await sysFetch('/api/auth/me', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Authentication failed');
            }

            const data = await response.json();
            this.currentUser = data.user;
            
            // Verify admin/sysadmin role
            if (this.currentUser.role !== 'admin' && this.currentUser.role !== 'sysadmin') {
                alert('Access Denied: System Administrator privileges required.');
                window.location.href = 'index.html';
                return;
            }

            this.updateUserDisplay();
            console.log('Admin access verified for:', this.currentUser.email);

        } catch (error) {
            console.error('Admin verification failed:', error);
            this.redirectToLogin();
        }
    }

    updateUserDisplay() {
        const userName = document.getElementById('userName');
        const userInitials = document.getElementById('userInitials');
        
        if (this.currentUser) {
            const displayName = this.currentUser.email;
            userName.textContent = displayName;
            
            const initials = displayName
                .replace(/@.*$/, '')
                .split(/[\\s@.]/)
                .filter(part => part.length > 0)
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .substring(0, 2);
                
            userInitials.textContent = initials;
        }
    }

    setupEventListeners() {
        // Navigation items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = item.dataset.tab;
                if (tab) {
                    this.switchTab(tab);
                }
            });
        });

        // Logout button
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });

        // Top bar buttons
        document.getElementById('notificationsBtn').addEventListener('click', () => {
            this.showNotifications();
        });

        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.switchTab('system-settings');
        });
    }

    switchTab(tabName) {
        // Update active navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeItem = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
        }

        // Update page title and description
        this.updatePageHeader(tabName);
        
        // Load content for the selected tab
        this.loadTabContent(tabName);
        
        this.currentTab = tabName;
    }

    updatePageHeader(tabName) {
        const pageTitle = document.getElementById('pageTitle');
        const pageDescription = document.getElementById('pageDescription');
        
        const tabInfo = {
            'overview': {
                title: 'System Overview',
                description: 'Comprehensive system administration and management dashboard'
            },
            'client-accounts': {
                title: 'Client Account Management',
                description: 'Manage all client accounts, subscriptions, and access permissions'
            },
            'model-screening': {
                title: 'Model Screening & Verification',
                description: 'Review and approve model applications, documents, and compliance'
            },
            'verification-queue': {
                title: 'Verification Queue',
                description: 'Process pending verifications for photos, documents, and compliance'
            },
            'subscription-management': {
                title: 'Subscription & Billing Management',
                description: 'Manage subscription plans, billing, and payment processing'
            },
            'revenue-tracking': {
                title: 'Revenue Tracking & Analytics',
                description: 'Monitor platform revenue, payouts, and financial performance'
            },
            'whitelabel-partners': {
                title: 'Whitelabel Partner Management',
                description: 'Manage partner accounts, revenue sharing, and white-label configurations'
            },
            'template-builder': {
                title: 'Template Set Builder',
                description: 'Create and manage website templates and theme configurations'
            },
            'content-moderation': {
                title: 'Content Moderation',
                description: 'AI-powered content moderation and human review queue management'
            },
            'media-queue': {
                title: 'Media Review Queue',
                description: 'Review flagged media content with AI analysis and moderation actions'
            },
            'blurred-approved': {
                title: 'Blurred & Approved Media',
                description: 'View approved media content with applied blur effects'
            },
            'rejected-removed': {
                title: 'Rejected & Removed Media',
                description: 'Review rejected media content and removal actions'
            },
            'staff-management': {
                title: 'Staff & User Management',
                description: 'Manage staff accounts, permissions, and access control'
            },
            'system-settings': {
                title: 'System Configuration',
                description: 'Configure system-wide settings, security, and operational parameters'
            },
            'financial-reports': {
                title: 'Financial Reports',
                description: 'Generate financial reports, tax documents, and compliance records'
            },
            'audit-logs': {
                title: 'System Audit Logs',
                description: 'Review system activity, security events, and administrative actions'
            }
        };

        const info = tabInfo[tabName] || tabInfo['overview'];
        pageTitle.textContent = info.title;
        pageDescription.textContent = info.description;
    }

    async loadTabContent(tabName) {
        const contentArea = document.getElementById('content-area');
        this.showLoading(true);

        try {
            let content = '';
            
            switch (tabName) {
                case 'overview':
                    content = await this.loadOverviewContent();
                    break;
                case 'client-accounts':
                    content = await this.loadClientAccountsContent();
                    break;
                case 'model-screening':
                    content = await this.loadModelScreeningContent();
                    break;
                case 'verification-queue':
                    content = await this.loadVerificationQueueContent();
                    break;
                case 'subscription-management':
                    content = await this.loadSubscriptionManagementContent();
                    break;
                case 'revenue-tracking':
                    content = await this.loadRevenueTrackingContent();
                    break;
                case 'whitelabel-partners':
                    content = await this.loadWhitelabelPartnersContent();
                    break;
                case 'template-builder':
                    content = await this.loadTemplateBuilderContent();
                    break;
                case 'content-moderation':
                    content = await this.loadContentModerationContent();
                    break;
                case 'media-queue':
                    content = await this.loadMediaQueueContent();
                    break;
                case 'blurred-approved':
                    console.log('🎯 About to call loadBlurredApprovedContent function');
                    console.log('🔍 Function exists?', typeof this.loadBlurredApprovedContent);
                    try {
                        content = await this.loadBlurredApprovedContent();
                        console.log('✅ loadBlurredApprovedContent returned:', content ? `${content.length} characters` : 'null/empty');
                    } catch (error) {
                        console.error('❌ loadBlurredApprovedContent failed:', error);
                        content = `<div>Error: ${error.message}</div>`;
                    }
                    break;
                case 'rejected-removed':
                    content = await this.loadRejectedRemovedContent();
                    break;
                case 'staff-management':
                    content = await this.loadStaffManagementContent();
                    break;
                case 'system-settings':
                    content = await this.loadSystemSettingsContent();
                    break;
                case 'financial-reports':
                    content = await this.loadFinancialReportsContent();
                    break;
                case 'audit-logs':
                    content = await this.loadAuditLogsContent();
                    break;
                default:
                    content = await this.loadOverviewContent();
            }
            
            contentArea.innerHTML = content;
            
            // Initialize any tab-specific functionality
            this.initializeTabFunctionality(tabName);
            
        } catch (error) {
            console.error('Error loading tab content:', error);
            contentArea.innerHTML = `
                <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div class="flex">
                        <div class="flex-shrink-0">
                            <i class="fas fa-exclamation-triangle text-red-400"></i>
                        </div>
                        <div class="ml-3">
                            <h3 class="text-sm font-medium text-red-800">Error Loading Content</h3>
                            <div class="mt-2 text-sm text-red-700">
                                <p>Failed to load content for this section. Please try again.</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } finally {
            this.showLoading(false);
        }
    }

    async loadOverviewContent() {
        // Load system statistics
        const stats = await this.loadSystemStats();
        
        return `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <!-- Total Clients -->
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <i class="fas fa-users text-blue-500 text-2xl"></i>
                        </div>
                        <div class="ml-4">
                            <p class="text-sm text-gray-600">Total Clients</p>
                            <p class="text-2xl font-bold text-gray-900">${stats.total_clients || 0}</p>
                        </div>
                    </div>
                </div>

                <!-- Active Subscriptions -->
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <i class="fas fa-credit-card text-green-500 text-2xl"></i>
                        </div>
                        <div class="ml-4">
                            <p class="text-sm text-gray-600">Active Subscriptions</p>
                            <p class="text-2xl font-bold text-gray-900">${stats.active_subscriptions || 0}</p>
                        </div>
                    </div>
                </div>

                <!-- Pending Verifications -->
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <i class="fas fa-clock text-yellow-500 text-2xl"></i>
                        </div>
                        <div class="ml-4">
                            <p class="text-sm text-gray-600">Pending Verifications</p>
                            <p class="text-2xl font-bold text-gray-900">${stats.pending_verifications || 0}</p>
                        </div>
                    </div>
                </div>

                <!-- Monthly Revenue -->
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <i class="fas fa-dollar-sign text-purple-500 text-2xl"></i>
                        </div>
                        <div class="ml-4">
                            <p class="text-sm text-gray-600">Monthly Revenue</p>
                            <p class="text-2xl font-bold text-gray-900">$${stats.monthly_revenue || 0}</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Quick Actions -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <!-- Recent Activity -->
                <div class="bg-white rounded-lg shadow">
                    <div class="px-6 py-4 border-b border-gray-200">
                        <h3 class="text-lg font-medium text-gray-900">Recent Activity</h3>
                    </div>
                    <div class="p-6">
                        <div class="space-y-4">
                            <div class="flex items-start">
                                <div class="flex-shrink-0">
                                    <i class="fas fa-user-plus text-green-500"></i>
                                </div>
                                <div class="ml-3">
                                    <p class="text-sm text-gray-900">New model registration: <strong>Jessica Smith</strong></p>
                                    <p class="text-xs text-gray-500">2 hours ago</p>
                                </div>
                            </div>
                            <div class="flex items-start">
                                <div class="flex-shrink-0">
                                    <i class="fas fa-credit-card text-blue-500"></i>
                                </div>
                                <div class="ml-3">
                                    <p class="text-sm text-gray-900">Subscription upgraded: <strong>Amanda Wilson</strong></p>
                                    <p class="text-xs text-gray-500">4 hours ago</p>
                                </div>
                            </div>
                            <div class="flex items-start">
                                <div class="flex-shrink-0">
                                    <i class="fas fa-exclamation-triangle text-yellow-500"></i>
                                </div>
                                <div class="ml-3">
                                    <p class="text-sm text-gray-900">Content flagged for review</p>
                                    <p class="text-xs text-gray-500">6 hours ago</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- System Health -->
                <div class="bg-white rounded-lg shadow">
                    <div class="px-6 py-4 border-b border-gray-200">
                        <h3 class="text-lg font-medium text-gray-900">System Health</h3>
                    </div>
                    <div class="p-6">
                        <div class="space-y-4">
                            <div class="flex items-center justify-between">
                                <span class="text-sm text-gray-600">Server Status</span>
                                <span class="status-badge status-active">Operational</span>
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="text-sm text-gray-600">Database</span>
                                <span class="status-badge status-active">Connected</span>
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="text-sm text-gray-600">Payment Processing</span>
                                <span class="status-badge status-active">Active</span>
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="text-sm text-gray-600">Content Delivery</span>
                                <span class="status-badge status-active">Optimal</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async loadClientsData() {
        try {
            const page = this.clientsPage || 1;
            const limit = this.clientsLimit || parseInt(localStorage.getItem('clients_page_size') || '25');
            const response = await sysFetch(`/api/system-management/clients?page=${page}&limit=${limit}`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                const clients = data.data?.clients || [];
                const pagination = data.data?.pagination || { current_page: page, per_page: limit, total: clients.length, total_pages: 1 };
                this.clientsPage = pagination.current_page;
                this.clientsLimit = pagination.per_page;
                
                return {
                    clients,
                    pagination,
                    activeSubscriptions: clients.filter(c => c.status === 'active' || c.subscription_status === 'active').length,
                    adminAccounts: clients.filter(c => c.status === 'admin' || (c.slug && (c.slug.includes('admin') || c.slug.includes('example')))).length,
                    templateAccounts: clients.filter(c => c.slug && (c.slug.includes('template') || c.slug.includes('model') || c.slug.includes('cam'))).length
                };
            }
        } catch (error) {
            console.error('Error loading clients data:', error);
        }
        
        return { clients: [], pagination: { current_page: 1, per_page: 25, total: 0, total_pages: 0 }, activeSubscriptions: 0, adminAccounts: 0, templateAccounts: 0 };
    }

    async loadBusinessTypes() {
        try {
            const response = await sysFetch('/api/system-management/business-types', {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                return data.data || [];
            }
        } catch (error) {
            console.error('Error loading business types:', error);
        }
        
        // Fallback business types
        return [
            { id: 1, display_name: 'Escort Service' },
            { id: 2, display_name: 'Cam Model' },
            { id: 3, display_name: 'Adult Entertainment' },
            { id: 4, display_name: 'Adult Services' },
            { id: 5, display_name: 'Other' }
        ];
    }

    renderClientsTable(clients) {
        if (!clients || clients.length === 0) {
            return `
                <tr>
                    <td colspan="8" class="px-6 py-12 text-center text-gray-500">
                        <i class="fas fa-users text-4xl mb-4 text-gray-300"></i>
                        <p>No clients found</p>
                    </td>
                </tr>
            `;
        }

        return clients.map(client => {
            const statusBadge = this.getStatusBadge(client.status);
            const typeBadge = this.getTypeBadge(client);
            const createdDate = new Date(client.created_at).toLocaleDateString();
            
            return `
                <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 whitespace-nowrap">
                        <input type="checkbox" class="client-checkbox rounded border-gray-300" value="${client.id}">
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex items-center">
                            <div class="flex-shrink-0 h-8 w-8">
                                <div class="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
                                    <span class="text-white text-sm font-medium">
                                        ${(client.name || client.email || 'U').charAt(0).toUpperCase()}
                                    </span>
                                </div>
                            </div>
                            <div class="ml-4">
                                <div class="text-sm font-medium text-gray-900">${client.name || 'Unnamed Client'}</div>
                                <div class="text-sm text-gray-500">${client.email || 'No email'}</div>
                                <div class="text-xs text-gray-400">Slug: ${client.slug || 'No slug'}</div>
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        ${statusBadge}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        ${typeBadge}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${client.subscription_status || 'None'}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${client.business_type || 'Not specified'}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${createdDate}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div class="flex space-x-2">
                            <button onclick="editClient(${client.id})" class="text-blue-600 hover:text-blue-900" title="Edit Client">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="impersonateClient(${client.id})" class="text-green-600 hover:text-green-900" title="Impersonate">
                                <i class="fas fa-user-secret"></i>
                            </button>
                            <button onclick="deleteClient(${client.id})" class="text-red-600 hover:text-red-900" title="Delete Client">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    getStatusBadge(status) {
        const badges = {
            'active': '<span class="status-badge status-active">Active</span>',
            'trial': '<span class="status-badge bg-blue-100 text-blue-800">Trial</span>',
            'suspended': '<span class="status-badge status-suspended">Suspended</span>',
            'inactive': '<span class="status-badge bg-gray-100 text-gray-800">Inactive</span>',
            'admin': '<span class="status-badge bg-purple-100 text-purple-800">Administrative</span>'
        };
        return badges[status] || '<span class="status-badge bg-gray-100 text-gray-800">Unknown</span>';
    }

    getTypeBadge(client) {
        if (client.status === 'admin') {
            if (client.slug?.includes('example')) {
                return '<span class="status-badge bg-orange-100 text-orange-800">Demo Account</span>';
            } else if (client.slug?.includes('template')) {
                return '<span class="status-badge bg-indigo-100 text-indigo-800">Template Account</span>';
            } else {
                return '<span class="status-badge bg-purple-100 text-purple-800">Administrative</span>';
            }
        }
        return '<span class="status-badge bg-green-100 text-green-800">Live Client</span>';
    }

    // Clients pagination controls
    clientsPrevPage() {
        if ((this.clientsPage || 1) > 1) {
            this.clientsPage -= 1;
            this.switchTab('client-accounts');
        }
    }
    clientsNextPage() {
        this.clientsPage = (this.clientsPage || 1) + 1;
        this.switchTab('client-accounts');
    }
    clientsChangePageSize(val) {
        const n = parseInt(val) || 25;
        this.clientsLimit = n;
        localStorage.setItem('clients_page_size', String(n));
        this.clientsPage = 1;
        this.switchTab('client-accounts');
    }

    getClientManagementModals(businessTypes) {
        return `
            <!-- Edit Client Modal -->
            <div id="editClientModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full hidden z-50">
                <div class="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white modal">
                    <div class="mt-3">
                        <div class="flex items-center justify-between mb-4">
                            <h3 class="text-lg font-medium text-gray-900">Edit Client Account</h3>
                            <button onclick="closeModal('editClientModal')" class="text-gray-400 hover:text-gray-600">
                                <i class="fas fa-times text-xl"></i>
                            </button>
                        </div>
                        
                        <form id="editClientForm" class="space-y-4">
                            <input type="hidden" id="editClientId">
                            
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Display Name</label>
                                    <input type="text" id="editDisplayName" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Email/Username</label>
                                    <input type="email" id="editEmail" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500">
                                </div>
                            </div>
                            
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Status</label>
                                    <select id="editStatus" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500">
                                        <option value="active">Active</option>
                                        <option value="trial">Trial</option>
                                        <option value="suspended">Suspended</option>
                                        <option value="inactive">Inactive</option>
                                        <option value="admin">Administrative</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Business Type</label>
                                    <select id="editBusinessType" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500">
                                        <option value="">Select Business Type</option>
                                        ${businessTypes.map(type => `<option value="${type.id}">${type.display_name}</option>`).join('')}
                                    </select>
                                </div>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">New Password (leave blank to keep current)</label>
                                <input type="password" id="editPassword" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="Enter new password or leave blank">
                            </div>
                            
                            <div class="flex justify-end space-x-3 pt-4">
                                <button type="button" onclick="closeModal('editClientModal')" class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
                                    Cancel
                                </button>
                                <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
    }

    async loadClientAccountsContent() {
        try {
            // Load clients data
            const clientsData = await this.loadClientsData();
            const businessTypes = await this.loadBusinessTypes();
            
            return `
                <!-- Statistics Dashboard -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div class="bg-white rounded-lg shadow p-6">
                        <div class="flex items-center">
                            <div class="flex-shrink-0">
                                <i class="fas fa-users text-blue-500 text-2xl"></i>
                            </div>
                            <div class="ml-4">
                                <p class="text-sm text-gray-600">Total Clients</p>
                                <p class="text-2xl font-bold text-gray-900">${clientsData.total || 0}</p>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white rounded-lg shadow p-6">
                        <div class="flex items-center">
                            <div class="flex-shrink-0">
                                <i class="fas fa-credit-card text-green-500 text-2xl"></i>
                            </div>
                            <div class="ml-4">
                                <p class="text-sm text-gray-600">Active Subscriptions</p>
                                <p class="text-2xl font-bold text-gray-900">${clientsData.activeSubscriptions || 0}</p>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white rounded-lg shadow p-6">
                        <div class="flex items-center">
                            <div class="flex-shrink-0">
                                <i class="fas fa-clock text-yellow-500 text-2xl"></i>
                            </div>
                            <div class="ml-4">
                                <p class="text-sm text-gray-600">Administrative Accounts</p>
                                <p class="text-2xl font-bold text-gray-900">${clientsData.adminAccounts || 0}</p>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white rounded-lg shadow p-6">
                        <div class="flex items-center">
                            <div class="flex-shrink-0">
                                <i class="fas fa-user-shield text-purple-500 text-2xl"></i>
                            </div>
                            <div class="ml-4">
                                <p class="text-sm text-gray-600">Template Accounts</p>
                                <p class="text-2xl font-bold text-gray-900">${clientsData.templateAccounts || 0}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Search and Filters -->
                <div class="bg-white rounded-lg shadow mb-6">
                    <div class="p-6 border-b border-gray-200">
                        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                            <div class="flex-1 max-w-lg">
                                <div class="relative">
                                    <input type="text" id="clientSearchInput" placeholder="Search clients by name, email, or slug..." 
                                           class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500">
                                    <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <i class="fas fa-search text-gray-400"></i>
                                    </div>
                                </div>
                            </div>
                            <div class="flex space-x-3">
                                <select id="statusFilter" class="border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500">
                                    <option value="">All Status</option>
                                    <option value="active">Active</option>
                                    <option value="trial">Trial</option>
                                    <option value="suspended">Suspended</option>
                                    <option value="inactive">Inactive</option>
                                    <option value="admin">Administrative</option>
                                </select>
                                <select id="typeFilter" class="border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500">
                                    <option value="">All Types</option>
                                    <option value="live">Live Clients</option>
                                    <option value="demo">Demo Accounts</option>
                                    <option value="template">Template Accounts</option>
                                </select>
                                <button id="exportClientsBtn" class="border border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50 text-gray-700">
                                    <i class="fas fa-download mr-2"></i>
                                    Export
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Action Buttons -->
                <div class="flex justify-between items-center mb-6">
                    <div class="flex space-x-3">
                        <button id="testImpersonationBtn" class="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg flex items-center">
                            <i class="fas fa-flask mr-2"></i>
                            Test Impersonation
                        </button>
                        <button id="bulkActionsBtn" class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center">
                            <i class="fas fa-tasks mr-2"></i>
                            Bulk Actions
                        </button>
                    </div>
                    <button id="addClientBtn" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center">
                        <i class="fas fa-plus mr-2"></i>
                        Add Client
                    </button>
                </div>

                <!-- Clients Table -->
                <div class="bg-white rounded-lg shadow overflow-hidden">
                    <div class="min-w-full">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        <input type="checkbox" id="selectAllClients" class="rounded border-gray-300">
                                    </th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subscription</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Business Type</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="clientsTableBody" class="bg-white divide-y divide-gray-200">
                                ${this.renderClientsTable(clientsData.clients || [])}
                            </tbody>
                        </table>
                    </div>

                    <!-- Pagination -->
                    <div class="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                        <div class="text-sm text-gray-700">
                            Page ${clientsData.pagination.current_page} of ${clientsData.pagination.total_pages} · Total ${clientsData.pagination.total}
                        </div>
                        <div class="space-x-2">
                            <button class="px-3 py-1 border rounded" onclick="window.systemAdminDashboard.clientsPrevPage()" ${clientsData.pagination.current_page <= 1 ? 'disabled' : ''}>Prev</button>
                            <button class="px-3 py-1 border rounded" onclick="window.systemAdminDashboard.clientsNextPage()" ${clientsData.pagination.current_page >= clientsData.pagination.total_pages ? 'disabled' : ''}>Next</button>
                            <select class="px-2 py-1 border rounded" onchange="window.systemAdminDashboard.clientsChangePageSize(this.value)">
                                ${[10,25,50,100].map(n => `<option value=\"${n}\" ${this.clientsLimit===n?'selected':''}>${n}/page</option>`).join('')}
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Modals will be added here -->
                ${this.getClientManagementModals(businessTypes)}
            `;
        } catch (error) {
            console.error('Error loading client accounts content:', error);
            return `
                <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div class="flex">
                        <div class="flex-shrink-0">
                            <i class="fas fa-exclamation-triangle text-red-400"></i>
                        </div>
                        <div class="ml-3">
                            <h3 class="text-sm font-medium text-red-800">Error Loading Client Data</h3>
                            <div class="mt-2 text-sm text-red-700">
                                <p>Failed to load client management interface. Please try again.</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    async loadModelScreeningContent() {
        return `
            <div class="space-y-6">
                <!-- Screening Dashboard -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="bg-white rounded-lg shadow p-6">
                        <div class="flex items-center">
                            <div class="flex-shrink-0">
                                <i class="fas fa-user-clock text-yellow-500 text-2xl"></i>
                            </div>
                            <div class="ml-4">
                                <p class="text-sm text-gray-600">Pending Applications</p>
                                <p class="text-2xl font-bold text-gray-900">12</p>
                            </div>
                        </div>
                    </div>
                    <div class="bg-white rounded-lg shadow p-6">
                        <div class="flex items-center">
                            <div class="flex-shrink-0">
                                <i class="fas fa-user-check text-green-500 text-2xl"></i>
                            </div>
                            <div class="ml-4">
                                <p class="text-sm text-gray-600">Approved Today</p>
                                <p class="text-2xl font-bold text-gray-900">3</p>
                            </div>
                        </div>
                    </div>
                    <div class="bg-white rounded-lg shadow p-6">
                        <div class="flex items-center">
                            <div class="flex-shrink-0">
                                <i class="fas fa-user-times text-red-500 text-2xl"></i>
                            </div>
                            <div class="ml-4">
                                <p class="text-sm text-gray-600">Rejected/Flagged</p>
                                <p class="text-2xl font-bold text-gray-900">1</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Screening Queue -->
                <div class="bg-white rounded-lg shadow">
                    <div class="px-6 py-4 border-b border-gray-200">
                        <h3 class="text-lg font-medium text-gray-900">Model Screening Queue</h3>
                    </div>
                    <div class="p-6">
                        <div class="text-center py-8">
                            <i class="fas fa-clipboard-check text-4xl text-gray-400 mb-4"></i>
                            <p class="text-gray-600">Model screening interface will be built here</p>
                            <p class="text-sm text-gray-500 mt-2">Features: 1099 verification, photo ID checks, compliance screening</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async loadSystemStats() {
        try {
            const response = await sysFetch('/api/system-management/stats', {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                return data.data || {};
            }
        } catch (error) {
            console.error('Error loading system stats:', error);
        }
        
        return {};
    }

    async loadThemeSets() {
        try {
            const tsPage = this.themeSetsPage || 1;
            const tsLimit = this.themeSetsLimit || parseInt(localStorage.getItem('ts_page_size') || '50');
            const response = await sysFetch(`/api/system-management/theme-sets?page=${tsPage}&limit=${tsLimit}`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.themeSetsPage = data.pagination?.page || tsPage;
                this.themeSetsLimit = data.pagination?.limit || tsLimit;
                return data.data || [];
            }
        } catch (error) {
            console.error('Error loading theme sets:', error);
        }
        
        return [];
    }

    async loadPageSets() {
        try {
            const psPage = this.pageSetsPage || 1;
            const psLimit = this.pageSetsLimit || parseInt(localStorage.getItem('ps_page_size') || '50');
            const response = await sysFetch(`/api/system-management/page-sets?page=${psPage}&limit=${psLimit}`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.pageSetsPage = data.pagination?.page || psPage;
                this.pageSetsLimit = data.pagination?.limit || psLimit;
                return data.data || [];
            }
        } catch (error) {
            console.error('Error loading page sets:', error);
        }
        
        return [];
    }

    initializeTabFunctionality(tabName) {
        // Initialize any specific functionality for the loaded tab
        switch (tabName) {
            case 'client-accounts':
                this.initializeClientManagement();
                break;
            case 'template-builder':
                this.initializeTemplateBuilder();
                break;
            case 'model-screening':
                // Initialize screening functionality
                break;
            case 'blurred-approved':
                this.initializeModelDashboard();
                break;
            // Add more cases as needed
        }
    }

    initializeModelDashboard() {
        // Initialize the ModelDashboard class after the component loads
        console.log('initializeModelDashboard called');
        console.log('ModelDashboard class available:', !!window.ModelDashboard);
        console.log('Dashboard container exists:', !!document.querySelector('.model-dashboard-container'));
        
        setTimeout(() => {
            if (window.ModelDashboard && !window.modelDashboard) {
                console.log('Creating new ModelDashboard instance');
                window.modelDashboard = new ModelDashboard();
                console.log('Model Dashboard initialized successfully');
            } else if (window.modelDashboard) {
                // Dashboard already exists, just reload data
                console.log('Reloading existing ModelDashboard');
                window.modelDashboard.loadModels();
                console.log('Model Dashboard reloaded');
            } else {
                console.error('ModelDashboard class not found or dashboard container missing');
                console.error('Available classes:', Object.keys(window).filter(key => key.includes('Dashboard')));
            }
        }, 200); // Increased delay to ensure DOM elements are ready
    }

    initializeTemplateBuilder() {
        // Initialize template tab functionality
        document.querySelectorAll('.template-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = btn.dataset.tab;
                this.switchTemplateTab(tab);
            });
        });

        // Initialize filter functionality
        const themeFilterCategory = document.getElementById('themeFilterCategory');
        const themeFilterTier = document.getElementById('themeFilterTier');
        const pageSetFilterBusiness = document.getElementById('pageSetFilterBusiness');
        const pageSetFilterTier = document.getElementById('pageSetFilterTier');

        if (themeFilterCategory) {
            themeFilterCategory.addEventListener('change', () => this.filterThemeSets());
        }
        if (themeFilterTier) {
            themeFilterTier.addEventListener('change', () => this.filterThemeSets());
        }
        if (pageSetFilterBusiness) {
            pageSetFilterBusiness.addEventListener('change', () => this.filterPageSets());
        }
        if (pageSetFilterTier) {
            pageSetFilterTier.addEventListener('change', () => this.filterPageSets());
        }

        // Initialize add buttons
        const addThemeSetBtn = document.getElementById('addThemeSetBtn');
        const addPageSetBtn = document.getElementById('addPageSetBtn');

        if (addThemeSetBtn) {
            addThemeSetBtn.addEventListener('click', () => this.showAddThemeSetModal());
        }
        if (addPageSetBtn) {
            addPageSetBtn.addEventListener('click', () => this.showAddPageSetModal());
        }
    }

    switchTemplateTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.template-tab-btn').forEach(btn => {
            btn.classList.remove('active', 'border-blue-500', 'text-blue-600');
            btn.classList.add('border-transparent', 'text-gray-500');
        });

        const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active', 'border-blue-500', 'text-blue-600');
            activeBtn.classList.remove('border-transparent', 'text-gray-500');
        }

        // Update content
        document.querySelectorAll('.template-tab-content').forEach(content => {
            content.classList.add('hidden');
        });

        const targetContent = document.getElementById(`${tabName}-tab-content`);
        if (targetContent) {
            targetContent.classList.remove('hidden');
        }
    }

    filterThemeSets() {
        console.log('Filtering theme sets...');
        // Implementation for filtering theme sets
    }

    filterPageSets() {
        console.log('Filtering page sets...');
        // Implementation for filtering page sets
    }

    showAddThemeSetModal() {
        console.log('Show add theme set modal');
        this.showNotification('Add theme set functionality coming soon', 'info');
    }

    showAddPageSetModal() {
        console.log('Show add page set modal');
        this.showNotification('Add page set functionality coming soon', 'info');
    }

    initializeClientManagement() {
        // Search functionality
        const searchInput = document.getElementById('clientSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterClients();
            });
        }

        // Filter functionality
        const statusFilter = document.getElementById('statusFilter');
        const typeFilter = document.getElementById('typeFilter');
        
        if (statusFilter) {
            statusFilter.addEventListener('change', () => {
                this.filterClients();
            });
        }
        
        if (typeFilter) {
            typeFilter.addEventListener('change', () => {
                this.filterClients();
            });
        }

        // Action buttons
        const addClientBtn = document.getElementById('addClientBtn');
        const testImpersonationBtn = document.getElementById('testImpersonationBtn');
        const bulkActionsBtn = document.getElementById('bulkActionsBtn');
        const exportClientsBtn = document.getElementById('exportClientsBtn');
        
        if (addClientBtn) {
            addClientBtn.addEventListener('click', () => {
                this.showAddClientModal();
            });
        }
        
        if (testImpersonationBtn) {
            testImpersonationBtn.addEventListener('click', () => {
                this.showTestImpersonationDialog();
            });
        }
        
        if (bulkActionsBtn) {
            bulkActionsBtn.addEventListener('click', () => {
                this.showBulkActionsDialog();
            });
        }
        
        if (exportClientsBtn) {
            exportClientsBtn.addEventListener('click', () => {
                this.exportClientsData();
            });
        }

        // Select all checkbox
        const selectAllCheckbox = document.getElementById('selectAllClients');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => {
                const checkboxes = document.querySelectorAll('.client-checkbox');
                checkboxes.forEach(checkbox => {
                    checkbox.checked = e.target.checked;
                });
            });
        }

        // Edit client form
        const editClientForm = document.getElementById('editClientForm');
        if (editClientForm) {
            editClientForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveClientChanges();
            });
        }
    }

    filterClients() {
        // This would implement real-time filtering of the clients table
        // For now, we'll reload the content with filters
        console.log('Filtering clients...');
    }

    showAddClientModal() {
        console.log('Show add client modal');
        this.showNotification('Add client functionality coming soon', 'info');
    }

    showTestImpersonationDialog() {
        console.log('Show test impersonation dialog');
        this.showNotification('Test impersonation functionality available', 'info');
    }

    showBulkActionsDialog() {
        console.log('Show bulk actions dialog');
        this.showNotification('Bulk actions functionality coming soon', 'info');
    }

    exportClientsData() {
        console.log('Export clients data');
        this.showNotification('Export functionality coming soon', 'info');
    }

    editClient(clientId) {
        console.log('Edit client:', clientId);
        // Load client data and show edit modal
        this.loadClientForEdit(clientId);
    }

    async loadClientForEdit(clientId) {
        try {
            const response = await sysFetch(`/api/system-management/clients/${clientId}`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                const client = data.data;
                
                // Populate edit form
                document.getElementById('editClientId').value = client.id;
                document.getElementById('editDisplayName').value = client.name || '';
                document.getElementById('editEmail').value = client.email || '';
                document.getElementById('editStatus').value = client.status || 'active';
                document.getElementById('editBusinessType').value = client.business_type_id || '';
                document.getElementById('editPassword').value = '';
                
                // Show modal
                document.getElementById('editClientModal').classList.remove('hidden');
            }
        } catch (error) {
            console.error('Error loading client for edit:', error);
            this.showNotification('Failed to load client data', 'error');
        }
    }

    async saveClientChanges() {
        const clientId = document.getElementById('editClientId').value;
        const displayName = document.getElementById('editDisplayName').value;
        const email = document.getElementById('editEmail').value;
        const status = document.getElementById('editStatus').value;
        const businessType = document.getElementById('editBusinessType').value;
        const password = document.getElementById('editPassword').value;

        const updateData = {
            name: displayName,
            email: email,
            status: status,
            business_type_id: businessType ? parseInt(businessType) : null
        };

        // Only include password if it was provided
        if (password.trim()) {
            updateData.password = password;
        }

        console.log('Sending update data:', updateData);

        try {
            const response = await sysFetch(`/api/system-management/clients/${clientId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
            });
            
            if (response.ok) {
                this.showNotification('Client updated successfully', 'success');
                this.closeModal('editClientModal');
                // Reload the client accounts content
                this.switchTab('client-accounts');
            } else {
                const errorData = await response.json().catch(() => ({ message: 'Unknown server error' }));
                console.error('Server response:', response.status, errorData);
                this.showNotification(errorData.error || errorData.message || 'Failed to update client', 'error');
            }
        } catch (error) {
            console.error('Error saving client changes:', error);
            this.showNotification('Failed to save changes', 'error');
        }
    }

    impersonateClient(clientId) {
        console.log('Impersonate client:', clientId);
        // Implement impersonation functionality
        window.location.href = `/api/impersonation/start/${clientId}`;
    }

    deleteClient(clientId) {
        if (confirm('Are you sure you want to delete this client? This action cannot be undone.')) {
            console.log('Delete client:', clientId);
            this.performDeleteClient(clientId);
        }
    }

    async performDeleteClient(clientId) {
        try {
            const response = await sysFetch(`/api/system-management/clients/${clientId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                this.showNotification('Client deleted successfully', 'success');
                // Reload the client accounts content
                this.switchTab('client-accounts');
            } else {
                const errorData = await response.json();
                this.showNotification(errorData.message || 'Failed to delete client', 'error');
            }
        } catch (error) {
            console.error('Error deleting client:', error);
            this.showNotification('Failed to delete client', 'error');
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (show) {
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    }

    showNotifications() {
        // Show notifications dropdown/modal
        console.log('Show notifications clicked');
    }

    async logout() {
        try {
            // Call server logout endpoint
            if (this.authToken) {
                try {
                    await sysFetch('/api/auth/logout', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${this.authToken}`,
                            'Content-Type': 'application/json'
                        }
                    });
                } catch (error) {
                    console.warn('Server logout failed:', error);
                }
            }
        } catch (error) {
            console.warn('Logout API call failed:', error);
        } finally {
            this.performCompleteLogout();
        }
    }

    performCompleteLogout() {
        // Clear all authentication data
        localStorage.removeItem('musenest_token');
        localStorage.removeItem('musenest_user');
        localStorage.removeItem('musenest_session');
        sessionStorage.clear();
        
        // Clear cookies
        document.cookie.split(";").forEach(function(c) { 
            document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
        });
        
        // Redirect to login
        const timestamp = new Date().getTime();
        window.location.href = `login.html?t=${timestamp}`;
    }

    redirectToLogin() {
        if (this.isRedirecting) return;
        this.isRedirecting = true;
        
        localStorage.removeItem('musenest_token');
        const timestamp = new Date().getTime();
        window.location.href = `login.html?t=${timestamp}`;
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

    // Content Moderation Management
    async loadContentModerationContent() {
        try {
            // Get moderation queue with pagination
            const cmPage = this.cmPage || 1;
            const cmLimit = this.cmLimit || parseInt(localStorage.getItem('cm_page_size') || '20');
            const queueResponse = await sysFetch(`/api/content-moderation/queue?page=${cmPage}&limit=${cmLimit}`, {
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });
            const queueData = await queueResponse.json();
            this.cmPage = queueData.pagination?.page || cmPage;
            this.cmLimit = queueData.pagination?.limit || cmLimit;

            // Get AI service status
            const statusResponse = await sysFetch('/api/content-moderation/test', {
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });
            const statusData = await statusResponse.json();

            const queue = queueData.success ? queueData.queue : [];
            const aiStatus = statusData.ai_service_status || 'unknown';

            return `
                <div class="content-moderation-dashboard">
                    <!-- AI Service Status -->
                    <div class="service-status-card mb-4">
                        <div class="card">
                            <div class="card-header d-flex justify-content-between align-items-center">
                                <h5 class="mb-0">
                                    <i class="bi bi-cpu"></i> AI Moderation Service Status
                                </h5>
                                <div class="status-badge ${aiStatus === 'connected' ? 'status-connected' : 'status-disconnected'}">
                                    <i class="bi bi-${aiStatus === 'connected' ? 'check-circle' : 'x-circle'}"></i>
                                    ${aiStatus === 'connected' ? 'Connected' : 'Disconnected'}
                                </div>
                            </div>
                            <div class="card-body">
                                <div class="row text-center">
                                    <div class="col-md-3">
                                        <div class="stat-item">
                                            <div class="stat-number">${queue.length}</div>
                                            <div class="stat-label">Items in Queue</div>
                                        </div>
                                    </div>
                                    <div class="col-md-3">
                                        <div class="stat-item">
                                            <div class="stat-number">${queue.filter(item => item.priority === 'urgent').length}</div>
                                            <div class="stat-label">Urgent Priority</div>
                                        </div>
                                    </div>
                                    <div class="col-md-3">
                                        <div class="stat-item">
                                            <div class="stat-number">${queue.filter(item => item.priority === 'high').length}</div>
                                            <div class="stat-label">High Priority</div>
                                        </div>
                                    </div>
                                    <div class="col-md-3">
                                        <div class="stat-item">
                                            <div class="stat-number">${queue.filter(item => item.assigned_to).length}</div>
                                            <div class="stat-label">Assigned</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Moderation Queue -->
                    <div class="moderation-queue-card">
                        <div class="card">
                            <div class="card-header d-flex justify-content-between align-items-center">
                                <h5 class="mb-0">
                                    <i class="bi bi-list-check"></i> Human Review Queue
                                </h5>
                                <div class="queue-controls d-flex align-items-center" style="gap:8px;">
                                    <select class="form-select form-select-sm me-2" id="priorityFilter" onchange="filterModerationQueue()">
                                        <option value="">All Priorities</option>
                                        <option value="urgent">Urgent</option>
                                        <option value="high">High</option>
                                        <option value="medium">Medium</option>
                                        <option value="low">Low</option>
                                    </select>
                                    <button class="btn btn-warning btn-sm me-2" onclick="openModerationDashboard()">
                                        <i class="bi bi-shield-check"></i> Full Dashboard
                                    </button>
                                    <button class="btn btn-success btn-sm me-2" onclick="openContentReviewTool()">
                                        <i class="bi bi-brush"></i> Blur Tool
                                    </button>
                                    <button class="btn btn-primary btn-sm" onclick="refreshModerationQueue()">
                                        <i class="bi bi-arrow-clockwise"></i> Refresh
                                    </button>
                                    <span class="text-muted small ms-2">Page ${this.cmPage} · ${queueData.pagination?.total || queue.length} total</span>
                                    <button class="btn btn-outline-secondary btn-sm" onclick="window.systemAdminDashboard.cmPrevPage()" ${this.cmPage<=1?'disabled':''}>Prev</button>
                                    <button class="btn btn-outline-secondary btn-sm" onclick="window.systemAdminDashboard.cmNextPage()" ${(queueData.pagination?.pages||1)<=this.cmPage?'disabled':''}>Next</button>
                                    <select class="form-select form-select-sm" onchange="window.systemAdminDashboard.cmChangePageSize(this.value)" style="width:auto;">
                                        ${[10,20,50,100].map(n => `<option value=\"${n}\" ${this.cmLimit===n?'selected':''}>${n}/page</option>`).join('')}
                                    </select>
                                </div>
                            </div>
                            <div class="card-body">
                                ${queue.length === 0 ? 
                                `<div class="text-center text-muted py-4">
                                    <i class="bi bi-check-circle" style="font-size: 3rem;"></i>
                                    <h4>No items in queue</h4>
                                    <p>All content has been reviewed or approved automatically.</p>
                                </div>` :
                                `<div class="table-responsive">
                                    <table class="table table-hover">
                                        <thead>
                                            <tr>
                                                <th>Image</th>
                                                <th>Model</th>
                                                <th>Context</th>
                                                <th>AI Results</th>
                                                <th>Priority</th>
                                                <th>Created</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${queue.map(item => `
                                                <tr>
                                                    <td>
                                                        <img src="/public/${item.image_path}" 
                                                             alt="Review image" 
                                                             style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px;">
                                                    </td>
                                                    <td>
                                                        <strong>${item.model_name || 'Unknown'}</strong><br>
                                                        <small class="text-muted">ID: ${item.model_id}</small>
                                                    </td>
                                                    <td>
                                                        <span class="badge bg-${this.getContextBadgeColor(item.context_type)}">
                                                            ${this.formatContextType(item.context_type)}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div class="ai-results">
                                                            <small>
                                                                Nudity: ${item.nudity_score}%<br>
                                                                Confidence: ${Math.round(item.confidence_score * 100)}%<br>
                                                                ${item.generated_caption ? `<em>"${item.generated_caption.substring(0, 30)}..."</em>` : ''}
                                                            </small>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span class="badge bg-${this.getPriorityBadgeColor(item.priority)}">
                                                            ${item.priority.toUpperCase()}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <small>${new Date(item.created_at).toLocaleDateString()}</small>
                                                    </td>
                                                    <td>
                                                        <div class="btn-group btn-group-sm">
                                                            <button class="btn btn-success" onclick="reviewContent(${item.content_moderation_id}, 'approved')" title="Approve">
                                                                <i class="bi bi-check"></i>
                                                            </button>
                                                            <button class="btn btn-danger" onclick="reviewContent(${item.content_moderation_id}, 'rejected')" title="Reject">
                                                                <i class="bi bi-x"></i>
                                                            </button>
                                                            <button class="btn btn-info" onclick="viewFullImage('${item.image_path}')" title="View Full">
                                                                <i class="bi bi-eye"></i>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>`}
                            </div>
                        </div>
                    </div>
                </div>

                <style>
                    .service-status-card .status-badge {
                        padding: 0.5rem 1rem;
                        border-radius: 0.5rem;
                        font-weight: 600;
                        font-size: 0.875rem;
                    }
                    .status-connected {
                        background: #d4edda;
                        color: #155724;
                        border: 1px solid #c3e6cb;
                    }
                    .status-disconnected {
                        background: #f8d7da;
                        color: #721c24;
                        border: 1px solid #f5c6cb;
                    }
                    .stat-item {
                        padding: 1rem;
                    }
                    .stat-number {
                        font-size: 2rem;
                        font-weight: 700;
                        color: #495057;
                    }
                    .stat-label {
                        font-size: 0.875rem;
                        color: #6c757d;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    .queue-controls {
                        display: flex;
                        align-items: center;
                    }
                    .ai-results {
                        max-width: 200px;
                    }
                </style>
            `;
        } catch (error) {
            console.error('Error loading content moderation:', error);
            return `
                <div class="alert alert-danger">
                    <h4>Error Loading Content Moderation</h4>
                    <p>Failed to load moderation data: ${error.message}</p>
                </div>
            `;
        }
    }

    cmPrevPage() {
        if ((this.cmPage || 1) > 1) {
            this.cmPage -= 1;
            this.loadTabContent('content-moderation');
        }
    }
    cmNextPage() {
        this.cmPage = (this.cmPage || 1) + 1;
        this.loadTabContent('content-moderation');
    }
    cmChangePageSize(val) {
        const n = parseInt(val) || 20;
        this.cmLimit = n;
        localStorage.setItem('cm_page_size', String(n));
        this.cmPage = 1;
        this.loadTabContent('content-moderation');
    }

    getContextBadgeColor(contextType) {
        const colors = {
            'profile_pic': 'primary',
            'public_gallery': 'info',
            'premium_gallery': 'warning',
            'private_content': 'danger'
        };
        return colors[contextType] || 'secondary';
    }

    formatContextType(contextType) {
        const formats = {
            'profile_pic': 'Profile Picture',
            'public_gallery': 'Public Gallery',
            'premium_gallery': 'Premium Gallery',
            'private_content': 'Private Content'
        };
        return formats[contextType] || contextType;
    }

    getPriorityBadgeColor(priority) {
        const colors = {
            'urgent': 'danger',
            'high': 'warning',
            'medium': 'info',
            'low': 'secondary'
        };
        return colors[priority] || 'secondary';
    }

    async reviewContent(contentId, status) {
        try {
            const notes = prompt(`Add review notes for ${status} decision (optional):`);
            
            const response = await sysFetch(`/api/content-moderation/review/${contentId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    moderation_status: status,
                    reviewed_by: this.currentUser.id,
                    notes: notes || ''
                })
            });

            const data = await response.json();
            
            if (data.success) {
                this.showNotification(`Content ${status} successfully`, 'success');
                // Refresh the moderation queue
                this.loadTabContent('content-moderation');
            } else {
                throw new Error(data.error || `Failed to ${status} content`);
            }
        } catch (error) {
            console.error('Review error:', error);
            this.showNotification(`Error: ${error.message}`, 'error');
        }
    }

    // Open content review and blur tool
    openContentReviewTool() {
        window.open('/admin-content-review.html', '_blank', 'width=1400,height=900,scrollbars=yes,resizable=yes');
    }

    // Media Queue Content
    async loadMediaQueueContent() {
        try {
            const page = this.mediaQueuePage || 1;
            const limit = this.mediaQueueLimit || parseInt(localStorage.getItem('mq_page_size') || '20');
            const response = await sysFetch(`/api/media-review-queue/queue?status=pending&page=${page}&limit=${limit}`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error);
            }

            const stats = await this.loadMediaQueueStats();
            this.mediaQueuePage = data.pagination?.page || page;
            this.mediaQueueLimit = data.pagination?.limit || limit;
            
            return `
                <div class="space-y-6">
                    <!-- Queue Statistics -->
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div class="flex items-center">
                                <div class="flex-shrink-0">
                                    <i class="fas fa-images text-blue-600 text-2xl"></i>
                                </div>
                                <div class="ml-3">
                                    <p class="text-sm font-medium text-blue-600">Total Queue</p>
                                    <p class="text-2xl font-bold text-blue-900">${stats.overview.total_queue || 0}</p>
                                </div>
                            </div>
                        </div>
                        <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                            <div class="flex items-center">
                                <div class="flex-shrink-0">
                                    <i class="fas fa-exclamation-triangle text-red-600 text-2xl"></i>
                                </div>
                                <div class="ml-3">
                                    <p class="text-sm font-medium text-red-600">Urgent</p>
                                    <p class="text-2xl font-bold text-red-900">${stats.overview.urgent_items || 0}</p>
                                </div>
                            </div>
                        </div>
                        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <div class="flex items-center">
                                <div class="flex-shrink-0">
                                    <i class="fas fa-robot text-yellow-600 text-2xl"></i>
                                </div>
                                <div class="ml-3">
                                    <p class="text-sm font-medium text-yellow-600">Auto-Flagged</p>
                                    <p class="text-2xl font-bold text-yellow-900">${stats.overview.auto_flagged || 0}</p>
                                </div>
                            </div>
                        </div>
                        <div class="bg-purple-50 border border-purple-200 rounded-lg p-4">
                            <div class="flex items-center">
                                <div class="flex-shrink-0">
                                    <i class="fas fa-gavel text-purple-600 text-2xl"></i>
                                </div>
                                <div class="ml-3">
                                    <p class="text-sm font-medium text-purple-600">Appeals</p>
                                    <p class="text-2xl font-bold text-purple-900">${stats.overview.appeal_items || 0}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Queue Filters -->
                    <div class="bg-white rounded-lg shadow border border-gray-200 p-4">
                        <div class="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                                <select id="mediaQueuePriorityFilter" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                                    <option value="">All Priorities</option>
                                    <option value="urgent">🔴 Urgent</option>
                                    <option value="high">🟠 High</option>
                                    <option value="medium">🟡 Medium</option>
                                    <option value="low">⚪ Low</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Queue Type</label>
                                <select id="mediaQueueTypeFilter" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                                    <option value="">All Types</option>
                                    <option value="auto_flagged">🤖 Auto-Flagged</option>
                                    <option value="manual_review">👥 Manual Review</option>
                                    <option value="appeal">📝 Appeal</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Usage Intent</label>
                                <select id="mediaQueueUsageFilter" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                                    <option value="">All Intents</option>
                                    <option value="public_site">🌐 Public Site</option>
                                    <option value="paysite">💰 Paysite</option>
                                    <option value="store">🛒 Store</option>
                                    <option value="private">🔒 Private</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Model Search</label>
                                <input type="text" id="mediaQueueModelSearch" placeholder="Search models..." class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                            </div>
                            <div class="flex space-x-2">
                                <button onclick="window.systemAdminDashboard.applyMediaQueueFilters()" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
                                    Apply Filters
                                </button>
                                <button onclick="window.systemAdminDashboard.clearMediaQueueFilters()" class="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors">
                                    Clear
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Media Queue Items -->
                    <div class="flex items-center justify-between text-sm text-gray-600">
                        <div>Page <span id="mqPage">${this.mediaQueuePage}</span> of <span id="mqPages">${data.pagination?.pages || 1}</span> · Total <span id="mqTotal">${data.pagination?.total || 0}</span></div>
                        <div class="space-x-2">
                            <button class="px-2 py-1 border rounded" onclick="window.systemAdminDashboard.mqPrevPage()" ${this.mediaQueuePage <= 1 ? 'disabled' : ''}>Prev</button>
                            <button class="px-2 py-1 border rounded" onclick="window.systemAdminDashboard.mqNextPage()" ${this.mediaQueuePage >= (data.pagination?.pages || 1) ? 'disabled' : ''}>Next</button>
                            <select class="px-2 py-1 border rounded" onchange="window.systemAdminDashboard.mqChangePageSize(this.value)">
                                ${[10,20,50,100].map(n => `<option value="${n}" ${this.mediaQueueLimit===n?'selected':''}>${n}/page</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div id="mediaQueueItems" class="space-y-4 mt-3">
                        ${this.renderMediaQueueItems(data.queue)}
                    </div>
                </div>

                <!-- Media Review Modal -->
                <div id="mediaReviewModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 hidden items-center justify-center z-50">
                    <div class="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-screen overflow-y-auto">
                        <div id="mediaReviewModalContent">
                            <!-- Modal content will be loaded here -->
                        </div>
                    </div>
                </div>
            `;

        } catch (error) {
            console.error('Error loading media queue:', error);
            return `<div class="text-center py-8 text-red-600">Error loading media queue: ${error.message}</div>`;
        }
    }

    // Blurred/Approved Content - New Model-Centric Dashboard
    async loadBlurredApprovedContent() {
        try {
            console.log('🚀 Starting loadBlurredApprovedContent...');
            
            // Load the model dashboard component
            console.log('📥 Fetching model dashboard component...');
            const response = await sysFetch('/admin/components/model-dashboard.html');
            console.log('📦 Component fetch response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch component: ${response.status} ${response.statusText}`);
            }
            
            const componentHTML = await response.text();
            console.log('📄 Component HTML loaded, length:', componentHTML.length);
            
            // Load the dashboard JavaScript if not already loaded
            if (!window.ModelDashboard) {
                console.log('📜 Loading ModelDashboard JavaScript...');
                await this.loadScript(`/admin/js/model-dashboard.js?v=${Date.now()}`);
                console.log('✅ ModelDashboard JavaScript loaded. Class available:', !!window.ModelDashboard);
            } else {
                console.log('♻️ ModelDashboard class already loaded');
            }
            
            console.log('🎉 loadBlurredApprovedContent completed successfully');
            return componentHTML;

        } catch (error) {
            console.error('Error loading model dashboard:', error);
            return `
                <div class="text-center py-8 text-red-600">
                    <div class="w-24 h-24 mx-auto mb-4 text-red-300">
                        <i class="fas fa-exclamation-triangle text-6xl"></i>
                    </div>
                    <h3 class="text-lg font-medium text-gray-900 mb-2">Error loading model dashboard</h3>
                    <p class="text-sm text-gray-500 mb-4">${error.message}</p>
                    <button onclick="window.systemAdminDashboard.switchTab('blurred-approved')" 
                            class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700">
                        <i class="fas fa-redo mr-2"></i>
                        Try Again
                    </button>
                </div>
            `;
        }
    }

    // Rejected/Removed Content
    async loadRejectedRemovedContent() {
        try {
            const page = this.rejectedPage || 1;
            const limit = this.rejectedLimit || 20;
            const response = await sysFetch(`/api/media-review-queue/queue?status=rejected&page=${page}&limit=${limit}`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error);
            }

            this.rejectedPage = data.pagination?.page || page;
            this.rejectedLimit = data.pagination?.limit || limit;
            return `
                <div class="space-y-6">
                    <div class="bg-white rounded-lg shadow border border-gray-200 p-4">
                        <div class="flex items-center justify-between mb-2">
                            <h3 class="text-lg font-medium text-gray-900">Rejected & Removed Media (${data.pagination?.total || data.queue.length})</h3>
                            <div class="text-sm text-gray-600">Page ${this.rejectedPage} of ${data.pagination?.pages || 1}</div>
                        </div>
                        
                        ${data.queue.length === 0 ? 
                            '<div class="text-center py-8 text-gray-500">No rejected media found</div>' :
                            `<div class="space-y-3">
                                ${data.queue.map(item => `
                                    <div class="border border-red-200 rounded-lg p-4 bg-red-50">
                                        <div class="flex items-start space-x-4">
                                            <img src="${item.thumbnail_path}" alt="Rejected content" class="w-16 h-16 object-cover rounded">
                                            <div class="flex-1 min-w-0">
                                                <div class="flex items-center justify-between">
                                                    <h4 class="font-medium text-sm text-gray-900">${item.model_name}</h4>
                                                    <span class="text-xs text-red-600 bg-red-100 px-2 py-1 rounded">
                                                        Score: ${item.nudity_score.toFixed(1)}%
                                                    </span>
                                                </div>
                                                <p class="text-sm text-gray-600 mt-1">
                                                    <strong>Rejection Reason:</strong> ${item.admin_notes || 'No reason provided'}
                                                </p>
                                                <div class="flex items-center justify-between mt-2 text-xs text-gray-500">
                                                    <span>Rejected: ${new Date(item.reviewed_at).toLocaleDateString()}</span>
                                                    <span>Intent: ${item.usage_intent}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>`
                        }
                    </div>
                </div>
            `;

        } catch (error) {
            console.error('Error loading rejected content:', error);
            return `<div class="text-center py-8 text-red-600">Error loading content: ${error.message}</div>`;
        }
    }

    // Helper method to load media queue statistics
    async loadMediaQueueStats() {
        try {
            const response = await sysFetch('/api/media-review-queue/stats', {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            return data.success ? data : { overview: {} };

        } catch (error) {
            console.error('Error loading media queue stats:', error);
            return { overview: {} };
        }
    }

    // Render media queue items
    renderMediaQueueItems(items) {
        if (items.length === 0) {
            return '<div class="text-center py-8 text-gray-500">No media items in queue</div>';
        }

        return items.map(item => {
            const priorityColors = {
                urgent: 'bg-red-100 text-red-800',
                high: 'bg-orange-100 text-orange-800',
                medium: 'bg-yellow-100 text-yellow-800',
                low: 'bg-gray-100 text-gray-800'
            };

            const queueTypeIcons = {
                auto_flagged: '🤖',
                manual_review: '👥',
                appeal: '📝',
                admin_override: '⚡'
            };

            const usageIntentIcons = {
                public_site: '🌐',
                paysite: '💰',
                store: '🛒',
                private: '🔒'
            };

            const detectedParts = Object.entries(item.detected_parts || {})
                .map(([part, confidence]) => `
                    <span class="inline-block bg-red-100 text-red-800 text-xs px-2 py-1 rounded mr-1 mb-1">
                        ${part}: ${confidence.toFixed(1)}%
                    </span>
                `).join('');

            return `
                <div class="bg-white rounded-lg shadow border border-gray-200 p-4">
                    <div class="flex items-start space-x-4">
                        <!-- Thumbnail -->
                        <div class="flex-shrink-0">
                            <img src="${item.thumbnail_path}" alt="Media thumbnail" class="w-32 h-24 object-cover rounded cursor-pointer" 
                                 onclick="window.systemAdminDashboard.viewMediaDetails(${item.id})">
                            <div class="text-center mt-2">
                                <span class="inline-block ${priorityColors[item.priority]} text-xs px-2 py-1 rounded font-medium">
                                    ${item.priority.toUpperCase()}
                                </span>
                            </div>
                        </div>

                        <!-- Content Details -->
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between mb-2">
                                <h3 class="text-lg font-medium text-gray-900">${item.model_name}</h3>
                                <div class="flex items-center space-x-2">
                                    <span class="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                                        ${usageIntentIcons[item.usage_intent]} ${item.usage_intent.replace('_', ' ')}
                                    </span>
                                    <span class="inline-block bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">
                                        ${queueTypeIcons[item.queue_type]} ${item.queue_type.replace('_', ' ')}
                                    </span>
                                </div>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                                <div>
                                    <p class="text-sm text-gray-600 mb-1">
                                        <strong>Nudity Score:</strong> 
                                        <span class="font-mono ${item.nudity_score > 70 ? 'text-red-600' : item.nudity_score > 40 ? 'text-yellow-600' : 'text-green-600'}">
                                            ${item.nudity_score.toFixed(1)}%
                                        </span>
                                    </p>
                                    <p class="text-sm text-gray-600">
                                        <strong>Flagged:</strong> ${new Date(item.flagged_at).toLocaleString()}
                                    </p>
                                    ${item.has_appeal ? '<p class="text-sm text-purple-600"><strong>🚨 Has Appeal</strong></p>' : ''}
                                </div>
                                <div>
                                    <p class="text-sm text-gray-600 mb-1"><strong>Detected Parts:</strong></p>
                                    <div class="max-h-16 overflow-y-auto">
                                        ${detectedParts || '<span class="text-xs text-gray-500">None detected</span>'}
                                    </div>
                                </div>
                            </div>

                            <!-- Action Buttons -->
                            <div class="flex flex-wrap gap-2">
                                <button onclick="window.systemAdminDashboard.approveMedia(${item.id})" 
                                        class="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors">
                                    ✅ Approve
                                </button>
                                <button onclick="window.systemAdminDashboard.openEnhancedReview(${item.id})" 
                                        class="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700 transition-colors">
                                    🎯 Enhanced Review
                                </button>
                                <button onclick="window.systemAdminDashboard.rejectMedia(${item.id})" 
                                        class="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors">
                                    ❌ Reject
                                </button>
                                <button onclick="window.systemAdminDashboard.viewMediaDetails(${item.id})" 
                                        class="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors">
                                    👁️ Review
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Media Queue Action Methods
    async applyMediaQueueFilters() {
        const priority = document.getElementById('mediaQueuePriorityFilter').value;
        const queueType = document.getElementById('mediaQueueTypeFilter').value;
        const usageIntent = document.getElementById('mediaQueueUsageFilter').value;
        const modelSearch = document.getElementById('mediaQueueModelSearch').value;

        const params = new URLSearchParams();
        params.append('status', 'pending');
        if (priority) params.append('priority', priority);
        if (queueType) params.append('queue_type', queueType);
        if (usageIntent) params.append('usage_intent', usageIntent);
        if (modelSearch) params.append('model_search', modelSearch);

        try {
            const response = await sysFetch(`/api/media-review-queue/queue?${params}`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            
            if (data.success) {
                document.getElementById('mediaQueueItems').innerHTML = this.renderMediaQueueItems(data.queue);
            }

        } catch (error) {
            console.error('Error applying filters:', error);
            this.showNotification('Error applying filters', 'error');
        }
    }

    clearMediaQueueFilters() {
        document.getElementById('mediaQueuePriorityFilter').value = '';
        document.getElementById('mediaQueueTypeFilter').value = '';
        document.getElementById('mediaQueueUsageFilter').value = '';
        document.getElementById('mediaQueueModelSearch').value = '';
        this.loadTabContent('media-queue');
    }

    async approveMedia(mediaId) {
        const notes = prompt('Add approval notes (optional):');
        
        try {
            const response = await sysFetch(`/api/media-review-queue/approve/${mediaId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    admin_notes: notes,
                    reviewed_by: this.currentUser.id || 1
                })
            });

            const data = await response.json();
            
            if (data.success) {
                this.showNotification('Media approved successfully', 'success');
                this.loadTabContent('media-queue');
            } else {
                throw new Error(data.error);
            }

        } catch (error) {
            console.error('Error approving media:', error);
            this.showNotification(`Error: ${error.message}`, 'error');
        }
    }

    async approveMediaWithBlur(mediaId) {
        try {
            const response = await sysFetch(`/api/media-review-queue/item/${mediaId}`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error);
            }

            const item = data.item;
            
            // Open the blur tool as a modal popup
            this.openBlurToolModal(mediaId, item);

        } catch (error) {
            console.error('Error loading media for blur tool:', error);
            this.showNotification(`Error: ${error.message}`, 'error');
        }
    }

    openBlurToolModal(mediaId, item) {
        // Create modal HTML with embedded blur tool
        const modalHtml = `
            <div id="blurToolModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
                <div class="bg-white rounded-lg shadow-xl max-w-7xl w-full mx-4 max-h-screen overflow-y-auto">
                    <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                        <h3 class="text-lg font-medium text-gray-900">🛡️ Blur Tool - ${item.model_name}</h3>
                        <button onclick="window.systemAdminDashboard.closeBlurToolModal()" class="text-gray-400 hover:text-gray-600">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                    <div class="p-6">
                        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <!-- Left Panel: Controls -->
                            <div class="lg:col-span-1">
                                <div class="space-y-6">
                                    <!-- Image Info -->
                                    <div class="bg-blue-50 rounded-lg p-4">
                                        <h4 class="font-medium text-blue-900 mb-2">Image Information</h4>
                                        <div class="text-sm text-blue-800">
                                            <p><strong>Model:</strong> ${item.model_name}</p>
                                            <p><strong>Nudity Score:</strong> ${item.nudity_score.toFixed(1)}%</p>
                                            <p><strong>Usage Intent:</strong> ${item.usage_intent}</p>
                                            <p><strong>Priority:</strong> ${item.priority}</p>
                                        </div>
                                    </div>

                                    <!-- Detected Violations -->
                                    <div class="bg-red-50 rounded-lg p-4">
                                        <h4 class="font-medium text-red-900 mb-2">Detected Violations</h4>
                                        <div class="space-y-2">
                                            ${Object.entries(item.detected_parts || {}).map(([part, confidence]) => `
                                                <div class="flex items-center justify-between">
                                                    <span class="text-sm text-red-800 capitalize">${part}:</span>
                                                    <div class="flex items-center space-x-2">
                                                        <span class="text-sm font-medium text-red-900">${confidence.toFixed(1)}%</span>
                                                        <button onclick="window.systemAdminDashboard.toggleBlurPart('${part}')" 
                                                                id="blur-toggle-${part}"
                                                                class="px-2 py-1 text-xs rounded bg-green-100 text-green-800 hover:bg-green-200">
                                                            Unblur
                                                        </button>
                                                    </div>
                                                </div>
                                            `).join('')}
                                        </div>
                                    </div>

                                    <!-- Blur Controls -->
                                    <div class="space-y-4">
                                        <h4 class="font-medium text-gray-900">Blur Settings</h4>
                                        
                                        <div>
                                            <label class="block text-sm font-medium text-gray-700 mb-1">Blur Strength:</label>
                                            <input type="range" id="blurStrength" min="1" max="20" value="6" 
                                                   class="w-full" onchange="window.systemAdminDashboard.updateBlurSettings()">
                                            <span class="text-sm text-gray-500">Current: <span id="blurStrengthValue">6</span>px</span>
                                        </div>

                                        <div>
                                            <label class="block text-sm font-medium text-gray-700 mb-1">Blur Opacity:</label>
                                            <input type="range" id="blurOpacity" min="0.1" max="1" step="0.1" value="0.8" 
                                                   class="w-full" onchange="window.systemAdminDashboard.updateBlurSettings()">
                                            <span class="text-sm text-gray-500">Current: <span id="blurOpacityValue">80</span>%</span>
                                        </div>

                                        <div>
                                            <label class="block text-sm font-medium text-gray-700 mb-1">Blur Shape:</label>
                                            <select id="blurShape" class="w-full rounded-md border-gray-300" onchange="window.systemAdminDashboard.updateBlurSettings()">
                                                <option value="square">Square/Rectangle</option>
                                                <option value="rounded" selected>Rounded</option>
                                                <option value="oval">Oval</option>
                                            </select>
                                        </div>

                                        <button onclick="window.systemAdminDashboard.toggleAllBlurs()" 
                                                class="w-full bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600">
                                            🔄 Toggle All Blurs
                                        </button>
                                        
                                        <button onclick="window.systemAdminDashboard.addNewBlurArea()" 
                                                class="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                                            ➕ Add New Blur Area
                                        </button>
                                    </div>

                                    <!-- Action Buttons -->
                                    <div class="space-y-3">
                                        <button onclick="window.systemAdminDashboard.saveBlurApproval(${mediaId})" 
                                                class="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                                            💾 Approve with Blur Settings
                                        </button>
                                        
                                        <button onclick="window.systemAdminDashboard.rejectFromBlurTool(${mediaId})" 
                                                class="w-full bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
                                            ❌ Reject Image
                                        </button>
                                        
                                        <button onclick="window.systemAdminDashboard.closeBlurToolModal()" 
                                                class="w-full bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <!-- Right Panel: Image Preview -->
                            <div class="lg:col-span-2">
                                <div class="bg-gray-50 rounded-lg p-4">
                                    <h4 class="font-medium text-gray-900 mb-4">Image Preview</h4>
                                    <div id="blurImageContainer" class="relative inline-block max-w-full">
                                        <img id="blurPreviewImage" src="${this.getWebPath(item.original_path)}" 
                                             alt="Content for review" class="max-w-full h-auto rounded shadow-lg"
                                             onload="window.systemAdminDashboard.initializeBlurOverlays(${mediaId})">
                                    </div>
                                    <p class="text-sm text-gray-600 mt-2">
                                        <strong>Controls:</strong><br>
                                        • <strong>Drag</strong> overlays to move them<br>
                                        • <strong>Drag handles</strong> (blue dots) to resize<br>
                                        • <strong>Double-click</strong> overlays to toggle blur on/off
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Store current media data for blur operations
        this.currentBlurMediaId = mediaId;
        this.currentBlurItem = item;
        this.blurStates = {};
        
        // Initialize detected parts as blurred by default
        Object.keys(item.detected_parts || {}).forEach(part => {
            this.blurStates[part] = true;
        });
    }

    async rejectMedia(mediaId) {
        const reason = prompt('Reason for rejection (required):');
        
        if (!reason || !reason.trim()) {
            alert('Rejection reason is required');
            return;
        }
        
        try {
            const response = await sysFetch(`/api/media-review-queue/reject/${mediaId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    admin_notes: reason,
                    reviewed_by: this.currentUser.id || 1
                })
            });

            const data = await response.json();
            
            if (data.success) {
                this.showNotification('Media rejected successfully', 'success');
                this.loadTabContent('media-queue');
            } else {
                throw new Error(data.error);
            }

        } catch (error) {
            console.error('Error rejecting media:', error);
            this.showNotification(`Error: ${error.message}`, 'error');
        }
    }

    async viewMediaDetails(mediaId) {
        try {
            const response = await sysFetch(`/api/media-review-queue/item/${mediaId}`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error);
            }

            const item = data.item;
            const modal = document.getElementById('mediaReviewModal');
            const modalContent = document.getElementById('mediaReviewModalContent');

            const detectedParts = Object.entries(item.detected_parts || {})
                .map(([part, confidence]) => `
                    <span class="inline-block bg-red-100 text-red-800 text-sm px-2 py-1 rounded mr-2 mb-2">
                        ${part}: ${confidence.toFixed(1)}%
                    </span>
                `).join('');

            modalContent.innerHTML = `
                <div class="px-6 py-4 border-b border-gray-200">
                    <h3 class="text-lg font-medium text-gray-900">Media Review Details</h3>
                </div>
                <div class="p-6">
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <!-- Image Preview -->
                        <div class="space-y-4">
                            <img src="${item.thumbnail_path}" alt="Media content" class="w-full max-h-96 object-contain rounded-lg border">
                            <div class="text-sm text-gray-600">
                                <p><strong>Original Path:</strong> ${item.original_path}</p>
                                <p><strong>File Status:</strong> ${item.file_moved ? 'Moved' : 'In Originals'}</p>
                            </div>
                        </div>

                        <!-- Details -->
                        <div class="space-y-4">
                            <div>
                                <h4 class="font-medium text-gray-900 mb-2">Content Information</h4>
                                <div class="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p><strong>Model:</strong> ${item.model_name}</p>
                                        <p><strong>Usage Intent:</strong> ${item.usage_intent}</p>
                                        <p><strong>Context:</strong> ${item.context_type}</p>
                                    </div>
                                    <div>
                                        <p><strong>Priority:</strong> ${item.priority}</p>
                                        <p><strong>Queue Type:</strong> ${item.queue_type}</p>
                                        <p><strong>Nudity Score:</strong> ${item.nudity_score.toFixed(1)}%</p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h4 class="font-medium text-gray-900 mb-2">AI Analysis Results</h4>
                                <div class="max-h-32 overflow-y-auto">
                                    ${detectedParts || '<p class="text-sm text-gray-500">No violations detected</p>'}
                                </div>
                            </div>

                            ${item.appeal_reason ? `
                                <div class="bg-purple-50 border border-purple-200 rounded-lg p-3">
                                    <h4 class="font-medium text-purple-900 mb-2">Appeal Information</h4>
                                    <p class="text-sm text-purple-800"><strong>Reason:</strong> ${item.appeal_reason}</p>
                                    ${item.appeal_message ? `<p class="text-sm text-purple-700 mt-1">${item.appeal_message}</p>` : ''}
                                </div>
                            ` : ''}

                            <div class="bg-gray-50 rounded-lg p-3">
                                <h4 class="font-medium text-gray-900 mb-2">Timeline</h4>
                                <div class="text-sm text-gray-600 space-y-1">
                                    <p><strong>Flagged:</strong> ${new Date(item.flagged_at).toLocaleString()}</p>
                                    ${item.reviewed_at ? `<p><strong>Reviewed:</strong> ${new Date(item.reviewed_at).toLocaleString()}</p>` : ''}
                                    ${item.moved_at ? `<p><strong>File Moved:</strong> ${new Date(item.moved_at).toLocaleString()}</p>` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="px-6 py-4 border-t border-gray-200 flex justify-between">
                    <button onclick="window.systemAdminDashboard.closeMediaModal()" class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
                        Close
                    </button>
                    <div class="space-x-2">
                        <button onclick="window.systemAdminDashboard.approveMedia(${item.id}); window.systemAdminDashboard.closeMediaModal();" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                            ✅ Approve
                        </button>
                        <button onclick="window.systemAdminDashboard.approveMediaWithBlur(${item.id}); window.systemAdminDashboard.closeMediaModal();" class="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700">
                            🔍 Blur & Approve
                        </button>
                        <button onclick="window.systemAdminDashboard.rejectMedia(${item.id}); window.systemAdminDashboard.closeMediaModal();" class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
                            ❌ Reject
                        </button>
                    </div>
                </div>
            `;

            modal.classList.remove('hidden');
            modal.classList.add('flex');

        } catch (error) {
            console.error('Error loading media details:', error);
            this.showNotification(`Error loading details: ${error.message}`, 'error');
        }
    }

    closeMediaModal() {
        const modal = document.getElementById('mediaReviewModal');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }

    // Blur Tool Modal Methods
    getWebPath(absolutePath) {
        if (!absolutePath) return '/placeholder-image.jpg';
        // Convert absolute path to web-accessible path
        return absolutePath.replace('/Users/programmer/Projects/musenest/public', '');
    }

    closeBlurToolModal() {
        const modal = document.getElementById('blurToolModal');
        if (modal) {
            modal.remove();
        }
        // Clean up stored data
        this.currentBlurMediaId = null;
        this.currentBlurItem = null;
        this.blurStates = {};
    }

    initializeBlurOverlays(mediaId) {
        console.log('Initializing blur overlays for media ID:', mediaId);
        
        if (!this.currentBlurItem) {
            console.error('No current blur item available');
            return;
        }
        
        const image = document.getElementById('blurPreviewImage');
        const container = document.getElementById('blurImageContainer');
        
        if (!image || !container) {
            console.error('Image or container not found');
            return;
        }

        console.log('Image loaded - Natural size:', image.naturalWidth, 'x', image.naturalHeight);
        console.log('Image displayed - Size:', image.offsetWidth, 'x', image.offsetHeight);
        
        // Ensure container has relative positioning for absolute overlays
        container.style.position = 'relative';

        // Remove any existing overlays
        const existingOverlays = container.querySelectorAll('.blur-overlay');
        existingOverlays.forEach(overlay => overlay.remove());

        // Create overlays for detected parts
        const detectedParts = this.currentBlurItem.detected_parts || {};
        const partLocations = this.currentBlurItem.part_locations || {};

        console.log('Detected parts:', detectedParts);
        console.log('Part locations:', partLocations);

        Object.keys(detectedParts).forEach(part => {
            console.log(`Creating overlay for part: ${part}`);
            this.createBlurOverlay(part, partLocations[part], image, container);
        });
        
        console.log('Blur overlays initialization complete');
    }

    createBlurOverlay(part, location, image, container) {
        const overlay = document.createElement('div');
        overlay.className = `blur-overlay blur-overlay-${part}`;
        overlay.setAttribute('data-part', part);
        
        // Use provided location or default position
        let pos = location || this.getDefaultPartPosition(part);
        
        if (pos) {
            // API now returns coordinates in landscape coordinate system - no transformation needed
            console.log(`Using direct coordinates for ${part}: x=${pos.x} y=${pos.y} w=${pos.width} h=${pos.height}`);
            let scaledX, scaledY, scaledWidth, scaledHeight;
            
            // Check if coordinates are absolute pixels (from part_locations) or normalized (0-1)
            if (pos.x > 1 || pos.y > 1 || pos.width > 1 || pos.height > 1) {
                // Absolute pixel coordinates - need to scale to displayed image size
                // First, we need the original image dimensions to calculate scale factors
                const naturalWidth = image.naturalWidth || 800; // fallback
                const naturalHeight = image.naturalHeight || 600; // fallback
                
                // Get displayed image dimensions
                const displayedWidth = image.offsetWidth;
                const displayedHeight = image.offsetHeight;
                
                // Calculate scaling factors
                const scaleX = displayedWidth / naturalWidth;
                const scaleY = displayedHeight / naturalHeight;
                
                // Apply scaling to coordinates
                scaledX = Math.round(pos.x * scaleX);
                scaledY = Math.round(pos.y * scaleY);
                scaledWidth = Math.round(pos.width * scaleX);
                scaledHeight = Math.round(pos.height * scaleY);
                
                console.log(`Scaling overlay for ${part} - Natural: ${naturalWidth}x${naturalHeight}, Displayed: ${displayedWidth}x${displayedHeight}`);
                console.log(`Original coords: ${pos.x},${pos.y} ${pos.width}x${pos.height} -> Scaled: ${scaledX},${scaledY} ${scaledWidth}x${scaledHeight}`);
            } else {
                // Normalized coordinates (0-1) - convert to pixels
                scaledX = Math.round(pos.x * image.offsetWidth);
                scaledY = Math.round(pos.y * image.offsetHeight);
                scaledWidth = Math.round(pos.width * image.offsetWidth);
                scaledHeight = Math.round(pos.height * image.offsetHeight);
            }
            
            overlay.style.left = scaledX + 'px';
            overlay.style.top = scaledY + 'px';
            overlay.style.width = scaledWidth + 'px';
            overlay.style.height = scaledHeight + 'px';
            
            // Style the overlay
            overlay.style.position = 'absolute';
            overlay.style.border = '2px solid #dc3545';
            overlay.style.cursor = 'move';
            overlay.style.transition = 'none'; // Disable transition for smooth dragging
            overlay.style.borderRadius = '8px';
            overlay.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
            overlay.style.zIndex = '10';
            overlay.style.minWidth = '20px';
            overlay.style.minHeight = '20px';
            
            // Initialize with blur effect (since parts default to blurred state)
            if (this.blurStates[part]) {
                this.applyCanvasBlur(overlay, image, 15, 0.8);
                overlay.style.borderColor = '#28a745';
            }
            
            // Add resize handles
            this.addResizeHandles(overlay);
            
            // Add drag and interaction handlers
            this.addDragHandlers(overlay, part, image, container);

            // Add label
            const label = document.createElement('div');
            label.textContent = part.toUpperCase();
            label.style.position = 'absolute';
            label.style.top = '-25px';
            label.style.left = '50%';
            label.style.transform = 'translateX(-50%)';
            label.style.background = '#dc3545';
            label.style.color = 'white';
            label.style.padding = '2px 8px';
            label.style.borderRadius = '4px';
            label.style.fontSize = '10px';
            label.style.fontWeight = 'bold';
            label.style.whiteSpace = 'nowrap';
            overlay.appendChild(label);
            
            container.appendChild(overlay);
        }
    }

    addResizeHandles(overlay) {
        // Create resize handles for each corner and edge
        const handles = [
            { position: 'nw', cursor: 'nw-resize', top: '-4px', left: '-4px' },
            { position: 'ne', cursor: 'ne-resize', top: '-4px', right: '-4px' },
            { position: 'sw', cursor: 'sw-resize', bottom: '-4px', left: '-4px' },
            { position: 'se', cursor: 'se-resize', bottom: '-4px', right: '-4px' },
            { position: 'n', cursor: 'n-resize', top: '-4px', left: '50%', transform: 'translateX(-50%)' },
            { position: 's', cursor: 's-resize', bottom: '-4px', left: '50%', transform: 'translateX(-50%)' },
            { position: 'w', cursor: 'w-resize', left: '-4px', top: '50%', transform: 'translateY(-50%)' },
            { position: 'e', cursor: 'e-resize', right: '-4px', top: '50%', transform: 'translateY(-50%)' }
        ];

        handles.forEach(handle => {
            const handleElement = document.createElement('div');
            handleElement.className = `resize-handle resize-${handle.position}`;
            handleElement.style.position = 'absolute';
            handleElement.style.width = '8px';
            handleElement.style.height = '8px';
            handleElement.style.backgroundColor = '#007bff';
            handleElement.style.border = '2px solid #fff';
            handleElement.style.borderRadius = '50%';
            handleElement.style.cursor = handle.cursor;
            handleElement.style.zIndex = '11';
            handleElement.style.opacity = '0.9';
            handleElement.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
            
            // Hide handles by default, show on hover
            handleElement.style.display = 'none';

            // Set position
            Object.keys(handle).forEach(key => {
                if (key !== 'position' && key !== 'cursor') {
                    handleElement.style[key] = handle[key];
                }
            });

            // Add resize event handlers
            this.addResizeEventHandlers(handleElement, handle.position, overlay);
            
            overlay.appendChild(handleElement);
        });

        // Show/hide handles on overlay hover
        overlay.addEventListener('mouseenter', () => {
            overlay.querySelectorAll('.resize-handle').forEach(handle => {
                handle.style.display = 'block';
            });
        });

        overlay.addEventListener('mouseleave', () => {
            overlay.querySelectorAll('.resize-handle').forEach(handle => {
                handle.style.display = 'none';
            });
        });
    }

    addResizeEventHandlers(handle, position, overlay) {
        let isResizing = false;
        let startX, startY, startWidth, startHeight, startLeft, startTop;

        handle.addEventListener('mousedown', (e) => {
            e.stopPropagation(); // Prevent drag from starting
            isResizing = true;
            
            startX = e.clientX;
            startY = e.clientY;
            startWidth = parseInt(overlay.style.width);
            startHeight = parseInt(overlay.style.height);
            startLeft = parseInt(overlay.style.left);
            startTop = parseInt(overlay.style.top);

            document.addEventListener('mousemove', handleResize);
            document.addEventListener('mouseup', stopResize);
            
            e.preventDefault();
        });

        const handleResize = (e) => {
            if (!isResizing) return;

            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;

            let newWidth = startWidth;
            let newHeight = startHeight;
            let newLeft = startLeft;
            let newTop = startTop;

            // Handle different resize directions
            switch (position) {
                case 'se': // Southeast - increase width and height
                    newWidth = startWidth + deltaX;
                    newHeight = startHeight + deltaY;
                    break;
                case 'sw': // Southwest - increase height, decrease width, move left
                    newWidth = startWidth - deltaX;
                    newHeight = startHeight + deltaY;
                    newLeft = startLeft + deltaX;
                    break;
                case 'ne': // Northeast - increase width, decrease height, move up
                    newWidth = startWidth + deltaX;
                    newHeight = startHeight - deltaY;
                    newTop = startTop + deltaY;
                    break;
                case 'nw': // Northwest - decrease width and height, move up and left
                    newWidth = startWidth - deltaX;
                    newHeight = startHeight - deltaY;
                    newLeft = startLeft + deltaX;
                    newTop = startTop + deltaY;
                    break;
                case 'n': // North - decrease height, move up
                    newHeight = startHeight - deltaY;
                    newTop = startTop + deltaY;
                    break;
                case 's': // South - increase height
                    newHeight = startHeight + deltaY;
                    break;
                case 'w': // West - decrease width, move left
                    newWidth = startWidth - deltaX;
                    newLeft = startLeft + deltaX;
                    break;
                case 'e': // East - increase width
                    newWidth = startWidth + deltaX;
                    break;
            }

            // Apply minimum constraints
            newWidth = Math.max(20, newWidth);
            newHeight = Math.max(20, newHeight);

            // Apply changes
            overlay.style.width = newWidth + 'px';
            overlay.style.height = newHeight + 'px';
            overlay.style.left = newLeft + 'px';
            overlay.style.top = newTop + 'px';
        };

        const stopResize = () => {
            isResizing = false;
            document.removeEventListener('mousemove', handleResize);
            document.removeEventListener('mouseup', stopResize);
        };
    }

    addDragHandlers(overlay, part, image, container) {
        let isDragging = false;
        let startX, startY, startLeft, startTop;

        // Double-click to toggle blur (replacing single click)
        overlay.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.toggleBlurPart(part);
        });

        // Mouse down to start dragging
        overlay.addEventListener('mousedown', (e) => {
            // Don't start drag if clicking on a resize handle
            if (e.target.classList.contains('resize-handle')) {
                return;
            }

            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = parseInt(overlay.style.left);
            startTop = parseInt(overlay.style.top);

            overlay.style.cursor = 'grabbing';
            overlay.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
            
            document.addEventListener('mousemove', handleDrag);
            document.addEventListener('mouseup', stopDrag);
            
            e.preventDefault();
        });

        const handleDrag = (e) => {
            if (!isDragging) return;

            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;

            const newLeft = startLeft + deltaX;
            const newTop = startTop + deltaY;

            // Constrain to image bounds
            const maxLeft = image.offsetWidth - parseInt(overlay.style.width);
            const maxTop = image.offsetHeight - parseInt(overlay.style.height);

            overlay.style.left = Math.max(0, Math.min(maxLeft, newLeft)) + 'px';
            overlay.style.top = Math.max(0, Math.min(maxTop, newTop)) + 'px';
        };

        const stopDrag = () => {
            isDragging = false;
            overlay.style.cursor = 'move';
            overlay.style.boxShadow = 'none';
            document.removeEventListener('mousemove', handleDrag);
            document.removeEventListener('mouseup', stopDrag);
        };
    }

    getDefaultPartPosition(part) {
        const defaultPositions = {
            'genitalia': { x: 0.4, y: 0.6, width: 0.2, height: 0.3 },
            'breasts': { x: 0.35, y: 0.3, width: 0.3, height: 0.3 },
            'buttocks': { x: 0.3, y: 0.5, width: 0.4, height: 0.4 },
            'anus': { x: 0.45, y: 0.65, width: 0.1, height: 0.1 }
        };
        return defaultPositions[part];
    }

    toggleBlurPart(part) {
        if (!this.blurStates) return;
        
        this.blurStates[part] = !this.blurStates[part];
        
        // Update overlay appearance
        const overlay = document.querySelector(`.blur-overlay-${part}`);
        const toggleButton = document.getElementById(`blur-toggle-${part}`);
        
        if (overlay) {
            if (this.blurStates[part]) {
                // Apply blur effect using canvas
                const strength = document.getElementById('blurStrength').value;
                const opacity = document.getElementById('blurOpacity').value;
                this.applyCanvasBlur(overlay, this.getCurrentImage(), strength, opacity);
                overlay.style.borderColor = '#28a745';
            } else {
                // Remove blur effect
                this.removeCanvasBlur(overlay);
                overlay.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
                overlay.style.borderColor = '#dc3545';
            }
        }
        
        if (toggleButton) {
            if (this.blurStates[part]) {
                toggleButton.textContent = 'Unblur';
                toggleButton.className = 'px-2 py-1 text-xs rounded bg-green-100 text-green-800 hover:bg-green-200';
            } else {
                toggleButton.textContent = 'Blur';
                toggleButton.className = 'px-2 py-1 text-xs rounded bg-red-100 text-red-800 hover:bg-red-200';
            }
        }
    }

    updateBlurSettings() {
        const strength = document.getElementById('blurStrength').value;
        const opacity = document.getElementById('blurOpacity').value;
        const shape = document.getElementById('blurShape').value;
        
        // Update display values
        document.getElementById('blurStrengthValue').textContent = strength;
        document.getElementById('blurOpacityValue').textContent = Math.round(opacity * 100);
        
        // Apply to all active blur overlays
        Object.keys(this.blurStates || {}).forEach(part => {
            if (this.blurStates[part]) {
                const overlay = document.querySelector(`.blur-overlay-${part}`);
                if (overlay) {
                    this.applyCanvasBlur(overlay, this.getCurrentImage(), strength, opacity);
                    
                    // Update shape
                    overlay.style.borderRadius = shape === 'oval' ? '50%' : 
                                                 shape === 'rounded' ? '15px' : '0px';
                }
            }
        });
    }

    applyCanvasBlur(overlay, sourceImage, blurStrength, opacity) {
        BlurUtils.applyCanvasBlur(overlay, sourceImage, blurStrength, opacity);
    }
    
    removeCanvasBlur(overlay) {
        BlurUtils.removeCanvasBlur(overlay);
    }
    

    getCurrentImage() {
        // Find the current image being edited
        const imageElement = document.querySelector('.image-container img, .media-viewer img');
        return imageElement;
    }

    toggleAllBlurs() {
        if (!this.blurStates) return;
        
        const allBlurred = Object.values(this.blurStates).every(state => state);
        
        Object.keys(this.blurStates).forEach(part => {
            if (allBlurred) {
                // If all are blurred, unblur all
                if (this.blurStates[part]) this.toggleBlurPart(part);
            } else {
                // If not all are blurred, blur all
                if (!this.blurStates[part]) this.toggleBlurPart(part);
            }
        });
    }

    addNewBlurArea() {
        const image = document.getElementById('blurPreviewImage');
        const container = document.getElementById('blurImageContainer');
        
        if (!image || !container) return;

        // Create a new custom blur area
        const customAreaId = `custom_${Date.now()}`;
        const defaultSize = 100; // pixels
        
        // Position in center of image
        const centerX = (image.offsetWidth - defaultSize) / 2;
        const centerY = (image.offsetHeight - defaultSize) / 2;
        
        const customLocation = {
            x: centerX,
            y: centerY,
            width: defaultSize,
            height: defaultSize,
            confidence: 100 // Custom areas are 100% confidence
        };

        // Add to blur states
        this.blurStates[customAreaId] = true;
        
        // Create the overlay
        this.createBlurOverlay(customAreaId, customLocation, image, container);
        
        // Add to detected parts list in the UI
        this.addCustomPartToUI(customAreaId);
        
        console.log(`Added new custom blur area: ${customAreaId}`);
    }

    addCustomPartToUI(customAreaId) {
        const violationsList = document.querySelector('.space-y-2');
        if (!violationsList) return;

        const customPartDiv = document.createElement('div');
        customPartDiv.className = 'flex items-center justify-between';
        customPartDiv.innerHTML = `
            <span class="text-sm text-red-800 capitalize">Custom Area:</span>
            <div class="flex items-center space-x-2">
                <span class="text-sm font-medium text-red-900">100.0%</span>
                <button onclick="window.systemAdminDashboard.toggleBlurPart('${customAreaId}')" 
                        id="blur-toggle-${customAreaId}"
                        class="px-2 py-1 text-xs rounded bg-green-100 text-green-800 hover:bg-green-200">
                    Unblur
                </button>
                <button onclick="window.systemAdminDashboard.removeBlurArea('${customAreaId}')" 
                        class="px-2 py-1 text-xs rounded bg-red-100 text-red-800 hover:bg-red-200">
                    Remove
                </button>
            </div>
        `;
        
        violationsList.appendChild(customPartDiv);
    }

    removeBlurArea(partId) {
        // Remove from UI
        const overlay = document.querySelector(`.blur-overlay-${partId}`);
        if (overlay) {
            overlay.remove();
        }
        
        // Remove from blur states
        delete this.blurStates[partId];
        
        // Remove from UI list
        const partDiv = document.querySelector(`#blur-toggle-${partId}`)?.closest('.flex');
        if (partDiv) {
            partDiv.remove();
        }
        
        console.log(`Removed blur area: ${partId}`);
    }

    async saveBlurApproval(mediaId) {
        console.log('saveBlurApproval called with mediaId:', mediaId);
        console.log('currentBlurItem:', this.currentBlurItem);
        
        if (!this.currentBlurItem || !mediaId) {
            alert('No media item to approve');
            return;
        }
        
        const blurredParts = Object.entries(this.blurStates || {})
            .filter(([part, isBlurred]) => isBlurred)
            .map(([part]) => part);
        
        if (blurredParts.length === 0) {
            if (!confirm('No blur effects applied. Continue with approval?')) {
                return;
            }
        }
        
        const notes = (prompt('Add approval notes (optional):') || '').substring(0, 500);
        
        // Capture final positions and sizes of all overlays
        const overlayData = {};
        const image = document.getElementById('blurPreviewImage');
        
        console.log('Starting to capture overlay data for parts:', blurredParts);
        
        blurredParts.forEach(part => {
            const overlay = document.querySelector(`.blur-overlay-${part}`);
            if (overlay && image) {
                // Get overlay style properties
                
                // Get current overlay dimensions and position
                const left = parseInt(overlay.style.left) || 0;
                const top = parseInt(overlay.style.top) || 0;
                const width = parseInt(overlay.style.width) || 50;
                const height = parseInt(overlay.style.height) || 50;
                
                // Convert back to natural image coordinates for storage
                const scaleX = image.naturalWidth > 0 ? image.naturalWidth / image.offsetWidth : 1;
                const scaleY = image.naturalHeight > 0 ? image.naturalHeight / image.offsetHeight : 1;
                
                console.log(`SCALING DEBUG for ${part}:`);
                console.log(`Natural: ${image.naturalWidth}x${image.naturalHeight}`);
                console.log(`Display: ${image.offsetWidth}x${image.offsetHeight}`);
                console.log(`Scale factors: ${scaleX.toFixed(3)}x${scaleY.toFixed(3)}`);
                console.log(`Display coords: ${left},${top} ${width}x${height}`);
                
                const naturalCoords = {
                    x: Math.round(left * scaleX),
                    y: Math.round(top * scaleY),
                    width: Math.round(width * scaleX),
                    height: Math.round(height * scaleY),
                    confidence: part.startsWith('custom_') ? 100 : (this.currentBlurItem.detected_parts && this.currentBlurItem.detected_parts[part] ? this.currentBlurItem.detected_parts[part] : 0)
                };
                
                console.log(`Natural coords: ${naturalCoords.x},${naturalCoords.y} ${naturalCoords.width}x${naturalCoords.height}`);
                console.log(`Expected backend range: 0-${image.naturalWidth} x 0-${image.naturalHeight}`);
                
                overlayData[part] = naturalCoords;
            } else {
                console.warn(`Could not find overlay or image for part: ${part}`);
            }
        });

        const blurSettings = {
            strength: parseInt(document.getElementById('blurStrength').value),
            opacity: parseFloat(document.getElementById('blurOpacity').value),
            shape: document.getElementById('blurShape').value,
            blurredParts: blurredParts,
            overlayPositions: overlayData
        };
        
        console.log('Final blur settings to send:', blurSettings);
        
        const requestBody = {
            blur_settings: blurSettings,
            admin_notes: notes,
            reviewed_by: (this.currentUser && this.currentUser.id) ? this.currentUser.id : 1
        };
        
        console.log('=== CLIENT REQUEST DEBUG ===');
        console.log('Media ID:', mediaId);
        console.log('Request body:', JSON.stringify(requestBody, null, 2));
        console.log('Notes length:', notes ? notes.length : 0);
        console.log('BlurredParts:', blurredParts);
        console.log('OverlayData:', overlayData);
        
        try {
            const headers = {
                'Content-Type': 'application/json'
            };
            
            if (this.authToken) {
                headers['Authorization'] = `Bearer ${this.authToken}`;
            }
            
            const response = await sysFetch(`/api/media-review-queue/approve-blur/${mediaId}`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody)
            });
            
            console.log('Response status:', response.status);
            console.log('Response headers:', response.headers);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Response not OK:', response.status, errorText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const data = await response.json();
            console.log('Response data:', data);
            
            if (data.success) {
                this.closeBlurToolModal();
                this.showNotification('Media approved with blur settings successfully', 'success');
                this.loadTabContent('media-queue');
            } else {
                throw new Error(data.error || 'Failed to approve media');
            }
            
        } catch (error) {
            console.error('Error approving media with blur:', error);
            console.error('Error stack:', error.stack);
            this.showNotification(`Error approving media: ${error.message}`, 'error');
        }
    }

    async rejectFromBlurTool(mediaId) {
        const reason = prompt('Reason for rejection (required):');
        if (!reason || !reason.trim()) {
            alert('Rejection reason is required');
            return;
        }
        
        if (!confirm('Are you sure you want to reject this media?')) {
            return;
        }
        
        try {
            const response = await sysFetch(`/api/media-review-queue/reject/${mediaId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    admin_notes: reason,
                    reviewed_by: this.currentUser.id || 1
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.closeBlurToolModal();
                this.showNotification('Media rejected successfully', 'success');
                this.loadTabContent('media-queue');
            } else {
                throw new Error(data.error || 'Failed to reject media');
            }
            
        } catch (error) {
            console.error('Error rejecting media:', error);
            this.showNotification(`Error rejecting media: ${error.message}`, 'error');
        }
    }
}

// Placeholder methods for other content sections
SystemAdminDashboard.prototype.loadVerificationQueueContent = async function() {
    return '<div class="text-center py-8"><p class="text-gray-600">Verification Queue - Coming Soon</p></div>';
};

SystemAdminDashboard.prototype.loadSubscriptionManagementContent = async function() {
    return '<div class="text-center py-8"><p class="text-gray-600">Subscription Management - Coming Soon</p></div>';
};

SystemAdminDashboard.prototype.loadRevenueTrackingContent = async function() {
    return '<div class="text-center py-8"><p class="text-gray-600">Revenue Tracking - Coming Soon</p></div>';
};

SystemAdminDashboard.prototype.loadWhitelabelPartnersContent = async function() {
    return '<div class="text-center py-8"><p class="text-gray-600">Whitelabel Partners - Coming Soon</p></div>';
};

SystemAdminDashboard.prototype.loadTemplateBuilderContent = async function() {
    try {
        // Load template data
        const themeSetsData = await this.loadThemeSets();
        const pageSetssData = await this.loadPageSets();
        const businessTypesData = await this.loadBusinessTypes();
        
        return `
            <!-- Template Builder Dashboard -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <!-- Theme Sets Overview -->
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg font-medium text-gray-900">Theme Sets</h3>
                        <button id="addThemeSetBtn" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm">
                            <i class="fas fa-plus mr-1"></i> Add Theme
                        </button>
                    </div>
                    <div class="space-y-3">
                        ${themeSetsData.slice(0, 5).map(theme => `
                            <div class="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                                <div class="flex items-center space-x-3">
                                    <div class="w-4 h-4 rounded-full" style="background-color: ${theme.default_color_scheme.primary || '#3B82F6'}"></div>
                                    <div>
                                        <div class="text-sm font-medium text-gray-900">${theme.display_name}</div>
                                        <div class="text-xs text-gray-500">${theme.category} • ${theme.pricing_tier}</div>
                                    </div>
                                </div>
                                <div class="flex space-x-2">
                                    <button onclick="editThemeSet(${theme.id})" class="text-blue-600 hover:text-blue-800">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button onclick="duplicateThemeSet(${theme.id})" class="text-green-600 hover:text-green-800">
                                        <i class="fas fa-copy"></i>
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                        ${themeSetsData.length > 5 ? `<div class="text-center"><button class="text-blue-600 text-sm">View All ${themeSetsData.length} Themes</button></div>` : ''}
                    </div>
                </div>

                <!-- Page Sets Overview -->
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg font-medium text-gray-900">Page Sets</h3>
                        <button id="addPageSetBtn" class="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm">
                            <i class="fas fa-plus mr-1"></i> Add Page Set
                        </button>
                    </div>
                    <div class="space-y-3">
                        ${pageSetssData.slice(0, 5).map(pageSet => `
                            <div class="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                                <div>
                                    <div class="text-sm font-medium text-gray-900">${pageSet.display_name}</div>
                                    <div class="text-xs text-gray-500">${pageSet.tier} • ${pageSet.included_pages?.length || 0} pages</div>
                                </div>
                                <div class="flex space-x-2">
                                    <button onclick="editPageSet(${pageSet.id})" class="text-blue-600 hover:text-blue-800">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button onclick="duplicatePageSet(${pageSet.id})" class="text-green-600 hover:text-green-800">
                                        <i class="fas fa-copy"></i>
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                        ${pageSetssData.length > 5 ? `<div class="text-center"><button class="text-blue-600 text-sm">View All ${pageSetssData.length} Page Sets</button></div>` : ''}
                    </div>
                </div>
            </div>

            <!-- Template Management Tabs -->
            <div class="bg-white rounded-lg shadow">
                <div class="border-b border-gray-200">
                    <nav class="-mb-px flex space-x-8" aria-label="Tabs">
                        <button class="template-tab-btn active border-blue-500 text-blue-600 py-4 px-1 border-b-2 font-medium text-sm" data-tab="themes">
                            Theme Sets
                        </button>
                        <button class="template-tab-btn border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 py-4 px-1 border-b-2 font-medium text-sm" data-tab="pages">
                            Page Sets
                        </button>
                        <button class="template-tab-btn border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 py-4 px-1 border-b-2 font-medium text-sm" data-tab="combinations">
                            Template Combinations
                        </button>
                    </nav>
                </div>

                <div class="p-6">
                    <!-- Themes Tab -->
                    <div id="themes-tab-content" class="template-tab-content">
                        <div class="flex justify-between items-center mb-6">
                            <div>
                                <h3 class="text-lg font-medium text-gray-900">Theme Sets Management</h3>
                                <p class="text-sm text-gray-600">Manage visual themes, color schemes, and styling options</p>
                            </div>
                            <div class="flex space-x-3">
                                <select id="themeFilterCategory" class="border border-gray-300 rounded-md px-3 py-2 text-sm">
                                    <option value="">All Categories</option>
                                    <option value="professional">Professional</option>
                                    <option value="luxury">Luxury</option>
                                    <option value="creative">Creative</option>
                                    <option value="business">Business</option>
                                </select>
                                <select id="themeFilterTier" class="border border-gray-300 rounded-md px-3 py-2 text-sm">
                                    <option value="">All Tiers</option>
                                    <option value="free">Free</option>
                                    <option value="premium">Premium</option>
                                    <option value="enterprise">Enterprise</option>
                                </select>
                            </div>
                        </div>

                        <!-- Themes Grid -->
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            ${themeSetsData.map(theme => `
                                <div class="border rounded-lg p-4 hover:shadow-md transition-shadow">
                                    <div class="flex items-center justify-between mb-3">
                                        <h4 class="font-medium text-gray-900">${theme.display_name}</h4>
                                        <div class="flex space-x-1">
                                            ${Object.values(theme.default_color_scheme).slice(0, 3).map(color => 
                                                `<div class="w-4 h-4 rounded-full border border-gray-200" style="background-color: ${color}"></div>`
                                            ).join('')}
                                        </div>
                                    </div>
                                    <p class="text-sm text-gray-600 mb-3">${theme.description}</p>
                                    <div class="flex items-center justify-between">
                                        <div class="flex space-x-2">
                                            <span class="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">${theme.category}</span>
                                            <span class="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">${theme.pricing_tier}</span>
                                        </div>
                                        <div class="flex space-x-2">
                                            <button onclick="previewTheme(${theme.id})" class="text-gray-600 hover:text-gray-800" title="Preview">
                                                <i class="fas fa-eye"></i>
                                            </button>
                                            <button onclick="editThemeSet(${theme.id})" class="text-blue-600 hover:text-blue-800" title="Edit">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                            <button onclick="duplicateThemeSet(${theme.id})" class="text-green-600 hover:text-green-800" title="Duplicate">
                                                <i class="fas fa-copy"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Page Sets Tab -->
                    <div id="pages-tab-content" class="template-tab-content hidden">
                        <div class="flex justify-between items-center mb-6">
                            <div>
                                <h3 class="text-lg font-medium text-gray-900">Page Sets Management</h3>
                                <p class="text-sm text-gray-600">Manage page templates and content structures</p>
                            </div>
                            <div class="flex space-x-3">
                                <select id="pageSetFilterBusiness" class="border border-gray-300 rounded-md px-3 py-2 text-sm">
                                    <option value="">All Business Types</option>
                                    ${businessTypesData.map(bt => `<option value="${bt.id}">${bt.display_name}</option>`).join('')}
                                </select>
                                <select id="pageSetFilterTier" class="border border-gray-300 rounded-md px-3 py-2 text-sm">
                                    <option value="">All Tiers</option>
                                    <option value="basic">Basic</option>
                                    <option value="professional">Professional</option>
                                    <option value="premium">Premium</option>
                                    <option value="enterprise">Enterprise</option>
                                </select>
                            </div>
                        </div>

                        <!-- Page Sets Grid -->
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            ${pageSetssData.map(pageSet => `
                                <div class="border rounded-lg p-4 hover:shadow-md transition-shadow">
                                    <div class="flex items-center justify-between mb-3">
                                        <h4 class="font-medium text-gray-900">${pageSet.display_name}</h4>
                                        <span class="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800">${pageSet.tier}</span>
                                    </div>
                                    <p class="text-sm text-gray-600 mb-3">${pageSet.description}</p>
                                    <div class="mb-3">
                                        <div class="text-xs font-medium text-gray-700 mb-1">Included Pages (${pageSet.included_pages?.length || 0}):</div>
                                        <div class="flex flex-wrap gap-1">
                                            ${(pageSet.included_pages || []).slice(0, 6).map(page => 
                                                `<span class="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">${page}</span>`
                                            ).join('')}
                                            ${(pageSet.included_pages?.length || 0) > 6 ? '<span class="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">+' + ((pageSet.included_pages?.length || 0) - 6) + ' more</span>' : ''}
                                        </div>
                                    </div>
                                    <div class="flex items-center justify-between">
                                        <div class="flex space-x-2">
                                            ${pageSet.features ? Object.keys(pageSet.features).slice(0, 2).map(feature => 
                                                `<span class="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">${feature}</span>`
                                            ).join('') : ''}
                                        </div>
                                        <div class="flex space-x-2">
                                            <button onclick="editPageSet(${pageSet.id})" class="text-blue-600 hover:text-blue-800" title="Edit">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                            <button onclick="duplicatePageSet(${pageSet.id})" class="text-green-600 hover:text-green-800" title="Duplicate">
                                                <i class="fas fa-copy"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Template Combinations Tab -->
                    <div id="combinations-tab-content" class="template-tab-content hidden">
                        <div class="text-center py-8">
                            <i class="fas fa-layer-group text-4xl text-gray-400 mb-4"></i>
                            <h3 class="text-lg font-medium text-gray-900 mb-2">Template Combinations</h3>
                            <p class="text-gray-600 mb-4">Create pre-configured combinations of theme sets and page sets for different business types</p>
                            <button class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                                <i class="fas fa-plus mr-2"></i>
                                Create Template Combination
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modals will be added dynamically -->
            <div id="templateModalsContainer"></div>
        `;
    } catch (error) {
        console.error('Error loading template builder content:', error);
        return `
            <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                <div class="flex">
                    <div class="flex-shrink-0">
                        <i class="fas fa-exclamation-triangle text-red-400"></i>
                    </div>
                    <div class="ml-3">
                        <h3 class="text-sm font-medium text-red-800">Error Loading Template Data</h3>
                        <div class="mt-2 text-sm text-red-700">
                            <p>Failed to load template builder interface. Please try again.</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
};

SystemAdminDashboard.prototype.loadStaffManagementContent = async function() {
    return '<div class="text-center py-8"><p class="text-gray-600">Staff Management - Coming Soon</p></div>';
};

SystemAdminDashboard.prototype.loadSystemSettingsContent = async function() {
    return '<div class="text-center py-8"><p class="text-gray-600">System Settings - Coming Soon</p></div>';
};

SystemAdminDashboard.prototype.loadFinancialReportsContent = async function() {
    return '<div class="text-center py-8"><p class="text-gray-600">Financial Reports - Coming Soon</p></div>';
};

SystemAdminDashboard.prototype.loadAuditLogsContent = async function() {
    return '<div class="text-center py-8"><p class="text-gray-600">Audit Logs - Coming Soon</p></div>';
};

// Enhanced Review Modal Methods
SystemAdminDashboard.prototype.openEnhancedReview = async function(mediaId) {
    try {
        // Fetch media details for analysis
        const response = await sysFetch(`/api/media-review-queue/item/${mediaId}`, {
            headers: {
                'Authorization': `Bearer ${this.authToken}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error);
        }

        // Create enhanced modal
        this.createEnhancedModal(data.item);
        
    } catch (error) {
        console.error('Error opening enhanced review:', error);
        this.showNotification('Failed to load enhanced review: ' + error.message, 'error');
    }
};

SystemAdminDashboard.prototype.createEnhancedModal = function(item) {
    // Remove existing modal if any
    const existingModal = document.getElementById('enhancedReviewModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Create modal HTML
    const modalHtml = `
        <div id="enhancedReviewModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" style="backdrop-filter: blur(4px);">
            <div class="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-screen overflow-hidden mx-4">
                ${this.generateEnhancedModalContent(item)}
            </div>
        </div>
    `;

    // Add to page
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Add click outside to close
    document.getElementById('enhancedReviewModal').addEventListener('click', (e) => {
        if (e.target.id === 'enhancedReviewModal') {
            this.closeEnhancedModal();
        }
    });
};

SystemAdminDashboard.prototype.generateEnhancedModalContent = function(item) {
    return `
        <div class="flex items-center justify-between p-4 border-b bg-gray-50">
            <h2 class="text-xl font-bold text-gray-800">Enhanced Media Review - ${item.model_name}</h2>
            <button onclick="window.systemAdminDashboard.closeEnhancedModal()" 
                    class="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600">
                <i class="fas fa-times"></i> Close
            </button>
        </div>
        <div class="h-full">
            <iframe 
                src="admin-queue-review-v2.html?mediaId=${item.id}&t=${Date.now()}" 
                width="100%" 
                height="800px" 
                frameborder="0"
                style="border: none; min-height: 800px;"
                onload="console.log('Enhanced review iframe loaded:', this.src)"
                onerror="console.error('Enhanced review iframe failed to load:', this.src)">
            </iframe>
        </div>
    `;
};

SystemAdminDashboard.prototype.closeEnhancedModal = function() {
    const modal = document.getElementById('enhancedReviewModal');
    if (modal) {
        modal.remove();
    }
};

// Enhanced approval methods that can be called from iframe
SystemAdminDashboard.prototype.approveWithEnhancedBlur = async function(mediaId) {
    try {
        console.log('Approving with enhanced blur for media:', mediaId);
        
        const response = await sysFetch(`/api/media-review-queue/approve/${mediaId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'approve_with_blur',
                admin_notes: 'Approved with enhanced blur controls'
            })
        });

        const data = await response.json();
        
        if (data.success) {
            this.showNotification('Media approved with blur settings', 'success');
            this.closeEnhancedModal();
            this.loadTabContent('media-queue'); // Refresh the queue
        } else {
            throw new Error(data.error);
        }
        
    } catch (error) {
        console.error('Error approving with blur:', error);
        this.showNotification('Failed to approve: ' + error.message, 'error');
    }
};

SystemAdminDashboard.prototype.approveWithoutBlur = async function(mediaId) {
    try {
        console.log('Approving without blur for media:', mediaId);
        
        const response = await sysFetch(`/api/media-review-queue/approve/${mediaId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'approve_clean',
                admin_notes: 'Approved without blur'
            })
        });

        const data = await response.json();
        
        if (data.success) {
            this.showNotification('Media approved without blur', 'success');
            this.closeEnhancedModal();
            this.loadTabContent('media-queue'); // Refresh the queue
        } else {
            throw new Error(data.error);
        }
        
    } catch (error) {
        console.error('Error approving clean:', error);
        this.showNotification('Failed to approve: ' + error.message, 'error');
    }
};

SystemAdminDashboard.prototype.rejectContent = async function(mediaId) {
    try {
        const reason = prompt('Please provide a reason for rejection:');
        if (!reason) return;
        
        console.log('Rejecting media:', mediaId, 'Reason:', reason);
        
        const response = await sysFetch(`/api/media-review-queue/reject/${mediaId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                admin_notes: reason
            })
        });

        const data = await response.json();
        
        if (data.success) {
            this.showNotification('Media rejected successfully', 'success');
            this.closeEnhancedModal();
            this.loadTabContent('media-queue'); // Refresh the queue
        } else {
            throw new Error(data.error);
        }
        
    } catch (error) {
        console.error('Error rejecting content:', error);
        this.showNotification('Failed to reject: ' + error.message, 'error');
    }
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.systemAdminDashboard = new SystemAdminDashboard();
});

// Global utility functions
window.showNotification = function(message, type = 'info') {
    if (window.systemAdminDashboard) {
        window.systemAdminDashboard.showNotification(message, type);
    }
};

// Make client management functions globally accessible for onclick handlers
window.editClient = function(clientId) {
    if (window.systemAdminDashboard) {
        window.systemAdminDashboard.editClient(clientId);
    }
};

window.impersonateClient = function(clientId) {
    if (window.systemAdminDashboard) {
        window.systemAdminDashboard.impersonateClient(clientId);
    }
};

window.deleteClient = function(clientId) {
    if (window.systemAdminDashboard) {
        window.systemAdminDashboard.deleteClient(clientId);
    }
};

window.closeModal = function(modalId) {
    if (window.systemAdminDashboard) {
        window.systemAdminDashboard.closeModal(modalId);
    }
};

// Template management global functions
window.editThemeSet = function(themeId) {
    console.log('Edit theme set:', themeId);
    if (window.systemAdminDashboard) {
        window.systemAdminDashboard.showNotification('Edit theme functionality coming soon', 'info');
    }
};

window.duplicateThemeSet = function(themeId) {
    console.log('Duplicate theme set:', themeId);
    if (window.systemAdminDashboard) {
        window.systemAdminDashboard.showNotification('Duplicate theme functionality coming soon', 'info');
    }
};

window.previewTheme = function(themeId) {
    console.log('Preview theme:', themeId);
    if (window.systemAdminDashboard) {
        window.systemAdminDashboard.showNotification('Theme preview functionality coming soon', 'info');
    }
};

window.editPageSet = function(pageSetId) {
    console.log('Edit page set:', pageSetId);
    if (window.systemAdminDashboard) {
        window.systemAdminDashboard.showNotification('Edit page set functionality coming soon', 'info');
    }
};

window.duplicatePageSet = function(pageSetId) {
    console.log('Duplicate page set:', pageSetId);
    if (window.systemAdminDashboard) {
        window.systemAdminDashboard.showNotification('Duplicate page set functionality coming soon', 'info');
    }
};

// Content moderation global functions
window.reviewContent = function(contentId, status) {
    if (window.systemAdminDashboard) {
        window.systemAdminDashboard.reviewContent(contentId, status);
    }
};

window.viewFullImage = function(imagePath) {
    // Create modal to display full image
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Full Image View</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body text-center">
                    <img src="/public/${imagePath}" alt="Full image" style="max-width: 100%; height: auto;">
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    
    modal.addEventListener('hidden.bs.modal', () => {
        document.body.removeChild(modal);
    });
};

window.refreshModerationQueue = function() {
    if (window.systemAdminDashboard) {
        window.systemAdminDashboard.loadTabContent('content-moderation');
    }
};

window.filterModerationQueue = function() {
    const filter = document.getElementById('priorityFilter').value;
    const rows = document.querySelectorAll('.moderation-queue-card tbody tr');
    
    rows.forEach(row => {
        if (!filter) {
            row.style.display = '';
        } else {
            const priorityBadge = row.querySelector('.badge');
            const priority = priorityBadge ? priorityBadge.textContent.toLowerCase() : '';
            row.style.display = priority === filter ? '' : 'none';
        }
    });
};

// Global functions for HTML onclick handlers
function openContentReviewTool() {
    window.open('/admin-content-review.html', '_blank', 'width=1400,height=900,scrollbars=yes,resizable=yes');
}

function openModerationDashboard() {
    window.open('/admin-moderation-dashboard.html', '_blank', 'width=1600,height=1000,scrollbars=yes,resizable=yes');
}

// Client Manager for dropdown actions
window.clientManager = {
    async deleteClient(clientId) {
        console.log('Delete client called with ID:', clientId);
        
        if (!confirm('Are you sure you want to delete this client? This action cannot be undone and will remove all associated data including their website, uploads, and user account.')) {
            console.log('User cancelled deletion');
            return;
        }
        
        console.log('User confirmed deletion, making API call...');
        
        try {
            const response = await sysFetch(`/api/system-management/clients/${clientId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('API Response status:', response.status);
            console.log('API Response headers:', response.headers);
            
            const result = await response.json();
            console.log('API Response body:', result);
            
            if (result.success) {
                alert('Client deleted successfully');
                console.log('SUCCESS: Client deleted, reloading page...');
                // Reload the page to refresh the client list
                window.location.reload();
            } else {
                console.log('ERROR: API returned error:', result.error);
                alert('Error deleting client: ' + result.error);
            }
        } catch (error) {
            console.error('Delete client exception:', error);
            alert('Failed to delete client. Please try again. Check console for details.');
        }
    },
    
    async viewClient(clientId) {
        window.open(`/api/system-management/clients/${clientId}`, '_blank');
    },
    
    async resetPassword(clientId) {
        alert('Password reset functionality will be implemented soon');
    },
    
    async suspendAccount(clientId) {
        alert('Account suspension functionality will be implemented soon');
    },
    
    async impersonateClient(clientId) {
        alert('Impersonation functionality will be implemented soon');
    }
};

// Global functions for data table actions
async function deleteItem(id) {
    if (!confirm('Are you sure you want to delete this client? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await sysFetch(`/api/system-management/clients/${id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('Client deleted successfully');
            // Refresh the current tab to update the client list
            if (window.systemAdminDashboard) {
                window.systemAdminDashboard.loadTabContent(window.systemAdminDashboard.currentTab);
            }
        } else {
            alert('Error deleting client: ' + result.error);
        }
    } catch (error) {
        console.error('Delete client error:', error);
        alert('Failed to delete client. Please try again.');
    }
}

function editItem(id) {
    // TODO: Implement edit functionality - could open a modal or navigate to edit page
    alert(`Edit client ID: ${id} - This feature will be implemented soon`);
}

function viewItem(id) {
    // Open the client details in a new window/tab
    window.open(`/api/system-management/clients/${id}`, '_blank');
}

// Utility method for loading external scripts
SystemAdminDashboard.prototype.loadScript = function(src) {
    return new Promise((resolve, reject) => {
        console.log('🔧 loadScript called with:', src);
        
        // Check if script is already loaded
        const existingScript = document.querySelector(`script[src="${src}"]`);
        if (existingScript) {
            console.log('📋 Script already loaded:', src);
            resolve();
            return;
        }
        
        console.log('🔄 Creating new script element for:', src);
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        
        script.onload = () => {
            console.log('✅ Script loaded successfully:', src);
            resolve();
        };
        
        script.onerror = (error) => {
            console.error('❌ Script failed to load:', src, error);
            reject(new Error(`Failed to load script: ${src}`));
        };
        
        document.head.appendChild(script);
        console.log('📤 Script element added to head:', src);
    });
};