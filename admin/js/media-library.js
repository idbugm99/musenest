/**
 * MuseNest Media Library JavaScript
 * Part of Phase 3: Frontend Components Development
 * Enhanced from RoseMastos with MuseNest integration
 */

class MuseNestMediaLibrary {
    constructor(modelSlug) {
        this.modelSlug = modelSlug;
        this.selectedMedia = new Set();
        this.currentPage = 1;
        this.itemsPerPage = 24;
        this.currentView = 'grid';
        this.filters = {
            search: '',
            category: '',
            status: '',
            sort: 'newest'
        };
        
        // Current image being edited
        this.currentEditingMedia = null;
        
        this.init();
    }
    
    /**
     * Initialize the media library
     */
    init() {
        console.log(`🎬 Initializing MuseNest Media Library for model: ${this.modelSlug}`);
        this.bindEvents();
        this.loadMedia();
        this.loadCategories();
    }
    
    /**
     * Bind all event listeners
     */
    bindEvents() {
        // Upload functionality
        const mediaUpload = document.getElementById('media-upload');
        const mediaDropzone = document.getElementById('media-dropzone');
        
        if (mediaUpload) {
            mediaUpload.addEventListener('change', (e) => {
                this.handleFileUpload(e.target.files);
            });
        }
        
        // Drag and drop functionality
        if (mediaDropzone) {
            mediaDropzone.addEventListener('click', () => {
                mediaUpload?.click();
            });
            
            mediaDropzone.addEventListener('dragover', (e) => {
                e.preventDefault();
                mediaDropzone.classList.add('dragover');
            });
            
            mediaDropzone.addEventListener('dragleave', () => {
                mediaDropzone.classList.remove('dragover');
            });
            
            mediaDropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                mediaDropzone.classList.remove('dragover');
                this.handleFileUpload(e.dataTransfer.files);
            });
        }
        
        // Search and filter controls
        const searchInput = document.getElementById('media-search');
        const categoryFilter = document.getElementById('category-filter');
        const statusFilter = document.getElementById('status-filter');
        
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce(() => {
                this.filters.search = searchInput.value;
                this.currentPage = 1;
                this.loadMedia();
            }, 500));
        }
        
        if (categoryFilter) {
            categoryFilter.addEventListener('change', () => {
                this.filters.category = categoryFilter.value;
                this.currentPage = 1;
                this.loadMedia();
            });
        }
        
        if (statusFilter) {
            statusFilter.addEventListener('change', () => {
                this.filters.status = statusFilter.value;
                this.currentPage = 1;
                this.loadMedia();
            });
        }
        
        // View toggle buttons
        const gridViewBtn = document.getElementById('grid-view');
        const listViewBtn = document.getElementById('list-view');
        
        if (gridViewBtn) {
            gridViewBtn.addEventListener('click', () => this.switchView('grid'));
        }
        
        if (listViewBtn) {
            listViewBtn.addEventListener('click', () => this.switchView('list'));
        }
        
        // Batch action buttons
        const batchApprove = document.getElementById('batch-approve');
        const batchCategory = document.getElementById('batch-category');
        const batchDelete = document.getElementById('batch-delete');
        
        if (batchApprove) {
            batchApprove.addEventListener('click', () => this.batchApprove());
        }
        
        if (batchCategory) {
            batchCategory.addEventListener('click', () => this.batchSetCategory());
        }
        
        if (batchDelete) {
            batchDelete.addEventListener('click', () => this.batchDelete());
        }
    }
    
    /**
     * Handle file upload
     */
    async handleFileUpload(files) {
        if (!files || files.length === 0) return;
        
        console.log(`📤 Uploading ${files.length} files...`);
        
        const formData = new FormData();
        const applyWatermark = document.getElementById('apply-watermark')?.checked || false;
        const category = document.getElementById('upload-category')?.value || '';
        
        // Add files to form data
        Array.from(files).forEach(file => {
            if (this.isValidImageFile(file)) {
                formData.append('files', file);
            } else {
                this.showNotification(`Skipped invalid file: ${file.name}`, 'warning');
            }
        });
        
        // Add upload options
        formData.append('apply_watermark', applyWatermark);
        if (category) formData.append('category_id', category);
        
        try {
            this.showUploadProgress();
            
            const response = await fetch(`/api/model-media-library/${this.modelSlug}/upload`, {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showUploadSuccess(result);
                this.loadMedia(); // Refresh the grid
                this.clearFileInput();
            } else {
                this.showUploadError(result.message);
            }
            
        } catch (error) {
            console.error('📤 Upload error:', error);
            this.showUploadError('Upload failed. Please try again.');
        } finally {
            this.hideUploadProgress();
        }
    }
    
    /**
     * Load media from API
     */
    async loadMedia() {
        const params = new URLSearchParams({
            page: this.currentPage,
            limit: this.itemsPerPage,
            ...this.filters
        });
        
        try {
            this.showLoadingState();
            
            const response = await fetch(`/api/model-media-library/${this.modelSlug}?${params}`);
            const data = await response.json();
            
            if (data.success) {
                this.renderMediaGrid(data.media);
                this.renderPagination(data.pagination);
            } else {
                this.showError('Failed to load media library');
            }
        } catch (error) {
            console.error('📚 Error loading media:', error);
            this.showError('Failed to load media library');
        } finally {
            this.hideLoadingState();
        }
    }
    
    /**
     * Load categories for filter dropdown
     */
    async loadCategories() {
        try {
            const response = await fetch(`/api/model-media-library/${this.modelSlug}/categories`);
            const data = await response.json();
            
            if (data.success) {
                this.populateCategoryDropdowns(data.categories);
            }
        } catch (error) {
            console.error('📂 Error loading categories:', error);
        }
    }
    
    /**
     * Render media grid
     */
    renderMediaGrid(media) {
        const grid = document.getElementById('media-grid');
        if (!grid) return;
        
        if (media.length === 0) {
            grid.innerHTML = `
                <div class="text-center py-5 col-span-full">
                    <i class="fas fa-images fa-3x text-muted mb-3"></i>
                    <h6 class="text-muted">No Media Found</h6>
                    <p class="text-muted small">Upload some images to get started.</p>
                </div>
            `;
            return;
        }
        
        // Apply current view class
        grid.className = `media-grid ${this.currentView}-view`;
        
        grid.innerHTML = media.map(item => this.renderMediaItem(item)).join('');
        
        // Update selection UI
        this.updateBatchActionsUI();
    }
    
    /**
     * Render individual media item
     */
    renderMediaItem(item) {
        const isSelected = this.selectedMedia.has(item.id);
        const statusClass = `status-${item.moderation_status}`;
        
        return `
            <div class="media-item ${isSelected ? 'selected' : ''}" data-id="${item.id}">
                <div class="media-card">
                    <div class="media-preview">
                        <img src="${item.thumbnail_url || item.file_url}" 
                             alt="${item.original_filename}" 
                             loading="lazy"
                             onerror="this.src='/admin/assets/img/placeholder-image.jpg'">
                        
                        <div class="media-overlay">
                            <div class="media-actions">
                                <button class="btn btn-sm btn-primary" onclick="mediaLibrary.viewImage(${item.id})" title="View">
                                    <i class="fas fa-eye"></i>
                                </button>
                                <button class="btn btn-sm btn-success" onclick="mediaLibrary.editImage(${item.id})" title="Edit">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-sm btn-info" onclick="mediaLibrary.manageImage(${item.id})" title="Manage">
                                    <i class="fas fa-cog"></i>
                                </button>
                                <button class="btn btn-sm btn-danger" onclick="mediaLibrary.deleteImage(${item.id})" title="Delete">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                        
                        <div class="media-checkbox">
                            <input type="checkbox" 
                                   data-media-id="${item.id}" 
                                   ${isSelected ? 'checked' : ''} 
                                   onchange="mediaLibrary.toggleSelection(${item.id})">
                        </div>
                        
                        <div class="moderation-status ${statusClass}">
                            ${item.moderation_status}
                        </div>
                    </div>
                    
                    <div class="media-info">
                        <div class="media-filename" title="${item.original_filename}">${item.original_filename}</div>
                        <div class="media-meta">
                            <span>${item.image_width} × ${item.image_height}</span>
                            <span>${this.formatFileSize(item.file_size)}</span>
                        </div>
                        ${item.category_name ? `<div class="media-category small text-muted">${item.category_name}</div>` : ''}
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Toggle media selection
     */
    toggleSelection(mediaId) {
        if (this.selectedMedia.has(mediaId)) {
            this.selectedMedia.delete(mediaId);
        } else {
            this.selectedMedia.add(mediaId);
        }
        
        this.updateBatchActionsUI();
        this.updateMediaItemSelection(mediaId);
    }
    
    /**
     * Update batch actions UI
     */
    updateBatchActionsUI() {
        const batchActions = document.getElementById('batch-actions');
        const selectedCount = document.getElementById('selected-count');
        
        if (batchActions && selectedCount) {
            if (this.selectedMedia.size > 0) {
                batchActions.classList.remove('d-none');
                selectedCount.textContent = this.selectedMedia.size;
            } else {
                batchActions.classList.add('d-none');
            }
        }
    }
    
    /**
     * Update individual media item selection state
     */
    updateMediaItemSelection(mediaId) {
        const mediaItem = document.querySelector(`[data-id="${mediaId}"]`);
        const checkbox = document.querySelector(`[data-media-id="${mediaId}"]`);
        
        if (mediaItem && checkbox) {
            const isSelected = this.selectedMedia.has(mediaId);
            mediaItem.classList.toggle('selected', isSelected);
            checkbox.checked = isSelected;
        }
    }
    
    /**
     * View image in lightbox
     */
    viewImage(mediaId) {
        // Find the media item
        const mediaItem = document.querySelector(`[data-id="${mediaId}"]`);
        if (mediaItem) {
            const img = mediaItem.querySelector('img');
            if (img) {
                // Create simple lightbox
                this.showLightbox(img.src, img.alt);
            }
        }
    }
    
    /**
     * Edit image - opens advanced editor
     */
    async editImage(mediaId) {
        try {
            console.log(`✏️ Opening editor for media ${mediaId}`);
            
            // Fetch media details
            const response = await fetch(`/api/model-media-library/${this.modelSlug}/${mediaId}`);
            const data = await response.json();
            
            if (data.success) {
                this.openImageEditor(data.media);
            } else {
                this.showNotification('Failed to load image for editing', 'error');
            }
        } catch (error) {
            console.error('✏️ Error loading image for editing:', error);
            this.showNotification('Failed to load image for editing', 'error');
        }
    }
    
    /**
     * Open image editor modal
     */
    openImageEditor(mediaData) {
        this.currentEditingMedia = mediaData;
        
        // Set up the image editor modal
        const modal = new bootstrap.Modal(document.getElementById('image-editor-modal'));
        const previewImg = document.getElementById('preview-image');
        const cropCanvas = document.getElementById('crop-canvas');
        
        // Load image
        previewImg.src = mediaData.file_url;
        previewImg.alt = mediaData.original_filename;
        
        // Update info panel
        this.updateImageInfo(mediaData);
        
        // Reset editor state
        this.resetImageEditor();
        
        // Show modal
        modal.show();
        
        // Initialize editor functionality
        this.initializeImageEditor();
    }
    
    /**
     * Delete image with confirmation
     */
    async deleteImage(mediaId) {
        if (!confirm('Are you sure you want to delete this image? This action cannot be undone.')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/model-media-library/${this.modelSlug}/${mediaId}`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showNotification('Image deleted successfully', 'success');
                this.selectedMedia.delete(mediaId);
                this.loadMedia(); // Refresh grid
            } else {
                this.showNotification('Failed to delete image', 'error');
            }
        } catch (error) {
            console.error('🗑️ Error deleting image:', error);
            this.showNotification('Failed to delete image', 'error');
        }
    }
    
    /**
     * Switch between grid and list views
     */
    switchView(viewType) {
        this.currentView = viewType;
        
        // Update button states
        const gridBtn = document.getElementById('grid-view');
        const listBtn = document.getElementById('list-view');
        
        if (gridBtn && listBtn) {
            gridBtn.classList.toggle('active', viewType === 'grid');
            listBtn.classList.toggle('active', viewType === 'list');
        }
        
        // Update grid classes
        const grid = document.getElementById('media-grid');
        if (grid) {
            grid.className = `media-grid ${viewType}-view`;
        }
        
        // Save preference
        localStorage.setItem('mediaLibraryView', viewType);
    }
    
    /**
     * Batch approve selected media
     */
    async batchApprove() {
        if (this.selectedMedia.size === 0) return;
        
        const mediaIds = Array.from(this.selectedMedia);
        
        try {
            // Note: This would need a batch approval API endpoint
            this.showNotification(`Approved ${mediaIds.length} images`, 'success');
            this.selectedMedia.clear();
            this.loadMedia();
        } catch (error) {
            this.showNotification('Failed to approve images', 'error');
        }
    }
    
    /**
     * Batch delete selected media
     */
    async batchDelete() {
        if (this.selectedMedia.size === 0) return;
        
        const count = this.selectedMedia.size;
        if (!confirm(`Are you sure you want to delete ${count} selected images? This action cannot be undone.`)) {
            return;
        }
        
        const mediaIds = Array.from(this.selectedMedia);
        let successCount = 0;
        
        for (const mediaId of mediaIds) {
            try {
                const response = await fetch(`/api/model-media-library/${this.modelSlug}/${mediaId}`, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    successCount++;
                    this.selectedMedia.delete(mediaId);
                }
            } catch (error) {
                console.error(`Failed to delete media ${mediaId}:`, error);
            }
        }
        
        this.showNotification(`Deleted ${successCount} of ${count} images`, 'success');
        this.loadMedia();
    }
    
    // ====================
    // UTILITY METHODS
    // ====================
    
    /**
     * Format file size for display
     */
    formatFileSize(bytes) {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
    
    /**
     * Check if file is a valid image
     */
    isValidImageFile(file) {
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        const maxSize = 50 * 1024 * 1024; // 50MB
        
        return validTypes.includes(file.type) && file.size <= maxSize;
    }
    
    /**
     * Debounce function for search input
     */
    debounce(func, wait) {
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
    
    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        // Create toast notification
        const toastHtml = `
            <div class="toast align-items-center text-white bg-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'primary'} border-0" role="alert">
                <div class="d-flex">
                    <div class="toast-body">${message}</div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                </div>
            </div>
        `;
        
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
            toastContainer.style.zIndex = '9999';
            document.body.appendChild(toastContainer);
        }
        
        toastContainer.insertAdjacentHTML('beforeend', toastHtml);
        const toastElement = toastContainer.lastElementChild;
        const toast = new bootstrap.Toast(toastElement, { delay: 5000 });
        toast.show();
        
        // Remove toast element after it's hidden
        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
    }
    
    /**
     * Show/hide loading states
     */
    showLoadingState() {
        const grid = document.getElementById('media-grid');
        if (grid) {
            grid.innerHTML = `
                <div class="text-center py-5 col-span-full">
                    <div class="spinner-border text-primary mb-3" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="text-muted">Loading media library...</p>
                </div>
            `;
        }
    }
    
    hideLoadingState() {
        // Loading state will be replaced by renderMediaGrid
    }
    
    /**
     * Upload progress handling
     */
    showUploadProgress() {
        const progressContainer = document.getElementById('upload-progress');
        const progressBar = progressContainer?.querySelector('.progress-bar');
        const statusText = progressContainer?.querySelector('.upload-status');
        
        if (progressContainer) {
            progressContainer.classList.remove('d-none');
            if (progressBar) progressBar.style.width = '0%';
            if (statusText) statusText.textContent = 'Preparing upload...';
        }
    }
    
    hideUploadProgress() {
        const progressContainer = document.getElementById('upload-progress');
        if (progressContainer) {
            setTimeout(() => {
                progressContainer.classList.add('d-none');
            }, 2000);
        }
    }
    
    showUploadSuccess(result) {
        const progressBar = document.querySelector('#upload-progress .progress-bar');
        const statusText = document.querySelector('#upload-progress .upload-status');
        
        if (progressBar) progressBar.style.width = '100%';
        if (statusText) statusText.textContent = `Successfully uploaded ${result.summary.successful} files`;
        
        this.showNotification(`Upload complete: ${result.summary.successful} files uploaded successfully`, 'success');
    }
    
    showUploadError(message) {
        const statusText = document.querySelector('#upload-progress .upload-status');
        if (statusText) statusText.textContent = `Upload failed: ${message}`;
        
        this.showNotification(`Upload failed: ${message}`, 'error');
    }
    
    clearFileInput() {
        const fileInput = document.getElementById('media-upload');
        if (fileInput) fileInput.value = '';
    }
    
    /**
     * Populate category dropdowns
     */
    populateCategoryDropdowns(categories) {
        const categoryFilter = document.getElementById('category-filter');
        const uploadCategory = document.getElementById('upload-category');
        
        const categoryOptions = categories.map(cat => 
            `<option value="${cat.id}">${cat.category_name} (${cat.media_count})</option>`
        ).join('');
        
        if (categoryFilter) {
            categoryFilter.innerHTML = '<option value="">All Categories</option>' + categoryOptions;
        }
        
        if (uploadCategory) {
            uploadCategory.innerHTML = '<option value="">Select Category (Optional)</option>' + categoryOptions;
        }
    }
    
    /**
     * Show simple lightbox for image viewing
     */
    showLightbox(imageSrc, imageAlt) {
        const lightboxHtml = `
            <div class="modal fade" id="image-lightbox" tabindex="-1">
                <div class="modal-dialog modal-xl">
                    <div class="modal-content bg-transparent border-0">
                        <div class="modal-body p-0 text-center">
                            <button type="button" class="btn-close btn-close-white position-absolute top-0 end-0 m-3" data-bs-dismiss="modal" style="z-index: 1050;"></button>
                            <img src="${imageSrc}" alt="${imageAlt}" style="max-width: 100%; max-height: 90vh; object-fit: contain;">
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing lightbox
        const existingLightbox = document.getElementById('image-lightbox');
        if (existingLightbox) existingLightbox.remove();
        
        // Add new lightbox
        document.body.insertAdjacentHTML('beforeend', lightboxHtml);
        const lightbox = new bootstrap.Modal(document.getElementById('image-lightbox'));
        lightbox.show();
        
        // Remove after hide
        document.getElementById('image-lightbox').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    }
    
    // Image editor methods will be implemented in a separate file
    updateImageInfo(mediaData) { /* Implemented in image-editor.js */ }
    resetImageEditor() { /* Implemented in image-editor.js */ }
    initializeImageEditor() { /* Implemented in image-editor.js */ }
    
    // Pagination rendering
    renderPagination(pagination) {
        const container = document.getElementById('pagination-container');
        if (!container || !pagination) return;
        
        if (pagination.pages <= 1) {
            container.innerHTML = '';
            return;
        }
        
        let paginationHtml = '<nav><ul class="pagination justify-content-center">';
        
        // Previous button
        paginationHtml += `
            <li class="page-item ${!pagination.hasPrev ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="mediaLibrary.goToPage(${pagination.page - 1}); return false;">Previous</a>
            </li>
        `;
        
        // Page numbers
        const startPage = Math.max(1, pagination.page - 2);
        const endPage = Math.min(pagination.pages, pagination.page + 2);
        
        for (let i = startPage; i <= endPage; i++) {
            paginationHtml += `
                <li class="page-item ${i === pagination.page ? 'active' : ''}">
                    <a class="page-link" href="#" onclick="mediaLibrary.goToPage(${i}); return false;">${i}</a>
                </li>
            `;
        }
        
        // Next button
        paginationHtml += `
            <li class="page-item ${!pagination.hasNext ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="mediaLibrary.goToPage(${pagination.page + 1}); return false;">Next</a>
            </li>
        `;
        
        paginationHtml += '</ul></nav>';
        container.innerHTML = paginationHtml;
    }
    
    goToPage(page) {
        this.currentPage = page;
        this.loadMedia();
    }
}

// Global instance - will be initialized when the page loads
let mediaLibrary = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    const modelSlug = window.location.pathname.split('/')[1]; // Extract slug from URL
    if (modelSlug && document.getElementById('media-grid')) {
        mediaLibrary = new MuseNestMediaLibrary(modelSlug);
        console.log('🚀 MuseNest Media Library initialized');
    }
});