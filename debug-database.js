#!/usr/bin/env node

const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'musenest',
    port: 3306
};

async function testDatabase() {
    console.log('🔍 Testing database connection and schema...');
    
    try {
        const connection = await mysql.createConnection(dbConfig);
        
        // Test 1: Check if we can connect
        console.log('✅ Database connected successfully');
        
        // Test 2: Check what columns exist in content_moderation
        console.log('\n📋 Checking content_moderation table structure:');
        const [columns] = await connection.execute('DESCRIBE content_moderation');
        columns.forEach(col => {
            if (col.Field.includes('pose') || col.Field.includes('risk') || col.Field.includes('assessment')) {
                console.log(`  ✓ ${col.Field}: ${col.Type}`);
            }
        });
        
        // Test 3: Try a simple INSERT without pose fields
        console.log('\n🧪 Testing simple INSERT (without pose fields):');
        const simpleQuery = `
            INSERT INTO content_moderation (
                image_path, original_path, model_id, context_type, nudity_score, detected_parts, 
                part_locations, moderation_status, human_review_required, 
                flagged, final_location
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const simpleValues = [
            '/test/path.jpg',
            '/test/original.jpg',
            1,
            'public_gallery',
            50.5,
            '{"FACE": 80}',
            '{"FACE": {"x": 100, "y": 100, "width": 200, "height": 200}}',
            'flagged',
            1,
            1,
            'originals'
        ];
        
        const [result] = await connection.execute(simpleQuery, simpleValues);
        console.log(`✅ Simple INSERT successful, ID: ${result.insertId}`);
        
        // Test 4: Try INSERT with pose fields
        console.log('\n🧪 Testing INSERT with pose fields:');
        const fullQuery = `
            INSERT INTO content_moderation (
                image_path, original_path, model_id, context_type, nudity_score, detected_parts, 
                part_locations, moderation_status, human_review_required, 
                flagged, final_location, pose_analysis, final_risk_score, 
                risk_level, combined_assessment, pose_category
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const fullValues = [
            '/test/path2.jpg',
            '/test/original2.jpg',
            1,
            'public_gallery',
            60.5,
            '{"FACE": 80}',
            '{"FACE": {"x": 100, "y": 100, "width": 200, "height": 200}}',
            'flagged',
            1,
            1,
            'originals',
            '{"pose_detected": true}',
            75.5,
            'medium',
            '{"risk_score": 75.5}',
            'neutral'
        ];
        
        const [result2] = await connection.execute(fullQuery, fullValues);
        console.log(`✅ Full INSERT successful, ID: ${result2.insertId}`);
        
        // Clean up test records
        await connection.execute('DELETE FROM content_moderation WHERE image_path LIKE "/test/%"');
        console.log('🧹 Test records cleaned up');
        
        await connection.end();
        
    } catch (error) {
        console.error('❌ Database test failed:', error.message);
        console.error('SQL State:', error.sqlState);
        console.error('Error Code:', error.code);
    }
}

testDatabase();