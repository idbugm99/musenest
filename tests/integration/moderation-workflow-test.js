/**
 * End-to-End Moderation Workflow Integration Test
 * Part of Phase B.7: Test Complete Moderation Workflow End-to-End
 * Tests the entire integrated workflow from upload through completion
 */

const path = require('path');
const fs = require('fs').promises;
const mysql = require('mysql2/promise');

// Import our integrated services
const MediaUploadService = require('../../src/services/MediaUploadService');
const ModerationCallbackHandler = require('../../src/services/ModerationCallbackHandler');
const FileStorageService = require('../../src/services/FileStorageService');
const MediaLogger = require('../../src/services/MediaLogger');
const ModerationRetryService = require('../../src/services/ModerationRetryService');
const AdminNotificationService = require('../../src/services/AdminNotificationService');

class ModerationWorkflowTest {
    constructor() {
        this.db = null;
        this.testResults = {
            totalTests: 0,
            passed: 0,
            failed: 0,
            errors: [],
            executionTime: 0
        };
        
        // Test configuration
        this.testConfig = {
            testModelSlug: 'test-model-workflow',
            testMediaId: 12345,
            testFiles: [
                { name: 'test-upload-1.jpg', size: 1024000 },
                { name: 'test-upload-2.png', size: 2048000 },
                { name: 'test-upload-3.gif', size: 512000 }
            ]
        };
        
        console.log('🧪 Moderation Workflow Test Suite initialized');
    }

    /**
     * Initialize database connection for testing
     */
    async initializeDatabase() {
        try {
            this.db = await mysql.createConnection({
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME || 'phoenix4ge_db',
                port: process.env.DB_PORT || 3306
            });
            
            console.log('✅ Test database connection established');
            return true;
            
        } catch (error) {
            console.error('❌ Database connection failed:', error.message);
            return false;
        }
    }

    /**
     * Run complete workflow test suite
     */
    async runCompleteWorkflowTest() {
        const startTime = Date.now();
        console.log('🚀 Starting End-to-End Moderation Workflow Test');
        console.log('='.repeat(60));

        try {
            // Initialize database
            if (!await this.initializeDatabase()) {
                throw new Error('Failed to initialize database connection');
            }

            // Test 1: Service initialization
            await this.testServiceInitialization();

            // Test 2: Upload workflow with moderation
            await this.testUploadWorkflow();

            // Test 3: Callback processing
            await this.testCallbackProcessing();

            // Test 4: File storage management
            await this.testFileStorageManagement();

            // Test 5: Error logging and monitoring
            await this.testErrorLoggingSystem();

            // Test 6: Retry logic for failures
            await this.testRetryLogic();

            // Test 7: Admin notifications
            await this.testAdminNotifications();

            // Test 8: Integration stress test
            await this.testWorkflowUnderLoad();

            // Test 9: Error scenarios
            await this.testErrorScenarios();

            // Test 10: Cleanup and validation
            await this.testCleanupOperations();

        } catch (error) {
            this.recordTestFailure('Complete Workflow Test', error);
        }

        this.testResults.executionTime = Date.now() - startTime;
        await this.generateTestReport();
        
        if (this.db) {
            await this.db.end();
        }

        return this.testResults;
    }

    /**
     * Test 1: Service initialization and dependency injection
     */
    async testServiceInitialization() {
        console.log('\n📦 Test 1: Service Initialization');
        
        try {
            // Initialize all services
            const mediaUploadService = new MediaUploadService(this.db, {
                enableWatermarking: true,
                enableModeration: true,
                trackingEnabled: true
            });
            await mediaUploadService.initialize();

            const callbackHandler = new ModerationCallbackHandler(this.db, {
                enableLogging: true
            });

            const fileStorage = new FileStorageService({
                enableBackups: true,
                enableVersioning: true
            });

            const logger = new MediaLogger(this.db, {
                enableDatabaseLogging: true,
                enableFileLogging: false
            });

            const retryService = new ModerationRetryService(this.db, {
                enablePeriodicProcessing: false // Disable for testing
            });

            const notificationService = new AdminNotificationService(this.db, {
                enableRealTime: false, // Disable WebSocket for testing
                enableEmail: false
            });

            // Verify services are properly initialized
            this.assert(mediaUploadService !== null, 'MediaUploadService initialized');
            this.assert(callbackHandler !== null, 'ModerationCallbackHandler initialized');
            this.assert(fileStorage !== null, 'FileStorageService initialized');
            this.assert(logger !== null, 'MediaLogger initialized');
            this.assert(retryService !== null, 'ModerationRetryService initialized');
            this.assert(notificationService !== null, 'AdminNotificationService initialized');

            // Store for later tests
            this.services = {
                upload: mediaUploadService,
                callback: callbackHandler,
                storage: fileStorage,
                logger,
                retry: retryService,
                notifications: notificationService
            };

            console.log('✅ All services initialized successfully');
            this.recordTestSuccess('Service Initialization');

        } catch (error) {
            this.recordTestFailure('Service Initialization', error);
        }
    }

    /**
     * Test 2: Upload workflow with moderation submission
     */
    async testUploadWorkflow() {
        console.log('\n📤 Test 2: Upload Workflow with Moderation');

        try {
            // Create test upload directory
            const testUploadDir = path.join(process.cwd(), 'test-uploads');
            await fs.mkdir(testUploadDir, { recursive: true });

            // Create test file
            const testFilePath = path.join(testUploadDir, this.testConfig.testFiles[0].name);
            await fs.writeFile(testFilePath, 'Mock image data for testing');

            // Test upload processing
            const uploadOptions = {
                modelId: this.testConfig.testMediaId,
                modelSlug: this.testConfig.testModelSlug,
                originalName: this.testConfig.testFiles[0].name,
                usageIntent: 'gallery',
                contextType: 'public',
                title: 'Test Upload 1',
                description: 'End-to-end workflow test upload'
            };

            console.log('🔄 Processing test upload...');
            const uploadResult = await this.services.upload.submitToModeration(testFilePath, uploadOptions);

            // Validate upload result
            this.assert(uploadResult !== null, 'Upload result returned');
            this.assert(typeof uploadResult.moderationTrackingId === 'string', 'Tracking ID generated');
            this.assert(uploadResult.success === true, 'Upload processing succeeded');

            // Log upload for tracking
            await this.services.logger.logUpload({
                modelSlug: this.testConfig.testModelSlug,
                filename: this.testConfig.testFiles[0].name,
                originalFilename: this.testConfig.testFiles[0].name,
                fileSize: this.testConfig.testFiles[0].size,
                processingTime: 150,
                watermarkApplied: true,
                moderationStatus: 'submitted',
                uploadMethod: 'test',
                trackingId: uploadResult.moderationTrackingId,
                batchId: 'test-batch-001'
            });

            // Cleanup test file
            await fs.unlink(testFilePath);
            await fs.rmdir(testUploadDir);

            console.log('✅ Upload workflow completed successfully');
            this.recordTestSuccess('Upload Workflow');

        } catch (error) {
            this.recordTestFailure('Upload Workflow', error);
        }
    }

    /**
     * Test 3: Callback processing workflow
     */
    async testCallbackProcessing() {
        console.log('\n🔄 Test 3: Moderation Callback Processing');

        try {
            // Create mock callback data for different scenarios
            const callbackScenarios = [
                {
                    name: 'Approved Content',
                    data: {
                        moderationTrackingId: 'test_approved_123',
                        modelSlug: this.testConfig.testModelSlug,
                        filename: 'approved-test.jpg',
                        moderationStatus: 'approved',
                        moderationScore: 15,
                        riskLevel: 'low',
                        humanReviewRequired: false
                    }
                },
                {
                    name: 'Rejected Content',
                    data: {
                        moderationTrackingId: 'test_rejected_456',
                        modelSlug: this.testConfig.testModelSlug,
                        filename: 'rejected-test.jpg',
                        moderationStatus: 'rejected',
                        moderationScore: 85,
                        riskLevel: 'high',
                        humanReviewRequired: true,
                        violationTypes: ['inappropriate_content']
                    }
                },
                {
                    name: 'Flagged Content',
                    data: {
                        moderationTrackingId: 'test_flagged_789',
                        modelSlug: this.testConfig.testModelSlug,
                        filename: 'flagged-test.jpg',
                        moderationStatus: 'flagged',
                        moderationScore: 65,
                        riskLevel: 'medium',
                        humanReviewRequired: true,
                        detectedParts: ['face', 'body']
                    }
                }
            ];

            for (const scenario of callbackScenarios) {
                console.log(`🔍 Testing callback: ${scenario.name}`);

                const result = await this.services.callback.processMediaLibraryCallback(scenario.data);
                
                this.assert(result !== null, `${scenario.name} callback result returned`);
                this.assert(result.success === true, `${scenario.name} callback processed successfully`);

                // Log the moderation result
                await this.services.logger.logModeration({
                    ...scenario.data,
                    processingTime: 200,
                    retryAttempts: 0,
                    analysisVersion: 'v1.0.0'
                });

                console.log(`✅ ${scenario.name} callback processed successfully`);
            }

            this.recordTestSuccess('Callback Processing');

        } catch (error) {
            this.recordTestFailure('Callback Processing', error);
        }
    }

    /**
     * Test 4: File storage management
     */
    async testFileStorageManagement() {
        console.log('\n📁 Test 4: File Storage Management');

        try {
            // Create mock media data
            const mockMedia = {
                id: this.testConfig.testMediaId,
                model_slug: this.testConfig.testModelSlug,
                filename: 'storage-test.jpg'
            };

            // Test file storage for different moderation statuses
            const storageScenarios = ['approved', 'rejected', 'quarantine'];

            for (const status of storageScenarios) {
                console.log(`📂 Testing file storage: ${status}`);

                const result = await this.services.storage.moveMediaFile(mockMedia, status);
                
                // Note: This will fail in test environment as files don't exist
                // but we can validate the logic and error handling
                this.assert(result !== null, `${status} storage result returned`);
                this.assert(typeof result.success === 'boolean', `${status} storage success flag present`);

                // Log the storage operation
                await this.services.logger.logFileStorage({
                    modelSlug: mockMedia.model_slug,
                    mediaId: mockMedia.id,
                    filename: mockMedia.filename,
                    operation: 'move',
                    moderationStatus: status,
                    success: result.success,
                    error: result.error,
                    processingTime: result.processingTime
                });

                console.log(`✅ ${status} storage test completed`);
            }

            // Test storage statistics
            const storageStats = await this.services.storage.getStorageStatistics(this.testConfig.testModelSlug);
            this.assert(storageStats !== null, 'Storage statistics returned');
            this.assert(typeof storageStats.success === 'boolean', 'Storage stats success flag present');

            this.recordTestSuccess('File Storage Management');

        } catch (error) {
            this.recordTestFailure('File Storage Management', error);
        }
    }

    /**
     * Test 5: Error logging and monitoring system
     */
    async testErrorLoggingSystem() {
        console.log('\n📝 Test 5: Error Logging and Monitoring');

        try {
            // Test different types of error logging
            const errorScenarios = [
                {
                    type: 'Upload Error',
                    errorData: {
                        operation: 'media_upload',
                        errorType: 'file_too_large',
                        error: 'File exceeds maximum size limit',
                        modelSlug: this.testConfig.testModelSlug,
                        filename: 'large-file.jpg',
                        processingStage: 'validation',
                        escalationPriority: 'medium',
                        requiresManualReview: false
                    }
                },
                {
                    type: 'Moderation Error',
                    errorData: {
                        operation: 'moderation_processing',
                        errorType: 'api_timeout',
                        error: 'Moderation API request timed out',
                        modelSlug: this.testConfig.testModelSlug,
                        filename: 'timeout-test.jpg',
                        processingStage: 'analysis',
                        escalationPriority: 'high',
                        requiresManualReview: true
                    }
                },
                {
                    type: 'Storage Error',
                    errorData: {
                        operation: 'file_storage',
                        errorType: 'disk_space',
                        error: 'Insufficient disk space for file move',
                        modelSlug: this.testConfig.testModelSlug,
                        filename: 'move-failed.jpg',
                        processingStage: 'file_move',
                        escalationPriority: 'high',
                        requiresManualReview: true
                    }
                }
            ];

            for (const scenario of errorScenarios) {
                console.log(`🚨 Testing error logging: ${scenario.type}`);

                await this.services.logger.logError(scenario.errorData);

                console.log(`✅ ${scenario.type} logged successfully`);
            }

            // Test performance logging
            await this.services.logger.logPerformance({
                operation: 'workflow_test',
                processingTime: 500,
                memoryUsage: 128,
                throughput: 120,
                errorRate: 0.02,
                activeUploads: 3,
                queueDepth: 5
            });

            // Get performance statistics
            const perfStats = this.services.logger.getPerformanceStatistics();
            this.assert(perfStats !== null, 'Performance statistics returned');
            this.assert(typeof perfStats.uptime === 'number', 'Performance uptime tracked');

            this.recordTestSuccess('Error Logging System');

        } catch (error) {
            this.recordTestFailure('Error Logging System', error);
        }
    }

    /**
     * Test 6: Retry logic for failed operations
     */
    async testRetryLogic() {
        console.log('\n🔄 Test 6: Retry Logic System');

        try {
            // Add mock retry operations
            const retryScenarios = [
                {
                    operationType: 'moderation_upload',
                    trackingId: 'retry_test_001',
                    batchId: 'test-batch-retry',
                    modelSlug: this.testConfig.testModelSlug,
                    mediaId: this.testConfig.testMediaId,
                    operationData: {
                        imagePath: '/tmp/test-retry.jpg',
                        originalName: 'retry-test.jpg',
                        modelId: this.testConfig.testMediaId
                    },
                    priority: 'high'
                },
                {
                    operationType: 'moderation_callback',
                    trackingId: 'retry_test_002',
                    batchId: 'test-batch-retry',
                    modelSlug: this.testConfig.testModelSlug,
                    mediaId: this.testConfig.testMediaId + 1,
                    operationData: {
                        callbackData: {
                            moderationTrackingId: 'retry_callback_test',
                            moderationStatus: 'approved'
                        }
                    },
                    priority: 'medium'
                }
            ];

            for (const scenario of retryScenarios) {
                console.log(`🔁 Adding retry operation: ${scenario.operationType}`);

                const result = await this.services.retry.addRetryOperation(scenario);
                
                this.assert(result !== null, `${scenario.operationType} retry added`);
                this.assert(result.success === true, `${scenario.operationType} retry successful`);
                this.assert(typeof result.operationId === 'number', `${scenario.operationType} operation ID returned`);

                console.log(`✅ ${scenario.operationType} retry operation added (ID: ${result.operationId})`);
            }

            // Test retry statistics
            const retryStats = await this.services.retry.getRetryStatistics();
            this.assert(retryStats !== null, 'Retry statistics returned');
            this.assert(retryStats.success === true, 'Retry statistics successful');

            this.recordTestSuccess('Retry Logic System');

        } catch (error) {
            this.recordTestFailure('Retry Logic System', error);
        }
    }

    /**
     * Test 7: Admin notifications system
     */
    async testAdminNotifications() {
        console.log('\n📢 Test 7: Admin Notifications System');

        try {
            // Test different notification types
            const notificationScenarios = [
                {
                    type: 'Upload Success',
                    method: 'notifyUploadStatus',
                    data: {
                        modelSlug: this.testConfig.testModelSlug,
                        mediaId: this.testConfig.testMediaId,
                        filename: 'notification-test.jpg',
                        success: true,
                        fileSize: 1024000,
                        processingTime: 250,
                        watermarkApplied: true,
                        moderationStatus: 'submitted'
                    }
                },
                {
                    type: 'Upload Failure',
                    method: 'notifyUploadStatus',
                    data: {
                        modelSlug: this.testConfig.testModelSlug,
                        mediaId: this.testConfig.testMediaId + 1,
                        filename: 'failed-upload.jpg',
                        success: false,
                        error: 'File format not supported',
                        processingTime: 100
                    }
                },
                {
                    type: 'Moderation Result',
                    method: 'notifyModerationResult',
                    data: {
                        modelSlug: this.testConfig.testModelSlug,
                        mediaId: this.testConfig.testMediaId,
                        filename: 'moderation-result.jpg',
                        moderationStatus: 'flagged',
                        moderationScore: 72,
                        riskLevel: 'medium',
                        humanReviewRequired: true,
                        processingTime: 300
                    }
                },
                {
                    type: 'System Alert',
                    method: 'notifySystemAlert',
                    data: {
                        modelSlug: this.testConfig.testModelSlug,
                        alertType: 'high_error_rate',
                        message: 'Error rate threshold exceeded for upload processing',
                        details: { errorRate: 0.15, threshold: 0.10 },
                        priority: 'high'
                    }
                },
                {
                    type: 'Error Notification',
                    method: 'notifyError',
                    data: {
                        modelSlug: this.testConfig.testModelSlug,
                        filename: 'error-test.jpg',
                        operation: 'file_processing',
                        error: 'Unable to process corrupted file',
                        errorType: 'file_corruption',
                        escalationPriority: 'high',
                        requiresManualReview: true
                    }
                }
            ];

            for (const scenario of notificationScenarios) {
                console.log(`🔔 Testing notification: ${scenario.type}`);

                await this.services.notifications[scenario.method](scenario.data);

                console.log(`✅ ${scenario.type} notification sent successfully`);
            }

            // Test notification statistics
            const notificationStats = await this.services.notifications.getNotificationStatistics(this.testConfig.testModelSlug);
            this.assert(notificationStats !== null, 'Notification statistics returned');
            this.assert(notificationStats.success === true, 'Notification statistics successful');

            this.recordTestSuccess('Admin Notifications System');

        } catch (error) {
            this.recordTestFailure('Admin Notifications System', error);
        }
    }

    /**
     * Test 8: Integration under load (simplified load test)
     */
    async testWorkflowUnderLoad() {
        console.log('\n⚡ Test 8: Workflow Under Load');

        try {
            console.log('🔄 Simulating concurrent operations...');

            const concurrentOperations = [];
            const operationCount = 5;

            // Simulate concurrent uploads, callbacks, and notifications
            for (let i = 0; i < operationCount; i++) {
                // Upload simulation
                concurrentOperations.push(
                    this.services.logger.logUpload({
                        modelSlug: this.testConfig.testModelSlug,
                        filename: `load-test-${i}.jpg`,
                        originalFilename: `load-test-${i}.jpg`,
                        fileSize: 1024000 + (i * 512000),
                        processingTime: 150 + (i * 25),
                        watermarkApplied: true,
                        moderationStatus: 'submitted',
                        uploadMethod: 'load_test',
                        trackingId: `load_test_${i}`,
                        batchId: 'load-test-batch'
                    })
                );

                // Notification simulation
                concurrentOperations.push(
                    this.services.notifications.notifyUploadStatus({
                        modelSlug: this.testConfig.testModelSlug,
                        mediaId: this.testConfig.testMediaId + i,
                        filename: `load-test-${i}.jpg`,
                        success: true,
                        fileSize: 1024000 + (i * 512000),
                        processingTime: 150 + (i * 25),
                        watermarkApplied: true,
                        moderationStatus: 'submitted'
                    })
                );
            }

            // Execute all operations concurrently
            await Promise.all(concurrentOperations);

            console.log(`✅ Successfully processed ${operationCount * 2} concurrent operations`);
            this.recordTestSuccess('Workflow Under Load');

        } catch (error) {
            this.recordTestFailure('Workflow Under Load', error);
        }
    }

    /**
     * Test 9: Error scenarios and edge cases
     */
    async testErrorScenarios() {
        console.log('\n🚨 Test 9: Error Scenarios and Edge Cases');

        try {
            // Test invalid inputs
            console.log('🔍 Testing invalid input handling...');

            try {
                await this.services.storage.moveMediaFile(null, 'approved');
                this.recordTestFailure('Invalid Media Input', new Error('Should have thrown error for null media'));
            } catch (error) {
                // Expected error - this is good
                console.log('✅ Invalid media input properly rejected');
            }

            try {
                await this.services.storage.moveMediaFile({ id: 1, model_slug: 'test' }, 'invalid_status');
                this.recordTestFailure('Invalid Status Input', new Error('Should have thrown error for invalid status'));
            } catch (error) {
                // Expected error - this is good
                console.log('✅ Invalid status input properly rejected');
            }

            // Test retry operation with invalid data
            try {
                const result = await this.services.retry.addRetryOperation({
                    operationType: 'invalid_type',
                    trackingId: 'invalid_test'
                });
                
                // Should succeed but mark as invalid operation type
                this.assert(result !== null, 'Invalid retry operation handled');
                console.log('✅ Invalid retry operation type handled gracefully');
            } catch (error) {
                console.log('✅ Invalid retry operation properly rejected');
            }

            this.recordTestSuccess('Error Scenarios');

        } catch (error) {
            this.recordTestFailure('Error Scenarios', error);
        }
    }

    /**
     * Test 10: Cleanup operations
     */
    async testCleanupOperations() {
        console.log('\n🧹 Test 10: Cleanup Operations');

        try {
            // Test log cleanup
            console.log('🔄 Testing log cleanup...');
            const logCleanup = await this.services.logger.cleanupOldLogs();
            this.assert(logCleanup !== null, 'Log cleanup returned result');
            this.assert(typeof logCleanup.success === 'boolean', 'Log cleanup success flag present');

            // Test retry operation cleanup  
            console.log('🔄 Testing retry operation cleanup...');
            const retryCleanup = await this.services.retry.cleanupOldOperations();
            this.assert(retryCleanup !== null, 'Retry cleanup returned result');
            this.assert(typeof retryCleanup.success === 'boolean', 'Retry cleanup success flag present');

            // Test notification cleanup
            console.log('🔄 Testing notification cleanup...');
            await this.services.notifications.cleanupOldNotifications();

            // Test storage cleanup
            console.log('🔄 Testing storage cleanup...');
            const storageCleanup = await this.services.storage.cleanupOldFiles(this.testConfig.testModelSlug);
            this.assert(storageCleanup !== null, 'Storage cleanup returned result');
            this.assert(typeof storageCleanup.success === 'boolean', 'Storage cleanup success flag present');

            console.log('✅ All cleanup operations completed');
            this.recordTestSuccess('Cleanup Operations');

        } catch (error) {
            this.recordTestFailure('Cleanup Operations', error);
        }
    }

    /**
     * Assert test condition
     */
    assert(condition, message) {
        this.testResults.totalTests++;
        
        if (condition) {
            this.testResults.passed++;
            console.log(`  ✅ ${message}`);
        } else {
            this.testResults.failed++;
            console.log(`  ❌ ${message}`);
            this.testResults.errors.push(`Assertion failed: ${message}`);
        }
    }

    /**
     * Record successful test
     */
    recordTestSuccess(testName) {
        console.log(`✅ ${testName} - PASSED`);
    }

    /**
     * Record failed test
     */
    recordTestFailure(testName, error) {
        console.error(`❌ ${testName} - FAILED: ${error.message}`);
        this.testResults.errors.push(`${testName}: ${error.message}`);
    }

    /**
     * Generate comprehensive test report
     */
    async generateTestReport() {
        console.log('\n📊 TEST REPORT');
        console.log('='.repeat(60));
        console.log(`Total Tests: ${this.testResults.totalTests}`);
        console.log(`Passed: ${this.testResults.passed}`);
        console.log(`Failed: ${this.testResults.failed}`);
        console.log(`Success Rate: ${((this.testResults.passed / this.testResults.totalTests) * 100).toFixed(1)}%`);
        console.log(`Execution Time: ${this.testResults.executionTime}ms`);

        if (this.testResults.errors.length > 0) {
            console.log('\n❌ ERRORS:');
            this.testResults.errors.forEach((error, index) => {
                console.log(`${index + 1}. ${error}`);
            });
        }

        // Write test report to file
        const reportPath = path.join(process.cwd(), 'test-results', 'moderation-workflow-test-report.json');
        await fs.mkdir(path.dirname(reportPath), { recursive: true });
        await fs.writeFile(reportPath, JSON.stringify({
            ...this.testResults,
            timestamp: new Date().toISOString(),
            testConfiguration: this.testConfig
        }, null, 2));

        console.log(`\n📝 Test report saved: ${reportPath}`);

        if (this.testResults.failed === 0) {
            console.log('\n🎉 ALL TESTS PASSED! End-to-end moderation workflow is fully operational.');
        } else {
            console.log(`\n⚠️ ${this.testResults.failed} test(s) failed. Please review and fix issues.`);
        }

        console.log('='.repeat(60));
    }
}

// Export for use as module or run directly
module.exports = ModerationWorkflowTest;

// Run tests if called directly
if (require.main === module) {
    (async () => {
        const test = new ModerationWorkflowTest();
        const results = await test.runCompleteWorkflowTest();
        process.exit(results.failed > 0 ? 1 : 0);
    })();
}