/**
 * Gallery Cache Service
 * Part of Phase C.1: Performance and Scalability Enhancements
 * Implements Redis-based caching for gallery rendering and media metadata
 */

class GalleryCacheService {
    constructor(redisClient = null) {
        // Use in-memory cache as fallback if Redis not available
        this.useRedis = !!redisClient;
        this.redisClient = redisClient;
        this.memoryCache = new Map();
        this.maxMemoryCacheSize = 100; // Maximum items in memory cache
        this.defaultTTL = 3600; // 1 hour default TTL
        
        console.log(`🚀 GalleryCacheService initialized with ${this.useRedis ? 'Redis' : 'Memory'} backend`);
    }

    /**
     * Get cached gallery data
     * @param {string} modelSlug 
     * @param {string} layoutType 
     * @returns {Object|null} Cached data or null
     */
    async getCachedGallery(modelSlug, layoutType = 'all') {
        const cacheKey = `gallery:${modelSlug}:${layoutType}`;
        
        try {
            if (this.useRedis) {
                const cached = await this.redisClient.get(cacheKey);
                if (cached) {
                    const data = JSON.parse(cached);
                    console.log(`💾 Cache HIT: ${cacheKey}`);
                    return data;
                }
            } else {
                // Use memory cache
                const cached = this.memoryCache.get(cacheKey);
                if (cached && cached.expires > Date.now()) {
                    console.log(`💾 Memory cache HIT: ${cacheKey}`);
                    return cached.data;
                } else if (cached) {
                    // Remove expired entry
                    this.memoryCache.delete(cacheKey);
                }
            }
            
            console.log(`💾 Cache MISS: ${cacheKey}`);
            return null;
        } catch (error) {
            console.error(`❌ Cache get error for ${cacheKey}:`, error.message);
            return null;
        }
    }

    /**
     * Set cached gallery data
     * @param {string} modelSlug 
     * @param {string} layoutType 
     * @param {Object} data 
     * @param {number} ttl - Time to live in seconds
     */
    async setCachedGallery(modelSlug, layoutType, data, ttl = null) {
        const cacheKey = `gallery:${modelSlug}:${layoutType}`;
        const actualTTL = ttl || this.defaultTTL;
        
        try {
            if (this.useRedis) {
                await this.redisClient.setex(cacheKey, actualTTL, JSON.stringify(data));
            } else {
                // Use memory cache
                this.enforceMemoryCacheSize();
                this.memoryCache.set(cacheKey, {
                    data,
                    expires: Date.now() + (actualTTL * 1000)
                });
            }
            
            console.log(`💾 Cache SET: ${cacheKey} (TTL: ${actualTTL}s)`);
        } catch (error) {
            console.error(`❌ Cache set error for ${cacheKey}:`, error.message);
        }
    }

    /**
     * Get cached media metadata
     * @param {string} modelSlug 
     * @param {number|string} mediaId 
     * @returns {Object|null} Cached metadata or null
     */
    async getCachedMediaMetadata(modelSlug, mediaId) {
        const cacheKey = `media:${modelSlug}:${mediaId}`;
        
        try {
            if (this.useRedis) {
                const cached = await this.redisClient.get(cacheKey);
                if (cached) {
                    console.log(`💾 Media cache HIT: ${cacheKey}`);
                    return JSON.parse(cached);
                }
            } else {
                const cached = this.memoryCache.get(cacheKey);
                if (cached && cached.expires > Date.now()) {
                    console.log(`💾 Media memory cache HIT: ${cacheKey}`);
                    return cached.data;
                } else if (cached) {
                    this.memoryCache.delete(cacheKey);
                }
            }
            
            return null;
        } catch (error) {
            console.error(`❌ Media cache get error for ${cacheKey}:`, error.message);
            return null;
        }
    }

    /**
     * Set cached media metadata
     * @param {string} modelSlug 
     * @param {number|string} mediaId 
     * @param {Object} metadata 
     * @param {number} ttl 
     */
    async setCachedMediaMetadata(modelSlug, mediaId, metadata, ttl = null) {
        const cacheKey = `media:${modelSlug}:${mediaId}`;
        const actualTTL = ttl || (this.defaultTTL * 2); // Media metadata cached longer
        
        try {
            if (this.useRedis) {
                await this.redisClient.setex(cacheKey, actualTTL, JSON.stringify(metadata));
            } else {
                this.enforceMemoryCacheSize();
                this.memoryCache.set(cacheKey, {
                    data: metadata,
                    expires: Date.now() + (actualTTL * 1000)
                });
            }
            
            console.log(`💾 Media cache SET: ${cacheKey} (TTL: ${actualTTL}s)`);
        } catch (error) {
            console.error(`❌ Media cache set error for ${cacheKey}:`, error.message);
        }
    }

    /**
     * Invalidate all gallery cache for a model
     * @param {string} modelSlug 
     */
    async invalidateGallery(modelSlug) {
        try {
            if (this.useRedis) {
                const pattern = `gallery:${modelSlug}:*`;
                const keys = await this.redisClient.keys(pattern);
                
                if (keys.length > 0) {
                    await this.redisClient.del(keys);
                    console.log(`🗑️ Invalidated ${keys.length} gallery cache entries for ${modelSlug}`);
                }
            } else {
                // Clear memory cache entries for this model
                const keysToDelete = [];
                for (const [key] of this.memoryCache.entries()) {
                    if (key.startsWith(`gallery:${modelSlug}:`)) {
                        keysToDelete.push(key);
                    }
                }
                
                keysToDelete.forEach(key => this.memoryCache.delete(key));
                console.log(`🗑️ Invalidated ${keysToDelete.length} gallery cache entries for ${modelSlug}`);
            }
        } catch (error) {
            console.error(`❌ Gallery cache invalidation error for ${modelSlug}:`, error.message);
        }
    }

    /**
     * Invalidate media cache for a specific item
     * @param {string} modelSlug 
     * @param {number|string} mediaId 
     */
    async invalidateMedia(modelSlug, mediaId) {
        const cacheKey = `media:${modelSlug}:${mediaId}`;
        
        try {
            if (this.useRedis) {
                await this.redisClient.del(cacheKey);
            } else {
                this.memoryCache.delete(cacheKey);
            }
            
            console.log(`🗑️ Invalidated media cache: ${cacheKey}`);
        } catch (error) {
            console.error(`❌ Media cache invalidation error for ${cacheKey}:`, error.message);
        }
    }

    /**
     * Invalidate all cache for a model (galleries + media)
     * @param {string} modelSlug 
     */
    async invalidateAllForModel(modelSlug) {
        try {
            if (this.useRedis) {
                const patterns = [
                    `gallery:${modelSlug}:*`,
                    `media:${modelSlug}:*`
                ];
                
                let totalDeleted = 0;
                for (const pattern of patterns) {
                    const keys = await this.redisClient.keys(pattern);
                    if (keys.length > 0) {
                        await this.redisClient.del(keys);
                        totalDeleted += keys.length;
                    }
                }
                
                console.log(`🗑️ Invalidated ${totalDeleted} total cache entries for ${modelSlug}`);
            } else {
                const keysToDelete = [];
                for (const [key] of this.memoryCache.entries()) {
                    if (key.startsWith(`gallery:${modelSlug}:`) || key.startsWith(`media:${modelSlug}:`)) {
                        keysToDelete.push(key);
                    }
                }
                
                keysToDelete.forEach(key => this.memoryCache.delete(key));
                console.log(`🗑️ Invalidated ${keysToDelete.length} total cache entries for ${modelSlug}`);
            }
        } catch (error) {
            console.error(`❌ Full cache invalidation error for ${modelSlug}:`, error.message);
        }
    }

    /**
     * Get cached gallery section data
     * @param {string} modelSlug 
     * @param {number} sectionId 
     * @returns {Object|null} Cached section or null
     */
    async getCachedGallerySection(modelSlug, sectionId) {
        const cacheKey = `section:${modelSlug}:${sectionId}`;
        
        try {
            if (this.useRedis) {
                const cached = await this.redisClient.get(cacheKey);
                if (cached) {
                    console.log(`💾 Section cache HIT: ${cacheKey}`);
                    return JSON.parse(cached);
                }
            } else {
                const cached = this.memoryCache.get(cacheKey);
                if (cached && cached.expires > Date.now()) {
                    console.log(`💾 Section memory cache HIT: ${cacheKey}`);
                    return cached.data;
                } else if (cached) {
                    this.memoryCache.delete(cacheKey);
                }
            }
            
            return null;
        } catch (error) {
            console.error(`❌ Section cache get error for ${cacheKey}:`, error.message);
            return null;
        }
    }

    /**
     * Set cached gallery section data
     * @param {string} modelSlug 
     * @param {number} sectionId 
     * @param {Object} sectionData 
     * @param {number} ttl 
     */
    async setCachedGallerySection(modelSlug, sectionId, sectionData, ttl = null) {
        const cacheKey = `section:${modelSlug}:${sectionId}`;
        const actualTTL = ttl || this.defaultTTL;
        
        try {
            if (this.useRedis) {
                await this.redisClient.setex(cacheKey, actualTTL, JSON.stringify(sectionData));
            } else {
                this.enforceMemoryCacheSize();
                this.memoryCache.set(cacheKey, {
                    data: sectionData,
                    expires: Date.now() + (actualTTL * 1000)
                });
            }
            
            console.log(`💾 Section cache SET: ${cacheKey} (TTL: ${actualTTL}s)`);
        } catch (error) {
            console.error(`❌ Section cache set error for ${cacheKey}:`, error.message);
        }
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    async getCacheStatistics() {
        try {
            if (this.useRedis) {
                const info = await this.redisClient.info('memory');
                const keyCount = await this.getRedisKeyCount();
                
                return {
                    backend: 'redis',
                    connected: true,
                    keyCount,
                    memoryInfo: this.parseRedisMemoryInfo(info)
                };
            } else {
                return {
                    backend: 'memory',
                    connected: true,
                    keyCount: this.memoryCache.size,
                    maxSize: this.maxMemoryCacheSize,
                    memoryUsage: this.getMemoryCacheSize()
                };
            }
        } catch (error) {
            return {
                backend: this.useRedis ? 'redis' : 'memory',
                connected: false,
                error: error.message
            };
        }
    }

    /**
     * Get Redis key count for gallery/media patterns
     */
    async getRedisKeyCount() {
        try {
            const patterns = ['gallery:*', 'media:*', 'section:*'];
            let totalCount = 0;
            
            for (const pattern of patterns) {
                const keys = await this.redisClient.keys(pattern);
                totalCount += keys.length;
            }
            
            return totalCount;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Parse Redis memory info
     */
    parseRedisMemoryInfo(info) {
        const lines = info.split('\r\n');
        const memoryData = {};
        
        lines.forEach(line => {
            if (line.includes('used_memory:') || line.includes('used_memory_human:') || line.includes('maxmemory:')) {
                const [key, value] = line.split(':');
                memoryData[key] = value;
            }
        });
        
        return memoryData;
    }

    /**
     * Enforce memory cache size limits
     */
    enforceMemoryCacheSize() {
        if (this.memoryCache.size >= this.maxMemoryCacheSize) {
            // Remove oldest entries (simple LRU approximation)
            const entriesToRemove = this.memoryCache.size - this.maxMemoryCacheSize + 10; // Remove extra for breathing room
            const keys = Array.from(this.memoryCache.keys()).slice(0, entriesToRemove);
            
            keys.forEach(key => this.memoryCache.delete(key));
            console.log(`🗑️ Enforced memory cache size limit, removed ${keys.length} entries`);
        }
    }

    /**
     * Get estimated memory cache size
     */
    getMemoryCacheSize() {
        let totalSize = 0;
        for (const [key, value] of this.memoryCache.entries()) {
            totalSize += key.length * 2; // String character size
            totalSize += JSON.stringify(value).length * 2;
        }
        return {
            bytes: totalSize,
            kb: Math.round(totalSize / 1024 * 100) / 100,
            mb: Math.round(totalSize / (1024 * 1024) * 100) / 100
        };
    }

    /**
     * Clear all cache
     */
    async clearAllCache() {
        try {
            if (this.useRedis) {
                const patterns = ['gallery:*', 'media:*', 'section:*'];
                let totalDeleted = 0;
                
                for (const pattern of patterns) {
                    const keys = await this.redisClient.keys(pattern);
                    if (keys.length > 0) {
                        await this.redisClient.del(keys);
                        totalDeleted += keys.length;
                    }
                }
                
                console.log(`🗑️ Cleared all cache: ${totalDeleted} entries deleted`);
            } else {
                const entriesCleared = this.memoryCache.size;
                this.memoryCache.clear();
                console.log(`🗑️ Cleared all memory cache: ${entriesCleared} entries deleted`);
            }
        } catch (error) {
            console.error('❌ Error clearing all cache:', error.message);
        }
    }

    /**
     * Warm up cache for a model (preload frequently accessed data)
     * @param {string} modelSlug 
     * @param {Object} dbConnection 
     */
    async warmUpCache(modelSlug, dbConnection) {
        console.log(`🔥 Warming up cache for model: ${modelSlug}`);
        
        try {
            // Preload gallery sections
            const [sections] = await dbConnection.execute(`
                SELECT id, section_name, layout_type, layout_settings 
                FROM model_gallery_sections 
                WHERE model_slug = ? AND is_active = 1
            `, [modelSlug]);

            for (const section of sections) {
                await this.setCachedGallerySection(modelSlug, section.id, section, this.defaultTTL * 2);
            }

            // Preload recent media metadata
            const [recentMedia] = await dbConnection.execute(`
                SELECT id, filename, file_path, image_width, image_height, file_size, moderation_status
                FROM model_media_library 
                WHERE model_slug = ? AND is_deleted = 0
                ORDER BY upload_date DESC
                LIMIT 50
            `, [modelSlug]);

            for (const media of recentMedia) {
                await this.setCachedMediaMetadata(modelSlug, media.id, media, this.defaultTTL * 3);
            }

            console.log(`🔥 Cache warmed up for ${modelSlug}: ${sections.length} sections, ${recentMedia.length} media items`);
        } catch (error) {
            console.error(`❌ Error warming up cache for ${modelSlug}:`, error.message);
        }
    }
}

module.exports = GalleryCacheService;