/**
 * Performance Testing API Routes
 * Part of Phase C.6: Performance testing and validation
 * Provides API endpoints for comprehensive performance testing and monitoring
 */

const express = require('express');
const router = express.Router();
const PerformanceTestingService = require('../../src/services/PerformanceTestingService');
const GalleryCacheService = require('../../src/services/GalleryCacheService');
const MediaMetadataService = require('../../src/services/MediaMetadataService');
const ThumbnailOptimizationService = require('../../src/services/ThumbnailOptimizationService');
const BatchOperationService = require('../../src/services/BatchOperationService');
const ImageProcessingQueue = require('../../src/services/ImageProcessingQueue');

// Initialize services
let performanceService = null;

// Middleware to initialize performance testing service
router.use((req, res, next) => {
    if (!performanceService && req.db) {
        // Initialize all required services
        const cacheService = new GalleryCacheService();
        const processingQueue = new ImageProcessingQueue(req.db);
        const metadataService = new MediaMetadataService(req.db, cacheService);
        const thumbnailService = new ThumbnailOptimizationService(cacheService, processingQueue);
        const batchService = new BatchOperationService(req.db, cacheService, processingQueue);
        
        performanceService = new PerformanceTestingService(
            req.db,
            cacheService,
            metadataService,
            thumbnailService,
            batchService
        );
        
        console.log('🧪 PerformanceTestingService initialized for API routes');
    }
    next();
});

/**
 * POST /api/performance-testing/:modelSlug/run-full-suite
 * Run comprehensive performance test suite
 */
router.post('/:modelSlug/run-full-suite', async (req, res) => {
    try {
        if (!performanceService) {
            return res.status(500).json({
                success: false,
                error: 'Performance testing service not initialized'
            });
        }

        const { modelSlug } = req.params;
        const options = req.body.options || {};

        if (!modelSlug) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameter: modelSlug'
            });
        }

        console.log(`🧪 Starting full performance test suite for ${modelSlug}`);

        const result = await performanceService.runFullTestSuite(modelSlug, options);

        if (result.success) {
            res.json({
                success: true,
                message: 'Performance test suite completed',
                suiteId: result.suiteId,
                summary: {
                    totalTests: result.totalTests,
                    passingTests: result.passingTests,
                    passRate: Math.round((result.passingTests / result.totalTests) * 100),
                    overallStatus: result.passingTests === result.totalTests ? 'PASS' : 'FAIL',
                    duration: result.results.totalDuration
                },
                testResults: {
                    cachePerformance: this.formatTestResult(result.results.tests.cachePerformance),
                    metadataPerformance: this.formatTestResult(result.results.tests.metadataPerformance),
                    galleryPerformance: this.formatTestResult(result.results.tests.galleryPerformance),
                    thumbnailPerformance: this.formatTestResult(result.results.tests.thumbnailPerformance),
                    batchPerformance: this.formatTestResult(result.results.tests.batchPerformance),
                    databasePerformance: this.formatTestResult(result.results.tests.databasePerformance),
                    concurrentPerformance: this.formatTestResult(result.results.tests.concurrentPerformance)
                },
                recommendations: result.results.recommendations
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Performance test suite failed',
                suiteId: result.suiteId,
                details: result.error,
                partialResults: result.partialResults
            });
        }

    } catch (error) {
        console.error('❌ Error running performance test suite:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to run performance test suite'
        });
    }
});

/**
 * GET /api/performance-testing/results/:suiteId
 * Get detailed results for a specific test suite
 */
router.get('/results/:suiteId', (req, res) => {
    try {
        if (!performanceService) {
            return res.status(500).json({
                success: false,
                error: 'Performance testing service not initialized'
            });
        }

        const { suiteId } = req.params;

        if (!suiteId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameter: suiteId'
            });
        }

        const results = performanceService.getTestResults(suiteId);

        if (!results) {
            return res.status(404).json({
                success: false,
                error: 'Test suite results not found'
            });
        }

        res.json({
            success: true,
            suiteId,
            results: {
                ...results,
                // Format the test results for better API response
                tests: Object.fromEntries(
                    Object.entries(results.tests).map(([testName, testResult]) => [
                        testName,
                        this.formatTestResult(testResult)
                    ])
                )
            }
        });

    } catch (error) {
        console.error('❌ Error getting test results:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get test results'
        });
    }
});

/**
 * GET /api/performance-testing/results
 * Get all test results (recent)
 */
router.get('/results', (req, res) => {
    try {
        if (!performanceService) {
            return res.status(500).json({
                success: false,
                error: 'Performance testing service not initialized'
            });
        }

        const { limit = 10 } = req.query;
        const allResults = performanceService.getAllTestResults();
        
        // Sort by most recent first and limit
        const recentResults = allResults
            .sort((a, b) => b.startTime - a.startTime)
            .slice(0, parseInt(limit))
            .map(result => ({
                suiteId: result.suiteId,
                modelSlug: result.modelSlug,
                startTime: result.startTime,
                completedAt: result.completedAt,
                totalDuration: result.totalDuration,
                summary: result.summary,
                recommendationCount: result.recommendations ? result.recommendations.length : 0
            }));

        res.json({
            success: true,
            results: recentResults,
            totalResults: allResults.length,
            limit: parseInt(limit)
        });

    } catch (error) {
        console.error('❌ Error getting all test results:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get test results'
        });
    }
});

/**
 * POST /api/performance-testing/cleanup-results
 * Clean up old test results
 */
router.post('/cleanup-results', (req, res) => {
    try {
        if (!performanceService) {
            return res.status(500).json({
                success: false,
                error: 'Performance testing service not initialized'
            });
        }

        const { maxAge = 24 } = req.body; // Hours
        const maxAgeMs = maxAge * 60 * 60 * 1000;
        
        const beforeCount = performanceService.getAllTestResults().length;
        performanceService.clearOldResults(maxAgeMs);
        const afterCount = performanceService.getAllTestResults().length;
        const cleaned = beforeCount - afterCount;

        console.log(`🧹 Cleaned up ${cleaned} old performance test results`);

        res.json({
            success: true,
            message: 'Old test results cleaned up',
            cleaned,
            remaining: afterCount,
            maxAge: `${maxAge} hours`
        });

    } catch (error) {
        console.error('❌ Error cleaning up test results:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to cleanup test results'
        });
    }
});

/**
 * GET /api/performance-testing/benchmarks
 * Get performance benchmarks and thresholds
 */
router.get('/benchmarks', (req, res) => {
    try {
        if (!performanceService) {
            return res.status(500).json({
                success: false,
                error: 'Performance testing service not initialized'
            });
        }

        res.json({
            success: true,
            benchmarks: performanceService.performanceBaselines,
            testCategories: {
                cachePerformance: {
                    description: 'Tests cache set/get performance and hit ratios',
                    keyMetrics: ['cacheSetTime', 'cacheGetTime', 'simulatedHitRatio']
                },
                metadataPerformance: {
                    description: 'Tests metadata service retrieval and caching',
                    keyMetrics: ['singleMetadataTime', 'batchMetadataTime', 'cacheSpeedup']
                },
                galleryPerformance: {
                    description: 'Tests gallery rendering with and without cache',
                    keyMetrics: ['coldLoadTime', 'warmLoadTime', 'cacheSpeedup']
                },
                thumbnailPerformance: {
                    description: 'Tests thumbnail generation and optimization',
                    keyMetrics: ['singleThumbnailTime', 'multipleThumbnailTime', 'cachedThumbnailTime']
                },
                batchPerformance: {
                    description: 'Tests batch operations throughput',
                    keyMetrics: ['batchApproveTime', 'approveItemsPerSecond', 'overallItemsPerSecond']
                },
                databasePerformance: {
                    description: 'Tests database query performance',
                    keyMetrics: ['simpleQueryTime', 'complexQueryTime', 'concurrentQueryTime']
                },
                concurrentPerformance: {
                    description: 'Tests system performance under concurrent load',
                    keyMetrics: ['totalConcurrentTime', 'averageUserTime', 'maxUserTime']
                }
            }
        });

    } catch (error) {
        console.error('❌ Error getting benchmarks:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get benchmarks'
        });
    }
});

/**
 * GET /api/performance-testing/service-status
 * Get performance testing service status
 */
router.get('/service-status', (req, res) => {
    try {
        res.json({
            success: true,
            status: {
                initialized: !!performanceService,
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
                nodeVersion: process.version,
                availableTests: [
                    'cachePerformance',
                    'metadataPerformance', 
                    'galleryPerformance',
                    'thumbnailPerformance',
                    'batchPerformance',
                    'databasePerformance',
                    'concurrentPerformance'
                ],
                totalTestResultsStored: performanceService ? performanceService.getAllTestResults().length : 0
            }
        });

    } catch (error) {
        console.error('❌ Error getting service status:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get service status'
        });
    }
});

// Helper method to format test results for API response
router.formatTestResult = function(testResult) {
    if (!testResult) return null;
    
    return {
        testName: testResult.testName,
        passed: testResult.passed,
        duration: testResult.duration,
        keyMetrics: testResult.metrics ? Object.keys(testResult.metrics).slice(0, 5) : [],
        summary: testResult.details ? testResult.details.slice(0, 3) : [],
        error: testResult.error || null
    };
};

module.exports = router;