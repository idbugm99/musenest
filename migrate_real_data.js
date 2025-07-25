const { query } = require('./config/database');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

class RealDataMigrator {
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

    async migrateUsers() {
        console.log('👤 Migrating Users...');
        
        const sourceUsers = await this.querySource(`
            SELECT id, email, password_hash, role
            FROM users
        `);

        for (const user of sourceUsers) {
            try {
                await query(`
                    INSERT IGNORE INTO users (id, email, password_hash, role, is_active, created_at)
                    VALUES (?, ?, ?, ?, ?, NOW())
                `, [
                    user.id, 
                    user.email, 
                    user.password_hash, 
                    user.role || 'model',
                    true
                ]);
                console.log(`  ✅ User: ${user.email}`);
            } catch (error) {
                console.log(`  ❌ User: ${user.email} - ${error.message}`);
            }
        }
    }

    async migrateModels() {
        console.log('🏠 Migrating Models...');
        
        const sourceModels = await this.querySource(`
            SELECT id, name, slug, status
            FROM models
        `);

        for (const model of sourceModels) {
            try {
                await query(`
                    INSERT IGNORE INTO models (id, name, slug, status, created_at)
                    VALUES (?, ?, ?, ?, NOW())
                `, [
                    model.id,
                    model.name,
                    model.slug,
                    model.status || 'active'
                ]);
                console.log(`  ✅ Model: ${model.name} (${model.slug})`);

                // Connect to first user (admin)
                await query(`
                    INSERT IGNORE INTO model_users (model_id, user_id, role)
                    VALUES (?, 1, 'owner')
                `, [model.id]);

                // Assign glamour theme
                await query(`
                    INSERT IGNORE INTO model_themes (model_id, theme_id, is_active)
                    VALUES (?, 3, true)
                `, [model.id]);

            } catch (error) {
                console.log(`  ❌ Model: ${model.name} - ${error.message}`);
            }
        }
    }

    async migrateSiteSettings() {
        console.log('⚙️  Migrating Site Settings...');
        
        const sourceSettings = await this.querySource(`
            SELECT model_id, site_name, model_name, about_text,
                   contact_email, contact_phone, contact_form_destination as contact_form_email,
                   city, tagline, watermark_text, watermark_image, favicon_url
            FROM site_settings
            WHERE model_id IS NOT NULL
        `);

        for (const setting of sourceSettings) {
            try {
                await query(`
                    INSERT IGNORE INTO site_settings (
                        model_id, site_name, model_name, about_text,
                        contact_email, contact_phone, contact_form_email,
                        city, tagline, watermark_text, watermark_image, favicon_url,
                        created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                `, [
                    setting.model_id,
                    setting.site_name,
                    setting.model_name,
                    setting.about_text,
                    setting.contact_email,
                    setting.contact_phone,
                    setting.contact_form_email,
                    setting.city,
                    setting.tagline,
                    setting.watermark_text,
                    setting.watermark_image,
                    setting.favicon_url
                ]);
                console.log(`  ✅ Settings for model ${setting.model_id}: ${setting.site_name}`);
            } catch (error) {
                console.log(`  ❌ Settings for model ${setting.model_id} - ${error.message}`);
            }
        }
    }

    async migrateFAQItems() {
        console.log('❓ Migrating FAQ Items...');
        
        const sourceFAQs = await this.querySource(`
            SELECT id, model_id, question, answer, sort_order, is_visible
            FROM faq_items
        `);

        for (const faq of sourceFAQs) {
            try {
                await query(`
                    INSERT IGNORE INTO faq_items (id, model_id, question, answer, sort_order, is_visible, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, NOW())
                `, [
                    faq.id,
                    faq.model_id,
                    faq.question,
                    faq.answer,
                    faq.sort_order || 0,
                    faq.is_visible !== 0
                ]);
                console.log(`  ✅ FAQ for model ${faq.model_id}: ${faq.question.substring(0, 50)}...`);
            } catch (error) {
                console.log(`  ❌ FAQ ${faq.id} - ${error.message}`);
            }
        }
    }

    async migrateGalleryImages() {
        console.log('🖼️  Migrating Gallery Images...');
        
        const sourceImages = await this.querySource(`
            SELECT id, model_id, filename, alt_text, caption, sort_order, is_visible
            FROM gallery_images
        `);

        for (const image of sourceImages) {
            try {
                // First ensure section exists
                await query(`
                    INSERT IGNORE INTO gallery_sections (id, model_id, title, sort_order, is_visible, created_at)
                    VALUES (1, ?, 'Main Gallery', 1, true, NOW())
                `, [image.model_id]);

                await query(`
                    INSERT IGNORE INTO gallery_images (id, model_id, section_id, filename, alt_text, caption, sort_order, is_visible, created_at)
                    VALUES (?, ?, 1, ?, ?, ?, ?, ?, NOW())
                `, [
                    image.id,
                    image.model_id,
                    image.filename,
                    image.alt_text,
                    image.caption,
                    image.sort_order || 0,
                    image.is_visible !== 0
                ]);
                console.log(`  ✅ Image for model ${image.model_id}: ${image.filename}`);
            } catch (error) {
                console.log(`  ❌ Image ${image.id} - ${error.message}`);
            }
        }
    }

    async run() {
        console.log('🚀 Starting Real Data Migration from RoseMastos to MuseNest\n');
        
        try {
            // Clear existing test data
            console.log('🧹 Clearing test data...');
            await query('DELETE FROM faq_items WHERE model_id IN (1,2)');
            await query('DELETE FROM site_settings WHERE model_id IN (1,2)');
            await query('DELETE FROM model_themes WHERE model_id IN (1,2)');
            await query('DELETE FROM model_users WHERE model_id IN (1,2)');
            await query('DELETE FROM models WHERE id IN (1,2)');
            
            // Migrate real data
            await this.migrateUsers();
            await this.migrateModels();
            await this.migrateSiteSettings();
            await this.migrateFAQItems();
            await this.migrateGalleryImages();
            
            console.log('\n✅ Real data migration completed successfully!');
            console.log('📊 Test your models at:');
            console.log('  - http://localhost:3000/modelexample/');
            console.log('  - http://localhost:3000/escortmodel/');
            console.log('  - http://localhost:3000/camgirl/');
            
        } catch (error) {
            console.error('\n❌ Migration failed:', error);
        } finally {
            this.sourceDb.close();
            process.exit(0);
        }
    }
}

const migrator = new RealDataMigrator();
migrator.run();