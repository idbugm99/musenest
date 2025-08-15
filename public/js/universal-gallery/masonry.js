/**
 * Universal Gallery Masonry Layout Module
 * 
 * Provides responsive masonry layout for gallery images with optimized performance
 * and accessibility. Supports dynamic resizing, lazy loading integration, and
 * smooth animations.
 * 
 * Features:
 * - Responsive masonry layout
 * - CSS Grid and flexbox fallbacks
 * - Intersection Observer for performance
 * - Smooth animations with reduced motion support
 * - Dynamic content updates
 * - Touch-friendly spacing
 * - RTL language support
 */

class UniversalGalleryMasonry {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        
        if (!this.container) {
            throw new Error('Masonry container not found');
        }

        this.config = {
            columnWidth: 280,           // Base column width in pixels
            gutter: 20,                 // Gap between items
            minColumns: 1,              // Minimum number of columns
            maxColumns: 6,              // Maximum number of columns
            fitWidth: true,             // Center the grid if there's extra space
            animationDuration: 300,     // Animation duration in milliseconds
            staggerDelay: 50,           // Stagger animation delay between items
            useTransform: true,         // Use transform for positioning (better performance)
            respectReducedMotion: true, // Respect prefers-reduced-motion
            enableResizeObserver: true, // Use ResizeObserver for container changes
            enableIntersectionObserver: true, // Use IntersectionObserver for performance
            ...options
        };

        this.state = {
            isInitialized: false,
            columns: 0,
            columnHeights: [],
            itemPositions: new Map(),
            isAnimating: false,
            isRTL: false,
            containerWidth: 0,
            items: []
        };

        this.observers = {
            resize: null,
            intersection: null
        };

        this.boundHandlers = {};
        this.resizeTimeout = null;
        
        this.init();
    }

    /**
     * Initialize masonry layout
     */
    init() {
        this.detectRTL();
        this.findItems();
        this.setupObservers();
        this.bindEvents();
        this.calculateLayout();
        this.positionItems();
        
        this.state.isInitialized = true;
        
        // Emit custom event
        this.container.dispatchEvent(new CustomEvent('masonry:initialized', {
            detail: { masonry: this }
        }));
        
        console.log('✅ UniversalGalleryMasonry initialized');
    }

    /**
     * Detect RTL language direction
     */
    detectRTL() {
        const containerStyle = window.getComputedStyle(this.container);
        this.state.isRTL = containerStyle.direction === 'rtl';
        
        // Also check HTML dir attribute
        const htmlDir = document.documentElement.getAttribute('dir');
        if (htmlDir === 'rtl') {
            this.state.isRTL = true;
        }
    }

    /**
     * Find masonry items in container
     */
    findItems() {
        this.state.items = Array.from(this.container.querySelectorAll('.gallery-item'));
        
        // Set initial styles for items
        this.state.items.forEach((item, index) => {
            if (this.config.useTransform) {
                item.style.position = 'absolute';
                item.style.top = '0';
                item.style.left = '0';
            }
            
            // Add data attribute for identification
            if (!item.dataset.masonryIndex) {
                item.dataset.masonryIndex = index.toString();
            }
        });
    }

    /**
     * Setup observers for performance and responsiveness
     */
    setupObservers() {
        // Resize Observer for container size changes
        if (this.config.enableResizeObserver && 'ResizeObserver' in window) {
            this.observers.resize = new ResizeObserver(entries => {
                for (let entry of entries) {
                    if (entry.target === this.container) {
                        this.handleResize();
                    }
                }
            });
            this.observers.resize.observe(this.container);
        }

        // Intersection Observer for performance optimization
        if (this.config.enableIntersectionObserver && 'IntersectionObserver' in window) {
            this.observers.intersection = new IntersectionObserver(
                this.handleIntersection.bind(this),
                {
                    rootMargin: '100px 0px',
                    threshold: [0, 0.1]
                }
            );

            // Observe all items
            this.state.items.forEach(item => {
                this.observers.intersection.observe(item);
            });
        }
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Window resize (fallback if ResizeObserver not available)
        if (!this.config.enableResizeObserver || !('ResizeObserver' in window)) {
            this.boundHandlers.resize = this.handleResize.bind(this);
            window.addEventListener('resize', this.boundHandlers.resize);
        }

        // Reduced motion preference
        if (this.config.respectReducedMotion) {
            const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
            this.boundHandlers.reducedMotion = this.handleReducedMotionChange.bind(this);
            mediaQuery.addEventListener('change', this.boundHandlers.reducedMotion);
            this.handleReducedMotionChange(mediaQuery);
        }

        // Image load events for dynamic sizing
        this.state.items.forEach(item => {
            const img = item.querySelector('img');
            if (img) {
                if (img.complete) {
                    this.handleImageLoad(item);
                } else {
                    img.addEventListener('load', () => this.handleImageLoad(item));
                    img.addEventListener('error', () => this.handleImageLoad(item));
                }
            }
        });
    }

    /**
     * Handle window/container resize
     */
    handleResize() {
        // Debounce resize events
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
            const newWidth = this.container.offsetWidth;
            
            // Only recalculate if width actually changed
            if (newWidth !== this.state.containerWidth) {
                this.calculateLayout();
                this.positionItems();
            }
        }, 150);
    }

    /**
     * Handle intersection observer changes
     */
    handleIntersection(entries) {
        entries.forEach(entry => {
            const item = entry.target;
            
            // Add/remove visibility classes for potential optimization
            if (entry.isIntersecting) {
                item.classList.add('masonry-visible');
                
                // Trigger any lazy loading if needed
                const img = item.querySelector('img[data-src]');
                if (img) {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                }
            } else {
                item.classList.remove('masonry-visible');
            }
        });
    }

    /**
     * Handle reduced motion preference changes
     */
    handleReducedMotionChange(mediaQuery) {
        if (mediaQuery.matches) {
            this.config.animationDuration = 0;
            this.config.staggerDelay = 0;
        } else {
            // Restore original animation settings
            this.config.animationDuration = 300;
            this.config.staggerDelay = 50;
        }
    }

    /**
     * Handle image load events
     */
    handleImageLoad(item) {
        // Re-position this item and subsequent items
        this.repositionFromItem(item);
    }

    /**
     * Calculate layout dimensions and column count
     */
    calculateLayout() {
        this.state.containerWidth = this.container.offsetWidth;
        
        // Calculate number of columns
        const availableWidth = this.state.containerWidth;
        const columnWidthWithGutter = this.config.columnWidth + this.config.gutter;
        
        let columns = Math.floor(availableWidth / columnWidthWithGutter);
        
        // Apply min/max constraints
        columns = Math.max(this.config.minColumns, columns);
        columns = Math.min(this.config.maxColumns, columns);
        
        this.state.columns = columns;
        
        // Initialize column heights
        this.state.columnHeights = new Array(columns).fill(0);
        
        // Set container positioning
        if (this.config.useTransform) {
            this.container.style.position = 'relative';
        }
        
        // Calculate actual column width (responsive)
        const totalGutterWidth = (columns - 1) * this.config.gutter;
        const actualColumnWidth = (availableWidth - totalGutterWidth) / columns;
        
        this.actualColumnWidth = Math.max(200, actualColumnWidth); // Minimum width
        
        // Center the grid if fitWidth is enabled
        if (this.config.fitWidth) {
            const totalGridWidth = (columns * this.actualColumnWidth) + ((columns - 1) * this.config.gutter);
            this.gridOffset = Math.max(0, (availableWidth - totalGridWidth) / 2);
        } else {
            this.gridOffset = 0;
        }
    }

    /**
     * Position all items in the masonry layout
     */
    positionItems() {
        if (!this.state.items.length) return;

        this.state.isAnimating = true;
        this.state.columnHeights.fill(0);

        this.state.items.forEach((item, index) => {
            this.positionItem(item, index);
        });

        // Update container height
        const maxHeight = Math.max(...this.state.columnHeights);
        this.container.style.height = `${maxHeight}px`;

        // Animation complete
        setTimeout(() => {
            this.state.isAnimating = false;
            this.container.dispatchEvent(new CustomEvent('masonry:layoutComplete', {
                detail: { masonry: this }
            }));
        }, this.config.animationDuration + (this.state.items.length * this.config.staggerDelay));
    }

    /**
     * Position a single item
     */
    positionItem(item, index) {
        // Find shortest column
        const shortestColumnIndex = this.state.columnHeights.indexOf(
            Math.min(...this.state.columnHeights)
        );

        // Calculate position
        const x = this.gridOffset + (shortestColumnIndex * (this.actualColumnWidth + this.config.gutter));
        const y = this.state.columnHeights[shortestColumnIndex];

        // Set item dimensions
        item.style.width = `${this.actualColumnWidth}px`;

        // Get item height (including margins/padding)
        const itemRect = item.getBoundingClientRect();
        const itemHeight = item.offsetHeight || itemRect.height;

        // Apply RTL adjustment if needed
        const finalX = this.state.isRTL ? this.state.containerWidth - x - this.actualColumnWidth : x;

        // Store position
        this.state.itemPositions.set(item, { x: finalX, y, column: shortestColumnIndex });

        // Apply position
        if (this.config.useTransform) {
            const delay = this.config.staggerDelay * index;
            const duration = this.config.animationDuration;
            
            item.style.transform = `translate(${finalX}px, ${y}px)`;
            
            if (duration > 0) {
                item.style.transition = `transform ${duration}ms ease ${delay}ms, opacity ${duration}ms ease ${delay}ms`;
                
                // Fade in animation for new items
                if (!item.classList.contains('masonry-positioned')) {
                    item.style.opacity = '0';
                    setTimeout(() => {
                        item.style.opacity = '1';
                        item.classList.add('masonry-positioned');
                    }, delay);
                }
            } else {
                item.classList.add('masonry-positioned');
            }
        } else {
            // CSS positioning fallback
            item.style.position = 'absolute';
            item.style.left = `${finalX}px`;
            item.style.top = `${y}px`;
            item.classList.add('masonry-positioned');
        }

        // Update column height
        this.state.columnHeights[shortestColumnIndex] = y + itemHeight + this.config.gutter;
    }

    /**
     * Reposition items starting from a specific item
     */
    repositionFromItem(changedItem) {
        const changedIndex = parseInt(changedItem.dataset.masonryIndex);
        if (isNaN(changedIndex)) return;

        // Get the column of the changed item
        const position = this.state.itemPositions.get(changedItem);
        if (!position) return;

        // Reset heights from this column onwards
        for (let i = position.column; i < this.state.columnHeights.length; i++) {
            this.state.columnHeights[i] = 0;
        }

        // Recalculate positions for items from this point
        for (let i = changedIndex; i < this.state.items.length; i++) {
            this.positionItem(this.state.items[i], i);
        }

        // Update container height
        const maxHeight = Math.max(...this.state.columnHeights);
        this.container.style.height = `${maxHeight}px`;
    }

    /**
     * Add new items to the masonry layout
     */
    addItems(newItems) {
        if (!Array.isArray(newItems)) {
            newItems = [newItems];
        }

        newItems.forEach(item => {
            if (typeof item === 'string') {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = item;
                item = tempDiv.firstElementChild;
            }

            if (item && item.nodeType === Node.ELEMENT_NODE) {
                // Set initial styles
                if (this.config.useTransform) {
                    item.style.position = 'absolute';
                    item.style.top = '0';
                    item.style.left = '0';
                    item.style.opacity = '0';
                }

                // Add to container
                this.container.appendChild(item);
                
                // Add to items array
                const index = this.state.items.length;
                item.dataset.masonryIndex = index.toString();
                this.state.items.push(item);

                // Observe with intersection observer
                if (this.observers.intersection) {
                    this.observers.intersection.observe(item);
                }

                // Set up image load listener
                const img = item.querySelector('img');
                if (img) {
                    if (img.complete) {
                        this.handleImageLoad(item);
                    } else {
                        img.addEventListener('load', () => this.handleImageLoad(item));
                        img.addEventListener('error', () => this.handleImageLoad(item));
                    }
                }

                // Position the new item
                setTimeout(() => {
                    this.positionItem(item, index);
                }, 50);
            }
        });

        // Update container height
        setTimeout(() => {
            const maxHeight = Math.max(...this.state.columnHeights);
            this.container.style.height = `${maxHeight}px`;
        }, this.config.animationDuration);

        // Emit event
        this.container.dispatchEvent(new CustomEvent('masonry:itemsAdded', {
            detail: { items: newItems, masonry: this }
        }));
    }

    /**
     * Remove items from the masonry layout
     */
    removeItems(itemsToRemove) {
        if (!Array.isArray(itemsToRemove)) {
            itemsToRemove = [itemsToRemove];
        }

        itemsToRemove.forEach(item => {
            const index = this.state.items.indexOf(item);
            if (index !== -1) {
                // Remove from observers
                if (this.observers.intersection) {
                    this.observers.intersection.unobserve(item);
                }

                // Animate out
                if (this.config.useTransform && this.config.animationDuration > 0) {
                    item.style.transition = `opacity ${this.config.animationDuration}ms ease, transform ${this.config.animationDuration}ms ease`;
                    item.style.opacity = '0';
                    item.style.transform += ' scale(0.8)';
                    
                    setTimeout(() => {
                        if (item.parentNode) {
                            item.parentNode.removeChild(item);
                        }
                    }, this.config.animationDuration);
                } else {
                    if (item.parentNode) {
                        item.parentNode.removeChild(item);
                    }
                }

                // Remove from arrays and maps
                this.state.items.splice(index, 1);
                this.state.itemPositions.delete(item);

                // Update indices for remaining items
                for (let i = index; i < this.state.items.length; i++) {
                    this.state.items[i].dataset.masonryIndex = i.toString();
                }
            }
        });

        // Recalculate layout
        setTimeout(() => {
            this.calculateLayout();
            this.positionItems();
        }, this.config.animationDuration);

        // Emit event
        this.container.dispatchEvent(new CustomEvent('masonry:itemsRemoved', {
            detail: { items: itemsToRemove, masonry: this }
        }));
    }

    /**
     * Refresh the masonry layout
     */
    refresh() {
        this.findItems();
        this.calculateLayout();
        this.positionItems();
        
        this.container.dispatchEvent(new CustomEvent('masonry:refreshed', {
            detail: { masonry: this }
        }));
    }

    /**
     * Update configuration options
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.refresh();
    }

    /**
     * Get current layout information
     */
    getLayoutInfo() {
        return {
            columns: this.state.columns,
            containerWidth: this.state.containerWidth,
            columnWidth: this.actualColumnWidth,
            gutter: this.config.gutter,
            totalItems: this.state.items.length,
            isAnimating: this.state.isAnimating,
            columnHeights: [...this.state.columnHeights]
        };
    }

    /**
     * Destroy the masonry instance
     */
    destroy() {
        // Remove event listeners
        if (this.boundHandlers.resize) {
            window.removeEventListener('resize', this.boundHandlers.resize);
        }

        if (this.boundHandlers.reducedMotion) {
            const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
            mediaQuery.removeEventListener('change', this.boundHandlers.reducedMotion);
        }

        // Disconnect observers
        if (this.observers.resize) {
            this.observers.resize.disconnect();
        }

        if (this.observers.intersection) {
            this.observers.intersection.disconnect();
        }

        // Clear timeouts
        clearTimeout(this.resizeTimeout);

        // Reset item styles
        this.state.items.forEach(item => {
            item.style.position = '';
            item.style.top = '';
            item.style.left = '';
            item.style.transform = '';
            item.style.transition = '';
            item.style.width = '';
            item.style.opacity = '';
            item.classList.remove('masonry-positioned', 'masonry-visible');
            delete item.dataset.masonryIndex;
        });

        // Reset container
        this.container.style.height = '';
        this.container.style.position = '';

        // Clear state
        this.state.itemPositions.clear();
        this.state.items = [];

        this.container.dispatchEvent(new CustomEvent('masonry:destroyed', {
            detail: { masonry: this }
        }));

        console.log('🧹 UniversalGalleryMasonry destroyed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UniversalGalleryMasonry;
} else {
    window.UniversalGalleryMasonry = UniversalGalleryMasonry;
}