/**
 * Test API Routes for Universal Gallery Testing
 * 
 * Mock API endpoints for testing gallery functionality,
 * performance monitoring, and analytics collection.
 */

const express = require('express');
const router = express.Router();

// Mock data storage
let mockData = {
    galleries: new Map(),
    images: new Map(),
    analytics: [],
    performance: [],
    sessions: new Map()
};

// Error simulation configuration
let errorConfig = {
    imageLoad: { enabled: false, rate: 0.1 },
    apiResponse: { enabled: false, rate: 0.05 },
    networkDelay: { enabled: false, min: 100, max: 1000 }
};

// Utility functions
const simulateNetworkDelay = () => {
    if (errorConfig.networkDelay.enabled) {
        const delay = Math.random() * (errorConfig.networkDelay.max - errorConfig.networkDelay.min) + errorConfig.networkDelay.min;
        return new Promise(resolve => setTimeout(resolve, delay));
    }
    return Promise.resolve();
};

const shouldSimulateError = (type) => {
    return errorConfig[type]?.enabled && Math.random() < errorConfig[type]?.rate;
};

// ===== Gallery Configuration API =====

/**
 * GET /api/universal-gallery/config/:modelId
 * Get gallery configuration for a model
 */
router.get('/config/:modelId', async (req, res) => {
    await simulateNetworkDelay();
    
    if (shouldSimulateError('apiResponse')) {
        return res.status(500).json({ error: 'Simulated API error' });
    }

    const { modelId } = req.params;
    const config = mockData.galleries.get(modelId) || {
        id: modelId,
        layout: 'grid',
        columns: 3,
        spacing: 'medium',
        lightbox: true,
        lazy: true,
        prefetch: true,
        filters: true,
        search: true,
        pagination: {
            enabled: true,
            pageSize: 12
        },
        theme: 'modern'
    };

    res.json(config);
});

/**
 * POST /api/universal-gallery/config/:modelId
 * Update gallery configuration for a model
 */
router.post('/config/:modelId', async (req, res) => {
    await simulateNetworkDelay();
    
    if (shouldSimulateError('apiResponse')) {
        return res.status(500).json({ error: 'Simulated API error' });
    }

    const { modelId } = req.params;
    const config = { ...req.body, id: modelId, updated_at: new Date().toISOString() };
    
    mockData.galleries.set(modelId, config);
    
    res.json({
        success: true,
        config
    });
});

// ===== Gallery Images API =====

/**
 * GET /api/universal-gallery/images/:modelId
 * Get images for a gallery
 */
router.get('/images/:modelId', async (req, res) => {
    await simulateNetworkDelay();
    
    if (shouldSimulateError('apiResponse')) {
        return res.status(500).json({ error: 'Simulated API error' });
    }

    const { modelId } = req.params;
    const { page = 1, limit = 12, search, category, sort } = req.query;
    
    // Generate mock images for testing
    const images = [];
    const totalImages = 50;
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    
    for (let i = startIndex; i < Math.min(startIndex + parseInt(limit), totalImages); i++) {
        const imageId = `${modelId}_img_${i + 1}`;
        const categories = ['portrait', 'landscape', 'studio'];
        const category = categories[i % categories.length];
        const width = 400 + (i * 50);
        const height = 300 + (i * 40);
        
        // Apply search filter
        if (search && !`Test Image ${i + 1}`.toLowerCase().includes(search.toLowerCase())) {
            continue;
        }
        
        // Apply category filter
        if (req.query.category && category !== req.query.category) {
            continue;
        }
        
        images.push({
            id: imageId,
            src: `https://picsum.photos/${width}/${height}?random=${i + 1}`,
            thumbnail: `https://picsum.photos/200/150?random=${i + 1}`,
            alt: `Test Image ${i + 1}`,
            title: `Test Image ${i + 1}`,
            category,
            tags: ['test', 'sample', category],
            width,
            height,
            fileSize: Math.floor(Math.random() * 200000) + 50000,
            created_at: new Date(Date.now() - (i * 86400000)).toISOString()
        });
    }
    
    // Sort images
    if (sort) {
        images.sort((a, b) => {
            switch (sort) {
                case 'newest':
                    return new Date(b.created_at) - new Date(a.created_at);
                case 'oldest':
                    return new Date(a.created_at) - new Date(b.created_at);
                case 'name':
                    return a.title.localeCompare(b.title);
                default:
                    return 0;
            }
        });
    }
    
    res.json({
        images,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalImages,
            totalPages: Math.ceil(totalImages / parseInt(limit)),
            hasNext: (parseInt(page) * parseInt(limit)) < totalImages,
            hasPrev: parseInt(page) > 1
        },
        filters: {
            categories: ['portrait', 'landscape', 'studio'],
            tags: ['test', 'sample', 'portrait', 'landscape', 'studio']
        }
    });
});

/**
 * GET /api/universal-gallery/image/:imageId
 * Get single image details
 */
router.get('/image/:imageId', async (req, res) => {
    await simulateNetworkDelay();
    
    if (shouldSimulateError('imageLoad')) {
        return res.status(404).json({ error: 'Image not found' });
    }

    const { imageId } = req.params;
    const [modelId, , index] = imageId.split('_');
    const i = parseInt(index) - 1;
    
    const categories = ['portrait', 'landscape', 'studio'];
    const category = categories[i % categories.length];
    const width = 400 + (i * 50);
    const height = 300 + (i * 40);
    
    const image = {
        id: imageId,
        src: `https://picsum.photos/${width}/${height}?random=${i + 1}`,
        thumbnail: `https://picsum.photos/200/150?random=${i + 1}`,
        alt: `Test Image ${i + 1}`,
        title: `Test Image ${i + 1}`,
        description: `This is test image number ${i + 1} for gallery testing`,
        category,
        tags: ['test', 'sample', category],
        width,
        height,
        fileSize: Math.floor(Math.random() * 200000) + 50000,
        created_at: new Date(Date.now() - (i * 86400000)).toISOString(),
        metadata: {
            camera: 'Test Camera',
            lens: 'Test Lens',
            iso: Math.floor(Math.random() * 3200) + 100,
            aperture: `f/${(Math.random() * 8 + 1).toFixed(1)}`,
            shutter: `1/${Math.floor(Math.random() * 1000) + 60}`
        }
    };
    
    res.json(image);
});

// ===== Analytics API =====

/**
 * POST /api/universal-gallery/analytics/events
 * Collect analytics events
 */
router.post('/analytics/events', async (req, res) => {
    await simulateNetworkDelay();
    
    if (shouldSimulateError('apiResponse')) {
        return res.status(500).json({ error: 'Failed to store analytics events' });
    }

    const { sessionId, userId, events, sessionInfo } = req.body;
    
    if (!sessionId || !events || !Array.isArray(events)) {
        return res.status(400).json({
            error: 'Invalid request data',
            required: ['sessionId', 'events']
        });
    }
    
    // Store session info
    mockData.sessions.set(sessionId, {
        sessionId,
        userId,
        ...sessionInfo,
        created_at: new Date().toISOString(),
        eventCount: events.length
    });
    
    // Store events
    events.forEach(event => {
        mockData.analytics.push({
            sessionId,
            userId,
            ...event,
            stored_at: new Date().toISOString()
        });
    });
    
    res.json({
        success: true,
        message: `Stored ${events.length} analytics events`,
        sessionId
    });
});

/**
 * GET /api/universal-gallery/analytics/summary
 * Get analytics summary
 */
router.get('/analytics/summary', async (req, res) => {
    await simulateNetworkDelay();
    
    const { period = '7' } = req.query;
    const days = parseInt(period);
    const cutoffDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    
    // Filter events by date
    const recentEvents = mockData.analytics.filter(event => 
        new Date(event.timestamp) > cutoffDate
    );
    
    const summary = {
        totalSessions: mockData.sessions.size,
        totalEvents: recentEvents.length,
        uniqueUsers: new Set(recentEvents.map(e => e.userId)).size,
        galleryViews: recentEvents.filter(e => e.type === 'gallery_view').length,
        imageClicks: recentEvents.filter(e => e.type === 'image_click').length,
        searchQueries: recentEvents.filter(e => e.type === 'search_query').length,
        averageSessionDuration: 180, // Mock value
        bounceRate: 0.35, // Mock value
        topEvents: [
            { type: 'image_view', count: Math.floor(recentEvents.length * 0.4) },
            { type: 'gallery_view', count: Math.floor(recentEvents.length * 0.3) },
            { type: 'image_click', count: Math.floor(recentEvents.length * 0.2) },
            { type: 'search_query', count: Math.floor(recentEvents.length * 0.1) }
        ]
    };
    
    res.json(summary);
});

// ===== Performance API =====

/**
 * POST /api/universal-gallery/performance/analytics
 * Store performance analytics
 */
router.post('/performance/analytics', async (req, res) => {
    await simulateNetworkDelay();
    
    if (shouldSimulateError('apiResponse')) {
        return res.status(500).json({ error: 'Failed to store performance data' });
    }

    const performanceData = {
        ...req.body,
        stored_at: new Date().toISOString()
    };
    
    mockData.performance.push(performanceData);
    
    res.json({
        success: true,
        message: 'Performance data stored'
    });
});

/**
 * GET /api/universal-gallery/performance/metrics
 * Get performance metrics
 */
router.get('/performance/metrics', async (req, res) => {
    await simulateNetworkDelay();
    
    const { period = '7' } = req.query;
    const days = parseInt(period);
    const cutoffDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    
    // Filter performance data by date
    const recentData = mockData.performance.filter(data => 
        new Date(data.timestamp) > cutoffDate
    );
    
    // Calculate averages
    const avgMetrics = recentData.reduce((acc, data) => {
        if (data.coreWebVitals) {
            acc.lcp += data.coreWebVitals.lcp || 0;
            acc.fid += data.coreWebVitals.fid || 0;
            acc.cls += data.coreWebVitals.cls || 0;
            acc.count++;
        }
        return acc;
    }, { lcp: 0, fid: 0, cls: 0, count: 0 });
    
    const count = avgMetrics.count || 1;
    
    const metrics = {
        coreWebVitals: {
            lcp: avgMetrics.lcp / count,
            fid: avgMetrics.fid / count,
            cls: avgMetrics.cls / count
        },
        imageMetrics: {
            averageLoadTime: 850,
            successRate: 0.98,
            totalImages: recentData.reduce((sum, d) => sum + (d.imageMetrics?.totalImages || 0), 0)
        },
        userInteractions: {
            totalClicks: recentData.reduce((sum, d) => sum + (d.userInteractions?.clicks || 0), 0),
            scrollDepth: 0.75,
            sessionDuration: 180
        },
        cacheMetrics: {
            hitRate: 0.85,
            missRate: 0.15,
            prefetchSuccess: 0.92
        }
    };
    
    res.json(metrics);
});

// ===== Test Control API =====

/**
 * POST /api/universal-gallery/test/error-config
 * Configure error simulation for testing
 */
router.post('/test/error-config', (req, res) => {
    errorConfig = { ...errorConfig, ...req.body };
    res.json({
        success: true,
        config: errorConfig
    });
});

/**
 * GET /api/universal-gallery/test/error-config
 * Get current error simulation configuration
 */
router.get('/test/error-config', (req, res) => {
    res.json(errorConfig);
});

/**
 * POST /api/universal-gallery/test/reset-data
 * Reset all mock data
 */
router.post('/test/reset-data', (req, res) => {
    mockData = {
        galleries: new Map(),
        images: new Map(),
        analytics: [],
        performance: [],
        sessions: new Map()
    };
    
    res.json({
        success: true,
        message: 'Mock data reset'
    });
});

/**
 * GET /api/universal-gallery/test/data-summary
 * Get summary of stored test data
 */
router.get('/test/data-summary', (req, res) => {
    const summary = {
        galleries: mockData.galleries.size,
        images: mockData.images.size,
        analyticsEvents: mockData.analytics.length,
        performanceEntries: mockData.performance.length,
        sessions: mockData.sessions.size,
        lastActivity: mockData.analytics.length > 0 ? 
            Math.max(...mockData.analytics.map(e => new Date(e.timestamp).getTime())) :
            null
    };
    
    res.json(summary);
});

module.exports = router;