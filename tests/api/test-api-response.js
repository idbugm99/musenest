#!/usr/bin/env node

// Test script to debug the API response transformation
const http = require('http');
const FormData = require('form-data');
const fs = require('fs');

async function testApiResponse() {
    console.log('🧪 Testing Enhanced API Response Transformation\n');
    
    return new Promise((resolve, reject) => {
        const form = new FormData();
        form.append('image', fs.createReadStream('/Users/programmer/Projects/musenest/public/uploads/escort-example/originals/1753575572332_20250622_003419.jpg'));
        form.append('context_type', 'public_gallery');
        form.append('model_id', '1');

        const req = http.request({
            hostname: '52.15.235.216',
            port: 5000,
            path: '/analyze',
            method: 'POST',
            headers: form.getHeaders(),
            timeout: 30000
        }, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    console.log('✅ Raw API Response:');
                    console.log('Status:', res.statusCode);
                    console.log('Headers:', res.headers);
                    console.log('Body Length:', data.length);
                    console.log('\n🔍 Parsing JSON...');
                    
                    const result = JSON.parse(data);
                    console.log('✅ JSON parsed successfully');
                    console.log('Success:', result.success);
                    
                    if (result.success) {
                        console.log('\n📊 API Response Structure:');
                        console.log('- image_analysis exists:', !!result.image_analysis);
                        console.log('- nudity_detection exists:', !!result.image_analysis?.nudity_detection);
                        console.log('- pose_analysis exists:', !!result.image_analysis?.pose_analysis);
                        console.log('- moderation_decision exists:', !!result.moderation_decision);
                        
                        console.log('\n🎯 Key Values:');
                        console.log('- Nudity Score:', result.image_analysis?.nudity_detection?.nudity_score);
                        console.log('- Pose Category:', result.image_analysis?.pose_analysis?.pose_category);
                        console.log('- Suggestive Score:', result.image_analysis?.pose_analysis?.suggestive_score);
                        console.log('- Final Risk Score:', result.image_analysis?.combined_assessment?.final_risk_score);
                        
                        console.log('\n🔄 Testing Transformation...');
                        
                        // Test the transformation logic
                        try {
                            const analysis = result.image_analysis;
                            const nudityDetection = analysis.nudity_detection;
                            const poseAnalysis = analysis.pose_analysis;
                            const combinedAssessment = analysis.combined_assessment;
                            const decision = result.moderation_decision;

                            console.log('✅ All required fields accessible');
                            
                            // Test detected parts processing
                            const detectedParts = {};
                            let maxNudityScore = 0;
                            
                            Object.entries(nudityDetection.detected_parts).forEach(([part, confidence]) => {
                                detectedParts[part] = confidence;
                                maxNudityScore = Math.max(maxNudityScore, confidence);
                            });
                            
                            console.log('✅ Detected parts processed:', Object.keys(detectedParts).length, 'parts');
                            console.log('✅ Max nudity score:', maxNudityScore);
                            
                            const transformedResult = {
                                detected_parts: detectedParts,
                                nudity_score: maxNudityScore,
                                has_nudity: nudityDetection.has_nudity,
                                pose_analysis: poseAnalysis,
                                combined_assessment: combinedAssessment,
                                moderation_decision: decision,
                                success: true,
                                analysis_version: '2.0_enhanced_with_pose'
                            };
                            
                            console.log('\n🎉 Transformation SUCCESS!');
                            console.log('Transformed nudity score:', transformedResult.nudity_score);
                            console.log('Transformed pose category:', transformedResult.pose_analysis.pose_category);
                            
                        } catch (transformError) {
                            console.error('❌ TRANSFORMATION ERROR:', transformError.message);
                            console.error('Stack:', transformError.stack);
                        }
                        
                    } else {
                        console.error('❌ API returned success: false');
                        console.error('Error:', result.error);
                    }
                    
                    resolve(result);
                } catch (parseError) {
                    console.error('❌ JSON PARSE ERROR:', parseError.message);
                    console.error('Raw data preview:', data.substring(0, 200) + '...');
                    reject(parseError);
                }
            });
        });

        req.on('error', (error) => {
            console.error('❌ REQUEST ERROR:', error.message);
            reject(error);
        });

        req.on('timeout', () => {
            req.destroy();
            console.error('❌ REQUEST TIMEOUT');
            reject(new Error('Request timeout'));
        });

        form.pipe(req);
    });
}

testApiResponse().catch(console.error);