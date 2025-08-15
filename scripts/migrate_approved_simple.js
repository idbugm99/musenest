/**
 * Simple Migration Script - Migrate Approved Images to Gallery
 * Uses only basic columns that exist in model_media_library
 */

const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config();

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

async function migrateApprovedSimple() {
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

        console.log('🔄 Migrating approved images to gallery (simple version)...');

        // Get all approved images from content_moderation
        const [approvedImages] = await connection.execute(`
            SELECT 
                cm.id as moderation_id,
                cm.original_path,
                cm.moderation_status,
                m.slug as model_slug,
                m.name as model_name
            FROM content_moderation cm
            LEFT JOIN models m ON cm.original_path LIKE CONCAT('%/', m.slug, '/%')
            WHERE cm.moderation_status = 'approved'
            AND m.id IS NOT NULL
            ORDER BY cm.original_path
        `);

        console.log(`📊 Found ${approvedImages.length} approved images to migrate`);

        let migratedCount = 0;
        const errors = [];

        for (const img of approvedImages) {
            try {
                const filename = path.basename(img.original_path);
                
                // Check if already exists in gallery
                const [existingCheck] = await connection.execute(`
                    SELECT id FROM model_media_library 
                    WHERE model_slug = ? AND filename = ?
                `, [img.model_slug, filename]);

                if (existingCheck.length > 0) {
                    console.log(`⏭️  Skipped (exists): ${img.model_name}/${filename}`);
                    continue;
                }

                // Generate file path and MIME type
                const filePath = `/uploads/${img.model_slug}/media/${filename}`;
                const fileExtension = path.extname(filename).toLowerCase();
                const mimeType = getMimeType(fileExtension);

                // Insert into model_media_library with all required fields
                await connection.execute(`
                    INSERT INTO model_media_library (
                        model_slug,
                        filename,
                        original_filename,
                        file_path,
                        file_size,
                        mime_type,
                        moderation_status,
                        is_deleted,
                        upload_date
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
                `, [
                    img.model_slug,
                    filename,
                    filename, // original_filename same as filename
                    filePath,
                    0, // file_size = 0 (unknown)
                    mimeType,
                    'approved', // moderation_status
                    0 // is_deleted = false
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
        if (verifyResults.length === 0) {
            console.log('No images in gallery yet');
        } else {
            verifyResults.forEach(result => {
                console.log(`${result.model_slug}: ${result.approved_count}/${result.image_count} images`);
            });
        }

    } catch (error) {
        console.error('❌ Error during migration:', error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Run the migration
migrateApprovedSimple()
    .then(() => {
        console.log('\n🎉 Simple migration completed!');
        console.log('🔄 Refresh the gallery pages - approved images should now be visible!');
        process.exit(0);
    })
    .catch(console.error);