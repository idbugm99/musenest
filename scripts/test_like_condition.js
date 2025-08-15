/**
 * Test LIKE Condition Script
 * Test different LIKE conditions to see which one matches properly
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function testLikeCondition() {
    let connection;
    
    try {
        // Create database connection
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'musenest',
            charset: 'utf8mb4'
        });

        console.log('🔍 Testing LIKE conditions...');

        // Test exact filename match for a specific example
        const testFilename = 'AmandaChat_1754767723005.png';
        
        console.log(`\nTesting filename: ${testFilename}`);
        console.log('========================================');

        // Test 1: Current condition (CONCAT('%', filename))
        const [test1] = await connection.execute(`
            SELECT cm.id, cm.moderation_status, cm.original_path
            FROM content_moderation cm
            WHERE cm.model_id = 39 
              AND cm.original_path LIKE CONCAT('%', ?)
        `, [testFilename]);

        console.log(`Test 1 - LIKE CONCAT('%', filename):`);
        console.log(`  Results: ${test1.length}`);
        test1.forEach(r => console.log(`  - ${r.moderation_status}: ${r.original_path}`));

        // Test 2: LIKE with % at the end too
        const [test2] = await connection.execute(`
            SELECT cm.id, cm.moderation_status, cm.original_path
            FROM content_moderation cm
            WHERE cm.model_id = 39 
              AND cm.original_path LIKE CONCAT('%', ?, '%')
        `, [testFilename]);

        console.log(`\nTest 2 - LIKE CONCAT('%', filename, '%'):`);
        console.log(`  Results: ${test2.length}`);
        test2.forEach(r => console.log(`  - ${r.moderation_status}: ${r.original_path}`));

        // Test 3: Extract just the final part of the original_path and compare
        const [test3] = await connection.execute(`
            SELECT cm.id, cm.moderation_status, cm.original_path,
                   SUBSTRING_INDEX(cm.original_path, '_', -1) AS extracted_filename
            FROM content_moderation cm
            WHERE cm.model_id = 39 
              AND SUBSTRING_INDEX(cm.original_path, '_', -1) = ?
        `, [testFilename]);

        console.log(`\nTest 3 - Extract final part after last underscore:`);
        console.log(`  Results: ${test3.length}`);
        test3.forEach(r => console.log(`  - ${r.moderation_status}: ${r.extracted_filename} from ${r.original_path}`));

        // Test 4: Show the actual original_path values for this model
        const [allPaths] = await connection.execute(`
            SELECT cm.id, cm.moderation_status, cm.original_path
            FROM content_moderation cm
            WHERE cm.model_id = 39
            ORDER BY cm.id
        `);

        console.log(`\nAll content_moderation paths for model_id 39:`);
        console.log('===========================================');
        allPaths.forEach(r => {
            const pathParts = r.original_path.split('/');
            const filename = pathParts[pathParts.length - 1];
            console.log(`  ${filename} (full: ${r.original_path})`);
        });

        // Test 5: Better regex - extract the original filename (after timestamp_)
        const [test5] = await connection.execute(`
            SELECT 
                gi.filename as gallery_filename,
                cm.moderation_status,
                cm.original_path,
                SUBSTRING_INDEX(SUBSTRING_INDEX(cm.original_path, '/', -1), '_', -2) as extracted_original
            FROM gallery_images gi
            JOIN models m ON gi.model_id = m.id
            LEFT JOIN content_moderation cm ON (
                cm.model_id = gi.model_id 
                AND SUBSTRING_INDEX(SUBSTRING_INDEX(cm.original_path, '/', -1), '_', -2) = gi.filename
            )
            WHERE m.slug = 'modelexample'
            AND gi.filename = ?
        `, [testFilename]);

        console.log(`\nTest 5 - Extract original filename (after timestamp_):`);
        console.log(`  Results: ${test5.length}`);
        test5.forEach(r => console.log(`  Gallery: ${r.gallery_filename} -> Moderation: ${r.moderation_status || 'NULL'} (extracted: ${r.extracted_original})`));

    } catch (error) {
        console.error('❌ Error testing LIKE conditions:', error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Run the test
testLikeCondition()
    .then(() => {
        console.log('\n✅ LIKE condition test completed!');
        process.exit(0);
    })
    .catch(console.error);