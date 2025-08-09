const { query } = require('./config/database');

async function createContentTables() {
    console.log('🔄 Creating dedicated page content tables...');
    
    const tables = [
        {
            name: 'model_home_page_content',
            sql: `CREATE TABLE IF NOT EXISTS model_home_page_content (
                id INT AUTO_INCREMENT PRIMARY KEY,
                model_id INT NOT NULL,
                
                -- Hero Section
                hero_section_visible BOOLEAN NOT NULL DEFAULT TRUE,
                hero_title VARCHAR(255) NULL,
                hero_subtitle TEXT NULL,
                hero_background_image_id INT NULL,
                hero_background_opacity DECIMAL(3,2) DEFAULT 0.6,
                hero_button_1_text VARCHAR(100) NULL,
                hero_button_1_link VARCHAR(100) NULL,
                hero_button_2_text VARCHAR(100) NULL,
                hero_button_2_link VARCHAR(100) NULL,
                
                -- About Section
                about_section_visible BOOLEAN NOT NULL DEFAULT TRUE,
                about_title VARCHAR(255) NULL,
                about_paragraph_1 TEXT NULL,
                about_paragraph_2 TEXT NULL,
                about_link_text VARCHAR(100) NULL,
                about_link_destination VARCHAR(50) NULL,
                portrait_image_id INT NULL,
                portrait_alt VARCHAR(255) NULL,
                portrait_section_visible BOOLEAN NOT NULL DEFAULT TRUE,
                
                -- Gallery Section
                gallery_section_visible BOOLEAN NOT NULL DEFAULT TRUE,
                featured_gallery_section_id INT NULL,
                gallery_section_title VARCHAR(255) NULL,
                gallery_button_text VARCHAR(100) NULL,
                gallery_button_link VARCHAR(100) NULL,
                
                -- Testimonials Section
                testimonials_section_visible BOOLEAN NOT NULL DEFAULT TRUE,
                testimonials_section_title VARCHAR(255) NULL,
                testimonials_display_count INT DEFAULT 3,
                
                -- CTA Section
                cta_section_visible BOOLEAN NOT NULL DEFAULT TRUE,
                cta_section_title VARCHAR(255) NULL,
                cta_section_subtitle TEXT NULL,
                cta_button_1_text VARCHAR(100) NULL,
                cta_button_1_link VARCHAR(100) NULL,
                cta_button_2_text VARCHAR(100) NULL,
                cta_button_2_link VARCHAR(100) NULL,
                
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                INDEX idx_model_home_content (model_id),
                FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
        },
        {
            name: 'model_about_page_content',
            sql: `CREATE TABLE IF NOT EXISTS model_about_page_content (
                id INT AUTO_INCREMENT PRIMARY KEY,
                model_id INT NOT NULL,
                
                -- Page Header
                page_title VARCHAR(255) NULL,
                page_subtitle TEXT NULL,
                page_title_visible BOOLEAN NOT NULL DEFAULT TRUE,
                
                -- Main Content
                main_content_visible BOOLEAN NOT NULL DEFAULT TRUE,
                main_paragraph_1 TEXT NULL,
                main_paragraph_2 TEXT NULL,
                main_paragraph_3 TEXT NULL,
                main_paragraph_4 TEXT NULL,
                
                -- Portrait Section
                portrait_visible BOOLEAN NOT NULL DEFAULT TRUE,
                portrait_image_id INT NULL,
                portrait_alt VARCHAR(255) NULL,
                
                -- Services Section
                services_visible BOOLEAN NOT NULL DEFAULT TRUE,
                services_title VARCHAR(255) NULL,
                service_1 VARCHAR(500) NULL,
                service_2 VARCHAR(500) NULL,
                service_3 VARCHAR(500) NULL,
                service_4 VARCHAR(500) NULL,
                service_5 VARCHAR(500) NULL,
                
                -- CTA Section
                about_cta_visible BOOLEAN NOT NULL DEFAULT TRUE,
                cta_title VARCHAR(255) NULL,
                cta_description TEXT NULL,
                cta_button_1_text VARCHAR(100) NULL,
                cta_button_1_link VARCHAR(100) NULL,
                cta_button_2_text VARCHAR(100) NULL,
                cta_button_2_link VARCHAR(100) NULL,
                
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                INDEX idx_model_about_content (model_id),
                FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
        },
        {
            name: 'model_contact_page_content',
            sql: `CREATE TABLE IF NOT EXISTS model_contact_page_content (
                id INT AUTO_INCREMENT PRIMARY KEY,
                model_id INT NOT NULL,
                
                page_title VARCHAR(255) NULL,
                page_subtitle TEXT NULL,
                form_title VARCHAR(255) NULL,
                direct_title VARCHAR(255) NULL,
                
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                INDEX idx_model_contact_content (model_id),
                FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
        }
    ];
    
    try {
        for (const table of tables) {
            console.log(`📋 Creating table: ${table.name}`);
            await query(table.sql);
            console.log(`✅ Table ${table.name} created successfully`);
        }
        
        // Add default data for existing models
        console.log('📝 Adding default content for existing models...');
        
        const models = await query('SELECT id FROM models');
        console.log(`Found ${models.length} models to initialize`);
        
        for (const model of models) {
            // Home page content
            await query(`
                INSERT IGNORE INTO model_home_page_content 
                (model_id, hero_title, hero_subtitle, about_title, gallery_section_title, testimonials_section_title, cta_section_title)
                VALUES (?, 'Welcome', 'Elegance & Sophistication', 'About Me', 'Gallery', 'What Clients Say', 'Ready to Meet?')
            `, [model.id]);
            
            // About page content
            await query(`
                INSERT IGNORE INTO model_about_page_content 
                (model_id, page_title, services_title, cta_title)
                VALUES (?, 'About Me', 'My Services', 'Let\\'s Connect')
            `, [model.id]);
            
            // Contact page content
            await query(`
                INSERT IGNORE INTO model_contact_page_content 
                (model_id, page_title, form_title, direct_title)
                VALUES (?, 'Contact Me', 'Send a Message', 'Direct Contact')
            `, [model.id]);
        }
        
        console.log('✅ All tables created and initialized successfully!');
        
    } catch (error) {
        console.error('❌ Error creating tables:', error.message);
        throw error;
    }
}

createContentTables().then(() => {
    console.log('🎉 Content tables setup complete!');
    process.exit(0);
}).catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
});