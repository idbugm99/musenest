/**
 * Admin Watermark Service - Secure Preview Generation
 * Generates watermarked images for admin preview while preventing unauthorized access
 * Created: August 7, 2025 - Phase 1 Planning
 */

const sharp = require('sharp'); // Will need: npm install sharp
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

class AdminWatermarkService {
    constructor() {
        this.watermarkConfig = {
            text: 'ADMIN PREVIEW',
            fontSize: 24,
            opacity: 0.4,
            color: { r: 255, g: 255, b: 255 }, // White text
            strokeColor: { r: 0, g: 0, b: 0 }, // Black outline
            strokeWidth: 1,
            rotation: -30, // Diagonal angle
            position: 'center'
        };
        
        // Cache watermarked images for performance (in-memory + file system)
        this.watermarkCache = new Map();
        this.cacheDirectory = path.join(__dirname, '../../cache/watermarked');
        
        // Security: Prevent client-side watermark removal
        this.securityTokens = new Map(); // image_id -> security_token
    }

    /**
     * Initialize the watermark service
     */
    async initialize() {
        try {
            // Ensure cache directory exists
            await fs.mkdir(this.cacheDirectory, { recursive: true });
            console.log('✅ AdminWatermarkService initialized');
            return true;
        } catch (error) {
            console.error('❌ AdminWatermarkService initialization failed:', error);
            return false;
        }
    }

    /**
     * Generate watermarked preview image
     * @param {string} originalImagePath - Path to original image
     * @param {number} contentId - Content moderation ID for audit logging
     * @param {number} adminUserId - Admin user requesting preview
     * @param {string} previewType - Type of preview (thumbnail, full, lightbox)
     * @returns {Object} { success, watermarkedPath, securityToken, error }
     */
    async generateWatermarkedPreview(originalImagePath, contentId, adminUserId, previewType = 'full') {
        try {
            // Validate input parameters
            if (!originalImagePath || !contentId || !adminUserId) {
                throw new Error('Missing required parameters for watermark generation');
            }

            // Check if original image exists
            const imageExists = await this.fileExists(originalImagePath);
            if (!imageExists) {
                throw new Error(`Original image not found: ${originalImagePath}`);
            }

            // Generate cache key
            const cacheKey = this.generateCacheKey(originalImagePath, contentId, previewType);
            
            // Check cache first
            const cachedResult = await this.getCachedWatermark(cacheKey);
            if (cachedResult) {
                // Log access for audit trail
                await this.logPreviewAccess(adminUserId, contentId, previewType, originalImagePath, 'cache_hit');
                return {
                    success: true,
                    watermarkedPath: cachedResult.watermarkedPath,
                    securityToken: cachedResult.securityToken,
                    cached: true
                };
            }

            // Generate new watermarked image
            const watermarkResult = await this.createWatermarkedImage(originalImagePath, cacheKey, previewType);
            
            if (!watermarkResult.success) {
                throw new Error(watermarkResult.error);
            }

            // Generate security token to prevent unauthorized access
            const securityToken = this.generateSecurityToken(contentId, adminUserId);
            
            // Cache the result
            const cacheData = {
                watermarkedPath: watermarkResult.watermarkedPath,
                securityToken: securityToken,
                createdAt: new Date(),
                adminUserId: adminUserId,
                originalPath: originalImagePath
            };
            
            await this.cacheWatermarkedImage(cacheKey, cacheData);

            // Log access for audit trail
            await this.logPreviewAccess(adminUserId, contentId, previewType, originalImagePath, 'generated');

            return {
                success: true,
                watermarkedPath: watermarkResult.watermarkedPath,
                securityToken: securityToken,
                cached: false
            };

        } catch (error) {
            console.error('Watermark generation error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Create watermarked image using Sharp
     */
    async createWatermarkedImage(originalImagePath, cacheKey, previewType) {
        try {
            const outputPath = path.join(this.cacheDirectory, `${cacheKey}.jpg`);
            
            // Load original image
            let imageProcessor = sharp(originalImagePath);
            
            // Get image metadata for positioning
            const metadata = await imageProcessor.metadata();
            const { width, height } = metadata;

            // Calculate watermark positioning
            const watermarkSvg = this.generateWatermarkSVG(width, height, previewType);
            
            // Create watermark overlay
            const watermarkBuffer = Buffer.from(watermarkSvg);
            
            // Apply watermark and optimize for web delivery
            await imageProcessor
                .composite([{
                    input: watermarkBuffer,
                    top: 0,
                    left: 0,
                }])
                .jpeg({ 
                    quality: 85, 
                    progressive: true,
                    mozjpeg: true 
                })
                .toFile(outputPath);

            return {
                success: true,
                watermarkedPath: outputPath
            };

        } catch (error) {
            return {
                success: false,
                error: `Failed to create watermarked image: ${error.message}`
            };
        }
    }

    /**
     * Generate SVG watermark overlay
     */
    generateWatermarkSVG(imageWidth, imageHeight, previewType) {
        const config = this.watermarkConfig;
        
        // Scale font size based on image size and preview type
        let fontSize = config.fontSize;
        if (previewType === 'thumbnail') fontSize = Math.max(12, fontSize * 0.5);
        if (previewType === 'lightbox') fontSize = Math.min(48, fontSize * 1.5);
        
        // Calculate positioning for diagonal watermark
        const centerX = imageWidth / 2;
        const centerY = imageHeight / 2;
        
        // Create multiple watermark instances across the image
        const watermarkInstances = [];
        const spacing = Math.max(imageWidth, imageHeight) / 3;
        
        for (let x = -spacing; x <= imageWidth + spacing; x += spacing) {
            for (let y = -spacing; y <= imageHeight + spacing; y += spacing) {
                watermarkInstances.push({
                    x: x,
                    y: y
                });
            }
        }

        const watermarkElements = watermarkInstances.map(pos => `
            <text x="${pos.x}" y="${pos.y}" 
                  font-family="Arial, sans-serif" 
                  font-size="${fontSize}" 
                  font-weight="bold"
                  fill="rgba(${config.color.r}, ${config.color.g}, ${config.color.b}, ${config.opacity})"
                  stroke="rgba(${config.strokeColor.r}, ${config.strokeColor.g}, ${config.strokeColor.b}, 0.8)"
                  stroke-width="${config.strokeWidth}"
                  text-anchor="middle"
                  dominant-baseline="middle"
                  transform="rotate(${config.rotation} ${pos.x} ${pos.y})">
                ${config.text}
            </text>
        `).join('');

        return `
            <svg width="${imageWidth}" height="${imageHeight}" xmlns="http://www.w3.org/2000/svg">
                ${watermarkElements}
            </svg>
        `;
    }

    /**
     * Validate security token before serving watermarked image
     */
    validateSecurityToken(contentId, adminUserId, token) {
        const expectedToken = this.generateSecurityToken(contentId, adminUserId);
        return crypto.timingSafeEqual(
            Buffer.from(token, 'hex'),
            Buffer.from(expectedToken, 'hex')
        );
    }

    /**
     * Generate secure token for watermarked image access
     */
    generateSecurityToken(contentId, adminUserId) {
        const secret = process.env.JWT_SECRET || 'fallback_secret';
        const data = `${contentId}:${adminUserId}:${Date.now()}`;
        return crypto.createHmac('sha256', secret).update(data).digest('hex').substring(0, 16);
    }

    /**
     * Generate cache key for consistent file naming
     */
    generateCacheKey(originalImagePath, contentId, previewType) {
        const pathHash = crypto.createHash('md5').update(originalImagePath).digest('hex').substring(0, 8);
        return `${contentId}_${pathHash}_${previewType}`;
    }

    /**
     * Check if watermarked image exists in cache
     */
    async getCachedWatermark(cacheKey) {
        try {
            // Check in-memory cache first
            if (this.watermarkCache.has(cacheKey)) {
                const cached = this.watermarkCache.get(cacheKey);
                
                // Verify file still exists
                const filePath = path.join(this.cacheDirectory, `${cacheKey}.jpg`);
                if (await this.fileExists(filePath)) {
                    return {
                        watermarkedPath: filePath,
                        securityToken: cached.securityToken
                    };
                } else {
                    // Remove from cache if file doesn't exist
                    this.watermarkCache.delete(cacheKey);
                }
            }
            
            return null;
        } catch (error) {
            console.error('Cache check error:', error);
            return null;
        }
    }

    /**
     * Cache watermarked image data
     */
    async cacheWatermarkedImage(cacheKey, data) {
        try {
            // Store in memory cache (limited size)
            if (this.watermarkCache.size > 100) {
                // Simple LRU: remove oldest entries
                const firstKey = this.watermarkCache.keys().next().value;
                this.watermarkCache.delete(firstKey);
            }
            
            this.watermarkCache.set(cacheKey, data);
            
            // File system cache is handled by createWatermarkedImage
            return true;
        } catch (error) {
            console.error('Cache storage error:', error);
            return false;
        }
    }

    /**
     * Log preview access for audit trail
     */
    async logPreviewAccess(adminUserId, contentId, previewType, imagePath, accessType) {
        try {
            // This will integrate with the admin_preview_log table
            const db = require('../../config/database');
            
            await db.execute(`
                INSERT INTO admin_preview_log (
                    admin_user_id, content_moderation_id, model_name, preview_type, 
                    image_path, ip_address, user_agent
                ) VALUES (?, ?, 
                    (SELECT model_name FROM content_moderation WHERE id = ? LIMIT 1),
                    ?, ?, ?, ?
                )
            `, [
                adminUserId,
                contentId,
                contentId,
                `${previewType}_${accessType}`,
                imagePath,
                '127.0.0.1', // Will be replaced with actual IP in production
                'AdminWatermarkService' // Will be replaced with actual user agent
            ]);
            
        } catch (error) {
            console.error('Preview access logging error:', error);
            // Don't fail the main operation if logging fails
        }
    }

    /**
     * Clean up old cached watermarks (run periodically)
     */
    async cleanupCache(maxAgeHours = 24) {
        try {
            const cutoffTime = new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000));
            
            // Clean memory cache
            for (const [key, data] of this.watermarkCache.entries()) {
                if (data.createdAt < cutoffTime) {
                    this.watermarkCache.delete(key);
                }
            }
            
            // Clean file system cache
            const files = await fs.readdir(this.cacheDirectory);
            for (const file of files) {
                const filePath = path.join(this.cacheDirectory, file);
                const stats = await fs.stat(filePath);
                
                if (stats.mtime < cutoffTime) {
                    await fs.unlink(filePath);
                }
            }
            
            console.log(`✅ Watermark cache cleanup completed - removed files older than ${maxAgeHours} hours`);
            
        } catch (error) {
            console.error('Cache cleanup error:', error);
        }
    }

    /**
     * Utility: Check if file exists
     */
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
}

module.exports = AdminWatermarkService;

// Usage Example:
// const watermarkService = new AdminWatermarkService();
// await watermarkService.initialize();
// 
// const result = await watermarkService.generateWatermarkedPreview(
//     '/path/to/original/image.jpg',
//     12345, // content_moderation_id
//     67890, // admin_user_id
//     'lightbox' // preview_type
// );
// 
// if (result.success) {
//     // Serve result.watermarkedPath with security token validation
// }