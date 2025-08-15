/**
 * Gallery Analytics Service
 * 
 * Comprehensive analytics and usage reporting for gallery systems.
 * Tracks user behavior, content performance, engagement metrics,
 * and provides actionable insights for optimization.
 */

class GalleryAnalyticsService {
    constructor() {
        this.config = {
            apiBaseUrl: '/api/gallery-analytics',
            trackingEnabled: true,
            sessionTimeout: 30 * 60 * 1000, // 30 minutes
            batchSize: 10,
            flushInterval: 30000 // 30 seconds
        };

        this.state = {
            sessionId: this.generateSessionId(),
            userId: this.getUserId(),
            sessionStart: Date.now(),
            lastActivity: Date.now(),
            eventQueue: [],
            userAgent: navigator.userAgent,
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            },
            referrer: document.referrer,
            utm: this.parseUTMParameters(),
            device: this.getDeviceInfo()
        };

        this.metrics = {
            pageViews: new Map(),
            galleryViews: new Map(),
            imageInteractions: new Map(),
            searchQueries: [],
            filterUsage: new Map(),
            navigationPaths: [],
            conversionEvents: [],
            engagementTimers: new Map(),
            errorEvents: []
        };

        this.observers = new Map();
        this.isInitialized = false;
    }

    /**
     * Initialize analytics service
     */
    init() {
        if (this.isInitialized || !this.config.trackingEnabled) return;

        this.setupEventTracking();
        this.setupIntersectionObserver();
        this.setupPerformanceObserver();
        this.startSessionTracking();
        this.startAutoFlush();
        
        this.trackEvent('session_start', {
            sessionId: this.state.sessionId,
            userAgent: this.state.userAgent,
            viewport: this.state.viewport,
            referrer: this.state.referrer,
            utm: this.state.utm,
            device: this.state.device
        });

        this.isInitialized = true;
        console.log('📈 Gallery Analytics Service initialized');
    }

    /**
     * Setup event tracking
     */
    setupEventTracking() {
        // Track page navigation
        window.addEventListener('beforeunload', () => {
            this.trackSessionEnd();
        });

        // Track visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.trackEvent('page_hidden', { timestamp: Date.now() });
            } else {
                this.trackEvent('page_visible', { timestamp: Date.now() });
                this.updateLastActivity();
            }
        });

        // Track gallery interactions
        document.addEventListener('click', (e) => {
            this.handleClickEvent(e);
        });

        document.addEventListener('keydown', (e) => {
            this.handleKeyboardEvent(e);
        });

        // Track scroll behavior
        let scrollTimeout;
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                this.trackScrollBehavior();
            }, 150);
        });

        // Track form interactions
        document.addEventListener('input', (e) => {
            if (e.target.matches('[data-gallery-search]')) {
                this.trackSearchQuery(e.target.value);
            }
        });

        document.addEventListener('change', (e) => {
            if (e.target.matches('[data-gallery-filter]')) {
                this.trackFilterUsage(e.target.name, e.target.value);
            }
        });
    }

    /**
     * Setup intersection observer for view tracking
     */
    setupIntersectionObserver() {
        if (!('IntersectionObserver' in window)) return;

        // Gallery view tracking
        const galleryObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.trackGalleryView(entry.target);
                }
            });
        }, {
            threshold: 0.5,
            rootMargin: '50px'
        });

        // Image view tracking
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.trackImageView(entry.target);
                }
            });
        }, {
            threshold: 0.3,
            rootMargin: '20px'
        });

        // Observe gallery containers
        document.querySelectorAll('[data-gallery-container]').forEach(gallery => {
            galleryObserver.observe(gallery);
        });

        // Observe gallery images
        document.querySelectorAll('[data-gallery-image]').forEach(image => {
            imageObserver.observe(image);
        });

        this.observers.set('gallery', galleryObserver);
        this.observers.set('image', imageObserver);
    }

    /**
     * Setup performance observer
     */
    setupPerformanceObserver() {
        if (!('PerformanceObserver' in window)) return;

        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                if (entry.entryType === 'navigation') {
                    this.trackPageLoad(entry);
                } else if (entry.entryType === 'resource' && entry.initiatorType === 'img') {
                    this.trackImageLoad(entry);
                }
            }
        });

        try {
            observer.observe({ entryTypes: ['navigation', 'resource'] });
            this.observers.set('performance', observer);
        } catch (e) {
            console.warn('Performance observer not supported');
        }
    }

    /**
     * Handle click events
     */
    handleClickEvent(event) {
        const target = event.target.closest('[data-trackable]') || event.target;
        
        // Track gallery image clicks
        if (target.matches('[data-gallery-image]') || target.closest('.gallery-item')) {
            this.trackImageClick(target, event);
        }

        // Track lightbox interactions
        if (target.matches('[data-lightbox]') || target.closest('.lightbox')) {
            this.trackLightboxInteraction(target, event);
        }

        // Track navigation clicks
        if (target.matches('a[href]')) {
            this.trackNavigation(target, event);
        }

        // Track button interactions
        if (target.matches('button[data-action]')) {
            this.trackButtonClick(target, event);
        }

        // Track filter interactions
        if (target.matches('[data-gallery-filter]')) {
            this.trackFilterClick(target, event);
        }

        this.updateLastActivity();
    }

    /**
     * Handle keyboard events
     */
    handleKeyboardEvent(event) {
        // Track keyboard navigation in gallery
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            const activeGallery = document.querySelector('.gallery-container:focus-within');
            if (activeGallery) {
                this.trackKeyboardNavigation(event.key, activeGallery);
            }
        }

        // Track search interactions
        if (event.key === 'Enter' && event.target.matches('[data-gallery-search]')) {
            this.trackSearchSubmit(event.target.value);
        }

        this.updateLastActivity();
    }

    /**
     * Track gallery view
     */
    trackGalleryView(galleryElement) {
        const galleryId = galleryElement.dataset.galleryId || this.generateElementId(galleryElement);
        const galleryType = galleryElement.dataset.galleryType || 'unknown';
        
        if (!this.metrics.galleryViews.has(galleryId)) {
            this.metrics.galleryViews.set(galleryId, {
                id: galleryId,
                type: galleryType,
                firstView: Date.now(),
                viewCount: 0,
                totalViewTime: 0,
                images: this.getGalleryImageCount(galleryElement)
            });
        }

        const galleryMetrics = this.metrics.galleryViews.get(galleryId);
        galleryMetrics.viewCount++;
        galleryMetrics.lastView = Date.now();

        this.trackEvent('gallery_view', {
            galleryId,
            galleryType,
            imageCount: galleryMetrics.images,
            viewCount: galleryMetrics.viewCount
        });

        // Start engagement timer
        this.startEngagementTimer(`gallery_${galleryId}`);
    }

    /**
     * Track image view
     */
    trackImageView(imageElement) {
        const imageId = this.getImageId(imageElement);
        const imageData = this.getImageData(imageElement);
        
        if (!this.metrics.imageInteractions.has(imageId)) {
            this.metrics.imageInteractions.set(imageId, {
                id: imageId,
                ...imageData,
                views: 0,
                clicks: 0,
                firstView: Date.now(),
                totalViewTime: 0
            });
        }

        const imageMetrics = this.metrics.imageInteractions.get(imageId);
        imageMetrics.views++;
        imageMetrics.lastView = Date.now();

        this.trackEvent('image_view', {
            imageId,
            ...imageData,
            viewCount: imageMetrics.views
        });

        this.startEngagementTimer(`image_${imageId}`);
    }

    /**
     * Track image click
     */
    trackImageClick(imageElement, event) {
        const imageId = this.getImageId(imageElement);
        const imageData = this.getImageData(imageElement);
        
        if (this.metrics.imageInteractions.has(imageId)) {
            this.metrics.imageInteractions.get(imageId).clicks++;
        }

        this.trackEvent('image_click', {
            imageId,
            ...imageData,
            clickPosition: {
                x: event.clientX,
                y: event.clientY
            },
            modifiers: {
                ctrl: event.ctrlKey,
                alt: event.altKey,
                shift: event.shiftKey
            }
        });

        this.stopEngagementTimer(`image_${imageId}`);
    }

    /**
     * Track lightbox interaction
     */
    trackLightboxInteraction(element, event) {
        const action = element.dataset.action || 'open';
        const imageId = this.getImageId(element);
        
        this.trackEvent('lightbox_interaction', {
            action,
            imageId,
            timestamp: Date.now()
        });
    }

    /**
     * Track search query
     */
    trackSearchQuery(query) {
        if (!query || query.length < 2) return;

        this.metrics.searchQueries.push({
            query: query.toLowerCase(),
            timestamp: Date.now(),
            sessionId: this.state.sessionId
        });

        this.trackEvent('search_query', {
            query: query.toLowerCase(),
            queryLength: query.length
        });
    }

    /**
     * Track search submit
     */
    trackSearchSubmit(query) {
        this.trackEvent('search_submit', {
            query: query.toLowerCase(),
            queryLength: query.length,
            timestamp: Date.now()
        });
    }

    /**
     * Track filter usage
     */
    trackFilterUsage(filterName, filterValue) {
        if (!this.metrics.filterUsage.has(filterName)) {
            this.metrics.filterUsage.set(filterName, new Map());
        }

        const filterStats = this.metrics.filterUsage.get(filterName);
        const currentCount = filterStats.get(filterValue) || 0;
        filterStats.set(filterValue, currentCount + 1);

        this.trackEvent('filter_usage', {
            filterName,
            filterValue,
            usageCount: currentCount + 1
        });
    }

    /**
     * Track navigation
     */
    trackNavigation(linkElement, event) {
        const href = linkElement.href;
        const text = linkElement.textContent.trim();
        const isExternal = !href.startsWith(window.location.origin);

        this.metrics.navigationPaths.push({
            from: window.location.href,
            to: href,
            linkText: text,
            isExternal,
            timestamp: Date.now()
        });

        this.trackEvent('navigation_click', {
            href,
            linkText: text,
            isExternal,
            openInNewTab: linkElement.target === '_blank'
        });
    }

    /**
     * Track scroll behavior
     */
    trackScrollBehavior() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollPercentage = Math.round((scrollTop / documentHeight) * 100);

        // Only track significant scroll milestones
        if (scrollPercentage % 25 === 0 && scrollPercentage > 0) {
            this.trackEvent('scroll_milestone', {
                scrollPercentage,
                scrollTop,
                documentHeight
            });
        }
    }

    /**
     * Track keyboard navigation
     */
    trackKeyboardNavigation(key, galleryElement) {
        this.trackEvent('keyboard_navigation', {
            key,
            galleryId: galleryElement.dataset.galleryId || this.generateElementId(galleryElement),
            timestamp: Date.now()
        });
    }

    /**
     * Track page load performance
     */
    trackPageLoad(entry) {
        this.trackEvent('page_load', {
            loadTime: entry.loadEventEnd - entry.navigationStart,
            domInteractive: entry.domInteractive - entry.navigationStart,
            domComplete: entry.domComplete - entry.navigationStart,
            transferSize: entry.transferSize,
            type: entry.type
        });
    }

    /**
     * Track image load performance
     */
    trackImageLoad(entry) {
        if (!entry.name.includes('gallery') && !entry.name.includes('image')) return;

        this.trackEvent('image_load_performance', {
            url: entry.name,
            loadTime: entry.responseEnd - entry.startTime,
            transferSize: entry.transferSize,
            encodedBodySize: entry.encodedBodySize,
            decodedBodySize: entry.decodedBodySize
        });
    }

    /**
     * Start engagement timer
     */
    startEngagementTimer(elementId) {
        if (this.metrics.engagementTimers.has(elementId)) {
            this.stopEngagementTimer(elementId);
        }

        this.metrics.engagementTimers.set(elementId, {
            startTime: Date.now(),
            elementId
        });
    }

    /**
     * Stop engagement timer
     */
    stopEngagementTimer(elementId) {
        const timer = this.metrics.engagementTimers.get(elementId);
        if (!timer) return;

        const engagementTime = Date.now() - timer.startTime;
        this.metrics.engagementTimers.delete(elementId);

        this.trackEvent('engagement_time', {
            elementId,
            engagementTime,
            elementType: elementId.startsWith('gallery_') ? 'gallery' : 'image'
        });

        return engagementTime;
    }

    /**
     * Track session end
     */
    trackSessionEnd() {
        const sessionDuration = Date.now() - this.state.sessionStart;
        
        // Stop all active engagement timers
        this.metrics.engagementTimers.forEach((timer, elementId) => {
            this.stopEngagementTimer(elementId);
        });

        this.trackEvent('session_end', {
            sessionId: this.state.sessionId,
            sessionDuration,
            pageViews: this.metrics.pageViews.size,
            galleryViews: this.metrics.galleryViews.size,
            imageInteractions: this.metrics.imageInteractions.size,
            searchQueries: this.metrics.searchQueries.length,
            navigationClicks: this.metrics.navigationPaths.length
        });

        // Force flush remaining events
        this.flushEvents();
    }

    /**
     * Track custom event
     */
    trackEvent(eventType, eventData = {}) {
        if (!this.config.trackingEnabled) return;

        const event = {
            type: eventType,
            timestamp: Date.now(),
            sessionId: this.state.sessionId,
            userId: this.state.userId,
            url: window.location.href,
            data: eventData
        };

        this.state.eventQueue.push(event);
        this.updateLastActivity();

        // Auto-flush if queue is full
        if (this.state.eventQueue.length >= this.config.batchSize) {
            this.flushEvents();
        }

        // Dispatch custom event for external listeners
        window.dispatchEvent(new CustomEvent('galleryAnalyticsEvent', {
            detail: event
        }));
    }

    /**
     * Flush events to server
     */
    async flushEvents() {
        if (this.state.eventQueue.length === 0) return;

        const eventsToFlush = [...this.state.eventQueue];
        this.state.eventQueue = [];

        try {
            const response = await fetch(`${this.config.apiBaseUrl}/events`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId: this.state.sessionId,
                    userId: this.state.userId,
                    events: eventsToFlush,
                    sessionInfo: {
                        userAgent: this.state.userAgent,
                        viewport: this.state.viewport,
                        referrer: this.state.referrer,
                        utm: this.state.utm,
                        device: this.state.device
                    }
                })
            });

            if (!response.ok) {
                throw new Error('Failed to send analytics events');
            }

            console.log(`📈 Flushed ${eventsToFlush.length} analytics events`);
        } catch (error) {
            console.warn('Failed to send analytics events:', error);
            // Put events back in queue for retry
            this.state.eventQueue.unshift(...eventsToFlush);
        }
    }

    /**
     * Start session tracking
     */
    startSessionTracking() {
        // Update last activity on user interaction
        ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
            document.addEventListener(event, () => {
                this.updateLastActivity();
            }, { passive: true });
        });

        // Check for session timeout
        setInterval(() => {
            const timeSinceActivity = Date.now() - this.state.lastActivity;
            if (timeSinceActivity > this.config.sessionTimeout) {
                this.trackSessionEnd();
                this.state.sessionId = this.generateSessionId();
                this.state.sessionStart = Date.now();
                this.trackEvent('session_start', { reason: 'timeout' });
            }
        }, 60000); // Check every minute
    }

    /**
     * Start auto-flush timer
     */
    startAutoFlush() {
        setInterval(() => {
            if (this.state.eventQueue.length > 0) {
                this.flushEvents();
            }
        }, this.config.flushInterval);
    }

    /**
     * Update last activity timestamp
     */
    updateLastActivity() {
        this.state.lastActivity = Date.now();
    }

    /**
     * Utility methods
     */
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
    }

    generateElementId(element) {
        return 'element_' + Array.from(element.parentElement.children).indexOf(element);
    }

    getUserId() {
        // Try to get user ID from various sources
        let userId = localStorage.getItem('gallery_user_id');
        if (!userId) {
            userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
            localStorage.setItem('gallery_user_id', userId);
        }
        return userId;
    }

    getImageId(imageElement) {
        return imageElement.dataset.imageId || 
               imageElement.dataset.src || 
               imageElement.src || 
               this.generateElementId(imageElement);
    }

    getImageData(imageElement) {
        return {
            src: imageElement.src || imageElement.dataset.src,
            alt: imageElement.alt || '',
            category: imageElement.dataset.category || '',
            tags: imageElement.dataset.tags ? imageElement.dataset.tags.split(',') : [],
            size: imageElement.dataset.size || 'unknown'
        };
    }

    getGalleryImageCount(galleryElement) {
        return galleryElement.querySelectorAll('[data-gallery-image], .gallery-item img').length;
    }

    parseUTMParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        return {
            source: urlParams.get('utm_source'),
            medium: urlParams.get('utm_medium'),
            campaign: urlParams.get('utm_campaign'),
            term: urlParams.get('utm_term'),
            content: urlParams.get('utm_content')
        };
    }

    getDeviceInfo() {
        const ua = navigator.userAgent;
        return {
            type: /Mobi|Android/i.test(ua) ? 'mobile' : 'desktop',
            browser: this.getBrowserName(ua),
            os: this.getOperatingSystem(ua),
            screen: {
                width: screen.width,
                height: screen.height,
                colorDepth: screen.colorDepth
            },
            language: navigator.language,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };
    }

    getBrowserName(ua) {
        if (ua.includes('Chrome')) return 'Chrome';
        if (ua.includes('Firefox')) return 'Firefox';
        if (ua.includes('Safari')) return 'Safari';
        if (ua.includes('Edge')) return 'Edge';
        return 'Unknown';
    }

    getOperatingSystem(ua) {
        if (ua.includes('Windows')) return 'Windows';
        if (ua.includes('Macintosh')) return 'macOS';
        if (ua.includes('Linux')) return 'Linux';
        if (ua.includes('Android')) return 'Android';
        if (ua.includes('iOS')) return 'iOS';
        return 'Unknown';
    }

    /**
     * Get analytics summary
     */
    getAnalyticsSummary() {
        return {
            session: {
                id: this.state.sessionId,
                duration: Date.now() - this.state.sessionStart,
                userId: this.state.userId
            },
            metrics: {
                pageViews: this.metrics.pageViews.size,
                galleryViews: this.metrics.galleryViews.size,
                imageViews: Array.from(this.metrics.imageInteractions.values())
                    .reduce((sum, img) => sum + img.views, 0),
                imageClicks: Array.from(this.metrics.imageInteractions.values())
                    .reduce((sum, img) => sum + img.clicks, 0),
                searchQueries: this.metrics.searchQueries.length,
                navigationClicks: this.metrics.navigationPaths.length
            },
            engagement: {
                activeTimers: this.metrics.engagementTimers.size,
                lastActivity: this.state.lastActivity
            }
        };
    }

    /**
     * Cleanup and destroy
     */
    destroy() {
        this.trackSessionEnd();
        
        this.observers.forEach(observer => {
            observer.disconnect();
        });
        this.observers.clear();

        this.isInitialized = false;
        console.log('📈 Gallery Analytics Service destroyed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GalleryAnalyticsService;
} else {
    window.GalleryAnalyticsService = GalleryAnalyticsService;
}