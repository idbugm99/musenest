class BusinessManagement {
    constructor() {
        this.businessTypes = [];
        this.pageSets = [];
        this.availablePages = [];
        this.currentTab = 'businessTypes';
        this.init();
    }

    init() {
        this.setupTabs();
        this.setupEventListeners();
        this.loadData();
    }

    setupTabs() {
        const tabs = document.querySelectorAll('.tab-button');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabId = e.target.id;
                this.switchTab(tabId.replace('Tab', ''));
            });
        });
    }

    switchTab(tabName) {
        // Update active tab button
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active', 'border-blue-500', 'text-blue-600');
            btn.classList.add('border-transparent', 'text-gray-500');
        });
        
        document.getElementById(tabName + 'Tab').classList.add('active', 'border-blue-500', 'text-blue-600');
        document.getElementById(tabName + 'Tab').classList.remove('border-transparent', 'text-gray-500');

        // Show/hide content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });
        document.getElementById(tabName + 'Content').classList.remove('hidden');
        
        this.currentTab = tabName;
    }

    setupEventListeners() {
        // Business Type Modal
        document.getElementById('addBusinessTypeBtn').addEventListener('click', () => this.showBusinessTypeModal());
        document.getElementById('closeBusinessTypeModal').addEventListener('click', () => this.hideBusinessTypeModal());
        document.getElementById('cancelBusinessType').addEventListener('click', () => this.hideBusinessTypeModal());
        document.getElementById('businessTypeForm').addEventListener('submit', (e) => this.saveBusinessType(e));

        // Page Set Modal
        document.getElementById('addPageSetBtn').addEventListener('click', () => this.showPageSetModal());
        document.getElementById('closePageSetModal').addEventListener('click', () => this.hidePageSetModal());
        document.getElementById('cancelPageSet').addEventListener('click', () => this.hidePageSetModal());
        document.getElementById('pageSetForm').addEventListener('submit', (e) => this.savePageSet(e));
    }

    async loadData() {
        await Promise.all([
            this.loadBusinessTypes(),
            this.loadPageSets(),
            this.loadAvailablePages()
        ]);
    }

    async loadBusinessTypes() {
        try {
            const response = await fetch('/api/admin-business/business-types');
            const data = await response.json();
            
            if (data.success) {
                this.businessTypes = data.data;
                this.renderBusinessTypes();
            }
        } catch (error) {
            console.error('Error loading business types:', error);
        }
    }

    async loadPageSets() {
        try {
            const response = await fetch('/api/admin-business/page-sets');
            const data = await response.json();
            
            if (data.success) {
                this.pageSets = data.data;
                this.renderPageSets();
            }
        } catch (error) {
            console.error('Error loading page sets:', error);
        }
    }

    async loadAvailablePages() {
        try {
            const response = await fetch('/api/onboarding/business-types');
            const data = await response.json();
            
            if (data.success) {
                // Get unique page types from all business types
                const allPages = new Set();
                allPages.add('home');
                allPages.add('about');
                allPages.add('contact');
                allPages.add('gallery');
                allPages.add('rates');
                allPages.add('etiquette');
                allPages.add('calendar');
                allPages.add('testimonials');
                allPages.add('blog');
                allPages.add('faq');
                allPages.add('schedule');
                allPages.add('tips');
                allPages.add('content');
                allPages.add('wishlist');
                allPages.add('services');
                allPages.add('staff');
                allPages.add('booking');
                allPages.add('screening');
                allPages.add('store');
                
                this.availablePages = Array.from(allPages).sort();
            }
        } catch (error) {
            console.error('Error loading available pages:', error);
        }
    }

    renderBusinessTypes() {
        const container = document.getElementById('businessTypesTable');
        
        if (this.businessTypes.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12">
                    <p class="text-gray-500">No business types found</p>
                </div>
            `;
            return;
        }

        let html = `
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Page Sets</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Themes</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Models</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
        `;

        this.businessTypes.forEach(businessType => {
            const statusBadge = businessType.is_active 
                ? '<span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Active</span>'
                : '<span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Inactive</span>';
            
            const warningBadges = [];
            if (businessType.age_verification_required) {
                warningBadges.push('<span class="inline-flex px-2 py-1 text-xs rounded-full bg-red-100 text-red-800 mr-1">18+</span>');
            }
            if (businessType.content_warnings_required) {
                warningBadges.push('<span class="inline-flex px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">Content Warning</span>');
            }

            html += `
                <tr>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div>
                            <div class="text-sm font-medium text-gray-900">${businessType.display_name}</div>
                            <div class="text-sm text-gray-500">${businessType.name}</div>
                            <div class="mt-1">${warningBadges.join('')}</div>
                        </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 capitalize">
                            ${businessType.category}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${businessType.page_sets_count}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${businessType.themes_count}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${businessType.models_count}</td>
                    <td class="px-6 py-4 whitespace-nowrap">${statusBadge}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button onclick="businessMgmt.editBusinessType(${businessType.id})" 
                                class="text-blue-600 hover:text-blue-900 mr-3">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="businessMgmt.deleteBusinessType(${businessType.id})" 
                                class="text-red-600 hover:text-red-900"
                                ${businessType.models_count > 0 ? 'disabled title="Cannot delete - has associated models"' : ''}>
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
        `;

        container.innerHTML = html;
    }

    renderPageSets() {
        const container = document.getElementById('pageSetsTable');
        
        if (this.pageSets.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12">
                    <p class="text-gray-500">No page sets found</p>
                </div>
            `;
            return;
        }

        let html = `
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Business Type</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tier</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pages</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Models Using</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
        `;

        this.pageSets.forEach(pageSet => {
            // included_pages is already parsed from JSON by the API
            const pages = Array.isArray(pageSet.included_pages) ? pageSet.included_pages : JSON.parse(pageSet.included_pages);
            const statusBadge = pageSet.is_active 
                ? '<span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Active</span>'
                : '<span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Inactive</span>';
            
            const tierColors = {
                'basic': 'bg-green-100 text-green-800',
                'professional': 'bg-blue-100 text-blue-800',
                'premium': 'bg-purple-100 text-purple-800',
                'enterprise': 'bg-gray-100 text-gray-800'
            };

            html += `
                <tr>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div>
                            <div class="text-sm font-medium text-gray-900">${pageSet.display_name}</div>
                            <div class="text-sm text-gray-500">${pageSet.name}</div>
                            ${pageSet.is_default ? '<div class="text-xs text-blue-600 font-medium">DEFAULT</div>' : ''}
                        </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="text-sm text-gray-900">${pageSet.business_type_display}</div>
                        <div class="text-sm text-gray-500">${pageSet.business_type_name}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${tierColors[pageSet.tier]} capitalize">
                            ${pageSet.tier}
                        </span>
                    </td>
                    <td class="px-6 py-4">
                        <div class="flex flex-wrap gap-1">
                            ${pages.slice(0, 5).map(page => 
                                `<span class="inline-flex px-2 py-1 text-xs rounded bg-gray-100 text-gray-800">${page}</span>`
                            ).join('')}
                            ${pages.length > 5 ? `<span class="text-xs text-gray-500">+${pages.length - 5} more</span>` : ''}
                        </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${pageSet.models_using_count}</td>
                    <td class="px-6 py-4 whitespace-nowrap">${statusBadge}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button onclick="businessMgmt.editPageSet(${pageSet.id})" 
                                class="text-blue-600 hover:text-blue-900 mr-3">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="businessMgmt.deletePageSet(${pageSet.id})" 
                                class="text-red-600 hover:text-red-900"
                                ${pageSet.models_using_count > 0 ? 'disabled title="Cannot delete - has associated models"' : ''}>
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
        `;

        container.innerHTML = html;
    }

    showBusinessTypeModal(businessType = null) {
        const modal = document.getElementById('businessTypeModal');
        const form = document.getElementById('businessTypeForm');
        const title = document.getElementById('businessTypeModalTitle');
        
        form.reset();
        
        if (businessType) {
            title.textContent = 'Edit Business Type';
            document.getElementById('businessTypeId').value = businessType.id;
            document.getElementById('businessTypeName').value = businessType.name;
            document.getElementById('businessTypeDisplayName').value = businessType.display_name;
            document.getElementById('businessTypeDescription').value = businessType.description || '';
            document.getElementById('businessTypeCategory').value = businessType.category;
            document.getElementById('businessTypePricingModel').value = businessType.pricing_model;
            document.getElementById('businessTypeAgeVerification').checked = businessType.age_verification_required;
            document.getElementById('businessTypeContentWarnings').checked = businessType.content_warnings_required;
        } else {
            title.textContent = 'Add Business Type';
            document.getElementById('businessTypeId').value = '';
        }
        
        modal.classList.remove('hidden');
    }

    hideBusinessTypeModal() {
        document.getElementById('businessTypeModal').classList.add('hidden');
    }

    async showPageSetModal(pageSet = null) {
        // Load business types for dropdown
        const businessTypeSelect = document.getElementById('pageSetBusinessType');
        businessTypeSelect.innerHTML = '<option value="">Select Business Type</option>';
        
        this.businessTypes.forEach(businessType => {
            if (businessType.is_active) {
                businessTypeSelect.innerHTML += `<option value="${businessType.id}">${businessType.display_name}</option>`;
            }
        });

        // Load available pages
        this.renderAvailablePages();

        const modal = document.getElementById('pageSetModal');
        const form = document.getElementById('pageSetForm');
        const title = document.getElementById('pageSetModalTitle');
        
        form.reset();
        
        if (pageSet) {
            title.textContent = 'Edit Page Set';
            document.getElementById('pageSetId').value = pageSet.id;
            document.getElementById('pageSetBusinessType').value = pageSet.business_type_id;
            document.getElementById('pageSetName').value = pageSet.name;
            document.getElementById('pageSetDisplayName').value = pageSet.display_name;
            document.getElementById('pageSetDescription').value = pageSet.description || '';
            document.getElementById('pageSetTier').value = pageSet.tier;
            document.getElementById('pageSetPricingTier').value = pageSet.pricing_tier;
            document.getElementById('pageSetSortOrder').value = pageSet.sort_order;
            document.getElementById('pageSetIsDefault').checked = pageSet.is_default;
            
            // Set selected pages
            const includedPages = Array.isArray(pageSet.included_pages) ? pageSet.included_pages : JSON.parse(pageSet.included_pages);
            includedPages.forEach(page => {
                const checkbox = document.querySelector(`input[name="included_pages"][value="${page}"]`);
                if (checkbox) checkbox.checked = true;
            });
        } else {
            title.textContent = 'Add Page Set';
            document.getElementById('pageSetId').value = '';
        }
        
        modal.classList.remove('hidden');
    }

    hidePageSetModal() {
        document.getElementById('pageSetModal').classList.add('hidden');
    }

    renderAvailablePages() {
        const container = document.getElementById('includedPagesContainer');
        let html = '';
        
        this.availablePages.forEach(page => {
            html += `
                <div class="flex items-center">
                    <input type="checkbox" name="included_pages" value="${page}" 
                           class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                    <label class="ml-2 block text-sm text-gray-900 capitalize">${page.replace('_', ' ')}</label>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }

    async saveBusinessType(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const data = {
            name: formData.get('name'),
            display_name: formData.get('display_name'),
            description: formData.get('description'),
            category: formData.get('category'),
            pricing_model: formData.get('pricing_model'),
            age_verification_required: formData.get('age_verification_required') === 'on',
            content_warnings_required: formData.get('content_warnings_required') === 'on'
        };

        const id = formData.get('id');
        const isEdit = id && id !== '';
        
        try {
            const response = await fetch(`/api/admin-business/business-types${isEdit ? '/' + id : ''}`, {
                method: isEdit ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            
            if (result.success) {
                this.hideBusinessTypeModal();
                await this.loadBusinessTypes();
            } else {
                alert('Error: ' + result.error);
            }
        } catch (error) {
            console.error('Error saving business type:', error);
            alert('An error occurred while saving');
        }
    }

    async savePageSet(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const includedPages = [];
        
        // Get selected pages
        document.querySelectorAll('input[name="included_pages"]:checked').forEach(checkbox => {
            includedPages.push(checkbox.value);
        });

        if (includedPages.length === 0) {
            alert('Please select at least one page');
            return;
        }

        const data = {
            business_type_id: parseInt(formData.get('business_type_id')),
            name: formData.get('name'),
            display_name: formData.get('display_name'),
            description: formData.get('description'),
            tier: formData.get('tier'),
            pricing_tier: formData.get('pricing_tier'),
            sort_order: parseInt(formData.get('sort_order')),
            is_default: formData.get('is_default') === 'on',
            included_pages: includedPages
        };

        const id = formData.get('id');
        const isEdit = id && id !== '';
        
        try {
            const response = await fetch(`/api/admin-business/page-sets${isEdit ? '/' + id : ''}`, {
                method: isEdit ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            
            if (result.success) {
                this.hidePageSetModal();
                await this.loadPageSets();
            } else {
                alert('Error: ' + result.error);
            }
        } catch (error) {
            console.error('Error saving page set:', error);
            alert('An error occurred while saving');
        }
    }

    editBusinessType(id) {
        const businessType = this.businessTypes.find(bt => bt.id === id);
        if (businessType) {
            this.showBusinessTypeModal(businessType);
        }
    }

    async deleteBusinessType(id) {
        const businessType = this.businessTypes.find(bt => bt.id === id);
        if (!businessType) return;

        if (!confirm(`Are you sure you want to delete the business type "${businessType.display_name}"?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/admin-business/business-types/${id}`, {
                method: 'DELETE'
            });

            const result = await response.json();
            
            if (result.success) {
                await this.loadBusinessTypes();
            } else {
                alert('Error: ' + result.error);
            }
        } catch (error) {
            console.error('Error deleting business type:', error);
            alert('An error occurred while deleting');
        }
    }

    editPageSet(id) {
        const pageSet = this.pageSets.find(ps => ps.id === id);
        if (pageSet) {
            this.showPageSetModal(pageSet);
        }
    }

    async deletePageSet(id) {
        const pageSet = this.pageSets.find(ps => ps.id === id);
        if (!pageSet) return;

        if (!confirm(`Are you sure you want to delete the page set "${pageSet.display_name}"?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/admin-business/page-sets/${id}`, {
                method: 'DELETE'
            });

            const result = await response.json();
            
            if (result.success) {
                await this.loadPageSets();
            } else {
                alert('Error: ' + result.error);
            }
        } catch (error) {
            console.error('Error deleting page set:', error);
            alert('An error occurred while deleting');
        }
    }
}

// Initialize the business management system
const businessMgmt = new BusinessManagement();