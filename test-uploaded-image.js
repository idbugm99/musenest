#!/usr/bin/env node

/**
 * Test script to upload an image to the v3.0 API and show detailed analysis results
 */

const FormData = require('form-data');
const fs = require('fs');
const http = require('http');
const path = require('path');

async function testImageUpload(imagePath) {
    console.log('🚀 Testing image upload to v3.0 API...');
    console.log(`📁 Image: ${imagePath}`);
    
    return new Promise((resolve, reject) => {
        // Create form data
        const form = new FormData();
        form.append('image', fs.createReadStream(imagePath));
        form.append('context_type', 'public_gallery');
        form.append('model_id', '1');

        console.log('📤 Sending to EC2 API...');
        
        const startTime = Date.now();
        
        const req = http.request({
            hostname: '52.15.235.216',
            port: 5000,
            path: '/analyze',
            method: 'POST',
            headers: {
                ...form.getHeaders(),
                'Connection': 'close'
            },
            timeout: 30000
        }, (res) => {
            console.log(`📊 Response status: ${res.statusCode}`);
            
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                const responseTime = Date.now() - startTime;
                console.log(`⏱️ Response received in ${responseTime}ms`);
                
                try {
                    const result = JSON.parse(data);
                    
                    if (result.success) {
                        console.log('\n✅ API Analysis Results:');
                        console.log('=' .repeat(50));
                        
                        // Nudity Detection
                        const nudity = result.image_analysis?.nudity_detection;
                        if (nudity) {
                            console.log('\n🔞 NUDITY DETECTION:');
                            console.log(`   Has nudity: ${nudity.has_nudity}`);
                            console.log(`   Nudity score: ${nudity.nudity_score}%`);
                            console.log(`   Detected parts: ${Object.keys(nudity.detected_parts || {}).join(', ') || 'none'}`);
                            console.log(`   Part count: ${nudity.part_count}`);
                        }
                        
                        // Face Analysis  
                        const faces = result.image_analysis?.face_analysis;
                        if (faces) {
                            console.log('\n👤 FACE ANALYSIS:');
                            console.log(`   Faces detected: ${faces.faces_detected}`);
                            console.log(`   Face count: ${faces.face_count}`);
                            console.log(`   Min age: ${faces.min_age}`);
                            console.log(`   Max age: ${faces.max_age}`);
                            console.log(`   Underage detected: ${faces.underage_detected}`);
                            console.log(`   Suspicious ages: ${faces.suspicious_ages}`);
                            
                            if (faces.age_distribution) {
                                console.log(`   Age distribution:`);
                                console.log(`     Under 16: ${faces.age_distribution.under_16}`);
                                console.log(`     Under 18: ${faces.age_distribution.under_18}`);
                                console.log(`     Adult: ${faces.age_distribution.adult}`);
                            }
                            
                            if (faces.faces && faces.faces.length > 0) {
                                console.log(`   Individual faces:`);
                                faces.faces.forEach((face, i) => {
                                    console.log(`     Face ${i + 1}: Age ${face.age}, Gender ${face.gender}, Confidence ${face.confidence}`);
                                });
                            }
                        }
                        
                        // Image Description
                        const description = result.image_analysis?.image_description;
                        if (description) {
                            console.log('\n📝 IMAGE DESCRIPTION:');
                            console.log(`   Description: "${description.description}"`);
                            console.log(`   Tags: [${description.tags?.join(', ') || 'none'}]`);
                            console.log(`   Method: ${description.generation_method}`);
                        }
                        
                        // Combined Assessment
                        const assessment = result.image_analysis?.combined_assessment;
                        if (assessment) {
                            console.log('\n⚖️ RISK ASSESSMENT:');
                            console.log(`   Final risk score: ${assessment.final_risk_score}%`);
                            console.log(`   Risk level: ${assessment.risk_level}`);
                            console.log(`   Age risk multiplier: ${assessment.age_risk_multiplier}x`);
                            console.log(`   Reasoning: [${assessment.reasoning?.join(', ') || 'none'}]`);
                        }
                        
                        // Moderation Decision
                        const decision = result.moderation_decision;
                        if (decision) {
                            console.log('\n🎯 MODERATION DECISION:');
                            console.log(`   Status: ${decision.status}`);
                            console.log(`   Action: ${decision.action}`);
                            console.log(`   Human review required: ${decision.human_review_required}`);
                            console.log(`   Confidence: ${decision.confidence}%`);
                            if (decision.rejection_reason) {
                                console.log(`   Rejection reason: ${decision.rejection_reason}`);
                            }
                        }
                        
                        // Metadata
                        console.log('\n📋 METADATA:');
                        console.log(`   Analysis version: ${result.metadata?.analysis_version}`);
                        console.log(`   Pipeline stages: [${result.metadata?.pipeline_stages?.join(', ') || 'unknown'}]`);
                        console.log(`   BLIP available: ${result.metadata?.blip_available}`);
                        
                        console.log('\n' + '='.repeat(50));
                        
                        resolve(result);
                    } else {
                        console.error('❌ API returned success: false');
                        console.error('Error:', result.error);
                        reject(new Error(result.error || 'API analysis failed'));
                    }
                } catch (parseError) {
                    console.error('❌ Failed to parse API response:', parseError.message);
                    console.error('Raw response:', data.substring(0, 500) + '...');
                    reject(parseError);
                }
            });
        });

        req.on('error', (error) => {
            console.error('❌ API request failed:', error.message);
            reject(error);
        });

        req.on('timeout', () => {
            console.error('❌ API request timed out');
            req.destroy();
            reject(new Error('API request timeout'));
        });

        console.log('📡 Uploading image...');
        form.pipe(req);
    });
}

// Check if image path is provided
const imagePath = process.argv[2];
if (!imagePath) {
    console.error('Usage: node test-uploaded-image.js <image-path>');
    process.exit(1);
}

if (!fs.existsSync(imagePath)) {
    console.error(`Error: Image file not found: ${imagePath}`);
    process.exit(1);
}

testImageUpload(imagePath)
    .then(() => {
        console.log('\n✅ Image analysis complete!');
    })
    .catch((error) => {
        console.error('\n❌ Image analysis failed:', error.message);
        process.exit(1);
    });