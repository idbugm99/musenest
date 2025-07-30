#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

async function testUpload() {
    const FormData = require('form-data');
    const { default: fetch } = await import('node-fetch');
    
    console.log('🧪 Testing upload with pose analysis fields...');
    
    // Use an existing test image if available
    const testImagePath = path.join(__dirname, 'public/uploads/escortexample/originals');
    
    // Check if there are any existing images we can use for testing
    if (fs.existsSync(testImagePath)) {
        const files = fs.readdirSync(testImagePath).filter(f => f.match(/\.(jpg|jpeg|png)$/i));
        if (files.length > 0) {
            const testFile = files[0];
            const imagePath = path.join(testImagePath, testFile);
            
            console.log(`📁 Using test image: ${testFile}`);
            
            const form = new FormData();
            form.append('image', fs.createReadStream(imagePath));
            form.append('model_id', '1');
            form.append('model_slug', 'escortexample');
            form.append('usage_intent', 'public_site');
            form.append('context_type', 'public_gallery');
            
            try {
                const response = await fetch('http://localhost:3000/api/enhanced-content-moderation/upload', {
                    method: 'POST',
                    body: form
                });
                
                const result = await response.json();
                
                console.log('📊 Upload Response:');
                console.log(`Status: ${response.status}`);
                console.log(`Success: ${result.success}`);
                console.log('Result:', JSON.stringify(result, null, 2));
                
                if (result.success) {
                    console.log('✅ Upload successful! Pose analysis data should be in database.');
                } else {
                    console.log('❌ Upload failed:', result.error);
                }
                
            } catch (error) {
                console.error('💥 Upload error:', error.message);
            }
        } else {
            console.log('❌ No test images found in upload directory');
        }
    } else {
        console.log('❌ Upload directory not found');
    }
}

testUpload();