#!/usr/bin/env node

/**
 * Test script for enhanced moderation system
 * Tests both the API call and fallback behavior
 */

const path = require('path');
const fs = require('fs');
const ContentModerationService = require('./src/services/ContentModerationService');

// Mock database connection for testing
const mockDb = {
    execute: async (query, params) => {
        console.log('Mock DB Execute:', query.substring(0, 50) + '...', params?.slice(0, 2));
        return [{ insertId: Math.floor(Math.random() * 1000) }];
    }
};

async function testModerationService() {
    console.log('🚀 Testing Enhanced Content Moderation Service\n');
    
    const moderationService = new ContentModerationService(mockDb);
    
    // Test image path
    const testImagePath = '/Users/programmer/Projects/musenest/public/uploads/escort-example/originals/1753575572332_20250622_003419.jpg';
    
    console.log('📸 Test Image:', testImagePath);
    console.log('🔍 Testing enhanced API connection to:', '52.15.235.216:5000');
    console.log('⏱️  Timeout set to 30 seconds\n');
    
    try {
        // Test the analyzeWithNudeNet method directly
        console.log('📡 Calling enhanced MediaPipe API...\n');
        
        const result = await moderationService.analyzeWithNudeNet(
            testImagePath,
            'public_gallery',
            1 // model ID
        );
        
        console.log('✅ Analysis Result:');
        console.log('==================');
        console.log('Analysis Version:', result.analysis_version);
        console.log('Nudity Score:', result.nudity_score);
        console.log('Has Nudity:', result.has_nudity);
        console.log('Detected Parts:', result.detected_parts);
        
        if (result.pose_analysis) {
            console.log('\n🤸 Pose Analysis:');
            console.log('Pose Detected:', result.pose_analysis.pose_detected);
            console.log('Pose Category:', result.pose_analysis.pose_category);
            console.log('Suggestive Score:', result.pose_analysis.suggestive_score);
        }
        
        if (result.combined_assessment) {
            console.log('\n🎯 Combined Assessment:');
            console.log('Final Risk Score:', result.combined_assessment.final_risk_score);
            console.log('Risk Level:', result.combined_assessment.risk_level);
            console.log('Reasoning:', result.combined_assessment.reasoning);
        }
        
        if (result.warning) {
            console.log('\n⚠️  WARNING:', result.warning);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testModerationService();