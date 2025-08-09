const db = require('./config/database');

async function createMediaLibraryTables() {
    try {
        console.log('Creating media library tables...');
        
        // 1. Main media library table
        console.log('Creating model_media_library table...');
        await db.execute(`
            CREATE TABLE IF NOT EXISTS model_media_library (
                id INT AUTO_INCREMENT PRIMARY KEY,
                model_slug VARCHAR(255) NOT NULL,
                filename VARCHAR(255) NOT NULL,
                original_filename VARCHAR(255) NOT NULL,
                file_path VARCHAR(500) NOT NULL,
                file_size INT NOT NULL,
                image_width INT,
                image_height INT,
                mime_type VARCHAR(100) NOT NULL,
                category_id INT NULL,
                
                watermark_applied TINYINT(1) DEFAULT 0,
                processing_status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
                
                moderation_status ENUM('pending', 'approved', 'rejected', 'reviewing') DEFAULT 'pending',
                moderation_id VARCHAR(255) NULL,
                moderation_notes TEXT,
                moderation_score DECIMAL(3,2) NULL,
                
                is_deleted TINYINT(1) DEFAULT 0,
                temp_path VARCHAR(500) NULL,
                permanent_path VARCHAR(500) NULL,
                
                thumbnail_path VARCHAR(500) NULL,
                medium_path VARCHAR(500) NULL,
                
                exif_data JSON NULL,
                alt_text VARCHAR(500) NULL,
                caption TEXT NULL,
                
                upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                approved_date TIMESTAMP NULL,
                
                INDEX idx_model_slug (model_slug),
                INDEX idx_category (category_id),
                INDEX idx_moderation (moderation_status),
                INDEX idx_processing (processing_status),
                INDEX idx_upload_date (upload_date),
                INDEX idx_deleted (is_deleted),
                UNIQUE KEY unique_filename (model_slug, filename)
            )
        `);
        
        // 2. Media categories table
        console.log('Creating model_media_categories table...');
        await db.execute(`
            CREATE TABLE IF NOT EXISTS model_media_categories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                model_slug VARCHAR(255) NOT NULL,
                category_name VARCHAR(255) NOT NULL,
                category_slug VARCHAR(255) NOT NULL,
                category_description TEXT,
                category_order INT DEFAULT 0,
                category_color VARCHAR(7) DEFAULT '#007bff',
                is_active TINYINT(1) DEFAULT 1,
                created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                modified_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                INDEX idx_model_slug (model_slug),
                INDEX idx_active (is_active),
                INDEX idx_order (category_order),
                UNIQUE KEY unique_category_slug (model_slug, category_slug),
                UNIQUE KEY unique_category_name (model_slug, category_name)
            )
        `);
        
        // 3. Gallery sections table
        console.log('Creating model_gallery_sections table...');
        await db.execute(`
            CREATE TABLE IF NOT EXISTS model_gallery_sections (
                id INT AUTO_INCREMENT PRIMARY KEY,
                model_slug VARCHAR(255) NOT NULL,
                section_name VARCHAR(255) NOT NULL,
                section_slug VARCHAR(255) NOT NULL,
                section_description TEXT,
                layout_type ENUM('grid', 'masonry', 'carousel', 'lightbox_grid') NOT NULL,
                layout_settings JSON,
                section_order INT DEFAULT 0,
                is_published TINYINT(1) DEFAULT 1,
                is_featured TINYINT(1) DEFAULT 0,
                requires_authentication TINYINT(1) DEFAULT 0,
                password_protected TINYINT(1) DEFAULT 0,
                section_password VARCHAR(255) NULL,
                
                created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                modified_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                INDEX idx_model_slug (model_slug),
                INDEX idx_published (is_published),
                INDEX idx_featured (is_featured),
                INDEX idx_order (section_order),
                UNIQUE KEY unique_section_slug (model_slug, section_slug)
            )
        `);
        
        // 4. Gallery section media junction table
        console.log('Creating model_gallery_section_media table...');
        await db.execute(`
            CREATE TABLE IF NOT EXISTS model_gallery_section_media (
                id INT AUTO_INCREMENT PRIMARY KEY,
                section_id INT NOT NULL,
                media_id INT NOT NULL,
                display_order INT DEFAULT 0,
                custom_caption TEXT,
                custom_alt_text VARCHAR(500) NULL,
                is_featured TINYINT(1) DEFAULT 0,
                is_cover_image TINYINT(1) DEFAULT 0,
                display_settings JSON NULL,
                
                added_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                modified_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                INDEX idx_section (section_id),
                INDEX idx_media (media_id),
                INDEX idx_order (display_order),
                INDEX idx_featured (is_featured),
                UNIQUE KEY unique_section_media (section_id, media_id)
            )
        `);
        
        // 5. Media edit history
        console.log('Creating model_media_edit_history table...');
        await db.execute(`
            CREATE TABLE IF NOT EXISTS model_media_edit_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                media_id INT NOT NULL,
                operation_type ENUM('crop', 'rotate', 'resize', 'rename', 'watermark', 'filter') NOT NULL,
                operation_data JSON NOT NULL,
                original_file_path VARCHAR(500),
                new_file_path VARCHAR(500),
                operation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                INDEX idx_media (media_id),
                INDEX idx_operation (operation_type),
                INDEX idx_date (operation_date)
            )
        `);
        
        // 6. Batch operations
        console.log('Creating model_media_batch_operations table...');
        await db.execute(`
            CREATE TABLE IF NOT EXISTS model_media_batch_operations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                model_slug VARCHAR(255) NOT NULL,
                operation_type ENUM('approve', 'reject', 'categorize', 'delete', 'watermark') NOT NULL,
                operation_data JSON,
                media_count INT DEFAULT 0,
                completed_count INT DEFAULT 0,
                failed_count INT DEFAULT 0,
                status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
                started_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_date TIMESTAMP NULL,
                
                INDEX idx_model_slug (model_slug),
                INDEX idx_status (status),
                INDEX idx_type (operation_type)
            )
        `);
        
        // 7. Watermark settings
        console.log('Creating model_watermark_settings table...');
        await db.execute(`
            CREATE TABLE IF NOT EXISTS model_watermark_settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                model_slug VARCHAR(255) NOT NULL,
                watermark_enabled TINYINT(1) DEFAULT 1,
                watermark_file_path VARCHAR(500) NULL,
                watermark_position ENUM('top-left', 'top-right', 'bottom-left', 'bottom-right', 'center') DEFAULT 'bottom-right',
                watermark_opacity DECIMAL(3,2) DEFAULT 0.80,
                watermark_size_percent INT DEFAULT 15,
                apply_to_uploads TINYINT(1) DEFAULT 1,
                apply_to_existing TINYINT(1) DEFAULT 0,
                
                created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                modified_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                UNIQUE KEY unique_model_watermark (model_slug),
                INDEX idx_model_slug (model_slug)
            )
        `);
        
        // 8. Media analytics
        console.log('Creating model_media_analytics table...');
        await db.execute(`
            CREATE TABLE IF NOT EXISTS model_media_analytics (
                id INT AUTO_INCREMENT PRIMARY KEY,
                media_id INT NOT NULL,
                event_type ENUM('view', 'download', 'lightbox_open', 'share', 'like') NOT NULL,
                event_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                user_ip VARCHAR(45) NULL,
                user_agent TEXT NULL,
                referrer_url VARCHAR(500) NULL,
                
                INDEX idx_media (media_id),
                INDEX idx_event_type (event_type),
                INDEX idx_event_date (event_date)
            )
        `);
        
        // 9. Daily stats
        console.log('Creating model_media_daily_stats table...');
        await db.execute(`
            CREATE TABLE IF NOT EXISTS model_media_daily_stats (
                id INT AUTO_INCREMENT PRIMARY KEY,
                model_slug VARCHAR(255) NOT NULL,
                stat_date DATE NOT NULL,
                total_views INT DEFAULT 0,
                total_downloads INT DEFAULT 0,
                total_lightbox_opens INT DEFAULT 0,
                total_shares INT DEFAULT 0,
                unique_visitors INT DEFAULT 0,
                
                UNIQUE KEY unique_model_date (model_slug, stat_date),
                INDEX idx_model_slug (model_slug),
                INDEX idx_date (stat_date)
            )
        `);
        
        // Add foreign key constraints
        console.log('Adding foreign key constraints...');
        try {
            await db.execute(`
                ALTER TABLE model_media_library 
                ADD CONSTRAINT fk_media_category 
                FOREIGN KEY (category_id) REFERENCES model_media_categories(id) 
                ON DELETE SET NULL
            `);
        } catch (e) {
            if (!e.message.includes('Duplicate foreign key constraint name')) {
                console.warn('Foreign key constraint already exists or failed:', e.message);
            }
        }
        
        try {
            await db.execute(`
                ALTER TABLE model_gallery_section_media 
                ADD CONSTRAINT fk_section_media_section 
                FOREIGN KEY (section_id) REFERENCES model_gallery_sections(id) 
                ON DELETE CASCADE
            `);
        } catch (e) {
            if (!e.message.includes('Duplicate foreign key constraint name')) {
                console.warn('Foreign key constraint already exists or failed:', e.message);
            }
        }
        
        try {
            await db.execute(`
                ALTER TABLE model_gallery_section_media 
                ADD CONSTRAINT fk_section_media_media 
                FOREIGN KEY (media_id) REFERENCES model_media_library(id) 
                ON DELETE CASCADE
            `);
        } catch (e) {
            if (!e.message.includes('Duplicate foreign key constraint name')) {
                console.warn('Foreign key constraint already exists or failed:', e.message);
            }
        }
        
        try {
            await db.execute(`
                ALTER TABLE model_media_edit_history 
                ADD CONSTRAINT fk_edit_history_media 
                FOREIGN KEY (media_id) REFERENCES model_media_library(id) 
                ON DELETE CASCADE
            `);
        } catch (e) {
            if (!e.message.includes('Duplicate foreign key constraint name')) {
                console.warn('Foreign key constraint already exists or failed:', e.message);
            }
        }
        
        try {
            await db.execute(`
                ALTER TABLE model_media_analytics 
                ADD CONSTRAINT fk_analytics_media 
                FOREIGN KEY (media_id) REFERENCES model_media_library(id) 
                ON DELETE CASCADE
            `);
        } catch (e) {
            if (!e.message.includes('Duplicate foreign key constraint name')) {
                console.warn('Foreign key constraint already exists or failed:', e.message);
            }
        }
        
        // Insert default categories
        console.log('Inserting default categories...');
        await db.execute(`
            INSERT IGNORE INTO model_media_categories 
            (model_slug, category_name, category_slug, category_description, category_order, category_color) VALUES
            ('__DEFAULT__', 'Portfolio', 'portfolio', 'Professional portfolio images', 1, '#007bff'),
            ('__DEFAULT__', 'Behind the Scenes', 'behind-scenes', 'Casual and behind-the-scenes content', 2, '#28a745'),
            ('__DEFAULT__', 'Events', 'events', 'Special events and occasions', 3, '#ffc107'),
            ('__DEFAULT__', 'Lifestyle', 'lifestyle', 'Lifestyle and casual photography', 4, '#17a2b8'),
            ('__DEFAULT__', 'Professional', 'professional', 'Business and professional content', 5, '#6c757d')
        `);
        
        console.log('🎉 Media library tables created successfully!');
        
        // Verify tables were created
        const tables = await db.execute("SHOW TABLES LIKE 'model_media_%'");
        console.log(`Created ${tables[0].length} media library tables:`);
        tables[0].forEach(row => {
            const tableName = Object.values(row)[0];
            console.log(`  ✅ ${tableName}`);
        });
        
    } catch (error) {
        console.error('❌ Failed to create media library tables:', error);
        process.exit(1);
    }
}

createMediaLibraryTables();