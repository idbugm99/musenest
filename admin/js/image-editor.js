/**
 * phoenix4ge Image Editor JavaScript
 * Part of Phase 3: Frontend Components Development
 * Advanced image editing functionality adapted from RoseMastos
 */

class phoenix4geImageEditor {
    constructor(mediaLibrary) {
        this.mediaLibrary = mediaLibrary;
        this.currentMedia = null;
        this.cropTool = null;
        this.cropMode = false;
        this.originalImage = null;
        
        // Filter values
        this.filters = {
            brightness: 1.0,
            contrast: 1.0,
            saturation: 1.0,
            blur: 0,
            sharpen: 0,
            gamma: 1.0
        };
        
        this.init();
    }
    
    /**
     * Initialize image editor
     */
    init() {
        console.log('🎨 Initializing phoenix4ge Image Editor');
        this.bindEditorEvents();
    }
    
    /**
     * Bind all image editor events
     */
    bindEditorEvents() {
        // Crop tool events
        const cropModeBtn = document.getElementById('crop-mode');
        const applyCropBtn = document.getElementById('apply-crop');
        const cancelCropBtn = document.getElementById('cancel-crop');
        
        if (cropModeBtn) {
            cropModeBtn.addEventListener('click', () => this.toggleCropMode());
        }
        
        if (applyCropBtn) {
            applyCropBtn.addEventListener('click', () => this.applyCrop());
        }
        
        if (cancelCropBtn) {
            cancelCropBtn.addEventListener('click', () => this.cancelCrop());
        }
        
        // Aspect ratio buttons
        const aspectButtons = document.querySelectorAll('[data-aspect]');
        aspectButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setAspectRatio(e.target.getAttribute('data-aspect'));
            });
        });
        
        // Rotation buttons
        const rotationButtons = document.querySelectorAll('[data-rotation]');
        rotationButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const angle = parseInt(e.target.getAttribute('data-rotation'));\n                this.rotateImage(angle);
            });
        });
        
        // Custom rotation
        const customRotationBtn = document.getElementById('apply-custom-rotation');
        if (customRotationBtn) {
            customRotationBtn.addEventListener('click', () => this.applyCustomRotation());
        }
        
        // Resize functionality
        const applyResizeBtn = document.getElementById('apply-resize');
        const maintainAspectCheckbox = document.getElementById('maintain-aspect');
        const resizeWidthInput = document.getElementById('resize-width');
        const resizeHeightInput = document.getElementById('resize-height');
        
        if (applyResizeBtn) {
            applyResizeBtn.addEventListener('click', () => this.applyResize());
        }
        
        // Aspect ratio locking for resize
        if (maintainAspectCheckbox && resizeWidthInput && resizeHeightInput) {
            let aspectRatio = 1;
            
            const updateAspectRatio = () => {
                if (this.currentMedia) {
                    aspectRatio = this.currentMedia.image_width / this.currentMedia.image_height;
                }
            };
            
            resizeWidthInput.addEventListener('input', (e) => {
                if (maintainAspectCheckbox.checked && aspectRatio) {
                    const newHeight = Math.round(e.target.value / aspectRatio);
                    resizeHeightInput.value = newHeight;
                }
            });
            
            resizeHeightInput.addEventListener('input', (e) => {
                if (maintainAspectCheckbox.checked && aspectRatio) {
                    const newWidth = Math.round(e.target.value * aspectRatio);
                    resizeWidthInput.value = newWidth;
                }
            });
            
            // Update aspect ratio when media changes
            this.updateAspectRatio = updateAspectRatio;
        }
        
        // Filter sliders
        const filterSliders = [\n            'brightness', 'contrast', 'saturation', 'blur', 'sharpen'\n        ];
        
        filterSliders.forEach(filterName => {
            const slider = document.getElementById(`${filterName}-slider`);
            const value = document.getElementById(`${filterName}-value`);
            
            if (slider && value) {
                slider.addEventListener('input', (e) => {
                    const val = parseFloat(e.target.value);
                    this.filters[filterName] = val;
                    value.textContent = val;
                    this.previewFilters();
                });
            }
        });
        
        // Filter controls
        const resetFiltersBtn = document.getElementById('reset-filters');
        const applyFiltersBtn = document.getElementById('apply-filters');
        
        if (resetFiltersBtn) {
            resetFiltersBtn.addEventListener('click', () => this.resetFilters());
        }
        
        if (applyFiltersBtn) {
            applyFiltersBtn.addEventListener('click', () => this.applyFilters());
        }
        
        // Edit history
        const viewHistoryBtn = document.getElementById('view-edit-history');
        if (viewHistoryBtn) {
            viewHistoryBtn.addEventListener('click', () => this.showEditHistory());
        }
        
        // Save and close
        const saveAndCloseBtn = document.getElementById('save-and-close');
        if (saveAndCloseBtn) {
            saveAndCloseBtn.addEventListener('click', () => this.saveAndClose());
        }
    }
    
    /**
     * Update image information panel
     */
    updateImageInfo(mediaData) {
        this.currentMedia = mediaData;
        
        // Update info displays
        const elements = {
            'current-filename': mediaData.original_filename,
            'current-filesize': this.formatFileSize(mediaData.file_size),
            'current-dimensions': `${mediaData.image_width} × ${mediaData.image_height}`,
            'current-format': mediaData.mime_type,
            'image-dimensions': `${mediaData.image_width} × ${mediaData.image_height}`
        };
        
        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
        
        // Update status badge
        const statusElement = document.getElementById('current-status');
        if (statusElement) {
            statusElement.textContent = mediaData.moderation_status;
            statusElement.className = `badge bg-${this.getStatusColor(mediaData.moderation_status)}`;
        }
        
        // Set resize defaults
        const resizeWidth = document.getElementById('resize-width');
        const resizeHeight = document.getElementById('resize-height');
        if (resizeWidth) resizeWidth.value = mediaData.image_width;
        if (resizeHeight) resizeHeight.value = mediaData.image_height;
        
        // Update aspect ratio calculator
        if (this.updateAspectRatio) {
            this.updateAspectRatio();
        }
    }
    
    /**
     * Reset editor to initial state
     */
    resetImageEditor() {
        this.cropMode = false;
        this.resetFilters();
        this.hideCropUI();
        this.showImagePreview();
        
        // Reset form values
        const customRotation = document.getElementById('custom-rotation');
        if (customRotation) customRotation.value = '';
        
        // Reset to original image if available
        this.resetToOriginalImage();
    }
    
    /**
     * Reset to the original uncropped image
     */
    resetToOriginalImage() {
        if (this.currentMedia && this.currentMedia.original_file_url) {
            console.log('🔄 Resetting to original image');
            this.refreshImagePreview(this.currentMedia.original_file_url);
            
            // Reset dimensions to original
            if (this.currentMedia.original_width && this.currentMedia.original_height) {
                this.currentMedia.image_width = this.currentMedia.original_width;
                this.currentMedia.image_height = this.currentMedia.original_height;
                this.updateImageInfo(this.currentMedia);
            }
        }
    }
    
    /**
     * Initialize editor for current media
     */
    initializeImageEditor() {
        const previewImg = document.getElementById('preview-image');
        
        if (previewImg && this.currentMedia) {
            previewImg.onload = () => {
                console.log('🖼️ Image loaded for editing');
                console.log(`  - Natural size: ${previewImg.naturalWidth}x${previewImg.naturalHeight}`);
                console.log(`  - Expected size: ${this.currentMedia.image_width}x${this.currentMedia.image_height}`);
                console.log(`  - Current src: ${previewImg.src}`);
                
                this.originalImage = previewImg.cloneNode(true);
                
                // Check if dimensions match expected - if not, this might be a stretched image
                if (previewImg.naturalWidth !== this.currentMedia.image_width || 
                    previewImg.naturalHeight !== this.currentMedia.image_height) {
                    console.warn('⚠️ Image dimensions mismatch - possible stretching issue');
                    console.warn(`  Expected: ${this.currentMedia.image_width}x${this.currentMedia.image_height}`);
                    console.warn(`  Actual: ${previewImg.naturalWidth}x${previewImg.naturalHeight}`);
                }
            };
        }
    }
    
    // ========================
    // CROP FUNCTIONALITY
    // ========================
    
    /**
     * Toggle crop mode
     */
    toggleCropMode() {
        this.cropMode = !this.cropMode;
        
        if (this.cropMode) {
            this.enableCropMode();
        } else {
            this.disableCropMode();
        }
    }
    
    /**
     * Enable crop mode
     */
    enableCropMode() {
        console.log('✂️ Enabling crop mode');
        
        this.showCropCanvas();
        this.showCropUI();
        this.initializeCropTool();
    }
    
    /**
     * Disable crop mode
     */
    disableCropMode() {
        console.log('✂️ Disabling crop mode');
        
        this.hideCropUI();
        this.showImagePreview();
        this.destroyCropTool();
    }
    
    /**
     * Show crop UI elements
     */
    showCropUI() {
        const cropModeBtn = document.getElementById('crop-mode');
        const applyCropBtn = document.getElementById('apply-crop');
        const cancelCropBtn = document.getElementById('cancel-crop');
        const cropCoords = document.querySelector('.crop-coordinates');
        
        if (cropModeBtn) {
            cropModeBtn.textContent = '✂️ Crop Active';
            cropModeBtn.classList.replace('btn-outline-success', 'btn-success');
        }
        
        if (applyCropBtn) applyCropBtn.classList.remove('d-none');
        if (cancelCropBtn) cancelCropBtn.classList.remove('d-none');
        if (cropCoords) cropCoords.classList.remove('d-none');
    }
    
    /**
     * Hide crop UI elements
     */
    hideCropUI() {
        const cropModeBtn = document.getElementById('crop-mode');
        const applyCropBtn = document.getElementById('apply-crop');
        const cancelCropBtn = document.getElementById('cancel-crop');
        const cropCoords = document.querySelector('.crop-coordinates');
        
        if (cropModeBtn) {
            cropModeBtn.innerHTML = '<i class="fas fa-crop-alt me-1"></i>Enable Crop';
            cropModeBtn.classList.replace('btn-success', 'btn-outline-success');
        }
        
        if (applyCropBtn) applyCropBtn.classList.add('d-none');
        if (cancelCropBtn) cancelCropBtn.classList.add('d-none');
        if (cropCoords) cropCoords.classList.add('d-none');
    }
    
    /**
     * Show crop canvas
     */
    showCropCanvas() {
        const canvas = document.getElementById('crop-canvas');
        const previewImg = document.getElementById('preview-image');
        
        if (canvas && previewImg && previewImg.complete && previewImg.naturalWidth !== 0) {
            // Copy image to canvas
            const ctx = canvas.getContext('2d');
            canvas.width = previewImg.naturalWidth;
            canvas.height = previewImg.naturalHeight;
            
            // Scale canvas to fit container while maintaining aspect ratio
            const containerWidth = canvas.parentElement.clientWidth * 0.9;
            const containerHeight = canvas.parentElement.clientHeight * 0.9;
            const scale = Math.min(containerWidth / canvas.width, containerHeight / canvas.height);
            
            // Calculate actual display size maintaining aspect ratio
            const displayWidth = canvas.width * scale;
            const displayHeight = canvas.height * scale;
            
            canvas.style.width = displayWidth + 'px';
            canvas.style.height = displayHeight + 'px';
            canvas.style.objectFit = 'contain';
            
            // Draw the image to canvas - use natural dimensions
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(previewImg, 0, 0, canvas.width, canvas.height);
            
            console.log('🖼️ Canvas initialized:');
            console.log('  - Natural:', previewImg.naturalWidth, 'x', previewImg.naturalHeight);
            console.log('  - Canvas internal:', canvas.width, 'x', canvas.height);
            console.log('  - Display size:', displayWidth, 'x', displayHeight);
            console.log('  - Scale:', scale);
            
            canvas.classList.remove('d-none');
            previewImg.classList.add('d-none');
        } else {
            console.warn('⚠️ Cannot initialize crop canvas - image not ready');
            if (previewImg) {
                console.warn('  - Image complete:', previewImg.complete);
                console.warn('  - Natural dimensions:', previewImg.naturalWidth, 'x', previewImg.naturalHeight);
            }
        }
    }
    
    /**
     * Show image preview
     */
    showImagePreview() {
        const canvas = document.getElementById('crop-canvas');
        const previewImg = document.getElementById('preview-image');
        
        if (canvas) canvas.classList.add('d-none');
        if (previewImg) previewImg.classList.remove('d-none');
    }
    
    /**
     * Initialize crop tool on canvas
     */
    initializeCropTool() {
        const canvas = document.getElementById('crop-canvas');
        if (!canvas) return;
        
        this.cropTool = new CropTool(canvas, {
            onCropChange: (cropData) => this.updateCropCoordinates(cropData)
        });
        
        // Store the original image data for redrawing
        const previewImg = document.getElementById('preview-image');
        if (previewImg && this.cropTool) {
            this.cropTool.setOriginalImage(previewImg);
        }
    }
    
    /**
     * Destroy crop tool
     */
    destroyCropTool() {
        if (this.cropTool) {
            this.cropTool.destroy();
            this.cropTool = null;
        }
    }
    
    /**
     * Update crop coordinate inputs
     */
    updateCropCoordinates(cropData) {
        const inputs = ['crop-x', 'crop-y', 'crop-width', 'crop-height'];
        const values = [cropData.x, cropData.y, cropData.width, cropData.height];
        
        inputs.forEach((id, index) => {
            const input = document.getElementById(id);
            if (input) input.value = Math.round(values[index]);
        });
    }
    
    /**
     * Set aspect ratio for crop tool
     */
    setAspectRatio(ratio) {
        if (!this.cropTool) return;
        
        // Remove active state from all buttons
        document.querySelectorAll('[data-aspect]').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Add active state to clicked button
        event.target.classList.add('active');
        
        // Set aspect ratio on crop tool
        this.cropTool.setAspectRatio(ratio);
    }
    
    /**
     * Apply crop operation
     */
    async applyCrop() {
        if (!this.cropTool || !this.currentMedia) return;
        
        const cropData = this.cropTool.getCropData();
        if (!cropData) {
            this.showNotification('Please select an area to crop', 'warning');
            return;
        }
        
        // Debug: Log crop parameters
        console.log('🔍 Crop Debug Info:');
        console.log('Original image dimensions:', this.currentMedia.image_width, 'x', this.currentMedia.image_height);
        console.log('Crop coordinates:', cropData);
        console.log('Canvas dimensions:', document.getElementById('crop-canvas')?.width, 'x', document.getElementById('crop-canvas')?.height);
        
        try {
            this.showProcessing('Cropping image...');
            
            const response = await fetch(`/api/model-media-library/${this.mediaLibrary.modelSlug}/${this.currentMedia.id}/crop`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    x: cropData.x,
                    y: cropData.y,
                    width: cropData.width,
                    height: cropData.height,
                    output_format: document.getElementById('output-format')?.value || 'jpeg',
                    quality: document.getElementById('output-quality')?.value || null
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showNotification('Image cropped successfully!', 'success');
                this.refreshImagePreview(result.result.editedUrl);
                this.disableCropMode();
                
                // Update current media dimensions with the new values
                if (result.result.newDimensions) {
                    this.currentMedia.image_width = result.result.newDimensions.width;
                    this.currentMedia.image_height = result.result.newDimensions.height;
                    this.currentMedia.file_url = result.result.editedUrl;
                    this.updateImageInfo(this.currentMedia);
                    
                    // Force complete image refresh to prevent stretching
                    this.forceImageRefresh();
                }
            } else {
                this.showNotification(`Crop failed: ${result.error}`, 'error');
            }
            
        } catch (error) {
            console.error('✂️ Crop error:', error);
            this.showNotification('Crop operation failed', 'error');
        } finally {
            this.hideProcessing();
        }
    }
    
    /**
     * Cancel crop operation
     */
    cancelCrop() {
        this.disableCropMode();
    }
    
    // ========================
    // ROTATION FUNCTIONALITY
    // ========================
    
    /**
     * Rotate image by specified angle
     */
    async rotateImage(angle) {
        if (!this.currentMedia) return;
        
        try {
            this.showProcessing(`Rotating image ${angle}°...`);
            
            const response = await fetch(`/api/model-media-library/${this.mediaLibrary.modelSlug}/${this.currentMedia.id}/rotate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    angle: angle,
                    output_format: document.getElementById('output-format')?.value || 'jpeg',
                    quality: document.getElementById('output-quality')?.value || null
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showNotification(`Image rotated ${angle}° successfully!`, 'success');
                this.refreshImagePreview(result.result.editedUrl);
                this.updateImageDimensions(result.result.newDimensions);
            } else {
                this.showNotification(`Rotation failed: ${result.error}`, 'error');
            }
            
        } catch (error) {
            console.error('🔄 Rotation error:', error);
            this.showNotification('Rotation operation failed', 'error');
        } finally {
            this.hideProcessing();
        }
    }
    
    /**
     * Apply custom rotation angle
     */
    applyCustomRotation() {
        const customAngle = document.getElementById('custom-rotation');
        if (!customAngle || !customAngle.value) return;
        
        const angle = parseFloat(customAngle.value);
        if (isNaN(angle) || angle < -360 || angle > 360) {
            this.showNotification('Please enter a valid angle between -360 and 360', 'warning');
            return;
        }
        
        this.rotateImage(angle);
    }
    
    // ========================
    // RESIZE FUNCTIONALITY
    // ========================
    
    /**
     * Apply resize operation
     */
    async applyResize() {
        const widthInput = document.getElementById('resize-width');
        const heightInput = document.getElementById('resize-height');
        const fitSelect = document.getElementById('resize-fit');
        
        if (!widthInput || !heightInput || !this.currentMedia) return;
        
        const width = parseInt(widthInput.value);
        const height = parseInt(heightInput.value);
        
        if (!width || !height || width < 50 || height < 50 || width > 4000 || height > 4000) {
            this.showNotification('Please enter valid dimensions (50-4000 pixels)', 'warning');
            return;
        }
        
        try {
            this.showProcessing('Resizing image...');
            
            const response = await fetch(`/api/model-media-library/${this.mediaLibrary.modelSlug}/${this.currentMedia.id}/resize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    width: width,
                    height: height,
                    fit: fitSelect?.value || 'cover',
                    output_format: document.getElementById('output-format')?.value || 'jpeg',
                    quality: document.getElementById('output-quality')?.value || null
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showNotification('Image resized successfully!', 'success');
                this.refreshImagePreview(result.result.editedUrl);
                this.updateImageDimensions(result.result.newDimensions);
            } else {
                this.showNotification(`Resize failed: ${result.error}`, 'error');
            }
            
        } catch (error) {
            console.error('📏 Resize error:', error);
            this.showNotification('Resize operation failed', 'error');
        } finally {
            this.hideProcessing();
        }
    }
    
    // ========================
    // FILTER FUNCTIONALITY
    // ========================
    
    /**
     * Preview filters (client-side preview would go here)
     */
    previewFilters() {
        // Note: This would implement real-time filter preview using canvas
        // For now, we'll just update the UI
    }
    
    /**
     * Reset filters to defaults
     */
    resetFilters() {
        this.filters = {
            brightness: 1.0,
            contrast: 1.0,
            saturation: 1.0,
            blur: 0,
            sharpen: 0,
            gamma: 1.0
        };
        
        // Update UI
        Object.entries(this.filters).forEach(([filterName, value]) => {
            const slider = document.getElementById(`${filterName}-slider`);
            const valueDisplay = document.getElementById(`${filterName}-value`);
            
            if (slider) slider.value = value;
            if (valueDisplay) valueDisplay.textContent = value;
        });
    }
    
    /**
     * Apply filters to image
     */
    async applyFilters() {
        if (!this.currentMedia) return;
        
        try {
            this.showProcessing('Applying filters...');
            
            const response = await fetch(`/api/model-media-library/${this.mediaLibrary.modelSlug}/${this.currentMedia.id}/filter`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...this.filters,
                    output_format: document.getElementById('output-format')?.value || 'jpeg',
                    quality: document.getElementById('output-quality')?.value || null
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showNotification('Filters applied successfully!', 'success');
                this.refreshImagePreview(result.result.editedUrl);
            } else {
                this.showNotification(`Filter application failed: ${result.error}`, 'error');
            }
            
        } catch (error) {
            console.error('🎨 Filter error:', error);
            this.showNotification('Filter operation failed', 'error');
        } finally {
            this.hideProcessing();
        }
    }
    
    // ========================
    // EDIT HISTORY
    // ========================
    
    /**
     * Show edit history modal
     */
    async showEditHistory() {
        if (!this.currentMedia) return;
        
        try {
            const response = await fetch(`/api/model-media-library/${this.mediaLibrary.modelSlug}/${this.currentMedia.id}/history`);
            const result = await response.json();
            
            if (result.success) {
                this.renderEditHistory(result.history);
                const modal = new bootstrap.Modal(document.getElementById('edit-history-modal'));
                modal.show();
            } else {
                this.showNotification('Failed to load edit history', 'error');
            }
            
        } catch (error) {
            console.error('📚 History error:', error);
            this.showNotification('Failed to load edit history', 'error');
        }
    }
    
    /**
     * Render edit history
     */
    renderEditHistory(history) {
        const container = document.getElementById('edit-history-content');
        if (!container) return;
        
        if (history.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4 text-muted">
                    <i class="fas fa-history fa-3x mb-3"></i>
                    <h6>No Edit History</h6>
                    <p>No edits have been made to this image yet.</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = history.map(edit => `
            <div class="edit-history-item">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <span class="edit-history-operation">
                        <i class="fas fa-${this.getOperationIcon(edit.operation)} me-1"></i>
                        ${edit.operation}
                    </span>
                    <span class="edit-history-date">${new Date(edit.date).toLocaleString()}</span>
                </div>
                <div class="edit-history-params">
                    ${JSON.stringify(edit.parameters, null, 2)}
                </div>
            </div>
        `).join('');
    }
    
    // ========================
    // UTILITY METHODS
    // ========================
    
    /**
     * Refresh image preview with new URL
     */
    refreshImagePreview(newUrl) {
        const previewImg = document.getElementById('preview-image');
        if (previewImg) {
            // Force a complete reload by removing and re-adding the image
            previewImg.style.display = 'none';
            previewImg.onload = () => {
                previewImg.style.display = '';
                console.log(`🔄 Image refreshed: ${previewImg.naturalWidth}x${previewImg.naturalHeight}`);
            };
            previewImg.src = newUrl + '?t=' + Date.now(); // Cache bust
        }
    }
    
    /**
     * Force complete image refresh to prevent display issues
     */
    forceImageRefresh() {
        const previewImg = document.getElementById('preview-image');
        if (previewImg) {
            // Reset any inline styles that might cause stretching
            previewImg.style.width = '';
            previewImg.style.height = '';
            previewImg.style.maxWidth = '90%';
            previewImg.style.maxHeight = '90%';
            previewImg.style.objectFit = 'contain';
            
            // Force reflow
            previewImg.offsetHeight;
            
            console.log(`🔧 Forced image refresh - natural: ${previewImg.naturalWidth}x${previewImg.naturalHeight}`);
        }
    }

    /**
     * Update image dimensions in UI
     */
    updateImageDimensions(dimensions) {
        const dimensionDisplay = document.getElementById('image-dimensions');
        if (dimensionDisplay && dimensions) {
            dimensionDisplay.textContent = `${dimensions.width} × ${dimensions.height}`;
        }
    }
    
    /**
     * Show processing overlay
     */
    showProcessing(message = 'Processing...') {
        const overlay = document.getElementById('processing-overlay');
        const text = overlay?.querySelector('p');
        
        if (overlay) {
            if (text) text.textContent = message;
            overlay.classList.remove('d-none');
        }
    }
    
    /**
     * Hide processing overlay
     */
    hideProcessing() {
        const overlay = document.getElementById('processing-overlay');
        if (overlay) {
            overlay.classList.add('d-none');
        }
    }
    
    /**
     * Save and close editor
     */
    saveAndClose() {
        const modal = bootstrap.Modal.getInstance(document.getElementById('image-editor-modal'));
        if (modal) {
            modal.hide();
            // Refresh the media library
            this.mediaLibrary.loadMedia();
        }
    }
    
    /**
     * Get status color for badge
     */
    getStatusColor(status) {
        switch (status) {
            case 'approved': return 'success';
            case 'rejected': return 'danger';
            case 'pending': return 'warning';
            default: return 'secondary';
        }
    }
    
    /**
     * Get icon for operation type
     */
    getOperationIcon(operation) {
        switch (operation) {
            case 'crop': return 'crop-alt';
            case 'rotate': return 'redo-alt';
            case 'resize': return 'expand-arrows-alt';
            case 'filter': return 'magic';
            default: return 'edit';
        }
    }
    
    /**
     * Format file size
     */
    formatFileSize(bytes) {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
    
    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        if (this.mediaLibrary && this.mediaLibrary.showNotification) {
            this.mediaLibrary.showNotification(message, type);
        }
    }
}

/**
 * Simple Canvas Crop Tool
 * Implements basic crop selection functionality
 */
class CropTool {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.options = options;
        
        this.isDrawing = false;
        this.startX = 0;
        this.startY = 0;
        this.endX = 0;
        this.endY = 0;
        this.aspectRatio = null;
        this.originalImageData = null;
        
        this.init();
    }
    
    init() {
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        
        // Touch events for mobile
        this.canvas.addEventListener('touchstart', this.onTouchStart.bind(this));
        this.canvas.addEventListener('touchmove', this.onTouchMove.bind(this));
        this.canvas.addEventListener('touchend', this.onTouchEnd.bind(this));
    }
    
    onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.startX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
        this.startY = (e.clientY - rect.top) * (this.canvas.height / rect.height);
        this.isDrawing = true;
        console.log('🖱️ Mouse down:', this.startX, this.startY);
    }
    
    onMouseMove(e) {
        if (!this.isDrawing) return;
        
        const rect = this.canvas.getBoundingClientRect();
        this.endX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
        this.endY = (e.clientY - rect.top) * (this.canvas.height / rect.height);
        
        this.adjustForAspectRatio();
        this.redraw();
        console.log('🖱️ Mouse move - drawing selection:', this.startX, this.startY, 'to', this.endX, this.endY);
    }
    
    onMouseUp(e) {
        this.isDrawing = false;
        this.notifyCropChange();
    }
    
    onTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        this.onMouseDown(touch);
    }
    
    onTouchMove(e) {
        e.preventDefault();
        const touch = e.touches[0];
        this.onMouseMove(touch);
    }
    
    onTouchEnd(e) {
        e.preventDefault();
        this.onMouseUp();
    }
    
    adjustForAspectRatio() {
        if (!this.aspectRatio) return;
        
        const width = Math.abs(this.endX - this.startX);
        const height = Math.abs(this.endY - this.startY);
        
        if (width / height > this.aspectRatio) {
            // Width is too large, adjust it
            const newWidth = height * this.aspectRatio;
            if (this.endX > this.startX) {
                this.endX = this.startX + newWidth;
            } else {
                this.endX = this.startX - newWidth;
            }
        } else {
            // Height is too large, adjust it
            const newHeight = width / this.aspectRatio;
            if (this.endY > this.startY) {
                this.endY = this.startY + newHeight;
            } else {
                this.endY = this.startY - newHeight;
            }
        }
    }
    
    redraw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Redraw the original image from stored data or from image element
        if (this.originalImageData) {
            this.ctx.putImageData(this.originalImageData, 0, 0);
        } else {
            const img = document.getElementById('preview-image');
            if (img && img.complete && img.naturalWidth !== 0) {
                this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
            }
        }
        
        // Only draw selection if we have valid coordinates
        if (this.startX !== this.endX && this.startY !== this.endY) {
            // Draw crop selection
            this.ctx.strokeStyle = '#28a745';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.ctx.strokeRect(
                this.startX,
                this.startY,
                this.endX - this.startX,
                this.endY - this.startY
            );
            
            // Draw semi-transparent overlay
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            this.ctx.setLineDash([]);
            
            // Top
            this.ctx.fillRect(0, 0, this.canvas.width, this.startY);
            // Bottom
            this.ctx.fillRect(0, this.endY, this.canvas.width, this.canvas.height - this.endY);
            // Left
            this.ctx.fillRect(0, this.startY, this.startX, this.endY - this.startY);
            // Right
            this.ctx.fillRect(this.endX, this.startY, this.canvas.width - this.endX, this.endY - this.startY);
        }
    }
    
    setOriginalImage(imgElement) {
        if (imgElement && imgElement.complete && imgElement.naturalWidth !== 0) {
            // Store the image data for redrawing
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(imgElement, 0, 0, this.canvas.width, this.canvas.height);
            this.originalImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            console.log('🖼️ Original image data stored for crop tool');
        }
    }
    
    setAspectRatio(ratio) {
        if (ratio === 'free') {
            this.aspectRatio = null;
        } else {
            const [w, h] = ratio.split(':').map(Number);
            this.aspectRatio = w / h;
        }
    }
    
    getCropData() {
        if (this.startX === this.endX || this.startY === this.endY) return null;
        
        return {
            x: Math.min(this.startX, this.endX),
            y: Math.min(this.startY, this.endY),
            width: Math.abs(this.endX - this.startX),
            height: Math.abs(this.endY - this.startY)
        };
    }
    
    notifyCropChange() {
        if (this.options.onCropChange) {
            const cropData = this.getCropData();
            if (cropData) {
                this.options.onCropChange(cropData);
            }
        }
    }
    
    destroy() {
        // Remove event listeners
        this.canvas.removeEventListener('mousedown', this.onMouseDown);
        this.canvas.removeEventListener('mousemove', this.onMouseMove);
        this.canvas.removeEventListener('mouseup', this.onMouseUp);
        this.canvas.removeEventListener('touchstart', this.onTouchStart);
        this.canvas.removeEventListener('touchmove', this.onTouchMove);
        this.canvas.removeEventListener('touchend', this.onTouchEnd);
    }
}

// Initialize image editor when media library is ready
document.addEventListener('DOMContentLoaded', function() {
    // Wait for media library to be available
    setTimeout(() => {
        if (window.mediaLibrary) {
            const imageEditor = new phoenix4geImageEditor(window.mediaLibrary);
            
            // Extend media library with editor methods
            window.mediaLibrary.updateImageInfo = imageEditor.updateImageInfo.bind(imageEditor);
            window.mediaLibrary.resetImageEditor = imageEditor.resetImageEditor.bind(imageEditor);
            window.mediaLibrary.initializeImageEditor = imageEditor.initializeImageEditor.bind(imageEditor);
            
            console.log('🎨 phoenix4ge Image Editor ready');
        }
    }, 1000);
});