const fs = require('fs');
const FormData = require('form-data');
const http = require('http');

async function testBoundingBoxFix() {
    console.log('🧪 Testing bounding box coordinate fix...');
    
    // Check if test image exists
    const testImagePath = './test-auto.jpg';
    if (!fs.existsSync(testImagePath)) {
        console.log('❌ Test image not found:', testImagePath);
        return;
    }
    
    console.log('📸 Using test image:', testImagePath);
    
    // Create form data
    const form = new FormData();
    form.append('image', fs.createReadStream(testImagePath)); // Changed from 'file' to 'image'
    form.append('model_id', '1');
    form.append('model_slug', 'escort-example'); // Added required model_slug
    form.append('usage_intent', 'public_site');
    form.append('context_type', 'public_gallery');
    
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/enhanced-content-moderation/upload', // Fixed path
            method: 'POST',
            headers: form.getHeaders()
        }, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    console.log('\n✅ Upload completed');
                    console.log('📊 Response status:', res.statusCode);
                    
                    if (result.success) {
                        const data = result.data; // Extract data object
                        console.log('\n🎯 AI Analysis Results:');
                        console.log('   Nudity Score:', data.nudity_score);
                        console.log('   Detected Parts:', Object.keys(data.detected_parts || {}));
                        console.log('   Moderation Status:', data.moderation_status);
                        
                        console.log('\n📍 BOUNDING BOX COORDINATES:');
                        if (data.part_locations && Object.keys(data.part_locations).length > 0) {
                            Object.entries(data.part_locations).forEach(([part, location]) => {
                                console.log(`   ${part}:`);
                                console.log(`     x: ${location.x}, y: ${location.y}`);
                                console.log(`     width: ${location.width}, height: ${location.height}`);
                                console.log(`     confidence: ${location.confidence}%`);
                                
                                // Check if these are the old default coordinates
                                if (location.x === 0 && location.y === 0 && location.width === 100 && location.height === 100) {
                                    console.log('     ❌ STILL USING DEFAULT COORDINATES!');
                                } else {
                                    console.log('     ✅ Using actual pixel coordinates!');
                                }
                            });
                        } else {
                            console.log('   ⚠️  No part_locations in response');
                        }
                        
                        console.log('\n🔧 Moderation Decision:');
                        console.log('   Status:', data.moderation_status);
                        console.log('   Flagged:', data.flagged);
                        console.log('   Human Review Required:', data.human_review_required);
                        console.log('   Final Location:', data.final_location);
                        
                    } else {
                        console.log('❌ Upload failed:', result.error);
                    }
                    
                    resolve(result);
                } catch (parseError) {
                    console.error('❌ JSON parse error:', parseError.message);
                    console.error('Raw response:', data.substring(0, 500));
                    reject(parseError);
                }
            });
        });
        
        req.on('error', (error) => {
            console.error('❌ Request error:', error.message);
            reject(error);
        });
        
        form.pipe(req);
    });
}

// Run the test
testBoundingBoxFix()
    .then(result => {
        console.log('\n🎉 Test completed successfully');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n💥 Test failed:', error.message);
        process.exit(1);
    });