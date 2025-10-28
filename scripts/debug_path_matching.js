/**
 * Debug Path Matching Script
 * Check how content_moderation paths match with gallery_images filenames
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugPathMatching() {
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

        console.log('🔍 Debugging path matching between content_moderation and gallery_images...');

        // Get gallery images for modelexample
        const [galleryImages] = await connection.execute(`
            SELECT gi.id, gi.filename, gi.model_id
            FROM gallery_images gi
            JOIN models m ON gi.model_id = m.id
            WHERE m.slug = 'modelexample'
            LIMIT 5
        `);

        console.log(`\n📊 Gallery Images (${galleryImages.length}):`)
        console.log('==================');
        galleryImages.forEach(img => {
            console.log(`- ID ${img.id}: ${img.filename} (model_id: ${img.model_id})`);
        });

        // Get content_moderation entries
        const [moderationEntries] = await connection.execute(`
            SELECT cm.id, cm.original_path, cm.final_location, cm.image_path, cm.moderation_status, cm.model_id
            FROM content_moderation cm
            WHERE cm.moderation_status = 'approved'
            LIMIT 10
        `);

        console.log(`\n📊 Content Moderation Entries (${moderationEntries.length}):`)
        console.log('=====================================');
        moderationEntries.forEach(entry => {
            console.log(`- ID ${entry.id} (model_id: ${entry.model_id}): ${entry.moderation_status}`);
            console.log(`  original_path: ${entry.original_path}`);
            console.log(`  final_location: ${entry.final_location}`);
            console.log(`  image_path: ${entry.image_path}`);
            console.log('');
        });

        // Test the actual JOIN that the gallery API uses
        console.log('\n🔗 Testing JOIN Query (same as gallery API):');
        console.log('============================================');
        const [joinResults] = await connection.execute(`
            SELECT 
                gi.id as gallery_id,
                gi.filename,
                gi.model_id,
                cm.id as moderation_id,
                cm.moderation_status,
                cm.original_path,
                cm.final_location,
                cm.image_path
            FROM gallery_images gi
            JOIN models m ON gi.model_id = m.id
            LEFT JOIN content_moderation cm ON (
                cm.model_id = gi.model_id 
                AND (cm.image_path LIKE CONCAT('%/', gi.filename) OR cm.final_location LIKE CONCAT('%/', gi.filename))
            )
            WHERE m.slug = 'modelexample'
            LIMIT 10
        `);

        joinResults.forEach(result => {
            console.log(`Gallery ${result.gallery_id}: ${result.filename}`);
            console.log(`  Moderation Status: ${result.moderation_status || 'NULL'}`);
            if (result.moderation_id) {
                console.log(`  Matched with moderation ${result.moderation_id}`);
                console.log(`  original_path: ${result.original_path}`);
                console.log(`  final_location: ${result.final_location}`);
                console.log(`  image_path: ${result.image_path}`);
            } else {
                console.log(`  ❌ NO MATCH FOUND IN content_moderation`);
            }
            console.log('');
        });

        // Test a simpler join based on filename only
        console.log('\n🔗 Testing Simple Filename Match:');
        console.log('==================================');
        const [simpleJoin] = await connection.execute(`
            SELECT 
                gi.filename,
                cm.moderation_status,
                cm.original_path
            FROM gallery_images gi
            JOIN models m ON gi.model_id = m.id
            LEFT JOIN content_moderation cm ON cm.original_path LIKE CONCAT('%', gi.filename)
            WHERE m.slug = 'modelexample'
            LIMIT 10
        `);

        simpleJoin.forEach(result => {
            console.log(`${result.filename} -> ${result.moderation_status || 'NULL'} (${result.original_path || 'no path'})`);
        });

    } catch (error) {
        console.error('❌ Error debugging path matching:', error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Run the debug
debugPathMatching()
    .then(() => {
        console.log('\n✅ Path matching debug completed!');
        process.exit(0);
    })
    .catch(console.error);