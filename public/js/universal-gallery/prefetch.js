/**
 * Universal Gallery Prefetch Module
 * 
 * Intelligent image preloading system for gallery performance optimization.
 * Uses Intersection Observer, requestIdleCallback, and connection-aware loading
 * to provide smooth user experience while respecting bandwidth constraints.
 * 
 * Features:
 * - Intersection Observer for smart prefetching
 * - Connection-aware loading (respects slow connections)
 * - Priority-based queue system
 * - Memory management and cleanup
 * - Save Data API support
 * - Battery API consideration
 * - Configurable strategies (aggressive, balanced, conservative)
 * - Cache management with size limits
 * - Error handling and retry logic
 */

class UniversalGalleryPrefetch {
    constructor(options = {}) {
        this.config = {
            // Prefetch strategy: 'aggressive', 'balanced', 'conservative'
            strategy: 'balanced',
            
            // Maximum number of concurrent prefetch requests
            maxConcurrent: 3,
            
            // Maximum cache size (number of images)
            maxCacheSize: 50,
            
            // Intersection Observer margins
            rootMargin: {
                aggressive: '200px',
                balanced: '100px',
                conservative: '50px'
            },
            
            // Threshold for intersection visibility
            threshold: [0.1, 0.25, 0.5],
            
            // Respect Save Data API
            respectSaveData: true,
            
            // Respect reduced motion preference
            respectReducedMotion: true,
            
            // Connection type thresholds
            connectionThresholds: {
                slow: ['2g', 'slow-2g'],
                medium: ['3g'],
                fast: ['4g']
            },
            
            // Retry configuration
            maxRetries: 3,
            retryDelay: 1000,
            
            // Priority levels
            priorities: {
                IMMEDIATE: 1,    // Currently visible
                HIGH: 2,         // Next/previous in lightbox
                MEDIUM: 3,       // In viewport soon
                LOW: 4,          // Background prefetch
                IDLE: 5          // When browser is idle
            },
            
            // Image size preferences by connection speed
            imageSizePreference: {
                slow: 'thumbnail',
                medium: 'medium',
                fast: 'full'
            },

            ...options
        };

        this.state = {
            isEnabled: true,
            cache: new Map(),
            prefetchQueue: new Map(),
            currentRequests: new Set(),
            failedUrls: new Map(),
            connectionType: 'fast',
            saveDataEnabled: false,
            batteryLow: false,
            observedElements: new WeakSet()
        };

        this.observers = {
            intersection: null,
            connection: null
        };

        this.boundHandlers = {};
        
        this.init();
    }

    /**
     * Initialize prefetch system
     */
    init() {
        this.detectCapabilities();
        this.setupIntersectionObserver();
        this.setupNetworkObserver();
        this.setupBatteryObserver();
        this.bindEvents();
        this.applyStrategy();
        
        console.log('✅ UniversalGalleryPrefetch initialized with strategy:', this.config.strategy);
    }

    /**
     * Detect browser capabilities and user preferences
     */
    detectCapabilities() {
        // Check Save Data API
        if (navigator.connection && navigator.connection.saveData) {
            this.state.saveDataEnabled = true;
            if (this.config.respectSaveData) {
                this.config.strategy = 'conservative';
                console.log('📱 Save Data enabled - switching to conservative strategy');
            }
        }

        // Check reduced motion preference
        if (this.config.respectReducedMotion) {
            const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
            if (mediaQuery.matches) {
                this.config.strategy = 'conservative';
            }
        }

        // Detect connection type
        if (navigator.connection) {
            this.updateConnectionType();
        }
    }

    /**
     * Setup Intersection Observer for smart prefetching
     */
    setupIntersectionObserver() {
        if (!('IntersectionObserver' in window)) {
            console.warn('IntersectionObserver not supported - falling back to basic prefetch');
            return;
        }

        const rootMargin = this.config.rootMargin[this.config.strategy];
        
        this.observers.intersection = new IntersectionObserver(
            this.handleIntersection.bind(this),
            {
                rootMargin,
                threshold: this.config.threshold
            }
        );
    }

    /**
     * Setup network connection observer
     */
    setupNetworkObserver() {
        if (!navigator.connection) return;

        this.updateConnectionType();
        
        this.observers.connection = () => this.updateConnectionType();
        navigator.connection.addEventListener('change', this.observers.connection);
    }

    /**
     * Setup battery observer for low battery detection
     */
    async setupBatteryObserver() {
        if (!('getBattery' in navigator)) return;

        try {
            const battery = await navigator.getBattery();
            
            const updateBatteryStatus = () => {
                this.state.batteryLow = !battery.charging && battery.level < 0.2;
                this.adjustStrategyForBattery();
            };

            battery.addEventListener('chargingchange', updateBatteryStatus);
            battery.addEventListener('levelchange', updateBatteryStatus);
            updateBatteryStatus();
        } catch (error) {
            console.warn('Battery API not available:', error);
        }
    }

    /**
     * Bind global event listeners
     */
    bindEvents() {
        // Page visibility changes
        this.boundHandlers.visibilityChange = () => {
            if (document.hidden) {
                this.pausePrefetching();
            } else {
                this.resumePrefetching();
            }
        };
        document.addEventListener('visibilitychange', this.boundHandlers.visibilityChange);

        // Memory pressure warnings (if supported)
        if ('memory' in performance) {
            this.boundHandlers.memoryPressure = () => {
                if (performance.memory.usedJSHeapSize > performance.memory.jsHeapSizeLimit * 0.8) {
                    this.clearOldCache();
                }
            };
            setInterval(this.boundHandlers.memoryPressure, 30000); // Check every 30 seconds
        }
    }

    /**
     * Update connection type and adjust strategy
     */
    updateConnectionType() {
        if (!navigator.connection) return;

        const effectiveType = navigator.connection.effectiveType;
        
        if (this.config.connectionThresholds.slow.includes(effectiveType)) {
            this.state.connectionType = 'slow';
        } else if (this.config.connectionThresholds.medium.includes(effectiveType)) {
            this.state.connectionType = 'medium';
        } else {
            this.state.connectionType = 'fast';
        }

        // Adjust strategy based on connection
        if (this.state.connectionType === 'slow' && !this.state.saveDataEnabled) {
            this.config.strategy = 'conservative';
        }

        console.log(`📶 Connection type: ${this.state.connectionType} (${effectiveType})`);
    }

    /**
     * Adjust strategy based on battery level
     */
    adjustStrategyForBattery() {
        if (this.state.batteryLow && this.config.strategy !== 'conservative') {
            this.config.strategy = 'conservative';
            this.config.maxConcurrent = 1;
            console.log('🔋 Low battery detected - switching to conservative strategy');
        }
    }

    /**
     * Apply prefetch strategy settings
     */
    applyStrategy() {
        switch (this.config.strategy) {
            case 'aggressive':
                this.config.maxConcurrent = 5;
                this.config.maxCacheSize = 100;
                break;
            case 'balanced':
                this.config.maxConcurrent = 3;
                this.config.maxCacheSize = 50;
                break;
            case 'conservative':
                this.config.maxConcurrent = 1;
                this.config.maxCacheSize = 20;
                break;
        }
    }

    /**
     * Handle intersection observer entries
     */
    handleIntersection(entries) {
        entries.forEach(entry => {
            const element = entry.target;
            const imageData = this.extractImageData(element);
            
            if (!imageData) return;

            if (entry.isIntersecting) {
                // Determine priority based on intersection ratio
                let priority;
                if (entry.intersectionRatio >= 0.5) {
                    priority = this.config.priorities.HIGH;
                } else if (entry.intersectionRatio >= 0.25) {
                    priority = this.config.priorities.MEDIUM;
                } else {
                    priority = this.config.priorities.LOW;
                }

                this.queuePrefetch(imageData, priority);
            } else {
                // Remove from queue if no longer visible
                this.removePrefetch(imageData.id);
            }
        });

        this.processPrefetchQueue();
    }

    /**
     * Extract image data from DOM element
     */
    extractImageData(element) {
        const img = element.querySelector('img');
        if (!img) return null;

        const itemData = element.querySelector('.lightbox-item-data');
        let data = null;

        if (itemData) {
            try {
                data = JSON.parse(itemData.textContent);
            } catch (error) {
                console.warn('Failed to parse item data:', error);
            }
        }

        // Fallback to DOM attributes
        if (!data) {
            data = {
                id: element.dataset.galleryItem || Math.random().toString(36).substr(2, 9),
                srcThumb: img.src,
                srcMed: img.dataset.srcMedium,
                srcFull: img.dataset.srcFull,
                alt: img.alt
            };
        }

        return data;
    }

    /**
     * Queue image for prefetching
     */
    queuePrefetch(imageData, priority = this.config.priorities.MEDIUM) {
        if (!this.state.isEnabled) return;

        const preferredSize = this.config.imageSizePreference[this.state.connectionType];
        const urlToFetch = this.selectImageUrl(imageData, preferredSize);
        
        if (!urlToFetch || this.state.cache.has(urlToFetch)) return;

        const queueItem = {
            id: imageData.id,
            url: urlToFetch,
            priority,
            imageData,
            attempts: 0,
            addedAt: Date.now()
        };

        this.state.prefetchQueue.set(imageData.id, queueItem);
    }

    /**
     * Select appropriate image URL based on connection and preferences
     */
    selectImageUrl(imageData, preferredSize) {
        switch (preferredSize) {
            case 'thumbnail':
                return imageData.srcThumb;
            case 'medium':
                return imageData.srcMed || imageData.srcThumb;
            case 'full':
                return imageData.srcFull || imageData.srcMed || imageData.srcThumb;
            default:
                return imageData.srcThumb;
        }
    }

    /**
     * Remove item from prefetch queue
     */
    removePrefetch(itemId) {
        this.state.prefetchQueue.delete(itemId);
    }

    /**
     * Process the prefetch queue
     */
    processPrefetchQueue() {
        if (!this.state.isEnabled || this.state.currentRequests.size >= this.config.maxConcurrent) {
            return;
        }

        // Sort queue by priority and age
        const sortedItems = Array.from(this.state.prefetchQueue.values())
            .sort((a, b) => {
                if (a.priority !== b.priority) {
                    return a.priority - b.priority; // Lower number = higher priority
                }
                return a.addedAt - b.addedAt; // Older items first
            });

        // Process items up to concurrent limit
        const itemsToProcess = sortedItems.slice(0, this.config.maxConcurrent - this.state.currentRequests.size);
        
        itemsToProcess.forEach(item => {
            if (this.canPrefetch()) {
                this.prefetchImage(item);
            }
        });
    }

    /**
     * Check if prefetching is currently allowed
     */
    canPrefetch() {
        return this.state.isEnabled && 
               !document.hidden && 
               this.state.currentRequests.size < this.config.maxConcurrent &&
               (!this.state.saveDataEnabled || this.config.strategy === 'aggressive');
    }

    /**
     * Prefetch individual image
     */
    async prefetchImage(queueItem) {
        const { id, url, imageData } = queueItem;
        
        // Check if already cached or currently being fetched
        if (this.state.cache.has(url) || this.state.currentRequests.has(url)) {
            this.state.prefetchQueue.delete(id);
            return;
        }

        // Check failure count
        const failureCount = this.state.failedUrls.get(url) || 0;
        if (failureCount >= this.config.maxRetries) {
            this.state.prefetchQueue.delete(id);
            return;
        }

        this.state.currentRequests.add(url);
        queueItem.attempts++;

        try {
            const img = new Image();
            
            // Set up promise for image loading
            const loadPromise = new Promise((resolve, reject) => {
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('Image failed to load'));
                
                // Timeout for slow connections
                const timeout = this.state.connectionType === 'slow' ? 10000 : 5000;
                setTimeout(() => reject(new Error('Image load timeout')), timeout);
            });

            // Start loading
            img.src = url;
            
            // Wait for load completion
            const loadedImg = await loadPromise;
            
            // Store in cache
            this.addToCache(url, {
                image: loadedImg,
                imageData,
                cachedAt: Date.now(),
                size: this.estimateImageSize(loadedImg)
            });

            // Remove from queue
            this.state.prefetchQueue.delete(id);

            // Dispatch success event
            this.dispatchPrefetchEvent('prefetch:success', { url, imageData });

        } catch (error) {
            console.warn(`Prefetch failed for ${url}:`, error.message);
            
            // Increment failure count
            this.state.failedUrls.set(url, failureCount + 1);
            
            // Retry with exponential backoff if not at max attempts
            if (queueItem.attempts < this.config.maxRetries) {
                const delay = this.config.retryDelay * Math.pow(2, queueItem.attempts - 1);
                setTimeout(() => {
                    if (this.state.prefetchQueue.has(id)) {
                        this.processPrefetchQueue();
                    }
                }, delay);
            } else {
                this.state.prefetchQueue.delete(id);
            }

            this.dispatchPrefetchEvent('prefetch:error', { url, imageData, error });
            
        } finally {
            this.state.currentRequests.delete(url);
            
            // Continue processing queue
            requestIdleCallback(() => {
                this.processPrefetchQueue();
            });
        }
    }

    /**
     * Add image to cache with size management
     */
    addToCache(url, cacheItem) {
        // Remove oldest items if cache is full
        while (this.state.cache.size >= this.config.maxCacheSize) {
            const oldestEntry = Array.from(this.state.cache.entries())
                .sort(([,a], [,b]) => a.cachedAt - b.cachedAt)[0];
            
            if (oldestEntry) {
                this.state.cache.delete(oldestEntry[0]);
            }
        }

        this.state.cache.set(url, cacheItem);
    }

    /**
     * Estimate image size for cache management
     */
    estimateImageSize(img) {
        // Rough estimate based on dimensions and assumed bytes per pixel
        return (img.naturalWidth || img.width) * (img.naturalHeight || img.height) * 4; // RGBA
    }

    /**
     * Clear old cache entries based on age and memory pressure
     */
    clearOldCache() {
        const now = Date.now();
        const maxAge = 5 * 60 * 1000; // 5 minutes
        
        for (const [url, cacheItem] of this.state.cache.entries()) {
            if (now - cacheItem.cachedAt > maxAge) {
                this.state.cache.delete(url);
            }
        }
    }

    /**
     * Observe elements for prefetching
     */
    observeElements(elements) {
        if (!this.observers.intersection) return;

        elements.forEach(element => {
            if (!this.state.observedElements.has(element)) {
                this.observers.intersection.observe(element);
                this.state.observedElements.add(element);
            }
        });
    }

    /**
     * Stop observing elements
     */
    unobserveElements(elements) {
        if (!this.observers.intersection) return;

        elements.forEach(element => {
            if (this.state.observedElements.has(element)) {
                this.observers.intersection.unobserve(element);
                this.state.observedElements.delete(element);
            }
        });
    }

    /**
     * Prefetch specific images with high priority (for lightbox navigation)
     */
    prefetchSpecific(imageDataArray, priority = this.config.priorities.HIGH) {
        imageDataArray.forEach(imageData => {
            this.queuePrefetch(imageData, priority);
        });
        
        this.processPrefetchQueue();
    }

    /**
     * Check if image is cached
     */
    isCached(url) {
        return this.state.cache.has(url);
    }

    /**
     * Get cached image
     */
    getCached(url) {
        return this.state.cache.get(url);
    }

    /**
     * Pause prefetching
     */
    pausePrefetching() {
        this.state.isEnabled = false;
        console.log('⏸️ Prefetching paused');
    }

    /**
     * Resume prefetching
     */
    resumePrefetching() {
        this.state.isEnabled = true;
        this.processPrefetchQueue();
        console.log('▶️ Prefetching resumed');
    }

    /**
     * Update prefetch strategy
     */
    updateStrategy(newStrategy) {
        if (['aggressive', 'balanced', 'conservative'].includes(newStrategy)) {
            this.config.strategy = newStrategy;
            this.applyStrategy();
            
            // Update intersection observer with new margins
            if (this.observers.intersection) {
                this.observers.intersection.disconnect();
                this.setupIntersectionObserver();
                
                // Re-observe elements
                const elements = Array.from(this.state.observedElements);
                elements.forEach(element => {
                    this.observers.intersection.observe(element);
                });
            }
            
            console.log(`🔄 Updated prefetch strategy to: ${newStrategy}`);
        }
    }

    /**
     * Get prefetch statistics
     */
    getStats() {
        return {
            cacheSize: this.state.cache.size,
            maxCacheSize: this.config.maxCacheSize,
            queueSize: this.state.prefetchQueue.size,
            currentRequests: this.state.currentRequests.size,
            failedUrls: this.state.failedUrls.size,
            strategy: this.config.strategy,
            connectionType: this.state.connectionType,
            saveDataEnabled: this.state.saveDataEnabled,
            batteryLow: this.state.batteryLow,
            isEnabled: this.state.isEnabled
        };
    }

    /**
     * Dispatch custom prefetch events
     */
    dispatchPrefetchEvent(type, detail) {
        const event = new CustomEvent(type, { detail });
        document.dispatchEvent(event);
    }

    /**
     * Destroy prefetch instance
     */
    destroy() {
        // Pause prefetching
        this.pausePrefetching();
        
        // Disconnect observers
        if (this.observers.intersection) {
            this.observers.intersection.disconnect();
        }

        if (this.observers.connection) {
            navigator.connection.removeEventListener('change', this.observers.connection);
        }

        // Remove event listeners
        if (this.boundHandlers.visibilityChange) {
            document.removeEventListener('visibilitychange', this.boundHandlers.visibilityChange);
        }

        // Clear state
        this.state.cache.clear();
        this.state.prefetchQueue.clear();
        this.state.currentRequests.clear();
        this.state.failedUrls.clear();

        console.log('🧹 UniversalGalleryPrefetch destroyed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UniversalGalleryPrefetch;
} else {
    window.UniversalGalleryPrefetch = UniversalGalleryPrefetch;
}