/**
 * Migrate Approved Images to Gallery Script
 * Moves approved images from content_moderation into model_media_library table
 * so they show up in the gallery interface
 */

const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();

async function migrateApprovedToGallery() {
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

        console.log('🔄 Migrating approved images to gallery...');

        // Get all approved images from content_moderation that aren't already in model_media_library
        const [approvedImages] = await connection.execute(`
            SELECT 
                cm.id as moderation_id,
                cm.original_path,
                cm.moderation_status,
                cm.final_location,
                cm.nudity_score,
                m.slug as model_slug,
                m.name as model_name
            FROM content_moderation cm
            LEFT JOIN models m ON cm.original_path LIKE CONCAT('%/', m.slug, '/%')
            LEFT JOIN model_media_library mml ON (
                mml.model_slug = m.slug 
                AND mml.filename = SUBSTRING_INDEX(cm.original_path, '/', -1)
            )
            WHERE cm.moderation_status = 'approved'
            AND mml.id IS NULL
            AND m.id IS NOT NULL
            ORDER BY cm.original_path
        `);

        console.log(`📊 Found ${approvedImages.length} approved images to migrate`);

        if (approvedImages.length === 0) {
            console.log('✅ No images need migration - all approved images are already in gallery!');
            return;
        }

        // Display what we're about to migrate
        console.log('\n🔍 Images to Migrate:');
        console.log('=====================');
        const modelCounts = {};
        approvedImages.forEach(img => {
            const filename = path.basename(img.original_path);
            console.log(`- ${img.model_name}: ${filename} (nudity: ${img.nudity_score}%)`);
            modelCounts[img.model_name] = (modelCounts[img.model_name] || 0) + 1;
        });

        console.log('\n📈 Migration Summary:');
        Object.entries(modelCounts).forEach(([model, count]) => {
            console.log(`- ${model}: ${count} images`);
        });

        // Migrate each image
        console.log('\n🔄 Starting migration...');
        let migratedCount = 0;
        const errors = [];

        for (const img of approvedImages) {
            try {
                const filename = path.basename(img.original_path);
                const fileExtension = path.extname(filename).toLowerCase();
                
                // Generate file URLs
                const fileUrl = `/uploads/${img.model_slug}/media/${filename}`;
                const thumbnailUrl = `/uploads/${img.model_slug}/media/thumbs/${filename}`;
                
                // Get file stats if file exists
                let fileSize = null;
                let imageDimensions = null;
                try {
                    const fullPath = path.join(process.cwd(), 'public', fileUrl);
                    const stats = await fs.stat(fullPath);
                    fileSize = stats.size;
                } catch (e) {
                    // File might not exist, continue anyway
                    console.log(`⚠️ File not found: ${fileUrl}`);
                }

                // Insert into model_media_library
                await connection.execute(`
                    INSERT INTO model_media_library (
                        model_slug,
                        filename,
                        original_filename,
                        file_path,
                        file_size,
                        mime_type,
                        image_width,
                        image_height,
                        moderation_status,
                        nudity_score,
                        is_deleted,
                        upload_date,
                        created_at,
                        updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())
                `, [
                    img.model_slug,
                    filename,
                    filename, // original_filename same as filename
                    fileUrl,
                    fileSize || 0,
                    getMimeType(fileExtension),
                    null, // image_width - could be extracted if needed
                    null, // image_height - could be extracted if needed  
                    'approved', // moderation_status
                    parseFloat(img.nudity_score) || 0.0,
                    0, // is_deleted = false
                ]);

                migratedCount++;
                console.log(`✅ Migrated: ${img.model_name}/${filename}`);

            } catch (error) {
                const filename = path.basename(img.original_path);
                console.error(`❌ Failed to migrate ${img.model_name}/${filename}:`, error.message);
                errors.push(`${img.model_name}/${filename}: ${error.message}`);
            }
        }

        // Summary
        console.log(`\n📊 Migration Results:`);
        console.log('===================');
        console.log(`✅ Successfully migrated: ${migratedCount}`);
        console.log(`❌ Failed migrations: ${errors.length}`);
        console.log(`📈 Success rate: ${((migratedCount / approvedImages.length) * 100).toFixed(1)}%`);

        if (errors.length > 0) {
            console.log('\n❌ Migration Errors:');
            errors.forEach(error => console.log(`  - ${error}`));
        }

        // Verify the migration
        const [verifyResults] = await connection.execute(`
            SELECT 
                model_slug,
                COUNT(*) as image_count,
                COUNT(CASE WHEN moderation_status = 'approved' THEN 1 END) as approved_count
            FROM model_media_library
            GROUP BY model_slug
            ORDER BY model_slug
        `);

        console.log('\n📊 Final Gallery Contents:');
        console.log('==========================');
        verifyResults.forEach(result => {
            console.log(`${result.model_slug}: ${result.approved_count}/${result.image_count} images`);
        });

    } catch (error) {
        console.error('❌ Error during migration:', error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Helper function to determine MIME type from file extension
function getMimeType(extension) {
    const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg', 
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp',
        '.tiff': 'image/tiff'
    };
    return mimeTypes[extension] || 'image/jpeg';
}

// Run the migration
migrateApprovedToGallery()
    .then(() => {
        console.log('\n🎉 Migration completed successfully!');
        console.log('🔄 Refresh the gallery pages - approved images should now be visible!');
        process.exit(0);
    })
    .catch(console.error);