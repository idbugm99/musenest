const { query } = require('./config/database');
const sqlite3 = require('sqlite3').verbose();

class PageContentMigrator {
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

    async getOrCreatePageType(slug, name) {
        // Check if page type exists
        const existing = await query('SELECT id FROM page_types WHERE slug = ?', [slug]);
        if (existing.length > 0) {
            return existing[0].id;
        }

        // Create new page type
        const result = await query(
            'INSERT INTO page_types (slug, name, created_at) VALUES (?, ?, NOW())',
            [slug, name]
        );
        return result.insertId;
    }

    async migrateHomePageContent() {
        console.log('🏠 Migrating Home Page Content...');
        
        const homeContent = await this.querySource(`
            SELECT * FROM home_page_content
        `);

        const homePageTypeId = await this.getOrCreatePageType('home', 'Home');

        for (const content of homeContent) {
            try {
                // Create main home page
                const pageResult = await query(`
                    INSERT IGNORE INTO pages (
                        model_id, page_type_id, title, subtitle, is_visible, created_at
                    ) VALUES (?, ?, ?, ?, ?, NOW())
                `, [
                    content.model_id,
                    homePageTypeId,
                    content.hero_title || 'Home',
                    content.hero_subtitle || '',
                    true
                ]);

                const pageId = pageResult.insertId || (await query(
                    'SELECT id FROM pages WHERE model_id = ? AND page_type_id = ?',
                    [content.model_id, homePageTypeId]
                ))[0].id;

                // Create page sections for different home content
                const sections = [
                    {
                        title: 'Hero Section',
                        content_type: 'hero',
                        content_data: JSON.stringify({
                            hero_title: content.hero_title,
                            hero_subtitle: content.hero_subtitle,
                            hero_description: content.hero_description,
                            hero_background_image: content.hero_background_image,
                            hero_background_opacity: content.hero_background_opacity
                        }),
                        sort_order: 1,
                        is_visible: content.hero_visible !== false
                    },
                    {
                        title: 'About Section',
                        content_type: 'about',
                        content_data: JSON.stringify({
                            about_title: content.about_title,
                            about_paragraph_1: content.about_paragraph_1,
                            about_paragraph_2: content.about_paragraph_2
                        }),
                        sort_order: 2,
                        is_visible: content.about_visible !== false
                    },
                    {
                        title: 'Gallery Section',
                        content_type: 'gallery',
                        content_data: JSON.stringify({
                            gallery_section_title: content.gallery_section_title,
                            gallery_section_id: content.gallery_section_id
                        }),
                        sort_order: 3,
                        is_visible: content.gallery_visible !== false
                    },
                    {
                        title: 'Testimonials Section',
                        content_type: 'testimonials',
                        content_data: JSON.stringify({
                            testimonials_section_title: content.testimonials_section_title,
                            testimonials_count: content.testimonials_count || 3
                        }),
                        sort_order: 4,
                        is_visible: content.testimonials_visible !== false
                    }
                ];

                for (const section of sections) {
                    await query(`
                        INSERT IGNORE INTO page_sections (
                            page_id, section_type, section_key, title, content, sort_order, is_visible
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    `, [
                        pageId,
                        'text', // Default to text type
                        section.content_type, // Use as section_key
                        section.title,
                        section.content_data,
                        section.sort_order,
                        section.is_visible
                    ]);
                }

                console.log(`  ✅ Home content for model ${content.model_id}`);
            } catch (error) {
                console.log(`  ❌ Home content for model ${content.model_id} - ${error.message}`);
            }
        }
    }

    async migrateAboutPageContent() {
        console.log('👤 Migrating About Page Content...');
        
        const aboutContent = await this.querySource(`
            SELECT * FROM about_page_content
        `);

        const aboutPageTypeId = await this.getOrCreatePageType('about', 'About');

        for (const content of aboutContent) {
            try {
                // Create main about page
                const pageResult = await query(`
                    INSERT IGNORE INTO pages (
                        model_id, page_type_id, title, subtitle, is_visible, created_at
                    ) VALUES (?, ?, ?, ?, ?, NOW())
                `, [
                    content.model_id,
                    aboutPageTypeId,
                    content.page_title || 'About',
                    '',
                    content.page_title_visible !== false
                ]);

                const pageId = pageResult.insertId || (await query(
                    'SELECT id FROM pages WHERE model_id = ? AND page_type_id = ?',
                    [content.model_id, aboutPageTypeId]
                ))[0].id;

                // Create detailed page sections for about content
                const sections = [
                    {
                        title: 'Main Content',
                        content_type: 'text',
                        content_data: JSON.stringify({
                            paragraph_1: content.main_paragraph_1,
                            paragraph_2: content.main_paragraph_2,
                            paragraph_3: content.main_paragraph_3,
                            paragraph_4: content.main_paragraph_4
                        }),
                        sort_order: 1,
                        is_visible: content.main_content_visible !== false
                    },
                    {
                        title: 'Services',
                        content_type: 'services',
                        content_data: JSON.stringify({
                            services_title: content.services_title,
                            service_1: content.service_1,
                            service_2: content.service_2,
                            service_3: content.service_3,
                            service_4: content.service_4,
                            service_5: content.service_5
                        }),
                        sort_order: 2,
                        is_visible: content.services_visible !== false
                    },
                    {
                        title: 'Interests',
                        content_type: 'interests',
                        content_data: JSON.stringify({
                            interests_title: content.interests_title,
                            interests: content.interests
                        }),
                        sort_order: 3,
                        is_visible: content.interests_visible !== false
                    },
                    {
                        title: 'Quick Facts',
                        content_type: 'facts',
                        content_data: JSON.stringify({
                            facts_title: content.facts_title,
                            fact_age: content.fact_age,
                            fact_height: content.fact_height,
                            fact_languages: content.fact_languages,
                            fact_education: content.fact_education,
                            fact_availability: content.fact_availability,
                            custom_facts: content.custom_facts,
                            age_visible: content.fact_age_visible,
                            height_visible: content.fact_height_visible,
                            languages_visible: content.fact_languages_visible,
                            education_visible: content.fact_education_visible,
                            availability_visible: content.fact_availability_visible,
                            custom_facts_visible: content.custom_facts_visible
                        }),
                        sort_order: 4,
                        is_visible: true
                    },
                    {
                        title: 'Portrait',
                        content_type: 'portrait',
                        content_data: JSON.stringify({
                            portrait_image_id: content.portrait_image_id,
                            portrait_alt: content.portrait_alt
                        }),
                        sort_order: 5,
                        is_visible: content.portrait_visible !== false
                    },
                    {
                        title: 'Call to Action',
                        content_type: 'cta',
                        content_data: JSON.stringify({
                            cta_title: content.cta_title,
                            cta_description: content.cta_description,
                            cta_button_1_text: content.cta_button_1_text,
                            cta_button_1_link: content.cta_button_1_link,
                            cta_button_2_text: content.cta_button_2_text,
                            cta_button_2_link: content.cta_button_2_link
                        }),
                        sort_order: 6,
                        is_visible: content.about_cta_visible !== false
                    }
                ];

                for (const section of sections) {
                    await query(`
                        INSERT IGNORE INTO page_sections (
                            page_id, section_type, section_key, title, content, sort_order, is_visible
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    `, [
                        pageId,
                        'text', // Default to text type
                        section.content_type, // Use as section_key
                        section.title,
                        section.content_data,
                        section.sort_order,
                        section.is_visible
                    ]);
                }

                console.log(`  ✅ About content for model ${content.model_id} - "${content.page_title}"`);
            } catch (error) {
                console.log(`  ❌ About content for model ${content.model_id} - ${error.message}`);
            }
        }
    }

    async migrateContactPageContent() {
        console.log('📞 Migrating Contact Page Content...');
        
        const contactContent = await this.querySource(`
            SELECT * FROM contact_page_content
        `);

        const contactPageTypeId = await this.getOrCreatePageType('contact', 'Contact');

        for (const content of contactContent) {
            try {
                // Create main contact page
                const pageResult = await query(`
                    INSERT IGNORE INTO pages (
                        model_id, page_type_id, title, subtitle, is_visible, created_at
                    ) VALUES (?, ?, ?, ?, ?, NOW())
                `, [
                    content.model_id,
                    contactPageTypeId,
                    content.page_title || 'Contact',
                    '',
                    true
                ]);

                const pageId = pageResult.insertId || (await query(
                    'SELECT id FROM pages WHERE model_id = ? AND page_type_id = ?',
                    [content.model_id, contactPageTypeId]
                ))[0].id;

                // Create contact page sections
                const sections = [
                    {
                        title: 'Main Content',
                        content_type: 'text',
                        content_data: JSON.stringify({
                            main_paragraph_1: content.main_paragraph_1,
                            main_paragraph_2: content.main_paragraph_2,
                            contact_instructions: content.contact_instructions
                        }),
                        sort_order: 1,
                        is_visible: true
                    },
                    {
                        title: 'Contact Form',
                        content_type: 'contact_form',
                        content_data: JSON.stringify({
                            form_title: content.form_title,
                            form_description: content.form_description,
                            submit_button_text: content.submit_button_text
                        }),
                        sort_order: 2,
                        is_visible: content.contact_form_visible !== false
                    },
                    {
                        title: 'Calendar Section',
                        content_type: 'calendar',
                        content_data: JSON.stringify({
                            calendar_title: content.calendar_title,
                            calendar_description: content.calendar_description,
                            calendar_button_text: content.calendar_button_text
                        }),
                        sort_order: 3,
                        is_visible: content.calendar_visible !== false
                    }
                ];

                for (const section of sections) {
                    await query(`
                        INSERT IGNORE INTO page_sections (
                            page_id, section_type, section_key, title, content, sort_order, is_visible
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    `, [
                        pageId,
                        'text', // Default to text type
                        section.content_type, // Use as section_key
                        section.title,
                        section.content_data,
                        section.sort_order,
                        section.is_visible
                    ]);
                }

                console.log(`  ✅ Contact content for model ${content.model_id}`);
            } catch (error) {
                console.log(`  ❌ Contact content for model ${content.model_id} - ${error.message}`);
            }
        }
    }

    async migrateEtiquettePageContent() {
        console.log('📋 Migrating Etiquette Page Content...');
        
        try {
            const etiquetteContent = await this.querySource(`
                SELECT * FROM etiquette_page_content
            `);

            if (etiquetteContent.length === 0) {
                console.log('  ⚠️  No etiquette content found');
                return;
            }

            const etiquettePageTypeId = await this.getOrCreatePageType('etiquette', 'Etiquette');

            for (const content of etiquetteContent) {
                try {
                    const pageResult = await query(`
                        INSERT IGNORE INTO pages (
                            model_id, page_type_id, title, subtitle, is_visible, created_at
                        ) VALUES (?, ?, ?, ?, ?, NOW())
                    `, [
                        content.model_id,
                        etiquettePageTypeId,
                        content.page_title || 'Etiquette',
                        '',
                        true
                    ]);

                    const pageId = pageResult.insertId || (await query(
                        'SELECT id FROM pages WHERE model_id = ? AND page_type_id = ?',
                        [content.model_id, etiquettePageTypeId]
                    ))[0].id;

                    // Create etiquette sections
                    const section = {
                        title: 'Etiquette Guidelines',
                        content_type: 'etiquette',
                        content_data: JSON.stringify(content),
                        sort_order: 1,
                        is_visible: true
                    };

                    await query(`
                        INSERT IGNORE INTO page_sections (
                            page_id, section_type, section_key, title, content, sort_order, is_visible
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    `, [
                        pageId,
                        'text', // Default to text type
                        section.content_type, // Use as section_key
                        section.title,
                        section.content_data,
                        section.sort_order,
                        section.is_visible
                    ]);

                    console.log(`  ✅ Etiquette content for model ${content.model_id}`);
                } catch (error) {
                    console.log(`  ❌ Etiquette content for model ${content.model_id} - ${error.message}`);
                }
            }
        } catch (error) {
            console.log('  ⚠️  Etiquette table not found or empty');
        }
    }

    async run() {
        try {
            console.log('🚀 Starting Comprehensive Page Content Migration\n');
            
            await this.migrateHomePageContent();
            await this.migrateAboutPageContent();
            await this.migrateContactPageContent();
            await this.migrateEtiquettePageContent();
            
            console.log('\n✅ Page Content Migration completed successfully!');
            
            // Show final counts
            const pageCounts = await query(`
                SELECT pt.name, COUNT(*) as count 
                FROM pages p 
                JOIN page_types pt ON p.page_type_id = pt.id 
                GROUP BY pt.name
            `);
            
            const sectionCount = await query('SELECT COUNT(*) as count FROM page_sections');
            
            console.log(`\n📊 Final counts:`);
            console.log(`   Page Sections: ${sectionCount[0].count}`);
            for (const pageType of pageCounts) {
                console.log(`   ${pageType.name} Pages: ${pageType.count}`);
            }
            
        } catch (error) {
            console.error('❌ Migration failed:', error);
        } finally {
            this.sourceDb.close();
        }
    }
}

// Run the migration
const migrator = new PageContentMigrator();
migrator.run().then(() => {
    console.log('🏁 Page Content Migration finished');
    process.exit(0);
}).catch(error => {
    console.error('💥 Page Content Migration failed:', error);
    process.exit(1);
});