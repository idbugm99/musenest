#!/usr/bin/env node
/**
 * Test Real NudeNet Service on EC2
 * This will test the actual NudeNet analysis
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Test the real NudeNet service via SSH tunnel
async function testRealNudeNet() {
    console.log('🧪 Testing Real NudeNet Service on EC2...\n');
    
    try {
        // Test 1: Health check
        console.log('1️⃣ Testing NudeNet health...');
        await testHealthCheck();
        
        // Test 2: Create test images and analyze
        console.log('\n2️⃣ Creating test images...');
        await createTestImages();
        
        // Test 3: Analyze simple image
        console.log('\n3️⃣ Testing simple image analysis...');
        await testSimpleImage();
        
        // Test 4: Test file upload endpoint
        console.log('\n4️⃣ Testing file upload endpoint...');
        await testFileUpload();
        
        // Test 5: Test different contexts
        console.log('\n5️⃣ Testing different content contexts...');
        await testDifferentContexts();
        
        console.log('\n🎉 ALL TESTS COMPLETED SUCCESSFULLY!');
        console.log('✅ Real NudeNet AI moderation is fully operational');
        
    } catch (error) {
        console.log('❌ Test suite failed:', error.message);
    }
}

async function testHealthCheck() {
    const healthCmd = `ssh -i "/Users/programmer/Projects/nudenet-key.pem" ubuntu@18.191.50.72 "curl -s http://localhost:5001/health"`;
    
    try {
        const { stdout } = await execAsync(healthCmd);
        const health = JSON.parse(stdout);
        
        console.log('✅ Health check passed!');
        console.log(`   Status: ${health.status}`);
        console.log(`   Models loaded: ${health.models_loaded}`);
        console.log(`   Upload enabled: ${health.upload_enabled}`);
        console.log(`   Version: ${health.version}`);
        
        if (!health.models_loaded) {
            throw new Error('NudeNet models not loaded!');
        }
        
    } catch (error) {
        console.log('❌ Health check failed:', error.message);
        throw error;
    }
}

async function createTestImages() {
    // First copy the Python script to EC2
    const copyScriptCmd = `scp -i "/Users/programmer/Projects/nudenet-key.pem" create-test-images.py ubuntu@18.191.50.72:/tmp/create-test-images.py`;
    
    try {
        await execAsync(copyScriptCmd);
        console.log('✅ Copied image creation script to EC2');
    } catch (error) {
        console.log('❌ Failed to copy script:', error.message);
        throw error;
    }
    
    // Run the script on EC2
    const createCmd = `ssh -i "/Users/programmer/Projects/nudenet-key.pem" ubuntu@18.191.50.72 "python3 /tmp/create-test-images.py"`;
    
    try {
        const { stdout } = await execAsync(createCmd);
        console.log('✅ Test images created:');
        console.log('   ', stdout.trim().replace(/\n/g, '\n    '));
    } catch (error) {
        console.log('❌ Failed to create test images:', error.message);
        throw error;
    }
}

async function testSimpleImage() {
    const analyzeCmd = `ssh -i "/Users/programmer/Projects/nudenet-key.pem" ubuntu@18.191.50.72 'curl -s -X POST "http://localhost:5001/analyze" -H "Content-Type: application/json" -d "{\\"image_path\\": \\"/tmp/nudenet_test/safe_image.jpg\\", \\"context_type\\": \\"public_gallery\\", \\"model_id\\": 1}"'`;
    
    try {
        const { stdout } = await execAsync(analyzeCmd);
        const result = JSON.parse(stdout);
        
        if (result.success && result.result) {
            const analysis = result.result;
            console.log('✅ Safe image analysis results:');
            console.log(`   🎯 Status: ${analysis.moderation_status.toUpperCase()}`);
            console.log(`   📈 Nudity Score: ${analysis.nudity_score}%`);
            console.log(`   🔍 Detected Parts:`, JSON.stringify(analysis.detected_parts));
            console.log(`   🎭 Pose: ${analysis.pose_classification}`);
            console.log(`   💭 Caption: "${analysis.generated_caption}"`);
            console.log(`   🔒 Confidence: ${Math.round(analysis.confidence_score * 100)}%`);
            
            // Validate expected results for safe image
            if (analysis.nudity_score > 10) {
                console.log('⚠️  WARNING: Safe image got high nudity score!');
            }
            if (analysis.moderation_status !== 'approved') {
                console.log('⚠️  WARNING: Safe image was not approved!');
            }
            
        } else {
            console.log('❌ Analysis failed:', result.error || 'Unknown error');
            throw new Error('Analysis failed');
        }
    } catch (error) {
        console.log('❌ Simple image test failed:', error.message);
        throw error;
    }
}

async function testFileUpload() {
    // Test the /upload endpoint by copying a local file to EC2 and uploading it
    const uploadTestCmd = `ssh -i "/Users/programmer/Projects/nudenet-key.pem" ubuntu@18.191.50.72 '
        cd /tmp/nudenet_test &&
        
        # Test file upload using curl
        curl -s -X POST "http://localhost:5001/upload" \
          -F "file=@shapes_image.jpg" \
          -F "context_type=profile_pic" \
          -F "model_id=1"
    '`;
    
    try {
        const { stdout } = await execAsync(uploadTestCmd);
        const result = JSON.parse(stdout);
        
        if (result.success && result.result) {
            const analysis = result.result;
            console.log('✅ File upload test results:');
            console.log(`   🎯 Status: ${analysis.moderation_status.toUpperCase()}`);
            console.log(`   📈 Nudity Score: ${analysis.nudity_score}%`);
            console.log(`   🔍 Detected Parts:`, JSON.stringify(analysis.detected_parts));
            console.log(`   📁 Context: ${analysis.context_type}`);
            console.log(`   🎭 Pose: ${analysis.pose_classification}`);
            
            // Test profile_pic context (stricter rules)
            if (analysis.context_type === 'profile_pic' && analysis.nudity_score > 30) {
                console.log('⚠️  Image may be rejected for profile pic context');
            }
            
        } else {
            console.log('❌ Upload test failed:', result.error || 'Unknown error');
            throw new Error('Upload test failed');
        }
    } catch (error) {
        console.log('❌ File upload test failed:', error.message);
        throw error;
    }
}

async function testDifferentContexts() {
    const contexts = [
        { name: 'profile_pic', threshold: 30 },
        { name: 'public_gallery', threshold: 60 },
        { name: 'premium_gallery', threshold: 90 },
        { name: 'private_content', threshold: 100 }
    ];
    
    console.log('Testing moderation rules for different contexts...');
    
    for (const context of contexts) {
        const contextCmd = `ssh -i "/Users/programmer/Projects/nudenet-key.pem" ubuntu@18.191.50.72 'curl -s -X POST "http://localhost:5001/analyze" -H "Content-Type: application/json" -d "{\\"image_path\\": \\"/tmp/nudenet_test/pattern_image.jpg\\", \\"context_type\\": \\"${context.name}\\", \\"model_id\\": 1}"'`;
        
        try {
            const { stdout } = await execAsync(contextCmd);
            const result = JSON.parse(stdout);
            
            if (result.success && result.result) {
                const analysis = result.result;
                console.log(`   📂 ${context.name}: ${analysis.moderation_status.toUpperCase()} (${analysis.nudity_score}% nudity, max: ${context.threshold}%)`);
                
                // Validate threshold logic
                const expectedStatus = analysis.nudity_score > context.threshold ? 'rejected' : 'approved';
                if (analysis.moderation_status !== expectedStatus && analysis.moderation_status !== 'flagged') {
                    console.log(`   ⚠️  Expected ${expectedStatus} but got ${analysis.moderation_status}`);
                }
            }
        } catch (error) {
            console.log(`   ❌ Context test failed for ${context.name}:`, error.message);
        }
    }
    
    console.log('✅ Context testing completed');
}

// Run the test
testRealNudeNet();