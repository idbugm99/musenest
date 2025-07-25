/**
 * MuseNest Admin Dashboard - Testimonials Management
 */

class TestimonialsManager {
    constructor() {
        this.testimonials = [];
        this.statusFilter = '';
        
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Create testimonial button
        const createBtn = document.getElementById('createTestimonialBtn');
        if (createBtn) {
            createBtn.addEventListener('click', () => this.showCreateTestimonialModal());
        }

        // Status filter
        const statusFilter = document.getElementById('testimonialStatusFilter');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.statusFilter = e.target.value;
                this.renderTestimonials();
            });
        }
    }

    async loadTestimonials() {
        try {
            window.adminDashboard.showLoading(true);
            
            const response = await window.adminDashboard.apiRequest('/api/testimonials');
            if (response.success) {
                this.testimonials = response.testimonials;
                this.renderTestimonials();
            } else {
                window.adminDashboard.showNotification('Failed to load testimonials', 'error');
            }
        } catch (error) {
            console.error('Error loading testimonials:', error);
            window.adminDashboard.showNotification('Failed to load testimonials', 'error');
        } finally {
            window.adminDashboard.showLoading(false);
        }
    }

    renderTestimonials() {
        const container = document.getElementById('testimonialsList');
        if (!container) return;

        let filteredTestimonials = this.testimonials;
        
        if (this.statusFilter) {
            switch (this.statusFilter) {
                case 'published':
                    filteredTestimonials = this.testimonials.filter(t => t.is_published);
                    break;
                case 'unpublished':
                    filteredTestimonials = this.testimonials.filter(t => !t.is_published);
                    break;
                case 'approved':
                    filteredTestimonials = this.testimonials.filter(t => t.is_approved);
                    break;
                case 'unapproved':
                    filteredTestimonials = this.testimonials.filter(t => !t.is_approved);
                    break;
            }
        }

        if (filteredTestimonials.length === 0) {
            container.innerHTML = `
                <div class="p-8 text-center text-gray-500">
                    <i class="fas fa-star text-4xl mb-4"></i>
                    <p class="text-lg font-semibold mb-2">No testimonials found</p>
                    <p>Add client testimonials to build trust and showcase your excellent service.</p>
                    <button onclick="testimonialsManager.showCreateTestimonialModal()" class="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                        Add Testimonial
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = filteredTestimonials.map(testimonial => `
            <div class="testimonial-item p-6 hover:bg-gray-50 transition-colors">
                <div class="flex items-start justify-between mb-4">
                    <div class="flex items-center space-x-3">
                        <div class="flex-shrink-0">
                            <div class="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                                <i class="fas fa-quote-left text-yellow-600"></i>
                            </div>
                        </div>
                        <div>
                            <h4 class="font-semibold text-gray-900">${this.escapeHtml(testimonial.client_name || testimonial.client_initial || 'Anonymous')}</h4>
                            ${testimonial.location ? `<p class="text-sm text-gray-500">${this.escapeHtml(testimonial.location)}</p>` : ''}
                            ${testimonial.rating ? `
                                <div class="flex items-center mt-1">
                                    ${Array.from({length: 5}, (_, i) => 
                                        `<i class="fas fa-star text-sm ${i < testimonial.rating ? 'text-yellow-400' : 'text-gray-300'}"></i>`
                                    ).join('')}
                                    <span class="ml-2 text-sm text-gray-600">${testimonial.rating}/5</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div class="flex items-center space-x-2">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            testimonial.is_published ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }">
                            ${testimonial.is_published ? 'Published' : 'Unpublished'}
                        </span>
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            testimonial.is_approved ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
                        }">
                            ${testimonial.is_approved ? 'Approved' : 'Pending'}
                        </span>
                    </div>
                </div>

                <blockquote class="text-gray-700 italic mb-4">
                    "${this.escapeHtml(testimonial.testimonial_text)}"
                </blockquote>

                <div class="flex items-center justify-between">
                    <div class="text-sm text-gray-500">
                        <i class="fas fa-calendar-alt mr-1"></i>
                        ${window.adminDashboard.formatDate(testimonial.created_at)}
                    </div>
                    
                    <div class="flex items-center space-x-2">
                        <button onclick="testimonialsManager.editTestimonial(${testimonial.id})" class="text-gray-500 hover:text-blue-600" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="testimonialsManager.togglePublished(${testimonial.id})" class="text-gray-500 hover:text-green-600" title="${testimonial.is_published ? 'Unpublish' : 'Publish'}">
                            <i class="fas fa-${testimonial.is_published ? 'eye-slash' : 'eye'}"></i>
                        </button>
                        <button onclick="testimonialsManager.toggleApproved(${testimonial.id})" class="text-gray-500 hover:text-blue-600" title="${testimonial.is_approved ? 'Unapprove' : 'Approve'}">
                            <i class="fas fa-${testimonial.is_approved ? 'times' : 'check'}"></i>
                        </button>
                        <button onclick="testimonialsManager.deleteTestimonial(${testimonial.id})" class="text-gray-500 hover:text-red-600" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    showCreateTestimonialModal() {
        const modal = this.createModal('Add Testimonial', `
            <form id="createTestimonialForm">
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Testimonial Text</label>
                    <textarea id="testimonialText" required rows="4"
                              class="w-full border border-gray-300 rounded-md px-3 py-2"
                              placeholder="Enter the client's testimonial..."></textarea>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Client Name</label>
                        <input type="text" id="clientName" 
                               class="w-full border border-gray-300 rounded-md px-3 py-2"
                               placeholder="Full name (optional)">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Client Initial</label>
                        <input type="text" id="clientInitial" 
                               class="w-full border border-gray-300 rounded-md px-3 py-2"
                               placeholder="J.D. (for privacy)">
                    </div>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Rating (1-5 stars)</label>
                        <select id="rating" class="w-full border border-gray-300 rounded-md px-3 py-2">
                            <option value="">No rating</option>
                            <option value="5">5 Stars - Excellent</option>
                            <option value="4">4 Stars - Very Good</option>
                            <option value="3">3 Stars - Good</option>
                            <option value="2">2 Stars - Fair</option>
                            <option value="1">1 Star - Poor</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Location</label>
                        <input type="text" id="location" 
                               class="w-full border border-gray-300 rounded-md px-3 py-2"
                               placeholder="City, State (optional)">
                    </div>
                </div>
                
                <div class="flex items-center space-x-4 mb-6">
                    <label class="flex items-center">
                        <input type="checkbox" id="isPublished" class="mr-2">
                        <span class="text-sm font-medium text-gray-700">Published (visible to visitors)</span>
                    </label>
                    <label class="flex items-center">
                        <input type="checkbox" id="isApproved" checked class="mr-2">
                        <span class="text-sm font-medium text-gray-700">Approved</span>
                    </label>
                </div>
                
                <div class="flex justify-end space-x-3">
                    <button type="button" onclick="this.closest('.modal-overlay').remove()" class="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
                    <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add Testimonial</button>
                </div>
            </form>
        `);

        const form = modal.querySelector('#createTestimonialForm');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            try {
                window.adminDashboard.showLoading(true);
                
                const response = await window.adminDashboard.apiRequest('/api/testimonials', {
                    method: 'POST',
                    body: JSON.stringify({
                        testimonial_text: form.querySelector('#testimonialText').value.trim(),
                        client_name: form.querySelector('#clientName').value.trim() || null,
                        client_initial: form.querySelector('#clientInitial').value.trim() || null,
                        rating: parseInt(form.querySelector('#rating').value) || null,
                        location: form.querySelector('#location').value.trim() || null,
                        is_published: form.querySelector('#isPublished').checked,
                        is_approved: form.querySelector('#isApproved').checked
                    })
                });

                if (response.success) {
                    window.adminDashboard.showNotification('Testimonial added successfully', 'success');
                    await this.loadTestimonials();
                    modal.remove();
                } else {
                    window.adminDashboard.showNotification(response.message || 'Failed to add testimonial', 'error');
                }
            } catch (error) {
                console.error('Error creating testimonial:', error);
                window.adminDashboard.showNotification('Failed to add testimonial', 'error');
            } finally {
                window.adminDashboard.showLoading(false);
            }
        });
    }

    async togglePublished(testimonialId) {
        try {
            const response = await window.adminDashboard.apiRequest(`/api/testimonials/${testimonialId}/publish`, {
                method: 'PATCH'
            });

            if (response.success) {
                window.adminDashboard.showNotification(response.message, 'success');
                await this.loadTestimonials();
            } else {
                window.adminDashboard.showNotification('Failed to update testimonial', 'error');
            }
        } catch (error) {
            console.error('Error toggling published status:', error);
            window.adminDashboard.showNotification('Failed to update testimonial', 'error');
        }
    }

    async toggleApproved(testimonialId) {
        try {
            const response = await window.adminDashboard.apiRequest(`/api/testimonials/${testimonialId}/approve`, {
                method: 'PATCH'
            });

            if (response.success) {
                window.adminDashboard.showNotification(response.message, 'success');
                await this.loadTestimonials();
            } else {
                window.adminDashboard.showNotification('Failed to update testimonial', 'error');
            }
        } catch (error) {
            console.error('Error toggling approved status:', error);
            window.adminDashboard.showNotification('Failed to update testimonial', 'error');
        }
    }

    async deleteTestimonial(testimonialId) {
        if (!confirm('Are you sure you want to delete this testimonial? This action cannot be undone.')) {
            return;
        }

        try {
            window.adminDashboard.showLoading(true);
            
            const response = await window.adminDashboard.apiRequest(`/api/testimonials/${testimonialId}`, {
                method: 'DELETE'
            });

            if (response.success) {
                window.adminDashboard.showNotification('Testimonial deleted successfully', 'success');
                await this.loadTestimonials();
            } else {
                window.adminDashboard.showNotification('Failed to delete testimonial', 'error');
            }
        } catch (error) {
            console.error('Error deleting testimonial:', error);
            window.adminDashboard.showNotification('Failed to delete testimonial', 'error');
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

// Initialize testimonials manager
document.addEventListener('DOMContentLoaded', () => {
    window.testimonialsManager = new TestimonialsManager();
});