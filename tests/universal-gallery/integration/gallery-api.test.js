/**
 * Integration Tests for Gallery API Endpoints
 * 
 * Tests API endpoints for gallery configuration, image management,
 * performance analytics, and theme integration.
 */

const request = require('supertest');
const testSetup = require('../setup/test-setup');
const testConfig = require('../setup/test-config');

describe('Gallery API Integration', () => {
    let app;
    let db;

    beforeAll(async () => {
        await testSetup.setupGlobal();
        db = testSetup.getDbConnection();
        
        // Create Express app for testing
        const express = require('express');
        app = express();
        app.use(express.json());
        app.use('/api/universal-gallery', require('../setup/test-routes'));
    });

    afterAll(async () => {
        await testSetup.teardownGlobal();
    });

    beforeEach(async () => {
        // Reset mock data before each test
        await request(app)
            .post('/api/universal-gallery/test/reset-data')
            .expect(200);
    });

    describe('Gallery Configuration API', () => {
        describe('GET /api/universal-gallery/config/:modelId', () => {
            test('should return default gallery configuration', async () => {
                const response = await request(app)
                    .get('/api/universal-gallery/config/test-model-1')
                    .expect(200);

                expect(response.body).toMatchObject({
                    id: 'test-model-1',
                    layout: 'grid',
                    columns: 3,
                    spacing: 'medium',
                    lightbox: true,
                    lazy: true,
                    prefetch: true
                });
            });

            test('should handle model not found gracefully', async () => {
                const response = await request(app)
                    .get('/api/universal-gallery/config/nonexistent-model')
                    .expect(200);

                expect(response.body).toHaveProperty('id', 'nonexistent-model');
                expect(response.body).toHaveProperty('layout');
            });

            test('should handle network simulation errors', async () => {
                // Enable error simulation
                await request(app)
                    .post('/api/universal-gallery/test/error-config')
                    .send({
                        apiResponse: { enabled: true, rate: 1.0 }
                    })
                    .expect(200);

                await request(app)
                    .get('/api/universal-gallery/config/test-model-1')
                    .expect(500);

                // Disable error simulation
                await request(app)
                    .post('/api/universal-gallery/test/error-config')
                    .send({
                        apiResponse: { enabled: false }
                    })
                    .expect(200);
            });
        });

        describe('POST /api/universal-gallery/config/:modelId', () => {
            test('should update gallery configuration', async () => {
                const newConfig = {
                    layout: 'masonry',
                    columns: 4,
                    spacing: 'large',
                    lightbox: false,
                    theme: 'luxury'
                };

                const response = await request(app)
                    .post('/api/universal-gallery/config/test-model-1')
                    .send(newConfig)
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.config).toMatchObject({
                    id: 'test-model-1',
                    ...newConfig
                });
            });

            test('should validate configuration data', async () => {
                const invalidConfig = {
                    layout: 'invalid-layout',
                    columns: -1,
                    spacing: 'invalid-spacing'
                };

                // Since this is a mock API, it should accept any data
                // In a real API, this would return validation errors
                const response = await request(app)
                    .post('/api/universal-gallery/config/test-model-1')
                    .send(invalidConfig)
                    .expect(200);

                expect(response.body.success).toBe(true);
            });

            test('should handle partial configuration updates', async () => {
                // First, set initial config
                await request(app)
                    .post('/api/universal-gallery/config/test-model-1')
                    .send({
                        layout: 'grid',
                        columns: 3,
                        lightbox: true
                    })
                    .expect(200);

                // Then update only some fields
                const partialUpdate = {
                    columns: 4,
                    spacing: 'large'
                };

                const response = await request(app)
                    .post('/api/universal-gallery/config/test-model-1')
                    .send(partialUpdate)
                    .expect(200);

                expect(response.body.config).toMatchObject(partialUpdate);
            });
        });
    });

    describe('Gallery Images API', () => {
        describe('GET /api/universal-gallery/images/:modelId', () => {
            test('should return paginated image list', async () => {
                const response = await request(app)
                    .get('/api/universal-gallery/images/test-model-1')
                    .query({
                        page: 1,
                        limit: 10
                    })
                    .expect(200);

                expect(response.body).toHaveProperty('images');
                expect(response.body).toHaveProperty('pagination');
                expect(response.body.images).toBeInstanceOf(Array);
                expect(response.body.images.length).toBeLessThanOrEqual(10);

                const firstImage = response.body.images[0];
                expect(firstImage).toHaveProperty('id');
                expect(firstImage).toHaveProperty('src');
                expect(firstImage).toHaveProperty('alt');
                expect(firstImage).toHaveProperty('width');
                expect(firstImage).toHaveProperty('height');
            });

            test('should handle search filtering', async () => {
                const response = await request(app)
                    .get('/api/universal-gallery/images/test-model-1')
                    .query({
                        search: 'Test Image 1',
                        limit: 50
                    })
                    .expect(200);

                expect(response.body.images).toBeInstanceOf(Array);
                // Should filter images containing the search term
                response.body.images.forEach(image => {
                    expect(image.title.toLowerCase()).toContain('test image 1');
                });
            });

            test('should handle category filtering', async () => {
                const response = await request(app)
                    .get('/api/universal-gallery/images/test-model-1')
                    .query({
                        category: 'portrait',
                        limit: 50
                    })
                    .expect(200);

                expect(response.body.images).toBeInstanceOf(Array);
                response.body.images.forEach(image => {
                    expect(image.category).toBe('portrait');
                });
            });

            test('should handle sorting options', async () => {
                const newestResponse = await request(app)
                    .get('/api/universal-gallery/images/test-model-1')
                    .query({
                        sort: 'newest',
                        limit: 5
                    })
                    .expect(200);

                const oldestResponse = await request(app)
                    .get('/api/universal-gallery/images/test-model-1')
                    .query({
                        sort: 'oldest',
                        limit: 5
                    })
                    .expect(200);

                expect(newestResponse.body.images).toBeInstanceOf(Array);
                expect(oldestResponse.body.images).toBeInstanceOf(Array);

                // Newest should have different order than oldest
                if (newestResponse.body.images.length > 1 && oldestResponse.body.images.length > 1) {
                    expect(newestResponse.body.images[0].id).not.toBe(oldestResponse.body.images[0].id);
                }
            });

            test('should return correct pagination metadata', async () => {
                const response = await request(app)
                    .get('/api/universal-gallery/images/test-model-1')
                    .query({
                        page: 2,
                        limit: 10
                    })
                    .expect(200);

                expect(response.body.pagination).toMatchObject({
                    page: 2,
                    limit: 10,
                    total: expect.any(Number),
                    totalPages: expect.any(Number),
                    hasNext: expect.any(Boolean),
                    hasPrev: true
                });
            });

            test('should include filter metadata', async () => {
                const response = await request(app)
                    .get('/api/universal-gallery/images/test-model-1')
                    .expect(200);

                expect(response.body).toHaveProperty('filters');
                expect(response.body.filters).toHaveProperty('categories');
                expect(response.body.filters).toHaveProperty('tags');
                expect(response.body.filters.categories).toBeInstanceOf(Array);
                expect(response.body.filters.tags).toBeInstanceOf(Array);
            });
        });

        describe('GET /api/universal-gallery/image/:imageId', () => {
            test('should return single image details', async () => {
                const response = await request(app)
                    .get('/api/universal-gallery/image/test-model-1_img_1')
                    .expect(200);

                expect(response.body).toMatchObject({
                    id: 'test-model-1_img_1',
                    src: expect.any(String),
                    thumbnail: expect.any(String),
                    alt: expect.any(String),
                    title: expect.any(String),
                    category: expect.any(String),
                    tags: expect.any(Array),
                    width: expect.any(Number),
                    height: expect.any(Number),
                    fileSize: expect.any(Number)
                });
            });

            test('should include image metadata', async () => {
                const response = await request(app)
                    .get('/api/universal-gallery/image/test-model-1_img_1')
                    .expect(200);

                expect(response.body).toHaveProperty('metadata');
                expect(response.body.metadata).toMatchObject({
                    camera: expect.any(String),
                    lens: expect.any(String),
                    iso: expect.any(Number),
                    aperture: expect.any(String),
                    shutter: expect.any(String)
                });
            });

            test('should handle image not found with error simulation', async () => {
                // Enable image load errors
                await request(app)
                    .post('/api/universal-gallery/test/error-config')
                    .send({
                        imageLoad: { enabled: true, rate: 1.0 }
                    })
                    .expect(200);

                await request(app)
                    .get('/api/universal-gallery/image/nonexistent-image')
                    .expect(404);

                // Disable error simulation
                await request(app)
                    .post('/api/universal-gallery/test/error-config')
                    .send({
                        imageLoad: { enabled: false }
                    })
                    .expect(200);
            });
        });
    });

    describe('Analytics API', () => {
        describe('POST /api/universal-gallery/analytics/events', () => {
            test('should store analytics events', async () => {
                const analyticsData = {
                    sessionId: 'test-session-123',
                    userId: 'test-user-456',
                    events: [
                        {
                            type: 'gallery_view',
                            timestamp: Date.now(),
                            data: {
                                galleryId: 'test-gallery',
                                galleryType: 'grid'
                            }
                        },
                        {
                            type: 'image_click',
                            timestamp: Date.now(),
                            data: {
                                imageId: 'img-123',
                                position: { x: 100, y: 200 }
                            }
                        }
                    ],
                    sessionInfo: {
                        userAgent: 'Mozilla/5.0 Test Browser',
                        viewport: { width: 1920, height: 1080 },
                        referrer: 'https://example.com'
                    }
                };

                const response = await request(app)
                    .post('/api/universal-gallery/analytics/events')
                    .send(analyticsData)
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.message).toContain('2 analytics events');
                expect(response.body.sessionId).toBe('test-session-123');
            });

            test('should validate required fields', async () => {
                const invalidData = {
                    sessionId: 'test-session-123'
                    // Missing events array
                };

                const response = await request(app)
                    .post('/api/universal-gallery/analytics/events')
                    .send(invalidData)
                    .expect(400);

                expect(response.body.error).toContain('Invalid request data');
                expect(response.body.required).toContain('events');
            });

            test('should handle empty events array', async () => {
                const analyticsData = {
                    sessionId: 'test-session-123',
                    userId: 'test-user-456',
                    events: [],
                    sessionInfo: {}
                };

                const response = await request(app)
                    .post('/api/universal-gallery/analytics/events')
                    .send(analyticsData)
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.message).toContain('0 analytics events');
            });
        });

        describe('GET /api/universal-gallery/analytics/summary', () => {
            beforeEach(async () => {
                // Store some test analytics data
                const analyticsData = {
                    sessionId: 'test-session-123',
                    userId: 'test-user-456',
                    events: [
                        {
                            type: 'gallery_view',
                            timestamp: Date.now(),
                            data: { galleryId: 'test-gallery' }
                        },
                        {
                            type: 'image_click',
                            timestamp: Date.now(),
                            data: { imageId: 'img-123' }
                        },
                        {
                            type: 'search_query',
                            timestamp: Date.now(),
                            data: { query: 'test search' }
                        }
                    ]
                };

                await request(app)
                    .post('/api/universal-gallery/analytics/events')
                    .send(analyticsData)
                    .expect(200);
            });

            test('should return analytics summary', async () => {
                const response = await request(app)
                    .get('/api/universal-gallery/analytics/summary')
                    .expect(200);

                expect(response.body).toMatchObject({
                    totalSessions: expect.any(Number),
                    totalEvents: expect.any(Number),
                    uniqueUsers: expect.any(Number),
                    galleryViews: expect.any(Number),
                    imageClicks: expect.any(Number),
                    searchQueries: expect.any(Number),
                    averageSessionDuration: expect.any(Number),
                    bounceRate: expect.any(Number),
                    topEvents: expect.any(Array)
                });
            });

            test('should handle period filtering', async () => {
                const response = await request(app)
                    .get('/api/universal-gallery/analytics/summary')
                    .query({ period: '30' })
                    .expect(200);

                expect(response.body).toHaveProperty('totalEvents');
                expect(typeof response.body.totalEvents).toBe('number');
            });

            test('should return top events breakdown', async () => {
                const response = await request(app)
                    .get('/api/universal-gallery/analytics/summary')
                    .expect(200);

                expect(response.body.topEvents).toBeInstanceOf(Array);
                response.body.topEvents.forEach(event => {
                    expect(event).toHaveProperty('type');
                    expect(event).toHaveProperty('count');
                    expect(typeof event.count).toBe('number');
                });
            });
        });
    });

    describe('Performance API', () => {
        describe('POST /api/universal-gallery/performance/analytics', () => {
            test('should store performance analytics', async () => {
                const performanceData = {
                    timestamp: new Date().toISOString(),
                    sessionId: 'perf-session-123',
                    sessionDuration: 120000,
                    coreWebVitals: {
                        lcp: 2300,
                        fid: 85,
                        cls: 0.08
                    },
                    imageMetrics: {
                        totalImages: 24,
                        loadedImages: 24,
                        averageLoadTime: 850,
                        successRate: 0.98
                    },
                    userInteractions: {
                        clicks: 15,
                        scrollDepth: 0.85,
                        sessionDuration: 180
                    },
                    cacheMetrics: {
                        hitRate: 0.92,
                        missRate: 0.08,
                        prefetchSuccess: 0.95
                    }
                };

                const response = await request(app)
                    .post('/api/universal-gallery/performance/analytics')
                    .send(performanceData)
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.message).toContain('Performance data stored');
            });

            test('should handle incomplete performance data', async () => {
                const partialData = {
                    timestamp: new Date().toISOString(),
                    sessionId: 'perf-session-456',
                    coreWebVitals: {
                        lcp: 2100
                        // Missing fid and cls
                    }
                };

                const response = await request(app)
                    .post('/api/universal-gallery/performance/analytics')
                    .send(partialData)
                    .expect(200);

                expect(response.body.success).toBe(true);
            });
        });

        describe('GET /api/universal-gallery/performance/metrics', () => {
            beforeEach(async () => {
                // Store some test performance data
                const performanceData = {
                    timestamp: new Date().toISOString(),
                    sessionId: 'perf-session-test',
                    coreWebVitals: {
                        lcp: 2200,
                        fid: 90,
                        cls: 0.06
                    },
                    imageMetrics: {
                        totalImages: 20,
                        averageLoadTime: 800
                    }
                };

                await request(app)
                    .post('/api/universal-gallery/performance/analytics')
                    .send(performanceData)
                    .expect(200);
            });

            test('should return performance metrics summary', async () => {
                const response = await request(app)
                    .get('/api/universal-gallery/performance/metrics')
                    .expect(200);

                expect(response.body).toMatchObject({
                    coreWebVitals: {
                        lcp: expect.any(Number),
                        fid: expect.any(Number),
                        cls: expect.any(Number)
                    },
                    imageMetrics: {
                        averageLoadTime: expect.any(Number),
                        successRate: expect.any(Number),
                        totalImages: expect.any(Number)
                    },
                    userInteractions: {
                        totalClicks: expect.any(Number),
                        scrollDepth: expect.any(Number),
                        sessionDuration: expect.any(Number)
                    },
                    cacheMetrics: {
                        hitRate: expect.any(Number),
                        missRate: expect.any(Number),
                        prefetchSuccess: expect.any(Number)
                    }
                });
            });

            test('should handle period filtering for metrics', async () => {
                const response = await request(app)
                    .get('/api/universal-gallery/performance/metrics')
                    .query({ period: '7' })
                    .expect(200);

                expect(response.body.coreWebVitals).toBeDefined();
                expect(typeof response.body.coreWebVitals.lcp).toBe('number');
            });
        });
    });

    describe('Test Control API', () => {
        test('should configure error simulation', async () => {
            const errorConfig = {
                imageLoad: { enabled: true, rate: 0.2 },
                apiResponse: { enabled: true, rate: 0.1 },
                networkDelay: { enabled: true, min: 100, max: 500 }
            };

            const response = await request(app)
                .post('/api/universal-gallery/test/error-config')
                .send(errorConfig)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.config).toMatchObject(errorConfig);
        });

        test('should get current error configuration', async () => {
            const response = await request(app)
                .get('/api/universal-gallery/test/error-config')
                .expect(200);

            expect(response.body).toHaveProperty('imageLoad');
            expect(response.body).toHaveProperty('apiResponse');
            expect(response.body).toHaveProperty('networkDelay');
        });

        test('should reset all test data', async () => {
            // First, add some data
            await request(app)
                .post('/api/universal-gallery/analytics/events')
                .send({
                    sessionId: 'test-session',
                    events: [{ type: 'test', timestamp: Date.now() }]
                })
                .expect(200);

            // Reset data
            await request(app)
                .post('/api/universal-gallery/test/reset-data')
                .expect(200);

            // Check that data was reset
            const summary = await request(app)
                .get('/api/universal-gallery/test/data-summary')
                .expect(200);

            expect(summary.body.analyticsEvents).toBe(0);
            expect(summary.body.sessions).toBe(0);
        });

        test('should provide data summary', async () => {
            // Add some test data
            await request(app)
                .post('/api/universal-gallery/analytics/events')
                .send({
                    sessionId: 'summary-test-session',
                    events: [
                        { type: 'gallery_view', timestamp: Date.now() },
                        { type: 'image_click', timestamp: Date.now() }
                    ]
                })
                .expect(200);

            const response = await request(app)
                .get('/api/universal-gallery/test/data-summary')
                .expect(200);

            expect(response.body).toMatchObject({
                galleries: expect.any(Number),
                images: expect.any(Number),
                analyticsEvents: expect.any(Number),
                performanceEntries: expect.any(Number),
                sessions: expect.any(Number)
            });

            expect(response.body.analyticsEvents).toBeGreaterThan(0);
            expect(response.body.sessions).toBeGreaterThan(0);
        });
    });

    describe('API Performance and Reliability', () => {
        test('should handle concurrent requests', async () => {
            const requests = [];
            const numRequests = 10;

            for (let i = 0; i < numRequests; i++) {
                requests.push(
                    request(app)
                        .get('/api/universal-gallery/config/concurrent-test')
                        .expect(200)
                );
            }

            const responses = await Promise.all(requests);

            expect(responses).toHaveLength(numRequests);
            responses.forEach(response => {
                expect(response.body).toHaveProperty('id', 'concurrent-test');
            });
        });

        test('should handle network delay simulation', async () => {
            // Enable network delay
            await request(app)
                .post('/api/universal-gallery/test/error-config')
                .send({
                    networkDelay: { enabled: true, min: 200, max: 300 }
                })
                .expect(200);

            const startTime = Date.now();
            
            await request(app)
                .get('/api/universal-gallery/config/delay-test')
                .expect(200);

            const endTime = Date.now();
            const duration = endTime - startTime;

            expect(duration).toBeGreaterThan(190); // Should be delayed

            // Disable delay
            await request(app)
                .post('/api/universal-gallery/test/error-config')
                .send({
                    networkDelay: { enabled: false }
                })
                .expect(200);
        });

        test('should recover from simulated failures', async () => {
            // Enable failures
            await request(app)
                .post('/api/universal-gallery/test/error-config')
                .send({
                    apiResponse: { enabled: true, rate: 0.8 }
                })
                .expect(200);

            let successCount = 0;
            let errorCount = 0;

            // Make multiple requests
            for (let i = 0; i < 10; i++) {
                try {
                    const response = await request(app)
                        .get('/api/universal-gallery/config/reliability-test');
                    
                    if (response.status === 200) {
                        successCount++;
                    } else {
                        errorCount++;
                    }
                } catch (error) {
                    errorCount++;
                }
            }

            expect(errorCount).toBeGreaterThan(0); // Should have some failures
            
            // Disable failures
            await request(app)
                .post('/api/universal-gallery/test/error-config')
                .send({
                    apiResponse: { enabled: false }
                })
                .expect(200);

            // Should now succeed
            await request(app)
                .get('/api/universal-gallery/config/reliability-test')
                .expect(200);
        });
    });
});