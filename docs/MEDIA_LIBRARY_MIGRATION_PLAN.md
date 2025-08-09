# MuseNest Media Library & Gallery System Migration Plan

## Overview
This document outlines the comprehensive plan to recreate the RoseMastos media library and gallery sections functionality within MuseNest's {slug}/admin architecture, maintaining all existing capabilities while integrating with MuseNest's moderation API.

## Source System Analysis

### RoseMastos Image Library Features (from `/admin/image-library`)
- **Professional Image Upload System** with watermark application
- **Advanced Image Editing Tools**: Crop, rotate, resize, rename, format conversion
- **Batch Operations**: Multi-image selection and bulk actions
- **Image Management**: View, edit, manage, delete with hover overlay actions
- **File Organization**: Category-based organization with filtering
- **Real-time Processing**: Canvas-based crop tool with instant preview
- **Quality Control**: Multiple quality settings and optimization
- **Database Synchronization**: Automatic filename and metadata updates

### RoseMastos Gallery Sections Features (from `/admin/gallery/sections`)
- **Multiple Layout Types**: Grid, Masonry, Carousel, Lightbox Grid
- **Layout Configuration**: Custom settings per layout type
- **Section Management**: Create, edit, delete gallery sections
- **Advanced Settings**: 
  - Grid: columns, spacing, aspect ratios
  - Masonry: Pinterest-style flowing layout
  - Carousel: autoplay, transition effects, navigation
  - Lightbox: thumbnail sizes, overlay options
- **Bulk Operations**: Multi-section management
- **Auto-save Functionality**: Real-time configuration updates

## Target Implementation: MuseNest Architecture

### Integration Points
1. **Admin Route Structure**: `/{slug}/admin/media-library` and `/{slug}/admin/gallery-sections`
2. **API Integration**: MuseNest moderation API for all uploads
3. **Database Schema**: Model-specific media management tables
4. **Authentication**: Existing MuseNest authentication system
5. **Theme Integration**: Bootstrap 5.3 consistency with MuseNest design

---

## Phase 1: Database Schema & API Foundation

### 1.1 Database Tables Creation
```sql
-- Model Media Library Table
CREATE TABLE model_media_library (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_slug VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INT NOT NULL,
    image_width INT,
    image_height INT,
    mime_type VARCHAR(100) NOT NULL,
    category_id INT,
    watermark_applied TINYINT(1) DEFAULT 0,
    moderation_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    moderation_notes TEXT,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_deleted TINYINT(1) DEFAULT 0,
    INDEX idx_model_slug (model_slug),
    INDEX idx_category (category_id),
    INDEX idx_moderation (moderation_status)
);

-- Model Gallery Sections Table
CREATE TABLE model_gallery_sections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_slug VARCHAR(255) NOT NULL,
    section_name VARCHAR(255) NOT NULL,
    section_slug VARCHAR(255) NOT NULL,
    layout_type ENUM('grid', 'masonry', 'carousel', 'lightbox_grid') NOT NULL,
    layout_settings JSON,
    section_order INT DEFAULT 0,
    is_published TINYINT(1) DEFAULT 1,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_model_slug (model_slug),
    INDEX idx_published (is_published),
    UNIQUE KEY unique_section_slug (model_slug, section_slug)
);

-- Media Categories Table
CREATE TABLE model_media_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_slug VARCHAR(255) NOT NULL,
    category_name VARCHAR(255) NOT NULL,
    category_slug VARCHAR(255) NOT NULL,
    category_description TEXT,
    category_order INT DEFAULT 0,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_model_slug (model_slug),
    UNIQUE KEY unique_category_slug (model_slug, category_slug)
);

-- Gallery Section Media Assignments
CREATE TABLE model_gallery_section_media (
    id INT AUTO_INCREMENT PRIMARY KEY,
    section_id INT NOT NULL,
    media_id INT NOT NULL,
    display_order INT DEFAULT 0,
    custom_caption TEXT,
    is_featured TINYINT(1) DEFAULT 0,
    FOREIGN KEY (section_id) REFERENCES model_gallery_sections(id) ON DELETE CASCADE,
    FOREIGN KEY (media_id) REFERENCES model_media_library(id) ON DELETE CASCADE,
    INDEX idx_section (section_id),
    INDEX idx_media (media_id)
);
```

### 1.2 API Endpoints Structure
```javascript
// Media Library API Routes
/api/model-media-library/{slug}/
  GET    /                    // List all media with pagination/filtering
  POST   /upload             // Upload with watermark and moderation
  GET    /{id}              // Get specific media details
  PUT    /{id}              // Update media metadata
  DELETE /{id}              // Soft delete media
  
  // Image Editing Endpoints (from RoseMastos)
  POST   /{id}/crop         // Crop image with canvas coordinates
  POST   /{id}/rotate       // Rotate image (90°, 180°, 270°)
  POST   /{id}/resize       // Resize with aspect ratio preservation
  PUT    /{id}/rename       // Rename file with database sync
  GET    /{id}/info         // Get image metadata and EXIF

// Gallery Sections API Routes  
/api/model-gallery-sections/{slug}/
  GET    /                    // List all sections
  POST   /                    // Create new section
  GET    /{id}              // Get section details
  PUT    /{id}              // Update section
  DELETE /{id}              // Delete section
  POST   /{id}/media        // Add media to section
  DELETE /{id}/media/{mediaId} // Remove media from section
  PUT    /{id}/reorder      // Reorder media within section

// Categories API Routes
/api/model-media-categories/{slug}/
  GET    /                    // List categories
  POST   /                    // Create category
  PUT    /{id}              // Update category
  DELETE /{id}              // Delete category
```

---

## Phase 2: Backend Implementation

### 2.1 Media Upload Service with Moderation Integration
```javascript
// services/MediaUploadService.js
class MediaUploadService {
    async uploadWithModeration(modelSlug, files, options = {}) {
        const uploadResults = [];
        
        for (const file of files) {
            try {
                // 1. Apply watermark if requested
                const processedFile = options.applyWatermark ? 
                    await this.applyWatermark(file, modelSlug) : file;
                
                // 2. Save to temporary location
                const tempPath = await this.saveTemporary(processedFile);
                
                // 3. Submit to MuseNest moderation API
                const moderationResult = await this.submitForModeration(
                    tempPath, modelSlug, file.originalname
                );
                
                // 4. Create database record
                const mediaRecord = await this.createMediaRecord({
                    modelSlug,
                    filename: this.generateSecureFilename(file),
                    originalFilename: file.originalname,
                    tempPath,
                    moderationId: moderationResult.id,
                    watermarkApplied: options.applyWatermark || false
                });
                
                uploadResults.push(mediaRecord);
                
            } catch (error) {
                console.error(`Upload failed for ${file.originalname}:`, error);
                uploadResults.push({ error: error.message, file: file.originalname });
            }
        }
        
        return uploadResults;
    }
    
    async submitForModeration(filePath, modelSlug, originalName) {
        // Integration with existing MuseNest moderation API
        const formData = new FormData();
        formData.append('image', fs.createReadStream(filePath));
        formData.append('model_slug', modelSlug);
        formData.append('original_name', originalName);
        
        const response = await fetch('/api/moderation/submit', {
            method: 'POST',
            body: formData
        });
        
        return await response.json();
    }
}
```

### 2.2 Image Processing Service (from RoseMastos)
```javascript
// services/ImageProcessingService.js
const sharp = require('sharp'); // Using Sharp instead of Pillow for Node.js

class ImageProcessingService {
    async cropImage(filePath, cropData) {
        const { x, y, width, height } = cropData;
        
        const outputPath = this.generateCroppedFilename(filePath);
        
        await sharp(filePath)
            .extract({ left: x, top: y, width, height })
            .jpeg({ quality: 95 })
            .toFile(outputPath);
            
        return outputPath;
    }
    
    async rotateImage(filePath, degrees) {
        const outputPath = this.generateRotatedFilename(filePath);
        
        await sharp(filePath)
            .rotate(degrees)
            .jpeg({ quality: 95 })
            .toFile(outputPath);
            
        return outputPath;
    }
    
    async resizeImage(filePath, dimensions) {
        const { width, height, maintainAspect } = dimensions;
        const outputPath = this.generateResizedFilename(filePath);
        
        const resizeOptions = maintainAspect ? 
            { width, height, fit: 'inside', withoutEnlargement: true } :
            { width, height, fit: 'fill' };
        
        await sharp(filePath)
            .resize(resizeOptions)
            .jpeg({ quality: 95 })
            .toFile(outputPath);
            
        return outputPath;
    }
    
    async applyWatermark(filePath, watermarkPath) {
        const outputPath = this.generateWatermarkedFilename(filePath);
        
        await sharp(filePath)
            .composite([{
                input: watermarkPath,
                gravity: 'southeast',
                blend: 'over'
            }])
            .jpeg({ quality: 95 })
            .toFile(outputPath);
            
        return outputPath;
    }
}
```

---

## Phase 3: Frontend Components Development

### 3.1 Media Library Interface
```html
<!-- admin/components/media-library.html -->
<div class="media-library-container">
    <!-- Upload Section -->
    <div class="upload-section card shadow-sm mb-4">
        <div class="card-header bg-gradient-primary text-white">
            <h5><i class="fas fa-cloud-upload-alt me-2"></i>Media Upload</h5>
        </div>
        <div class="card-body">
            <div class="upload-dropzone" id="media-dropzone">
                <i class="fas fa-images fa-3x text-muted mb-3"></i>
                <p class="mb-3">Drop images here or click to browse</p>
                <input type="file" id="media-upload" multiple accept="image/*" hidden>
                <button type="button" class="btn btn-primary" onclick="document.getElementById('media-upload').click()">
                    Select Images
                </button>
            </div>
            
            <!-- Upload Options -->
            <div class="upload-options mt-4">
                <div class="row">
                    <div class="col-md-6">
                        <div class="form-check">
                            <input type="checkbox" class="form-check-input" id="apply-watermark" checked>
                            <label class="form-check-label" for="apply-watermark">
                                Apply watermark to uploaded images
                            </label>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <select class="form-select" id="upload-category">
                            <option value="">Select Category (Optional)</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <!-- Upload Progress -->
            <div class="upload-progress mt-3 d-none" id="upload-progress">
                <div class="progress">
                    <div class="progress-bar" role="progressbar"></div>
                </div>
                <div class="upload-status mt-2"></div>
            </div>
        </div>
    </div>
    
    <!-- Filters and Tools -->
    <div class="media-controls card shadow-sm mb-4">
        <div class="card-body">
            <div class="row align-items-center">
                <div class="col-md-4">
                    <div class="input-group">
                        <span class="input-group-text"><i class="fas fa-search"></i></span>
                        <input type="text" class="form-control" id="media-search" placeholder="Search media...">
                    </div>
                </div>
                <div class="col-md-3">
                    <select class="form-select" id="category-filter">
                        <option value="">All Categories</option>
                    </select>
                </div>
                <div class="col-md-3">
                    <select class="form-select" id="status-filter">
                        <option value="">All Status</option>
                        <option value="pending">Pending Moderation</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                    </select>
                </div>
                <div class="col-md-2">
                    <div class="btn-group w-100">
                        <button class="btn btn-outline-secondary" id="grid-view" title="Grid View">
                            <i class="fas fa-th"></i>
                        </button>
                        <button class="btn btn-outline-secondary" id="list-view" title="List View">
                            <i class="fas fa-list"></i>
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Batch Actions -->
            <div class="batch-actions mt-3 d-none" id="batch-actions">
                <div class="alert alert-info">
                    <span id="selected-count">0</span> images selected
                    <div class="btn-group float-end">
                        <button class="btn btn-sm btn-success" id="batch-approve">
                            <i class="fas fa-check me-1"></i>Approve
                        </button>
                        <button class="btn btn-sm btn-warning" id="batch-category">
                            <i class="fas fa-tag me-1"></i>Set Category
                        </button>
                        <button class="btn btn-sm btn-danger" id="batch-delete">
                            <i class="fas fa-trash me-1"></i>Delete
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <!-- Media Grid -->
    <div class="media-grid" id="media-grid">
        <!-- Dynamically populated media items -->
    </div>
    
    <!-- Pagination -->
    <div class="pagination-container mt-4" id="pagination-container">
        <!-- Pagination controls -->
    </div>
</div>
```

### 3.2 Advanced Image Editor Modal (from RoseMastos)
```html
<!-- Image Editor Modal -->
<div class="modal fade" id="image-editor-modal" tabindex="-1">
    <div class="modal-dialog modal-xl">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">
                    <i class="fas fa-edit me-2"></i>Advanced Image Editor
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
                <div class="row">
                    <!-- Image Preview -->
                    <div class="col-lg-8">
                        <div class="image-editor-preview">
                            <canvas id="crop-canvas" style="max-width: 100%;"></canvas>
                            <img id="preview-image" style="max-width: 100%;" class="d-none">
                        </div>
                    </div>
                    
                    <!-- Editor Tools -->
                    <div class="col-lg-4">
                        <div class="editor-tools">
                            <!-- Crop Tool -->
                            <div class="tool-section mb-4">
                                <h6><i class="fas fa-crop-alt me-2"></i>Crop Tool</h6>
                                <div class="btn-group w-100 mb-2">
                                    <button class="btn btn-outline-primary" id="crop-mode">
                                        <i class="fas fa-crop-alt"></i> Enable Crop
                                    </button>
                                    <button class="btn btn-success" id="apply-crop">
                                        <i class="fas fa-check"></i> Apply
                                    </button>
                                </div>
                                <div class="crop-presets">
                                    <button class="btn btn-sm btn-outline-secondary" data-aspect="1:1">1:1</button>
                                    <button class="btn btn-sm btn-outline-secondary" data-aspect="4:3">4:3</button>
                                    <button class="btn btn-sm btn-outline-secondary" data-aspect="16:9">16:9</button>
                                    <button class="btn btn-sm btn-outline-secondary" data-aspect="free">Free</button>
                                </div>
                            </div>
                            
                            <!-- Rotation Tool -->
                            <div class="tool-section mb-4">
                                <h6><i class="fas fa-redo-alt me-2"></i>Rotate</h6>
                                <div class="btn-group w-100">
                                    <button class="btn btn-outline-primary" data-rotation="90">90°</button>
                                    <button class="btn btn-outline-primary" data-rotation="180">180°</button>
                                    <button class="btn btn-outline-primary" data-rotation="270">270°</button>
                                </div>
                            </div>
                            
                            <!-- Resize Tool -->
                            <div class="tool-section mb-4">
                                <h6><i class="fas fa-expand-arrows-alt me-2"></i>Resize</h6>
                                <div class="mb-2">
                                    <label class="form-label">Width (px)</label>
                                    <input type="number" class="form-control" id="resize-width">
                                </div>
                                <div class="mb-2">
                                    <label class="form-label">Height (px)</label>
                                    <input type="number" class="form-control" id="resize-height">
                                </div>
                                <div class="form-check mb-2">
                                    <input type="checkbox" class="form-check-input" id="maintain-aspect" checked>
                                    <label class="form-check-label" for="maintain-aspect">
                                        Maintain aspect ratio
                                    </label>
                                </div>
                                <button class="btn btn-success w-100" id="apply-resize">
                                    Apply Resize
                                </button>
                            </div>
                            
                            <!-- Rename Tool -->
                            <div class="tool-section mb-4">
                                <h6><i class="fas fa-i-cursor me-2"></i>Rename File</h6>
                                <input type="text" class="form-control mb-2" id="new-filename" placeholder="New filename">
                                <button class="btn btn-warning w-100" id="apply-rename">
                                    Rename File
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                <button type="button" class="btn btn-primary" id="save-changes">Save All Changes</button>
            </div>
        </div>
    </div>
</div>
```

### 3.3 Gallery Sections Manager
```html
<!-- admin/components/gallery-sections.html -->
<div class="gallery-sections-container">
    <!-- Section Creation -->
    <div class="section-creator card shadow-sm mb-4">
        <div class="card-header bg-gradient-success text-white">
            <h5><i class="fas fa-plus-circle me-2"></i>Create Gallery Section</h5>
        </div>
        <div class="card-body">
            <div class="row">
                <div class="col-md-4">
                    <label class="form-label">Section Name</label>
                    <input type="text" class="form-control" id="new-section-name" placeholder="Portfolio Highlights">
                </div>
                <div class="col-md-4">
                    <label class="form-label">Layout Type</label>
                    <select class="form-select" id="new-section-layout">
                        <option value="grid">Grid Layout - Responsive columns with optional lightbox</option>
                        <option value="masonry">Masonry Layout - Pinterest-style flowing layout</option>
                        <option value="carousel">Carousel/Slideshow - Single image display with navigation</option>
                        <option value="lightbox_grid">Thumbnail Grid - Small thumbnails that open in lightbox</option>
                    </select>
                </div>
                <div class="col-md-4">
                    <label class="form-label">&nbsp;</label>
                    <button class="btn btn-success w-100" id="create-section">
                        <i class="fas fa-plus me-1"></i>Create Section
                    </button>
                </div>
            </div>
            
            <!-- Layout-specific options -->
            <div class="layout-options mt-3" id="layout-options">
                <!-- Dynamically populated based on selected layout -->
            </div>
        </div>
    </div>
    
    <!-- Existing Sections -->
    <div class="sections-list" id="sections-list">
        <!-- Dynamically populated sections -->
    </div>
</div>
```

---

## Phase 4: JavaScript Functionality Implementation

### 4.1 Media Library JavaScript (Enhanced from RoseMastos)
```javascript
// admin/js/media-library.js
class MuseNestMediaLibrary {
    constructor(modelSlug) {
        this.modelSlug = modelSlug;
        this.selectedMedia = new Set();
        this.currentPage = 1;
        this.itemsPerPage = 24;
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.loadMedia();
        this.loadCategories();
    }
    
    bindEvents() {
        // Upload functionality
        document.getElementById('media-upload').addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files);
        });
        
        // Drag and drop
        const dropzone = document.getElementById('media-dropzone');
        dropzone.addEventListener('dragover', (e) => e.preventDefault());
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.handleFileUpload(e.dataTransfer.files);
        });
        
        // Search and filter
        document.getElementById('media-search').addEventListener('input', 
            this.debounce(() => this.loadMedia(), 500));
        document.getElementById('category-filter').addEventListener('change', () => this.loadMedia());
        document.getElementById('status-filter').addEventListener('change', () => this.loadMedia());
        
        // Batch actions
        document.getElementById('batch-approve').addEventListener('click', () => this.batchApprove());
        document.getElementById('batch-delete').addEventListener('click', () => this.batchDelete());
    }
    
    async handleFileUpload(files) {
        const formData = new FormData();
        const applyWatermark = document.getElementById('apply-watermark').checked;
        const category = document.getElementById('upload-category').value;
        
        Array.from(files).forEach(file => {
            formData.append('files', file);
        });
        
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
                this.showUploadSuccess(result.uploaded.length);
                this.loadMedia(); // Refresh the grid
            } else {
                this.showUploadError(result.message);
            }
            
        } catch (error) {
            console.error('Upload error:', error);
            this.showUploadError('Upload failed. Please try again.');
        } finally {
            this.hideUploadProgress();
        }
    }
    
    async loadMedia() {
        const params = new URLSearchParams({
            page: this.currentPage,
            limit: this.itemsPerPage,
            search: document.getElementById('media-search').value,
            category: document.getElementById('category-filter').value,
            status: document.getElementById('status-filter').value
        });
        
        try {
            const response = await fetch(`/api/model-media-library/${this.modelSlug}?${params}`);
            const data = await response.json();
            
            if (data.success) {
                this.renderMediaGrid(data.media);
                this.renderPagination(data.pagination);
            }
        } catch (error) {
            console.error('Error loading media:', error);
        }
    }
    
    renderMediaGrid(media) {
        const grid = document.getElementById('media-grid');
        
        grid.innerHTML = media.map(item => `
            <div class="media-item" data-id="${item.id}">
                <div class="media-card">
                    <div class="media-preview">
                        <img src="${item.thumbnail_url}" alt="${item.original_filename}" loading="lazy">
                        <div class="media-overlay">
                            <div class="media-actions">
                                <button class="btn btn-sm btn-primary" onclick="mediaLibrary.viewImage(${item.id})" title="View">
                                    <i class="fas fa-eye"></i>
                                </button>
                                <button class="btn btn-sm btn-success" onclick="mediaLibrary.editImage(${item.id})" title="Edit">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-sm btn-warning" onclick="mediaLibrary.renameImage(${item.id})" title="Rename">
                                    <i class="fas fa-i-cursor"></i>
                                </button>
                                <button class="btn btn-sm btn-info" onclick="mediaLibrary.manageImage(${item.id})" title="Manage">
                                    <i class="fas fa-cog"></i>
                                </button>
                                <button class="btn btn-sm btn-danger" onclick="mediaLibrary.deleteImage(${item.id})" title="Delete">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                            <div class="media-checkbox">
                                <input type="checkbox" data-media-id="${item.id}" onchange="mediaLibrary.toggleSelection(${item.id})">
                            </div>
                        </div>
                        <div class="moderation-status status-${item.moderation_status}">
                            ${item.moderation_status}
                        </div>
                    </div>
                    <div class="media-info">
                        <div class="media-filename" title="${item.original_filename}">${item.original_filename}</div>
                        <div class="media-meta">
                            <span>${item.image_width} × ${item.image_height}</span>
                            <span>${this.formatFileSize(item.file_size)}</span>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    // Image editing methods (adapted from RoseMastos)
    async editImage(mediaId) {
        try {
            const response = await fetch(`/api/model-media-library/${this.modelSlug}/${mediaId}`);
            const data = await response.json();
            
            if (data.success) {
                this.openImageEditor(data.media);
            }
        } catch (error) {
            console.error('Error loading image for editing:', error);
        }
    }
    
    openImageEditor(mediaData) {
        // Load image into the advanced editor modal
        const modal = new bootstrap.Modal(document.getElementById('image-editor-modal'));
        const canvas = document.getElementById('crop-canvas');
        const ctx = canvas.getContext('2d');
        
        // Initialize the crop canvas (adapted from RoseMastos crop functionality)
        this.initializeCropCanvas(canvas, mediaData.file_url);
        
        modal.show();
    }
    
    // Additional methods for crop, rotate, resize functionality...
    // (Implementation details similar to RoseMastos but adapted for MuseNest)
}
```

---

## Phase 5: Integration & Testing

### 5.1 Route Registration
```javascript
// routes/admin.js - Add new routes for media library
router.get('/:slug/admin/media-library', requireAuth, (req, res) => {
    res.render('admin/pages/media-library', {
        pageTitle: 'Media Library',
        modelSlug: req.params.slug
    });
});

router.get('/:slug/admin/gallery-sections', requireAuth, (req, res) => {
    res.render('admin/pages/gallery-sections', {
        pageTitle: 'Gallery Sections',
        modelSlug: req.params.slug
    });
});
```

### 5.2 Handlebars Templates
```handlebars
{{!-- themes/admin/pages/media-library.handlebars --}}
<div class="admin-page-wrapper">
    <div class="page-header">
        <h1><i class="fas fa-images me-2"></i>Media Library</h1>
        <p class="text-muted">Manage your images with advanced editing tools</p>
    </div>
    
    {{{renderComponent 'media-library'}}}
    {{{renderComponent 'image-editor-modal'}}}
</div>

{{!-- themes/admin/pages/gallery-sections.handlebars --}}
<div class="admin-page-wrapper">
    <div class="page-header">
        <h1><i class="fas fa-layer-group me-2"></i>Gallery Sections</h1>
        <p class="text-muted">Create and manage gallery layouts</p>
    </div>
    
    {{{renderComponent 'gallery-sections'}}}
</div>
```

---

## Phase 6: Advanced Features Implementation

### 6.1 Watermark Service Integration
```javascript
// services/WatermarkService.js
class WatermarkService {
    constructor() {
        this.watermarkPath = path.join(__dirname, '../assets/watermarks/');
    }
    
    async applyModelWatermark(imagePath, modelSlug) {
        // Check for model-specific watermark first
        const modelWatermark = path.join(this.watermarkPath, `${modelSlug}.png`);
        const defaultWatermark = path.join(this.watermarkPath, 'default.png');
        
        const watermarkFile = fs.existsSync(modelWatermark) ? 
            modelWatermark : defaultWatermark;
        
        if (!fs.existsSync(watermarkFile)) {
            throw new Error('Watermark file not found');
        }
        
        const outputPath = this.generateWatermarkedPath(imagePath);
        
        await sharp(imagePath)
            .composite([{
                input: watermarkFile,
                gravity: 'southeast',
                blend: 'over'
            }])
            .jpeg({ quality: 95 })
            .toFile(outputPath);
            
        return outputPath;
    }
}
```

### 6.2 Moderation API Integration Enhancement
```javascript
// services/ModerationIntegration.js
class ModerationIntegration {
    async submitBatch(mediaItems) {
        const results = [];
        
        for (const item of mediaItems) {
            try {
                const result = await this.submitSingle(item);
                results.push({ mediaId: item.id, result });
            } catch (error) {
                results.push({ mediaId: item.id, error: error.message });
            }
        }
        
        return results;
    }
    
    async handleModerationCallback(moderationId, status, notes) {
        // Update media record based on moderation result
        await db.query(`
            UPDATE model_media_library 
            SET moderation_status = ?, moderation_notes = ?
            WHERE moderation_id = ?
        `, [status, notes, moderationId]);
        
        // If approved, move from temp to permanent location
        if (status === 'approved') {
            await this.moveToPermamentStorage(moderationId);
        }
    }
}
```

---

## Implementation Timeline

### Week 1: Foundation
- [ ] Database schema creation and migration
- [ ] Basic API endpoint structure
- [ ] Authentication integration

### Week 2: Backend Core
- [ ] Media upload service with moderation
- [ ] Image processing service (crop, rotate, resize)
- [ ] Watermark integration
- [ ] Basic CRUD operations

### Week 3: Frontend Core  
- [ ] Media library interface
- [ ] Upload functionality with progress
- [ ] Basic grid view and filtering
- [ ] Image preview and basic editing

### Week 4: Advanced Features
- [ ] Advanced image editor modal (crop canvas)
- [ ] Gallery sections management
- [ ] Batch operations
- [ ] Layout configuration system

### Week 5: Gallery Layouts
- [ ] Grid layout implementation
- [ ] Masonry layout system
- [ ] Carousel functionality  
- [ ] Lightbox grid system

### Week 6: Integration & Polish
- [ ] Template integration
- [ ] Route registration
- [ ] Cross-browser testing
- [ ] Performance optimization

### Week 7: Testing & Documentation
- [ ] Unit testing for services
- [ ] Integration testing
- [ ] User acceptance testing
- [ ] Documentation completion

---

## Technical Considerations

### Performance Optimization
1. **Image Thumbnails**: Generate multiple sizes for different use cases
2. **Lazy Loading**: Implement intersection observer for large galleries
3. **Caching**: Redis caching for frequently accessed media metadata
4. **CDN Integration**: Optional CDN support for media delivery

### Security Measures
1. **File Validation**: Strict MIME type and file extension validation
2. **Size Limits**: Configurable upload size limits per model
3. **Path Security**: Prevent directory traversal attacks
4. **Authentication**: Model-specific access control

### Scalability Planning
1. **Database Indexing**: Proper indexes for search and filtering
2. **Storage Strategy**: Support for both local and cloud storage
3. **Pagination**: Efficient pagination for large media collections
4. **Background Processing**: Queue-based image processing for large files

---

## Success Criteria

### Functional Requirements
- [ ] Upload images with watermark application
- [ ] Advanced image editing (crop, rotate, resize, rename)
- [ ] Multiple gallery layout types (grid, masonry, carousel, lightbox)
- [ ] Batch operations for media management
- [ ] Integration with MuseNest moderation API
- [ ] Category-based organization
- [ ] Search and filtering capabilities

### Performance Requirements  
- [ ] Handle 1000+ images per model efficiently
- [ ] Image processing under 5 seconds for standard operations
- [ ] Page load time under 3 seconds for media library
- [ ] Responsive design for mobile devices

### Security Requirements
- [ ] Model-specific access control
- [ ] Secure file upload validation
- [ ] Protection against malicious files
- [ ] Audit trail for all operations

---

*This migration plan ensures complete feature parity with RoseMastos while integrating seamlessly with MuseNest's existing architecture and moderation system.*