class TemplatePreviewSelector {
    constructor() {
        this.currentTemplate = 'modern';
        this.templates = {};
        this.filteredTemplates = {};
        this.currentView = 'grid';
        this.selectedTemplate = null;
        
        this.initializeEventListeners();
        this.loadTemplates();
    }

    initializeEventListeners() {
        // Filter and search
        document.getElementById('categoryFilter').addEventListener('change', (e) => {
            this.filterTemplates();
        });
        
        document.getElementById('statusFilter').addEventListener('change', (e) => {
            this.filterTemplates();
        });
        
        document.getElementById('templateSearch').addEventListener('input', (e) => {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                this.filterTemplates();
            }, 300);
        });

        // View toggle
        document.getElementById('gridView').addEventListener('click', () => {
            this.switchView('grid');
        });
        
        document.getElementById('listView').addEventListener('click', () => {
            this.switchView('list');
        });

        // Refresh
        document.getElementById('refreshTemplates').addEventListener('click', () => {
            this.loadTemplates();
        });

        // Modal events
        document.getElementById('closePreviewModal').addEventListener('click', () => {
            this.closePreviewModal();
        });
        
        document.getElementById('cancelPreview').addEventListener('click', () => {
            this.closePreviewModal();
        });
        
        document.getElementById('selectFromPreview').addEventListener('click', () => {
            this.selectTemplateFromPreview();
        });

        // Preview page selector
        document.getElementById('previewPageSelector').addEventListener('change', (e) => {
            this.loadPreviewPage(e.target.value);
        });

        // Confirmation modal
        document.getElementById('cancelSwitch').addEventListener('click', () => {
            this.closeConfirmationModal();
        });
        
        document.getElementById('confirmSwitch').addEventListener('click', () => {
            this.executeTemplateSwitch();
        });

        // Close modals on backdrop click
        document.getElementById('templatePreviewModal').addEventListener('click', (e) => {
            if (e.target.id === 'templatePreviewModal') {
                this.closePreviewModal();
            }
        });
        
        document.getElementById('confirmationModal').addEventListener('click', (e) => {
            if (e.target.id === 'confirmationModal') {
                this.closeConfirmationModal();
            }
        });
    }

    async loadTemplates() {
        this.showLoadingState();
        
        try {
            const response = await fetch('/api/template-management/templates');
            const result = await response.json();
            
            if (result.success) {
                this.templates = result.data;
                this.filteredTemplates = { ...result.data };
                this.renderTemplates();
                this.updateCurrentTemplate();
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Failed to load templates:', error);
            this.showErrorState('Failed to load templates. Please try again.');
        }
    }

    filterTemplates() {
        const categoryFilter = document.getElementById('categoryFilter').value;
        const statusFilter = document.getElementById('statusFilter').value;
        const searchQuery = document.getElementById('templateSearch').value.toLowerCase();
        
        this.filteredTemplates = {};
        
        Object.entries(this.templates).forEach(([id, template]) => {
            let matches = true;
            
            // Category filter
            if (categoryFilter && template.category !== categoryFilter) {
                matches = false;
            }
            
            // Status filter
            if (statusFilter && template.status !== statusFilter) {
                matches = false;
            }
            
            // Search filter
            if (searchQuery) {
                const searchableText = `${template.name} ${template.description} ${template.features.join(' ')}`.toLowerCase();
                if (!searchableText.includes(searchQuery)) {
                    matches = false;
                }
            }
            
            if (matches) {
                this.filteredTemplates[id] = template;
            }
        });
        
        this.renderTemplates();
    }

    renderTemplates() {
        const container = document.getElementById('templatesContainer');
        const template = document.getElementById('templateCardTemplate');
        
        // Clear container
        container.innerHTML = '';
        
        const templateCount = Object.keys(this.filteredTemplates).length;
        
        if (templateCount === 0) {
            this.showEmptyState();
            return;
        }
        
        this.hideStates();
        
        // Render each template
        Object.entries(this.filteredTemplates).forEach(([id, templateData]) => {
            const card = this.createTemplateCard(id, templateData, template);
            container.appendChild(card);
        });
        
        // Update results count
        this.updateResultsCount(templateCount);
    }

    createTemplateCard(templateId, templateData, templateElement) {
        const card = templateElement.content.cloneNode(true);
        
        // Set basic info
        card.querySelector('.template-name').textContent = templateData.name;
        card.querySelector('.template-description').textContent = templateData.description;
        
        // Set preview background
        const previewContainer = card.querySelector('.template-preview-container');
        previewContainer.style.background = templateData.colorScheme.background || 
            `linear-gradient(135deg, ${templateData.colorScheme.primary}, ${templateData.colorScheme.secondary})`;
        
        // Set status badge
        const statusBadge = card.querySelector('.template-status-badge');
        statusBadge.textContent = templateData.status.charAt(0).toUpperCase() + templateData.status.slice(1);
        statusBadge.className += ` ${templateData.status}`;
        
        // Set features
        const featuresContainer = card.querySelector('.template-features');
        templateData.features.forEach(feature => {
            const badge = document.createElement('span');
            badge.className = 'feature-badge';
            badge.textContent = feature;
            featuresContainer.appendChild(badge);
        });
        
        // Set color palette
        card.querySelector('.color-primary').style.backgroundColor = templateData.colorScheme.primary;
        card.querySelector('.color-secondary').style.backgroundColor = templateData.colorScheme.secondary;
        card.querySelector('.color-accent').style.backgroundColor = templateData.colorScheme.accent;
        
        // Set category
        const categoryIcons = {
            standard: '📄',
            contemporary: '✨',
            premium: '👑',
            modern: '🚀',
            elegant: '💎',
            traditional: '🏛️'
        };
        
        card.querySelector('.category-icon').textContent = categoryIcons[templateData.category] || '📄';
        card.querySelector('.category-name').textContent = templateData.category.charAt(0).toUpperCase() + templateData.category.slice(1);
        
        // Show current template indicator
        if (templateId === this.currentTemplate) {
            card.querySelector('.current-template-indicator').classList.remove('hidden');
        }
        
        // Add event listeners
        const cardElement = card.querySelector('.template-card');
        
        card.querySelector('.preview-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.openPreviewModal(templateId, templateData);
        });
        
        card.querySelector('.select-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectTemplate(templateId, templateData);
        });
        
        cardElement.addEventListener('click', () => {
            this.openPreviewModal(templateId, templateData);
        });
        
        return card;
    }

    switchView(view) {
        this.currentView = view;
        
        // Update button states
        document.getElementById('gridView').classList.toggle('active', view === 'grid');
        document.getElementById('listView').classList.toggle('active', view === 'list');
        
        // Update container class
        const container = document.getElementById('templatesContainer');
        container.classList.toggle('list-view', view === 'list');
    }

    openPreviewModal(templateId, templateData) {
        this.selectedTemplate = { id: templateId, data: templateData };
        
        // Set modal title and subtitle
        document.getElementById('previewModalTitle').textContent = templateData.name;
        document.getElementById('previewModalSubtitle').textContent = templateData.description;
        
        // Set color palette in footer
        const modalFooter = document.querySelector('#templatePreviewModal .color-palette-compact');
        const colors = modalFooter.querySelectorAll('div');
        colors[0].style.backgroundColor = templateData.colorScheme.primary;
        colors[1].style.backgroundColor = templateData.colorScheme.secondary;
        colors[2].style.backgroundColor = templateData.colorScheme.accent;
        
        // Show modal
        document.getElementById('templatePreviewModal').classList.remove('hidden');
        
        // Load initial preview
        this.loadPreviewPage('home');
    }

    closePreviewModal() {
        document.getElementById('templatePreviewModal').classList.add('hidden');
        this.selectedTemplate = null;
        
        // Clear iframe
        document.getElementById('previewFrame').src = '';
    }

    loadPreviewPage(page) {
        if (!this.selectedTemplate) return;
        
        const iframe = document.getElementById('previewFrame');
        const templateId = this.selectedTemplate.id;
        
        // In a real implementation, this would load the actual template page
        // For now, we'll show a placeholder
        const previewUrl = `/preview/${templateId}/${page}`;
        iframe.src = previewUrl;
        
        console.log(`Loading preview: ${templateId} - ${page}`);
    }

    selectTemplate(templateId, templateData) {
        if (templateId === this.currentTemplate) {
            // Already using this template
            this.showNotification('This template is already active', 'info');
            return;
        }
        
        this.selectedTemplate = { id: templateId, data: templateData };
        this.openConfirmationModal();
    }

    selectTemplateFromPreview() {
        if (!this.selectedTemplate) return;
        
        this.closePreviewModal();
        this.openConfirmationModal();
    }

    openConfirmationModal() {
        if (!this.selectedTemplate) return;
        
        const currentTemplateData = this.templates[this.currentTemplate];
        
        // Set template names
        document.getElementById('currentTemplateNameModal').textContent = currentTemplateData.name;
        document.getElementById('newTemplateNameModal').textContent = this.selectedTemplate.data.name;
        
        // Set preview colors
        const currentPreview = document.querySelector('#confirmationModal .current-template .template-preview-mini');
        const newPreview = document.querySelector('#confirmationModal .new-template .template-preview-mini');
        
        currentPreview.style.background = currentTemplateData.colorScheme.background || 
            `linear-gradient(135deg, ${currentTemplateData.colorScheme.primary}, ${currentTemplateData.colorScheme.secondary})`;
        
        newPreview.style.background = this.selectedTemplate.data.colorScheme.background || 
            `linear-gradient(135deg, ${this.selectedTemplate.data.colorScheme.primary}, ${this.selectedTemplate.data.colorScheme.secondary})`;
        
        // Show modal
        document.getElementById('confirmationModal').classList.remove('hidden');
    }

    closeConfirmationModal() {
        document.getElementById('confirmationModal').classList.add('hidden');
    }

    async executeTemplateSwitch() {
        if (!this.selectedTemplate) return;
        
        const switchBtn = document.getElementById('confirmSwitch');
        const originalText = switchBtn.textContent;
        
        switchBtn.textContent = 'Switching...';
        switchBtn.disabled = true;
        
        try {
            const response = await fetch('/api/template-management/templates/switch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    currentTemplate: this.currentTemplate,
                    newTemplate: this.selectedTemplate.id,
                    modelId: window.currentModelId // Assuming this is available globally
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.currentTemplate = this.selectedTemplate.id;
                this.updateCurrentTemplate();
                this.renderTemplates();
                this.closeConfirmationModal();
                
                this.showNotification(`Successfully switched to ${this.selectedTemplate.data.name}`, 'success');
                
                // Optionally reload the page to apply the new template
                setTimeout(() => {
                    if (confirm('Would you like to reload the page to see the new template in action?')) {
                        window.location.reload();
                    }
                }, 1000);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Template switch failed:', error);
            this.showNotification(`Failed to switch template: ${error.message}`, 'error');
        } finally {
            switchBtn.textContent = originalText;
            switchBtn.disabled = false;
        }
    }

    updateCurrentTemplate() {
        document.getElementById('currentTemplateName').textContent = 
            this.templates[this.currentTemplate]?.name || this.currentTemplate;
    }

    updateResultsCount(count) {
        // This could be added to show results count in the UI
        console.log(`Showing ${count} templates`);
    }

    showLoadingState() {
        document.getElementById('loadingState').classList.remove('hidden');
        document.getElementById('emptyState').classList.add('hidden');
        document.getElementById('templatesContainer').innerHTML = '';
    }

    showEmptyState() {
        document.getElementById('emptyState').classList.remove('hidden');
        document.getElementById('loadingState').classList.add('hidden');
    }

    hideStates() {
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('emptyState').classList.add('hidden');
    }

    showErrorState(message) {
        const container = document.getElementById('templatesContainer');
        container.innerHTML = `
            <div class="col-span-full text-center py-12">
                <div class="text-red-500 mb-4">
                    <svg class="mx-auto h-12 w-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                    </svg>
                    <p class="text-lg font-medium text-gray-900">${message}</p>
                </div>
                <button onclick="window.templateSelector.loadTemplates()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                    Try Again
                </button>
            </div>
        `;
        this.hideStates();
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm transition-all transform ${
            type === 'success' ? 'bg-green-500 text-white' :
            type === 'error' ? 'bg-red-500 text-white' :
            'bg-blue-500 text-white'
        }`;
        
        notification.innerHTML = `
            <div class="flex items-center justify-between">
                <p class="mr-2">${message}</p>
                <button onclick="this.parentElement.parentElement.remove()" class="text-white hover:text-gray-200">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
}

// Initialize the template selector when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.templateSelector = new TemplatePreviewSelector();
});