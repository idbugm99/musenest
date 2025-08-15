/**
 * Check Gallery Sections Script
 * Check if gallery sections exist and create default section if needed
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkGallerySections() {
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

        console.log('🔍 Checking gallery sections...');

        // Get the modelexample model ID
        const [models] = await connection.execute(`
            SELECT id, slug, name FROM models WHERE slug = 'modelexample'
        `);

        if (models.length === 0) {
            console.log('❌ Model "modelexample" not found');
            return;
        }

        const model = models[0];
        console.log(`📊 Found model: ${model.name} (ID: ${model.id})`);

        // Check gallery sections for this model
        const [sections] = await connection.execute(`
            SELECT id, title, layout_type, is_visible, sort_order, created_at
            FROM gallery_sections 
            WHERE model_id = ?
            ORDER BY sort_order ASC, created_at DESC
        `, [model.id]);

        console.log(`\n📊 Gallery sections for ${model.name}: ${sections.length}`);
        console.log('===============================');
        
        if (sections.length === 0) {
            console.log('❌ No gallery sections found');
            
            // Create a default "Gallery" section
            console.log('\n🔄 Creating default gallery section...');
            const [insertResult] = await connection.execute(`
                INSERT INTO gallery_sections (model_id, title, layout_type, is_visible, sort_order, created_at, updated_at)
                VALUES (?, 'Gallery', 'grid', 1, 0, NOW(), NOW())
            `, [model.id]);

            const newSectionId = insertResult.insertId;
            console.log(`✅ Created default gallery section with ID: ${newSectionId}`);

            // Now check how many images we need to migrate from model_media_library to gallery_images
            const [libraryImages] = await connection.execute(`
                SELECT id, filename, moderation_status, upload_date
                FROM model_media_library 
                WHERE model_slug = 'modelexample' AND moderation_status = 'approved'
                ORDER BY upload_date DESC
            `);

            console.log(`\n📊 Found ${libraryImages.length} approved images in model_media_library to migrate`);

            if (libraryImages.length > 0) {
                console.log('\n🔄 Migrating images from model_media_library to gallery_images...');
                let migratedCount = 0;

                for (const img of libraryImages) {
                    try {
                        // Check if already exists in gallery_images
                        const [existingCheck] = await connection.execute(`
                            SELECT id FROM gallery_images 
                            WHERE model_id = ? AND filename = ?
                        `, [model.id, img.filename]);

                        if (existingCheck.length > 0) {
                            console.log(`⏭️  Skipped (exists): ${img.filename}`);
                            continue;
                        }

                        // Insert into gallery_images
                        await connection.execute(`
                            INSERT INTO gallery_images (
                                section_id, model_id, filename, caption, tags, 
                                is_active, order_index, created_at, updated_at
                            ) VALUES (?, ?, ?, ?, ?, 1, ?, NOW(), NOW())
                        `, [newSectionId, model.id, img.filename, '', '', migratedCount]);

                        migratedCount++;
                        console.log(`✅ Migrated: ${img.filename}`);

                    } catch (error) {
                        console.error(`❌ Failed to migrate ${img.filename}:`, error.message);
                    }
                }

                console.log(`\n📈 Successfully migrated ${migratedCount} images to gallery system`);
            }

        } else {
            sections.forEach(section => {
                console.log(`- ${section.title}: ${section.layout_type} layout (visible: ${section.is_visible})`);
            });

            // Check how many images are in gallery_images for these sections
            const [imageCount] = await connection.execute(`
                SELECT COUNT(*) as count
                FROM gallery_images gi
                WHERE gi.model_id = ?
            `, [model.id]);

            console.log(`\n📊 Images in gallery_images table: ${imageCount[0].count}`);
        }

    } catch (error) {
        console.error('❌ Error checking gallery sections:', error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Run the check
checkGallerySections()
    .then(() => {
        console.log('\n✅ Gallery sections check completed!');
        console.log('🔄 Refresh the gallery page to see the images.');
        process.exit(0);
    })
    .catch(console.error);