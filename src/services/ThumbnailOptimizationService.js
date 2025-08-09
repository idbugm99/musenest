/**
 * Thumbnail Optimization Service
 * Part of Phase C.4: Thumbnail generation optimization
 * Provides intelligent thumbnail generation with caching and batch processing
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

class ThumbnailOptimizationService {
    constructor(cacheService, processingQueue = null) {
        this.cacheService = cacheService;
        this.processingQueue = processingQueue;
        
        // Thumbnail configuration
        this.thumbnailSizes = {
            tiny: { width: 100, height: 100, quality: 70 },
            small: { width: 200, height: 200, quality: 75 },
            medium: { width: 400, height: 400, quality: 80 },
            large: { width: 800, height: 800, quality: 85 },
            // Gallery-specific sizes
            grid: { width: 300, height: 300, quality: 80 },
            masonry: { width: 350, height: null, quality: 85 }, // Auto height
            carousel: { width: 1200, height: 600, quality: 90 }
        };
        
        // Cache settings
        this.thumbnailCacheTTL = 86400; // 24 hours
        this.generateConcurrency = 3; // Max concurrent thumbnail generations
        this.activeGenerations = new Set();
        
        console.log('📸 ThumbnailOptimizationService initialized');
    }

    /**
     * Get optimized thumbnail with intelligent caching
     * @param {string} modelSlug 
     * @param {string} originalPath - Path to original image
     * @param {string|Object} sizeSpec - Size name or custom size object
     * @param {Object} options - Additional options
     * @returns {Object} Thumbnail result
     */
    async getOptimizedThumbnail(modelSlug, originalPath, sizeSpec, options = {}) {
        const startTime = Date.now();
        
        try {
            // Resolve size configuration
            const sizeConfig = this.resolveSizeConfig(sizeSpec);
            if (!sizeConfig) {
                throw new Error(`Invalid size specification: ${sizeSpec}`);
            }

            // Generate cache key based on file and size
            const cacheKey = await this.generateThumbnailCacheKey(originalPath, sizeConfig, options);
            
            // Check cache first
            const cachedThumbnail = await this.getCachedThumbnail(modelSlug, cacheKey);
            if (cachedThumbnail && await this.thumbnailExists(cachedThumbnail.path)) {
                console.log(`💾 Thumbnail cache HIT: ${cacheKey} (${Date.now() - startTime}ms)`);
                return {
                    success: true,
                    thumbnailPath: cachedThumbnail.path,
                    thumbnailUrl: cachedThumbnail.url,
                    size: sizeConfig,
                    cached: true,
                    processingTime: Date.now() - startTime
                };
            }

            // Generate thumbnail if not cached
            const generationResult = await this.generateThumbnail(
                modelSlug, 
                originalPath, 
                sizeConfig, 
                options
            );

            if (generationResult.success) {
                // Cache the result
                await this.setCachedThumbnail(modelSlug, cacheKey, {
                    path: generationResult.thumbnailPath,
                    url: generationResult.thumbnailUrl,
                    size: sizeConfig,
                    generatedAt: Date.now()
                });

                console.log(`📸 Generated and cached thumbnail: ${cacheKey} (${Date.now() - startTime}ms)`);
            }

            return {
                ...generationResult,
                cached: false,
                processingTime: Date.now() - startTime
            };

        } catch (error) {
            console.error('❌ Error getting optimized thumbnail:', error.message);
            return {
                success: false,
                error: error.message,
                cached: false,
                processingTime: Date.now() - startTime
            };
        }
    }

    /**
     * Generate multiple thumbnail sizes for a media item
     * @param {string} modelSlug 
     * @param {string} originalPath 
     * @param {Array} sizeSpecs - Array of size specifications
     * @param {Object} options 
     * @returns {Object}
     */
    async generateMultipleThumbnails(modelSlug, originalPath, sizeSpecs, options = {}) {
        const startTime = Date.now();
        console.log(`📸 Generating ${sizeSpecs.length} thumbnail sizes for ${originalPath}`);

        try {
            const results = [];
            const concurrencyLimit = Math.min(this.generateConcurrency, sizeSpecs.length);
            
            // Process thumbnails in batches to control resource usage
            for (let i = 0; i < sizeSpecs.length; i += concurrencyLimit) {
                const batch = sizeSpecs.slice(i, i + concurrencyLimit);
                
                const batchPromises = batch.map(async (sizeSpec) => {
                    try {
                        const result = await this.getOptimizedThumbnail(
                            modelSlug, 
                            originalPath, 
                            sizeSpec, 
                            options
                        );
                        
                        return {
                            size: typeof sizeSpec === 'string' ? sizeSpec : 'custom',
                            sizeSpec,
                            ...result
                        };
                    } catch (error) {
                        return {
                            size: typeof sizeSpec === 'string' ? sizeSpec : 'custom',
                            sizeSpec,
                            success: false,
                            error: error.message
                        };
                    }
                });

                const batchResults = await Promise.all(batchPromises);
                results.push(...batchResults);
                
                // Small delay between batches to prevent resource exhaustion
                if (i + concurrencyLimit < sizeSpecs.length) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }

            const successful = results.filter(r => r.success);
            const failed = results.filter(r => !r.success);

            console.log(`✅ Multi-thumbnail generation: ${successful.length}/${sizeSpecs.length} successful (${Date.now() - startTime}ms)`);

            return {
                success: true,
                results,
                successful: successful.length,
                failed: failed.length,
                totalProcessingTime: Date.now() - startTime
            };

        } catch (error) {
            console.error('❌ Error in multi-thumbnail generation:', error.message);
            return {
                success: false,
                error: error.message,
                results: [],
                totalProcessingTime: Date.now() - startTime
            };
        }
    }

    /**
     * Generate a single thumbnail
     * @param {string} modelSlug 
     * @param {string} originalPath 
     * @param {Object} sizeConfig 
     * @param {Object} options 
     * @returns {Object}
     */
    async generateThumbnail(modelSlug, originalPath, sizeConfig, options = {}) {
        const generationId = `${modelSlug}-${Date.now()}-${Math.random()}`;
        
        try {
            // Prevent duplicate generations
            if (this.activeGenerations.has(originalPath + JSON.stringify(sizeConfig))) {
                await this.waitForGeneration(originalPath + JSON.stringify(sizeConfig));
                return this.getOptimizedThumbnail(modelSlug, originalPath, sizeConfig, options);
            }

            this.activeGenerations.add(originalPath + JSON.stringify(sizeConfig));

            // Ensure source file exists
            try {
                await fs.access(originalPath);
            } catch (error) {
                throw new Error(`Source image not found: ${originalPath}`);
            }

            // Generate thumbnail filename and path
            const originalFilename = path.basename(originalPath, path.extname(originalPath));
            const ext = path.extname(originalPath);
            const sizeString = sizeConfig.height ? 
                `${sizeConfig.width}x${sizeConfig.height}` : 
                `${sizeConfig.width}w`;
            
            const thumbnailFilename = `${originalFilename}_${sizeString}${ext}`;
            const thumbnailPath = this.getThumbnailPath(modelSlug, thumbnailFilename);
            
            // Ensure thumbnail directory exists
            await fs.mkdir(path.dirname(thumbnailPath), { recursive: true });

            // Generate thumbnail using Sharp
            let sharpProcessor = sharp(originalPath);
            
            // Apply resize with smart cropping
            if (sizeConfig.height) {
                sharpProcessor = sharpProcessor.resize(sizeConfig.width, sizeConfig.height, {
                    fit: options.fit || 'cover',
                    position: options.position || 'center'
                });
            } else {
                sharpProcessor = sharpProcessor.resize(sizeConfig.width, null, {
                    fit: 'inside',
                    withoutEnlargement: true
                });
            }

            // Apply format-specific optimizations
            if (ext.toLowerCase() === '.jpg' || ext.toLowerCase() === '.jpeg') {
                sharpProcessor = sharpProcessor.jpeg({ 
                    quality: sizeConfig.quality,
                    progressive: true,
                    mozjpeg: true
                });
            } else if (ext.toLowerCase() === '.png') {
                sharpProcessor = sharpProcessor.png({ 
                    quality: sizeConfig.quality,
                    compressionLevel: 8
                });
            } else if (ext.toLowerCase() === '.webp') {
                sharpProcessor = sharpProcessor.webp({ 
                    quality: sizeConfig.quality 
                });
            }

            // Apply additional optimizations if specified
            if (options.sharpen) {
                sharpProcessor = sharpProcessor.sharpen();
            }

            if (options.grayscale) {
                sharpProcessor = sharpProcessor.grayscale();
            }

            // Generate the thumbnail
            await sharpProcessor.toFile(thumbnailPath);

            // Get generated file stats
            const stats = await fs.stat(thumbnailPath);
            const metadata = await sharp(thumbnailPath).metadata();

            const thumbnailUrl = `/uploads/${modelSlug}/media/thumbs/${thumbnailFilename}`;

            console.log(`📸 Generated thumbnail: ${thumbnailFilename} (${stats.size} bytes, ${metadata.width}x${metadata.height})`);

            return {
                success: true,
                thumbnailPath,
                thumbnailUrl,
                thumbnailFilename,
                size: sizeConfig,
                fileSize: stats.size,
                dimensions: {
                    width: metadata.width,
                    height: metadata.height
                }
            };

        } catch (error) {
            console.error(`❌ Thumbnail generation failed for ${originalPath}:`, error.message);
            return {
                success: false,
                error: error.message
            };
        } finally {
            this.activeGenerations.delete(originalPath + JSON.stringify(sizeConfig));
        }
    }

    /**
     * Queue thumbnail generation in background
     * @param {string} modelSlug 
     * @param {string} mediaId 
     * @param {Array} sizeSpecs 
     * @param {Object} options 
     * @returns {string} Job ID
     */
    async queueThumbnailGeneration(modelSlug, mediaId, sizeSpecs, options = {}) {
        if (!this.processingQueue) {
            throw new Error('Background processing queue not available');
        }

        const jobId = this.processingQueue.addThumbnailJob({
            mediaId,
            modelSlug,
            sizes: sizeSpecs,
            options,
            priority: options.priority || 'normal'
        });

        console.log(`📋 Queued thumbnail generation: ${jobId} for media ${mediaId}`);
        return jobId;
    }

    /**
     * Cleanup old thumbnails for a model
     * @param {string} modelSlug 
     * @param {number} maxAge - Maximum age in days
     * @returns {Object}
     */
    async cleanupOldThumbnails(modelSlug, maxAge = 30) {
        const startTime = Date.now();
        console.log(`🧹 Cleaning up thumbnails older than ${maxAge} days for ${modelSlug}`);

        try {
            const thumbnailDir = path.join(__dirname, '../../public/uploads', modelSlug, 'media', 'thumbs');
            
            let files;
            try {
                files = await fs.readdir(thumbnailDir);
            } catch (error) {
                // Directory doesn't exist
                return {
                    success: true,
                    cleaned: 0,
                    message: 'Thumbnail directory does not exist'
                };
            }

            const maxAgeMs = maxAge * 24 * 60 * 60 * 1000;
            const cutoffTime = Date.now() - maxAgeMs;
            
            let cleanedCount = 0;
            let totalSize = 0;

            for (const file of files) {
                const filePath = path.join(thumbnailDir, file);
                
                try {
                    const stats = await fs.stat(filePath);
                    
                    if (stats.mtime.getTime() < cutoffTime) {
                        totalSize += stats.size;
                        await fs.unlink(filePath);
                        cleanedCount++;
                        
                        // Also remove from cache
                        await this.invalidateThumbnailCache(modelSlug, file);
                    }
                } catch (error) {
                    console.warn(`⚠️ Error processing thumbnail file ${file}:`, error.message);
                }
            }

            console.log(`🧹 Cleaned up ${cleanedCount} old thumbnails, freed ${Math.round(totalSize / 1024)} KB (${Date.now() - startTime}ms)`);

            return {
                success: true,
                cleaned: cleanedCount,
                freedSpace: totalSize,
                processingTime: Date.now() - startTime
            };

        } catch (error) {
            console.error('❌ Error cleaning up old thumbnails:', error.message);
            return {
                success: false,
                error: error.message,
                cleaned: 0,
                processingTime: Date.now() - startTime
            };
        }
    }

    /**
     * Get thumbnail optimization statistics
     * @param {string} modelSlug 
     * @returns {Object}
     */
    async getThumbnailStatistics(modelSlug) {
        try {
            const thumbnailDir = path.join(__dirname, '../../public/uploads', modelSlug, 'media', 'thumbs');
            
            let files;
            try {
                files = await fs.readdir(thumbnailDir);
            } catch (error) {
                return {
                    success: true,
                    totalThumbnails: 0,
                    totalSize: 0,
                    averageSize: 0,
                    sizesByType: {}
                };
            }

            let totalSize = 0;
            const sizesByType = {};
            
            for (const file of files) {
                const filePath = path.join(thumbnailDir, file);
                
                try {
                    const stats = await fs.stat(filePath);
                    totalSize += stats.size;
                    
                    // Categorize by thumbnail type
                    const sizeMatch = file.match(/_(\d+x\d+|\d+w)_/);
                    if (sizeMatch) {
                        const sizeType = sizeMatch[1];
                        sizesByType[sizeType] = (sizesByType[sizeType] || 0) + 1;
                    }
                } catch (error) {
                    // Skip files that can't be accessed
                }
            }

            return {
                success: true,
                modelSlug,
                totalThumbnails: files.length,
                totalSize,
                averageSize: files.length > 0 ? Math.round(totalSize / files.length) : 0,
                sizesByType,
                activeGenerations: this.activeGenerations.size
            };

        } catch (error) {
            console.error('❌ Error getting thumbnail statistics:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Helper methods

    resolveSizeConfig(sizeSpec) {
        if (typeof sizeSpec === 'string') {
            return this.thumbnailSizes[sizeSpec] || null;
        } else if (typeof sizeSpec === 'object' && sizeSpec.width) {
            return {
                width: sizeSpec.width,
                height: sizeSpec.height || null,
                quality: sizeSpec.quality || 80
            };
        }
        return null;
    }

    async generateThumbnailCacheKey(originalPath, sizeConfig, options) {
        const stats = await fs.stat(originalPath);
        const hash = crypto.createHash('md5')
            .update(originalPath)
            .update(JSON.stringify(sizeConfig))
            .update(JSON.stringify(options))
            .update(stats.mtime.toISOString())
            .digest('hex');
        
        return `thumb:${hash}`;
    }

    async getCachedThumbnail(modelSlug, cacheKey) {
        try {
            return await this.cacheService.getCachedMediaMetadata(modelSlug, cacheKey);
        } catch (error) {
            return null;
        }
    }

    async setCachedThumbnail(modelSlug, cacheKey, thumbnailData) {
        try {
            await this.cacheService.setCachedMediaMetadata(
                modelSlug, 
                cacheKey, 
                thumbnailData, 
                this.thumbnailCacheTTL
            );
        } catch (error) {
            console.warn('⚠️ Failed to cache thumbnail metadata:', error.message);
        }
    }

    async thumbnailExists(thumbnailPath) {
        try {
            await fs.access(thumbnailPath);
            return true;
        } catch (error) {
            return false;
        }
    }

    getThumbnailPath(modelSlug, filename) {
        return path.join(__dirname, '../../public/uploads', modelSlug, 'media', 'thumbs', filename);
    }

    async invalidateThumbnailCache(modelSlug, filename) {
        // This would need to match against cached keys - simplified for now
        console.log(`🗑️ Invalidated thumbnail cache for ${filename}`);
    }

    async waitForGeneration(key, timeout = 5000) {
        const startTime = Date.now();
        while (this.activeGenerations.has(key) && (Date.now() - startTime) < timeout) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
}

module.exports = ThumbnailOptimizationService;