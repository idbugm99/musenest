#!/usr/bin/env node

/**
 * Test script to verify database insertion fix for original_path field
 */

const mysql = require('mysql2/promise');

async function testDatabaseFix() {
    console.log('🧪 Testing database insertion fix...');
    
    try {
        // Create database connection
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root', 
            password: '',
            database: 'phoenix4ge'
        });
        
        console.log('✅ Database connected');
        
        // Test data - this should match what ContentModerationService would send
        const testData = {
            image_path: '/test/path/image.jpg',
            originalPath: null, // This was causing the issue before
            modelId: 1,
            contextType: 'public_gallery',
            usageIntent: 'public_site',
            nudity_score: 25.5,
            detected_parts: {},
            part_locations: {},
            pose_classification: null,
            explicit_pose_score: 0,
            generated_caption: null,
            policy_violations: [],
            moderation_status: 'flagged',
            human_review_required: true,
            flagged: true,
            auto_blocked: false,
            confidence_score: 85,
            final_location: 'originals',
            final_risk_score: 25.5,
            risk_level: 'low',
            combined_assessment: {},
            pose_category: null,
            pose_analysis: {},
            face_analysis: {},
            image_description: {},
            min_detected_age: null,
            face_count: 0,
            underage_detected: false,
            age_risk_multiplier: 1.0,
            description_risk: 0.0
        };
        
        // Prepare values exactly like ContentModerationService.js does
        const values = [
            testData.image_path || testData.originalPath || null,
            testData.originalPath || testData.image_path || null,
            testData.modelId || null,
            testData.contextType || null,
            testData.usageIntent || null,
            testData.nudity_score || 0,
            JSON.stringify(testData.detected_parts || {}),
            JSON.stringify(testData.part_locations || {}),
            testData.pose_classification || null,
            testData.explicit_pose_score || 0,
            testData.generated_caption || null,
            JSON.stringify(testData.policy_violations || []),
            testData.moderation_status || null,
            testData.human_review_required ? 1 : 0,
            testData.flagged ? 1 : 0,
            testData.auto_blocked ? 1 : 0,
            testData.confidence_score || 0,
            testData.final_location || 'originals',
            testData.final_risk_score || null,
            testData.risk_level || null,
            JSON.stringify(testData.combined_assessment || {}),
            testData.pose_category || null,
            JSON.stringify(testData.pose_analysis || {}),
            JSON.stringify(testData.face_analysis || {}),
            JSON.stringify(testData.image_description || {}),
            testData.min_detected_age || null,
            testData.face_count || 0,
            testData.underage_detected ? 1 : 0,
            testData.age_risk_multiplier || 1.0,
            testData.description_risk || 0.0
        ];
        
        console.log('📝 Testing values:', {
            image_path: values[0],
            original_path: values[1],
            modelId: values[2]
        });
        
        const query = `
            INSERT INTO content_moderation (
                image_path, original_path, model_id, context_type, usage_intent,
                nudity_score, detected_parts, part_locations, pose_classification,
                explicit_pose_score, generated_caption, policy_violations,
                moderation_status, human_review_required, flagged, auto_blocked,
                confidence_score, final_location, final_risk_score, risk_level, 
                combined_assessment, pose_category, pose_analysis,
                face_analysis, image_description, min_detected_age, face_count,
                underage_detected, age_risk_multiplier, description_risk
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const [result] = await connection.execute(query, values);
        
        console.log('✅ Database insertion successful!');
        console.log('📊 Insert ID:', result.insertId);
        console.log('📊 Affected rows:', result.affectedRows);
        
        // Clean up - delete the test record
        await connection.execute('DELETE FROM content_moderation WHERE id = ?', [result.insertId]);
        console.log('🧹 Test record cleaned up');
        
        await connection.end();
        console.log('✅ Database fix verified - no more "original_path doesn\'t have a default value" error!');
        
    } catch (error) {
        console.error('❌ Database test failed:', error.message);
        if (error.message.includes("doesn't have a default value")) {
            console.error('🚨 The original_path issue still exists!');
        }
        process.exit(1);
    }
}

testDatabaseFix();