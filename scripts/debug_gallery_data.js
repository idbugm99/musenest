/**
 * Debug Gallery Data Script
 * Check what's actually in the database vs what the gallery shows
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugGalleryData() {
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

        console.log('🔍 Debugging gallery data...');

        // Check model_media_library table
        const [libraryImages] = await connection.execute(`
            SELECT id, model_slug, filename, moderation_status, is_deleted, upload_date
            FROM model_media_library 
            WHERE model_slug = 'modelexample'
            ORDER BY upload_date DESC
            LIMIT 10
        `);

        console.log(`\n📊 model_media_library (${libraryImages.length} items):`);
        console.log('================================');
        if (libraryImages.length === 0) {
            console.log('❌ No images found in model_media_library for modelexample');
        } else {
            libraryImages.forEach(img => {
                console.log(`- ${img.filename}: status=${img.moderation_status}, deleted=${img.is_deleted}`);
            });
        }

        // Check media_review_queue table
        const [queueImages] = await connection.execute(`
            SELECT id, model_name, original_path, review_status
            FROM media_review_queue 
            LIMIT 10
        `);

        console.log(`\n📊 media_review_queue (${queueImages.length} items):`);
        console.log('================================');
        if (queueImages.length === 0) {
            console.log('❌ No images found in media_review_queue for modelexample');
        } else {
            queueImages.forEach(img => {
                const filename = img.original_path ? img.original_path.split('/').pop() : 'unknown';
                console.log(`- ${filename}: status=${img.review_status} (model: ${img.model_name})`);
            });
        }

        // Check content_moderation table
        const [moderationImages] = await connection.execute(`
            SELECT id, original_path, moderation_status
            FROM content_moderation 
            LIMIT 10
        `);

        console.log(`\n📊 content_moderation (${moderationImages.length} items):`);
        console.log('================================');
        if (moderationImages.length === 0) {
            console.log('❌ No images found in content_moderation for modelexample');
        } else {
            moderationImages.forEach(img => {
                const filename = img.original_path ? img.original_path.split('/').pop() : 'unknown';
                console.log(`- ${filename}: status=${img.moderation_status}`);
            });
        }

        // Check if there are any models
        const [models] = await connection.execute(`
            SELECT id, slug, name FROM models WHERE slug = 'modelexample'
        `);

        console.log(`\n📊 models table:`);
        console.log('================');
        if (models.length === 0) {
            console.log('❌ No model found with slug "modelexample"');
        } else {
            models.forEach(model => {
                console.log(`- ${model.slug}: ${model.name} (ID: ${model.id})`);
            });
        }

        // Check what model slugs actually exist
        const [allModels] = await connection.execute(`
            SELECT slug, name FROM models ORDER BY slug
        `);

        console.log(`\n📊 All models (${allModels.length} total):`);
        console.log('====================');
        allModels.forEach(model => {
            console.log(`- ${model.slug}: ${model.name}`);
        });

    } catch (error) {
        console.error('❌ Error debugging gallery data:', error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Run the debug
debugGalleryData()
    .then(() => {
        console.log('\n✅ Gallery debug completed!');
        process.exit(0);
    })
    .catch(console.error);