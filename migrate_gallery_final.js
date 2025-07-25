const { query } = require('./config/database');
const sqlite3 = require('sqlite3').verbose();

class GalleryMigratorFinal {
    constructor() {
        this.sourceDb = new sqlite3.Database('/Users/programmer/Projects/rosemastos/instance/models.db');
    }

    async querySource(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.sourceDb.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    async migrateGalleryImages() {
        console.log('🖼️  Migrating Gallery Images...');
        
        // Get gallery images from RoseMastos
        const sourceImages = await this.querySource(`
            SELECT id, filename, caption, category, is_featured, order_index, is_active, model_id, section_id
            FROM gallery_image
        `);

        console.log(`Found ${sourceImages.length} gallery images to migrate`);

        // Create gallery sections for each model first
        const models = await query('SELECT id FROM models');
        
        for (const model of models) {
            try {
                await query(`
                    INSERT IGNORE INTO gallery_sections (id, model_id, title, sort_order, is_visible, created_at)
                    VALUES (?, ?, 'Main Gallery', 1, true, NOW())
                `, [model.id, model.id]);
                console.log(`  ✅ Created gallery section for model ${model.id}`);
            } catch (error) {
                console.log(`  ⚠️  Gallery section for model ${model.id} already exists`);
            }
        }

        // Migrate gallery images
        for (const image of sourceImages) {
            try {
                await query(`
                    INSERT IGNORE INTO gallery_images (
                        id, model_id, section_id, filename, original_filename, caption, 
                        alt_text, sort_order, is_active, is_featured, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                `, [
                    image.id,
                    image.model_id,
                    image.section_id || image.model_id, // Use existing section_id or fallback to model_id
                    image.filename,
                    image.filename, // Use filename as original_filename
                    image.caption || '',
                    image.caption || '', // Use caption as alt_text
                    image.order_index || 0,
                    image.is_active !== false, // Convert to boolean, default true
                    image.is_featured || false
                ]);
                console.log(`  ✅ Image: ${image.filename} (Model ${image.model_id})`);
            } catch (error) {
                console.log(`  ❌ Image: ${image.filename} - ${error.message}`);
            }
        }
    }

    async run() {
        try {
            console.log('🚀 Starting Gallery Migration (Final)\n');
            
            await this.migrateGalleryImages();
            
            console.log('\n✅ Migration completed successfully!');
            
            // Show final counts
            const imageCount = await query('SELECT COUNT(*) as count FROM gallery_images');
            
            console.log(`\n📊 Final counts:`);
            console.log(`   Gallery Images: ${imageCount[0].count}`);
            
        } catch (error) {
            console.error('❌ Migration failed:', error);
        } finally {
            this.sourceDb.close();
        }
    }
}

// Run the migration
const migrator = new GalleryMigratorFinal();
migrator.run().then(() => {
    console.log('🏁 Migration process finished');
    process.exit(0);
}).catch(error => {
    console.error('💥 Migration process failed:', error);
    process.exit(1);
});