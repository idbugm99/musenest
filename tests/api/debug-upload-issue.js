#!/usr/bin/env node

// Debug script to isolate the upload issue
const http = require('http');
const FormData = require('form-data');
const fs = require('fs');

console.log('🔍 Debugging Enhanced API Upload Issue\n');

async function testDirectApiCall() {
    console.log('1️⃣ Testing direct EC2 API call...');
    
    return new Promise((resolve, reject) => {
        const form = new FormData();
        form.append('image', fs.createReadStream('/tmp/test_small.jpg'));
        form.append('context_type', 'public_gallery');
        form.append('model_id', '1');

        console.log('📡 Making request to 52.15.235.216:5000/analyze');
        
        const startTime = Date.now();
        const req = http.request({
            hostname: '52.15.235.216',
            port: 5000,
            path: '/analyze',
            method: 'POST',
            headers: form.getHeaders(),
            timeout: 45000
        }, (res) => {
            const responseTime = Date.now() - startTime;
            console.log(`✅ Response received in ${responseTime}ms`);
            console.log(`Status: ${res.statusCode}`);
            
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    console.log('✅ JSON parsed successfully');
                    console.log(`Success: ${result.success}`);
                    if (result.success) {
                        console.log(`Nudity Score: ${result.image_analysis?.nudity_detection?.nudity_score}`);
                        console.log(`Pose Category: ${result.image_analysis?.pose_analysis?.pose_category}`);
                    }
                    resolve(result);
                } catch (e) {
                    console.error('❌ JSON parse error:', e.message);
                    reject(e);
                }
            });
        });

        req.on('error', (error) => {
            const responseTime = Date.now() - startTime;
            console.error(`❌ Request error after ${responseTime}ms:`, error.message);
            console.error('Error code:', error.code);
            reject(error);
        });

        req.on('timeout', () => {
            const responseTime = Date.now() - startTime;
            console.error(`⏰ Request timeout after ${responseTime}ms`);
            req.destroy();
            reject(new Error('Timeout'));
        });

        form.pipe(req);
    });
}

async function testNodeApiCall() {
    console.log('\n2️⃣ Testing Node.js API endpoint...');
    
    return new Promise((resolve, reject) => {
        const form = new FormData();
        form.append('image', fs.createReadStream('/tmp/test_small.jpg'));
        form.append('model_id', '1');
        form.append('model_slug', 'escort-example');
        form.append('usage_intent', 'public_site');
        form.append('context_type', 'public_gallery');

        console.log('📡 Making request to localhost:3000/api/enhanced-content-moderation/upload');
        
        const startTime = Date.now();
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/enhanced-content-moderation/upload',
            method: 'POST',
            headers: form.getHeaders(),
            timeout: 60000
        }, (res) => {
            const responseTime = Date.now() - startTime;
            console.log(`✅ Response received in ${responseTime}ms`);
            console.log(`Status: ${res.statusCode}`);
            
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    console.log('✅ JSON parsed successfully');
                    console.log(`Success: ${result.success}`);
                    if (result.success) {
                        console.log(`Nudity Score: ${result.data?.nudity_score}`);
                        console.log(`Detected Parts: ${JSON.stringify(result.data?.detected_parts)}`);
                        console.log(`Moderation Status: ${result.data?.moderation_status}`);
                    }
                    resolve(result);
                } catch (e) {
                    console.error('❌ JSON parse error:', e.message);
                    reject(e);
                }
            });
        });

        req.on('error', (error) => {
            const responseTime = Date.now() - startTime;
            console.error(`❌ Request error after ${responseTime}ms:`, error.message);
            reject(error);
        });

        req.on('timeout', () => {
            const responseTime = Date.now() - startTime;
            console.error(`⏰ Request timeout after ${responseTime}ms`);
            req.destroy();
            reject(new Error('Timeout'));
        });

        form.pipe(req);
    });
}

async function runTests() {
    try {
        // Test 1: Direct EC2 API call
        const directResult = await testDirectApiCall();
        
        // Test 2: Node.js API call
        const nodeResult = await testNodeApiCall();
        
        console.log('\n📊 Comparison:');
        console.log(`Direct EC2 API success: ${directResult.success}`);
        console.log(`Node.js API success: ${nodeResult.success}`);
        
        if (directResult.success && nodeResult.success) {
            const directScore = directResult.image_analysis?.nudity_detection?.nudity_score;
            const nodeScore = nodeResult.data?.nudity_score;
            
            console.log(`Direct EC2 nudity score: ${directScore}`);
            console.log(`Node.js nudity score: ${nodeScore}`);
            
            if (directScore && nodeScore && Math.abs(directScore - nodeScore) < 1) {
                console.log('✅ Scores match! API integration working correctly.');
            } else {
                console.log('❌ Scores don\'t match. Node.js is not getting EC2 results.');
            }
        }
        
    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

runTests();