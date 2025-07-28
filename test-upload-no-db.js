#!/usr/bin/env node

// Test upload endpoint bypassing database operations
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ContentModerationService = require('./src/services/ContentModerationService');

const app = express();

// Configure multer for temporary uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const tempPath = path.join(__dirname, 'temp_uploads');
        fs.mkdirSync(tempPath, { recursive: true });
        cb(null, tempPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'temp-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 16 * 1024 * 1024 }
});

// Minimal mock database
const mockDb = {
    execute: async () => [{ insertId: 999 }]
};

const moderationService = new ContentModerationService(mockDb);

app.post('/test-upload', upload.single('image'), async (req, res) => {
    console.log('📤 Test upload endpoint hit');
    
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        console.log('📁 File received:', req.file.originalname);
        
        // Test just the enhanced API call, skip full processing
        const analysisResult = await moderationService.analyzeWithNudeNet(
            req.file.path,
            'public_gallery',
            1
        );
        
        console.log('✅ Analysis completed');
        
        // Clean up temp file
        fs.unlink(req.file.path, () => {});
        
        res.json({
            success: true,
            nudity_score: analysisResult.nudity_score,
            pose_category: analysisResult.pose_category,
            explicit_pose_score: analysisResult.explicit_pose_score,
            analysis_version: analysisResult.analysis_version
        });
        
        console.log('📤 Response sent');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

const server = app.listen(3001, () => {
    console.log('🧪 Test server running on port 3001');
    console.log('Test with: curl -F "image=@/tmp/test_small.jpg" http://localhost:3001/test-upload');
});

// Test the endpoint
setTimeout(async () => {
    console.log('\n🚀 Running automated test...');
    
    const FormData = require('form-data');
    const http = require('http');
    
    const form = new FormData();
    form.append('image', fs.createReadStream('/tmp/test_small.jpg'));
    
    const req = http.request({
        hostname: 'localhost',
        port: 3001,
        path: '/test-upload',
        method: 'POST',
        headers: form.getHeaders(),
        timeout: 15000
    }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            console.log('✅ Test response:', JSON.parse(data));
            server.close();
            process.exit(0);
        });
    });
    
    req.on('error', (error) => {
        console.error('❌ Test failed:', error.message);
        server.close();
        process.exit(1);
    });
    
    req.on('timeout', () => {
        console.error('❌ Test timed out');
        server.close();
        process.exit(1);
    });
    
    form.pipe(req);
}, 1000);