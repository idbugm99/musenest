/**
 * phoenix4ge Gallery Sections JavaScript
 * Part of Phase 3: Frontend Components Development
 * Gallery sections management functionality
 */

class phoenix4geGallerySections {
    constructor(modelSlug) {
        this.modelSlug = modelSlug;
        this.sections = [];
        this.currentEditingSection = null;
        this.selectedMedia = new Set();
        this.availableMedia = [];
        
        this.init();
    }
    
    /**
     * Initialize gallery sections manager
     */
    init() {
        console.log(`🖼️ Initializing phoenix4ge Gallery Sections for model: ${this.modelSlug}`);
        this.bindEvents();
        this.loadSections();
    }
    
    /**
     * Bind all event listeners
     */
    bindEvents() {
        // Create section form
        const createForm = document.getElementById('create-section-form');
        if (createForm) {
            createForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.createSection();
            });
        }
        
        // Layout type change
        const layoutSelect = document.getElementById('new-section-layout');
        if (layoutSelect) {
            layoutSelect.addEventListener('change', () => {
                this.showLayoutOptions(layoutSelect.value, 'layout-options');
            });
        }
        
        // Edit form layout change
        const editLayoutSelect = document.getElementById('edit-section-layout');
        if (editLayoutSelect) {
            editLayoutSelect.addEventListener('change', () => {
                this.showLayoutOptions(editLayoutSelect.value, 'edit-layout-settings');
            });
        }
        
        // Control buttons
        const refreshBtn = document.getElementById('refresh-sections');
        const reorderBtn = document.getElementById('reorder-sections');
        
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadSections());
        }
        
        if (reorderBtn) {
            reorderBtn.addEventListener('click', () => this.enableReorderMode());
        }
        
        // Edit section modal
        const saveChangesBtn = document.getElementById('save-section-changes');
        if (saveChangesBtn) {
            saveChangesBtn.addEventListener('click', () => this.saveSection());
        }
        
        // Media assignment modal
        const saveAssignmentsBtn = document.getElementById('save-media-assignments');
        const clearAllMediaBtn = document.getElementById('clear-all-media');
        
        if (saveAssignmentsBtn) {
            saveAssignmentsBtn.addEventListener('click', () => this.saveMediaAssignments());
        }
        
        if (clearAllMediaBtn) {
            clearAllMediaBtn.addEventListener('click', () => this.clearAllMedia());
        }
        
        // Media search in assignment modal
        const mediaSearchInput = document.getElementById('media-search');
        if (mediaSearchInput) {
            mediaSearchInput.addEventListener('input', this.debounce(() => {
                this.filterAvailableMedia();
            }, 300));
        }
        
        // Category filter in assignment modal
        const categoryFilter = document.getElementById('media-filter-category');
        if (categoryFilter) {
            categoryFilter.addEventListener('change', () => this.filterAvailableMedia());
        }
    }
    
    /**
     * Load all gallery sections
     */
    async loadSections() {
        try {
            this.showLoadingState();
            
            const response = await fetch(`/api/model-gallery-sections/${this.modelSlug}`);
            const data = await response.json();
            
            if (data.success) {
                this.sections = data.sections || [];
                this.renderSections();
            } else {
                this.showError('Failed to load gallery sections');
            }
        } catch (error) {
            console.error('📂 Error loading sections:', error);
            this.showError('Failed to load gallery sections');
        } finally {
            this.hideLoadingState();
        }
    }
    
    /**
     * Render sections list
     */
    renderSections() {
        const container = document.getElementById('sections-list');
        const loading = document.getElementById('sections-loading');
        const empty = document.getElementById('sections-empty');
        
        if (!container) return;
        
        // Hide loading state
        if (loading) loading.classList.add('d-none');
        
        if (this.sections.length === 0) {
            container.innerHTML = '';
            if (empty) empty.classList.remove('d-none');
            return;
        }
        
        if (empty) empty.classList.add('d-none');
        
        // Sort sections by section_order
        const sortedSections = this.sections.sort((a, b) => (a.section_order || 0) - (b.section_order || 0));
        
        container.innerHTML = sortedSections.map(section => this.renderSection(section)).join('');
        
        // Initialize drag and drop
        this.initializeDragAndDrop();
    }
    
    /**
     * Render individual section
     */
    renderSection(section) {
        const layoutIcons = {
            grid: 'th',
            masonry: 'th-large',
            carousel: 'images',
            lightbox_grid: 'th-list'
        };
        
        return `
            <div class="section-item" data-section-id="${section.id}" data-section-order="${section.section_order || 0}">
                <div class="section-header">
                    <div class="d-flex align-items-center gap-3">
                        <div class="drag-handle me-2" title="Drag to reorder">
                            <i class="fas fa-grip-vertical text-muted"></i>
                        </div>
                        <h5 class="section-title">${section.section_name}</h5>
                        <span class="section-layout-type ${section.layout_type}">
                            <i class="fas fa-${layoutIcons[section.layout_type] || 'th'}"></i>
                            ${section.layout_type.replace('_', ' ')}
                        </span>
                    </div>
                    <div class="section-actions">
                        <button class="btn btn-sm ${section.is_published ? 'btn-success' : 'btn-danger'}" onclick="gallerySections.toggleVisibility(${section.id}, ${!section.is_published})" title="Click to ${section.is_published ? 'hide' : 'show'}">
                            <i class="fas fa-${section.is_published ? 'eye' : 'eye-slash'} me-1"></i>${section.is_published ? 'Visible' : 'Hidden'}
                        </button>
                        <button class="btn btn-sm btn-outline-primary" onclick="gallerySections.editSection(${section.id})">
                            <i class="fas fa-edit me-1"></i>Edit
                        </button>
                        <button class="btn btn-sm btn-outline-success" onclick="gallerySections.assignMedia(${section.id})">
                            <i class="fas fa-images me-1"></i>Assign Media
                        </button>
                        <button class="btn btn-sm btn-outline-info" onclick="gallerySections.previewSection(${section.id})">
                            <i class="fas fa-eye me-1"></i>Preview
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="gallerySections.deleteSection(${section.id})">
                            <i class="fas fa-trash me-1"></i>Delete
                        </button>
                    </div>
                </div>
                
                <div class="section-stats">
                    <div class="section-stat">
                        <i class="fas fa-images text-primary"></i>
                        <span>${section.media_count || 0} images</span>
                    </div>
                    <div class="section-stat">
                        <i class="fas fa-sort text-muted"></i>
                        <span>Order: ${section.section_order || 0}</span>
                    </div>
                    <div class="section-stat">
                        <i class="fas fa-calendar text-muted"></i>
                        <span>Created ${new Date(section.created_date).toLocaleDateString()}</span>
                    </div>
                </div>
                
                ${section.preview_images && section.preview_images.length > 0 ? `
                <div class="section-preview">
                    <div class="section-preview-images">
                        ${section.preview_images.slice(0, 6).map(img => `
                            <img src="${img.thumbnail_url}" alt="${img.original_filename}" class="section-preview-image">
                        `).join('')}
                        ${section.preview_images.length > 6 ? `
                            <div class="section-preview-more d-flex align-items-center justify-content-center bg-light text-muted">
                                +${section.preview_images.length - 6} more
                            </div>
                        ` : ''}
                    </div>
                </div>
                ` : ''}
            </div>
        `;
    }
    
    /**
     * Show layout-specific options
     */
    showLayoutOptions(layoutType, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (!layoutType) {
            container.classList.add('d-none');
            return;
        }
        
        container.classList.remove('d-none');
        container.innerHTML = this.getLayoutOptionsHTML(layoutType);
    }
    
    /**
     * Get HTML for layout-specific options
     */
    getLayoutOptionsHTML(layoutType) {
        switch (layoutType) {
            case 'grid':
                return `
                    <h6><i class="fas fa-cog me-2"></i>Grid Layout Settings</h6>
                    <div class="row">
                        <div class="col-md-4">
                            <div class="option-group">
                                <label class="form-label small">Columns (Desktop)</label>
                                <select class="form-select form-select-sm" name="grid_columns">
                                    <option value="2">2 columns</option>
                                    <option value="3" selected>3 columns</option>
                                    <option value="4">4 columns</option>
                                    <option value="5">5 columns</option>
                                    <option value="6">6 columns</option>
                                </select>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="option-group">
                                <label class="form-label small">Gap Size</label>
                                <select class="form-select form-select-sm" name="grid_gap">
                                    <option value="10">Small (10px)</option>
                                    <option value="20" selected>Medium (20px)</option>
                                    <option value="30">Large (30px)</option>
                                </select>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="option-group">
                                <label class="form-label small">Aspect Ratio</label>
                                <select class="form-select form-select-sm" name="grid_aspect">
                                    <option value="1:1" selected>Square (1:1)</option>
                                    <option value="4:3">Landscape (4:3)</option>
                                    <option value="3:4">Portrait (3:4)</option>
                                    <option value="16:9">Widescreen (16:9)</option>
                                    <option value="auto">Auto</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div class="row mt-3">
                        <div class="col-md-6">
                            <div class="form-check">
                                <input type="checkbox" class="form-check-input" name="grid_lightbox" checked>
                                <label class="form-check-label small">Enable lightbox on click</label>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-check">
                                <input type="checkbox" class="form-check-input" name="grid_captions">
                                <label class="form-check-label small">Show image captions</label>
                            </div>
                        </div>
                    </div>
                `;
                
            case 'masonry':
                return `
                    <h6><i class="fas fa-cog me-2"></i>Masonry Layout Settings</h6>
                    <div class="row">
                        <div class="col-md-6">
                            <div class="option-group">
                                <label class="form-label small">Column Width</label>
                                <select class="form-select form-select-sm" name="masonry_column_width">
                                    <option value="200">Small (200px)</option>
                                    <option value="250" selected>Medium (250px)</option>
                                    <option value="300">Large (300px)</option>
                                </select>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="option-group">
                                <label class="form-label small">Gap Size</label>
                                <select class="form-select form-select-sm" name="masonry_gap">
                                    <option value="10">Small (10px)</option>
                                    <option value="15" selected>Medium (15px)</option>
                                    <option value="20">Large (20px)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div class="form-check mt-3">
                        <input type="checkbox" class="form-check-input" name="masonry_lightbox" checked>
                        <label class="form-check-label small">Enable lightbox on click</label>
                    </div>
                `;
                
            case 'carousel':
                return `
                    <h6><i class="fas fa-cog me-2"></i>Carousel Settings</h6>
                    <div class="row">
                        <div class="col-md-4">
                            <div class="option-group">
                                <label class="form-label small">Autoplay</label>
                                <select class="form-select form-select-sm" name="carousel_autoplay">
                                    <option value="false">Disabled</option>
                                    <option value="3000">3 seconds</option>
                                    <option value="5000" selected>5 seconds</option>
                                    <option value="8000">8 seconds</option>
                                </select>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="option-group">
                                <label class="form-label small">Transition</label>
                                <select class="form-select form-select-sm" name="carousel_transition">
                                    <option value="slide" selected>Slide</option>
                                    <option value="fade">Fade</option>
                                </select>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="option-group">
                                <label class="form-label small">Height</label>
                                <select class="form-select form-select-sm" name="carousel_height">
                                    <option value="300">Small (300px)</option>
                                    <option value="400" selected>Medium (400px)</option>
                                    <option value="500">Large (500px)</option>
                                    <option value="auto">Auto</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div class="row mt-3">
                        <div class="col-md-6">
                            <div class="form-check">
                                <input type="checkbox" class="form-check-input" name="carousel_indicators" checked>
                                <label class="form-check-label small">Show indicators</label>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-check">
                                <input type="checkbox" class="form-check-input" name="carousel_controls" checked>
                                <label class="form-check-label small">Show prev/next controls</label>
                            </div>
                        </div>
                    </div>
                `;
                
            case 'lightbox_grid':
                return `
                    <h6><i class="fas fa-cog me-2"></i>Lightbox Grid Settings</h6>
                    <div class="row">
                        <div class="col-md-4">
                            <div class="option-group">
                                <label class="form-label small">Thumbnail Size</label>
                                <select class="form-select form-select-sm" name="lightbox_thumb_size">
                                    <option value="80">Small (80px)</option>
                                    <option value="120" selected>Medium (120px)</option>
                                    <option value="150">Large (150px)</option>
                                </select>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="option-group">
                                <label class="form-label small">Columns</label>
                                <select class="form-select form-select-sm" name="lightbox_columns">
                                    <option value="4">4 columns</option>
                                    <option value="6" selected>6 columns</option>
                                    <option value="8">8 columns</option>
                                    <option value="10">10 columns</option>
                                </select>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="option-group">
                                <label class="form-label small">Gap Size</label>
                                <select class="form-select form-select-sm" name="lightbox_gap">
                                    <option value="5">Small (5px)</option>
                                    <option value="10" selected>Medium (10px)</option>
                                    <option value="15">Large (15px)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div class="row mt-3">
                        <div class="col-md-6">
                            <div class="form-check">
                                <input type="checkbox" class="form-check-input" name="lightbox_captions" checked>
                                <label class="form-check-label small">Show captions in lightbox</label>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-check">
                                <input type="checkbox" class="form-check-input" name="lightbox_thumbnails" checked>
                                <label class="form-check-label small">Show thumbnail navigation</label>
                            </div>
                        </div>
                    </div>
                `;
                
            default:
                return `<p class="text-muted">No additional options for this layout type.</p>`;
        }
    }
    
    /**
     * Create new gallery section
     */
    async createSection() {
        const nameInput = document.getElementById('new-section-name');
        const layoutSelect = document.getElementById('new-section-layout');
        
        if (!nameInput || !layoutSelect) return;
        
        const sectionName = nameInput.value.trim();
        const layoutType = layoutSelect.value;
        
        if (!sectionName || !layoutType) {
            this.showNotification('Please fill in all required fields', 'warning');
            return;
        }
        
        // Collect layout settings
        const layoutSettings = this.collectLayoutSettings('layout-options');
        
        try {
            const response = await fetch(`/api/model-gallery-sections/${this.modelSlug}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    section_name: sectionName,
                    layout_type: layoutType,
                    layout_settings: layoutSettings
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showNotification('Gallery section created successfully!', 'success');
                this.clearCreateForm();
                this.loadSections();
            } else {
                this.showNotification(`Failed to create section: ${result.message}`, 'error');
            }
            
        } catch (error) {
            console.error('📝 Section creation error:', error);
            this.showNotification('Failed to create section', 'error');
        }
    }
    
    /**
     * Edit section
     */
    async editSection(sectionId) {
        const section = this.sections.find(s => s.id === sectionId);
        if (!section) return;
        
        this.currentEditingSection = section;
        
        // Populate edit form
        const editForm = document.getElementById('edit-section-form');
        if (!editForm) return;
        
        document.getElementById('edit-section-id').value = section.id;
        document.getElementById('edit-section-name').value = section.section_name;
        document.getElementById('edit-section-layout').value = section.layout_type;
        document.getElementById('edit-section-published').checked = section.is_published;
        
        // Show layout options
        this.showLayoutOptions(section.layout_type, 'edit-layout-settings');
        
        // Populate layout settings if they exist
        if (section.layout_settings) {
            this.populateLayoutSettings(section.layout_settings, 'edit-layout-settings');
        }
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('edit-section-modal'));
        modal.show();
    }
    
    /**
     * Save section changes
     */
    async saveSection() {
        if (!this.currentEditingSection) return;
        
        const sectionId = document.getElementById('edit-section-id').value;
        const sectionName = document.getElementById('edit-section-name').value.trim();
        const layoutType = document.getElementById('edit-section-layout').value;
        const isPublished = document.getElementById('edit-section-published').checked;
        
        if (!sectionName || !layoutType) {
            this.showNotification('Please fill in all required fields', 'warning');
            return;
        }
        
        // Collect layout settings
        const layoutSettings = this.collectLayoutSettings('edit-layout-settings');
        
        try {
            const response = await fetch(`/api/model-gallery-sections/${this.modelSlug}/${sectionId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    section_name: sectionName,
                    layout_type: layoutType,
                    layout_settings: layoutSettings,
                    is_published: isPublished
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showNotification('Section updated successfully!', 'success');
                
                // Hide modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('edit-section-modal'));
                if (modal) modal.hide();
                
                // Reload sections
                this.loadSections();
            } else {
                this.showNotification(`Failed to update section: ${result.message}`, 'error');
            }
            
        } catch (error) {
            console.error('💾 Section save error:', error);
            this.showNotification('Failed to save section', 'error');
        }
    }
    
    /**
     * Delete section with confirmation
     */
    async deleteSection(sectionId) {
        const section = this.sections.find(s => s.id === sectionId);
        if (!section) return;
        
        if (!confirm(`Are you sure you want to delete the section "${section.section_name}"? This action cannot be undone.`)) {
            return;
        }
        
        try {
            const response = await fetch(`/api/model-gallery-sections/${this.modelSlug}/${sectionId}`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showNotification('Section deleted successfully', 'success');
                this.loadSections();
            } else {
                this.showNotification('Failed to delete section', 'error');
            }
            
        } catch (error) {
            console.error('🗑️ Section delete error:', error);
            this.showNotification('Failed to delete section', 'error');
        }
    }
    
    /**
     * Assign media to section
     */
    async assignMedia(sectionId) {
        const section = this.sections.find(s => s.id === sectionId);
        if (!section) return;
        
        this.currentEditingSection = section;
        
        // Update modal title
        const titleElement = document.getElementById('assign-section-name');
        if (titleElement) titleElement.textContent = section.section_name;
        
        // Load available media
        await this.loadAvailableMedia();
        
        // Load currently assigned media
        await this.loadAssignedMedia(sectionId);
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('assign-media-modal'));
        modal.show();
    }
    
    /**
     * Load available media for assignment
     */
    async loadAvailableMedia() {
        try {
            const response = await fetch(`/api/model-media-library/${this.modelSlug}?limit=100&status=approved`);
            const data = await response.json();
            
            if (data.success) {
                this.availableMedia = data.media || [];
                this.renderAvailableMedia();
            }
        } catch (error) {
            console.error('📚 Error loading available media:', error);
        }
    }
    
    /**
     * Render available media grid
     */
    renderAvailableMedia(filteredMedia = null) {
        const container = document.getElementById('available-media-grid');
        if (!container) return;
        
        const mediaToShow = filteredMedia || this.availableMedia;
        
        if (mediaToShow.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4 text-muted">
                    <i class="fas fa-images fa-2x mb-2"></i>
                    <p>No media available</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = mediaToShow.map(media => `
            <div class="available-media-item ${this.selectedMedia.has(media.id) ? 'selected' : ''}" 
                 data-media-id="${media.id}" 
                 onclick="gallerySections.toggleMediaSelection(${media.id})">
                <img src="${media.thumbnail_url || media.file_url}" alt="${media.original_filename}">
                <div class="available-media-overlay">
                    <i class="fas fa-${this.selectedMedia.has(media.id) ? 'check' : 'plus'}"></i>
                </div>
            </div>
        `).join('');
    }
    
    /**
     * Toggle media selection
     */
    toggleMediaSelection(mediaId) {
        if (this.selectedMedia.has(mediaId)) {
            this.selectedMedia.delete(mediaId);
        } else {
            this.selectedMedia.add(mediaId);
        }
        
        this.updateMediaSelectionUI();
        this.renderAvailableMedia();
        this.renderAssignedMedia();
    }
    
    /**
     * Update media selection UI
     */
    updateMediaSelectionUI() {
        const countElement = document.getElementById('assigned-count');
        if (countElement) {
            countElement.textContent = this.selectedMedia.size;
        }
    }
    
    /**
     * Render assigned media
     */
    renderAssignedMedia() {
        const container = document.getElementById('assigned-media-list');
        if (!container) return;
        
        if (this.selectedMedia.size === 0) {
            container.innerHTML = `
                <div class="empty-assigned">
                    <i class="fas fa-images fa-2x text-muted mb-2"></i>
                    <p class="text-muted small">No media assigned</p>
                    <p class="text-muted small">Click media on the left to assign them to this section</p>
                </div>
            `;
            return;
        }
        
        const assignedMediaArray = Array.from(this.selectedMedia).map(id => 
            this.availableMedia.find(m => m.id === id)
        ).filter(Boolean);
        
        container.innerHTML = assignedMediaArray.map((media, index) => `
            <div class="assigned-media-item" data-media-id="${media.id}">
                <span class="assigned-media-order">${index + 1}</span>
                <img src="${media.thumbnail_url || media.file_url}" alt="${media.original_filename}">
                <div class="assigned-media-info">
                    <div class="fw-bold small">${media.original_filename}</div>
                    <div class="text-muted small">${media.image_width} × ${media.image_height}</div>
                </div>
                <button type="button" class="btn btn-sm btn-outline-danger" onclick="gallerySections.toggleMediaSelection(${media.id})">
                    <i class="fas fa-times"></i>
                </button>
                <div class="drag-handle">
                    <i class="fas fa-grip-vertical"></i>
                </div>
            </div>
        `).join('');
    }
    
    // ========================
    // UTILITY METHODS
    // ========================
    
    /**
     * Collect layout settings from form
     */
    collectLayoutSettings(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return {};
        
        const settings = {};
        const inputs = container.querySelectorAll('input, select');
        
        inputs.forEach(input => {
            if (input.name) {
                if (input.type === 'checkbox') {
                    settings[input.name] = input.checked;
                } else {
                    settings[input.name] = input.value;
                }
            }
        });
        
        return settings;
    }
    
    /**
     * Populate layout settings in form
     */
    populateLayoutSettings(settings, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        Object.entries(settings).forEach(([name, value]) => {
            const input = container.querySelector(`[name="${name}"]`);
            if (input) {
                if (input.type === 'checkbox') {
                    input.checked = value;
                } else {
                    input.value = value;
                }
            }
        });
    }
    
    /**
     * Clear create section form
     */
    clearCreateForm() {
        const form = document.getElementById('create-section-form');
        if (form) {
            form.reset();
            document.getElementById('layout-options').classList.add('d-none');
        }
    }
    
    /**
     * Filter available media based on search and category
     */
    filterAvailableMedia() {
        const searchInput = document.getElementById('media-search');
        const categoryFilter = document.getElementById('media-filter-category');
        
        let filteredMedia = this.availableMedia;
        
        // Apply search filter
        if (searchInput && searchInput.value.trim()) {
            const searchTerm = searchInput.value.trim().toLowerCase();
            filteredMedia = filteredMedia.filter(media => 
                media.original_filename.toLowerCase().includes(searchTerm)
            );
        }
        
        // Apply category filter
        if (categoryFilter && categoryFilter.value) {
            const categoryId = parseInt(categoryFilter.value);
            filteredMedia = filteredMedia.filter(media => 
                media.category_id === categoryId
            );
        }
        
        this.renderAvailableMedia(filteredMedia);
    }
    
    /**
     * Clear all media assignments
     */
    clearAllMedia() {
        if (this.selectedMedia.size === 0) return;
        
        if (confirm('Are you sure you want to clear all media assignments?')) {
            this.selectedMedia.clear();
            this.renderAvailableMedia();
            this.renderAssignedMedia();
            this.updateMediaSelectionUI();
        }
    }
    
    /**
     * Save media assignments
     */
    async saveMediaAssignments() {
        if (!this.currentEditingSection) return;
        
        try {
            const mediaArray = Array.from(this.selectedMedia);
            
            const response = await fetch(`/api/model-gallery-sections/${this.modelSlug}/${this.currentEditingSection.id}/media`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    media_ids: mediaArray
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showNotification('Media assignments saved successfully!', 'success');
                
                // Hide modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('assign-media-modal'));
                if (modal) modal.hide();
                
                // Reload sections
                this.loadSections();
            } else {
                this.showNotification('Failed to save media assignments', 'error');
            }
            
        } catch (error) {
            console.error('💾 Media assignment error:', error);
            this.showNotification('Failed to save media assignments', 'error');
        }
    }
    
    /**
     * Show loading state
     */
    showLoadingState() {
        const loading = document.getElementById('sections-loading');
        if (loading) loading.classList.remove('d-none');
    }
    
    /**
     * Hide loading state
     */
    hideLoadingState() {
        const loading = document.getElementById('sections-loading');
        if (loading) loading.classList.add('d-none');
    }
    
    /**
     * Show error message
     */
    showError(message) {
        this.showNotification(message, 'error');
    }
    
    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        // Reuse notification system from media library
        if (window.mediaLibrary && window.mediaLibrary.showNotification) {
            window.mediaLibrary.showNotification(message, type);
        } else {
            // Fallback alert
            alert(message);
        }
    }
    
    /**
     * Debounce utility
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
     * Preview section (placeholder)
     */
    previewSection(sectionId) {
        this.showNotification('Section preview functionality coming soon!', 'info');
    }
    
    /**
     * Toggle section visibility
     */
    async toggleVisibility(sectionId, newVisibility) {
        try {
            const response = await fetch(`/api/model-gallery-sections/${this.modelSlug}/${sectionId}/toggle-visibility`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    is_published: newVisibility
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showNotification(`Section ${newVisibility ? 'published' : 'hidden'} successfully!`, 'success');
                // Update the local section data
                const section = this.sections.find(s => s.id === sectionId);
                if (section) {
                    section.is_published = newVisibility;
                }
                // Re-render sections
                this.renderSections();
            } else {
                this.showNotification('Failed to update section visibility', 'error');
            }
            
        } catch (error) {
            console.error('👁️ Visibility toggle error:', error);
            this.showNotification('Failed to update section visibility', 'error');
        }
    }
    
    /**
     * Initialize drag and drop functionality
     */
    initializeDragAndDrop() {
        const container = document.getElementById('sections-list');
        if (!container) return;
        
        // Check if SortableJS is loaded
        if (typeof Sortable === 'undefined') {
            // Load SortableJS dynamically if not available
            this.loadSortableJS().then(() => {
                this.createSortable(container);
            });
        } else {
            this.createSortable(container);
        }
    }
    
    /**
     * Create sortable instance
     */
    createSortable(container) {
        if (this.sortableInstance) {
            this.sortableInstance.destroy();
        }
        
        this.sortableInstance = Sortable.create(container, {
            handle: '.drag-handle',
            animation: 150,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            onEnd: (event) => {
                this.handleSectionReorder(event);
            }
        });
    }
    
    /**
     * Handle section reorder
     */
    async handleSectionReorder(event) {
        const { oldIndex, newIndex } = event;
        
        if (oldIndex === newIndex) return;
        
        // Reorder sections array
        const movedSection = this.sections.splice(oldIndex, 1)[0];
        this.sections.splice(newIndex, 0, movedSection);
        
        // Update section orders
        const reorderData = this.sections.map((section, index) => ({
            id: section.id,
            section_order: index + 1
        }));
        
        try {
            const response = await fetch(`/api/model-gallery-sections/${this.modelSlug}/reorder`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sections: reorderData
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showNotification('Section order updated successfully!', 'success');
                // Update local section orders
                reorderData.forEach(item => {
                    const section = this.sections.find(s => s.id === item.id);
                    if (section) {
                        section.section_order = item.section_order;
                    }
                });
            } else {
                this.showNotification('Failed to update section order', 'error');
                // Reload sections to restore original order
                this.loadSections();
            }
            
        } catch (error) {
            console.error('🔄 Reorder error:', error);
            this.showNotification('Failed to update section order', 'error');
            // Reload sections to restore original order
            this.loadSections();
        }
    }
    
    /**
     * Load SortableJS library dynamically
     */
    async loadSortableJS() {
        return new Promise((resolve, reject) => {
            if (typeof Sortable !== 'undefined') {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    
    /**
     * Enable reorder mode (now functional)
     */
    enableReorderMode() {
        const container = document.getElementById('sections-list');
        const reorderBtn = document.getElementById('reorder-sections');
        
        if (!container || !reorderBtn) return;
        
        // Toggle reorder mode
        if (container.classList.contains('reorder-mode')) {
            // Disable reorder mode
            container.classList.remove('reorder-mode');
            reorderBtn.innerHTML = '<i class="fas fa-arrows-alt me-1"></i>Reorder';
            reorderBtn.classList.remove('btn-warning');
            reorderBtn.classList.add('btn-outline-secondary');
            this.showNotification('Reorder mode disabled', 'info');
        } else {
            // Enable reorder mode
            container.classList.add('reorder-mode');
            reorderBtn.innerHTML = '<i class="fas fa-check me-1"></i>Done Reordering';
            reorderBtn.classList.remove('btn-outline-secondary');
            reorderBtn.classList.add('btn-warning');
            this.showNotification('Reorder mode enabled - drag sections to reorder', 'info');
        }
    }
    
    /**
     * Load assigned media for a section
     */
    async loadAssignedMedia(sectionId) {
        try {
            const response = await fetch(`/api/model-gallery-sections/${this.modelSlug}/${sectionId}/media`);
            const data = await response.json();
            
            if (data.success && data.media) {
                this.selectedMedia.clear();
                data.media.forEach(media => {
                    this.selectedMedia.add(media.id);
                });
                this.renderAssignedMedia();
                this.updateMediaSelectionUI();
            }
        } catch (error) {
            console.error('📚 Error loading assigned media:', error);
        }
    }
}

// Global instance
let gallerySections = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    const modelSlug = window.location.pathname.split('/')[1];
    if (modelSlug && document.getElementById('sections-list')) {
        gallerySections = new phoenix4geGallerySections(modelSlug);
        console.log('🖼️ phoenix4ge Gallery Sections initialized');
    }
});