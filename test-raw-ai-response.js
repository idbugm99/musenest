#!/usr/bin/env node

const FormData = require('form-data');  
const fs = require('fs');
const path = require('path');

async function testRawAIResponse() {
    const { default: fetch } = await import('node-fetch');
    
    console.log('🧪 Testing raw AI response for close-up face image...');
    
    // Find Amanda4.jpeg in uploads
    const imagePath = '/Users/programmer/Projects/musenest/public/uploads/escortexample/originals';
    const files = fs.readdirSync(imagePath).filter(f => f.includes('Amanda4'));
    
    if (files.length === 0) {
        console.log('❌ Amanda4 image not found');
        return;
    }
    
    const latestFile = files.sort().pop(); // Get the most recent
    const fullPath = path.join(imagePath, latestFile);
    
    console.log(`📁 Using image: ${latestFile}`);
    
    // Test the AI API directly
    const form = new FormData();
    form.append('image', fs.createReadStream(fullPath));
    form.append('context_type', 'public_gallery');
    form.append('model_id', '1');
    
    try {
        console.log('📡 Sending request to AI API...');
        const response = await fetch('http://52.15.235.216:5000/analyze', {
            method: 'POST',
            body: form
        });
        
        const result = await response.json();
        
        console.log('🔍 Raw AI Response:');
        console.log(JSON.stringify(result, null, 2));
        
        // Check specifically for pose analysis
        if (result.image_analysis?.pose_analysis) {
            console.log('\n🎭 Pose Analysis Section:');
            console.log(JSON.stringify(result.image_analysis.pose_analysis, null, 2));
            
            console.log('\n❓ Analysis:');
            console.log(`Pose Detected: ${result.image_analysis.pose_analysis.pose_detected}`);
            console.log(`Pose Category: ${result.image_analysis.pose_analysis.pose_category}`);
            console.log(`Leg Spread: ${result.image_analysis.pose_analysis.raw_metrics?.leg_spread}`);
            console.log(`Reasoning: ${JSON.stringify(result.image_analysis.pose_analysis.details?.reasoning)}`);
            
            if (result.image_analysis.pose_analysis.pose_detected && 
                result.image_analysis.pose_analysis.raw_metrics?.leg_spread > 0.3) {
                console.log('\n🚨 ISSUE IDENTIFIED: AI is claiming pose detection on close-up face image!');
                console.log('This indicates a problem with the pose detection model.');
            }
        }
        
    } catch (error) {
        console.error('❌ AI API test failed:', error.message);
    }
}

testRawAIResponse();