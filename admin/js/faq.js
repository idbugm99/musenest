/**
 * MuseNest Admin Dashboard - FAQ Management
 */
if (window.ComponentRegistryClient) {
    window.ComponentRegistryClient.register('admin-faq', 'admin/js/faq.js');
}

class FAQManager {
    constructor() {
        this.faqs = [];
        this.statusFilter = '';
        this.bulkEditMode = false;
        this.selectedFAQs = new Set();
        
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Create FAQ button
        const createBtn = document.getElementById('createFAQBtn');
        if (createBtn) {
            createBtn.addEventListener('click', () => this.showCreateFAQModal());
        }

        // Bulk edit toggle
        const bulkEditBtn = document.getElementById('faqBulkEdit');
        if (bulkEditBtn) {
            bulkEditBtn.addEventListener('click', () => this.toggleBulkEdit());
        }

        // Status filter
        const statusFilter = document.getElementById('faqStatusFilter');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.statusFilter = e.target.value;
                this.renderFAQs();
            });
        }
    }

    async loadFAQs() {
        try {
            window.adminDashboard.showLoading(true);
            
            const response = await window.adminDashboard.apiRequest('/api/faq');
            if (response.success) {
                this.faqs = response.faqs;
                this.renderFAQs();
            } else {
                window.adminDashboard.showNotification('Failed to load FAQs', 'error');
            }
        } catch (error) {
            console.error('Error loading FAQs:', error);
            window.adminDashboard.showNotification('Failed to load FAQs', 'error');
        } finally {
            window.adminDashboard.showLoading(false);
        }
    }

    renderFAQs() {
        const container = document.getElementById('faqList');
        if (!container) return;

        let filteredFAQs = this.faqs;
        
        if (this.statusFilter) {
            if (this.statusFilter === 'active') {
                filteredFAQs = this.faqs.filter(faq => faq.is_active);
            } else if (this.statusFilter === 'inactive') {
                filteredFAQs = this.faqs.filter(faq => !faq.is_active);
            }
        }

        if (filteredFAQs.length === 0) {
            container.innerHTML = `
                <div class="p-8 text-center text-gray-500">
                    <i class="fas fa-question-circle text-4xl mb-4"></i>
                    <p class="text-lg font-semibold mb-2">No FAQ items found</p>
                    <p>Create your first FAQ to help visitors find answers to common questions.</p>
                    <button onclick="faqManager.showCreateFAQModal()" class="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                        Add FAQ
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = filteredFAQs.map((faq, index) => `
            <div class="faq-item p-6 hover:bg-gray-50 transition-colors" data-faq-id="${faq.id}">
                <div class="flex items-start space-x-4">
                    ${this.bulkEditMode ? `
                        <div class="mt-1">
                            <input type="checkbox" class="faq-checkbox" data-faq-id="${faq.id}" 
                                   ${this.selectedFAQs.has(faq.id) ? 'checked' : ''}>
                        </div>
                    ` : ''}
                    
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between mb-2">
                            <div class="flex items-center space-x-3">
                                <span class="text-sm text-gray-500">#${index + 1}</span>
                                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    faq.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                }">
                                    ${faq.is_active ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                            <div class="flex items-center space-x-2">
                                <button onclick="faqManager.editFAQ(${faq.id})" class="text-gray-500 hover:text-blue-600" title="Edit">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button onclick="faqManager.toggleFAQStatus(${faq.id})" class="text-gray-500 hover:text-yellow-600" title="${faq.is_active ? 'Deactivate' : 'Activate'}">
                                    <i class="fas fa-${faq.is_active ? 'eye-slash' : 'eye'}"></i>
                                </button>
                                <button onclick="faqManager.deleteFAQ(${faq.id})" class="text-gray-500 hover:text-red-600" title="Delete">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <h4 class="text-lg font-semibold text-gray-900 mb-2">${this.escapeHtml(faq.question)}</h4>
                            <div class="text-gray-700 prose prose-sm max-w-none">
                                ${this.formatAnswer(faq.answer)}
                            </div>
                        </div>
                        
                        <div class="flex items-center text-sm text-gray-500 space-x-4">
                            <span>
                                <i class="fas fa-calendar-alt mr-1"></i>
                                Created ${window.adminDashboard.formatDate(faq.created_at)}
                            </span>
                            ${faq.updated_at && faq.updated_at !== faq.created_at ? `
                                <span>
                                    <i class="fas fa-edit mr-1"></i>
                                    Updated ${window.adminDashboard.formatDate(faq.updated_at)}
                                </span>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        // Setup bulk edit checkboxes
        if (this.bulkEditMode) {
            container.querySelectorAll('.faq-checkbox').forEach(checkbox => {
                checkbox.addEventListener('change', (e) => {
                    const faqId = parseInt(e.target.dataset.faqId);
                    if (e.target.checked) {
                        this.selectedFAQs.add(faqId);
                    } else {
                        this.selectedFAQs.delete(faqId);
                    }
                    this.updateBulkActions();
                });
            });
        }
    }

    formatAnswer(answer) {
        // Simple formatting: convert line breaks to paragraphs
        return answer.split('\n\n').map(paragraph => 
            paragraph.trim() ? `<p>${this.escapeHtml(paragraph.trim())}</p>` : ''
        ).join('');
    }

    toggleBulkEdit() {
        this.bulkEditMode = !this.bulkEditMode;
        this.selectedFAQs.clear();
        
        const bulkEditBtn = document.getElementById('faqBulkEdit');
        if (this.bulkEditMode) {
            bulkEditBtn.innerHTML = '<i class="fas fa-times mr-1"></i>Cancel Bulk Edit';
            bulkEditBtn.classList.add('text-red-600');
            this.showBulkActions();
        } else {
            bulkEditBtn.innerHTML = '<i class="fas fa-edit mr-1"></i>Bulk Edit';
            bulkEditBtn.classList.remove('text-red-600');
            this.hideBulkActions();
        }
        
        this.renderFAQs();
    }

    showBulkActions() {
        const container = document.querySelector('#faq-tab .bg-white');
        const existingActions = container.querySelector('#bulkActions');
        if (existingActions) existingActions.remove();

        const bulkActions = document.createElement('div');
        bulkActions.id = 'bulkActions';
        bulkActions.className = 'p-4 bg-blue-50 border-b border-gray-200';
        bulkActions.innerHTML = `
            <div class="flex items-center justify-between">
                <span class="text-sm text-gray-700">
                    <span id="selectedCount">0</span> FAQ(s) selected
                </span>
                <div class="flex space-x-2">
                    <button onclick="faqManager.bulkAction('activate')" class="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700">
                        <i class="fas fa-eye mr-1"></i>Activate
                    </button>
                    <button onclick="faqManager.bulkAction('deactivate')" class="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700">
                        <i class="fas fa-eye-slash mr-1"></i>Deactivate
                    </button>
                    <button onclick="faqManager.bulkAction('delete')" class="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700">
                        <i class="fas fa-trash mr-1"></i>Delete
                    </button>
                </div>
            </div>
        `;
        
        container.insertBefore(bulkActions, container.querySelector('#faqList'));
    }

    hideBulkActions() {
        const bulkActions = document.getElementById('bulkActions');
        if (bulkActions) bulkActions.remove();
    }

    updateBulkActions() {
        const selectedCount = document.getElementById('selectedCount');
        if (selectedCount) {
            selectedCount.textContent = this.selectedFAQs.size;
        }
    }

    async bulkAction(action) {
        if (this.selectedFAQs.size === 0) {
            window.adminDashboard.showNotification('No FAQs selected', 'warning');
            return;
        }

        const faqIds = Array.from(this.selectedFAQs);
        let confirmMessage = '';
        
        switch (action) {
            case 'activate':
                confirmMessage = `Activate ${faqIds.length} FAQ(s)?`;
                break;
            case 'deactivate':
                confirmMessage = `Deactivate ${faqIds.length} FAQ(s)?`;
                break;
            case 'delete':
                confirmMessage = `Delete ${faqIds.length} FAQ(s)? This action cannot be undone.`;
                break;
        }

        if (!confirm(confirmMessage)) return;

        try {
            window.adminDashboard.showLoading(true);
            
            const response = await window.adminDashboard.apiRequest('/api/faq/bulk', {
                method: 'POST',
                body: JSON.stringify({
                    action: action,
                    faqIds: faqIds
                })
            });

            if (response.success) {
                window.adminDashboard.showNotification(response.message, 'success');
                this.selectedFAQs.clear();
                await this.loadFAQs();
            } else {
                window.adminDashboard.showNotification('Bulk action failed', 'error');
            }
        } catch (error) {
            console.error('Bulk action error:', error);
            window.adminDashboard.showNotification('Bulk action failed', 'error');
        } finally {
            window.adminDashboard.showLoading(false);
        }
    }

    showCreateFAQModal() {
        const modal = this.createModal('Add FAQ', `
            <form id="createFAQForm">
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Question</label>
                    <input type="text" id="faqQuestion" required 
                           class="w-full border border-gray-300 rounded-md px-3 py-2"
                           placeholder="Enter the question...">
                </div>
                
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Answer</label>
                    <textarea id="faqAnswer" required rows="6"
                              class="w-full border border-gray-300 rounded-md px-3 py-2"
                              placeholder="Enter the answer..."></textarea>
                    <p class="text-sm text-gray-500 mt-1">Use double line breaks to separate paragraphs</p>
                </div>
                
                <div class="mb-6">
                    <label class="flex items-center">
                        <input type="checkbox" id="faqActive" checked class="mr-2">
                        <span class="text-sm font-medium text-gray-700">Active (visible to visitors)</span>
                    </label>
                </div>
                
                <div class="flex justify-end space-x-3">
                    <button type="button" onclick="this.closest('.modal-overlay').remove()" class="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
                    <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Create FAQ</button>
                </div>
            </form>
        `);

        const form = modal.querySelector('#createFAQForm');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            try {
                window.adminDashboard.showLoading(true);
                
                const response = await window.adminDashboard.apiRequest('/api/faq', {
                    method: 'POST',
                    body: JSON.stringify({
                        question: form.querySelector('#faqQuestion').value.trim(),
                        answer: form.querySelector('#faqAnswer').value.trim(),
                        is_active: form.querySelector('#faqActive').checked
                    })
                });

                if (response.success) {
                    window.adminDashboard.showNotification('FAQ created successfully', 'success');
                    await this.loadFAQs();
                    modal.remove();
                } else {
                    window.adminDashboard.showNotification(response.message || 'Failed to create FAQ', 'error');
                }
            } catch (error) {
                console.error('Error creating FAQ:', error);
                window.adminDashboard.showNotification('Failed to create FAQ', 'error');
            } finally {
                window.adminDashboard.showLoading(false);
            }
        });
    }

    async editFAQ(faqId) {
        const faq = this.faqs.find(f => f.id === faqId);
        if (!faq) return;

        const modal = this.createModal('Edit FAQ', `
            <form id="editFAQForm">
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Question</label>
                    <input type="text" id="faqQuestion" required 
                           value="${this.escapeHtml(faq.question)}"
                           class="w-full border border-gray-300 rounded-md px-3 py-2">
                </div>
                
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Answer</label>
                    <textarea id="faqAnswer" required rows="6"
                              class="w-full border border-gray-300 rounded-md px-3 py-2">${this.escapeHtml(faq.answer)}</textarea>
                    <p class="text-sm text-gray-500 mt-1">Use double line breaks to separate paragraphs</p>
                </div>
                
                <div class="mb-6">
                    <label class="flex items-center">
                        <input type="checkbox" id="faqActive" ${faq.is_active ? 'checked' : ''} class="mr-2">
                        <span class="text-sm font-medium text-gray-700">Active (visible to visitors)</span>
                    </label>
                </div>
                
                <div class="flex justify-end space-x-3">
                    <button type="button" onclick="this.closest('.modal-overlay').remove()" class="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
                    <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save Changes</button>
                </div>
            </form>
        `);

        const form = modal.querySelector('#editFAQForm');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            try {
                window.adminDashboard.showLoading(true);
                
                const response = await window.adminDashboard.apiRequest(`/api/faq/${faqId}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        question: form.querySelector('#faqQuestion').value.trim(),
                        answer: form.querySelector('#faqAnswer').value.trim(),
                        is_active: form.querySelector('#faqActive').checked
                    })
                });

                if (response.success) {
                    window.adminDashboard.showNotification('FAQ updated successfully', 'success');
                    await this.loadFAQs();
                    modal.remove();
                } else {
                    window.adminDashboard.showNotification(response.message || 'Failed to update FAQ', 'error');
                }
            } catch (error) {
                console.error('Error updating FAQ:', error);
                window.adminDashboard.showNotification('Failed to update FAQ', 'error');
            } finally {
                window.adminDashboard.showLoading(false);
            }
        });
    }

    async toggleFAQStatus(faqId) {
        try {
            const response = await window.adminDashboard.apiRequest(`/api/faq/${faqId}/toggle`, {
                method: 'PATCH'
            });

            if (response.success) {
                window.adminDashboard.showNotification(response.message, 'success');
                await this.loadFAQs();
            } else {
                window.adminDashboard.showNotification('Failed to toggle FAQ status', 'error');
            }
        } catch (error) {
            console.error('Error toggling FAQ status:', error);
            window.adminDashboard.showNotification('Failed to toggle FAQ status', 'error');
        }
    }

    async deleteFAQ(faqId) {
        if (!confirm('Are you sure you want to delete this FAQ? This action cannot be undone.')) {
            return;
        }

        try {
            window.adminDashboard.showLoading(true);
            
            const response = await window.adminDashboard.apiRequest(`/api/faq/${faqId}`, {
                method: 'DELETE'
            });

            if (response.success) {
                window.adminDashboard.showNotification('FAQ deleted successfully', 'success');
                await this.loadFAQs();
            } else {
                window.adminDashboard.showNotification('Failed to delete FAQ', 'error');
            }
        } catch (error) {
            console.error('Error deleting FAQ:', error);
            window.adminDashboard.showNotification('Failed to delete FAQ', 'error');
        } finally {
            window.adminDashboard.showLoading(false);
        }
    }

    createModal(title, content) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="modal bg-white rounded-lg max-w-2xl w-full mx-4 max-h-screen overflow-y-auto">
                <div class="p-6">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg font-semibold text-gray-900">${title}</h3>
                        <button onclick="this.closest('.modal-overlay').remove()" class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div>${content}</div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        return modal;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize FAQ manager
document.addEventListener('DOMContentLoaded', () => {
    window.faqManager = new FAQManager();
});