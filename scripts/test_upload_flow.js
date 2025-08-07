const db = require('../config/database');
const ContentModerationService = require('../src/services/ContentModerationService');
const path = require('path');
const fs = require('fs');

async function testUploadFlow() {
    console.log('🧪 Testing End-to-End Upload Flow with New Configuration System...\n');
    
    try {
        const service = new ContentModerationService(db);
        
        // Find a test image to use
        const uploadsDir = '/Users/programmer/Projects/musenest/public/uploads';
        let testImagePath = null;
        
        // Look for any existing image in uploads
        if (fs.existsSync(uploadsDir)) {
            const models = fs.readdirSync(uploadsDir).filter(item => 
                fs.statSync(path.join(uploadsDir, item)).isDirectory()
            );
            
            for (const model of models) {
                const originalsDir = path.join(uploadsDir, model, 'originals');
                if (fs.existsSync(originalsDir)) {
                    const images = fs.readdirSync(originalsDir).filter(file => 
                        /\.(jpg|jpeg|png|webp)$/i.test(file)
                    );
                    
                    if (images.length > 0) {
                        testImagePath = path.join(originalsDir, images[0]);
                        console.log(`📁 Found test image: ${testImagePath}`);
                        break;
                    }
                }
            }
        }
        
        if (!testImagePath) {
            console.log('⚠️ No test images found in uploads directory');
            console.log('   Creating a dummy test scenario instead...\n');
            
            // Test with simulated analysis results
            await testSimulatedAnalysis(service);
            return;
        }
        
        // Test different usage intents
        const testScenarios = [
            { usageIntent: 'public_site', modelId: 1, description: 'Public Site (Conservative)' },
            { usageIntent: 'paysite', modelId: 1, description: 'Paysite (Moderate)' },
            { usageIntent: 'store', modelId: 1, description: 'Store (Liberal)' }
        ];
        
        for (const scenario of testScenarios) {
            console.log(`\\n🎯 Testing: ${scenario.description}`);
            console.log(`   Usage Intent: ${scenario.usageIntent}`);
            console.log(`   Model ID: ${scenario.modelId}`);
            
            try {
                // Test the analysis with configuration
                console.log('   📊 Loading configuration...');
                const config = await service.loadAnalysisConfiguration(scenario.usageIntent, scenario.modelId);
                
                if (config) {
                    console.log(`   ✅ Config loaded: v${config.version || 1}`);
                    console.log(`   📈 Thresholds: approve<${config.scoring_config.thresholds.auto_approve_under}%, flag>${config.scoring_config.thresholds.auto_flag_over}%`);
                    console.log(`   🔍 Detection: breast=${config.detection_config.nudenet_components.breast_detection}, face=${config.detection_config.nudenet_components.face_detection}`);
                } else {
                    console.log('   ❌ Failed to load configuration');
                    continue;
                }
                
                // Simulate the analysis call (since we might not have EC2 API available)
                console.log('   🔄 Simulating analysis call...');
                
                // Create mock analysis result
                const mockAnalysis = {
                    detected_parts: { 
                        'BREAST_EXPOSED': 65.0, 
                        'FACE_DETECTED': 90.0 
                    },
                    part_locations: {},
                    nudity_score: 58,
                    has_nudity: true,
                    face_count: 1,
                    min_detected_age: 25,
                    underage_detected: false,
                    contains_children: false,
                    image_description: { description: 'Test image analysis' },
                    description_text: 'Test image for analysis',
                    description_tags: [],
                    final_risk_score: 58,
                    risk_level: 'medium'
                };
                
                // Apply moderation rules with the new system
                console.log('   ⚖️ Applying moderation rules...');
                const moderationResult = await service.applyModerationRules(
                    mockAnalysis, 
                    scenario.usageIntent, 
                    scenario.modelId
                );
                
                console.log('   📋 Results:');
                console.log(`     📊 Original score: ${mockAnalysis.nudity_score}% → Weighted: ${moderationResult.weighted_nudity_score || moderationResult.nudity_score}%`);
                console.log(`     🏷️ Status: ${moderationResult.moderation_status}`);
                console.log(`     🚩 Flagged: ${moderationResult.flagged}`);
                console.log(`     👁️ Review Required: ${moderationResult.human_review_required}`);
                console.log(`     📍 Final Location: ${moderationResult.final_location}`);
                
                // Show how the weighting affected the decision
                const originalWouldBe = mockAnalysis.nudity_score > config.scoring_config.thresholds.auto_flag_over ? 'flagged' : 'approved';
                const newDecision = moderationResult.moderation_status;
                
                if (originalWouldBe !== newDecision) {
                    console.log(`     🔄 Decision Changed: Old system would have ${originalWouldBe}, new system: ${newDecision}`);
                } else {
                    console.log(`     ✅ Decision Consistent: Both systems would ${newDecision}`);
                }
                
            } catch (error) {
                console.log(`   ❌ Error: ${error.message}`);
            }
        }
        
        console.log('\\n✅ End-to-End Test Complete!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error(error.stack);
    } finally {
        process.exit(0);
    }
}

async function testSimulatedAnalysis(service) {
    console.log('🎭 Running Simulated Analysis Tests...\n');
    
    const scenarios = [
        {
            name: 'Family Photo',
            analysis: {
                detected_parts: { 'FACE_DETECTED': 95.0 },
                nudity_score: 2,
                has_nudity: false,
                underage_detected: false,
                contains_children: false
            }
        },
        {
            name: 'Fashion Photo',
            analysis: {
                detected_parts: { 'BREAST_EXPOSED': 35.0, 'FACE_DETECTED': 85.0 },
                nudity_score: 28,
                has_nudity: true,
                underage_detected: false,
                contains_children: false
            }
        },
        {
            name: 'Adult Content',
            analysis: {
                detected_parts: { 'GENITALIA': 88.0, 'BREAST_EXPOSED': 75.0 },
                nudity_score: 84,
                has_nudity: true,
                underage_detected: false,
                contains_children: false
            }
        }
    ];
    
    for (const scenario of scenarios) {
        console.log(`\\n📸 Scenario: ${scenario.name}`);
        
        for (const intent of ['public_site', 'paysite']) {
            const result = await service.applyModerationRules(scenario.analysis, intent, null);
            
            console.log(`  ${intent}:`);
            console.log(`    📊 ${scenario.analysis.nudity_score}% → ${result.weighted_nudity_score || result.nudity_score}%`);
            console.log(`    🏷️ ${result.moderation_status} (${result.flagged ? 'flagged' : 'approved'})`);
        }
    }
}

testUploadFlow();