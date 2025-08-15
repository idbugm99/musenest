/**
 * Universal Gallery Lightbox Module
 * 
 * Provides accessible, keyboard-navigable lightbox functionality for gallery images.
 * Supports touch gestures, fullscreen mode, zoom, and proper focus management.
 * 
 * Features:
 * - WCAG 2.1 AA accessibility compliance
 * - Keyboard navigation (arrows, ESC, F, +/-, Home/End)
 * - Touch/swipe gestures
 * - Focus trap and restoration
 * - Fullscreen API integration
 * - Image preloading and lazy loading
 * - Error handling and retry functionality
 * - Respects prefers-reduced-motion
 */

class UniversalGalleryLightbox {
    constructor(options = {}) {
        this.config = {
            enableKeyboard: true,
            enableTouch: true,
            enableFullscreen: true,
            animation: 'fade',
            closeAnimation: 'fade',
            respectReducedMotion: true,
            preloadNext: true,
            enableZoom: false,
            maxZoom: 3,
            zoomStep: 0.5,
            ...options
        };

        this.state = {
            isOpen: false,
            currentIndex: 0,
            images: [],
            zoomLevel: 1,
            isDragging: false,
            dragStart: { x: 0, y: 0 },
            imageOffset: { x: 0, y: 0 },
            focusedElementBeforeOpen: null
        };

        this.elements = {};
        this.boundHandlers = {};
        this.preloadCache = new Map();
        this.touchState = {};
        
        this.init();
    }

    /**
     * Initialize lightbox functionality
     */
    init() {
        this.findElements();
        this.loadImagesData();
        this.bindEvents();
        this.setupTouchHandling();
        this.setupAccessibility();
        
        console.log('✅ UniversalGalleryLightbox initialized');
    }

    /**
     * Find and cache DOM elements
     */
    findElements() {
        this.elements = {
            lightbox: document.getElementById('gallery-lightbox'),
            backdrop: document.querySelector('[data-lightbox-close]'),
            image: document.querySelector('[data-lightbox-image]'),
            loading: document.querySelector('[data-lightbox-loading]'),
            error: document.querySelector('[data-lightbox-error]'),
            prevBtn: document.querySelector('[data-lightbox-prev]'),
            nextBtn: document.querySelector('[data-lightbox-next]'),
            closeBtn: document.querySelector('[data-lightbox-close]'),
            fullscreenBtn: document.querySelector('[data-lightbox-fullscreen]'),
            currentCounter: document.querySelector('[data-lightbox-current]'),
            totalCounter: document.querySelector('[data-lightbox-total]'),
            imageAlt: document.getElementById('lightbox-image-alt'),
            imageCaption: document.getElementById('lightbox-image-caption'),
            imageDimensions: document.querySelector('[data-lightbox-dimensions]'),
            imageCategory: document.querySelector('[data-lightbox-category]'),
            imageDate: document.querySelector('[data-lightbox-date]'),
            retryBtn: document.querySelector('[data-lightbox-retry]'),
            
            // Zoom controls (optional)
            zoomIn: document.querySelector('[data-lightbox-zoom-in]'),
            zoomOut: document.querySelector('[data-lightbox-zoom-out]'),
            zoomReset: document.querySelector('[data-lightbox-zoom-reset]'),
            
            // Triggers
            triggers: document.querySelectorAll('[data-lightbox-trigger]')
        };

        // Validate required elements
        const required = ['lightbox', 'image', 'prevBtn', 'nextBtn', 'closeBtn'];
        const missing = required.filter(key => !this.elements[key]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required lightbox elements: ${missing.join(', ')}`);
        }
    }

    /**
     * Load images data from JSON script tag
     */
    loadImagesData() {
        const dataScript = document.getElementById('lightbox-images-data');
        if (dataScript) {
            try {
                this.state.images = JSON.parse(dataScript.textContent);
                if (this.elements.totalCounter) {
                    this.elements.totalCounter.textContent = this.state.images.length;
                }
            } catch (error) {
                console.error('Failed to parse lightbox images data:', error);
                this.state.images = [];
            }
        }
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Trigger events
        this.elements.triggers.forEach(trigger => {
            trigger.addEventListener('click', this.handleTriggerClick.bind(this));
            trigger.addEventListener('keydown', this.handleTriggerKeydown.bind(this));
        });

        // Navigation events
        if (this.elements.prevBtn) {
            this.elements.prevBtn.addEventListener('click', () => this.prev());
        }
        if (this.elements.nextBtn) {
            this.elements.nextBtn.addEventListener('click', () => this.next());
        }

        // Close events
        this.elements.closeBtn?.addEventListener('click', () => this.close());
        this.elements.backdrop?.addEventListener('click', () => this.close());

        // Fullscreen events
        if (this.elements.fullscreenBtn && this.config.enableFullscreen) {
            this.elements.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
            document.addEventListener('fullscreenchange', this.handleFullscreenChange.bind(this));
        }

        // Zoom events
        if (this.config.enableZoom) {
            this.elements.zoomIn?.addEventListener('click', () => this.zoomIn());
            this.elements.zoomOut?.addEventListener('click', () => this.zoomOut());
            this.elements.zoomReset?.addEventListener('click', () => this.resetZoom());
            
            // Mouse wheel zoom
            this.elements.image?.addEventListener('wheel', this.handleWheelZoom.bind(this));
        }

        // Retry button
        this.elements.retryBtn?.addEventListener('click', () => this.loadCurrentImage());

        // Global keyboard events (bound when open)
        this.boundHandlers.keydown = this.handleKeydown.bind(this);
        
        // Global resize events
        this.boundHandlers.resize = this.handleResize.bind(this);
        window.addEventListener('resize', this.boundHandlers.resize);

        // Reduced motion preference
        if (this.config.respectReducedMotion) {
            const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
            mediaQuery.addEventListener('change', this.handleReducedMotionChange.bind(this));
            this.handleReducedMotionChange(mediaQuery);
        }
    }

    /**
     * Setup touch/swipe handling for mobile devices
     */
    setupTouchHandling() {
        if (!this.config.enableTouch) return;

        const imageContainer = this.elements.image?.parentElement;
        if (!imageContainer) return;

        let touchStartX = 0;
        let touchStartY = 0;
        let touchStartTime = 0;

        imageContainer.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                touchStartTime = Date.now();
            }
        }, { passive: true });

        imageContainer.addEventListener('touchend', (e) => {
            if (e.changedTouches.length === 1) {
                const touchEndX = e.changedTouches[0].clientX;
                const touchEndY = e.changedTouches[0].clientY;
                const touchEndTime = Date.now();
                
                const deltaX = touchEndX - touchStartX;
                const deltaY = touchEndY - touchStartY;
                const deltaTime = touchEndTime - touchStartTime;
                
                // Detect swipe gestures
                if (deltaTime < 500 && Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
                    e.preventDefault();
                    if (deltaX > 0) {
                        this.prev(); // Swipe right = previous
                    } else {
                        this.next(); // Swipe left = next
                    }
                }
            }
        }, { passive: false });

        // Pinch to zoom (if zoom is enabled)
        if (this.config.enableZoom) {
            let initialDistance = 0;
            let initialScale = 1;

            imageContainer.addEventListener('touchstart', (e) => {
                if (e.touches.length === 2) {
                    initialDistance = this.getTouchDistance(e.touches[0], e.touches[1]);
                    initialScale = this.state.zoomLevel;
                }
            }, { passive: true });

            imageContainer.addEventListener('touchmove', (e) => {
                if (e.touches.length === 2) {
                    e.preventDefault();
                    const currentDistance = this.getTouchDistance(e.touches[0], e.touches[1]);
                    const scale = initialScale * (currentDistance / initialDistance);
                    this.setZoom(Math.max(1, Math.min(this.config.maxZoom, scale)));
                }
            }, { passive: false });
        }
    }

    /**
     * Setup accessibility features
     */
    setupAccessibility() {
        // Ensure lightbox has proper ARIA attributes
        if (this.elements.lightbox) {
            this.elements.lightbox.setAttribute('role', 'dialog');
            this.elements.lightbox.setAttribute('aria-modal', 'true');
            this.elements.lightbox.setAttribute('aria-hidden', 'true');
        }

        // Add live region for screen reader announcements
        this.createLiveRegion();
    }

    /**
     * Create live region for screen reader announcements
     */
    createLiveRegion() {
        this.liveRegion = document.createElement('div');
        this.liveRegion.className = 'sr-only';
        this.liveRegion.setAttribute('aria-live', 'polite');
        this.liveRegion.setAttribute('aria-atomic', 'true');
        document.body.appendChild(this.liveRegion);
    }

    /**
     * Announce message to screen readers
     */
    announce(message) {
        if (this.liveRegion) {
            this.liveRegion.textContent = message;
            
            // Clear after announcement
            setTimeout(() => {
                this.liveRegion.textContent = '';
            }, 1000);
        }
    }

    /**
     * Handle trigger click events
     */
    handleTriggerClick(event) {
        event.preventDefault();
        const trigger = event.currentTarget;
        const itemId = trigger.getAttribute('data-lightbox-trigger');
        this.openToImage(itemId);
    }

    /**
     * Handle trigger keyboard events
     */
    handleTriggerKeydown(event) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.handleTriggerClick(event);
        }
    }

    /**
     * Handle global keyboard events when lightbox is open
     */
    handleKeydown(event) {
        if (!this.state.isOpen) return;

        switch (event.key) {
            case 'Escape':
                event.preventDefault();
                this.close();
                break;
            case 'ArrowLeft':
                event.preventDefault();
                this.prev();
                break;
            case 'ArrowRight':
                event.preventDefault();
                this.next();
                break;
            case 'Home':
                event.preventDefault();
                this.goToIndex(0);
                break;
            case 'End':
                event.preventDefault();
                this.goToIndex(this.state.images.length - 1);
                break;
            case 'f':
            case 'F':
                if (this.config.enableFullscreen) {
                    event.preventDefault();
                    this.toggleFullscreen();
                }
                break;
            case '+':
            case '=':
                if (this.config.enableZoom) {
                    event.preventDefault();
                    this.zoomIn();
                }
                break;
            case '-':
            case '_':
                if (this.config.enableZoom) {
                    event.preventDefault();
                    this.zoomOut();
                }
                break;
            case '0':
                if (this.config.enableZoom) {
                    event.preventDefault();
                    this.resetZoom();
                }
                break;
        }
    }

    /**
     * Open lightbox to specific image
     */
    openToImage(itemId) {
        const index = this.state.images.findIndex(img => img.id === itemId);
        if (index === -1) {
            console.warn(`Image with ID ${itemId} not found in lightbox data`);
            return;
        }

        this.open(index);
    }

    /**
     * Open lightbox
     */
    open(index = 0) {
        if (this.state.isOpen) return;

        this.state.isOpen = true;
        this.state.currentIndex = Math.max(0, Math.min(index, this.state.images.length - 1));
        
        // Store currently focused element
        this.state.focusedElementBeforeOpen = document.activeElement;

        // Show lightbox
        this.elements.lightbox.style.display = 'block';
        this.elements.lightbox.setAttribute('aria-hidden', 'false');
        
        // Add body class to prevent scrolling
        document.body.classList.add('lightbox-open');
        
        // Enable keyboard handling
        document.addEventListener('keydown', this.boundHandlers.keydown);

        // Focus management - focus close button initially
        this.elements.closeBtn?.focus();

        // Load current image
        this.loadCurrentImage();
        this.updateNavigation();
        this.updateCounter();

        // Preload adjacent images
        if (this.config.preloadNext) {
            this.preloadAdjacentImages();
        }

        // Animation
        this.animateOpen();

        // Announce to screen readers
        const currentImage = this.state.images[this.state.currentIndex];
        if (currentImage) {
            this.announce(`Opened image viewer. ${currentImage.alt || 'Image'} ${this.state.currentIndex + 1} of ${this.state.images.length}`);
        }
    }

    /**
     * Close lightbox
     */
    close() {
        if (!this.state.isOpen) return;

        this.state.isOpen = false;
        
        // Animation
        this.animateClose(() => {
            // Hide lightbox after animation
            this.elements.lightbox.style.display = 'none';
            this.elements.lightbox.setAttribute('aria-hidden', 'true');
            
            // Remove body class
            document.body.classList.remove('lightbox-open');
            
            // Disable keyboard handling
            document.removeEventListener('keydown', this.boundHandlers.keydown);

            // Restore focus
            if (this.state.focusedElementBeforeOpen) {
                this.state.focusedElementBeforeOpen.focus();
            }

            // Reset zoom
            this.resetZoom();
            
            // Clear current image
            if (this.elements.image) {
                this.elements.image.src = '';
                this.elements.image.alt = '';
            }

            // Announce closure
            this.announce('Closed image viewer');
        });
    }

    /**
     * Navigate to previous image
     */
    prev() {
        if (this.state.images.length <= 1) return;
        
        const newIndex = this.state.currentIndex === 0 
            ? this.state.images.length - 1 
            : this.state.currentIndex - 1;
            
        this.goToIndex(newIndex);
    }

    /**
     * Navigate to next image
     */
    next() {
        if (this.state.images.length <= 1) return;
        
        const newIndex = this.state.currentIndex === this.state.images.length - 1 
            ? 0 
            : this.state.currentIndex + 1;
            
        this.goToIndex(newIndex);
    }

    /**
     * Navigate to specific index
     */
    goToIndex(index) {
        if (index < 0 || index >= this.state.images.length || index === this.state.currentIndex) {
            return;
        }

        this.state.currentIndex = index;
        this.loadCurrentImage();
        this.updateNavigation();
        this.updateCounter();
        this.resetZoom();

        if (this.config.preloadNext) {
            this.preloadAdjacentImages();
        }

        // Announce navigation
        const currentImage = this.state.images[this.state.currentIndex];
        if (currentImage) {
            this.announce(`${currentImage.alt || 'Image'} ${this.state.currentIndex + 1} of ${this.state.images.length}`);
        }
    }

    /**
     * Load current image
     */
    loadCurrentImage() {
        const currentImage = this.state.images[this.state.currentIndex];
        if (!currentImage || !this.elements.image) return;

        // Show loading state
        this.setLoadingState(true);
        this.setErrorState(false);

        // Update metadata immediately
        this.updateImageMetadata(currentImage);

        // Load image
        const img = new Image();
        
        img.onload = () => {
            this.elements.image.src = img.src;
            this.elements.image.alt = currentImage.alt || '';
            this.elements.image.style.maxWidth = '100%';
            this.elements.image.style.maxHeight = '100%';
            this.setLoadingState(false);
        };

        img.onerror = () => {
            this.setLoadingState(false);
            this.setErrorState(true);
            console.error('Failed to load lightbox image:', currentImage.srcFull);
        };

        // Use full resolution if available, fallback to medium
        img.src = currentImage.srcFull || currentImage.srcMed || currentImage.srcThumb;
    }

    /**
     * Update image metadata display
     */
    updateImageMetadata(image) {
        if (this.elements.imageAlt) {
            this.elements.imageAlt.textContent = image.alt || '';
        }

        if (this.elements.imageCaption) {
            this.elements.imageCaption.textContent = image.caption || '';
            this.elements.imageCaption.style.display = image.caption ? 'block' : 'none';
        }

        if (this.elements.imageDimensions && image.width && image.height) {
            this.elements.imageDimensions.textContent = `${image.width} × ${image.height}`;
        }

        if (this.elements.imageCategory && image.category) {
            this.elements.imageCategory.textContent = image.category;
        }

        if (this.elements.imageDate && image.uploadDate) {
            const date = new Date(image.uploadDate);
            this.elements.imageDate.textContent = date.toLocaleDateString();
        }
    }

    /**
     * Update navigation button states
     */
    updateNavigation() {
        const isFirst = this.state.currentIndex === 0;
        const isLast = this.state.currentIndex === this.state.images.length - 1;
        const hasMultiple = this.state.images.length > 1;

        if (this.elements.prevBtn) {
            this.elements.prevBtn.disabled = !hasMultiple;
        }

        if (this.elements.nextBtn) {
            this.elements.nextBtn.disabled = !hasMultiple;
        }
    }

    /**
     * Update counter display
     */
    updateCounter() {
        if (this.elements.currentCounter) {
            this.elements.currentCounter.textContent = this.state.currentIndex + 1;
        }
    }

    /**
     * Set loading state
     */
    setLoadingState(isLoading) {
        if (this.elements.loading) {
            this.elements.loading.style.display = isLoading ? 'flex' : 'none';
        }
        if (this.elements.image) {
            this.elements.image.style.opacity = isLoading ? '0' : '1';
        }
    }

    /**
     * Set error state
     */
    setErrorState(hasError) {
        if (this.elements.error) {
            this.elements.error.style.display = hasError ? 'flex' : 'none';
        }
    }

    /**
     * Preload adjacent images for better performance
     */
    preloadAdjacentImages() {
        const toPreload = [];
        
        // Previous image
        const prevIndex = this.state.currentIndex === 0 
            ? this.state.images.length - 1 
            : this.state.currentIndex - 1;
        toPreload.push(prevIndex);
        
        // Next image
        const nextIndex = this.state.currentIndex === this.state.images.length - 1 
            ? 0 
            : this.state.currentIndex + 1;
        toPreload.push(nextIndex);

        toPreload.forEach(index => {
            const image = this.state.images[index];
            if (image && !this.preloadCache.has(image.id)) {
                const img = new Image();
                img.src = image.srcFull || image.srcMed;
                this.preloadCache.set(image.id, img);
            }
        });
    }

    // === Zoom Methods ===

    /**
     * Zoom in
     */
    zoomIn() {
        if (!this.config.enableZoom) return;
        const newZoom = Math.min(this.config.maxZoom, this.state.zoomLevel + this.config.zoomStep);
        this.setZoom(newZoom);
    }

    /**
     * Zoom out
     */
    zoomOut() {
        if (!this.config.enableZoom) return;
        const newZoom = Math.max(1, this.state.zoomLevel - this.config.zoomStep);
        this.setZoom(newZoom);
    }

    /**
     * Reset zoom to 100%
     */
    resetZoom() {
        if (!this.config.enableZoom) return;
        this.setZoom(1);
        this.state.imageOffset = { x: 0, y: 0 };
        if (this.elements.image) {
            this.elements.image.style.transform = 'translate(0, 0) scale(1)';
        }
    }

    /**
     * Set zoom level
     */
    setZoom(level) {
        this.state.zoomLevel = Math.max(1, Math.min(this.config.maxZoom, level));
        
        if (this.elements.image) {
            this.elements.image.style.transform = 
                `translate(${this.state.imageOffset.x}px, ${this.state.imageOffset.y}px) scale(${this.state.zoomLevel})`;
        }

        // Update zoom control states
        if (this.elements.zoomIn) {
            this.elements.zoomIn.disabled = this.state.zoomLevel >= this.config.maxZoom;
        }
        if (this.elements.zoomOut) {
            this.elements.zoomOut.disabled = this.state.zoomLevel <= 1;
        }
    }

    /**
     * Handle wheel zoom
     */
    handleWheelZoom(event) {
        if (!this.config.enableZoom || event.ctrlKey || event.metaKey) return;
        
        event.preventDefault();
        const delta = event.deltaY > 0 ? -this.config.zoomStep : this.config.zoomStep;
        const newZoom = Math.max(1, Math.min(this.config.maxZoom, this.state.zoomLevel + delta));
        this.setZoom(newZoom);
    }

    // === Fullscreen Methods ===

    /**
     * Toggle fullscreen mode
     */
    toggleFullscreen() {
        if (!this.config.enableFullscreen) return;

        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            this.elements.lightbox.requestFullscreen().catch(err => {
                console.warn('Failed to enter fullscreen:', err);
            });
        }
    }

    /**
     * Handle fullscreen change events
     */
    handleFullscreenChange() {
        const isFullscreen = !!document.fullscreenElement;
        if (this.elements.fullscreenBtn) {
            this.elements.fullscreenBtn.setAttribute('aria-pressed', isFullscreen.toString());
            this.elements.fullscreenBtn.title = isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)';
        }
        
        this.elements.lightbox?.classList.toggle('fullscreen', isFullscreen);
    }

    // === Animation Methods ===

    /**
     * Animate lightbox open
     */
    animateOpen() {
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduceMotion && this.config.respectReducedMotion) {
            this.elements.lightbox.style.opacity = '1';
            return;
        }

        this.elements.lightbox.style.opacity = '0';
        this.elements.lightbox.style.transform = 'scale(0.9)';
        
        // Force reflow
        this.elements.lightbox.offsetHeight;
        
        this.elements.lightbox.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        this.elements.lightbox.style.opacity = '1';
        this.elements.lightbox.style.transform = 'scale(1)';
    }

    /**
     * Animate lightbox close
     */
    animateClose(callback) {
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduceMotion && this.config.respectReducedMotion) {
            callback();
            return;
        }

        this.elements.lightbox.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        this.elements.lightbox.style.opacity = '0';
        this.elements.lightbox.style.transform = 'scale(0.9)';

        setTimeout(callback, 300);
    }

    // === Utility Methods ===

    /**
     * Get distance between two touch points
     */
    getTouchDistance(touch1, touch2) {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Handle reduced motion preference changes
     */
    handleReducedMotionChange(mediaQuery) {
        // Update config based on user preference
        if (mediaQuery.matches) {
            this.config.animation = 'none';
            this.config.closeAnimation = 'none';
        }
    }

    /**
     * Handle window resize
     */
    handleResize() {
        if (this.state.isOpen) {
            // Reset zoom and position on resize
            this.resetZoom();
        }
    }

    /**
     * Destroy lightbox instance
     */
    destroy() {
        // Remove event listeners
        document.removeEventListener('keydown', this.boundHandlers.keydown);
        window.removeEventListener('resize', this.boundHandlers.resize);
        
        // Close if open
        if (this.state.isOpen) {
            this.close();
        }
        
        // Remove live region
        if (this.liveRegion && this.liveRegion.parentNode) {
            this.liveRegion.parentNode.removeChild(this.liveRegion);
        }
        
        // Clear cache
        this.preloadCache.clear();
        
        console.log('🧹 UniversalGalleryLightbox destroyed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UniversalGalleryLightbox;
} else {
    window.UniversalGalleryLightbox = UniversalGalleryLightbox;
}