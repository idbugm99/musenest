/**
 * Fix NudeNet Configuration Script
 * Addresses overly sensitive thresholds that flag normal clothed images
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixNudeNetConfiguration() {
    let connection;
    
    try {
        // Create database connection
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'phoenix4ge',
            charset: 'utf8mb4'
        });

        console.log('🔧 Fixing NudeNet configuration thresholds...');

        // Delete existing problematic configurations
        await connection.execute('DELETE FROM analysis_configurations WHERE usage_intent = ?', ['public_site']);
        console.log('✅ Removed old configurations');

        // Create the corrected analysis configuration
        const detectionConfig = {
            nudenet_components: {
                breast_detection: true,
                genitalia_detection: true,
                buttocks_detection: true,
                face_detection: false,      // DISABLE face detection for flagging
                feet_detection: false,      // DISABLE feet detection for flagging
                armpits_detection: false    // DISABLE armpit detection for flagging
            },
            confidence_thresholds: {
                // Only flag EXPOSED/UNCOVERED body parts with high confidence
                'EXPOSED_GENITALIA_F': 0.85,     // Only flag clear genitalia
                'EXPOSED_GENITALIA_M': 0.85,     // Only flag clear genitalia
                'EXPOSED_BREAST_F': 0.80,        // Only flag clearly exposed breasts
                'EXPOSED_BUTTOCKS': 0.75,        // Only flag clearly exposed buttocks
                'EXPOSED_ANUS': 0.80,            // Only flag clear anus exposure
                
                // COVERED parts should have very high thresholds or be ignored
                'COVERED_GENITALIA_F': 0.95,     // Very high - covered shouldn't flag
                'COVERED_GENITALIA_M': 0.95,     // Very high - covered shouldn't flag
                'COVERED_BREAST_F': 0.95,        // Very high - covered shouldn't flag
                'COVERED_BUTTOCKS': 0.95,        // Very high - covered shouldn't flag
                'BUTTOCKS_COVERED': 0.95,        // Very high - covered shouldn't flag
                
                // NEVER flag these parts
                'FACE_FEMALE': 1.0,              // NEVER flag female faces
                'FACE_MALE': 1.0,                // NEVER flag male faces  
                'FEET_COVERED': 1.0,             // NEVER flag covered feet
                'FEET_EXPOSED': 0.95,            // Very high threshold for exposed feet
                'ARMPITS_COVERED': 1.0,          // NEVER flag covered armpits
                'ARMPITS_EXPOSED': 0.95,         // High threshold for exposed armpits
                'BELLY_COVERED': 1.0,            // NEVER flag covered belly
                'BELLY_EXPOSED': 0.90            // High threshold for exposed belly
            }
        };

        const scoringConfig = {
            scoring_weights: {
                // Only EXPOSED parts contribute significant scores
                'EXPOSED_GENITALIA_F': 85,       // High impact for actual genitalia
                'EXPOSED_GENITALIA_M': 85,       // High impact for actual genitalia
                'EXPOSED_BREAST_F': 40,          // Moderate impact for exposed breasts
                'EXPOSED_BUTTOCKS': 25,          // Lower impact for exposed buttocks
                'EXPOSED_ANUS': 60,              // High impact for anus
                
                // COVERED parts have minimal to zero impact
                'COVERED_BREAST_F': 5,           // Very low impact
                'COVERED_BUTTOCKS': 2,           // Minimal impact
                'BUTTOCKS_COVERED': 2,           // Minimal impact
                
                // These should NEVER contribute to flagging
                'FACE_FEMALE': 0,                // Zero impact
                'FACE_MALE': 0,                  // Zero impact
                'FEET_COVERED': 0,               // Zero impact
                'FEET_EXPOSED': 1,               // Minimal impact
                'ARMPITS_COVERED': 0,            // Zero impact
                'ARMPITS_EXPOSED': 1,            // Minimal impact
                'BELLY_COVERED': 0,              // Zero impact
                'BELLY_EXPOSED': 5               // Very low impact
            },
            thresholds: {
                auto_approve_under: 25,          // Auto-approve under 25% (clothed/artistic)
                human_review_over: 65,           // Human review 25-65% range
                auto_reject_over: 90             // Auto-reject over 90% (clear explicit)
            },
            risk_multipliers: {
                child_detected: 10.0,            // 10x multiplier for child content
                underage_suspected: 5.0,         // 5x multiplier for suspected underage
                public_context: 1.2              // 1.2x multiplier for public context
            }
        };

        const blipConfig = {
            enabled: true,
            child_detection_keywords: ['child', 'kid', 'baby', 'toddler', 'minor', 'underage', 'teen', 'school'],
            age_estimation_threshold: 18,
            description_analysis: true,
            webhook_delivery: true
        };

        // Insert the corrected configuration
        await connection.execute(`
            INSERT INTO analysis_configurations (
                usage_intent,
                model_id,
                detection_config,
                scoring_config,
                blip_config,
                is_active
            ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
            'public_site',
            null, // Global configuration
            JSON.stringify(detectionConfig),
            JSON.stringify(scoringConfig),
            JSON.stringify(blipConfig),
            1 // is_active
        ]);

        console.log('✅ Created corrected analysis configuration');

        // Verify the new configuration
        const [rows] = await connection.execute(`
            SELECT 
                id,
                usage_intent,
                JSON_EXTRACT(detection_config, '$.confidence_thresholds.FACE_FEMALE') as face_female_threshold,
                JSON_EXTRACT(detection_config, '$.confidence_thresholds.BUTTOCKS_COVERED') as buttocks_covered_threshold,
                JSON_EXTRACT(detection_config, '$.confidence_thresholds.FEET_COVERED') as feet_covered_threshold,
                JSON_EXTRACT(detection_config, '$.confidence_thresholds.EXPOSED_BREAST_F') as exposed_breast_threshold,
                JSON_EXTRACT(scoring_config, '$.scoring_weights.FACE_FEMALE') as face_scoring_weight,
                JSON_EXTRACT(scoring_config, '$.thresholds.auto_approve_under') as auto_approve_threshold,
                is_active
            FROM analysis_configurations 
            WHERE usage_intent = 'public_site' AND is_active = true
        `);

        console.log('\n📊 New Configuration Summary:');
        console.log('================================');
        console.log('FACE_FEMALE threshold:', rows[0].face_female_threshold, '(1.0 = never flag)');
        console.log('BUTTOCKS_COVERED threshold:', rows[0].buttocks_covered_threshold, '(0.95 = rarely flag)');
        console.log('FEET_COVERED threshold:', rows[0].feet_covered_threshold, '(1.0 = never flag)');
        console.log('EXPOSED_BREAST_F threshold:', rows[0].exposed_breast_threshold, '(0.8 = high confidence only)');
        console.log('FACE_FEMALE scoring weight:', rows[0].face_scoring_weight, '(0 = no impact on score)');
        console.log('Auto-approve threshold:', rows[0].auto_approve_threshold, '(under 25% auto-approved)');
        console.log('Configuration is active:', !!rows[0].is_active);

        console.log('\n🎯 Key Improvements:');
        console.log('- FACE_FEMALE: Never flagged (threshold 1.0, weight 0)');
        console.log('- BUTTOCKS_COVERED: Rarely flagged (threshold 0.95, weight 2)');  
        console.log('- FEET_COVERED: Never flagged (threshold 1.0, weight 0)');
        console.log('- ARMPITS_COVERED: Never flagged (threshold 1.0, weight 0)');
        console.log('- Only EXPOSED body parts with high confidence will flag');
        console.log('- Auto-approve threshold raised to 25% for normal clothed images');

    } catch (error) {
        console.error('❌ Error fixing NudeNet configuration:', error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Run the fix
fixNudeNetConfiguration()
    .then(() => {
        console.log('\n✅ NudeNet configuration fix completed successfully!');
        console.log('🔄 Restart the application for changes to take effect.');
        process.exit(0);
    })
    .catch(console.error);