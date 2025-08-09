/**
 * Media Metadata Service
 * Part of Phase C.3: Optimize media metadata handling
 * Provides efficient caching and retrieval for media metadata with batch processing
 */

class MediaMetadataService {
    constructor(dbConnection, cacheService) {
        this.db = dbConnection;
        this.cacheService = cacheService;
        this.metadataBatchSize = 50; // Process metadata in batches
        this.defaultMetadataTTL = 7200; // 2 hours cache TTL for metadata
        
        console.log('📊 MediaMetadataService initialized with caching support');
    }

    /**
     * Get media metadata with intelligent caching
     * @param {string} modelSlug 
     * @param {number|string} mediaId 
     * @param {boolean} includeExtraData - Include processing stats, file info, etc.
     * @returns {Object} Media metadata
     */
    async getMediaMetadata(modelSlug, mediaId, includeExtraData = false) {
        const startTime = Date.now();
        
        try {
            // Try cache first
            const cacheKey = includeExtraData ? `${mediaId}:extended` : `${mediaId}:basic`;
            const cached = await this.cacheService.getCachedMediaMetadata(modelSlug, cacheKey);
            
            if (cached) {
                console.log(`💾 Metadata cache HIT for ${modelSlug}:${mediaId} (${Date.now() - startTime}ms)`);
                return {
                    success: true,
                    metadata: cached,
                    cached: true,
                    loadTime: Date.now() - startTime
                };
            }

            // Load from database
            const metadata = await this.loadMediaMetadataFromDB(modelSlug, mediaId, includeExtraData);
            
            if (metadata.success) {
                // Cache the result
                await this.cacheService.setCachedMediaMetadata(
                    modelSlug, 
                    cacheKey, 
                    metadata.metadata, 
                    this.defaultMetadataTTL
                );
                
                console.log(`📊 Loaded and cached metadata for ${modelSlug}:${mediaId} (${Date.now() - startTime}ms)`);
            }

            return {
                ...metadata,
                cached: false,
                loadTime: Date.now() - startTime
            };

        } catch (error) {
            console.error(`❌ Error getting metadata for ${modelSlug}:${mediaId}:`, error.message);
            return {
                success: false,
                error: error.message,
                metadata: null
            };
        }
    }

    /**
     * Load media metadata from database
     * @param {string} modelSlug 
     * @param {number|string} mediaId 
     * @param {boolean} includeExtraData 
     * @returns {Object}
     */
    async loadMediaMetadataFromDB(modelSlug, mediaId, includeExtraData = false) {
        try {
            let baseQuery = `
                SELECT 
                    id,
                    filename,
                    original_filename,
                    file_path,
                    mime_type,
                    file_size,
                    image_width,
                    image_height,
                    model_slug,
                    upload_date,
                    last_modified,
                    moderation_status,
                    category_id,
                    is_featured,
                    is_deleted,
                    blur_hash,
                    color_palette,
                    auto_tags
                FROM model_media_library 
                WHERE model_slug = ? AND id = ?
            `;

            const [rows] = await this.db.execute(baseQuery, [modelSlug, mediaId]);

            if (!rows || rows.length === 0) {
                return {
                    success: false,
                    error: 'Media not found',
                    metadata: null
                };
            }

            const media = rows[0];

            // Build basic metadata object
            let metadata = {
                id: media.id,
                filename: media.filename,
                originalFilename: media.original_filename,
                filePath: media.file_path,
                mimeType: media.mime_type,
                fileSize: media.file_size,
                dimensions: {
                    width: media.image_width,
                    height: media.image_height,
                    aspectRatio: media.image_width && media.image_height ? 
                        (media.image_width / media.image_height).toFixed(2) : null
                },
                modelSlug: media.model_slug,
                uploadDate: media.upload_date,
                lastModified: media.last_modified,
                moderationStatus: media.moderation_status,
                categoryId: media.category_id,
                isFeatured: !!media.is_featured,
                isDeleted: !!media.is_deleted,
                blurHash: media.blur_hash,
                colorPalette: this.parseColorPalette(media.color_palette),
                autoTags: this.parseAutoTags(media.auto_tags),
                urls: this.generateMediaUrls(media)
            };

            // Add extra data if requested
            if (includeExtraData) {
                const extraData = await this.loadExtraMetadata(modelSlug, mediaId);
                metadata = { ...metadata, ...extraData };
            }

            return {
                success: true,
                metadata
            };

        } catch (error) {
            console.error('❌ Error loading metadata from DB:', error.message);
            return {
                success: false,
                error: error.message,
                metadata: null
            };
        }
    }

    /**
     * Load extra metadata (processing history, violations, etc.)
     * @param {string} modelSlug 
     * @param {number|string} mediaId 
     * @returns {Object}
     */
    async loadExtraMetadata(modelSlug, mediaId) {
        try {
            // Get violation history
            const [violations] = await this.db.execute(`
                SELECT violation_type, detected_at, severity, auto_resolved
                FROM model_media_violations 
                WHERE media_id = ? AND model_slug = ?
                ORDER BY detected_at DESC
                LIMIT 10
            `, [mediaId, modelSlug]);

            // Get processing history
            const [processing] = await this.db.execute(`
                SELECT operation_type, processed_at, processing_time_ms, result_data
                FROM model_media_processing_log 
                WHERE media_id = ? AND model_slug = ?
                ORDER BY processed_at DESC
                LIMIT 5
            `, [mediaId, modelSlug]);

            // Get gallery section associations
            const [sections] = await this.db.execute(`
                SELECT 
                    mgs.id as section_id,
                    mgs.section_name,
                    mgsm.display_order,
                    mgsm.is_featured as featured_in_section
                FROM model_gallery_section_media mgsm
                INNER JOIN model_gallery_sections mgs ON mgsm.section_id = mgs.id
                WHERE mgsm.media_id = ? AND mgs.model_slug = ?
                ORDER BY mgsm.display_order ASC
            `, [mediaId, modelSlug]);

            // Calculate file age and processing stats
            const fileAge = this.calculateFileAge(Date.now());
            const processingStats = this.calculateProcessingStats(processing);
            const violationSummary = this.summarizeViolations(violations);

            return {
                extraData: {
                    fileAge,
                    processingStats,
                    violationSummary,
                    violations: violations || [],
                    processingHistory: processing || [],
                    gallerySections: sections || [],
                    sectionCount: sections ? sections.length : 0,
                    hasPendingOperations: processing.some(p => !p.result_data)
                }
            };

        } catch (error) {
            console.error('❌ Error loading extra metadata:', error.message);
            return {
                extraData: {
                    error: 'Failed to load extended metadata'
                }
            };
        }
    }

    /**
     * Get metadata for multiple media items (batch processing)
     * @param {string} modelSlug 
     * @param {Array} mediaIds 
     * @param {boolean} includeExtraData 
     * @returns {Object}
     */
    async getBatchMediaMetadata(modelSlug, mediaIds, includeExtraData = false) {
        const startTime = Date.now();
        console.log(`📊 Loading batch metadata for ${mediaIds.length} media items`);

        try {
            const results = [];
            const uncachedIds = [];
            
            // Check cache for each item
            for (const mediaId of mediaIds) {
                const cacheKey = includeExtraData ? `${mediaId}:extended` : `${mediaId}:basic`;
                const cached = await this.cacheService.getCachedMediaMetadata(modelSlug, cacheKey);
                
                if (cached) {
                    results.push({
                        mediaId,
                        success: true,
                        metadata: cached,
                        cached: true
                    });
                } else {
                    uncachedIds.push(mediaId);
                }
            }

            console.log(`💾 Batch cache: ${results.length} hits, ${uncachedIds.length} misses`);

            // Load uncached items in batches
            if (uncachedIds.length > 0) {
                const batchResults = await this.loadBatchMetadataFromDB(modelSlug, uncachedIds, includeExtraData);
                
                // Cache each result and add to results
                for (const result of batchResults) {
                    if (result.success) {
                        const cacheKey = includeExtraData ? `${result.mediaId}:extended` : `${result.mediaId}:basic`;
                        await this.cacheService.setCachedMediaMetadata(
                            modelSlug, 
                            cacheKey, 
                            result.metadata, 
                            this.defaultMetadataTTL
                        );
                    }
                    
                    results.push({
                        ...result,
                        cached: false
                    });
                }
            }

            // Sort results to match input order
            const orderedResults = mediaIds.map(id => 
                results.find(r => r.mediaId == id) || {
                    mediaId: id,
                    success: false,
                    error: 'Not found',
                    metadata: null,
                    cached: false
                }
            );

            console.log(`✅ Batch metadata loaded: ${orderedResults.filter(r => r.success).length}/${mediaIds.length} successful (${Date.now() - startTime}ms)`);

            return {
                success: true,
                results: orderedResults,
                totalRequested: mediaIds.length,
                successful: orderedResults.filter(r => r.success).length,
                cached: results.filter(r => r.cached).length,
                loadTime: Date.now() - startTime
            };

        } catch (error) {
            console.error('❌ Error in batch metadata loading:', error.message);
            return {
                success: false,
                error: error.message,
                results: [],
                loadTime: Date.now() - startTime
            };
        }
    }

    /**
     * Load batch metadata from database
     * @param {string} modelSlug 
     * @param {Array} mediaIds 
     * @param {boolean} includeExtraData 
     * @returns {Array}
     */
    async loadBatchMetadataFromDB(modelSlug, mediaIds, includeExtraData) {
        try {
            // Process in chunks to avoid overwhelming the database
            const results = [];
            const chunks = this.chunkArray(mediaIds, this.metadataBatchSize);

            for (const chunk of chunks) {
                const placeholders = chunk.map(() => '?').join(',');
                
                const query = `
                    SELECT 
                        id,
                        filename,
                        original_filename,
                        file_path,
                        mime_type,
                        file_size,
                        image_width,
                        image_height,
                        model_slug,
                        upload_date,
                        last_modified,
                        moderation_status,
                        category_id,
                        is_featured,
                        is_deleted,
                        blur_hash,
                        color_palette,
                        auto_tags
                    FROM model_media_library 
                    WHERE model_slug = ? AND id IN (${placeholders})
                `;

                const [rows] = await this.db.execute(query, [modelSlug, ...chunk]);

                for (const row of rows) {
                    let metadata = {
                        id: row.id,
                        filename: row.filename,
                        originalFilename: row.original_filename,
                        filePath: row.file_path,
                        mimeType: row.mime_type,
                        fileSize: row.file_size,
                        dimensions: {
                            width: row.image_width,
                            height: row.image_height,
                            aspectRatio: row.image_width && row.image_height ? 
                                (row.image_width / row.image_height).toFixed(2) : null
                        },
                        modelSlug: row.model_slug,
                        uploadDate: row.upload_date,
                        lastModified: row.last_modified,
                        moderationStatus: row.moderation_status,
                        categoryId: row.category_id,
                        isFeatured: !!row.is_featured,
                        isDeleted: !!row.is_deleted,
                        blurHash: row.blur_hash,
                        colorPalette: this.parseColorPalette(row.color_palette),
                        autoTags: this.parseAutoTags(row.auto_tags),
                        urls: this.generateMediaUrls(row)
                    };

                    // Add extra data if requested
                    if (includeExtraData) {
                        const extraData = await this.loadExtraMetadata(modelSlug, row.id);
                        metadata = { ...metadata, ...extraData };
                    }

                    results.push({
                        mediaId: row.id,
                        success: true,
                        metadata
                    });
                }

                // Add failed entries for missing IDs
                const foundIds = rows.map(r => r.id);
                const missingIds = chunk.filter(id => !foundIds.includes(parseInt(id)));
                
                for (const missingId of missingIds) {
                    results.push({
                        mediaId: missingId,
                        success: false,
                        error: 'Media not found',
                        metadata: null
                    });
                }
            }

            return results;

        } catch (error) {
            console.error('❌ Error loading batch metadata from DB:', error.message);
            return mediaIds.map(id => ({
                mediaId: id,
                success: false,
                error: error.message,
                metadata: null
            }));
        }
    }

    /**
     * Invalidate metadata cache for media item(s)
     * @param {string} modelSlug 
     * @param {number|Array} mediaIds 
     */
    async invalidateMetadataCache(modelSlug, mediaIds) {
        const ids = Array.isArray(mediaIds) ? mediaIds : [mediaIds];
        
        try {
            for (const mediaId of ids) {
                // Invalidate both basic and extended cache entries
                await this.cacheService.invalidateMedia(modelSlug, `${mediaId}:basic`);
                await this.cacheService.invalidateMedia(modelSlug, `${mediaId}:extended`);
            }
            
            console.log(`🗑️ Invalidated metadata cache for ${ids.length} media items in ${modelSlug}`);
        } catch (error) {
            console.error('❌ Error invalidating metadata cache:', error.message);
        }
    }

    /**
     * Update media metadata and invalidate cache
     * @param {string} modelSlug 
     * @param {number} mediaId 
     * @param {Object} updates 
     * @returns {Object}
     */
    async updateMediaMetadata(modelSlug, mediaId, updates) {
        try {
            // Build update query dynamically
            const allowedFields = [
                'filename', 'moderation_status', 'category_id', 
                'is_featured', 'blur_hash', 'color_palette', 
                'auto_tags', 'last_modified'
            ];
            
            const updateFields = [];
            const updateValues = [];
            
            for (const [field, value] of Object.entries(updates)) {
                if (allowedFields.includes(field)) {
                    updateFields.push(`${field} = ?`);
                    updateValues.push(value);
                }
            }

            if (updateFields.length === 0) {
                return {
                    success: false,
                    error: 'No valid fields to update'
                };
            }

            // Add timestamp and media ID
            updateFields.push('last_modified = NOW()');
            updateValues.push(mediaId, modelSlug);

            const query = `
                UPDATE model_media_library 
                SET ${updateFields.join(', ')}
                WHERE id = ? AND model_slug = ?
            `;

            const [result] = await this.db.execute(query, updateValues);

            if (result.affectedRows === 0) {
                return {
                    success: false,
                    error: 'Media not found or not updated'
                };
            }

            // Invalidate cache after successful update
            await this.invalidateMetadataCache(modelSlug, mediaId);
            
            console.log(`📊 Updated metadata for ${modelSlug}:${mediaId}`);

            return {
                success: true,
                updatedFields: Object.keys(updates).filter(k => allowedFields.includes(k)),
                affectedRows: result.affectedRows
            };

        } catch (error) {
            console.error('❌ Error updating media metadata:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Helper: Generate media URLs
     */
    generateMediaUrls(media) {
        const baseUrl = `/uploads/${media.model_slug}`;
        return {
            original: `${baseUrl}/originals/${media.filename}`,
            media: `${baseUrl}/media/${media.filename}`,
            thumbnail: `${baseUrl}/media/thumbs/${media.filename}`,
            preview: `${baseUrl}/media/previews/${media.filename}`
        };
    }

    /**
     * Helper: Parse color palette JSON
     */
    parseColorPalette(colorPaletteJson) {
        try {
            return colorPaletteJson ? JSON.parse(colorPaletteJson) : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Helper: Parse auto tags JSON
     */
    parseAutoTags(autoTagsJson) {
        try {
            return autoTagsJson ? JSON.parse(autoTagsJson) : [];
        } catch (e) {
            return [];
        }
    }

    /**
     * Helper: Calculate file age
     */
    calculateFileAge(uploadDate) {
        const now = Date.now();
        const uploaded = new Date(uploadDate).getTime();
        const ageMs = now - uploaded;
        
        const days = Math.floor(ageMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((ageMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        
        return {
            days,
            hours,
            isNew: days < 1,
            isRecent: days < 7
        };
    }

    /**
     * Helper: Calculate processing statistics
     */
    calculateProcessingStats(processingHistory) {
        if (!processingHistory || processingHistory.length === 0) {
            return { totalOperations: 0, averageTime: 0 };
        }

        const totalTime = processingHistory.reduce((sum, p) => sum + (p.processing_time_ms || 0), 0);
        const operations = processingHistory.map(p => p.operation_type);
        
        return {
            totalOperations: processingHistory.length,
            averageTime: Math.round(totalTime / processingHistory.length),
            operations: [...new Set(operations)],
            lastProcessed: processingHistory[0]?.processed_at
        };
    }

    /**
     * Helper: Summarize violations
     */
    summarizeViolations(violations) {
        if (!violations || violations.length === 0) {
            return { total: 0, types: [], hasActive: false };
        }

        const types = [...new Set(violations.map(v => v.violation_type))];
        const hasActive = violations.some(v => !v.auto_resolved);
        
        return {
            total: violations.length,
            types,
            hasActive,
            mostRecent: violations[0]?.detected_at
        };
    }

    /**
     * Helper: Split array into chunks
     */
    chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }

    /**
     * Get metadata service statistics
     * @returns {Object}
     */
    async getServiceStatistics() {
        try {
            const cacheStats = await this.cacheService.getCacheStatistics();
            
            return {
                success: true,
                cache: cacheStats,
                configuration: {
                    batchSize: this.metadataBatchSize,
                    defaultTTL: this.defaultMetadataTTL
                },
                uptime: process.uptime()
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = MediaMetadataService;