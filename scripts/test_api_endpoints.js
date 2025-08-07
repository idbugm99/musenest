const http = require('http');
const https = require('https');

async function testAPIEndpoints() {
    console.log('🌐 Testing Analysis Configuration API Endpoints...\n');
    
    const apiKey = 'mns_config_2025_secure_key_change_me_immediately';
    const baseUrl = 'http://localhost:3000';
    
    // Test 1: Get Configuration
    console.log('📋 Test 1: Get Configuration');
    try {
        const publicConfig = await makeRequest('GET', `${baseUrl}/api/v1/analysis/config/public_site`, null, apiKey);
        console.log('  ✅ GET /api/v1/analysis/config/public_site');
        console.log(`  📊 Breast weight: ${publicConfig.data.scoring_config.detection_weights.BREAST_EXPOSED}`);
        console.log(`  🎯 Auto approve under: ${publicConfig.data.scoring_config.thresholds.auto_approve_under}%`);
    } catch (error) {
        console.log(`  ❌ GET failed: ${error.message}`);
    }
    
    // Test 2: Validate Configuration  
    console.log('\\n🔍 Test 2: Validate Configuration');
    const testConfig = {
        detection_config: {
            nudenet_components: {
                breast_detection: false,
                genitalia_detection: true,
                buttocks_detection: true,
                anus_detection: false,
                face_detection: true
            },
            blip_components: {
                age_estimation: true,
                child_content_detection: true,
                image_description: false
            }
        },
        scoring_config: {
            detection_weights: {
                BREAST_EXPOSED: 0,
                GENITALIA: 95,
                BUTTOCKS_EXPOSED: 25,
                ANUS_EXPOSED: 0,
                FACE_DETECTED: 0
            },
            thresholds: {
                auto_approve_under: 15,
                auto_flag_over: 30,
                auto_reject_over: 80
            },
            risk_multipliers: {
                underage_detected: 100.0,
                child_content_blip: 50.0
            }
        },
        blip_config: {
            enabled: true,
            child_detection_keywords: ["child", "kid", "minor"],
            age_estimation_threshold: 18,
            description_analysis: false,
            webhook_delivery: true
        }
    };
    
    try {
        const validation = await makeRequest('POST', `${baseUrl}/api/v1/analysis/config/validate`, testConfig, apiKey);
        console.log(`  ✅ Validation result: ${validation.valid ? 'VALID' : 'INVALID'}`);
        if (!validation.valid) {
            console.log(`  ❌ Errors: ${validation.errors.join(', ')}`);
        }
        if (validation.warnings && validation.warnings.length > 0) {
            console.log(`  ⚠️ Warnings: ${validation.warnings.join(', ')}`);
        }
    } catch (error) {
        console.log(`  ❌ Validation failed: ${error.message}`);
    }
    
    // Test 3: Update Configuration (test only - we'll revert)
    console.log('\\n✏️ Test 3: Update Configuration (Test Mode)');
    try {
        // First get current config
        const originalConfig = await makeRequest('GET', `${baseUrl}/api/v1/analysis/config/private`, null, apiKey);
        console.log('  📥 Retrieved current private config');
        
        // Modify it slightly
        const modifiedConfig = { ...originalConfig.data };
        modifiedConfig.scoring_config.thresholds.auto_approve_under = 99; // Change from 95 to 99
        
        // Update it
        const updateResult = await makeRequest('PUT', `${baseUrl}/api/v1/analysis/config/private`, modifiedConfig, apiKey);
        console.log('  ✅ Configuration updated successfully');
        console.log(`  📊 New auto_approve_under: ${updateResult.data.scoring_config.thresholds.auto_approve_under}%`);
        
        // Verify the change
        const verifyConfig = await makeRequest('GET', `${baseUrl}/api/v1/analysis/config/private`, null, apiKey);
        if (verifyConfig.data.scoring_config.thresholds.auto_approve_under === 99) {
            console.log('  ✅ Change verified successfully');
        } else {
            console.log('  ❌ Change verification failed');
        }
        
        // Revert the change
        const revertConfig = { ...originalConfig.data };
        await makeRequest('PUT', `${baseUrl}/api/v1/analysis/config/private`, revertConfig, apiKey);
        console.log('  🔄 Configuration reverted to original');
        
    } catch (error) {
        console.log(`  ❌ Update test failed: ${error.message}`);
    }
    
    // Test 4: Get Audit Trail
    console.log('\\n📜 Test 4: Get Audit Trail');
    try {
        const audit = await makeRequest('GET', `${baseUrl}/api/v1/analysis/config/public_site/audit?limit=5`, null, apiKey);
        console.log(`  ✅ Retrieved ${audit.data.length} audit entries`);
        
        if (audit.data.length > 0) {
            const latest = audit.data[0];
            console.log(`  📅 Latest change: ${latest.action} by ${latest.changed_by} at ${latest.timestamp}`);
        }
    } catch (error) {
        console.log(`  ❌ Audit trail failed: ${error.message}`);
    }
    
    // Test 5: Authentication Test
    console.log('\\n🔐 Test 5: Authentication');
    try {
        // Test without API key
        await makeRequest('GET', `${baseUrl}/api/v1/analysis/config/public_site`, null, null);
        console.log('  ❌ Request without API key should have failed');
    } catch (error) {
        if (error.message.includes('401')) {
            console.log('  ✅ Properly rejected request without API key');
        } else {
            console.log(`  ❓ Unexpected error: ${error.message}`);
        }
    }
    
    try {
        // Test with invalid API key
        await makeRequest('GET', `${baseUrl}/api/v1/analysis/config/public_site`, null, 'invalid_key');
        console.log('  ❌ Request with invalid API key should have failed');
    } catch (error) {
        if (error.message.includes('401')) {
            console.log('  ✅ Properly rejected request with invalid API key');
        } else {
            console.log(`  ❓ Unexpected error: ${error.message}`);
        }
    }
    
    console.log('\\n✅ API Endpoint Tests Complete!');
}

function makeRequest(method, url, data, apiKey) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        if (apiKey) {
            options.headers['Authorization'] = `Bearer ${apiKey}`;
        }
        
        if (data) {
            const jsonData = JSON.stringify(data);
            options.headers['Content-Length'] = Buffer.byteLength(jsonData);
        }
        
        const req = http.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(responseData);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsed);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${parsed.error || responseData}`));
                    }
                } catch (parseError) {
                    reject(new Error(`Failed to parse response: ${responseData}`));
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

// Only run if server is likely running
if (process.argv.includes('--run')) {
    testAPIEndpoints().catch(console.error);
} else {
    console.log('💡 To test API endpoints, start the server first:');
    console.log('   npm start');
    console.log('   Then run: node scripts/test_api_endpoints.js --run');
}