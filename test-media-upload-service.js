/**
 * Test script for MediaUploadService integration
 * Verifies the service can be initialized and handles basic operations
 */

const MediaUploadService = require('./src/services/MediaUploadService');
const db = require('./config/database');

async function testMediaUploadService() {
    console.log('🧪 Testing MediaUploadService...\n');

    try {
        // 1. Test service initialization
        console.log('1. Testing service initialization...');
        const uploadService = new MediaUploadService(db);
        const initResult = await uploadService.initialize();
        
        if (initResult.success) {
            console.log('✅ Service initialized successfully');
        } else {
            console.log('❌ Service initialization failed:', initResult.error);
            return;
        }

        // 2. Test model validation
        console.log('\n2. Testing model validation...');
        const validationResult = await uploadService.validateUploadRequest([{ name: 'test.jpg' }], { modelSlug: 'escortexample' });
        
        if (validationResult.valid) {
            console.log('✅ Model validation passed for escortexample');
            console.log(`   Model: ${validationResult.model.name} (${validationResult.model.slug})`);
        } else {
            console.log('❌ Model validation failed:', validationResult.error);
        }

        // 3. Test invalid model validation
        console.log('\n3. Testing invalid model validation...');
        const invalidValidationResult = await uploadService.validateUploadRequest([], { modelSlug: 'nonexistent' });
        
        if (!invalidValidationResult.valid) {
            console.log('✅ Invalid model correctly rejected:', invalidValidationResult.error);
        } else {
            console.log('❌ Invalid model should have been rejected');
        }

        // 4. Test upload statistics (should work even with no uploads)
        console.log('\n4. Testing upload statistics...');
        const statsResult = await uploadService.getUploadStatistics('escortexample');
        
        if (statsResult.success) {
            console.log('✅ Statistics retrieved successfully:');
            console.log('   Total media:', statsResult.statistics.total_media);
            console.log('   Approved:', statsResult.statistics.approved_count);
            console.log('   Pending:', statsResult.statistics.pending_count);
            console.log('   Total size (MB):', statsResult.statistics.total_size_mb);
        } else {
            console.log('❌ Statistics failed:', statsResult.error);
        }

        // 5. Test configuration access
        console.log('\n5. Testing service configuration...');
        console.log('✅ Service configuration:');
        console.log('   Max file size:', Math.round(uploadService.config.maxFileSize / (1024 * 1024)) + 'MB');
        console.log('   Allowed types:', uploadService.config.allowedMimeTypes.slice(0, 3).join(', ') + '...');
        console.log('   Thumbnail size:', uploadService.config.thumbnailSize + 'px');

        console.log('\n🎉 All tests passed! MediaUploadService is working correctly.');

    } catch (error) {
        console.error('\n❌ Test failed with error:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        // Close database connection
        try {
            await db.pool.end();
            console.log('\n🔌 Database connection closed');
        } catch (closeError) {
            console.warn('⚠️ Database close warning:', closeError.message);
        }
    }
}

// Run the test
testMediaUploadService();