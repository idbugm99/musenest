/**
 * MuseNest Admin Dashboard - Gallery Management
 */

class GalleryManager {
    constructor() {
        this.images = [];
        this.sections = [];
        this.currentFilter = '';
        this.viewMode = 'grid';
        
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Upload button
        const uploadBtn = document.getElementById('uploadImageBtn');
        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => this.showUploadModal());
        }

        // Create section button
        const createSectionBtn = document.getElementById('createSectionBtn');
        if (createSectionBtn) {
            createSectionBtn.addEventListener('click', () => this.showCreateSectionModal());
        }

        // Filter and view controls
        const sectionFilter = document.getElementById('sectionFilter');
        if (sectionFilter) {
            sectionFilter.addEventListener('change', (e) => {
                this.currentFilter = e.target.value;
                this.renderImages();
            });
        }

        const gridViewBtn = document.getElementById('gridViewBtn');
        const listViewBtn = document.getElementById('listViewBtn');
        
        if (gridViewBtn) {
            gridViewBtn.addEventListener('click', () => this.switchView('grid'));
        }
        
        if (listViewBtn) {
            listViewBtn.addEventListener('click', () => this.switchView('list'));
        }
    }

    async loadGalleryData() {
        try {
            window.adminDashboard.showLoading(true);
            
            // Load sections and images in parallel
            const [sectionsResponse, imagesResponse] = await Promise.all([
                window.adminDashboard.apiRequest('/api/gallery/sections'),
                window.adminDashboard.apiRequest('/api/gallery/images')
            ]);

            if (sectionsResponse.success) {
                this.sections = sectionsResponse.sections;
                this.renderSections();
                this.updateSectionFilter();
            }

            if (imagesResponse.success) {
                this.images = imagesResponse.images;
                this.renderImages();
            }

        } catch (error) {
            console.error('Error loading gallery data:', error);
            window.adminDashboard.showNotification('Failed to load gallery data', 'error');
        } finally {
            window.adminDashboard.showLoading(false);
        }
    }

    renderSections() {
        const container = document.getElementById('gallerySections');
        if (!container) return;

        if (this.sections.length === 0) {
            container.innerHTML = `
                <div class="col-span-full text-center py-8 text-gray-500">
                    <i class="fas fa-folder-open text-4xl mb-4"></i>
                    <p>No gallery sections yet. Create your first section to organize images.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.sections.map(section => `
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div class="flex items-center justify-between mb-2">
                    <h4 class="font-semibold text-gray-900">${this.escapeHtml(section.title)}</h4>
                    <div class="flex space-x-2">
                        <button onclick="galleryManager.editSection(${section.id})" class="text-gray-500 hover:text-blue-600" title="Edit">
                            <i class="fas fa-edit text-sm"></i>
                        </button>
                        <button onclick="galleryManager.deleteSection(${section.id})" class="text-gray-500 hover:text-red-600" title="Delete">
                            <i class="fas fa-trash text-sm"></i>
                        </button>
                    </div>
                </div>
                <p class="text-sm text-gray-600 mb-3">${this.escapeHtml(section.description || '')}</p>
                <div class="flex items-center text-sm text-gray-500">
                    <i class="fas fa-images mr-1"></i>
                    <span>${section.image_count || 0} images</span>
                </div>
            </div>
        `).join('');
    }

    updateSectionFilter() {
        const filter = document.getElementById('sectionFilter');
        if (!filter) return;

        const currentValue = filter.value;
        filter.innerHTML = '<option value="">All Sections</option>';
        
        this.sections.forEach(section => {
            const option = document.createElement('option');
            option.value = section.id;
            option.textContent = section.title;
            if (section.id.toString() === currentValue) {
                option.selected = true;
            }
            filter.appendChild(option);
        });
    }

    renderImages() {
        const container = document.getElementById('imageGrid');
        if (!container) return;

        let filteredImages = this.images;
        
        if (this.currentFilter) {
            filteredImages = this.images.filter(img => 
                img.section_id && img.section_id.toString() === this.currentFilter
            );
        }

        if (filteredImages.length === 0) {
            container.innerHTML = `
                <div class="col-span-full text-center py-12 text-gray-500">
                    <i class="fas fa-images text-6xl mb-4"></i>
                    <p class="text-lg font-semibold mb-2">No images found</p>
                    <p>Upload your first image to get started</p>
                    <button onclick="galleryManager.showUploadModal()" class="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                        Upload Images
                    </button>
                </div>
            `;
            return;
        }

        if (this.viewMode === 'grid') {
            this.renderGridView(container, filteredImages);
        } else {
            this.renderListView(container, filteredImages);
        }
    }

    renderGridView(container, images) {
        container.className = 'grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4';
        container.innerHTML = images.map(image => `
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden group">
                <div class="aspect-w-1 aspect-h-1 relative">
                    <img src="/uploads/${window.adminDashboard.currentUser.slug}/${image.filename}" 
                         alt="${this.escapeHtml(image.alt_text || image.caption || '')}"
                         class="w-full h-48 object-cover">
                    <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <div class="flex space-x-2">
                            <button onclick="galleryManager.viewImage(${image.id})" class="bg-white text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-100" title="View">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button onclick="galleryManager.editImage(${image.id})" class="bg-white text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-100" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="galleryManager.deleteImage(${image.id})" class="bg-white text-red-600 px-3 py-1 rounded text-sm hover:bg-red-50" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="p-3">
                    <p class="text-sm font-medium text-gray-900 truncate">${this.escapeHtml(image.caption || 'Untitled')}</p>
                    <p class="text-xs text-gray-500 mt-1">${image.section_title || 'No section'}</p>
                    <p class="text-xs text-gray-400 mt-1">${window.adminDashboard.formatDate(image.created_at)}</p>
                </div>
            </div>
        `).join('');
    }

    renderListView(container, images) {
        container.className = 'space-y-4';
        container.innerHTML = images.map(image => `
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex items-center space-x-4">
                <img src="/uploads/${window.adminDashboard.currentUser.slug}/${image.filename}" 
                     alt="${this.escapeHtml(image.alt_text || image.caption || '')}"
                     class="w-16 h-16 object-cover rounded-lg">
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900 truncate">${this.escapeHtml(image.caption || 'Untitled')}</p>
                    <p class="text-sm text-gray-500">${image.section_title || 'No section'}</p>
                    <p class="text-xs text-gray-400">${window.adminDashboard.formatDate(image.created_at)}</p>
                </div>
                <div class="flex space-x-2">
                    <button onclick="galleryManager.viewImage(${image.id})" class="text-gray-500 hover:text-blue-600" title="View">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button onclick="galleryManager.editImage(${image.id})" class="text-gray-500 hover:text-blue-600" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="galleryManager.deleteImage(${image.id})" class="text-gray-500 hover:text-red-600" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    switchView(mode) {
        this.viewMode = mode;
        
        const gridBtn = document.getElementById('gridViewBtn');
        const listBtn = document.getElementById('listViewBtn');
        
        if (mode === 'grid') {
            gridBtn.classList.add('bg-blue-50', 'text-blue-600');
            gridBtn.classList.remove('text-gray-500');
            listBtn.classList.remove('bg-blue-50', 'text-blue-600');
            listBtn.classList.add('text-gray-500');
        } else {
            listBtn.classList.add('bg-blue-50', 'text-blue-600');
            listBtn.classList.remove('text-gray-500');
            gridBtn.classList.remove('bg-blue-50', 'text-blue-600');
            gridBtn.classList.add('text-gray-500');
        }
        
        this.renderImages();
    }

    showUploadModal() {
        const modal = this.createModal('Upload Images', `
            <form id="uploadForm" enctype="multipart/form-data">
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Select Images</label>
                    <div class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors" id="dropZone">
                        <input type="file" id="imageFiles" name="images" multiple accept="image/*" class="hidden">
                        <i class="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-4"></i>
                        <p class="text-gray-600 mb-2">Drop images here or click to browse</p>
                        <p class="text-sm text-gray-500">PNG, JPG, GIF, WebP up to 10MB each</p>
                    </div>
                    <div id="fileList" class="mt-4 space-y-2"></div>
                </div>
                
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Gallery Section</label>
                    <select id="uploadSection" class="w-full border border-gray-300 rounded-md px-3 py-2">
                        <option value="">No section</option>
                        ${this.sections.map(section => 
                            `<option value="${section.id}">${this.escapeHtml(section.title)}</option>`
                        ).join('')}
                    </select>
                </div>
                
                <div class="flex justify-end space-x-3">
                    <button type="button" onclick="this.closest('.modal-overlay').remove()" class="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
                    <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Upload Images</button>
                </div>
            </form>
        `);

        this.setupUploadForm(modal);
    }

    setupUploadForm(modal) {
        const dropZone = modal.querySelector('#dropZone');
        const fileInput = modal.querySelector('#imageFiles');
        const fileList = modal.querySelector('#fileList');
        const form = modal.querySelector('#uploadForm');

        // Click to browse
        dropZone.addEventListener('click', () => fileInput.click());

        // Drag and drop
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, this.preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.add('drag-over'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.remove('drag-over'), false);
        });

        dropZone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            fileInput.files = files;
            this.displaySelectedFiles(files, fileList);
        });

        // File selection
        fileInput.addEventListener('change', (e) => {
            this.displaySelectedFiles(e.target.files, fileList);
        });

        // Form submission
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.uploadImages(form, modal);
        });
    }

    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    displaySelectedFiles(files, container) {
        container.innerHTML = '';
        Array.from(files).forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'flex items-center justify-between p-2 bg-gray-50 rounded';
            fileItem.innerHTML = `
                <div class="flex items-center space-x-2">
                    <i class="fas fa-image text-blue-500"></i>
                    <span class="text-sm text-gray-700">${file.name}</span>
                    <span class="text-xs text-gray-500">(${window.adminDashboard.formatFileSize(file.size)})</span>
                </div>
            `;
            container.appendChild(fileItem);
        });
    }

    async uploadImages(form, modal) {
        const fileInput = form.querySelector('#imageFiles');
        const sectionSelect = form.querySelector('#uploadSection');
        
        if (!fileInput.files.length) {
            window.adminDashboard.showNotification('Please select at least one image', 'warning');
            return;
        }

        try {
            window.adminDashboard.showLoading(true);
            
            // Upload each file
            const uploadPromises = Array.from(fileInput.files).map(async (file) => {
                const formData = new FormData();
                formData.append('image', file);
                if (sectionSelect.value) {
                    formData.append('section_id', sectionSelect.value);
                }

                return window.adminDashboard.apiRequest('/api/gallery/upload', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${window.adminDashboard.authToken}`
                    },
                    body: formData
                });
            });

            const results = await Promise.all(uploadPromises);
            const successful = results.filter(r => r.success).length;
            
            if (successful > 0) {
                window.adminDashboard.showNotification(`Successfully uploaded ${successful} image(s)`, 'success');
                await this.loadGalleryData();
                modal.remove();
            } else {
                window.adminDashboard.showNotification('Failed to upload images', 'error');
            }

        } catch (error) {
            console.error('Upload error:', error);
            window.adminDashboard.showNotification('Upload failed', 'error');
        } finally {
            window.adminDashboard.showLoading(false);
        }
    }

    async editImage(imageId) {
        const image = this.images.find(img => img.id === imageId);
        if (!image) return;

        const modal = this.createModal('Edit Image', `
            <form id="editImageForm">
                <div class="mb-4">
                    <img src="/uploads/${window.adminDashboard.currentUser.slug}/${image.filename}" 
                         alt="${this.escapeHtml(image.alt_text || '')}"
                         class="w-full h-48 object-cover rounded-lg mb-4">
                </div>
                
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Caption</label>
                    <input type="text" id="imageCaption" value="${this.escapeHtml(image.caption || '')}" 
                           class="w-full border border-gray-300 rounded-md px-3 py-2">
                </div>
                
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Alt Text</label>
                    <input type="text" id="imageAltText" value="${this.escapeHtml(image.alt_text || '')}" 
                           class="w-full border border-gray-300 rounded-md px-3 py-2">
                </div>
                
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Gallery Section</label>
                    <select id="imageSection" class="w-full border border-gray-300 rounded-md px-3 py-2">
                        <option value="">No section</option>
                        ${this.sections.map(section => 
                            `<option value="${section.id}" ${section.id === image.section_id ? 'selected' : ''}>${this.escapeHtml(section.title)}</option>`
                        ).join('')}
                    </select>
                </div>
                
                <div class="mb-4">
                    <label class="flex items-center">
                        <input type="checkbox" id="isFeatured" ${image.is_featured ? 'checked' : ''} class="mr-2">
                        <span class="text-sm font-medium text-gray-700">Featured Image</span>
                    </label>
                </div>
                
                <div class="flex justify-end space-x-3">
                    <button type="button" onclick="this.closest('.modal-overlay').remove()" class="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
                    <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save Changes</button>
                </div>
            </form>
        `);

        const form = modal.querySelector('#editImageForm');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            try {
                window.adminDashboard.showLoading(true);
                
                const response = await window.adminDashboard.apiRequest(`/api/gallery/images/${imageId}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        caption: form.querySelector('#imageCaption').value,
                        alt_text: form.querySelector('#imageAltText').value,
                        section_id: form.querySelector('#imageSection').value || null,
                        is_featured: form.querySelector('#isFeatured').checked
                    })
                });

                if (response.success) {
                    window.adminDashboard.showNotification('Image updated successfully', 'success');
                    await this.loadGalleryData();
                    modal.remove();
                } else {
                    window.adminDashboard.showNotification('Failed to update image', 'error');
                }
            } catch (error) {
                console.error('Error updating image:', error);
                window.adminDashboard.showNotification('Failed to update image', 'error');
            } finally {
                window.adminDashboard.showLoading(false);
            }
        });
    }

    async deleteImage(imageId) {
        if (!confirm('Are you sure you want to delete this image? This action cannot be undone.')) {
            return;
        }

        try {
            window.adminDashboard.showLoading(true);
            
            const response = await window.adminDashboard.apiRequest(`/api/gallery/images/${imageId}`, {
                method: 'DELETE'
            });

            if (response.success) {
                window.adminDashboard.showNotification('Image deleted successfully', 'success');
                await this.loadGalleryData();
            } else {
                window.adminDashboard.showNotification('Failed to delete image', 'error');
            }
        } catch (error) {
            console.error('Error deleting image:', error);
            window.adminDashboard.showNotification('Failed to delete image', 'error');
        } finally {
            window.adminDashboard.showLoading(false);
        }
    }

    viewImage(imageId) {
        const image = this.images.find(img => img.id === imageId);
        if (!image) return;

        const modal = this.createModal('View Image', `
            <div class="text-center">
                <img src="/uploads/${window.adminDashboard.currentUser.slug}/${image.filename}" 
                     alt="${this.escapeHtml(image.alt_text || '')}"
                     class="max-w-full max-h-96 mx-auto rounded-lg">
                <div class="mt-4 text-left">
                    <p class="text-sm text-gray-600"><strong>Caption:</strong> ${this.escapeHtml(image.caption || 'None')}</p>
                    <p class="text-sm text-gray-600"><strong>Section:</strong> ${image.section_title || 'None'}</p>
                    <p class="text-sm text-gray-600"><strong>Created:</strong> ${window.adminDashboard.formatDate(image.created_at)}</p>
                    ${image.is_featured ? '<p class="text-sm text-blue-600"><i class="fas fa-star mr-1"></i>Featured Image</p>' : ''}
                </div>
                <div class="mt-6 flex justify-center space-x-3">
                    <button onclick="galleryManager.editImage(${image.id}); this.closest('.modal-overlay').remove();" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Edit</button>
                    <button onclick="this.closest('.modal-overlay').remove()" class="px-4 py-2 text-gray-600 hover:text-gray-800">Close</button>
                </div>
            </div>
        `);
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

// Initialize gallery manager
document.addEventListener('DOMContentLoaded', () => {
    window.galleryManager = new GalleryManager();
});