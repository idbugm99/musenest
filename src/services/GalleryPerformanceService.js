/**
 * Gallery Performance Monitoring Service
 * 
 * Tracks and analyzes gallery performance metrics including:
 * - Core Web Vitals (LCP, FID, CLS)
 * - Image loading performance
 * - User interaction analytics
 * - Cache efficiency metrics
 * - Memory usage tracking
 */

class GalleryPerformanceService {
    constructor() {
        this.metrics = {
            coreWebVitals: {
                lcp: null,
                fid: null,
                cls: null
            },
            imageMetrics: {
                totalImages: 0,
                loadedImages: 0,
                failedImages: 0,
                averageLoadTime: 0,
                largestImageSize: 0,
                totalDataTransfer: 0
            },
            userInteraction: {
                galleryViews: 0,
                imageClicks: 0,
                lightboxOpens: 0,
                averageSessionTime: 0,
                scrollDepth: 0
            },
            cacheMetrics: {
                cacheHits: 0,
                cacheMisses: 0,
                prefetchHits: 0
            },
            performanceTimeline: []
        };

        this.observers = new Map();
        this.sessionStartTime = Date.now();
        this.isMonitoring = false;
    }

    /**
     * Initialize performance monitoring
     */
    init() {
        if (this.isMonitoring) return;
        
        this.setupCoreWebVitalsTracking();
        this.setupImagePerformanceTracking();
        this.setupUserInteractionTracking();
        this.setupMemoryMonitoring();
        this.setupNavigationTracking();
        
        this.isMonitoring = true;
        console.log('📊 Gallery Performance Service initialized');
    }

    /**
     * Setup Core Web Vitals tracking
     */
    setupCoreWebVitalsTracking() {
        // Largest Contentful Paint (LCP)
        if ('PerformanceObserver' in window) {
            const lcpObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                const lastEntry = entries[entries.length - 1];
                
                this.metrics.coreWebVitals.lcp = lastEntry.startTime;
                this.recordMetric('core_web_vitals', {
                    metric: 'lcp',
                    value: lastEntry.startTime,
                    rating: this.getLCPRating(lastEntry.startTime)
                });
            });

            try {
                lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
                this.observers.set('lcp', lcpObserver);
            } catch (e) {
                console.warn('LCP observer not supported');
            }

            // First Input Delay (FID)
            const fidObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    this.metrics.coreWebVitals.fid = entry.processingStart - entry.startTime;
                    this.recordMetric('core_web_vitals', {
                        metric: 'fid',
                        value: entry.processingStart - entry.startTime,
                        rating: this.getFIDRating(entry.processingStart - entry.startTime)
                    });
                }
            });

            try {
                fidObserver.observe({ entryTypes: ['first-input'] });
                this.observers.set('fid', fidObserver);
            } catch (e) {
                console.warn('FID observer not supported');
            }

            // Cumulative Layout Shift (CLS)
            let clsValue = 0;
            let clsEntries = [];
            
            const clsObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    // Only count layout shifts without recent user input
                    if (!entry.hadRecentInput) {
                        clsValue += entry.value;
                        clsEntries.push(entry);
                    }
                }
                
                this.metrics.coreWebVitals.cls = clsValue;
                this.recordMetric('core_web_vitals', {
                    metric: 'cls',
                    value: clsValue,
                    rating: this.getCLSRating(clsValue)
                });
            });

            try {
                clsObserver.observe({ entryTypes: ['layout-shift'] });
                this.observers.set('cls', clsObserver);
            } catch (e) {
                console.warn('CLS observer not supported');
            }
        }
    }

    /**
     * Setup image performance tracking
     */
    setupImagePerformanceTracking() {
        const imageObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                if (entry.initiatorType === 'img') {
                    const loadTime = entry.responseEnd - entry.startTime;
                    const imageSize = entry.transferSize || 0;
                    
                    this.metrics.imageMetrics.totalImages++;
                    this.metrics.imageMetrics.totalDataTransfer += imageSize;
                    
                    if (entry.responseEnd > 0) {
                        this.metrics.imageMetrics.loadedImages++;
                        
                        // Update average load time
                        const currentAvg = this.metrics.imageMetrics.averageLoadTime;
                        const count = this.metrics.imageMetrics.loadedImages;
                        this.metrics.imageMetrics.averageLoadTime = 
                            (currentAvg * (count - 1) + loadTime) / count;
                        
                        // Track largest image
                        if (imageSize > this.metrics.imageMetrics.largestImageSize) {
                            this.metrics.imageMetrics.largestImageSize = imageSize;
                        }
                    }
                    
                    this.recordMetric('image_performance', {
                        url: entry.name,
                        loadTime: loadTime,
                        size: imageSize,
                        success: entry.responseEnd > 0
                    });
                }
            }
        });

        try {
            imageObserver.observe({ entryTypes: ['resource'] });
            this.observers.set('image', imageObserver);
        } catch (e) {
            console.warn('Image performance observer not supported');
        }
    }

    /**
     * Setup user interaction tracking
     */
    setupUserInteractionTracking() {
        // Track gallery views
        const galleryElements = document.querySelectorAll('[data-gallery-container]');
        if (galleryElements.length > 0) {
            this.metrics.userInteraction.galleryViews = galleryElements.length;
        }

        // Track image clicks
        document.addEventListener('click', (e) => {
            if (e.target.matches('.gallery-item img, [data-gallery-image]')) {
                this.metrics.userInteraction.imageClicks++;
                this.recordMetric('user_interaction', {
                    type: 'image_click',
                    timestamp: Date.now(),
                    element: e.target.src || e.target.dataset.src
                });
            }
            
            if (e.target.matches('[data-lightbox], .lightbox-trigger')) {
                this.metrics.userInteraction.lightboxOpens++;
                this.recordMetric('user_interaction', {
                    type: 'lightbox_open',
                    timestamp: Date.now()
                });
            }
        });

        // Track scroll depth
        let maxScrollDepth = 0;
        window.addEventListener('scroll', this.throttle(() => {
            const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollPercent = (scrollTop / scrollHeight) * 100;
            
            if (scrollPercent > maxScrollDepth) {
                maxScrollDepth = scrollPercent;
                this.metrics.userInteraction.scrollDepth = Math.round(scrollPercent);
            }
        }, 100));

        // Track session time
        window.addEventListener('beforeunload', () => {
            this.metrics.userInteraction.averageSessionTime = Date.now() - this.sessionStartTime;
            this.recordMetric('session', {
                duration: this.metrics.userInteraction.averageSessionTime,
                scrollDepth: this.metrics.userInteraction.scrollDepth
            });
        });
    }

    /**
     * Setup memory monitoring
     */
    setupMemoryMonitoring() {
        if ('memory' in performance) {
            const trackMemory = () => {
                const memory = performance.memory;
                this.recordMetric('memory_usage', {
                    usedJSHeapSize: memory.usedJSHeapSize,
                    totalJSHeapSize: memory.totalJSHeapSize,
                    jsHeapSizeLimit: memory.jsHeapSizeLimit,
                    timestamp: Date.now()
                });
            };

            // Track memory every 30 seconds
            setInterval(trackMemory, 30000);
            trackMemory(); // Initial measurement
        }
    }

    /**
     * Setup navigation tracking
     */
    setupNavigationTracking() {
        if ('PerformanceNavigationTiming' in window) {
            const navObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    this.recordMetric('navigation', {
                        dnsLookup: entry.domainLookupEnd - entry.domainLookupStart,
                        tcpConnect: entry.connectEnd - entry.connectStart,
                        serverResponse: entry.responseEnd - entry.requestStart,
                        domInteractive: entry.domInteractive - entry.navigationStart,
                        domComplete: entry.domComplete - entry.navigationStart,
                        loadComplete: entry.loadEventEnd - entry.navigationStart
                    });
                }
            });

            try {
                navObserver.observe({ entryTypes: ['navigation'] });
                this.observers.set('navigation', navObserver);
            } catch (e) {
                console.warn('Navigation timing observer not supported');
            }
        }
    }

    /**
     * Record a performance metric
     */
    recordMetric(category, data) {
        const metric = {
            category,
            data,
            timestamp: Date.now(),
            url: window.location.href,
            userAgent: navigator.userAgent
        };

        this.metrics.performanceTimeline.push(metric);

        // Dispatch custom event for external listeners
        window.dispatchEvent(new CustomEvent('galleryPerformanceMetric', {
            detail: metric
        }));
    }

    /**
     * Track cache performance
     */
    trackCacheHit(resource) {
        this.metrics.cacheMetrics.cacheHits++;
        this.recordMetric('cache_performance', {
            type: 'hit',
            resource: resource,
            timestamp: Date.now()
        });
    }

    /**
     * Track cache miss
     */
    trackCacheMiss(resource) {
        this.metrics.cacheMetrics.cacheMisses++;
        this.recordMetric('cache_performance', {
            type: 'miss',
            resource: resource,
            timestamp: Date.now()
        });
    }

    /**
     * Track prefetch efficiency
     */
    trackPrefetchHit(resource) {
        this.metrics.cacheMetrics.prefetchHits++;
        this.recordMetric('prefetch_performance', {
            type: 'hit',
            resource: resource,
            timestamp: Date.now()
        });
    }

    /**
     * Get current performance report
     */
    getPerformanceReport() {
        return {
            timestamp: Date.now(),
            sessionDuration: Date.now() - this.sessionStartTime,
            coreWebVitals: {
                ...this.metrics.coreWebVitals,
                lcpRating: this.getLCPRating(this.metrics.coreWebVitals.lcp),
                fidRating: this.getFIDRating(this.metrics.coreWebVitals.fid),
                clsRating: this.getCLSRating(this.metrics.coreWebVitals.cls)
            },
            imageMetrics: {
                ...this.metrics.imageMetrics,
                successRate: this.metrics.imageMetrics.totalImages > 0 ? 
                    (this.metrics.imageMetrics.loadedImages / this.metrics.imageMetrics.totalImages) * 100 : 0,
                averageImageSize: this.metrics.imageMetrics.loadedImages > 0 ?
                    this.metrics.imageMetrics.totalDataTransfer / this.metrics.imageMetrics.loadedImages : 0
            },
            userInteraction: this.metrics.userInteraction,
            cacheMetrics: {
                ...this.metrics.cacheMetrics,
                hitRate: (this.metrics.cacheMetrics.cacheHits + this.metrics.cacheMetrics.cacheMisses) > 0 ?
                    (this.metrics.cacheMetrics.cacheHits / (this.metrics.cacheMetrics.cacheHits + this.metrics.cacheMetrics.cacheMisses)) * 100 : 0
            },
            recommendations: this.generateRecommendations()
        };
    }

    /**
     * Generate performance recommendations
     */
    generateRecommendations() {
        const recommendations = [];
        
        // LCP recommendations
        if (this.metrics.coreWebVitals.lcp > 2500) {
            recommendations.push({
                category: 'LCP',
                severity: 'high',
                message: 'Largest Contentful Paint is slow. Consider optimizing images and reducing server response times.',
                value: this.metrics.coreWebVitals.lcp
            });
        }

        // FID recommendations  
        if (this.metrics.coreWebVitals.fid > 100) {
            recommendations.push({
                category: 'FID',
                severity: 'medium',
                message: 'First Input Delay is high. Consider reducing JavaScript execution time.',
                value: this.metrics.coreWebVitals.fid
            });
        }

        // CLS recommendations
        if (this.metrics.coreWebVitals.cls > 0.1) {
            recommendations.push({
                category: 'CLS',
                severity: 'high',
                message: 'Cumulative Layout Shift is high. Ensure images have dimensions and avoid dynamic content injection.',
                value: this.metrics.coreWebVitals.cls
            });
        }

        // Image optimization recommendations
        const avgImageSize = this.metrics.imageMetrics.loadedImages > 0 ?
            this.metrics.imageMetrics.totalDataTransfer / this.metrics.imageMetrics.loadedImages : 0;
        
        if (avgImageSize > 500000) { // 500KB
            recommendations.push({
                category: 'Images',
                severity: 'medium',
                message: 'Average image size is large. Consider image compression and next-gen formats.',
                value: avgImageSize
            });
        }

        // Cache efficiency recommendations
        const hitRate = (this.metrics.cacheMetrics.cacheHits + this.metrics.cacheMetrics.cacheMisses) > 0 ?
            (this.metrics.cacheMetrics.cacheHits / (this.metrics.cacheMetrics.cacheHits + this.metrics.cacheMetrics.cacheMisses)) * 100 : 0;
        
        if (hitRate < 70) {
            recommendations.push({
                category: 'Caching',
                severity: 'medium',
                message: 'Cache hit rate is low. Consider implementing better caching strategies.',
                value: hitRate
            });
        }

        return recommendations;
    }

    /**
     * Export performance data
     */
    exportData() {
        const report = this.getPerformanceReport();
        const exportData = {
            ...report,
            detailedTimeline: this.metrics.performanceTimeline,
            browserInfo: {
                userAgent: navigator.userAgent,
                viewport: `${window.innerWidth}x${window.innerHeight}`,
                devicePixelRatio: window.devicePixelRatio,
                connection: navigator.connection ? {
                    effectiveType: navigator.connection.effectiveType,
                    downlink: navigator.connection.downlink
                } : null
            }
        };

        return exportData;
    }

    /**
     * Send performance data to analytics endpoint
     */
    async sendAnalytics(endpoint = '/api/gallery-performance/analytics') {
        try {
            const data = this.exportData();
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error('Failed to send analytics data');
            }

            console.log('📊 Performance analytics sent successfully');
            return true;
        } catch (error) {
            console.warn('Failed to send performance analytics:', error);
            return false;
        }
    }

    /**
     * Core Web Vitals rating helpers
     */
    getLCPRating(value) {
        if (value === null) return 'unknown';
        if (value <= 2500) return 'good';
        if (value <= 4000) return 'needs-improvement';
        return 'poor';
    }

    getFIDRating(value) {
        if (value === null) return 'unknown';
        if (value <= 100) return 'good';
        if (value <= 300) return 'needs-improvement';
        return 'poor';
    }

    getCLSRating(value) {
        if (value === null) return 'unknown';
        if (value <= 0.1) return 'good';
        if (value <= 0.25) return 'needs-improvement';
        return 'poor';
    }

    /**
     * Utility functions
     */
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * Cleanup observers
     */
    destroy() {
        this.observers.forEach(observer => {
            observer.disconnect();
        });
        this.observers.clear();
        this.isMonitoring = false;
        console.log('📊 Gallery Performance Service destroyed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GalleryPerformanceService;
} else {
    window.GalleryPerformanceService = GalleryPerformanceService;
}