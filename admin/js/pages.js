if (window.ComponentRegistryClient) {
    window.ComponentRegistryClient.register('admin-pages', 'admin/js/pages.js');
}

class PageContentManager {
    constructor() {
        this.currentSection = null;
        this.pageTypes = [];
        this.pageSections = [];
        this.init();
    }

    init() {
        // Initialize event listeners when the pages tab is activated
        document.addEventListener('DOMContentLoaded', () => {
            const pagesTab = document.querySelector('[data-tab="pages"]');
            if (pagesTab) {
                pagesTab.addEventListener('click', () => this.loadPageContent());
            }

            // Set up event listeners
            this.setupEventListeners();
        });
    }

    setupEventListeners() {
        // Page type filter
        const pageTypeFilter = document.getElementById('pageTypeFilter');
        if (pageTypeFilter) {
            pageTypeFilter.addEventListener('change', () => this.filterPageSections());
        }

        // Show inactive pages checkbox
        const showInactivePages = document.getElementById('showInactivePages');
        if (showInactivePages) {
            showInactivePages.addEventListener('change', () => this.filterPageSections());
        }

        // Save page content
        const savePageContent = document.getElementById('savePageContent');
        if (savePageContent) {
            savePageContent.addEventListener('click', () => this.savePageSection());
        }

        // Cancel page edit
        const cancelPageEdit = document.getElementById('cancelPageEdit');
        if (cancelPageEdit) {
            cancelPageEdit.addEventListener('click', () => this.cancelEdit());
        }

        // Format JSON button
        const formatJson = document.getElementById('formatJson');
        if (formatJson) {
            formatJson.addEventListener('click', () => this.formatJsonContent());
        }

        // Create page button
        const createPageBtn = document.getElementById('createPageBtn');
        if (createPageBtn) {
            createPageBtn.addEventListener('click', () => this.createNewSection());
        }
    }

    async loadPageContent() {
        try {
            showLoading(true);
            await Promise.all([
                this.loadPageTypes(),
                this.loadPageSections()
            ]);
            this.updateStats();
        } catch (error) {
            console.error('Error loading page content:', error);
            showNotification('Error loading page content', 'error');
        } finally {
            showLoading(false);
        }
    }

    async loadPageTypes() {
        try {
            this.pageTypes = await window.adminDashboard.apiRequest('/api/admin/pages/types');
            this.renderPageTypes();
        } catch (error) {
            console.error('Error loading page types:', error);
            throw error;
        }
    }

    async loadPageSections() {
        try {
            this.pageSections = await window.adminDashboard.apiRequest('/api/admin/pages/sections');
            this.filterPageSections();
        } catch (error) {
            console.error('Error loading page sections:', error);
            throw error;
        }
    }

    renderPageTypes() {
        const container = document.getElementById('pageTypesList');
        if (!container) return;

        container.innerHTML = this.pageTypes.map(pageType => `
            <div class="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer" 
                 data-page-type="${pageType.slug}">
                <div class="flex items-center">
                    <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                        <i class="fas fa-file-alt text-blue-600 text-sm"></i>
                    </div>
                    <div>
                        <p class="font-medium text-gray-900">${pageType.name}</p>
                        <p class="text-xs text-gray-500">${pageType.slug}</p>
                    </div>
                </div>
                <span class="text-sm text-gray-500">${pageType.section_count || 0} sections</span>
            </div>
        `).join('');

        // Add click listeners to page types
        container.querySelectorAll('[data-page-type]').forEach(element => {
            element.addEventListener('click', () => {
                const pageType = element.dataset.pageType;
                document.getElementById('pageTypeFilter').value = pageType;
                this.filterPageSections();
            });
        });

        // Update count
        document.getElementById('pageTypesCount').textContent = `${this.pageTypes.length} types`;
    }

    filterPageSections() {
        const pageTypeFilter = document.getElementById('pageTypeFilter').value;
        const showInactive = document.getElementById('showInactivePages').checked;

        let filteredSections = this.pageSections;

        // Filter by page type
        if (pageTypeFilter) {
            filteredSections = filteredSections.filter(section => 
                section.page_type_slug === pageTypeFilter
            );
        }

        // Filter by visibility
        if (!showInactive) {
            filteredSections = filteredSections.filter(section => section.is_visible);
        }

        this.renderPageSections(filteredSections);
    }

    renderPageSections(sections) {
        const container = document.getElementById('pageSectionsList');
        if (!container) return;

        if (sections.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-file-alt text-3xl mb-2"></i>
                    <p>No page sections found</p>
                </div>
            `;
            return;
        }

        container.innerHTML = sections.map(section => `
            <div class="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer ${!section.is_visible ? 'opacity-60' : ''}" 
                 data-section-id="${section.id}">
                <div class="flex-1">
                    <div class="flex items-center justify-between">
                        <h4 class="font-medium text-gray-900">${section.title}</h4>
                        <div class="flex items-center space-x-2">
                            ${!section.is_visible ? '<i class="fas fa-eye-slash text-gray-400 text-xs"></i>' : ''}
                            <span class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">${section.page_type_name}</span>
                        </div>
                    </div>
                    <div class="flex items-center mt-1">
                        <span class="text-sm text-gray-500">${section.section_key}</span>
                        <span class="text-xs text-gray-400 ml-2">Order: ${section.sort_order}</span>
                    </div>
                    <p class="text-xs text-gray-400 mt-1">
                        ${this.getContentPreview(section.content)}
                    </p>
                </div>
                <div class="ml-4 flex space-x-1">
                    <button class="text-blue-600 hover:text-blue-800 p-1" onclick="pageManager.editSection(${section.id})" title="Edit">
                        <i class="fas fa-edit text-sm"></i>
                    </button>
                    <button class="text-red-600 hover:text-red-800 p-1" onclick="pageManager.deleteSection(${section.id})" title="Delete">
                        <i class="fas fa-trash text-sm"></i>
                    </button>
                </div>
            </div>
        `).join('');

        // Update count
        document.getElementById('pageSectionsDisplayCount').textContent = `${sections.length} sections`;
    }

    getContentPreview(content) {
        try {
            if (!content) return 'No content';
            const parsed = JSON.parse(content);
            const keys = Object.keys(parsed);
            if (keys.length === 0) return 'Empty content';
            if (keys.length === 1) return `1 field: ${keys[0]}`;
            return `${keys.length} fields: ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}`;
        } catch (e) {
            return 'Invalid JSON';
        }
    }

    async editSection(sectionId) {
        try {
            const section = this.pageSections.find(s => s.id === sectionId);
            if (!section) throw new Error('Section not found');

            this.currentSection = section;
            this.populateEditor(section);
            document.getElementById('pageContentEditor').classList.remove('hidden');
        } catch (error) {
            console.error('Error editing section:', error);
            showNotification('Error loading section for editing', 'error');
        }
    }

    populateEditor(section) {
        document.getElementById('sectionTitle').value = section.title || '';
        document.getElementById('sectionKey').value = section.section_key || '';
        document.getElementById('sectionSortOrder').value = section.sort_order || 0;
        document.getElementById('sectionVisible').checked = section.is_visible;
        document.getElementById('sectionContent').value = this.formatJson(section.content || '{}');
        
        document.getElementById('editorTitle').textContent = `Edit: ${section.title}`;
        document.getElementById('editorSubtitle').textContent = `${section.page_type_name} - ${section.section_key}`;
    }

    async savePageSection() {
        try {
            if (!this.currentSection) throw new Error('No section selected');

            const title = document.getElementById('sectionTitle').value.trim();
            const sortOrder = parseInt(document.getElementById('sectionSortOrder').value) || 0;
            const isVisible = document.getElementById('sectionVisible').checked;
            const content = document.getElementById('sectionContent').value.trim();

            // Validate JSON
            try {
                JSON.parse(content);
            } catch (e) {
                throw new Error('Invalid JSON content');
            }

            if (!title) throw new Error('Section title is required');

            await window.adminDashboard.apiRequest(`/api/admin/pages/sections/${this.currentSection.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    title,
                    sort_order: sortOrder,
                    is_visible: isVisible,
                    content
                })
            });

            showNotification('Page section updated successfully', 'success');
            this.cancelEdit();
            this.loadPageSections();
        } catch (error) {
            console.error('Error saving page section:', error);
            showNotification(error.message, 'error');
        }
    }

    async deleteSection(sectionId) {
        if (!confirm('Are you sure you want to delete this page section? This action cannot be undone.')) {
            return;
        }

        try {
            await window.adminDashboard.apiRequest(`/api/admin/pages/sections/${sectionId}`, {
                method: 'DELETE'
            });

            showNotification('Page section deleted successfully', 'success');
            this.loadPageSections();
        } catch (error) {
            console.error('Error deleting page section:', error);
            showNotification('Error deleting page section', 'error');
        }
    }

    cancelEdit() {
        this.currentSection = null;
        document.getElementById('pageContentEditor').classList.add('hidden');
        
        // Clear form
        document.getElementById('sectionTitle').value = '';
        document.getElementById('sectionKey').value = '';
        document.getElementById('sectionSortOrder').value = '';
        document.getElementById('sectionVisible').checked = false;
        document.getElementById('sectionContent').value = '';
    }

    formatJsonContent() {
        const textarea = document.getElementById('sectionContent');
        try {
            const content = textarea.value.trim();
            if (!content) return;
            
            const parsed = JSON.parse(content);
            textarea.value = JSON.stringify(parsed, null, 2);
            showNotification('JSON formatted successfully', 'success');
        } catch (error) {
            showNotification('Invalid JSON format', 'error');
        }
    }

    formatJson(jsonString) {
        try {
            const parsed = JSON.parse(jsonString);
            return JSON.stringify(parsed, null, 2);
        } catch (e) {
            return jsonString;
        }
    }

    async createNewSection() {
        // TODO: Implement create new section functionality
        showNotification('Create new section functionality coming soon', 'info');
    }

    updateStats() {
        // Update dashboard stats
        const pageSectionsCount = document.getElementById('pageSectionsCount');
        if (pageSectionsCount) {
            pageSectionsCount.textContent = this.pageSections.length;
        }
    }
}

// Initialize page content manager
const pageManager = new PageContentManager();