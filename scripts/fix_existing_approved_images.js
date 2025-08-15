/**
 * Fix Existing Approved Images Script
 * Updates model_media_library status for images that were already approved via media review queue
 * but still show as "pending" in the gallery due to missing sync between tables
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixExistingApprovedImages() {
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

        console.log('🔧 Finding images that were approved in media review queue but still pending in gallery...');

        // Find images that are approved in content_moderation but still pending in model_media_library
        const [mismatchedImages] = await connection.execute(`
            SELECT 
                cm.id as content_moderation_id,
                cm.original_path,
                cm.moderation_status as cm_status,
                mml.id as library_id,
                mml.model_slug,
                mml.filename,
                mml.moderation_status as library_status
            FROM content_moderation cm
            LEFT JOIN model_media_library mml ON (
                mml.filename LIKE CONCAT('%', SUBSTRING_INDEX(cm.original_path, '/', -1))
                OR cm.original_path LIKE CONCAT('%', mml.filename)
            )
            WHERE cm.moderation_status = 'approved' 
            AND (mml.moderation_status IS NULL OR mml.moderation_status = 'pending')
            AND mml.id IS NOT NULL
        `);

        console.log(`📊 Found ${mismatchedImages.length} images with status mismatch`);

        if (mismatchedImages.length === 0) {
            console.log('✅ No mismatched images found - all gallery statuses are already in sync!');
            return;
        }

        // Display the mismatched images
        console.log('\n🔍 Mismatched Images:');
        console.log('====================');
        mismatchedImages.forEach(img => {
            console.log(`- ${img.model_slug}: ${img.filename}`);
            console.log(`  Content Moderation: ${img.cm_status} | Gallery: ${img.library_status || 'null'}`);
            console.log(`  Library ID: ${img.library_id}`);
        });

        // Update the model_media_library table for these images
        console.log('\n🔄 Updating gallery statuses...');
        let updatedCount = 0;

        for (const img of mismatchedImages) {
            const [updateResult] = await connection.execute(`
                UPDATE model_media_library 
                SET moderation_status = 'approved'
                WHERE id = ?
            `, [img.library_id]);

            if (updateResult.affectedRows > 0) {
                updatedCount++;
                console.log(`✅ Updated ${img.model_slug}/${img.filename} to 'approved'`);
            } else {
                console.log(`❌ Failed to update ${img.model_slug}/${img.filename}`);
            }
        }

        console.log(`\n📈 Summary: Updated ${updatedCount} out of ${mismatchedImages.length} images`);

        // Verify the fixes
        const [verifyResults] = await connection.execute(`
            SELECT 
                COUNT(*) as total_approved_cm,
                COUNT(CASE WHEN mml.moderation_status = 'approved' THEN 1 END) as synced_gallery,
                COUNT(CASE WHEN mml.moderation_status != 'approved' OR mml.moderation_status IS NULL THEN 1 END) as still_mismatched
            FROM content_moderation cm
            LEFT JOIN model_media_library mml ON (
                mml.filename LIKE CONCAT('%', SUBSTRING_INDEX(cm.original_path, '/', -1))
                OR cm.original_path LIKE CONCAT('%', mml.filename)
            )
            WHERE cm.moderation_status = 'approved' 
            AND mml.id IS NOT NULL
        `);

        const stats = verifyResults[0];
        console.log('\n📊 Final Status:');
        console.log('================');
        console.log(`Total approved images: ${stats.total_approved_cm}`);
        console.log(`Gallery status synced: ${stats.synced_gallery}`);
        console.log(`Still mismatched: ${stats.still_mismatched}`);

        if (stats.still_mismatched > 0) {
            console.log('\n⚠️ Some images are still mismatched - may need manual review');
        } else {
            console.log('\n🎉 All gallery statuses are now in sync!');
        }

    } catch (error) {
        console.error('❌ Error fixing existing approved images:', error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Run the fix
fixExistingApprovedImages()
    .then(() => {
        console.log('\n✅ Existing approved images fix completed!');
        console.log('🔄 Refresh the gallery page to see the updated statuses.');
        process.exit(0);
    })
    .catch(console.error);