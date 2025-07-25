const sqlite3 = require('sqlite3').verbose();
const { query, transaction } = require('../config/database');
const path = require('path');
const fs = require('fs').promises;

// Configuration
const ROSEMASTOS_DB_PATH = '/Users/programmer/Projects/rosemastos/instance/models.db';
const MUSENEST_DB_PATH = process.env.DB_NAME || 'musenest';

class DataMigrator {
    constructor() {
        this.sourceDb = null;
        this.migrationReport = {
            users: { success: 0, errors: [] },
            models: { success: 0, errors: [] },
            themes: { success: 0, errors: [] },
            site_settings: { success: 0, errors: [] },
            gallery_sections: { success: 0, errors: [] },
            gallery_images: { success: 0, errors: [] },
            faq_items: { success: 0, errors: [] },
            testimonials: { success: 0, errors: [] },
            page_content: { success: 0, errors: [] }
        };
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.sourceDb = new sqlite3.Database(ROSEMASTOS_DB_PATH, (err) => {
                if (err) {
                    console.error('❌ Cannot connect to RoseMastos database:', err.message);
                    reject(err);
                } else {
                    console.log('✅ Connected to RoseMastos database');
                    resolve();
                }
            });
        });
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
        console.log('\n📥 Migrating Users...');
        
        const sourceUsers = await this.querySource(`
            SELECT id, email, password_hash, role, created_at, updated_at, is_active
            FROM users
        `);

        for (const user of sourceUsers) {
            try {
                // Map Flask user roles to MuseNest roles
                let role = 'model';
                if (user.role === 'sysadmin') role = 'sysadmin';
                else if (user.role === 'admin') role = 'admin';

                await query(`
                    INSERT INTO users (id, email, password_hash, role, is_active, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [
                    user.id,
                    user.email,
                    user.password_hash,
                    role,
                    user.is_active || true,
                    user.created_at || new Date().toISOString(),
                    user.updated_at || new Date().toISOString()
                ]);

                this.migrationReport.users.success++;
                console.log(`  ✅ User: ${user.email}`);
            } catch (error) {
                this.migrationReport.users.errors.push({
                    user: user.email,
                    error: error.message
                });
                console.log(`  ❌ User: ${user.email} - ${error.message}`);
            }
        }
    }

    async migrateThemes() {
        console.log('\n🎨 Migrating Themes...');
        
        const sourceThemes = await this.querySource(`
            SELECT id, name, description, primary_color, background_color, text_color, accent_color,
                   preview_color, preview_image, is_active, created_at, updated_at
            FROM color_themes
        `);

        for (const theme of sourceThemes) {
            try {
                // Insert theme
                await query(`
                    INSERT INTO themes (id, name, display_name, description, is_active, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [
                    theme.id,
                    theme.name.toLowerCase().replace(/\s+/g, '_'),
                    theme.name,
                    theme.description,
                    theme.is_active || true,
                    theme.created_at || new Date().toISOString()
                ]);

                // Insert theme colors
                const colors = [
                    { type: 'primary', value: theme.primary_color },
                    { type: 'background', value: theme.background_color },
                    { type: 'text', value: theme.text_color },
                    { type: 'accent', value: theme.accent_color }
                ];

                for (const color of colors) {
                    if (color.value) {
                        await query(`
                            INSERT INTO theme_colors (theme_id, color_type, color_value)
                            VALUES (?, ?, ?)
                        `, [theme.id, color.type, color.value]);
                    }
                }

                this.migrationReport.themes.success++;
                console.log(`  ✅ Theme: ${theme.name}`);
            } catch (error) {
                this.migrationReport.themes.errors.push({
                    theme: theme.name,
                    error: error.message
                });
                console.log(`  ❌ Theme: ${theme.name} - ${error.message}`);
            }
        }
    }

    async migrateModels() {
        console.log('\n🏠 Migrating Models...');
        
        const sourceModels = await this.querySource(`
            SELECT id, name, slug, status, template_id, color_theme_id,
                   stripe_customer_id, stripe_subscription_id, subscription_status,
                   trial_ends_at, next_billing_at, balance_due,
                   created_at, updated_at
            FROM models
        `);

        for (const model of sourceModels) {
            try {
                await query(`
                    INSERT INTO models (id, name, slug, status, stripe_customer_id, stripe_subscription_id,
                                      subscription_status, trial_ends_at, next_billing_at, balance_due,
                                      created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    model.id,
                    model.name,
                    model.slug,
                    model.status || 'trial',
                    model.stripe_customer_id,
                    model.stripe_subscription_id,
                    model.subscription_status,
                    model.trial_ends_at,
                    model.next_billing_at,
                    model.balance_due || 0.00,
                    model.created_at || new Date().toISOString(),
                    model.updated_at || new Date().toISOString()
                ]);

                // Create model-theme relationship if theme exists
                if (model.color_theme_id) {
                    await query(`
                        INSERT INTO model_themes (model_id, theme_id, is_active, applied_at)
                        VALUES (?, ?, true, ?)
                    `, [model.id, model.color_theme_id, new Date().toISOString()]);
                }

                this.migrationReport.models.success++;
                console.log(`  ✅ Model: ${model.name} (${model.slug})`);
            } catch (error) {
                this.migrationReport.models.errors.push({
                    model: model.name,
                    error: error.message
                });
                console.log(`  ❌ Model: ${model.name} - ${error.message}`);
            }
        }
    }

    async migrateSiteSettings() {
        console.log('\n⚙️  Migrating Site Settings...');
        
        const sourceSettings = await this.querySource(`
            SELECT model_id, site_name, model_name, header_image, about_text,
                   contact_email, contact_phone, contact_form_email, contact_subject,
                   city, tagline, watermark_text, watermark_image, favicon_url,
                   twitter_url, instagram_url, onlyfans_url, fansly_url, snapchat_url,
                   telegram_url, whatsapp_url, email_url, phone_url
            FROM site_settings
        `);

        for (const settings of sourceSettings) {
            try {
                await query(`
                    INSERT INTO site_settings (model_id, site_name, model_name, tagline, city,
                                             contact_email, contact_phone, header_image, favicon_url,
                                             watermark_text, watermark_image, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    settings.model_id,
                    settings.site_name || 'Model Portfolio',
                    settings.model_name || 'Model',
                    settings.tagline,
                    settings.city,
                    settings.contact_email,
                    settings.contact_phone,
                    settings.header_image,
                    settings.favicon_url,
                    settings.watermark_text,
                    settings.watermark_image,
                    new Date().toISOString(),
                    new Date().toISOString()
                ]);

                this.migrationReport.site_settings.success++;
                console.log(`  ✅ Settings for model ID: ${settings.model_id}`);
            } catch (error) {
                this.migrationReport.site_settings.errors.push({
                    model_id: settings.model_id,
                    error: error.message
                });
                console.log(`  ❌ Settings for model ID: ${settings.model_id} - ${error.message}`);
            }
        }
    }

    async migrateGallerySections() {
        console.log('\n🖼️  Migrating Gallery Sections...');
        
        const sourceSections = await this.querySource(`
            SELECT id, model_id, title, description, layout_type, grid_columns,
                   enable_filters, enable_lightbox, show_captions, is_visible,
                   sort_order, created_at, updated_at
            FROM gallery_section
        `);

        for (const section of sourceSections) {
            try {
                await query(`
                    INSERT INTO gallery_sections (id, model_id, title, description, layout_type,
                                                grid_columns, is_visible, sort_order, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    section.id,
                    section.model_id,
                    section.title,
                    section.description,
                    section.layout_type || 'grid',
                    section.grid_columns || 3,
                    section.is_visible !== false,
                    section.sort_order || 0,
                    section.created_at || new Date().toISOString()
                ]);

                this.migrationReport.gallery_sections.success++;
                console.log(`  ✅ Gallery Section: ${section.title}`);
            } catch (error) {
                this.migrationReport.gallery_sections.errors.push({
                    section: section.title,
                    error: error.message
                });
                console.log(`  ❌ Gallery Section: ${section.title} - ${error.message}`);
            }
        }
    }

    async migrateGalleryImages() {
        console.log('\n📷 Migrating Gallery Images...');
        
        const sourceImages = await this.querySource(`
            SELECT id, model_id, section_id, filename, caption, tags,
                   is_featured, order_index, is_active, created_at
            FROM gallery_image
        `);

        for (const image of sourceImages) {
            try {
                await query(`
                    INSERT INTO gallery_images (id, model_id, section_id, filename, caption,
                                              is_featured, is_active, sort_order, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    image.id,
                    image.model_id,
                    image.section_id,
                    image.filename,
                    image.caption,
                    image.is_featured || false,
                    image.is_active !== false,
                    image.order_index || 0,
                    image.created_at || new Date().toISOString()
                ]);

                // Handle tags - split comma-separated tags and create proper relationships
                if (image.tags) {
                    const tagNames = image.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
                    
                    for (const tagName of tagNames) {
                        // Create tag if it doesn't exist
                        const slug = tagName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                        
                        // Insert tag if it doesn't exist (MySQL compatible)
                        await query(`
                            INSERT INTO image_tags (name, slug, created_at)
                            VALUES (?, ?, ?)
                            ON DUPLICATE KEY UPDATE name = name
                        `, [tagName, slug, new Date().toISOString()]);

                        // Get tag ID
                        const tagResult = await query(`
                            SELECT id FROM image_tags WHERE slug = ?
                        `, [slug]);

                        if (tagResult.length > 0) {
                            // Create image-tag relationship (MySQL compatible)
                            await query(`
                                INSERT INTO image_tag_assignments (image_id, tag_id)
                                VALUES (?, ?)
                                ON DUPLICATE KEY UPDATE image_id = image_id
                            `, [image.id, tagResult[0].id]);
                        }
                    }
                }

                this.migrationReport.gallery_images.success++;
                console.log(`  ✅ Image: ${image.filename}`);
            } catch (error) {
                this.migrationReport.gallery_images.errors.push({
                    image: image.filename,
                    error: error.message
                });
                console.log(`  ❌ Image: ${image.filename} - ${error.message}`);
            }
        }
    }

    async migrateFAQItems() {
        console.log('\n❓ Migrating FAQ Items...');
        
        const sourceFAQs = await this.querySource(`
            SELECT id, model_id, question, answer, sort_order, is_visible, created_at, updated_at
            FROM faq_items
        `);

        for (const faq of sourceFAQs) {
            try {
                await query(`
                    INSERT INTO faq_items (id, model_id, question, answer, sort_order,
                                         is_visible, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    faq.id,
                    faq.model_id,
                    faq.question,
                    faq.answer,
                    faq.sort_order || 0,
                    faq.is_visible !== false,
                    faq.created_at || new Date().toISOString(),
                    faq.updated_at || new Date().toISOString()
                ]);

                this.migrationReport.faq_items.success++;
                console.log(`  ✅ FAQ: ${faq.question.substring(0, 50)}...`);
            } catch (error) {
                this.migrationReport.faq_items.errors.push({
                    faq: faq.question.substring(0, 50),
                    error: error.message
                });
                console.log(`  ❌ FAQ: ${faq.question.substring(0, 50)}... - ${error.message}`);
            }
        }
    }

    async migrateTestimonials() {
        console.log('\n💬 Migrating Testimonials...');
        
        const sourceTestimonials = await this.querySource(`
            SELECT id, model_id, client_name, testimonial_text, rating,
                   is_featured, is_active, created_at
            FROM testimonial
        `);

        for (const testimonial of sourceTestimonials) {
            try {
                await query(`
                    INSERT INTO testimonials (id, model_id, client_name, testimonial_text,
                                            rating, is_featured, is_active, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    testimonial.id,
                    testimonial.model_id,
                    testimonial.client_name,
                    testimonial.testimonial_text,
                    testimonial.rating,
                    testimonial.is_featured || false,
                    testimonial.is_active !== false,
                    testimonial.created_at || new Date().toISOString()
                ]);

                this.migrationReport.testimonials.success++;
                console.log(`  ✅ Testimonial from: ${testimonial.client_name || 'Anonymous'}`);
            } catch (error) {
                this.migrationReport.testimonials.errors.push({
                    testimonial: testimonial.client_name || 'Anonymous',
                    error: error.message
                });
                console.log(`  ❌ Testimonial from: ${testimonial.client_name || 'Anonymous'} - ${error.message}`);
            }
        }
    }

    async generateMigrationReport() {
        console.log('\n📊 Migration Report');
        console.log('==================');
        
        let totalSuccess = 0;
        let totalErrors = 0;

        Object.keys(this.migrationReport).forEach(table => {
            const { success, errors } = this.migrationReport[table];
            totalSuccess += success;
            totalErrors += errors.length;
            
            console.log(`${table.padEnd(20)}: ${success} success, ${errors.length} errors`);
            
            if (errors.length > 0) {
                console.log(`  Errors for ${table}:`);
                errors.forEach(error => {
                    console.log(`    - ${error.error}`);
                });
            }
        });

        console.log('==================');
        console.log(`Total Success: ${totalSuccess}`);
        console.log(`Total Errors: ${totalErrors}`);
        
        // Save detailed report to file
        const reportPath = path.join(__dirname, '../migration-report.json');
        await fs.writeFile(reportPath, JSON.stringify(this.migrationReport, null, 2));
        console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    }

    async run() {
        try {
            console.log('🚀 Starting MuseNest Data Migration');
            console.log('====================================');
            
            await this.connect();
            
            // Run migrations in order (respecting foreign key constraints)
            await this.migrateUsers();
            await this.migrateThemes();
            await this.migrateModels();
            await this.migrateSiteSettings();
            await this.migrateGallerySections();
            await this.migrateGalleryImages();
            await this.migrateFAQItems();
            await this.migrateTestimonials();
            
            await this.generateMigrationReport();
            
            console.log('\n🎉 Migration completed!');
            
        } catch (error) {
            console.error('💥 Migration failed:', error);
            throw error;
        } finally {
            if (this.sourceDb) {
                this.sourceDb.close();
            }
        }
    }
}

// Run migration if called directly
if (require.main === module) {
    const migrator = new DataMigrator();
    migrator.run()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}

module.exports = DataMigrator;