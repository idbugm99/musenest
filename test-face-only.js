#!/usr/bin/env node

const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function testFaceOnlyImage() {
    const { default: fetch } = await import('node-fetch');
    
    console.log('🧪 Testing face-only image validation...');
    
    // Find Amanda4.jpeg in uploads  
    const imagePath = '/Users/programmer/Projects/musenest/public/uploads/escortexample/originals';
    const files = fs.readdirSync(imagePath).filter(f => f.includes('Amanda4'));
    
    if (files.length === 0) {
        console.log('❌ Amanda4 image not found');
        return;
    }
    
    const latestFile = files.sort().pop(); // Get the most recent
    const fullPath = path.join(imagePath, latestFile);
    
    console.log(`📁 Using Amanda4 face-only image: ${latestFile}`);
    
    const formData = new FormData();
    formData.append('image', fs.createReadStream(fullPath));
    formData.append('model_id', '1');
    formData.append('model_slug', 'escortexample');
    formData.append('usage_intent', 'public_site');
    formData.append('context_type', 'public_gallery');
    
    try {
        const response = await fetch('http://localhost:3000/api/enhanced-content-moderation/upload', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            console.log('✅ Upload successful!');
            console.log(`Content Moderation ID: ${result.data.content_moderation_id}`);
            console.log(`Nudity Score: ${result.data.nudity_score}`);
            
            console.log('\n🎭 Pose Analysis Result:');
            console.log(`Pose Detected: ${result.data.pose_analysis.pose_detected}`);
            console.log(`Pose Category: ${result.data.pose_analysis.pose_category}`);
            console.log(`Suggestive Score: ${result.data.pose_analysis.suggestive_score}`);
            console.log(`Reasoning: ${JSON.stringify(result.data.pose_analysis.details?.reasoning)}`);
            
            if (result.data.pose_analysis.details?.validation_override) {
                console.log(`✅ VALIDATION WORKED: ${result.data.pose_analysis.details.validation_override}`);
            }
            
            console.log('\n📊 Full Pose Analysis:');
            console.log(JSON.stringify(result.data.pose_analysis, null, 2));
            
        } else {
            console.log('❌ Upload failed:', result.error);
        }
        
    } catch (error) {
        console.error('💥 Test error:', error.message);
    }
}

testFaceOnlyImage();