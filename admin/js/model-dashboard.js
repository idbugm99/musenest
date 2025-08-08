/**
 * Model Dashboard JavaScript - Phase 3 Frontend Components
 * Handles model-centric view for Blurred/Approved Images
 * Created: August 7, 2025
 */

if (window.ComponentRegistryClient) {
    window.ComponentRegistryClient.register('model-dashboard', 'admin/js/model-dashboard.js');
}

class ModelDashboard {
    constructor() {
        this.currentPage = 1;
        this.itemsPerPage = 20;
        this.currentSearch = '';
        this.currentSort = 'newest';
        this.currentFilter = 'all';
        this.models = [];
        this.pagination = {};
        this.isLoading = false;
        
        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        console.log('🚀 Initializing Model Dashboard');
        this.setupEventListeners();
        this.loadModels();
    }

    setupEventListeners() {
        // Search input with debouncing
        const searchInput = document.getElementById('modelSearchInput');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.currentSearch = e.target.value.trim();
                    this.currentPage = 1;
                    this.loadModels();
                }, 300);
            });
        }

        // Sort dropdown
        const sortSelect = document.getElementById('modelSortSelect');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.currentSort = e.target.value;
                this.currentPage = 1;
                this.loadModels();
            });
        }

        // Filter dropdown
        const filterSelect = document.getElementById('modelFilterSelect');
        if (filterSelect) {
            filterSelect.addEventListener('change', (e) => {
                this.currentFilter = e.target.value;
                this.currentPage = 1;
                this.loadModels();
            });
        }

        // Pagination buttons
        this.setupPaginationListeners();

        // Retry button
        const retryBtn = document.getElementById('retryLoadModels');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => this.loadModels());
        }

        // Modal close functionality
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-backdrop') || e.target.classList.contains('close-modal-btn') || e.target.closest('.close-modal-btn')) {
                this.closeModal();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
    }

    setupPaginationListeners() {
        // Previous/Next buttons
        ['prevPage', 'nextPage', 'prevPageMobile', 'nextPageMobile'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', () => {
                    const isPrev = id.includes('prev');
                    if (isPrev && this.currentPage > 1) {
                        this.currentPage--;
                        this.loadModels();
                    } else if (!isPrev && this.pagination.has_next) {
                        this.currentPage++;
                        this.loadModels();
                    }
                });
            }
        });
    }

    async loadModels() {
        if (this.isLoading) return;

        console.log('📊 Loading models...', {
            page: this.currentPage,
            search: this.currentSearch,
            sort: this.currentSort,
            filter: this.currentFilter
        });

        this.isLoading = true;
        this.showLoadingState();

        try {
            // Build query parameters
            const params = new URLSearchParams({
                page: this.currentPage,
                limit: this.itemsPerPage,
                sort: this.currentSort,
                filter: this.currentFilter
            });

            if (this.currentSearch) {
                params.append('search', this.currentSearch);
            }

            // Fetch models from API
            const response = await sysFetch(`/api/model-dashboard/models?${params}`, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to load models');
            }

            // Adapt to standardized envelope shape if present
            const payload = data.data || data;
            this.models = payload.models || [];
            this.pagination = payload.pagination || {};

            // Update UI
            this.renderModels();
            this.updateSummaryStats();
            this.updatePagination();
            this.showSuccessState();

            console.log('✅ Models loaded successfully', {
                count: this.models.length,
                total: this.pagination.total_models
            });

        } catch (error) {
            console.error('❌ Error loading models:', error);
            this.showErrorState(error.message);
        } finally {
            this.isLoading = false;
        }
    }

    renderModels() {
        const container = document.getElementById('modelCardsGrid');
        const template = document.getElementById('modelCardTemplate');
        
        if (!container || !template) {
            console.error('Model container or template not found');
            return;
        }

        // Clear existing cards
        container.innerHTML = '';

        if (this.models.length === 0) {
            this.showEmptyState();
            return;
        }

        // Create model cards
        this.models.forEach(model => {
            const card = this.createModelCard(model, template);
            container.appendChild(card);
        });
    }

    createModelCard(model, template) {
        const cardElement = template.content.cloneNode(true);
        const card = cardElement.querySelector('.model-card');

        // Set model data
        card.setAttribute('data-model-id', model.id);

        // Model profile image
        const profileImg = card.querySelector('.model-profile-image');
        // Gracefully handle missing profile images
        profileImg.src = model.profile_image_url || '/assets/default-avatar.png';
        profileImg.onerror = function() { this.onerror = null; this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCI+PHNpcmNsZSBjeD0iMzIiIGN5PSIyMiIgcj0iMTIiIGZpbGw9IiNFNUU5RUIiLz48cmVjdCB4PSIxNiIgeT0iMzgiIHdpZHRoPSIyOCIgaGVpZ2h0PSIxNiIgZmlsbD0iI0VFRiIvPjwvc3ZnPg=='; };
        profileImg.alt = `${model.name} profile`;

        // Model name and info
        card.querySelector('.model-name').textContent = model.display_name || model.name;
        card.querySelector('.model-status').textContent = model.status;
        card.querySelector('.model-type').textContent = this.getModelTypeDisplay(model);

        // Activity status
        this.updateActivityBadge(card, model);

        // Last activity
        this.updateLastActivity(card, model);

        // Statistics
        this.updateModelStatistics(card, model);

        // Violation metrics
        this.updateViolationMetrics(card, model);

        // Priority indicator
        this.updatePriorityIndicator(card, model);

        // Event listeners
        this.attachCardEventListeners(card, model);

        return cardElement;
    }

    updateActivityBadge(card, model) {
        const badge = card.querySelector('.activity-badge');
        const dot = card.querySelector('.activity-dot');
        const text = card.querySelector('.activity-text');

        // Remove existing classes
        badge.classList.remove('active', 'recent', 'inactive');
        
        // Add appropriate class and content
        badge.classList.add(model.activity_status);
        text.textContent = model.activity_status.charAt(0).toUpperCase() + model.activity_status.slice(1);
    }

    updateLastActivity(card, model) {
        const lastActivityElement = card.querySelector('.last-activity');
        
        if (model.last_upload_date) {
            const date = new Date(model.last_upload_date);
            const timeAgo = this.getTimeAgo(date);
            lastActivityElement.textContent = `Last upload: ${timeAgo}`;
        } else {
            lastActivityElement.textContent = 'Last upload: Never';
        }
    }

    updateModelStatistics(card, model) {
        // Media counts
        card.querySelector('.total-media').textContent = model.total_media_count || 0;
        card.querySelector('.pending-count').textContent = model.pending_review_count || 0;
        card.querySelector('.approved-count').textContent = model.approved_count || 0;
        card.querySelector('.blurred-count').textContent = model.approved_blurred_count || 0;
        card.querySelector('.rejected-count').textContent = model.rejected_count || 0;

        // Update pending count color based on priority
        const pendingElement = card.querySelector('.pending-count');
        if (model.pending_priority === 'high') {
            pendingElement.classList.add('text-danger');
        } else if (model.pending_priority === 'medium') {
            pendingElement.classList.add('text-warning');
        }
    }

    updateViolationMetrics(card, model) {
        const violationsCount = card.querySelector('.violations-count');
        const severityBar = card.querySelector('.severity-level');
        const avgSeverity = card.querySelector('.avg-severity');
        const trendIcon = card.querySelector('.violation-trend-icon');

        // Violations count
        const violations = model.violations_30d || 0;
        violationsCount.textContent = violations;
        
        if (violations > 0) {
            violationsCount.className += ' text-danger fw-semibold';
        } else {
            violationsCount.className += ' text-success';
        }

        // Severity bar
        const severity = parseFloat(model.avg_severity_score) || 0;
        const severityPercent = Math.min((severity / 10) * 100, 100); // Assume 10 is max severity
        severityBar.style.width = `${severityPercent}%`;
        
        // Severity color
        severityBar.classList.remove('bg-secondary');
        if (severity >= 7) {
            severityBar.classList.add('bg-danger');
        } else if (severity >= 4) {
            severityBar.classList.add('bg-warning');
        } else {
            severityBar.classList.add('bg-success');
        }

        avgSeverity.textContent = severity.toFixed(1);

        // Trend icon
        if (model.violation_trend) {
            trendIcon.classList.add(model.violation_trend);
        }
    }

    updatePriorityIndicator(card, model) {
        const indicator = card.querySelector('.priority-indicator');
        
        if (model.pending_priority === 'high' || model.violations_30d > 10) {
            indicator.classList.remove('d-none');
        }
    }

    attachCardEventListeners(card, model) {
        // Card click - open model detail modal
        card.addEventListener('click', (e) => {
            // Don't trigger if clicking on buttons
            if (e.target.closest('button')) return;
            
            this.openModelDetail(model);
        });

        // View media button
        const viewMediaBtn = card.querySelector('.view-media-btn');
        viewMediaBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openModelMedia(model);
        });

        // Quick actions button
        const quickActionsBtn = card.querySelector('.quick-actions-btn');
        quickActionsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showQuickActions(model, e.target);
        });
    }

    updateSummaryStats() {
        // Calculate summary statistics from current models
        let totalModels = this.pagination.total_models || 0;
        let totalPending = 0;
        let totalApproved = 0;
        let totalViolations = 0;

        this.models.forEach(model => {
            totalPending += model.pending_review_count || 0;
            totalApproved += (model.approved_count || 0) + (model.approved_blurred_count || 0);
            totalViolations += model.violations_30d || 0;
        });

        // Update summary cards
        document.getElementById('totalModelsCount').textContent = totalModels;
        document.getElementById('totalPendingCount').textContent = totalPending;
        document.getElementById('totalApprovedCount').textContent = totalApproved;
        document.getElementById('totalViolationsCount').textContent = totalViolations;
    }

    updatePagination() {
        const { current_page, total_pages, total_models, per_page } = this.pagination;
        
        // Update showing text
        const showingFrom = ((current_page - 1) * per_page) + 1;
        const showingTo = Math.min(current_page * per_page, total_models);
        
        document.getElementById('showingFrom').textContent = showingFrom;
        document.getElementById('showingTo').textContent = showingTo;
        document.getElementById('showingTotal').textContent = total_models;

        // Update button states
        this.updatePaginationButtons(current_page, total_pages);
        
        // Update page numbers
        this.updatePageNumbers(current_page, total_pages);
    }

    updatePaginationButtons(currentPage, totalPages) {
        const prevBtns = ['prevPage', 'prevPageMobile'];
        const nextBtns = ['nextPage', 'nextPageMobile'];

        prevBtns.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.disabled = currentPage <= 1;
                btn.classList.toggle('opacity-50', currentPage <= 1);
            }
        });

        nextBtns.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.disabled = currentPage >= totalPages;
                btn.classList.toggle('opacity-50', currentPage >= totalPages);
            }
        });
    }

    updatePageNumbers(currentPage, totalPages) {
        const container = document.getElementById('pageNumbers');
        if (!container) return;

        container.innerHTML = '';

        // Show max 7 page numbers
        const maxVisible = 7;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);

        // Adjust start if we're near the end
        if (endPage - startPage < maxVisible - 1) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }

        // Add ellipsis at the beginning if needed
        if (startPage > 1) {
            this.addPageNumber(container, 1);
            if (startPage > 2) {
                this.addEllipsis(container);
            }
        }

        // Add page numbers
        for (let i = startPage; i <= endPage; i++) {
            this.addPageNumber(container, i, i === currentPage);
        }

        // Add ellipsis at the end if needed
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                this.addEllipsis(container);
            }
            this.addPageNumber(container, totalPages);
        }
    }

    addPageNumber(container, pageNum, isCurrent = false) {
        const button = document.createElement('button');
        button.className = `btn btn-outline-primary ${
            isCurrent ? 'active' : ''
        }`;
        button.textContent = pageNum;
        button.addEventListener('click', () => {
            this.currentPage = pageNum;
            this.loadModels();
        });
        container.appendChild(button);
    }

    addEllipsis(container) {
        const span = document.createElement('span');
        span.className = 'btn btn-outline-secondary disabled';
        span.textContent = '...';
        container.appendChild(span);
    }

    showLoadingState() {
        const loadingEl = document.getElementById('modelDashboardLoading');
        const cardsEl = document.getElementById('modelCardsContainer');
        const emptyEl = document.getElementById('modelCardsEmpty');
        const errorEl = document.getElementById('modelCardsError');
        
        if (loadingEl) loadingEl.classList.remove('d-none');
        if (cardsEl) cardsEl.classList.add('d-none');
        if (emptyEl) emptyEl.classList.add('d-none');
        if (errorEl) errorEl.classList.add('d-none');
    }

    showSuccessState() {
        const loadingEl = document.getElementById('modelDashboardLoading');
        const cardsEl = document.getElementById('modelCardsContainer');
        const emptyEl = document.getElementById('modelCardsEmpty');
        const errorEl = document.getElementById('modelCardsError');
        
        if (loadingEl) loadingEl.classList.add('d-none');
        if (cardsEl) cardsEl.classList.remove('d-none');
        if (emptyEl) emptyEl.classList.add('d-none');
        if (errorEl) errorEl.classList.add('d-none');
    }

    showEmptyState() {
        const loadingEl = document.getElementById('modelDashboardLoading');
        const cardsEl = document.getElementById('modelCardsContainer');
        const emptyEl = document.getElementById('modelCardsEmpty');
        const errorEl = document.getElementById('modelCardsError');
        
        if (loadingEl) loadingEl.classList.add('d-none');
        if (cardsEl) cardsEl.classList.add('d-none');
        if (emptyEl) emptyEl.classList.remove('d-none');
        if (errorEl) errorEl.classList.add('d-none');
    }

    showErrorState(message) {
        const loadingEl = document.getElementById('modelDashboardLoading');
        const cardsEl = document.getElementById('modelCardsContainer');
        const emptyEl = document.getElementById('modelCardsEmpty');
        const errorEl = document.getElementById('modelCardsError');
        const msgEl = document.getElementById('errorMessage');
        
        if (loadingEl) loadingEl.classList.add('d-none');
        if (cardsEl) cardsEl.classList.add('d-none');
        if (emptyEl) emptyEl.classList.add('d-none');
        if (errorEl) errorEl.classList.remove('d-none');
        if (msgEl) msgEl.textContent = message;
    }

    async openModelDetail(model) {
        console.log('🔍 Opening model detail for:', model.name);
        // This will be implemented when we create the detail modal
        await this.openModelMedia(model);
    }

    async openModelMedia(model) {
        console.log('📸 Opening media view for:', model.name);

        try {
            // Build modal from template
            const template = document.getElementById('modelDetailModalTemplate');
            if (!template) {
                console.error('Model detail modal template not found');
                return;
            }
            const modalFrag = template.content.cloneNode(true);
            document.body.appendChild(modalFrag);

            const modalEl = document.querySelector('.model-detail-modal');
            const closeBtn = modalEl.querySelector('.close-modal-btn');
            const bodyEl = modalEl.querySelector('.modal-body');

            // Set header info
            const profileImg = modalEl.querySelector('.modal-model-profile');
            profileImg.src = model.profile_image_url || '/assets/default-avatar.png';
            profileImg.onerror = function() { this.onerror = null; this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCI+PHNpcmNsZSBjeD0iMzIiIGN5PSIyMiIgcj0iMTIiIGZpbGw9IiNFNUU5RUIiLz48cmVjdCB4PSIxNiIgeT0iMzgiIHdpZHRoPSIyOCIgaGVpZ2h0PSIxNiIgZmlsbD0iI0VFRiIvPjwvc3ZnPg=='; };
            modalEl.querySelector('.modal-model-name').textContent = model.display_name || model.name;
            modalEl.querySelector('.modal-model-status').textContent = `${model.status}`;

            // Controls
            bodyEl.innerHTML = `
                <div class="d-flex flex-wrap gap-2 align-items-center mb-3">
                    <label class="form-label mb-0 me-2">Category</label>
                    <select id="mediaCategorySelect" class="form-select form-select-sm w-auto">
                        <option value="approved_blurred" selected>Approved (Blurred)</option>
                        <option value="approved">Approved</option>
                        <option value="pending">Pending</option>
                        <option value="rejected">Rejected</option>
                        <option value="all">All</option>
                    </select>
                    <label class="form-label mb-0 ms-3 me-2">Intent</label>
                    <select id="mediaIntentSelect" class="form-select form-select-sm w-auto">
                        <option value="any" selected>Any</option>
                        <option value="public_site">Public</option>
                        <option value="paysite">Private/Paysite</option>
                        <option value="private">Private</option>
                    </select>
                </div>
                <div id="mediaStats" class="text-muted small mb-2"></div>
                <div id="mediaGrid" class="row g-3"></div>
            `;

            const categorySel = bodyEl.querySelector('#mediaCategorySelect');
            const intentSel = bodyEl.querySelector('#mediaIntentSelect');
            const gridEl = bodyEl.querySelector('#mediaGrid');
            const statsEl = bodyEl.querySelector('#mediaStats');

            async function loadMedia() {
                const category = categorySel.value;
                const intent = intentSel.value;
                const url = `/api/model-dashboard/models/${model.id}/media?category=${encodeURIComponent(category)}&page=1&limit=100`;
                const resp = await sysFetch(url);
                const json = await resp.json();
                if (!json.success) throw new Error(json.error || 'Failed to load media');
                const items = (json.data && json.data.media_items) ? json.data.media_items : (json.media_items || []);
                const filtered = intent === 'any' ? items : items.filter(i => (i.usage_intent || '').toLowerCase() === intent);
                renderGrid(filtered);
                statsEl.textContent = `${filtered.length} item(s) — category: ${category}${intent !== 'any' ? `, intent: ${intent}` : ''}`;
            }

            function renderGrid(items) {
                if (!items || items.length === 0) {
                    gridEl.innerHTML = '<div class="col-12 text-center text-muted py-4">No media found</div>';
                    return;
                }
                gridEl.innerHTML = items.map(item => `
                    <div class="col-6 col-md-4 col-lg-3">
                        <div class="card shadow-sm">
                            <div class="bg-light" style="height: 160px; overflow: hidden;">
                                <img src="${item.thumbnail_url}" class="w-100 h-100" style="object-fit: cover;" alt="thumb" onerror="this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjgwIiB2aWV3Qm94PSIwIDAgMTIwIDgwIj48cmVjdCB3aWR0aD0iMTIwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjZWRlZGVkIi8+PHRleHQgeD0iNjAiIHk9IjQyIiBmb250LXNpemU9IjEwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNjY2Ij50aHVtYjwvdGV4dD48L3N2Zz4=';">
                            </div>
                            <div class="card-body p-2 d-flex justify-content-between align-items-center">
                                <span class="badge ${getStatusBadgeClass(item.review_status)} text-capitalize">${item.review_status.replace('_',' ')}</span>
                                <span class="badge bg-secondary">${(item.usage_intent || 'unknown').replace('_',' ')}</span>
                            </div>
                        </div>
                    </div>
                `).join('');
            }

            const getStatusBadgeClass = (status) => {
                switch (status) {
                    case 'approved': return 'bg-success';
                    case 'approved_blurred': return 'bg-info';
                    case 'pending': return 'bg-warning text-dark';
                    case 'rejected': return 'bg-danger';
                    default: return 'bg-secondary';
                }
            };

            categorySel.addEventListener('change', () => loadMedia().catch(console.error));
            intentSel.addEventListener('change', () => loadMedia().catch(console.error));
            closeBtn.addEventListener('click', () => modalEl.remove());
            modalEl.addEventListener('click', (e) => { if (e.target.classList.contains('model-detail-modal')) modalEl.remove(); });

            await loadMedia();
        } catch (error) {
            console.error('Error opening model media:', error);
            alert(`Failed to access media for ${model.name}: ${error.message}`);
        }
    }

    showModelMediaModal(model, mediaItems, categoryBreakdown) {
        const template = document.getElementById('modelDetailModalTemplate');
        if (!template) {
            console.error('Model detail modal template not found');
            return;
        }

        const modal = template.content.cloneNode(true);
        
        // Set model info
        const modalProfile = modal.querySelector('.modal-model-profile');
        modalProfile.src = model.profile_image_url || '/assets/default-avatar.svg';
        modalProfile.onerror = function() { this.onerror = null; this.src = '/assets/default-avatar.svg'; };
        modal.querySelector('.modal-model-name').textContent = model.display_name || model.name;
        modal.querySelector('.modal-model-status').textContent = `${model.status} • ${mediaItems.length} media items`;

        // Create media grid (insert into body, not the container)
        const bodyEl = modal.querySelector('.modal-body');
        if (bodyEl) {
            bodyEl.innerHTML = this.createMediaGridHTML(mediaItems, categoryBreakdown);
        }

        // Append to body
        document.body.appendChild(modal);

        // Animate in
        const modalElement = document.querySelector('.model-detail-modal');
        modalElement.classList.add('entering');
        setTimeout(() => {
            modalElement.classList.remove('entering');
            modalElement.classList.add('entered');
        }, 10);
    }

    createMediaGridHTML(mediaItems, categoryBreakdown) {
        if (mediaItems.length === 0) {
            return `
                <div class="text-center py-5">
                    <div class="text-muted mb-4">
                        <i class="fas fa-images" style="font-size: 4rem;"></i>
                    </div>
                    <h3 class="h5 text-dark mb-2">No media found</h3>
                    <p class="text-muted small">This model hasn't uploaded any media yet.</p>
                </div>
            `;
        }

        // Category breakdown
        const categoryHTML = categoryBreakdown.map(cat => `
            <div class="card text-center">
                <div class="card-body">
                    <h4 class="h2 fw-bold text-dark">${cat.count}</h4>
                    <p class="text-muted small text-capitalize">${cat.review_status.replace('_', ' ')}</p>
                </div>
            </div>
        `).join('');

        // Media grid
        const mediaHTML = mediaItems.map(item => `
            <div class="card shadow-sm" title="${this.escapeForAttr(item.description_text || 'No description')}" data-description="${this.escapeForAttr(item.description_text || '')}">
                <div class="position-relative bg-light" style="height: 200px; overflow: hidden;">
                    <img src="${item.thumbnail_url}" alt="Media thumbnail" class="w-100 h-100" style="object-fit: cover;">
                    <div class="position-absolute bottom-0 start-0 w-100 px-2 py-1 bg-dark bg-opacity-50 text-white small d-none hover-desc">${this.escapeHtml(item.description_text || 'No description')}</div>
                </div>
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <span class="badge ${this.getStatusBadgeClass(item.review_status)}">
                            ${item.review_status.replace('_', ' ')}
                        </span>
                        <span class="small fw-medium text-dark">${item.nudity_score}%</span>
                    </div>
                    <p class="small text-muted">${item.usage_intent.replace('_', ' ')}</p>
                    <p class="small text-muted mt-1">${new Date(item.flagged_at).toLocaleDateString()}</p>
                </div>
            </div>
        `).join('');

        return `
            <div class="mb-4">
                <!-- Category Breakdown -->
                <div class="mb-5">
                    <h4 class="h5 fw-medium text-dark mb-3">Media Status Breakdown</h4>
                    <div class="row g-3">
                        ${categoryHTML}
                    </div>
                </div>

                <!-- Media Grid -->
                <div>
                    <h4 class="h5 fw-medium text-dark mb-3">Recent Media (${mediaItems.length})</h4>
                    <div class="row g-3 media-grid">
                        <div class="col-12">
                            <div class="row g-3">
                                ${mediaHTML.split('</div>').map(item => item ? `<div class="col-md-6 col-lg-4 col-xl-3">${item}</div>` : '').join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Basic HTML escapers for safe injection
    escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    escapeForAttr(str) {
        return this.escapeHtml(str).replace(/\n/g, ' ');
    }

    closeModal() {
        const modal = document.querySelector('.model-detail-modal');
        if (modal) {
            modal.classList.remove('entered');
            modal.classList.add('entering');
            setTimeout(() => {
                modal.remove();
            }, 200);
        }
    }

    showQuickActions(model, button) {
        // TODO: Implement quick actions dropdown
        console.log('Quick actions for:', model.name);
    }

    // Utility methods
    getModelTypeDisplay(model) {
        return model.model_type || 'Model';
    }

    getTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
        return `${Math.floor(diffDays / 365)} years ago`;
    }

    getStatusBadgeClass(status) {
        const classes = {
            'pending': 'bg-warning text-dark',
            'approved': 'bg-success text-white',
            'approved_blurred': 'bg-info text-white',
            'rejected': 'bg-danger text-white'
        };
        return classes[status] || 'bg-secondary text-white';
    }
}

// Global instance
window.modelDashboard = new ModelDashboard();