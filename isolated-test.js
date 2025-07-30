#!/usr/bin/env node

const mysql = require('mysql2/promise');

async function testIsolated() {
    console.log('🧪 Isolated database test...');
    
    try {
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'musenest',
            port: 3306
        });
        
        console.log('✅ Connected to database');
        
        // Test the exact INSERT that's failing
        const query = `
            INSERT INTO content_moderation (
                image_path, original_path, model_id, context_type, usage_intent,
                nudity_score, detected_parts, part_locations, pose_classification,
                explicit_pose_score, generated_caption, policy_violations,
                moderation_status, human_review_required, flagged, auto_blocked,
                confidence_score, final_location
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const values = [
            '/isolated/test.jpg',
            '/isolated/orig.jpg',
            1,
            'public_gallery',
            'public_site',
            50.0,
            '{"FACE": 80}',
            '{"FACE": {"x": 100}}',
            'neutral',
            0,
            null,
            '[]',
            'flagged',
            1,
            1,
            0,
            95.0,
            'originals'
        ];
        
        console.log('🔍 Executing INSERT...');
        const [result] = await connection.execute(query, values);
        console.log(`✅ SUCCESS! Insert ID: ${result.insertId}`);
        
        // Clean up
        await connection.execute('DELETE FROM content_moderation WHERE image_path = ?', ['/isolated/test.jpg']);
        console.log('🧹 Cleaned up test record');
        
        await connection.end();
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('SQL:', error.sql);
        console.error('SQL State:', error.sqlState);
    }
}

testIsolated();