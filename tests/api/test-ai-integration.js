#!/usr/bin/env node
/**
 * Test AI Server Integration
 * Test actual communication with the AI server
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const FormData = require('form-data');
const fs = require('fs');

async function testAIServer() {
    console.log('🚀 Testing AI Server Integration...');
    
    // Test 1: Health check
    console.log('\n1️⃣ Testing AI server health...');
    try {
        const healthResponse = await makeRequest('GET', '/health');
        console.log('✅ AI Server Health:', JSON.stringify(healthResponse, null, 2));
    } catch (error) {
        console.error('❌ Health check failed:', error.message);
        return;
    }
    
    // Test 2: Try to create a simple test image
    console.log('\n2️⃣ Creating test image...');
    const testImagePath = createTestImage();
    
    // Test 3: Test AI analysis with configuration flags
    console.log('\n3️⃣ Testing AI analysis with configuration flags...');
    try {
        const analysisResult = await testAnalysisWithConfig(testImagePath);
        const keys = Object.keys(analysisResult || {});
        console.log('Analysis result keys:', keys);
        console.log('Configuration applied:', analysisResult.configuration_applied || 'NOT REPORTED');
        console.log('Detected parts:', analysisResult.detected_parts || {});
        console.log('Processing status:', analysisResult.processing_status || 'unknown');

        // Soft assertions (do not fail the run, just report)
        softCheck('success flag present', 'success' in analysisResult, analysisResult.success);
        softCheck('BLIP caption present', !!(analysisResult.blip_caption || analysisResult.caption || analysisResult.description), (analysisResult.blip_caption || analysisResult.caption || analysisResult.description));
        softCheck('NSFW detection present', !!(analysisResult.nsfw || analysisResult.nudity || analysisResult.detections), (analysisResult.nsfw || analysisResult.nudity || analysisResult.detections));
        softCheck('child/age analysis present', !!(analysisResult.child || analysisResult.child_analysis || analysisResult.age_estimation), (analysisResult.child || analysisResult.child_analysis || analysisResult.age_estimation));
        softCheck('risk/score present', !!(analysisResult.risk || analysisResult.score || analysisResult.overall_risk), (analysisResult.risk || analysisResult.score || analysisResult.overall_risk));
    } catch (error) {
        console.error('❌ Analysis test failed:', error.message);
    }
    
    // Cleanup
    try {
        fs.unlinkSync(testImagePath);
        console.log('🧹 Cleaned up test image');
    } catch (e) {}
}

function createTestImage() {
    // Create a simple 100x100 white PNG image
    const testImagePath = '/tmp/test-image.png';
    const pngData = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
        0x00, 0x00, 0x00, 0x64, 0x00, 0x00, 0x00, 0x64, // 100x100
        0x08, 0x02, 0x00, 0x00, 0x00, 0xFF, 0x80, 0x02, 0x03,
        0x00, 0x00, 0x00, 0x09, 0x49, 0x44, 0x41, 0x54, // Basic white image data
        0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01,
        0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);
    
    fs.writeFileSync(testImagePath, pngData);
    console.log('✅ Created test image:', testImagePath);
    return testImagePath;
}

async function testAnalysisWithConfig(imagePath) {
    return new Promise((resolve, reject) => {
        const form = new FormData();
        form.append('image', fs.createReadStream(imagePath));
        form.append('context_type', 'public_gallery');
        form.append('model_id', '1');
        
        // Add configuration flags (simulating what ContentModerationService does)
        form.append('enable_breast_detection', 'true');
        form.append('enable_genitalia_detection', 'true');
        form.append('enable_buttocks_detection', 'false'); // Test disabling something
        form.append('enable_face_detection', 'true');
        form.append('enable_child_detection', 'true');
        form.append('config_version', '1');
        
        console.log('📤 Sending analysis request with config flags...');
        
        const base = getBase();
        const client = base.protocol === 'https:' ? https : http;
        const req = client.request({
            hostname: base.hostname,
            port: base.port,
            path: (base.pathnameNoSlash || '') + '/analyze',
            method: 'POST',
            headers: form.getHeaders(),
            timeout: 20000
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    resolve(result);
                } catch (parseError) {
                    reject(new Error('Failed to parse response: ' + data.substring(0, 200)));
                }
            });
        });
        
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        
        form.pipe(req);
    });
}

function makeRequest(method, path) {
    return new Promise((resolve, reject) => {
        const base = getBase();
        const client = base.protocol === 'https:' ? https : http;
        const req = client.request({
            hostname: base.hostname,
            port: base.port,
            path: (base.pathnameNoSlash || '') + path,
            method: method,
            timeout: 7000
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    resolve(result);
                } catch (parseError) {
                    resolve(data); // Return raw response if not JSON
                }
            });
        });
        
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        
        req.end();
    });
}

function getBase() {
    const envUrl = process.env.AI_SERVER_URL || process.env.AI_SMOKE_URL;
    let fallback = 'http://18.221.22.72:5000';
    try {
        const parsed = new URL(envUrl || fallback);
        return {
            protocol: parsed.protocol,
            hostname: parsed.hostname,
            port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
            pathnameNoSlash: parsed.pathname && parsed.pathname !== '/' ? parsed.pathname.replace(/\/$/, '') : ''
        };
    } catch (e) {
        return { protocol: 'http:', hostname: '18.221.22.72', port: 5000, pathnameNoSlash: '' };
    }
}

function softCheck(name, condition, details) {
    if (condition) {
        console.log(`✅ ${name}` + (details ? `: ${typeof details === 'object' ? JSON.stringify(details) : details}` : ''));
    } else {
        console.warn(`⚠️  ${name} missing`);
    }
}

testAIServer().then(() => {
    console.log('\n🏁 AI Integration test completed!');
    process.exit(0);
}).catch(error => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
});