#!/usr/bin/env node

/**
 * Batch Image Enhancement Script
 * 
 * This script processes all existing images in the database to:
 * 1. Extract comprehensive metadata (EXIF, hash, dimensions)
 * 2. Send to Venice.ai for SEO keywords and alt text generation
 * 3. Update both content_moderation and model_media_library tables
 * 
 * Usage: node scripts/enhance-existing-images.js [--dry-run] [--limit=N] [--model=slug]
 */

const path = require('path');
const fs = require('fs').promises;

// Import MuseNest services
const db = require('../config/database');
const VeniceAIService = require('../src/services/VeniceAIService');
const ContentModerationService = require('../src/services/ContentModerationService');

class ImageEnhancementBatch {
    constructor(options = {}) {
        this.dryRun = options.dryRun || false;
        this.limit = options.limit || null;
        this.modelFilter = options.modelFilter || null;
        this.batchSize = 10; // Process 10 images at a time
        this.delay = 2000; // 2 second delay between batches to avoid rate limiting
        
        // Initialize services
        this.moderationService = new ContentModerationService(db);
        
        // Stats tracking
        this.stats = {
            total: 0,
            processed: 0,
            success: 0,
            errors: 0,
            skipped: 0,
            startTime: Date.now()
        };
    }

    async run() {
        console.log('🚀 Starting batch image enhancement...');
        console.log(`📊 Mode: ${this.dryRun ? 'DRY RUN' : 'LIVE PROCESSING'}`);
        console.log(`🎯 Limit: ${this.limit || 'No limit'}`);
        console.log(`🔍 Model filter: ${this.modelFilter || 'All models'}`);
        console.log('');

        try {
            // Get images to process
            const imagesToProcess = await this.getImagesToProcess();
            console.log(`📸 Found ${imagesToProcess.length} images to process`);
            
            if (imagesToProcess.length === 0) {
                console.log('✅ No images need processing. Exiting.');
                return;
            }
            
            this.stats.total = imagesToProcess.length;
            
            // Process in batches
            const batches = this.chunkArray(imagesToProcess, this.batchSize);
            console.log(`🔄 Processing ${batches.length} batches of ${this.batchSize} images each\n`);
            
            for (let i = 0; i < batches.length; i++) {
                const batch = batches[i];
                console.log(`📦 Processing batch ${i + 1}/${batches.length} (${batch.length} images)`);
                
                await this.processBatch(batch, i + 1);
                
                // Add delay between batches (except for the last one)
                if (i < batches.length - 1) {
                    console.log(`⏳ Waiting ${this.delay}ms before next batch...`);
                    await this.sleep(this.delay);
                }
                
                console.log(''); // Empty line for readability
            }
            
            this.printFinalStats();
            
        } catch (error) {
            console.error('❌ Batch processing failed:', error);
            process.exit(1);
        } finally {
            if (db && typeof db.end === 'function') {
                await db.end();
            } else if (db && typeof db.close === 'function') {
                await db.close();
            }
            console.log('📝 Database connection closed');
        }
    }

    /**
     * Get images that need processing
     */
    async getImagesToProcess() {
        let whereConditions = [];
        let params = [];
        
        // Filter by model if specified
        if (this.modelFilter) {
            whereConditions.push('mml.model_slug = ?');
            params.push(this.modelFilter);
        }
        
        // Find images missing metadata or Venice SEO data
        whereConditions.push(`(
            mml.alt_text IS NULL OR 
            mml.caption IS NULL OR 
            mml.exif_data IS NULL OR 
            mml.image_width IS NULL OR 
            mml.image_height IS NULL OR
            NOT EXISTS (
                SELECT 1 FROM content_moderation cm 
                WHERE cm.original_path LIKE CONCAT('%', mml.filename) 
                AND cm.model_id = (SELECT id FROM models WHERE slug = mml.model_slug LIMIT 1)
                AND cm.venice_seo_keywords IS NOT NULL
            )
        )`);
        
        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        
        const query = `
            SELECT 
                mml.id,
                mml.model_slug,
                mml.filename,
                mml.original_filename,
                mml.file_path,
                mml.alt_text,
                mml.caption,
                mml.exif_data,
                mml.image_width,
                mml.image_height,
                mml.upload_date,
                m.id as model_id,
                m.name as model_name
            FROM model_media_library mml
            JOIN models m ON m.slug = mml.model_slug
            ${whereClause}
            AND mml.is_deleted = 0
            ORDER BY mml.upload_date DESC
            ${this.limit ? `LIMIT ${this.limit}` : ''}
        `;
        
        const rows = await db.query(query, params);
        return rows || [];
    }

    /**
     * Process a batch of images
     */
    async processBatch(images, batchNumber) {
        const promises = images.map(async (image, index) => {
            try {
                console.log(`  📸 ${batchNumber}.${index + 1} Processing: ${image.filename}`);
                await this.processImage(image);
                this.stats.success++;
                console.log(`  ✅ ${batchNumber}.${index + 1} Success: ${image.filename}`);
            } catch (error) {
                this.stats.errors++;
                console.error(`  ❌ ${batchNumber}.${index + 1} Error: ${image.filename} - ${error.message}`);
            } finally {
                this.stats.processed++;
            }
        });
        
        await Promise.all(promises);
    }

    /**
     * Process a single image
     */
    async processImage(imageData) {
        const { filename, model_slug, model_id } = imageData;
        
        // Construct full path to image
        const imagePath = path.join(process.cwd(), 'public', 'uploads', model_slug, 'originals', filename);
        
        // Check if file exists
        try {
            await fs.access(imagePath);
        } catch {
            console.log(`    ⏭️  Skipping ${filename} - file not found at ${imagePath}`);
            this.stats.skipped++;
            return;
        }
        
        if (this.dryRun) {
            console.log(`    🔍 [DRY RUN] Would process: ${filename}`);
            return;
        }
        
        // Extract comprehensive metadata
        const metadata = await this.moderationService.extractImageMetadata(imagePath);
        console.log(`    📊 Metadata extracted: ${metadata.width}x${metadata.height}, ${Math.round(metadata.fileSize/1024)}KB`);
        
        // Send to Venice.ai for SEO analysis
        const veniceResult = await VeniceAIService.processImage(imagePath, {
            modelId: model_id,
            modelSlug: model_slug,
            contextType: 'metadata_enhancement',
            usageIntent: 'public_site'
        });
        
        if (!veniceResult.success) {
            throw new Error(`Venice.ai processing failed: ${veniceResult.error}`);
        }
        
        console.log(`    🔍 Venice.ai analysis complete - Keywords: ${veniceResult.seoKeywords?.length || 0}, Alt text: ${veniceResult.altText ? 'Generated' : 'Missing'}`);
        
        // Update model_media_library table
        await this.updateMediaLibrary(imageData.id, {
            metadata,
            veniceData: veniceResult
        });
        
        // Update or create content_moderation entry
        await this.updateContentModeration(imageData, imagePath, {
            metadata,
            veniceData: veniceResult
        });
        
        console.log(`    💾 Database updated for ${filename}`);
    }

    /**
     * Update model_media_library table
     */
    async updateMediaLibrary(mediaId, { metadata, veniceData }) {
        const updateQuery = `
            UPDATE model_media_library 
            SET 
                image_width = COALESCE(?, image_width),
                image_height = COALESCE(?, image_height),
                file_size = COALESCE(?, file_size),
                alt_text = COALESCE(?, alt_text),
                caption = COALESCE(?, caption),
                exif_data = COALESCE(?, exif_data),
                last_modified = NOW()
            WHERE id = ?
        `;
        
        await db.query(updateQuery, [
            metadata.width,
            metadata.height,
            metadata.fileSize,
            veniceData.altText,
            veniceData.briefDescription,
            metadata.exifData ? JSON.stringify(metadata) : null,
            mediaId
        ]);
    }

    /**
     * Update or create content_moderation entry
     */
    async updateContentModeration(imageData, imagePath, { metadata, veniceData }) {
        // Check if content_moderation entry exists
        const existingEntry = await db.query(`
            SELECT id FROM content_moderation 
            WHERE model_id = ? AND original_path LIKE ?
            ORDER BY created_at DESC LIMIT 1
        `, [imageData.model_id, `%${imageData.filename}`]);
        
        if (existingEntry && existingEntry.length > 0) {
            // Update existing entry
            const updateQuery = `
                UPDATE content_moderation 
                SET 
                    venice_description = COALESCE(?, venice_description),
                    venice_detailed_description = COALESCE(?, venice_detailed_description),
                    venice_brief_description = COALESCE(?, venice_brief_description),
                    venice_seo_keywords = COALESCE(?, venice_seo_keywords),
                    venice_alt_text = COALESCE(?, venice_alt_text),
                    venice_children_detected = ?,
                    venice_children_terms = ?,
                    updated_at = NOW()
                WHERE id = ?
            `;
            
            await db.query(updateQuery, [
                veniceData.fullResponse,
                veniceData.detailedDescription,
                veniceData.briefDescription,
                JSON.stringify(veniceData.seoKeywords || []),
                veniceData.altText,
                veniceData.childrenDetected?.detected ? 1 : 0,
                veniceData.childrenDetected?.termsFound ? JSON.stringify(veniceData.childrenDetected.termsFound) : null,
                existingEntry[0].id
            ]);
        } else {
            // Create new entry
            const insertQuery = `
                INSERT INTO content_moderation (
                    model_id, original_path, image_path, context_type, usage_intent,
                    moderation_status, nudity_score, has_nudity,
                    venice_description, venice_detailed_description, venice_brief_description,
                    venice_seo_keywords, venice_alt_text, venice_children_detected, venice_children_terms
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            await db.query(insertQuery, [
                imageData.model_id,
                imagePath,
                imagePath,
                'metadata_enhancement',
                'public_site',
                'approved', // Default to approved for existing images
                0,
                false,
                veniceData.fullResponse,
                veniceData.detailedDescription,
                veniceData.briefDescription,
                JSON.stringify(veniceData.seoKeywords || []),
                veniceData.altText,
                veniceData.childrenDetected?.detected ? 1 : 0,
                veniceData.childrenDetected?.termsFound ? JSON.stringify(veniceData.childrenDetected.termsFound) : null
            ]);
        }
    }

    /**
     * Utility methods
     */
    chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    printFinalStats() {
        const duration = Date.now() - this.stats.startTime;
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        
        console.log('📊 FINAL STATISTICS');
        console.log('==================');
        console.log(`Total images found: ${this.stats.total}`);
        console.log(`Successfully processed: ${this.stats.success}`);
        console.log(`Errors: ${this.stats.errors}`);
        console.log(`Skipped: ${this.stats.skipped}`);
        console.log(`Processing time: ${minutes}m ${seconds}s`);
        console.log(`Average time per image: ${Math.round(duration / this.stats.processed)}ms`);
        
        if (this.stats.errors > 0) {
            console.log('\n⚠️  Some images failed to process. Check the logs above for details.');
        } else {
            console.log('\n✅ All images processed successfully!');
        }
    }
}

// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        dryRun: false,
        limit: null,
        modelFilter: null
    };
    
    args.forEach(arg => {
        if (arg === '--dry-run') {
            options.dryRun = true;
        } else if (arg.startsWith('--limit=')) {
            options.limit = parseInt(arg.split('=')[1]);
        } else if (arg.startsWith('--model=')) {
            options.modelFilter = arg.split('=')[1];
        }
    });
    
    return options;
}

// Main execution
async function main() {
    const options = parseArgs();
    const batchProcessor = new ImageEnhancementBatch(options);
    await batchProcessor.run();
}

// Run the script if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('Script failed:', error);
        process.exit(1);
    });
}

module.exports = ImageEnhancementBatch;