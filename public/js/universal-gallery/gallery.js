/**
 * Universal Gallery Main Module
 * 
 * Coordinates all gallery functionality including layout management, lightbox,
 * filtering, pagination, and prefetching. Provides a unified API for gallery
 * initialization and management across all themes.
 * 
 * Features:
 * - Theme-agnostic initialization
 * - Configuration-driven setup
 * - Progressive enhancement
 * - URL state management
 * - Event coordination
 * - Performance monitoring
 * - Accessibility management
 */

class UniversalGallery {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        
        if (!this.container) {
            throw new Error('Gallery container not found');
        }

        // Default configuration
        this.config = {
            // Theme configuration (loaded from JSON)
            themeConfig: null,
            
            // Gallery settings (from database/API)
            gallerySettings: {
                lightbox: true,
                fullscreen: true,
                captions: true,
                imageInfo: false,
                categoryFilter: true,
                sortOptions: false,
                searchEnabled: false,
                layoutToggle: false
            },
            
            // Layout settings
            layout: 'masonry',
            
            // URL state management
            updateURL: true,
            baseURL: window.location.pathname,
            
            // Performance settings
            prefetch: {
                enabled: true,
                strategy: 'balanced'
            },
            
            // Accessibility settings
            announcements: true,
            focusManagement: true,
            keyboardNavigation: true,
            
            // API endpoints
            apiEndpoints: {
                gallery: '/api/gallery',
                filter: '/api/gallery/filter'
            },
            
            // Debug mode
            debug: false,
            
            ...options
        };

        // Initialize state
        this.state = {
            initialized: false,
            currentLayout: null,
            currentFilters: {
                category: null,
                sort: 'recent',
                search: null,
                page: 1
            },
            isLoading: false,
            hasError: false,
            components: {}
        };

        this.boundHandlers = {};
        
        this.init();
    }

    /**
     * Initialize gallery system
     */
    async init() {
        try {
            // Load configuration data
            await this.loadConfiguration();
            
            // Initialize core components
            this.initializeLayout();
            this.initializeLightbox();
            this.initializeLazyLoading();
            this.initializePrefetch();
            this.initializeFilters();
            this.initializePagination();
            
            // Setup URL state management
            this.initializeURLState();
            
            // Bind global events
            this.bindEvents();
            
            // Setup accessibility
            this.setupAccessibility();
            
            // Mark as initialized
            this.state.initialized = true;
            
            // Dispatch initialization event
            this.dispatchEvent('gallery:initialized', {
                config: this.config,
                components: Object.keys(this.state.components)
            });
            
            if (this.config.debug) {
                console.log('✅ UniversalGallery initialized:', this.getStatus());
            }
            
        } catch (error) {
            console.error('❌ Failed to initialize UniversalGallery:', error);
            this.handleInitializationError(error);
        }
    }

    /**
     * Load theme and gallery configuration data
     */
    async loadConfiguration() {
        // Load theme configuration from script tag
        const themeConfigScript = document.getElementById('gallery-theme-config');
        if (themeConfigScript) {
            try {
                this.config.themeConfig = JSON.parse(themeConfigScript.textContent);
            } catch (error) {
                console.warn('Failed to parse theme config:', error);
            }
        }

        // Load gallery state from script tag
        const galleryStateScript = document.getElementById('gallery-state-data');
        if (galleryStateScript) {
            try {
                const stateData = JSON.parse(galleryStateScript.textContent);
                this.state.currentFilters = { ...this.state.currentFilters, ...stateData.filters };
                if (stateData.layout) {
                    this.config.layout = stateData.layout;
                }
            } catch (error) {
                console.warn('Failed to parse gallery state:', error);
            }
        }

        // Load lightbox configuration
        const lightboxConfigScript = document.getElementById('lightbox-config');
        if (lightboxConfigScript) {
            try {
                this.config.lightboxConfig = JSON.parse(lightboxConfigScript.textContent);
            } catch (error) {
                console.warn('Failed to parse lightbox config:', error);
            }
        }

        // Validate required configuration
        if (!this.config.themeConfig) {
            console.warn('No theme configuration found - using defaults');
            this.config.themeConfig = this.getDefaultThemeConfig();
        }
    }

    /**
     * Get default theme configuration fallback
     */
    getDefaultThemeConfig() {
        return {
            cssClasses: {
                gallery: 'universal-gallery',
                section: 'gallery-section',
                item: 'gallery-item',
                lightbox: 'gallery-lightbox',
                pagination: 'gallery-pagination',
                filters: 'gallery-filters'
            },
            icons: {
                close: '✕',
                fullscreen: '⤢',
                prev: '‹',
                next: '›',
                grid: '⊞',
                masonry: '⊡',
                carousel: '⊲'
            },
            animations: {
                hover: 'gallery-hover',
                transition: 'gallery-transition'
            }
        };
    }

    /**
     * Initialize layout management
     */
    initializeLayout() {
        const layoutContainer = this.container.querySelector('.gallery-grid');
        if (!layoutContainer) return;

        this.state.currentLayout = this.config.layout;

        switch (this.config.layout) {
            case 'masonry':
                if (typeof UniversalGalleryMasonry !== 'undefined') {
                    this.state.components.masonry = new UniversalGalleryMasonry(layoutContainer, {
                        columnWidth: this.config.themeConfig.layouts?.masonry?.columnWidth || 280,
                        gutter: this.config.themeConfig.layouts?.masonry?.gutter || 20,
                        respectReducedMotion: true
                    });
                }
                break;

            case 'grid':
                this.initializeGridLayout(layoutContainer);
                break;

            case 'carousel':
                this.initializeCarouselLayout(layoutContainer);
                break;
        }
    }

    /**
     * Initialize grid layout
     */
    initializeGridLayout(container) {
        const gridConfig = this.config.themeConfig.layouts?.grid || {};
        const columns = gridConfig.defaultColumns || { sm: 2, md: 3, lg: 4 };
        
        // Apply CSS custom properties for responsive grid
        container.style.setProperty('--grid-columns-sm', columns.sm);
        container.style.setProperty('--grid-columns-md', columns.md);
        container.style.setProperty('--grid-columns-lg', columns.lg);
        
        container.classList.add('gallery-grid-layout');
    }

    /**
     * Initialize carousel layout
     */
    initializeCarouselLayout(container) {
        // Carousel implementation would go here
        console.warn('Carousel layout not yet implemented');
    }

    /**
     * Initialize lightbox functionality
     */
    initializeLightbox() {
        if (!this.config.gallerySettings.lightbox) return;

        if (typeof UniversalGalleryLightbox !== 'undefined') {
            const lightboxConfig = this.config.lightboxConfig || {};
            this.state.components.lightbox = new UniversalGalleryLightbox(lightboxConfig);
        }
    }

    /**
     * Initialize lazy loading for images
     */
    initializeLazyLoading() {
        // Use native lazy loading where supported
        const images = this.container.querySelectorAll('img:not([loading])');
        images.forEach(img => {
            img.loading = 'lazy';
        });

        // Use Intersection Observer for advanced lazy loading
        if ('IntersectionObserver' in window) {
            this.state.components.lazyLoader = new IntersectionObserver(
                (entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            const img = entry.target;
                            
                            // Load high-res image if data-src is present
                            if (img.dataset.src && img.src !== img.dataset.src) {
                                const tempImg = new Image();
                                tempImg.onload = () => {
                                    img.src = img.dataset.src;
                                    img.classList.remove('loading');
                                    img.classList.add('loaded');
                                };
                                tempImg.onerror = () => {
                                    img.classList.add('error');
                                };
                                tempImg.src = img.dataset.src;
                            }
                            
                            // Mark as visible for CSS animations
                            img.closest('.gallery-item')?.classList.add('gallery-visible');
                            
                            // Stop observing this image
                            this.state.components.lazyLoader.unobserve(img);
                        }
                    });
                },
                {
                    rootMargin: '50px 0px',
                    threshold: 0.1
                }
            );

            // Observe all images
            const lazyImages = this.container.querySelectorAll('img[data-src], .gallery-item img');
            lazyImages.forEach(img => {
                this.state.components.lazyLoader.observe(img);
            });
        }
        
        // Apply content visibility optimization
        this.optimizeContentVisibility();
    }

    /**
     * Optimize content visibility for performance
     */
    optimizeContentVisibility() {
        // Apply content-visibility CSS for better performance
        const galleryItems = this.container.querySelectorAll('.gallery-item');
        
        galleryItems.forEach(item => {
            // Set contain-intrinsic-size based on aspect ratio or default
            const img = item.querySelector('img');
            if (img) {
                const aspectRatio = img.dataset.aspectRatio || '3/4';
                const width = img.dataset.width || '300';
                const height = img.dataset.height || '400';
                
                item.style.containIntrinsicSize = `${width}px ${height}px`;
            } else {
                // Default fallback size
                item.style.containIntrinsicSize = '300px 400px';
            }
        });
    }

    /**
     * Initialize image prefetching
     */
    initializePrefetch() {
        if (!this.config.prefetch.enabled) return;

        if (typeof UniversalGalleryPrefetch !== 'undefined') {
            this.state.components.prefetch = new UniversalGalleryPrefetch({
                strategy: this.config.prefetch.strategy
            });

            // Observe gallery items
            const galleryItems = this.container.querySelectorAll('.gallery-item');
            this.state.components.prefetch.observeElements(galleryItems);
        }
    }

    /**
     * Initialize filter controls
     */
    initializeFilters() {
        const filtersContainer = this.container.querySelector('.gallery-filters');
        if (!filtersContainer) return;

        this.bindFilterEvents(filtersContainer);
    }

    /**
     * Initialize pagination controls
     */
    initializePagination() {
        const paginationContainer = this.container.querySelector('.gallery-pagination');
        if (!paginationContainer) return;

        this.bindPaginationEvents(paginationContainer);
    }

    /**
     * Initialize URL state management
     */
    initializeURLState() {
        if (!this.config.updateURL) return;

        // Handle browser back/forward navigation
        this.boundHandlers.popstate = this.handlePopState.bind(this);
        window.addEventListener('popstate', this.boundHandlers.popstate);

        // Initialize state from current URL
        this.loadStateFromURL();
    }

    /**
     * Bind filter events
     */
    bindFilterEvents(filtersContainer) {
        // Search input
        const searchInput = filtersContainer.querySelector('#gallery-search');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.updateFilter('search', e.target.value || null);
                }, 300); // Debounce search
            });

            // Clear search button
            const clearBtn = filtersContainer.querySelector('.search-clear');
            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    searchInput.value = '';
                    this.updateFilter('search', null);
                });
            }
        }

        // Category filter
        const categorySelect = filtersContainer.querySelector('#category-filter');
        if (categorySelect) {
            categorySelect.addEventListener('change', (e) => {
                this.updateFilter('category', e.target.value || null);
            });
        }

        // Sort filter
        const sortSelect = filtersContainer.querySelector('#sort-filter');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.updateFilter('sort', e.target.value);
            });
        }

        // Layout toggle
        const layoutRadios = filtersContainer.querySelectorAll('input[name="gallery-layout"]');
        layoutRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.changeLayout(e.target.value);
                }
            });
        });

        // Clear all filters
        const clearAllBtn = filtersContainer.querySelector('.clear-all-filters');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                this.clearAllFilters();
            });
        }

        // Individual filter remove buttons
        const removeButtons = filtersContainer.querySelectorAll('.filter-remove');
        removeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filterType = e.target.dataset.filterType;
                this.clearFilter(filterType);
            });
        });
    }

    /**
     * Bind pagination events
     */
    bindPaginationEvents(paginationContainer) {
        // Page buttons
        const pageButtons = paginationContainer.querySelectorAll('.pagination-btn[data-page]');
        pageButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const page = parseInt(e.target.dataset.page);
                if (page && page !== this.state.currentFilters.page) {
                    this.updateFilter('page', page);
                }
            });
        });

        // Page size selector
        const pageSizeSelect = paginationContainer.querySelector('.page-size-select');
        if (pageSizeSelect) {
            pageSizeSelect.addEventListener('change', (e) => {
                this.updatePageSize(parseInt(e.target.value));
            });
        }

        // Quick jump
        const quickJumpBtn = paginationContainer.querySelector('.page-jump-btn');
        const quickJumpInput = paginationContainer.querySelector('.page-jump-input');
        if (quickJumpBtn && quickJumpInput) {
            quickJumpBtn.addEventListener('click', () => {
                const page = parseInt(quickJumpInput.value);
                if (page && page > 0) {
                    this.updateFilter('page', page);
                }
            });

            quickJumpInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    quickJumpBtn.click();
                }
            });
        }
    }

    /**
     * Bind global events
     */
    bindEvents() {
        // Keyboard navigation
        if (this.config.keyboardNavigation) {
            this.boundHandlers.keydown = this.handleGlobalKeydown.bind(this);
            document.addEventListener('keydown', this.boundHandlers.keydown);
        }

        // Focus management for accessibility
        if (this.config.focusManagement) {
            this.boundHandlers.focusin = this.handleFocusIn.bind(this);
            this.container.addEventListener('focusin', this.boundHandlers.focusin);
        }
    }

    /**
     * Handle global keyboard navigation
     */
    handleGlobalKeydown(event) {
        // Only handle if gallery container has focus or is active
        if (!this.container.contains(event.target) && 
            !this.container.matches(':focus-within')) {
            return;
        }

        switch (event.key) {
            case 'Home':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    this.goToPage(1);
                }
                break;
            case 'End':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    // Go to last page (would need pagination info)
                }
                break;
            case 'PageUp':
                event.preventDefault();
                this.previousPage();
                break;
            case 'PageDown':
                event.preventDefault();
                this.nextPage();
                break;
        }
    }

    /**
     * Handle focus events for accessibility announcements
     */
    handleFocusIn(event) {
        if (this.config.announcements) {
            const target = event.target;
            
            // Announce gallery items when focused
            if (target.matches('.gallery-item') || target.closest('.gallery-item')) {
                const item = target.closest('.gallery-item');
                const index = Array.from(this.container.querySelectorAll('.gallery-item')).indexOf(item);
                const total = this.container.querySelectorAll('.gallery-item').length;
                
                if (index !== -1) {
                    this.announce(`Image ${index + 1} of ${total}`);
                }
            }
        }
    }

    /**
     * Update a single filter
     */
    updateFilter(filterType, value) {
        const oldValue = this.state.currentFilters[filterType];
        if (oldValue === value) return; // No change

        // Reset to page 1 when changing filters (except page)
        if (filterType !== 'page') {
            this.state.currentFilters.page = 1;
        }

        this.state.currentFilters[filterType] = value;

        // Update URL if enabled
        if (this.config.updateURL) {
            this.updateURL();
        }

        // Reload gallery content
        this.reloadGallery();

        // Announce filter change
        if (this.config.announcements) {
            this.announceFilterChange(filterType, value, oldValue);
        }

        // Dispatch event
        this.dispatchEvent('gallery:filterChanged', {
            filterType,
            value,
            oldValue,
            filters: { ...this.state.currentFilters }
        });
    }

    /**
     * Clear all filters
     */
    clearAllFilters() {
        const oldFilters = { ...this.state.currentFilters };
        
        this.state.currentFilters = {
            category: null,
            sort: 'recent',
            search: null,
            page: 1
        };

        // Update URL
        if (this.config.updateURL) {
            this.updateURL();
        }

        // Reload gallery
        this.reloadGallery();

        // Announce
        if (this.config.announcements) {
            this.announce('All filters cleared');
        }

        // Dispatch event
        this.dispatchEvent('gallery:filtersCleared', {
            oldFilters,
            filters: { ...this.state.currentFilters }
        });
    }

    /**
     * Clear specific filter
     */
    clearFilter(filterType) {
        let defaultValue;
        switch (filterType) {
            case 'search':
            case 'category':
                defaultValue = null;
                break;
            case 'sort':
                defaultValue = 'recent';
                break;
            case 'page':
                defaultValue = 1;
                break;
            default:
                return;
        }

        this.updateFilter(filterType, defaultValue);
    }

    /**
     * Change gallery layout
     */
    changeLayout(newLayout) {
        if (newLayout === this.state.currentLayout) return;

        const oldLayout = this.state.currentLayout;
        this.state.currentLayout = newLayout;
        this.config.layout = newLayout;

        // Destroy old layout component
        if (this.state.components.masonry && oldLayout === 'masonry') {
            this.state.components.masonry.destroy();
            delete this.state.components.masonry;
        }

        // Update container classes
        const layoutContainer = this.container.querySelector('.gallery-grid');
        if (layoutContainer) {
            layoutContainer.className = layoutContainer.className
                .replace(/gallery-\w+-layout/g, '')
                .trim();
            layoutContainer.classList.add(`gallery-${newLayout}-layout`);
        }

        // Initialize new layout
        this.initializeLayout();

        // Update URL
        if (this.config.updateURL) {
            this.updateURL();
        }

        // Announce change
        if (this.config.announcements) {
            this.announce(`Changed to ${newLayout} layout`);
        }

        // Dispatch event
        this.dispatchEvent('gallery:layoutChanged', {
            oldLayout,
            newLayout
        });
    }

    /**
     * Navigate to specific page
     */
    goToPage(page) {
        this.updateFilter('page', page);
    }

    /**
     * Navigate to previous page
     */
    previousPage() {
        if (this.state.currentFilters.page > 1) {
            this.updateFilter('page', this.state.currentFilters.page - 1);
        }
    }

    /**
     * Navigate to next page
     */
    nextPage() {
        // Would need pagination info to determine max page
        this.updateFilter('page', this.state.currentFilters.page + 1);
    }

    /**
     * Update page size
     */
    updatePageSize(pageSize) {
        // Reset to page 1 when changing page size
        this.state.currentFilters.page = 1;
        
        // This would typically be handled by reloading with new page size parameter
        this.reloadGallery({ pageSize });
    }

    /**
     * Reload gallery content with current filters
     */
    async reloadGallery(extraParams = {}) {
        if (this.state.isLoading) return;

        this.state.isLoading = true;
        this.showLoadingState();

        try {
            const params = new URLSearchParams({
                ...this.state.currentFilters,
                ...extraParams
            });

            // Remove null/empty values
            for (const [key, value] of params) {
                if (value === null || value === 'null' || value === '') {
                    params.delete(key);
                }
            }

            const response = await fetch(`${this.config.apiEndpoints.gallery}?${params}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.success) {
                this.updateGalleryContent(data.data);
                this.hideLoadingState();
                this.state.hasError = false;
            } else {
                throw new Error(data.error || 'Unknown error occurred');
            }

        } catch (error) {
            console.error('Failed to reload gallery:', error);
            this.showErrorState(error.message);
            this.state.hasError = true;
        } finally {
            this.state.isLoading = false;
        }
    }

    /**
     * Update gallery content with new data
     */
    updateGalleryContent(data) {
        // This would update the DOM with new gallery items
        // Implementation depends on server-side rendering vs client-side updates
        console.log('Gallery content update:', data);
        
        // Dispatch event for potential custom handlers
        this.dispatchEvent('gallery:contentUpdated', { data });
    }

    /**
     * Show loading state
     */
    showLoadingState() {
        const loadingElement = this.container.querySelector('.gallery-loading');
        if (loadingElement) {
            loadingElement.style.display = 'flex';
            loadingElement.setAttribute('aria-hidden', 'false');
        }

        this.container.classList.add('gallery-loading-state');
    }

    /**
     * Hide loading state
     */
    hideLoadingState() {
        const loadingElement = this.container.querySelector('.gallery-loading');
        if (loadingElement) {
            loadingElement.style.display = 'none';
            loadingElement.setAttribute('aria-hidden', 'true');
        }

        this.container.classList.remove('gallery-loading-state');
    }

    /**
     * Show error state
     */
    showErrorState(errorMessage) {
        const errorElement = this.container.querySelector('.gallery-error');
        if (errorElement) {
            errorElement.style.display = 'block';
            const messageElement = errorElement.querySelector('.error-message');
            if (messageElement) {
                messageElement.textContent = errorMessage;
            }
        }

        this.container.classList.add('gallery-error-state');
    }

    /**
     * Load state from current URL
     */
    loadStateFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        
        // Update filters from URL parameters
        if (urlParams.get('page')) {
            this.state.currentFilters.page = parseInt(urlParams.get('page')) || 1;
        }
        if (urlParams.get('cat')) {
            this.state.currentFilters.category = urlParams.get('cat');
        }
        if (urlParams.get('sort')) {
            this.state.currentFilters.sort = urlParams.get('sort');
        }
        if (urlParams.get('search')) {
            this.state.currentFilters.search = urlParams.get('search');
        }
        if (urlParams.get('layout')) {
            this.config.layout = urlParams.get('layout');
        }
    }

    /**
     * Update URL with current state
     */
    updateURL() {
        const params = new URLSearchParams();
        
        // Add non-default parameters
        if (this.state.currentFilters.page > 1) {
            params.set('page', this.state.currentFilters.page);
        }
        if (this.state.currentFilters.category) {
            params.set('cat', this.state.currentFilters.category);
        }
        if (this.state.currentFilters.sort !== 'recent') {
            params.set('sort', this.state.currentFilters.sort);
        }
        if (this.state.currentFilters.search) {
            params.set('search', this.state.currentFilters.search);
        }
        if (this.config.layout !== 'masonry') {
            params.set('layout', this.config.layout);
        }

        const newURL = params.toString() 
            ? `${this.config.baseURL}?${params.toString()}`
            : this.config.baseURL;

        // Update URL without page reload
        window.history.pushState(
            { 
                filters: { ...this.state.currentFilters },
                layout: this.config.layout
            }, 
            '', 
            newURL
        );
    }

    /**
     * Handle browser back/forward navigation
     */
    handlePopState(event) {
        if (event.state) {
            this.state.currentFilters = { ...event.state.filters };
            this.config.layout = event.state.layout;
            this.reloadGallery();
        } else {
            // Fallback to URL parsing
            this.loadStateFromURL();
            this.reloadGallery();
        }
    }

    /**
     * Setup accessibility features
     */
    setupAccessibility() {
        // Add gallery role and label
        this.container.setAttribute('role', 'region');
        this.container.setAttribute('aria-label', 'Image gallery');

        // Create live region for announcements
        if (this.config.announcements) {
            this.createLiveRegion();
        }

        // Ensure proper focus management
        if (this.config.focusManagement) {
            this.container.setAttribute('tabindex', '-1');
        }
    }

    /**
     * Create live region for screen reader announcements
     */
    createLiveRegion() {
        if (document.getElementById('gallery-live-region')) return;

        this.liveRegion = document.createElement('div');
        this.liveRegion.id = 'gallery-live-region';
        this.liveRegion.className = 'sr-only';
        this.liveRegion.setAttribute('aria-live', 'polite');
        this.liveRegion.setAttribute('aria-atomic', 'true');
        document.body.appendChild(this.liveRegion);
    }

    /**
     * Announce message to screen readers
     */
    announce(message) {
        if (!this.config.announcements || !this.liveRegion) return;

        this.liveRegion.textContent = message;
        
        // Clear after announcement
        setTimeout(() => {
            this.liveRegion.textContent = '';
        }, 1000);
    }

    /**
     * Announce filter changes
     */
    announceFilterChange(filterType, value, oldValue) {
        let message;
        
        switch (filterType) {
            case 'category':
                message = value ? `Filtered by category: ${value}` : 'Category filter removed';
                break;
            case 'search':
                message = value ? `Searching for: ${value}` : 'Search cleared';
                break;
            case 'sort':
                message = `Sorted by: ${value}`;
                break;
            case 'page':
                message = `Page ${value}`;
                break;
            default:
                message = `Filter updated: ${filterType}`;
        }
        
        this.announce(message);
    }

    /**
     * Handle initialization errors
     */
    handleInitializationError(error) {
        this.state.hasError = true;
        this.showErrorState(`Failed to initialize gallery: ${error.message}`);
        
        this.dispatchEvent('gallery:initializationError', { error });
    }

    /**
     * Dispatch custom events
     */
    dispatchEvent(type, detail) {
        const event = new CustomEvent(type, { 
            detail: { 
                gallery: this, 
                ...detail 
            }
        });
        this.container.dispatchEvent(event);
    }

    /**
     * Get gallery status information
     */
    getStatus() {
        return {
            initialized: this.state.initialized,
            layout: this.state.currentLayout,
            filters: { ...this.state.currentFilters },
            loading: this.state.isLoading,
            error: this.state.hasError,
            components: Object.keys(this.state.components),
            config: this.config
        };
    }

    /**
     * Update gallery configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        
        // Re-initialize components if needed
        if (newConfig.prefetch && this.state.components.prefetch) {
            this.state.components.prefetch.updateStrategy(newConfig.prefetch.strategy);
        }
        
        this.dispatchEvent('gallery:configUpdated', { config: this.config });
    }

    /**
     * Destroy gallery instance
     */
    destroy() {
        // Remove event listeners
        if (this.boundHandlers.popstate) {
            window.removeEventListener('popstate', this.boundHandlers.popstate);
        }
        if (this.boundHandlers.keydown) {
            document.removeEventListener('keydown', this.boundHandlers.keydown);
        }
        if (this.boundHandlers.focusin) {
            this.container.removeEventListener('focusin', this.boundHandlers.focusin);
        }

        // Destroy components
        Object.values(this.state.components).forEach(component => {
            if (component && typeof component.destroy === 'function') {
                component.destroy();
            }
        });

        // Remove live region
        if (this.liveRegion && this.liveRegion.parentNode) {
            this.liveRegion.parentNode.removeChild(this.liveRegion);
        }

        // Reset state
        this.state = {
            initialized: false,
            currentLayout: null,
            currentFilters: {},
            isLoading: false,
            hasError: false,
            components: {}
        };

        this.dispatchEvent('gallery:destroyed', {});
        
        console.log('🧹 UniversalGallery destroyed');
    }
}

// Auto-initialize galleries on page load
document.addEventListener('DOMContentLoaded', () => {
    const galleryContainers = document.querySelectorAll('[data-universal-gallery]');
    
    galleryContainers.forEach(container => {
        // Check if already initialized
        if (container.galleryInstance) return;
        
        // Get configuration from data attributes
        const config = {};
        if (container.dataset.galleryConfig) {
            try {
                Object.assign(config, JSON.parse(container.dataset.galleryConfig));
            } catch (error) {
                console.warn('Invalid gallery config in data attribute:', error);
            }
        }
        
        // Initialize gallery
        try {
            container.galleryInstance = new UniversalGallery(container, config);
        } catch (error) {
            console.error('Failed to initialize gallery:', error);
        }
    });
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UniversalGallery;
} else {
    window.UniversalGallery = UniversalGallery;
}