#!/usr/bin/env node

// Test the processUploadedImage method directly
const ContentModerationService = require('./src/services/ContentModerationService');

// Mock database with more complete responses
const mockDb = {
    execute: async (query, params) => {
        console.log('📝 Mock DB execute:', query.substring(0, 50) + '...');
        if (query.includes('INSERT INTO content_moderation')) {
            return [{ insertId: Math.floor(Math.random() * 1000) }];
        }
        if (query.includes('INSERT INTO moderation_queue')) {
            return [{ insertId: Math.floor(Math.random() * 1000) }];
        }
        return [[]];
    }
};

async function testProcessUpload() {
    console.log('🧪 Testing processUploadedImage method directly\n');
    
    const moderationService = new ContentModerationService(mockDb);
    
    // Copy the small test image to a temp location to simulate upload
    const fs = require('fs');
    const path = require('path');
    
    const tempUploadPath = '/tmp/temp_upload_test.jpg';
    fs.copyFileSync('/tmp/test_small.jpg', tempUploadPath);
    
    try {
        console.log('⏰ Starting full upload process...');
        const startTime = Date.now();
        
        const result = await moderationService.processUploadedImage({
            filePath: tempUploadPath,
            originalName: 'test_image.jpg',
            modelId: 1,
            modelSlug: 'escort-example',
            usageIntent: 'public_site',
            contextType: 'public_gallery'
        });
        
        const totalTime = Date.now() - startTime;
        console.log(`\n🎉 Full process completed in ${totalTime}ms`);
        console.log('Result:', {
            success: result.success,
            moderation_status: result.moderation_status,
            nudity_score: result.nudity_score,
            flagged: result.flagged,
            pose_category: result.pose_category || 'not available',
            contentModerationId: result.contentModerationId
        });
        
        if (result.detected_parts) {
            console.log('Detected parts:', Object.keys(result.detected_parts));
        }
        
    } catch (error) {
        console.error('❌ Process failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

testProcessUpload();