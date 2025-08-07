#!/usr/bin/env node

// Test the exact same database connection the server uses
const db = require('./config/database');

async function testServerDatabase() {
    console.log('🔍 Testing server database connection...');
    
    try {
        // Test connection
        await db.testConnection();
        
        // Check table structure using server's connection
        console.log('\n📋 Checking content_moderation structure via server connection:');
        const columns = await db.query('DESCRIBE content_moderation');
        
        console.log('All columns:');
        columns.forEach(col => {
            console.log(`  ${col.Field}: ${col.Type}`);
        });
        
        console.log('\n🔍 Pose-related columns:');
        const poseColumns = columns.filter(col => 
            col.Field.includes('pose') || 
            col.Field.includes('risk') || 
            col.Field.includes('assessment')
        );
        
        if (poseColumns.length === 0) {
            console.log('❌ No pose-related columns found!');
        } else {
            poseColumns.forEach(col => {
                console.log(`  ✓ ${col.Field}: ${col.Type}`);
            });
        }
        
        // Test simple insert
        console.log('\n🧪 Testing simple INSERT via server connection:');
        const testQuery = `
            INSERT INTO content_moderation (
                image_path, model_id, nudity_score, detected_parts,
                part_locations, moderation_status, human_review_required,
                flagged, final_location
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const testValues = [
            '/test/servertest.jpg',
            1,
            75.5,
            JSON.stringify({"FACE": 80}),
            JSON.stringify({"FACE": {"x": 100, "y": 100, "width": 200, "height": 200}}),
            'flagged',
            1,
            1,
            'originals'
        ];
        
        const result = await db.query(testQuery, testValues);
        console.log(`✅ Simple INSERT successful, affected rows: ${result.affectedRows}`);
        
        // Clean up
        await db.query('DELETE FROM content_moderation WHERE image_path = ?', ['/test/servertest.jpg']);
        console.log('🧹 Test record cleaned up');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('SQL State:', error.sqlState);
        console.error('Error Code:', error.code);
    }
}

testServerDatabase().then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
}).catch(error => {
    console.error('💥 Test script failed:', error);
    process.exit(1);
});