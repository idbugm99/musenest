const { query } = require('./config/database');
const sqlite3 = require('sqlite3').verbose();

class GalleryMigrator {
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
        
        // Get gallery images from RoseMastos (correct table name: gallery_image)
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
                        id, model_id, section_id, filename, alt_text, caption, 
                        sort_order, is_visible, is_active, is_featured, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                `, [
                    image.id,
                    image.model_id,
                    image.section_id || image.model_id, // Use existing section_id or fallback to model_id
                    image.filename,
                    image.caption || '', // Use caption as alt_text since alt_text doesn't exist in source
                    image.caption || '',
                    image.order_index || 0,
                    true, // Set is_visible to true
                    image.is_active !== false, // Convert to boolean, default true
                    image.is_featured || false
                ]);
                console.log(`  ✅ Image: ${image.filename} (Model ${image.model_id})`);
            } catch (error) {
                console.log(`  ❌ Image: ${image.filename} - ${error.message}`);
            }
        }
    }

    async migrateTestimonials() {
        console.log('💬 Migrating Testimonials...');
        
        // Check if testimonials table exists in RoseMastos
        try {
            const sourceTestimonials = await this.querySource(`
                SELECT id, client_name, client_initial, testimonial_text, rating, model_id, is_featured
                FROM testimonials
            `);

            console.log(`Found ${sourceTestimonials.length} testimonials to migrate`);

            for (const testimonial of sourceTestimonials) {
                try {
                    await query(`
                        INSERT IGNORE INTO testimonials (
                            id, model_id, client_name, client_initial, testimonial_text, 
                            rating, is_featured, is_active, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
                    `, [
                        testimonial.id,
                        testimonial.model_id,
                        testimonial.client_name,
                        testimonial.client_initial,
                        testimonial.testimonial_text,
                        testimonial.rating || 5,
                        testimonial.is_featured || false,
                        true
                    ]);
                    console.log(`  ✅ Testimonial from: ${testimonial.client_name || testimonial.client_initial}`);
                } catch (error) {
                    console.log(`  ❌ Testimonial - ${error.message}`);
                }
            }
        } catch (error) {
            console.log('  ⚠️  No testimonials table found in source database');
        }
    }

    async run() {
        try {
            console.log('🚀 Starting Gallery and Testimonials Migration Fix\n');
            
            await this.migrateGalleryImages();
            await this.migrateTestimonials();
            
            console.log('\n✅ Migration completed successfully!');
            
            // Show final counts
            const imageCount = await query('SELECT COUNT(*) as count FROM gallery_images');
            const testimonialCount = await query('SELECT COUNT(*) as count FROM testimonials');
            
            console.log(`\n📊 Final counts:`);
            console.log(`   Gallery Images: ${imageCount[0].count}`);
            console.log(`   Testimonials: ${testimonialCount[0].count}`);
            
        } catch (error) {
            console.error('❌ Migration failed:', error);
        } finally {
            this.sourceDb.close();
        }
    }
}

// Run the migration
const migrator = new GalleryMigrator();
migrator.run().then(() => {
    console.log('🏁 Migration process finished');
    process.exit(0);
}).catch(error => {
    console.error('💥 Migration process failed:', error);
    process.exit(1);
});