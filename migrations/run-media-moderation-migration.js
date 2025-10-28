/**
 * Execute media moderation enhancements migration
 * Part of Phase B: Moderation System Integration
 */

const mysql = require('mysql2/promise');
const path = require('path');

async function runMigration() {
    let connection;
    
    try {
        // Create connection using environment variables or defaults
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root', 
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_DATABASE || 'phoenix4ge'
        });
        
        console.log('✅ Connected to MySQL database');
        console.log('🚀 Starting media moderation enhancements migration...');
        
        // Step 1: Create moderation_error_log table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS moderation_error_log (
                id INT PRIMARY KEY AUTO_INCREMENT,
                model_id INT,
                model_slug VARCHAR(100) NOT NULL,
                original_filename VARCHAR(255),
                image_path VARCHAR(500),
                usage_intent VARCHAR(50),
                error_message TEXT,
                retry_attempts INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                INDEX idx_model_slug_created (model_slug, created_at),
                INDEX idx_error_created (created_at),
                FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE SET NULL
            )
        `);
        console.log('✅ Created moderation_error_log table');
        
        // Step 2: Create media_moderation_links table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS media_moderation_links (
                id INT PRIMARY KEY AUTO_INCREMENT,
                media_id INT NOT NULL,
                content_moderation_id INT,
                batch_id VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                UNIQUE KEY unique_media_moderation (media_id),
                INDEX idx_content_moderation (content_moderation_id),
                INDEX idx_batch_id (batch_id),
                FOREIGN KEY (media_id) REFERENCES model_media_library(id) ON DELETE CASCADE,
                FOREIGN KEY (content_moderation_id) REFERENCES content_moderation(id) ON DELETE SET NULL
            )
        `);
        console.log('✅ Created media_moderation_links table');
        
        // Step 3: Create moderation_callbacks table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS moderation_callbacks (
                id INT PRIMARY KEY AUTO_INCREMENT,
                media_id INT NOT NULL,
                batch_id VARCHAR(100) NOT NULL,
                model_slug VARCHAR(100) NOT NULL,
                status ENUM('pending', 'completed', 'failed', 'timeout') DEFAULT 'pending',
                callback_received_at TIMESTAMP NULL,
                callback_data JSON,
                retry_count INT DEFAULT 0,
                max_retries INT DEFAULT 5,
                next_retry_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                UNIQUE KEY unique_media_batch (media_id, batch_id),
                INDEX idx_batch_id_status (batch_id, status),
                INDEX idx_status_next_retry (status, next_retry_at),
                INDEX idx_model_slug_status (model_slug, status),
                FOREIGN KEY (media_id) REFERENCES model_media_library(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Created moderation_callbacks table');
        
        // Step 4: Add indices to model_media_library for better performance
        try {
            await connection.execute(`
                CREATE INDEX idx_model_media_moderation_status 
                ON model_media_library(model_slug, moderation_status)
            `);
            console.log('✅ Created moderation status index');
        } catch (error) {
            if (!error.message.includes('Duplicate key name')) {
                throw error;
            }
            console.log('ℹ️ Moderation status index already exists');
        }
        
        try {
            await connection.execute(`
                CREATE INDEX idx_model_media_upload_date 
                ON model_media_library(model_slug, upload_date)
            `);
            console.log('✅ Created upload date index');
        } catch (error) {
            if (!error.message.includes('Duplicate key name')) {
                throw error;
            }
            console.log('ℹ️ Upload date index already exists');
        }
        
        try {
            await connection.execute(`
                CREATE INDEX idx_model_media_score 
                ON model_media_library(moderation_score)
            `);
            console.log('✅ Created moderation score index');
        } catch (error) {
            if (!error.message.includes('Duplicate key name')) {
                throw error;
            }
            console.log('ℹ️ Moderation score index already exists');
        }
        
        // Step 5: Create enhanced media upload statistics view
        await connection.execute(`DROP VIEW IF EXISTS media_upload_statistics`);
        await connection.execute(`
            CREATE VIEW media_upload_statistics AS
            SELECT 
                mml.model_slug,
                COUNT(*) as total_media,
                COUNT(CASE WHEN mml.moderation_status = 'approved' THEN 1 END) as approved_count,
                COUNT(CASE WHEN mml.moderation_status = 'pending' THEN 1 END) as pending_count,
                COUNT(CASE WHEN mml.moderation_status = 'rejected' THEN 1 END) as rejected_count,
                COUNT(CASE WHEN mml.moderation_status = 'flagged' THEN 1 END) as flagged_count,
                COUNT(CASE WHEN mml.moderation_status = 'error' THEN 1 END) as error_count,
                SUM(mml.file_size) as total_size_bytes,
                AVG(CASE WHEN mml.moderation_score > 0 THEN mml.moderation_score END) as avg_moderation_score,
                MAX(mml.upload_date) as last_upload,
                COUNT(CASE WHEN mml.upload_date >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) as uploads_last_24h,
                COUNT(CASE WHEN mml.upload_date >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as uploads_last_week,
                ROUND(
                    CASE WHEN COUNT(*) > 0 
                    THEN (COUNT(CASE WHEN mml.moderation_status = 'approved' THEN 1 END) / COUNT(*)) * 100 
                    ELSE 0 END, 2
                ) as approval_rate_pct,
                ROUND(
                    CASE WHEN COUNT(*) > 0 
                    THEN (COUNT(CASE WHEN mml.moderation_status = 'error' THEN 1 END) / COUNT(*)) * 100 
                    ELSE 0 END, 2
                ) as error_rate_pct,
                ROUND(
                    CASE WHEN COUNT(*) > 0 
                    THEN (COUNT(CASE WHEN mml.moderation_status = 'pending' THEN 1 END) / COUNT(*)) * 100 
                    ELSE 0 END, 2
                ) as pending_rate_pct
            FROM model_media_library mml 
            WHERE mml.is_deleted = 0
            GROUP BY mml.model_slug
        `);
        console.log('✅ Created enhanced media upload statistics view');
        
        // Step 6: Create stored procedure for callback processing
        await connection.query(`DROP PROCEDURE IF EXISTS ProcessModerationCallback`);
        await connection.query(`
            CREATE PROCEDURE ProcessModerationCallback(
                IN p_batch_id VARCHAR(100),
                IN p_callback_data JSON,
                IN p_moderation_status VARCHAR(50),
                IN p_moderation_score DECIMAL(5,2)
            )
            BEGIN
                DECLARE media_count INT DEFAULT 0;
                DECLARE EXIT HANDLER FOR SQLEXCEPTION
                BEGIN
                    ROLLBACK;
                    RESIGNAL;
                END;

                START TRANSACTION;
                
                -- Update moderation callbacks table
                UPDATE moderation_callbacks 
                SET 
                    status = 'completed',
                    callback_received_at = NOW(),
                    callback_data = p_callback_data,
                    updated_at = NOW()
                WHERE batch_id = p_batch_id AND status = 'pending';
                
                -- Update media library entries via the link table
                UPDATE model_media_library mml
                INNER JOIN media_moderation_links mml_link ON mml.id = mml_link.media_id
                SET 
                    mml.moderation_status = p_moderation_status,
                    mml.moderation_score = p_moderation_score,
                    mml.last_modified = NOW()
                WHERE mml_link.batch_id = p_batch_id;
                
                SELECT ROW_COUNT() as updated_media_count;
                
                COMMIT;
            END
        `);
        console.log('✅ Created ProcessModerationCallback stored procedure');
        
        console.log('🎉 Media moderation enhancements migration completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error('Full error:', error);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔌 Database connection closed');
        }
    }
}

// Run the migration
runMigration().catch(error => {
    console.error('💥 Migration script failed:', error.message);
    process.exit(1);
});