#!/usr/bin/env node

/**
 * Debug script to identify the exact source of "original_path doesn't have a default value" error
 */

const mysql = require('mysql2/promise');

async function debugDatabaseInsert() {
    console.log('🐞 Debugging database insertion...');
    
    try {
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root', 
            password: '',
            database: 'phoenix4ge'
        });
        
        console.log('✅ Database connected');
        
        // First, try a minimal insert to see what happens
        console.log('\n1️⃣ Testing minimal insert into content_moderation...');
        
        const minimalQuery = `
            INSERT INTO content_moderation (
                image_path, model_id, context_type, nudity_score, flagged
            ) VALUES (?, ?, ?, ?, ?)
        `;
        
        const minimalValues = [
            '/test/minimal.jpg',
            1,
            'public_gallery', 
            25.5,
            0  // flagged = false to avoid trigger
        ];
        
        try {
            const [result1] = await connection.execute(minimalQuery, minimalValues);
            console.log('✅ Minimal insert successful! Insert ID:', result1.insertId);
            
            // Clean up
            await connection.execute('DELETE FROM content_moderation WHERE id = ?', [result1.insertId]);
            console.log('🧹 Minimal test record cleaned up');
        } catch (error1) {
            console.error('❌ Minimal insert failed:', error1.message);
        }
        
        // Next, try with the flagged field to trigger the trigger
        console.log('\n2️⃣ Testing insert with trigger (flagged=1)...');
        
        const triggerQuery = `
            INSERT INTO content_moderation (
                image_path, original_path, model_id, context_type, 
                nudity_score, flagged, moderation_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        
        const triggerValues = [
            '/test/trigger.jpg',
            '/test/original_trigger.jpg',
            1,
            'public_gallery',
            25.5,
            1,  // flagged = true to trigger the trigger
            'flagged'
        ];
        
        try {
            const [result2] = await connection.execute(triggerQuery, triggerValues);
            console.log('✅ Trigger insert successful! Insert ID:', result2.insertId);
            
            // Clean up both tables
            await connection.execute('DELETE FROM media_review_queue WHERE content_moderation_id = ?', [result2.insertId]);
            await connection.execute('DELETE FROM content_moderation WHERE id = ?', [result2.insertId]);
            console.log('🧹 Trigger test records cleaned up');
        } catch (error2) {
            console.error('❌ Trigger insert failed:', error2.message);
            console.error('🔍 This is likely where the original_path error comes from!');
            
            // Check if the record was inserted in content_moderation but failed in media_review_queue
            const [orphanedRecords] = await connection.execute(
                'SELECT id FROM content_moderation WHERE image_path = ?', 
                ['/test/trigger.jpg']
            );
            
            if (orphanedRecords.length > 0) {
                console.log('🧹 Cleaning up orphaned content_moderation record');
                await connection.execute('DELETE FROM content_moderation WHERE image_path = ?', ['/test/trigger.jpg']);
            }
        }
        
        // Finally, test the full ContentModerationService.js query structure
        console.log('\n3️⃣ Testing full ContentModerationService.js structure...');
        
        const fullQuery = `
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
        
        const fullValues = [
            '/test/full.jpg',           // image_path
            '/test/original_full.jpg',  // original_path
            1,                          // model_id
            'public_gallery',           // context_type
            'public_site',              // usage_intent
            25.5,                       // nudity_score
            JSON.stringify({}),         // detected_parts
            JSON.stringify({}),         // part_locations
            null,                       // pose_classification
            0,                          // explicit_pose_score
            null,                       // generated_caption
            JSON.stringify([]),         // policy_violations
            'flagged',                  // moderation_status
            1,                          // human_review_required
            1,                          // flagged (will trigger the trigger)
            0,                          // auto_blocked
            85,                         // confidence_score
            'originals',                // final_location
            25.5,                       // final_risk_score
            'low',                      // risk_level
            JSON.stringify({}),         // combined_assessment
            null,                       // pose_category
            JSON.stringify({}),         // pose_analysis
            JSON.stringify({}),         // face_analysis
            JSON.stringify({}),         // image_description
            null,                       // min_detected_age
            0,                          // face_count
            0,                          // underage_detected
            1.0,                        // age_risk_multiplier
            0.0                         // description_risk
        ];
        
        try {
            const [result3] = await connection.execute(fullQuery, fullValues);
            console.log('✅ Full insert successful! Insert ID:', result3.insertId);
            
            // Clean up both tables
            await connection.execute('DELETE FROM media_review_queue WHERE content_moderation_id = ?', [result3.insertId]);
            await connection.execute('DELETE FROM content_moderation WHERE id = ?', [result3.insertId]);
            console.log('🧹 Full test records cleaned up');
        } catch (error3) {
            console.error('❌ Full insert failed:', error3.message);
            
            // Clean up any orphaned records
            const [orphanedRecords] = await connection.execute(
                'SELECT id FROM content_moderation WHERE image_path = ?', 
                ['/test/full.jpg']
            );
            
            if (orphanedRecords.length > 0) {
                console.log('🧹 Cleaning up orphaned content_moderation record');
                await connection.execute('DELETE FROM content_moderation WHERE image_path = ?', ['/test/full.jpg']);
            }
        }
        
        await connection.end();
        console.log('\n✅ Database debugging complete');
        
    } catch (error) {
        console.error('❌ Database debugging failed:', error.message);
        process.exit(1);
    }
}

debugDatabaseInsert();