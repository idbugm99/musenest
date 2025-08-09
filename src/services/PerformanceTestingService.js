/**
 * Performance Testing Service
 * Part of Phase C.6: Performance testing and validation
 * Provides comprehensive performance testing and monitoring for Phase C enhancements
 */

const EventEmitter = require('events');

class PerformanceTestingService extends EventEmitter {
    constructor(dbConnection, cacheService, metadataService, thumbnailService, batchService) {
        super();
        this.db = dbConnection;
        this.cacheService = cacheService;
        this.metadataService = metadataService;
        this.thumbnailService = thumbnailService;
        this.batchService = batchService;
        
        // Test configuration
        this.testResults = new Map();
        this.testCounter = 0;
        this.performanceBaselines = {
            gallery_load_time: 2000, // 2 seconds baseline
            cache_hit_ratio: 0.7, // 70% cache hit ratio target
            metadata_load_time: 500, // 500ms for metadata
            thumbnail_generation: 3000, // 3 seconds for thumbnail
            batch_processing_rate: 10 // 10 items per second
        };
        
        console.log('🧪 PerformanceTestingService initialized');
    }

    /**
     * Run comprehensive performance test suite
     * @param {string} modelSlug - Test model slug
     * @param {Object} options - Test options
     * @returns {Object} Complete test results
     */
    async runFullTestSuite(modelSlug, options = {}) {
        const suiteId = `suite_${++this.testCounter}_${Date.now()}`;
        const startTime = Date.now();
        
        console.log(`🧪 Starting comprehensive performance test suite: ${suiteId}`);

        const testResults = {
            suiteId,
            modelSlug,
            startTime,
            tests: {},
            summary: {},
            recommendations: []
        };

        try {
            // Test 1: Cache Performance
            console.log('🧪 Testing cache performance...');
            testResults.tests.cachePerformance = await this.testCachePerformance(modelSlug);
            
            // Test 2: Metadata Service Performance
            console.log('🧪 Testing metadata service performance...');
            testResults.tests.metadataPerformance = await this.testMetadataServicePerformance(modelSlug);
            
            // Test 3: Gallery Rendering Performance
            console.log('🧪 Testing gallery rendering performance...');
            testResults.tests.galleryPerformance = await this.testGalleryRenderingPerformance(modelSlug);
            
            // Test 4: Thumbnail Generation Performance
            console.log('🧪 Testing thumbnail generation performance...');
            testResults.tests.thumbnailPerformance = await this.testThumbnailPerformance(modelSlug);
            
            // Test 5: Batch Operations Performance
            console.log('🧪 Testing batch operations performance...');
            testResults.tests.batchPerformance = await this.testBatchOperationPerformance(modelSlug);
            
            // Test 6: Database Query Performance
            console.log('🧪 Testing database query performance...');
            testResults.tests.databasePerformance = await this.testDatabasePerformance(modelSlug);
            
            // Test 7: Concurrent Load Testing
            console.log('🧪 Testing concurrent load performance...');
            testResults.tests.concurrentPerformance = await this.testConcurrentLoad(modelSlug);

            // Generate summary and recommendations
            testResults.summary = this.generateTestSummary(testResults.tests);
            testResults.recommendations = this.generateRecommendations(testResults.tests);
            testResults.completedAt = Date.now();
            testResults.totalDuration = testResults.completedAt - testResults.startTime;

            // Store results
            this.testResults.set(suiteId, testResults);
            
            console.log(`✅ Performance test suite completed: ${suiteId} (${testResults.totalDuration}ms)`);
            
            return {
                success: true,
                suiteId,
                results: testResults,
                passingTests: Object.values(testResults.tests).filter(t => t.passed).length,
                totalTests: Object.keys(testResults.tests).length
            };

        } catch (error) {
            console.error('❌ Performance test suite failed:', error.message);
            testResults.error = error.message;
            testResults.completedAt = Date.now();
            testResults.totalDuration = testResults.completedAt - testResults.startTime;
            
            this.testResults.set(suiteId, testResults);
            
            return {
                success: false,
                suiteId,
                error: error.message,
                partialResults: testResults
            };
        }
    }

    /**
     * Test cache performance
     */
    async testCachePerformance(modelSlug) {
        const testStart = Date.now();
        const results = {
            testName: 'Cache Performance Test',
            passed: false,
            metrics: {},
            details: []
        };

        try {
            // Test 1: Cache set/get performance
            const cacheKey = `test_${Date.now()}`;
            const testData = { test: 'data', timestamp: Date.now() };
            
            const setStart = Date.now();
            await this.cacheService.setCachedGallery(modelSlug, 'test', testData, 300);
            const setTime = Date.now() - setStart;
            
            const getStart = Date.now();
            const retrieved = await this.cacheService.getCachedGallery(modelSlug, 'test');
            const getTime = Date.now() - getStart;
            
            results.metrics.cacheSetTime = setTime;
            results.metrics.cacheGetTime = getTime;
            results.details.push(`Cache set time: ${setTime}ms`);
            results.details.push(`Cache get time: ${getTime}ms`);

            // Test 2: Cache hit ratio simulation
            let hits = 0;
            let total = 10;
            
            for (let i = 0; i < total; i++) {
                const key = `test_${i % 3}`; // Reuse keys to simulate cache hits
                const data = { iteration: i };
                
                // Set data
                await this.cacheService.setCachedGallery(modelSlug, key, data, 300);
                
                // Try to get it back
                const cached = await this.cacheService.getCachedGallery(modelSlug, key);
                if (cached) hits++;
            }
            
            const hitRatio = hits / total;
            results.metrics.simulatedHitRatio = hitRatio;
            results.details.push(`Simulated hit ratio: ${(hitRatio * 100).toFixed(1)}%`);

            // Test 3: Cache statistics
            const cacheStats = await this.cacheService.getCacheStatistics();
            results.metrics.cacheStats = cacheStats;

            // Evaluation
            const passConditions = [
                setTime < 100, // Cache set should be under 100ms
                getTime < 50,  // Cache get should be under 50ms
                hitRatio >= 0.5 // At least 50% hit ratio in simulation
            ];
            
            results.passed = passConditions.every(condition => condition);
            results.duration = Date.now() - testStart;
            
            return results;

        } catch (error) {
            results.error = error.message;
            results.duration = Date.now() - testStart;
            return results;
        }
    }

    /**
     * Test metadata service performance
     */
    async testMetadataServicePerformance(modelSlug) {
        const testStart = Date.now();
        const results = {
            testName: 'Metadata Service Performance Test',
            passed: false,
            metrics: {},
            details: []
        };

        try {
            // Get some media IDs for testing
            const [mediaRows] = await this.db.execute(`
                SELECT id FROM model_media_library 
                WHERE model_slug = ? AND is_deleted = 0 
                LIMIT 20
            `, [modelSlug]);

            if (mediaRows.length === 0) {
                results.error = 'No media found for testing';
                return results;
            }

            const mediaIds = mediaRows.map(row => row.id);

            // Test 1: Single metadata retrieval
            const singleStart = Date.now();
            const singleResult = await this.metadataService.getMediaMetadata(
                modelSlug, 
                mediaIds[0], 
                false
            );
            const singleTime = Date.now() - singleStart;

            results.metrics.singleMetadataTime = singleTime;
            results.details.push(`Single metadata retrieval: ${singleTime}ms`);

            // Test 2: Batch metadata retrieval
            const batchStart = Date.now();
            const batchResult = await this.metadataService.getBatchMediaMetadata(
                modelSlug, 
                mediaIds.slice(0, 10), 
                false
            );
            const batchTime = Date.now() - batchStart;

            results.metrics.batchMetadataTime = batchTime;
            results.metrics.batchItemCount = 10;
            results.metrics.averageTimePerItem = Math.round(batchTime / 10);
            results.details.push(`Batch metadata retrieval (10 items): ${batchTime}ms`);
            results.details.push(`Average time per item: ${results.metrics.averageTimePerItem}ms`);

            // Test 3: Cache effectiveness
            const cacheTestStart = Date.now();
            const cachedResult = await this.metadataService.getMediaMetadata(
                modelSlug, 
                mediaIds[0], 
                false
            );
            const cacheTestTime = Date.now() - cacheTestStart;

            results.metrics.cachedRetrievalTime = cacheTestTime;
            results.metrics.cacheSpeedup = Math.round(singleTime / cacheTestTime);
            results.details.push(`Cached retrieval: ${cacheTestTime}ms`);
            results.details.push(`Cache speedup: ${results.metrics.cacheSpeedup}x`);

            // Evaluation
            const passConditions = [
                singleTime < this.performanceBaselines.metadata_load_time,
                results.metrics.averageTimePerItem < 100,
                cacheTestTime < singleTime,
                singleResult.success && batchResult.success
            ];
            
            results.passed = passConditions.every(condition => condition);
            results.duration = Date.now() - testStart;
            
            return results;

        } catch (error) {
            results.error = error.message;
            results.duration = Date.now() - testStart;
            return results;
        }
    }

    /**
     * Test gallery rendering performance
     */
    async testGalleryRenderingPerformance(modelSlug) {
        const testStart = Date.now();
        const results = {
            testName: 'Gallery Rendering Performance Test',
            passed: false,
            metrics: {},
            details: []
        };

        try {
            // Import gallery rendering service
            const GalleryRenderingService = require('./GalleryRenderingService');
            const galleryService = new GalleryRenderingService(this.db, this.cacheService);

            // Test 1: Cold gallery load (no cache)
            await this.cacheService.invalidateGallery(modelSlug);
            
            const coldStart = Date.now();
            const coldResult = await galleryService.getPublishedGallerySections(modelSlug, true);
            const coldTime = Date.now() - coldStart;

            results.metrics.coldLoadTime = coldTime;
            results.metrics.sectionsLoaded = coldResult.totalSections || 0;
            results.metrics.imagesLoaded = coldResult.totalImages || 0;
            results.details.push(`Cold load time: ${coldTime}ms`);
            results.details.push(`Sections loaded: ${results.metrics.sectionsLoaded}`);
            results.details.push(`Images loaded: ${results.metrics.imagesLoaded}`);

            // Test 2: Warm gallery load (with cache)
            const warmStart = Date.now();
            const warmResult = await galleryService.getPublishedGallerySections(modelSlug, true);
            const warmTime = Date.now() - warmStart;

            results.metrics.warmLoadTime = warmTime;
            results.metrics.cacheSpeedup = Math.round(coldTime / warmTime);
            results.details.push(`Warm load time: ${warmTime}ms`);
            results.details.push(`Cache speedup: ${results.metrics.cacheSpeedup}x`);

            // Test 3: Multiple concurrent requests
            const concurrentStart = Date.now();
            const concurrentPromises = Array(5).fill().map(() => 
                galleryService.getPublishedGallerySections(modelSlug, true)
            );
            await Promise.all(concurrentPromises);
            const concurrentTime = Date.now() - concurrentStart;

            results.metrics.concurrentLoadTime = concurrentTime;
            results.details.push(`5 concurrent requests: ${concurrentTime}ms`);

            // Evaluation
            const passConditions = [
                coldTime < this.performanceBaselines.gallery_load_time,
                warmTime < coldTime / 2, // Cache should provide 2x speedup minimum
                coldResult.success && warmResult.success,
                results.metrics.cacheSpeedup >= 2
            ];
            
            results.passed = passConditions.every(condition => condition);
            results.duration = Date.now() - testStart;
            
            return results;

        } catch (error) {
            results.error = error.message;
            results.duration = Date.now() - testStart;
            return results;
        }
    }

    /**
     * Test thumbnail performance
     */
    async testThumbnailPerformance(modelSlug) {
        const testStart = Date.now();
        const results = {
            testName: 'Thumbnail Performance Test',
            passed: false,
            metrics: {},
            details: []
        };

        try {
            // Get a test media file
            const [mediaRows] = await this.db.execute(`
                SELECT id, filename FROM model_media_library 
                WHERE model_slug = ? AND is_deleted = 0 
                LIMIT 1
            `, [modelSlug]);

            if (mediaRows.length === 0) {
                results.error = 'No media found for thumbnail testing';
                return results;
            }

            const media = mediaRows[0];
            const path = require('path');
            const originalPath = path.join(__dirname, '../../public/uploads', modelSlug, 'originals', media.filename);

            // Test 1: Single thumbnail generation
            const singleStart = Date.now();
            const singleResult = await this.thumbnailService.getOptimizedThumbnail(
                modelSlug, 
                originalPath, 
                'medium'
            );
            const singleTime = Date.now() - singleStart;

            results.metrics.singleThumbnailTime = singleTime;
            results.details.push(`Single thumbnail generation: ${singleTime}ms`);

            // Test 2: Multiple size generation
            const multiStart = Date.now();
            const multiResult = await this.thumbnailService.generateMultipleThumbnails(
                modelSlug, 
                originalPath, 
                ['small', 'medium', 'large']
            );
            const multiTime = Date.now() - multiStart;

            results.metrics.multipleThumbnailTime = multiTime;
            results.metrics.averagePerThumbnail = Math.round(multiTime / 3);
            results.details.push(`Multiple thumbnails (3): ${multiTime}ms`);
            results.details.push(`Average per thumbnail: ${results.metrics.averagePerThumbnail}ms`);

            // Test 3: Cache effectiveness
            const cacheStart = Date.now();
            const cacheResult = await this.thumbnailService.getOptimizedThumbnail(
                modelSlug, 
                originalPath, 
                'medium'
            );
            const cacheTime = Date.now() - cacheStart;

            results.metrics.cachedThumbnailTime = cacheTime;
            results.details.push(`Cached thumbnail retrieval: ${cacheTime}ms`);

            // Evaluation
            const passConditions = [
                singleTime < this.performanceBaselines.thumbnail_generation,
                results.metrics.averagePerThumbnail < 2000,
                cacheTime < 100, // Cached thumbnails should be very fast
                singleResult.success && multiResult.success
            ];
            
            results.passed = passConditions.every(condition => condition);
            results.duration = Date.now() - testStart;
            
            return results;

        } catch (error) {
            results.error = error.message;
            results.duration = Date.now() - testStart;
            return results;
        }
    }

    /**
     * Test batch operation performance
     */
    async testBatchOperationPerformance(modelSlug) {
        const testStart = Date.now();
        const results = {
            testName: 'Batch Operations Performance Test',
            passed: false,
            metrics: {},
            details: []
        };

        try {
            // Get some media IDs for testing
            const [mediaRows] = await this.db.execute(`
                SELECT id FROM model_media_library 
                WHERE model_slug = ? AND is_deleted = 0 
                LIMIT 10
            `, [modelSlug]);

            if (mediaRows.length < 5) {
                results.error = 'Insufficient media for batch testing (need at least 5)';
                return results;
            }

            const mediaIds = mediaRows.map(row => row.id);

            // Test 1: Batch approval operation
            const approveStart = Date.now();
            const approveResult = await this.batchService.executeBatchOperation(
                'approve',
                modelSlug,
                mediaIds.slice(0, 5),
                { approvedBy: 'performance_test' }
            );
            const approveTime = Date.now() - approveStart;

            results.metrics.batchApproveTime = approveTime;
            results.metrics.approveItemsPerSecond = Math.round((5 / (approveTime / 1000)) * 100) / 100;
            results.details.push(`Batch approve (5 items): ${approveTime}ms`);
            results.details.push(`Approve rate: ${results.metrics.approveItemsPerSecond} items/sec`);

            // Test 2: Batch category setting
            const categoryStart = Date.now();
            const categoryResult = await this.batchService.executeBatchOperation(
                'set_featured',
                modelSlug,
                mediaIds.slice(0, 3),
                { featured: true }
            );
            const categoryTime = Date.now() - categoryStart;

            results.metrics.batchCategoryTime = categoryTime;
            results.metrics.categoryItemsPerSecond = Math.round((3 / (categoryTime / 1000)) * 100) / 100;
            results.details.push(`Batch set featured (3 items): ${categoryTime}ms`);
            results.details.push(`Category rate: ${results.metrics.categoryItemsPerSecond} items/sec`);

            // Test 3: Overall batch throughput
            const overallRate = (8 / ((approveTime + categoryTime) / 1000));
            results.metrics.overallItemsPerSecond = Math.round(overallRate * 100) / 100;
            results.details.push(`Overall throughput: ${results.metrics.overallItemsPerSecond} items/sec`);

            // Evaluation
            const passConditions = [
                approveResult.success && categoryResult.success,
                results.metrics.approveItemsPerSecond >= this.performanceBaselines.batch_processing_rate / 2,
                approveTime < 5000, // Batch operations should complete within 5 seconds
                categoryTime < 3000
            ];
            
            results.passed = passConditions.every(condition => condition);
            results.duration = Date.now() - testStart;
            
            return results;

        } catch (error) {
            results.error = error.message;
            results.duration = Date.now() - testStart;
            return results;
        }
    }

    /**
     * Test database query performance
     */
    async testDatabasePerformance(modelSlug) {
        const testStart = Date.now();
        const results = {
            testName: 'Database Performance Test',
            passed: false,
            metrics: {},
            details: []
        };

        try {
            // Test 1: Simple media query
            const simpleStart = Date.now();
            const [simpleResult] = await this.db.execute(`
                SELECT COUNT(*) as count FROM model_media_library 
                WHERE model_slug = ? AND is_deleted = 0
            `, [modelSlug]);
            const simpleTime = Date.now() - simpleStart;

            results.metrics.simpleQueryTime = simpleTime;
            results.metrics.mediaCount = simpleResult[0].count;
            results.details.push(`Simple count query: ${simpleTime}ms`);
            results.details.push(`Media count: ${results.metrics.mediaCount}`);

            // Test 2: Complex join query
            const complexStart = Date.now();
            const [complexResult] = await this.db.execute(`
                SELECT mml.id, mml.filename, mml.moderation_status,
                       COUNT(mgsm.section_id) as section_count
                FROM model_media_library mml
                LEFT JOIN model_gallery_section_media mgsm ON mml.id = mgsm.media_id
                WHERE mml.model_slug = ? AND mml.is_deleted = 0
                GROUP BY mml.id
                ORDER BY mml.upload_date DESC
                LIMIT 50
            `, [modelSlug]);
            const complexTime = Date.now() - complexStart;

            results.metrics.complexQueryTime = complexTime;
            results.metrics.complexResultCount = complexResult.length;
            results.details.push(`Complex join query: ${complexTime}ms`);
            results.details.push(`Complex result count: ${results.metrics.complexResultCount}`);

            // Test 3: Multiple concurrent queries
            const concurrentStart = Date.now();
            const concurrentPromises = Array(5).fill().map((_, i) => 
                this.db.execute(`
                    SELECT * FROM model_media_library 
                    WHERE model_slug = ? AND is_deleted = 0 
                    LIMIT 10 OFFSET ?
                `, [modelSlug, i * 10])
            );
            await Promise.all(concurrentPromises);
            const concurrentTime = Date.now() - concurrentStart;

            results.metrics.concurrentQueryTime = concurrentTime;
            results.details.push(`5 concurrent queries: ${concurrentTime}ms`);

            // Evaluation
            const passConditions = [
                simpleTime < 100,    // Simple queries under 100ms
                complexTime < 500,   // Complex queries under 500ms
                concurrentTime < 1000, // Concurrent queries under 1 second
                results.metrics.complexResultCount > 0
            ];
            
            results.passed = passConditions.every(condition => condition);
            results.duration = Date.now() - testStart;
            
            return results;

        } catch (error) {
            results.error = error.message;
            results.duration = Date.now() - testStart;
            return results;
        }
    }

    /**
     * Test concurrent load performance
     */
    async testConcurrentLoad(modelSlug) {
        const testStart = Date.now();
        const results = {
            testName: 'Concurrent Load Test',
            passed: false,
            metrics: {},
            details: []
        };

        try {
            const concurrentUsers = 10;
            const requestsPerUser = 3;
            
            // Simulate concurrent users making multiple requests
            const userPromises = Array(concurrentUsers).fill().map(async (_, userIndex) => {
                const userStart = Date.now();
                const userRequests = [];
                
                // Each user makes multiple requests
                for (let i = 0; i < requestsPerUser; i++) {
                    if (i % 3 === 0) {
                        // Gallery request
                        userRequests.push(this.metadataService.getBatchMediaMetadata(modelSlug, [1, 2, 3], false));
                    } else if (i % 3 === 1) {
                        // Metadata request
                        userRequests.push(this.cacheService.getCachedGallery(modelSlug, 'test'));
                    } else {
                        // Cache request
                        userRequests.push(this.db.execute('SELECT 1'));
                    }
                }
                
                await Promise.all(userRequests);
                return Date.now() - userStart;
            });

            const userTimes = await Promise.all(userPromises);
            const totalConcurrentTime = Date.now() - testStart;

            results.metrics.totalConcurrentTime = totalConcurrentTime;
            results.metrics.averageUserTime = Math.round(userTimes.reduce((a, b) => a + b, 0) / userTimes.length);
            results.metrics.maxUserTime = Math.max(...userTimes);
            results.metrics.minUserTime = Math.min(...userTimes);
            results.metrics.concurrentUsers = concurrentUsers;
            results.metrics.totalRequests = concurrentUsers * requestsPerUser;

            results.details.push(`Total concurrent time: ${totalConcurrentTime}ms`);
            results.details.push(`Average user time: ${results.metrics.averageUserTime}ms`);
            results.details.push(`Max user time: ${results.metrics.maxUserTime}ms`);
            results.details.push(`Min user time: ${results.metrics.minUserTime}ms`);
            results.details.push(`Concurrent users: ${concurrentUsers}`);
            results.details.push(`Total requests: ${results.metrics.totalRequests}`);

            // Evaluation
            const passConditions = [
                results.metrics.averageUserTime < 2000, // Average user experience under 2 seconds
                results.metrics.maxUserTime < 5000, // No user waits more than 5 seconds
                totalConcurrentTime < 10000 // Total test completes within 10 seconds
            ];
            
            results.passed = passConditions.every(condition => condition);
            results.duration = Date.now() - testStart;
            
            return results;

        } catch (error) {
            results.error = error.message;
            results.duration = Date.now() - testStart;
            return results;
        }
    }

    /**
     * Generate test summary
     */
    generateTestSummary(tests) {
        const testCount = Object.keys(tests).length;
        const passedTests = Object.values(tests).filter(test => test.passed).length;
        const failedTests = testCount - passedTests;
        
        return {
            totalTests: testCount,
            passedTests,
            failedTests,
            passRate: Math.round((passedTests / testCount) * 100),
            overallStatus: passedTests === testCount ? 'PASS' : 'FAIL'
        };
    }

    /**
     * Generate performance recommendations
     */
    generateRecommendations(tests) {
        const recommendations = [];

        // Cache performance recommendations
        if (tests.cachePerformance && !tests.cachePerformance.passed) {
            recommendations.push({
                category: 'Cache',
                priority: 'High',
                issue: 'Cache performance below expectations',
                recommendation: 'Consider upgrading to Redis cache backend for better performance',
                impact: 'High - affects all cached operations'
            });
        }

        // Metadata performance recommendations
        if (tests.metadataPerformance && tests.metadataPerformance.metrics.averageTimePerItem > 200) {
            recommendations.push({
                category: 'Metadata',
                priority: 'Medium',
                issue: 'Metadata retrieval time higher than optimal',
                recommendation: 'Implement database indexing on frequently queried fields',
                impact: 'Medium - affects metadata-heavy operations'
            });
        }

        // Gallery performance recommendations
        if (tests.galleryPerformance && tests.galleryPerformance.metrics.coldLoadTime > 3000) {
            recommendations.push({
                category: 'Gallery',
                priority: 'High',
                issue: 'Gallery load times are slow',
                recommendation: 'Implement gallery section caching and optimize media queries',
                impact: 'High - affects user experience'
            });
        }

        // Thumbnail performance recommendations
        if (tests.thumbnailPerformance && tests.thumbnailPerformance.metrics.averagePerThumbnail > 2000) {
            recommendations.push({
                category: 'Thumbnails',
                priority: 'Medium',
                issue: 'Thumbnail generation is slow',
                recommendation: 'Pre-generate thumbnails during upload and optimize Sharp.js settings',
                impact: 'Medium - affects thumbnail-dependent features'
            });
        }

        // Database performance recommendations
        if (tests.databasePerformance && tests.databasePerformance.metrics.complexQueryTime > 1000) {
            recommendations.push({
                category: 'Database',
                priority: 'High',
                issue: 'Complex database queries are slow',
                recommendation: 'Add database indexes and consider query optimization',
                impact: 'High - affects overall system performance'
            });
        }

        // Add general recommendations if no specific issues found
        if (recommendations.length === 0) {
            recommendations.push({
                category: 'General',
                priority: 'Low',
                issue: 'All performance tests passed',
                recommendation: 'Continue monitoring performance and consider implementing metrics collection',
                impact: 'Low - maintenance recommendation'
            });
        }

        return recommendations;
    }

    /**
     * Get test results by suite ID
     */
    getTestResults(suiteId) {
        return this.testResults.get(suiteId) || null;
    }

    /**
     * Get all test results
     */
    getAllTestResults() {
        return Array.from(this.testResults.values());
    }

    /**
     * Clear old test results
     */
    clearOldResults(maxAge = 24 * 60 * 60 * 1000) { // 24 hours
        const cutoffTime = Date.now() - maxAge;
        
        for (const [suiteId, results] of this.testResults.entries()) {
            if (results.startTime < cutoffTime) {
                this.testResults.delete(suiteId);
            }
        }
    }
}

module.exports = PerformanceTestingService;