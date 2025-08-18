/**
 * Universal Gallery Admin JavaScript
 * Handles profile management and business type assignment
 * Master controller for gallery functionality across all business types
 */

class UniversalGalleryAdmin {
    constructor() {
        this.currentEditingProfile = null;
        this.profiles = [];
        this.businessTypes = [];
        this.assignmentMatrix = {};
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadProfiles();
        this.loadBusinessTypes();
        this.loadAssignmentMatrix();
    }

    bindEvents() {
        // Profile management events
        document.getElementById('createNewProfile')?.addEventListener('click', () => this.showProfileEditor());
        document.getElementById('cancelProfileEdit')?.addEventListener('click', () => this.hideProfileEditor());
        document.getElementById('resetProfileForm')?.addEventListener('click', () => this.resetProfileForm());
        document.getElementById('deleteProfile')?.addEventListener('click', () => this.deleteProfile());
        
        // Profile form submission
        document.getElementById('profileForm')?.addEventListener('submit', (e) => this.saveProfile(e));
        
        // Header action buttons
        document.getElementById('validateAllProfiles')?.addEventListener('click', () => this.validateAllProfiles());
        document.getElementById('exportProfiles')?.addEventListener('click', () => this.exportProfiles());
        
        // Business assignment events
        document.getElementById('saveAllAssignments')?.addEventListener('click', () => this.saveAllAssignments());
        
        // Tab switching events
        document.getElementById('assignment-tab')?.addEventListener('shown.bs.tab', () => this.refreshAssignmentMatrix());
        
        // Layout type change event to show/hide relevant fields
        document.getElementById('layoutType')?.addEventListener('change', (e) => this.updateFieldVisibility(e.target.value));
    }

    async loadProfiles() {
        try {
            const response = await fetch('/api/universal-gallery-profiles/profiles');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            this.profiles = await response.json();
            this.renderProfilesList();
        } catch (error) {
            console.error('Error loading profiles:', error);
            this.showToast('Error loading gallery profiles', 'error');
            this.renderProfilesError();
        }
    }

    async loadBusinessTypes() {
        try {
            const response = await fetch('/api/universal-gallery-profiles/business-types');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            this.businessTypes = await response.json();
        } catch (error) {
            console.error('Error loading business types:', error);
            this.showToast('Error loading business types', 'error');
        }
    }

    async loadAssignmentMatrix() {
        try {
            const response = await fetch('/api/universal-gallery-profiles/assignments');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            this.assignmentMatrix = await response.json();
            this.renderAssignmentMatrix();
        } catch (error) {
            console.error('Error loading assignment matrix:', error);
            this.showToast('Error loading assignment matrix', 'error');
        }
    }

    renderProfilesList() {
        const container = document.getElementById('profilesList');
        if (!container) return;

        if (!this.profiles || this.profiles.length === 0) {
            container.innerHTML = `
                <div class="text-center py-5">
                    <i class="fas fa-images fs-1 text-muted mb-3"></i>
                    <h5 class="text-muted">No Gallery Profiles Found</h5>
                    <p class="text-muted mb-3">Create your first gallery profile to get started</p>
                    <button class="btn btn-primary" onclick="universalGalleryAdmin.showProfileEditor()">
                        <i class="fas fa-plus me-2"></i>Create First Profile
                    </button>
                </div>
            `;
            return;
        }

        let html = '<div class="row g-3">';
        
        this.profiles.forEach(profile => {
            const isDefault = profile.is_system_default;
            const badgeClass = isDefault ? 'bg-warning text-dark' : 'bg-secondary';
            const cardClass = isDefault ? 'border-warning' : '';
            
            html += `
                <div class="col-md-6 col-lg-4">
                    <div class="card h-100 ${cardClass} shadow-sm">
                        <div class="card-header bg-light d-flex justify-content-between align-items-start">
                            <div>
                                <h6 class="card-title mb-1 fw-semibold">${this.escapeHtml(profile.profile_display_name)}</h6>
                                <small class="text-muted">${this.escapeHtml(profile.profile_name)}</small>
                            </div>
                            <div>
                                ${isDefault ? `<span class="badge ${badgeClass}">Default</span>` : ''}
                                <span class="badge bg-primary">${profile.layout_type}</span>
                            </div>
                        </div>
                        <div class="card-body">
                            <p class="card-text text-muted small mb-3">
                                ${profile.profile_description || 'No description'}
                            </p>
                            <div class="d-flex flex-wrap gap-1 mb-3">
                                <span class="badge bg-light text-dark">${profile.grid_columns_desktop} cols</span>
                                <span class="badge bg-light text-dark">${profile.images_per_page} per page</span>
                                <span class="badge bg-light text-dark">${profile.pagination_type}</span>
                                ${profile.lightbox_enabled ? '<span class="badge bg-light text-dark">Lightbox</span>' : ''}
                                ${profile.enable_search ? '<span class="badge bg-light text-dark">Search</span>' : ''}
                                ${profile.enable_sorting ? '<span class="badge bg-light text-dark">Sort</span>' : ''}
                            </div>
                        </div>
                        <div class="card-footer bg-transparent">
                            <div class="btn-group w-100" role="group">
                                <button class="btn btn-outline-primary btn-sm" onclick="universalGalleryAdmin.editProfile(${profile.id})">
                                    <i class="fas fa-edit me-1"></i>Edit
                                </button>
                                <button class="btn btn-outline-info btn-sm" onclick="universalGalleryAdmin.duplicateProfile(${profile.id})">
                                    <i class="fas fa-copy me-1"></i>Duplicate
                                </button>
                                ${!isDefault ? `
                                    <button class="btn btn-outline-danger btn-sm" onclick="universalGalleryAdmin.confirmDeleteProfile(${profile.id})">
                                        <i class="fas fa-trash me-1"></i>Delete
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
    }

    renderProfilesError() {
        const container = document.getElementById('profilesList');
        if (!container) return;

        container.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-exclamation-triangle fs-1 text-danger mb-3"></i>
                <h5 class="text-danger">Failed to Load Gallery Profiles</h5>
                <p class="text-muted mb-3">There was an error loading the gallery profiles</p>
                <button class="btn btn-outline-primary" onclick="universalGalleryAdmin.loadProfiles()">
                    <i class="fas fa-refresh me-2"></i>Try Again
                </button>
            </div>
        `;
    }

    renderAssignmentMatrix() {
        const container = document.getElementById('assignmentMatrix');
        if (!container) return;

        if (!this.businessTypes || this.businessTypes.length === 0 || !this.profiles || this.profiles.length === 0) {
            container.innerHTML = `
                <div class="text-center py-5">
                    <i class="fas fa-spinner fa-spin fs-1 text-muted mb-3"></i>
                    <h5 class="text-muted">Loading Assignment Matrix</h5>
                    <p class="text-muted">Preparing business type and profile data...</p>
                </div>
            `;
            return;
        }

        let html = `
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead class="table-light">
                        <tr>
                            <th class="fw-semibold">Business Type</th>
                            <th class="fw-semibold text-center">Assigned Profiles</th>
                            <th class="fw-semibold text-center">Default Profile</th>
                            <th class="fw-semibold text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        this.businessTypes.forEach(businessType => {
            const assignments = this.assignmentMatrix[businessType.id] || [];
            const defaultProfile = assignments.find(a => a.is_default_profile);
            
            html += `
                <tr>
                    <td>
                        <div class="d-flex align-items-center">
                            <div class="bg-primary bg-opacity-10 rounded-circle p-2 me-3">
                                <i class="fas fa-briefcase text-primary"></i>
                            </div>
                            <div>
                                <div class="fw-medium">${this.escapeHtml(businessType.display_name || businessType.name)}</div>
                                <small class="text-muted">${this.escapeHtml(businessType.name)}</small>
                            </div>
                        </div>
                    </td>
                    <td class="text-center">
                        <div class="d-flex flex-wrap justify-content-center gap-1">
                            ${assignments.map(assignment => {
                                const profile = this.profiles.find(p => p.id === assignment.gallery_profile_id);
                                return profile ? `
                                    <span class="badge ${assignment.is_default_profile ? 'bg-primary' : 'bg-secondary'}">
                                        ${this.escapeHtml(profile.profile_display_name)}
                                    </span>
                                ` : '';
                            }).join('')}
                            ${assignments.length === 0 ? '<span class="text-muted">No profiles assigned</span>' : ''}
                        </div>
                    </td>
                    <td class="text-center">
                        <select class="form-select form-select-sm" 
                                onchange="universalGalleryAdmin.updateDefaultProfile(${businessType.id}, this.value)"
                                style="width: auto; display: inline-block;">
                            <option value="">No default</option>
                            ${this.profiles.map(profile => `
                                <option value="${profile.id}" 
                                        ${defaultProfile && defaultProfile.gallery_profile_id === profile.id ? 'selected' : ''}>
                                    ${this.escapeHtml(profile.profile_display_name)}
                                </option>
                            `).join('')}
                        </select>
                    </td>
                    <td class="text-center">
                        <button class="btn btn-outline-primary btn-sm" 
                                onclick="universalGalleryAdmin.manageAssignments(${businessType.id}, '${this.escapeHtml(businessType.name)}')">
                            <i class="fas fa-cog me-1"></i>Manage
                        </button>
                    </td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;
    }

    showProfileEditor(profileId = null) {
        this.currentEditingProfile = profileId;
        const editor = document.getElementById('profileEditor');
        const title = document.getElementById('profileEditorTitle');
        const deleteBtn = document.getElementById('deleteProfile');
        
        if (profileId) {
            const profile = this.profiles.find(p => p.id === profileId);
            if (profile) {
                title.textContent = `Edit Profile: ${profile.profile_display_name}`;
                this.populateProfileForm(profile);
                deleteBtn.style.display = profile.is_system_default ? 'none' : 'inline-block';
            }
        } else {
            title.textContent = 'Create New Gallery Profile';
            this.resetProfileForm();
            deleteBtn.style.display = 'none';
        }
        
        editor.style.display = 'block';
        editor.scrollIntoView({ behavior: 'smooth' });
        
        // Initialize field visibility based on current layout type
        const layoutType = document.getElementById('layoutType')?.value;
        if (layoutType) {
            this.updateFieldVisibility(layoutType);
        }
    }

    hideProfileEditor() {
        const editor = document.getElementById('profileEditor');
        editor.style.display = 'none';
        this.currentEditingProfile = null;
        this.resetProfileForm();
    }

    updateFieldVisibility(layoutType) {
        console.log('🔄 Updating field visibility for layout:', layoutType);
        
        // Hide all layout-specific fields and sections first
        document.querySelectorAll('.grid-field, .masonry-field, .carousel-field, .lightbox-field').forEach(el => {
            el.style.display = 'none';
        });
        
        // Show fields relevant to selected layout type
        if (layoutType) {
            // Map layout types to CSS classes
            const layoutClasses = {
                'grid': ['grid-field'],
                'masonry': ['grid-field', 'masonry-field'], 
                'carousel': ['carousel-field'],
                'lightbox_grid': ['grid-field', 'lightbox-field']
            };
            
            const relevantClasses = layoutClasses[layoutType] || [];
            relevantClasses.forEach(className => {
                document.querySelectorAll(`.${className}`).forEach(el => {
                    el.style.display = 'block';
                });
            });
            
            console.log('✅ Showed classes:', relevantClasses);
        }
    }

    populateProfileForm(profile) {
        const form = document.getElementById('profileForm');
        if (!form) return;

        // Basic info
        form.profileId.value = profile.id || '';
        form.profileName.value = profile.profile_name || '';
        form.profileDisplayName.value = profile.profile_display_name || '';
        form.profileDescription.value = profile.profile_description || '';
        
        // Layout configuration
        form.layoutType.value = profile.layout_type || 'grid';
        form.imagesPerPage.value = profile.images_per_page || 20;
        form.gridColumnsDesktop.value = profile.grid_columns_desktop || 4;
        form.aspectRatio.value = profile.aspect_ratio || '4/3';
        
        // Lightbox behavior
        form.lightboxEnabled.checked = profile.lightbox_enabled !== false;
        form.lightboxFullscreen.checked = profile.lightbox_fullscreen !== false;
        form.lightboxZoom.checked = profile.lightbox_zoom !== false;
        form.lightboxAnimation.value = profile.lightbox_animation || 'fade';
        
        // Navigation & interaction
        form.paginationType.value = profile.pagination_type || 'pagination';
        form.enableSearch.checked = profile.enable_search === true;
        form.enableSorting.checked = profile.enable_sorting === true;
        form.enableFiltering.checked = profile.enable_filtering !== false;
        
        // Display features
        form.showCaptions.checked = profile.show_captions !== false;
        form.showImageInfo.checked = profile.show_image_info === true;
        form.keyboardNavigation.checked = profile.keyboard_navigation !== false;
        form.screenReaderSupport.checked = profile.screen_reader_support !== false;
        
        // Performance settings
        form.lazyLoadingEnabled.checked = profile.lazy_loading_enabled !== false;
        form.prefetchEnabled.checked = profile.prefetch_enabled !== false;
        form.prefetchStrategy.value = profile.prefetch_strategy || 'balanced';
        form.respectReducedMotion.checked = profile.respect_reduced_motion !== false;
        
        // Model customization permissions
        form.allowCarouselTimingOverride.checked = profile.allow_carousel_timing_override !== false;
        form.allowVisibleItemsOverride.checked = profile.allow_visible_items_override !== false;
        form.allowSectionVisibilityOverride.checked = profile.allow_section_visibility_override !== false;
        form.allowCaptionOverride.checked = profile.allow_caption_override !== false;
    }

    resetProfileForm() {
        const form = document.getElementById('profileForm');
        if (!form) return;
        
        form.reset();
        
        // Set default values
        form.layoutType.value = 'grid';
        form.imagesPerPage.value = 20;
        form.gridColumnsDesktop.value = 4;
        form.aspectRatio.value = '4/3';
        form.lightboxAnimation.value = 'fade';
        form.paginationType.value = 'pagination';
        form.prefetchStrategy.value = 'balanced';
        
        // Set default checkboxes
        form.lightboxEnabled.checked = true;
        form.lightboxFullscreen.checked = true;
        form.lightboxZoom.checked = true;
        form.enableFiltering.checked = true;
        form.showCaptions.checked = true;
        form.keyboardNavigation.checked = true;
        form.screenReaderSupport.checked = true;
        form.lazyLoadingEnabled.checked = true;
        form.prefetchEnabled.checked = true;
        form.respectReducedMotion.checked = true;
        form.allowCarouselTimingOverride.checked = true;
        form.allowVisibleItemsOverride.checked = true;
        form.allowSectionVisibilityOverride.checked = true;
        form.allowCaptionOverride.checked = true;
    }

    async saveProfile(event) {
        event.preventDefault();
        
        const form = event.target;
        const formData = new FormData(form);
        
        // Convert FormData to object
        const profileData = {};
        for (const [key, value] of formData.entries()) {
            if (form[key].type === 'checkbox') {
                profileData[key] = form[key].checked;
            } else if (form[key].type === 'number') {
                profileData[key] = parseInt(value) || 0;
            } else {
                profileData[key] = value;
            }
        }

        try {
            this.showLoading('Saving profile...');
            
            const url = this.currentEditingProfile 
                ? `/api/universal-gallery-profiles/profiles/${this.currentEditingProfile}`
                : '/api/universal-gallery-profiles/profiles';
            
            const method = this.currentEditingProfile ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(profileData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || `HTTP ${response.status}`);
            }

            const result = await response.json();
            
            this.showToast(`Profile ${this.currentEditingProfile ? 'updated' : 'created'} successfully`, 'success');
            this.hideProfileEditor();
            await this.loadProfiles();
            
        } catch (error) {
            console.error('Error saving profile:', error);
            this.showToast(`Error saving profile: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async editProfile(profileId) {
        this.showProfileEditor(profileId);
    }

    async duplicateProfile(profileId) {
        const profile = this.profiles.find(p => p.id === profileId);
        if (!profile) return;

        const newProfile = { ...profile };
        delete newProfile.id;
        newProfile.profile_name = `${profile.profile_name}_copy`;
        newProfile.profile_display_name = `${profile.profile_display_name} (Copy)`;
        newProfile.is_system_default = false;

        this.currentEditingProfile = null;
        this.showProfileEditor();
        this.populateProfileForm(newProfile);
    }

    async confirmDeleteProfile(profileId) {
        const profile = this.profiles.find(p => p.id === profileId);
        if (!profile) return;

        if (profile.is_system_default) {
            this.showToast('Cannot delete system default profiles', 'warning');
            return;
        }

        if (confirm(`Are you sure you want to delete the profile "${profile.profile_display_name}"?\n\nThis action cannot be undone and may affect assigned business types.`)) {
            await this.deleteProfileById(profileId);
        }
    }

    async deleteProfile() {
        if (!this.currentEditingProfile) return;
        await this.deleteProfileById(this.currentEditingProfile);
    }

    async deleteProfileById(profileId) {
        try {
            this.showLoading('Deleting profile...');
            
            const response = await fetch(`/api/universal-gallery-profiles/profiles/${profileId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || `HTTP ${response.status}`);
            }

            this.showToast('Profile deleted successfully', 'success');
            this.hideProfileEditor();
            await this.loadProfiles();
            await this.loadAssignmentMatrix(); // Refresh assignments
            
        } catch (error) {
            console.error('Error deleting profile:', error);
            this.showToast(`Error deleting profile: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async updateDefaultProfile(businessTypeId, profileId) {
        try {
            const response = await fetch('/api/universal-gallery-profiles/assignments/default', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    business_type_id: businessTypeId,
                    gallery_profile_id: profileId || null
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || `HTTP ${response.status}`);
            }

            this.showToast('Default profile updated', 'success');
            await this.loadAssignmentMatrix();
            
        } catch (error) {
            console.error('Error updating default profile:', error);
            this.showToast(`Error updating default profile: ${error.message}`, 'error');
        }
    }

    async manageAssignments(businessTypeId, businessTypeName) {
        const assignedProfiles = this.assignmentMatrix[businessTypeId] || [];
        
        let html = `
            <div class="modal fade" id="assignmentModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Manage Profiles for ${this.escapeHtml(businessTypeName)}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row g-3">
        `;

        this.profiles.forEach(profile => {
            const isAssigned = assignedProfiles.some(a => a.gallery_profile_id === profile.id);
            
            html += `
                <div class="col-md-6">
                    <div class="card ${isAssigned ? 'border-primary' : ''}">
                        <div class="card-body">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" 
                                       id="profile_${profile.id}" 
                                       ${isAssigned ? 'checked' : ''}
                                       onchange="universalGalleryAdmin.toggleProfileAssignment(${businessTypeId}, ${profile.id}, this.checked)">
                                <label class="form-check-label fw-medium" for="profile_${profile.id}">
                                    ${this.escapeHtml(profile.profile_display_name)}
                                </label>
                            </div>
                            <small class="text-muted">${profile.profile_description || 'No description'}</small>
                            <div class="mt-2">
                                <span class="badge bg-light text-dark">${profile.layout_type}</span>
                                <span class="badge bg-light text-dark">${profile.grid_columns_desktop} cols</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('assignmentModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add new modal to page
        document.body.insertAdjacentHTML('beforeend', html);
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('assignmentModal'));
        modal.show();
    }

    async toggleProfileAssignment(businessTypeId, profileId, isAssigned) {
        try {
            const response = await fetch('/api/universal-gallery-profiles/assignments/toggle', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    business_type_id: businessTypeId,
                    gallery_profile_id: profileId,
                    is_assigned: isAssigned
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || `HTTP ${response.status}`);
            }

            await this.loadAssignmentMatrix();
            
        } catch (error) {
            console.error('Error toggling assignment:', error);
            this.showToast(`Error updating assignment: ${error.message}`, 'error');
        }
    }

    async refreshAssignmentMatrix() {
        await this.loadAssignmentMatrix();
    }

    async saveAllAssignments() {
        this.showToast('All assignments are saved automatically', 'info');
    }

    async validateAllProfiles() {
        try {
            this.showLoading('Validating profiles...');
            
            const response = await fetch('/api/universal-gallery-profiles/profiles/validate', {
                method: 'POST'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || `HTTP ${response.status}`);
            }

            const result = await response.json();
            
            if (result.isValid) {
                this.showToast(`All ${result.profileCount} profiles are valid`, 'success');
            } else {
                this.showToast(`${result.errors.length} validation errors found`, 'warning');
                console.warn('Validation errors:', result.errors);
            }
            
        } catch (error) {
            console.error('Error validating profiles:', error);
            this.showToast(`Error validating profiles: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async exportProfiles() {
        try {
            this.showLoading('Exporting profiles...');
            
            const response = await fetch('/api/universal-gallery-profiles/profiles/export');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `gallery_profiles_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            this.showToast('Profiles exported successfully', 'success');
            
        } catch (error) {
            console.error('Error exporting profiles:', error);
            this.showToast(`Error exporting profiles: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }
    showLoading(message = 'Loading...') {
        const overlay = document.getElementById('loadingOverlay');
        const text = overlay.querySelector('.loading-text');
        if (text) text.textContent = message;
        overlay.style.display = 'flex';
    }

    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        overlay.style.display = 'none';
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toastId = 'toast_' + Date.now();
        const iconMap = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };

        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-bg-${type} border-0`;
        toast.id = toastId;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');
        
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    <i class="fas fa-${iconMap[type]} me-2"></i>
                    ${this.escapeHtml(message)}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;

        container.appendChild(toast);
        
        const bsToast = new bootstrap.Toast(toast, { delay: 5000 });
        bsToast.show();
        
        // Remove toast element after it's hidden
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
    }

    escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') return unsafe;
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

// Loading overlay styles
const loadingStyles = `
<style>
.loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
}

.loading-content {
    background: white;
    border-radius: 10px;
    padding: 2rem;
    text-align: center;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.spinner-border-lg {
    width: 3rem;
    height: 3rem;
}

.loading-text {
    color: #6c757d;
    font-weight: 500;
}
</style>
`;

// Add styles to page
document.head.insertAdjacentHTML('beforeend', loadingStyles);

// Initialize Universal Gallery Admin when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('universalGalleryAdmin')) {
        window.universalGalleryAdmin = new UniversalGalleryAdmin();
    }
});

// Also initialize if already loaded (for dynamic loading)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        if (document.getElementById('universalGalleryAdmin')) {
            window.universalGalleryAdmin = new UniversalGalleryAdmin();
        }
    });
} else {
    if (document.getElementById('universalGalleryAdmin')) {
        window.universalGalleryAdmin = new UniversalGalleryAdmin();
    }
}