if (window.ComponentRegistryClient) {
    window.ComponentRegistryClient.register('system-management', 'admin/js/system-management.js');
}

class SystemManagement {
    constructor() {
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.currentSort = { by: 'created_at', order: 'DESC' };
        this.selectedClients = new Set();
        this.businessTypes = [];
        this.currentClientId = null;
        
        this.init();
    }

    async init() {
        // Check if user has permission to access system management
        await this.checkSystemAccessPermission();
        
        this.setupEventListeners();
        this.loadInitialData();
        
        // Ensure impersonation manager is available after a short delay
        setTimeout(() => {
            if (!window.impersonationManager && window.ImpersonationManager) {
                console.log('Initializing impersonation manager fallback...');
                window.impersonationManager = new window.ImpersonationManager();
            }
        }, 1000);
    }

    async checkSystemAccessPermission() {
        try {
            const token = localStorage.getItem('phoenix4ge_token');
            if (!token) {
                this.redirectToLogin();
                return;
            }

            const response = await sysFetch('/api/auth/me', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to verify user');
            }

            const data = await response.json();
            const userRole = data.user?.role;

            // Only admin and sysadmin roles can access system management
            if (userRole !== 'admin' && userRole !== 'sysadmin') {
                console.warn('Access denied: User role', userRole, 'cannot access system management');
                alert('Access Denied: You do not have permission to access System Management.');
                window.location.href = 'index.html';
                return;
            }

            console.log('System management access granted for role:', userRole);
        } catch (error) {
            console.error('Permission check failed:', error);
            alert('Authentication error. Please log in again.');
            this.redirectToLogin();
        }
    }

    redirectToLogin() {
        // Clear all authentication data
        localStorage.removeItem('phoenix4ge_token');
        sessionStorage.clear();
        window.location.href = 'login.html';
    }

    setupEventListeners() {
        // Search functionality
        document.getElementById('searchInput').addEventListener('input', debounce(() => {
            this.currentPage = 1;
            this.loadClients();
        }, 300));

        // Filters
        document.getElementById('statusFilter').addEventListener('change', () => {
            this.currentPage = 1;
            this.loadClients();
        });

        document.getElementById('subscriptionFilter').addEventListener('change', () => {
            this.currentPage = 1;
            this.loadClients();
        });

        // Select all checkbox
        document.getElementById('selectAll').addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('#clientsTableBody input[type="checkbox"]');
            checkboxes.forEach(checkbox => {
                checkbox.checked = e.target.checked;
                if (e.target.checked) {
                    this.selectedClients.add(checkbox.value);
                } else {
                    this.selectedClients.delete(checkbox.value);
                }
            });
            this.updateBulkActions();
        });

        // Add client button
        document.getElementById('addClientBtn').addEventListener('click', () => {
            this.openClientModal();
        });

        // Bulk actions button
        document.getElementById('bulkActionsBtn').addEventListener('click', () => {
            this.openBulkModal();
        });

        // Export button
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportClients();
        });

        // Modal buttons
        document.getElementById('saveClientBtn').addEventListener('click', () => {
            this.saveClient();
        });

        document.getElementById('resetPasswordBtn').addEventListener('click', () => {
            this.resetPassword();
        });

        document.getElementById('viewSiteBtn').addEventListener('click', () => {
            this.viewClientSite();
        });

        document.getElementById('impersonateClientBtn').addEventListener('click', () => {
            this.openImpersonationModal();
        });

        document.getElementById('startImpersonationBtn').addEventListener('click', () => {
            this.startImpersonation();
        });

        document.getElementById('restrictionLevel').addEventListener('change', (e) => {
            this.toggleCustomRestrictions(e.target.value);
        });

        document.getElementById('testImpersonationBtn').addEventListener('click', () => {
            this.testImpersonationSystem();
        });

        document.getElementById('executeBulkBtn').addEventListener('click', () => {
            this.executeBulkAction();
        });

        // Modal close handlers
        document.querySelectorAll('[data-close-modal]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                this.closeModal(modal);
            });
        });

        // Logout button
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });
    }

    async loadInitialData() {
        try {
            this.showLoading(true);
            
            await Promise.all([
                this.loadStats(),
                this.loadBusinessTypes(),
                this.loadClients()
            ]);

        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showNotification('Failed to load initial data', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async loadStats() {
        try {
            const response = await sysFetch('/api/system-management/stats');
            const data = await response.json();

            if (data.success) {
                document.getElementById('totalClients').textContent = data.data.total_clients;
                document.getElementById('activeSubscriptions').textContent = data.data.active_subscriptions;
                document.getElementById('trialAccounts').textContent = data.data.trial_accounts;
                document.getElementById('monthlyRevenue').textContent = `$${data.data.monthly_revenue.toFixed(2)}`;
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    async loadBusinessTypes() {
        try {
            const response = await sysFetch('/api/system-management/business-types');
            const data = await response.json();

            if (data.success) {
                this.businessTypes = data.data;
                this.populateBusinessTypesDropdown();
            }
        } catch (error) {
            console.error('Error loading business types:', error);
        }
    }

    populateBusinessTypesDropdown() {
        const select = document.getElementById('modalBusinessType');
        select.innerHTML = '<option value="">Select Business Type</option>';
        
        this.businessTypes.forEach(type => {
            select.innerHTML += `<option value="${type.id}">${type.display_name}</option>`;
        });
    }

    async loadClients() {
        try {
            const params = new URLSearchParams({
                page: this.currentPage,
                limit: this.itemsPerPage,
                search: document.getElementById('searchInput').value,
                status: document.getElementById('statusFilter').value,
                subscription_status: document.getElementById('subscriptionFilter').value,
                sort_by: this.currentSort.by,
                sort_order: this.currentSort.order
            });

            const response = await sysFetch(`/api/system-management/clients?${params}`);
            const data = await response.json();

            if (data.success) {
                this.renderClientsTable(data.data.clients);
                this.renderPagination(data.data.pagination);
            } else {
                this.showNotification(data.error, 'error');
            }
        } catch (error) {
            console.error('Error loading clients:', error);
            this.showNotification('Failed to load clients', 'error');
        }
    }

    renderClientsTable(clients) {
        const tbody = document.getElementById('clientsTableBody');
        
        if (clients.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="px-6 py-8 text-center text-gray-500">
                        <i class="fas fa-users text-4xl mb-2"></i>
                        <p>No clients found</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = clients.map(client => `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                    <input type="checkbox" value="${client.id}" class="rounded border-gray-300 client-checkbox">
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-10 w-10">
                            <div class="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                                <span class="text-sm font-medium text-gray-700">
                                    ${client.name ? client.name.charAt(0).toUpperCase() : 'N'}
                                </span>
                            </div>
                        </div>
                        <div class="ml-4">
                            <div class="text-sm font-medium text-gray-900">${client.name || 'N/A'}</div>
                            <div class="text-sm text-gray-500">${client.email || 'No email'}</div>
                            <div class="text-xs text-blue-600">${client.slug}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="status-badge status-${client.status}">${client.status}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    ${client.subscription_status ? 
                        `<span class="status-badge subscription-${client.subscription_status}">${client.subscription_status}</span>` :
                        '<span class="text-gray-400">None</span>'
                    }
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${client.business_type || 'Not set'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${new Date(client.created_at).toLocaleDateString()}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div class="flex space-x-2">
                        <button onclick="systemManagement.editClient(${client.id})" 
                                class="text-indigo-600 hover:text-indigo-900" title="Edit client">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="systemManagement.quickImpersonate(${client.id}, '${client.slug}')" 
                                class="text-purple-600 hover:text-purple-900" title="Impersonate client">
                            <i class="fas fa-user-shield"></i>
                        </button>
                        <button onclick="systemManagement.viewClientSite('${client.slug}')" 
                                class="text-green-600 hover:text-green-900" title="View site">
                            <i class="fas fa-external-link-alt"></i>
                        </button>
                        <button onclick="systemManagement.deleteClient(${client.id})" 
                                class="text-red-600 hover:text-red-900" title="Delete client">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        // Add event listeners to checkboxes
        document.querySelectorAll('.client-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.selectedClients.add(e.target.value);
                } else {
                    this.selectedClients.delete(e.target.value);
                }
                this.updateBulkActions();
            });
        });
    }

    renderPagination(pagination) {
        const { current_page, total_pages, total } = pagination;
        
        // Update showing text
        const showingFrom = ((current_page - 1) * this.itemsPerPage) + 1;
        const showingTo = Math.min(current_page * this.itemsPerPage, total);
        
        document.getElementById('showingFrom').textContent = showingFrom;
        document.getElementById('showingTo').textContent = showingTo;
        document.getElementById('totalCount').textContent = total;

        // Generate pagination buttons
        const paginationContainer = document.getElementById('pagination');
        let paginationHTML = '';

        // Previous button
        if (current_page > 1) {
            paginationHTML += `
                <button onclick="systemManagement.goToPage(${current_page - 1})" 
                        class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">
                    <i class="fas fa-chevron-left"></i>
                </button>
            `;
        }

        // Page numbers
        const startPage = Math.max(1, current_page - 2);
        const endPage = Math.min(total_pages, current_page + 2);

        for (let i = startPage; i <= endPage; i++) {
            const isActive = i === current_page;
            paginationHTML += `
                <button onclick="systemManagement.goToPage(${i})" 
                        class="relative inline-flex items-center px-4 py-2 border ${isActive ? 'bg-blue-50 border-blue-500 text-blue-600' : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'} text-sm font-medium">
                    ${i}
                </button>
            `;
        }

        // Next button
        if (current_page < total_pages) {
            paginationHTML += `
                <button onclick="systemManagement.goToPage(${current_page + 1})" 
                        class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">
                    <i class="fas fa-chevron-right"></i>
                </button>
            `;
        }

        paginationContainer.innerHTML = paginationHTML;
    }

    goToPage(page) {
        this.currentPage = page;
        this.loadClients();
    }

    updateBulkActions() {
        const count = this.selectedClients.size;
        document.getElementById('bulkSelectedCount').textContent = 
            count === 0 ? 'No clients selected' : `${count} client${count === 1 ? '' : 's'} selected`;
    }

    openClientModal(clientId = null) {
        this.currentClientId = clientId;
        const modal = document.getElementById('clientModal');
        const title = document.getElementById('modalTitle');
        
        if (clientId) {
            title.textContent = 'Edit Client';
            this.loadClientData(clientId);
        } else {
            title.textContent = 'Add New Client';
            this.clearClientForm();
        }
        
        modal.classList.remove('hidden');
    }

    async loadClientData(clientId) {
        try {
            const response = await sysFetch(`/api/system-management/clients/${clientId}`);
            const data = await response.json();

            if (data.success) {
                const client = data.data;
                
                document.getElementById('modalClientName').value = client.name || '';
                document.getElementById('modalSlug').value = client.slug || '';
                document.getElementById('modalEmail').value = client.email || '';
                document.getElementById('modalPhone').value = client.phone || '';
                document.getElementById('modalStatus').value = client.status || '';
                document.getElementById('modalBusinessType').value = client.business_type_id || '';
                document.getElementById('modalSubscriptionStatus').value = client.subscription_status || '';
                document.getElementById('modalStripeCustomerId').value = client.stripe_customer_id || '';
                document.getElementById('modalStripeSubscriptionId').value = client.stripe_subscription_id || '';
                document.getElementById('modalBalanceDue').value = client.balance_due || '0.00';
                
                // Clear password field (we don't want to show existing password)
                document.getElementById('modalPassword').value = '';

                // Format dates for datetime-local inputs
                if (client.trial_ends_at) {
                    document.getElementById('modalTrialEndsAt').value = 
                        new Date(client.trial_ends_at).toISOString().slice(0, 16);
                }
                if (client.next_billing_at) {
                    document.getElementById('modalNextBillingAt').value = 
                        new Date(client.next_billing_at).toISOString().slice(0, 16);
                }
            }
        } catch (error) {
            console.error('Error loading client data:', error);
            this.showNotification('Failed to load client data', 'error');
        }
    }

    clearClientForm() {
        document.getElementById('modalClientName').value = '';
        document.getElementById('modalSlug').value = '';
        document.getElementById('modalEmail').value = '';
        document.getElementById('modalPhone').value = '';
        document.getElementById('modalPassword').value = '';
        document.getElementById('modalStatus').value = 'trial';
        document.getElementById('modalBusinessType').value = '';
        document.getElementById('modalSubscriptionStatus').value = '';
        document.getElementById('modalStripeCustomerId').value = '';
        document.getElementById('modalStripeSubscriptionId').value = '';
        document.getElementById('modalTrialEndsAt').value = '';
        document.getElementById('modalNextBillingAt').value = '';
        document.getElementById('modalBalanceDue').value = '0.00';
    }

    async saveClient() {
        try {
            const formData = {
                name: document.getElementById('modalClientName').value,
                slug: document.getElementById('modalSlug').value,
                email: document.getElementById('modalEmail').value,
                phone: document.getElementById('modalPhone').value,
                password: document.getElementById('modalPassword').value || null,
                status: document.getElementById('modalStatus').value,
                business_type_id: document.getElementById('modalBusinessType').value || null,
                subscription_status: document.getElementById('modalSubscriptionStatus').value || null,
                stripe_customer_id: document.getElementById('modalStripeCustomerId').value || null,
                stripe_subscription_id: document.getElementById('modalStripeSubscriptionId').value || null,
                trial_ends_at: document.getElementById('modalTrialEndsAt').value || null,
                next_billing_at: document.getElementById('modalNextBillingAt').value || null,
                balance_due: parseFloat(document.getElementById('modalBalanceDue').value) || 0
            };

            const isEdit = this.currentClientId !== null;
            const url = isEdit ? 
                `/api/system-management/clients/${this.currentClientId}` : 
                '/api/system-management/clients';
            const method = isEdit ? 'PUT' : 'POST';

            // For new clients, add required fields
            if (!isEdit) {
                formData.page_set_id = 1; // Default page set
                formData.theme_set_id = 1; // Default theme set
            }

            const response = await sysFetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification(data.message, 'success');
                this.closeModal(document.getElementById('clientModal'));
                this.loadClients();
                this.loadStats(); // Refresh stats
            } else {
                this.showNotification(data.error, 'error');
            }
        } catch (error) {
            console.error('Error saving client:', error);
            this.showNotification('Failed to save client', 'error');
        }
    }

    async editClient(clientId) {
        this.openClientModal(clientId);
    }

    async deleteClient(clientId) {
        if (!confirm('Are you sure you want to delete this client? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await sysFetch('/api/system-management/clients/bulk', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'delete',
                    client_ids: [clientId]
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification(data.message, 'success');
                this.loadClients();
                this.loadStats();
            } else {
                this.showNotification(data.error, 'error');
            }
        } catch (error) {
            console.error('Error deleting client:', error);
            this.showNotification('Failed to delete client', 'error');
        }
    }

    async resetPassword() {
        if (!this.currentClientId) return;

        try {
            const response = await sysFetch(`/api/system-management/clients/${this.currentClientId}/reset-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });

            const data = await response.json();

            if (data.success) {
                alert(`Password reset successfully!\n\nNew password: ${data.data.new_password}\n\nPlease provide this to the client.`);
                this.showNotification('Password reset successfully', 'success');
            } else {
                this.showNotification(data.error, 'error');
            }
        } catch (error) {
            console.error('Error resetting password:', error);
            this.showNotification('Failed to reset password', 'error');
        }
    }

    viewClientSite(slug = null) {
        const clientSlug = slug || document.getElementById('modalSlug').value;
        if (clientSlug) {
            window.open(`/${clientSlug}`, '_blank');
        }
    }

    openImpersonationModal() {
        if (!this.currentClientId) return;
        
        // Load client data into impersonation modal
        const clientName = document.getElementById('modalClientName').value;
        const clientSlug = document.getElementById('modalSlug').value;
        const businessType = document.getElementById('modalBusinessType');
        const businessTypeName = businessType.options[businessType.selectedIndex]?.text || 'Not set';
        
        document.getElementById('impersonateClientName').textContent = clientName || 'N/A';
        document.getElementById('impersonateClientSlug').textContent = clientSlug || 'N/A';
        document.getElementById('impersonateClientType').textContent = businessTypeName;
        
        document.getElementById('impersonationModal').classList.remove('hidden');
    }

    toggleCustomRestrictions(level) {
        const customDiv = document.getElementById('customRestrictions');
        if (level === 'custom') {
            customDiv.classList.remove('hidden');
        } else {
            customDiv.classList.add('hidden');
        }
    }

    async startImpersonation() {
        if (!this.currentClientId) return;

        try {
            const restrictionLevel = document.getElementById('restrictionLevel').value;
            const sessionDuration = document.getElementById('sessionDuration').value;
            
            let restrictions = {};
            
            // Apply predefined restrictions
            switch (restrictionLevel) {
                case 'full_access':
                    restrictions = {};
                    break;
                case 'limited_admin':
                    restrictions = {
                        blocked_routes: ["/api/admin/delete", "/api/billing/charges"],
                        blocked_actions: ["delete", "charge"],
                        read_only_fields: ["stripe_customer_id", "balance_due"]
                    };
                    break;
                case 'read_only':
                    restrictions = {
                        blocked_routes: ["/api/*/delete", "/api/*/update", "/api/billing/*"],
                        blocked_actions: ["create", "update", "delete"],
                        read_only_fields: ["*"]
                    };
                    break;
                case 'custom':
                    // Build custom restrictions
                    const blockedRoutes = [];
                    const blockedActions = [];
                    const readOnlyFields = [];
                    
                    if (document.getElementById('blockBilling').checked) {
                        blockedRoutes.push('/api/billing/*');
                        readOnlyFields.push('stripe_customer_id', 'stripe_subscription_id', 'balance_due');
                    }
                    if (document.getElementById('blockDelete').checked) {
                        blockedActions.push('delete');
                        blockedRoutes.push('/api/*/delete');
                    }
                    if (document.getElementById('blockPasswordChange').checked) {
                        blockedRoutes.push('/api/auth/change-password');
                        readOnlyFields.push('password');
                    }
                    
                    restrictions = {
                        blocked_routes: blockedRoutes,
                        blocked_actions: blockedActions,
                        read_only_fields: readOnlyFields
                    };
                    break;
            }

            // Get destination choice
            const destination = document.querySelector('input[name="destination"]:checked').value;
            
            // Use the global impersonation manager with destination
            if (window.impersonationManager) {
                await window.impersonationManager.startImpersonation(this.currentClientId, restrictions, destination);
                this.closeModal(document.getElementById('impersonationModal'));
            } else {
                console.error('Impersonation manager not available. Checking window object:', window);
                console.error('Available properties:', Object.keys(window).filter(key => key.includes('imperson')));
                throw new Error('Impersonation manager not available. Please refresh the page and try again.');
            }

        } catch (error) {
            console.error('Error starting impersonation:', error);
            this.showNotification('Failed to start impersonation: ' + error.message, 'error');
        }
    }

    async quickImpersonate(clientId, clientSlug) {
        // Show destination choice dialog
        const destination = await this.showDestinationChoice(clientSlug);
        
        if (destination) {
            try {
                const restrictions = {
                    blocked_routes: ["/api/admin/delete", "/api/billing/charges"],
                    blocked_actions: ["delete", "charge"],
                    read_only_fields: ["stripe_customer_id", "balance_due"]
                };

                if (window.impersonationManager) {
                    await window.impersonationManager.startImpersonation(clientId, restrictions, destination);
                } else {
                    console.error('Quick impersonation: Impersonation manager not available. Checking window object:', window);
                    console.error('Available properties:', Object.keys(window).filter(key => key.includes('imperson')));
                    throw new Error('Impersonation manager not available. Please refresh the page and try again.');
                }

            } catch (error) {
                console.error('Error starting quick impersonation:', error);
                this.showNotification('Failed to start impersonation: ' + error.message, 'error');
            }
        }
    }

    showDestinationChoice(clientSlug) {
        return new Promise((resolve) => {
            // Create modal overlay
            const overlay = document.createElement('div');
            overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
            overlay.innerHTML = `
                <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-xl font-semibold text-gray-900">Choose Destination</h3>
                        <button class="text-gray-400 hover:text-gray-600" onclick="this.closest('.fixed').remove(); resolve(null);">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <p class="text-gray-600 mb-6">Where would you like to impersonate <strong>${clientSlug}</strong>?</p>
                    
                    <div class="space-y-4 mb-6">
                        <button class="destination-btn w-full flex items-center p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors" data-destination="admin">
                            <i class="fas fa-cog text-blue-500 text-xl mr-4"></i>
                            <div class="text-left">
                                <div class="font-semibold text-gray-900">Client Admin Panel</div>
                                <div class="text-sm text-gray-600">Test how the client manages their content</div>
                            </div>
                        </button>
                        
                        <button class="destination-btn w-full flex items-center p-4 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors" data-destination="paysite">
                            <i class="fas fa-globe text-green-500 text-xl mr-4"></i>
                            <div class="text-left">
                                <div class="font-semibold text-gray-900">Public Paysite</div>
                                <div class="text-sm text-gray-600">Test subscriber/customer experience</div>
                            </div>
                        </button>
                    </div>
                    
                    <div class="flex justify-end">
                        <button class="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg" onclick="this.closest('.fixed').remove(); resolve(null);">
                            Cancel
                        </button>
                    </div>
                </div>
            `;

            // Add event listeners to destination buttons
            overlay.querySelectorAll('.destination-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const destination = btn.dataset.destination;
                    overlay.remove();
                    resolve(destination);
                });
            });

            document.body.appendChild(overlay);
        });
    }

    async testImpersonationSystem() {
        try {
            this.showNotification('Testing impersonation system...', 'info');
            
            // Test 1: Check system stats
            const statsResponse = await sysFetch('/api/impersonation/stats');
            const statsData = await statsResponse.json();
            
            if (!statsData.success) {
                throw new Error('Stats endpoint failed');
            }
            
            // Test 2: Start impersonation for first available client
            const clientsResponse = await sysFetch('/api/system-management/clients?page=1&limit=1');
            const clientsData = await clientsResponse.json();
            
            if (!clientsData.success || clientsData.data.clients.length === 0) {
                throw new Error('No clients available for testing');
            }
            
            const testClient = clientsData.data.clients[0];
            
            const startResponse = await sysFetch('/api/impersonation/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model_id: testClient.id,
                    restrictions: {
                        blocked_routes: ['/api/billing/*'],
                        blocked_actions: ['delete'],
                        read_only_fields: ['stripe_customer_id']
                    }
                })
            });
            
            const startData = await startResponse.json();
            
            if (!startData.success) {
                throw new Error('Failed to start impersonation: ' + startData.error);
            }
            
            // Test 3: Check audit log
            const auditResponse = await sysFetch('/api/impersonation/audit?page=1&limit=1');
            const auditData = await auditResponse.json();
            
            if (!auditData.success) {
                throw new Error('Audit endpoint failed');
            }
            
            // Test 4: End impersonation
            const endResponse = await sysFetch('/api/impersonation/end', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    session_id: startData.data.session_id
                })
            });
            
            const endData = await endResponse.json();
            
            if (!endData.success) {
                throw new Error('Failed to end impersonation: ' + endData.error);
            }
            
            // All tests passed
            this.showNotification(`✅ Impersonation system test successful!\n\nTested client: ${testClient.name}\nSession ID: ${startData.data.session_id.substring(0, 20)}...\nAudit records: ${auditData.data.pagination.total}`, 'success');
            
        } catch (error) {
            console.error('Impersonation test failed:', error);
            this.showNotification(`❌ Impersonation test failed: ${error.message}`, 'error');
        }
    }

    openBulkModal() {
        if (this.selectedClients.size === 0) {
            this.showNotification('Please select clients first', 'warning');
            return;
        }

        document.getElementById('bulkModal').classList.remove('hidden');
        this.updateBulkActions();
    }

    async executeBulkAction() {
        const action = document.getElementById('bulkAction').value;
        
        if (!action) {
            this.showNotification('Please select an action', 'warning');
            return;
        }

        if (action === 'delete' && !confirm('Are you sure you want to delete the selected clients? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await sysFetch('/api/system-management/clients/bulk', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: action,
                    client_ids: Array.from(this.selectedClients)
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification(data.message, 'success');
                this.closeModal(document.getElementById('bulkModal'));
                this.selectedClients.clear();
                document.getElementById('selectAll').checked = false;
                this.loadClients();
                this.loadStats();
            } else {
                this.showNotification(data.error, 'error');
            }
        } catch (error) {
            console.error('Error executing bulk action:', error);
            this.showNotification('Failed to execute bulk action', 'error');
        }
    }

    exportClients() {
        window.open('/api/system-management/clients/export/csv', '_blank');
    }

    closeModal(modal) {
        modal.classList.add('hidden');
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (show) {
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    }

    showNotification(message, type = 'info') {
        const container = document.getElementById('notifications');
        const id = Math.random().toString(36).substr(2, 9);
        
        const colors = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            warning: 'bg-yellow-500',
            info: 'bg-blue-500'
        };

        const notification = document.createElement('div');
        notification.id = id;
        notification.className = `notification ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg flex items-center justify-between max-w-sm`;
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

    async logout() {
        if (confirm('Are you sure you want to logout?')) {
            try {
                // Call server logout endpoint to invalidate session
                const token = localStorage.getItem('phoenix4ge_token');
                if (token) {
                    try {
                        await sysFetch('/api/auth/logout', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            }
                        });
                    } catch (error) {
                        console.warn('Server logout failed, continuing with client cleanup:', error);
                    }
                }
            } catch (error) {
                console.warn('Logout API call failed:', error);
            } finally {
                // Always perform complete client-side cleanup regardless of server response
                this.performCompleteLogout();
            }
        }
    }

    performCompleteLogout() {
        // Clear all localStorage items related to authentication
        localStorage.removeItem('phoenix4ge_token');
        localStorage.removeItem('phoenix4ge_user');
        localStorage.removeItem('phoenix4ge_session');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('userRole');
        localStorage.removeItem('impersonation_data');
        
        // Clear all sessionStorage items
        sessionStorage.clear();
        
        // Clear any cookies (if using cookies for session management)
        document.cookie.split(";").forEach(function(c) { 
            document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
        });
        
        // Clear browser cache for this domain (where possible)
        if ('caches' in window) {
            caches.keys().then(names => {
                names.forEach(name => {
                    caches.delete(name);
                });
            });
        }
        
        // Force redirect with cache busting
        const timestamp = new Date().getTime();
        window.location.href = `/admin/login.html?t=${timestamp}`;
    }
}

// Debounce utility function
function debounce(func, wait) {
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

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.systemManagement = new SystemManagement();
});