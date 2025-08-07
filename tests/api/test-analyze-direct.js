#!/usr/bin/env node

// Test the analyzeWithNudeNet method directly
const ContentModerationService = require('./src/services/ContentModerationService');

// Mock database
const mockDb = {
    execute: async () => [{ insertId: 1 }]
};

async function testAnalyzeMethod() {
    console.log('🧪 Testing analyzeWithNudeNet method directly\n');
    
    const moderationService = new ContentModerationService(mockDb);
    
    try {
        console.log('⏰ Starting analysis...');
        const startTime = Date.now();
        
        const result = await moderationService.analyzeWithNudeNet(
            '/tmp/test_small.jpg',
            'public_gallery',
            1
        );
        
        const totalTime = Date.now() - startTime;
        console.log(`\n🎉 Analysis completed in ${totalTime}ms`);
        console.log('Result:', {
            nudity_score: result.nudity_score,
            pose_category: result.pose_category,
            explicit_pose_score: result.explicit_pose_score,
            analysis_version: result.analysis_version
        });
        
    } catch (error) {
        console.error('❌ Analysis failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

testAnalyzeMethod();