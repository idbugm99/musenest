/**
 * Image Processing Service for Model Media Library
 * Handles image editing operations: crop, rotate, resize, format conversion
 * Part of Phase 2: Backend Implementation for Media Library System
 */

const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');
const crypto = require('crypto');

class ImageProcessingService {
    constructor(dbConnection) {
        this.db = dbConnection;
        this.baseUploadPath = path.join(__dirname, '../../public/uploads');
        
        // Configuration for processing operations
        this.config = {
            // Output quality settings
            jpegQuality: 95,
            webpQuality: 90,
            pngCompression: 9,
            
            // Size constraints
            maxDimension: 4000,
            minDimension: 50,
            
            // Format support
            supportedInputFormats: ['jpeg', 'jpg', 'png', 'gif', 'webp', 'bmp', 'tiff'],
            supportedOutputFormats: ['jpeg', 'png', 'webp'],
            
            // Processing directories
            editedDir: 'edited',
            versionsDir: 'versions',
            
            // History tracking
            keepEditHistory: true,
            maxHistoryVersions: 10
        };
    }

    /**
     * Initialize the image processing service
     */
    async initialize() {
        try {
            // Test Sharp library
            await this.testSharpLibrary();
            
            // Test database connectivity
            await this.testDatabaseConnection();
            
            console.log('✅ ImageProcessingService initialized successfully');
            return { success: true };
        } catch (error) {
            console.error('❌ ImageProcessingService initialization failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Test Sharp library functionality
     */
    async testSharpLibrary() {
        try {
            // Create a small test image
            const testBuffer = await sharp({
                create: {
                    width: 100,
                    height: 100,
                    channels: 3,
                    background: { r: 255, g: 0, b: 0 }
                }
            })
            .jpeg()
            .toBuffer();

            // Test basic operations
            const metadata = await sharp(testBuffer).metadata();
            if (metadata.width !== 100 || metadata.height !== 100) {
                throw new Error('Sharp test failed: incorrect dimensions');
            }

            console.log('✅ Sharp library test passed');
        } catch (error) {
            throw new Error(`Sharp library test failed: ${error.message}`);
        }
    }

    /**
     * Test database connectivity
     */
    async testDatabaseConnection() {
        try {
            await this.db.execute('SELECT 1');
            console.log('✅ Database connection verified for image processing');
        } catch (error) {
            throw new Error(`Database connection failed: ${error.message}`);
        }
    }

    /**
     * Crop image to specified dimensions and position
     * @param {string} mediaId - Media library item ID
     * @param {Object} cropParams - Crop parameters
     * @returns {Object} Processing result
     */
    async cropImage(mediaId, cropParams) {
        const { x, y, width, height, outputFormat = 'jpeg', quality = null } = cropParams;

        console.log(`🔄 Cropping image (media ID: ${mediaId})`);
        console.log(`📐 Crop area: ${x},${y} ${width}x${height}`);

        try {
            // Get media details from database
            const mediaInfo = await this.getMediaInfo(mediaId);
            if (!mediaInfo.success) {
                throw new Error(mediaInfo.error);
            }

            const media = mediaInfo.media;
            const originalPath = this.getAbsolutePath(media.file_path);

            // Validate crop parameters
            const validation = await this.validateCropParameters(originalPath, { x, y, width, height });
            if (!validation.valid) {
                throw new Error(`Invalid crop parameters: ${validation.error}`);
            }

            // Generate output filename
            const outputFilename = this.generateEditedFilename(media.filename, 'crop', outputFormat);
            const outputPath = await this.prepareOutputPath(media.model_slug, outputFilename);

            // Perform crop operation
            let processor = sharp(originalPath);
            
            // Apply crop
            processor = processor.extract({
                left: Math.round(x),
                top: Math.round(y),
                width: Math.round(width),
                height: Math.round(height)
            });

            // Apply output format and quality
            processor = this.applyOutputFormat(processor, outputFormat, quality);

            // Save processed image
            await processor.toFile(outputPath.absolute);

            // Update database with edit history
            const historyResult = await this.recordEditHistory(mediaId, 'crop', {
                cropArea: { x, y, width, height },
                outputFormat,
                quality,
                originalDimensions: validation.originalDimensions,
                newDimensions: { width: Math.round(width), height: Math.round(height) }
            }, outputPath.relative);

            // Get final image metadata
            const finalMetadata = await sharp(outputPath.absolute).metadata();

            console.log(`✅ Image cropped successfully: ${width}x${height} → ${finalMetadata.width}x${finalMetadata.height}`);

            return {
                success: true,
                editId: historyResult.editId,
                originalFile: media.file_path,
                editedFile: outputPath.relative,
                editedUrl: `/uploads/${media.model_slug}/${this.config.editedDir}/${outputFilename}`,
                operation: 'crop',
                parameters: cropParams,
                originalDimensions: validation.originalDimensions,
                newDimensions: {
                    width: finalMetadata.width,
                    height: finalMetadata.height
                },
                fileSize: (await fs.stat(outputPath.absolute)).size,
                format: finalMetadata.format
            };

        } catch (error) {
            console.error('❌ Crop operation failed:', error);
            return {
                success: false,
                error: error.message,
                operation: 'crop',
                parameters: cropParams
            };
        }
    }

    /**
     * Rotate image by specified degrees
     * @param {string} mediaId - Media library item ID
     * @param {Object} rotateParams - Rotation parameters
     * @returns {Object} Processing result
     */
    async rotateImage(mediaId, rotateParams) {
        const { angle, outputFormat = 'jpeg', quality = null } = rotateParams;

        console.log(`🔄 Rotating image (media ID: ${mediaId}) by ${angle} degrees`);

        try {
            // Validate rotation angle
            const normalizedAngle = this.normalizeRotationAngle(angle);
            if (normalizedAngle === null) {
                throw new Error(`Invalid rotation angle: ${angle}. Must be between -360 and 360 degrees.`);
            }

            // Get media details
            const mediaInfo = await this.getMediaInfo(mediaId);
            if (!mediaInfo.success) {
                throw new Error(mediaInfo.error);
            }

            const media = mediaInfo.media;
            const originalPath = this.getAbsolutePath(media.file_path);

            // Generate output filename
            const outputFilename = this.generateEditedFilename(media.filename, 'rotate', outputFormat);
            const outputPath = await this.prepareOutputPath(media.model_slug, outputFilename);

            // Get original dimensions
            const originalMetadata = await sharp(originalPath).metadata();

            // Perform rotation
            let processor = sharp(originalPath);
            
            // Apply rotation with white background
            processor = processor.rotate(normalizedAngle, { background: { r: 255, g: 255, b: 255, alpha: 1 } });

            // Apply output format and quality
            processor = this.applyOutputFormat(processor, outputFormat, quality);

            // Save processed image
            await processor.toFile(outputPath.absolute);

            // Get final metadata
            const finalMetadata = await sharp(outputPath.absolute).metadata();

            // Record edit history
            const historyResult = await this.recordEditHistory(mediaId, 'rotate', {
                angle: normalizedAngle,
                outputFormat,
                quality,
                originalDimensions: {
                    width: originalMetadata.width,
                    height: originalMetadata.height
                },
                newDimensions: {
                    width: finalMetadata.width,
                    height: finalMetadata.height
                }
            }, outputPath.relative);

            console.log(`✅ Image rotated successfully: ${originalMetadata.width}x${originalMetadata.height} → ${finalMetadata.width}x${finalMetadata.height}`);

            return {
                success: true,
                editId: historyResult.editId,
                originalFile: media.file_path,
                editedFile: outputPath.relative,
                editedUrl: `/uploads/${media.model_slug}/${this.config.editedDir}/${outputFilename}`,
                operation: 'rotate',
                parameters: { angle: normalizedAngle, outputFormat, quality },
                originalDimensions: {
                    width: originalMetadata.width,
                    height: originalMetadata.height
                },
                newDimensions: {
                    width: finalMetadata.width,
                    height: finalMetadata.height
                },
                fileSize: (await fs.stat(outputPath.absolute)).size,
                format: finalMetadata.format
            };

        } catch (error) {
            console.error('❌ Rotation operation failed:', error);
            return {
                success: false,
                error: error.message,
                operation: 'rotate',
                parameters: rotateParams
            };
        }
    }

    /**
     * Resize image to specified dimensions
     * @param {string} mediaId - Media library item ID
     * @param {Object} resizeParams - Resize parameters
     * @returns {Object} Processing result
     */
    async resizeImage(mediaId, resizeParams) {
        const { 
            width, 
            height, 
            fit = 'cover', 
            position = 'center',
            background = { r: 255, g: 255, b: 255 },
            outputFormat = 'jpeg', 
            quality = null 
        } = resizeParams;

        console.log(`🔄 Resizing image (media ID: ${mediaId}) to ${width}x${height}`);
        console.log(`📐 Resize mode: ${fit}, position: ${position}`);

        try {
            // Validate dimensions
            if (!this.isValidDimension(width) || !this.isValidDimension(height)) {
                throw new Error(`Invalid dimensions: ${width}x${height}. Must be between ${this.config.minDimension} and ${this.config.maxDimension} pixels.`);
            }

            // Get media details
            const mediaInfo = await this.getMediaInfo(mediaId);
            if (!mediaInfo.success) {
                throw new Error(mediaInfo.error);
            }

            const media = mediaInfo.media;
            const originalPath = this.getAbsolutePath(media.file_path);

            // Generate output filename
            const outputFilename = this.generateEditedFilename(media.filename, 'resize', outputFormat);
            const outputPath = await this.prepareOutputPath(media.model_slug, outputFilename);

            // Get original dimensions
            const originalMetadata = await sharp(originalPath).metadata();

            // Perform resize
            let processor = sharp(originalPath);
            
            // Apply resize with specified fit mode
            const resizeOptions = {
                width: Math.round(width),
                height: Math.round(height),
                fit: fit, // cover, contain, fill, inside, outside
                position: position, // center, top, bottom, left, right
                background: background
            };

            processor = processor.resize(resizeOptions);

            // Apply output format and quality
            processor = this.applyOutputFormat(processor, outputFormat, quality);

            // Save processed image
            await processor.toFile(outputPath.absolute);

            // Get final metadata
            const finalMetadata = await sharp(outputPath.absolute).metadata();

            // Record edit history
            const historyResult = await this.recordEditHistory(mediaId, 'resize', {
                targetDimensions: { width: Math.round(width), height: Math.round(height) },
                fit,
                position,
                background,
                outputFormat,
                quality,
                originalDimensions: {
                    width: originalMetadata.width,
                    height: originalMetadata.height
                },
                actualDimensions: {
                    width: finalMetadata.width,
                    height: finalMetadata.height
                }
            }, outputPath.relative);

            console.log(`✅ Image resized successfully: ${originalMetadata.width}x${originalMetadata.height} → ${finalMetadata.width}x${finalMetadata.height}`);

            return {
                success: true,
                editId: historyResult.editId,
                originalFile: media.file_path,
                editedFile: outputPath.relative,
                editedUrl: `/uploads/${media.model_slug}/${this.config.editedDir}/${outputFilename}`,
                operation: 'resize',
                parameters: {
                    targetDimensions: { width: Math.round(width), height: Math.round(height) },
                    fit,
                    position,
                    outputFormat,
                    quality
                },
                originalDimensions: {
                    width: originalMetadata.width,
                    height: originalMetadata.height
                },
                newDimensions: {
                    width: finalMetadata.width,
                    height: finalMetadata.height
                },
                fileSize: (await fs.stat(outputPath.absolute)).size,
                format: finalMetadata.format
            };

        } catch (error) {
            console.error('❌ Resize operation failed:', error);
            return {
                success: false,
                error: error.message,
                operation: 'resize',
                parameters: resizeParams
            };
        }
    }

    /**
     * Apply filters to image (brightness, contrast, saturation, etc.)
     * @param {string} mediaId - Media library item ID
     * @param {Object} filterParams - Filter parameters
     * @returns {Object} Processing result
     */
    async applyFilters(mediaId, filterParams) {
        const { 
            brightness = 1.0,
            contrast = 1.0,
            saturation = 1.0,
            blur = 0,
            sharpen = 0,
            gamma = 1.0,
            outputFormat = 'jpeg',
            quality = null 
        } = filterParams;

        console.log(`🔄 Applying filters to image (media ID: ${mediaId})`);
        console.log(`🎨 Filters: brightness=${brightness}, contrast=${contrast}, saturation=${saturation}`);

        try {
            // Validate filter parameters
            const validation = this.validateFilterParameters(filterParams);
            if (!validation.valid) {
                throw new Error(`Invalid filter parameters: ${validation.error}`);
            }

            // Get media details
            const mediaInfo = await this.getMediaInfo(mediaId);
            if (!mediaInfo.success) {
                throw new Error(mediaInfo.error);
            }

            const media = mediaInfo.media;
            const originalPath = this.getAbsolutePath(media.file_path);

            // Generate output filename
            const outputFilename = this.generateEditedFilename(media.filename, 'filter', outputFormat);
            const outputPath = await this.prepareOutputPath(media.model_slug, outputFilename);

            // Get original dimensions
            const originalMetadata = await sharp(originalPath).metadata();

            // Apply filters
            let processor = sharp(originalPath);
            
            // Brightness and contrast (linear adjustments)
            if (brightness !== 1.0 || contrast !== 1.0) {
                // Convert to linear adjustment: multiply = contrast, add = (brightness-1)*255*contrast
                const multiply = contrast;
                const add = (brightness - 1.0) * 127 * contrast;
                processor = processor.linear(multiply, add);
            }

            // Saturation (modulate)
            if (saturation !== 1.0) {
                processor = processor.modulate({ saturation: saturation });
            }

            // Gamma correction
            if (gamma !== 1.0) {
                processor = processor.gamma(gamma);
            }

            // Blur
            if (blur > 0) {
                processor = processor.blur(blur);
            }

            // Sharpen
            if (sharpen > 0) {
                processor = processor.sharpen(sharpen);
            }

            // Apply output format and quality
            processor = this.applyOutputFormat(processor, outputFormat, quality);

            // Save processed image
            await processor.toFile(outputPath.absolute);

            // Get final metadata
            const finalMetadata = await sharp(outputPath.absolute).metadata();

            // Record edit history
            const historyResult = await this.recordEditHistory(mediaId, 'filter', {
                filters: {
                    brightness,
                    contrast,
                    saturation,
                    blur,
                    sharpen,
                    gamma
                },
                outputFormat,
                quality,
                originalDimensions: {
                    width: originalMetadata.width,
                    height: originalMetadata.height
                }
            }, outputPath.relative);

            console.log(`✅ Filters applied successfully`);

            return {
                success: true,
                editId: historyResult.editId,
                originalFile: media.file_path,
                editedFile: outputPath.relative,
                editedUrl: `/uploads/${media.model_slug}/${this.config.editedDir}/${outputFilename}`,
                operation: 'filter',
                parameters: { brightness, contrast, saturation, blur, sharpen, gamma, outputFormat, quality },
                dimensions: {
                    width: finalMetadata.width,
                    height: finalMetadata.height
                },
                fileSize: (await fs.stat(outputPath.absolute)).size,
                format: finalMetadata.format
            };

        } catch (error) {
            console.error('❌ Filter operation failed:', error);
            return {
                success: false,
                error: error.message,
                operation: 'filter',
                parameters: filterParams
            };
        }
    }

    /**
     * Get media information from database
     */
    async getMediaInfo(mediaId) {
        try {
            const query = `
                SELECT id, model_slug, filename, original_filename, file_path,
                       image_width, image_height, mime_type, file_size
                FROM model_media_library 
                WHERE id = ? AND is_deleted = 0
            `;
            
            const results = await this.db.query(query, [mediaId]);
            
            if (!results || results.length === 0) {
                return {
                    success: false,
                    error: 'Media not found or has been deleted'
                };
            }

            return {
                success: true,
                media: results[0]
            };

        } catch (error) {
            console.error('Database error getting media info:', error);
            return {
                success: false,
                error: 'Database error retrieving media information'
            };
        }
    }

    /**
     * Validate crop parameters against image dimensions
     */
    async validateCropParameters(imagePath, cropParams) {
        try {
            const { x, y, width, height } = cropParams;
            const metadata = await sharp(imagePath).metadata();

            // Check if crop area is within image bounds
            if (x < 0 || y < 0) {
                return { valid: false, error: 'Crop coordinates cannot be negative' };
            }

            if (x + width > metadata.width || y + height > metadata.height) {
                return { 
                    valid: false, 
                    error: `Crop area extends beyond image bounds (${metadata.width}x${metadata.height})` 
                };
            }

            // Check minimum crop size
            if (width < this.config.minDimension || height < this.config.minDimension) {
                return { 
                    valid: false, 
                    error: `Crop dimensions too small (min ${this.config.minDimension}px)` 
                };
            }

            return { 
                valid: true, 
                originalDimensions: {
                    width: metadata.width,
                    height: metadata.height
                }
            };

        } catch (error) {
            return { valid: false, error: `Cannot read image metadata: ${error.message}` };
        }
    }

    /**
     * Validate filter parameters
     */
    validateFilterParameters(filterParams) {
        const { brightness, contrast, saturation, blur, sharpen, gamma } = filterParams;

        if (brightness !== undefined && (brightness < 0 || brightness > 3)) {
            return { valid: false, error: 'Brightness must be between 0 and 3' };
        }

        if (contrast !== undefined && (contrast < 0 || contrast > 3)) {
            return { valid: false, error: 'Contrast must be between 0 and 3' };
        }

        if (saturation !== undefined && (saturation < 0 || saturation > 3)) {
            return { valid: false, error: 'Saturation must be between 0 and 3' };
        }

        if (blur !== undefined && (blur < 0 || blur > 100)) {
            return { valid: false, error: 'Blur must be between 0 and 100' };
        }

        if (sharpen !== undefined && (sharpen < 0 || sharpen > 10)) {
            return { valid: false, error: 'Sharpen must be between 0 and 10' };
        }

        if (gamma !== undefined && (gamma < 0.1 || gamma > 3)) {
            return { valid: false, error: 'Gamma must be between 0.1 and 3' };
        }

        return { valid: true };
    }

    /**
     * Normalize rotation angle to valid range
     */
    normalizeRotationAngle(angle) {
        if (typeof angle !== 'number' || isNaN(angle)) {
            return null;
        }

        // Normalize to 0-360 range
        let normalized = angle % 360;
        if (normalized < 0) normalized += 360;

        return normalized;
    }

    /**
     * Check if dimension is valid
     */
    isValidDimension(dimension) {
        return typeof dimension === 'number' && 
               !isNaN(dimension) && 
               dimension >= this.config.minDimension && 
               dimension <= this.config.maxDimension;
    }

    /**
     * Apply output format and quality settings
     */
    applyOutputFormat(processor, format, quality = null) {
        const outputFormat = format.toLowerCase();
        
        switch (outputFormat) {
            case 'jpeg':
            case 'jpg':
                return processor.jpeg({ 
                    quality: quality || this.config.jpegQuality,
                    progressive: true,
                    mozjpeg: true
                });
            
            case 'png':
                return processor.png({ 
                    compressionLevel: quality || this.config.pngCompression,
                    progressive: true
                });
            
            case 'webp':
                return processor.webp({ 
                    quality: quality || this.config.webpQuality,
                    lossless: false
                });
            
            default:
                return processor.jpeg({ 
                    quality: this.config.jpegQuality,
                    progressive: true
                });
        }
    }

    /**
     * Generate filename for edited image
     */
    generateEditedFilename(originalFilename, operation, format) {
        const timestamp = Date.now();
        const random = crypto.randomBytes(4).toString('hex');
        const baseName = path.basename(originalFilename, path.extname(originalFilename));
        const ext = format === 'jpg' ? 'jpeg' : format;
        
        return `${baseName}_${operation}_${timestamp}_${random}.${ext}`;
    }

    /**
     * Prepare output path for edited image
     */
    async prepareOutputPath(modelSlug, filename) {
        const relativePath = `${this.config.editedDir}/${filename}`;
        const absoluteDir = path.join(this.baseUploadPath, modelSlug, this.config.editedDir);
        const absolutePath = path.join(absoluteDir, filename);

        // Ensure directory exists
        await fs.mkdir(absoluteDir, { recursive: true });

        return {
            relative: relativePath,
            absolute: absolutePath
        };
    }

    /**
     * Get absolute path from relative path
     */
    getAbsolutePath(relativePath) {
        if (path.isAbsolute(relativePath)) {
            return relativePath;
        }
        
        // Remove leading slash if present
        const cleanPath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
        return path.join(process.cwd(), 'public', cleanPath);
    }

    /**
     * Record edit history in database
     */
    async recordEditHistory(mediaId, operationType, operationData, newFilePath) {
        try {
            const insertQuery = `
                INSERT INTO model_media_edit_history (
                    media_id, operation_type, operation_data, new_file_path
                ) VALUES (?, ?, ?, ?)
            `;

            const result = await this.db.query(insertQuery, [
                mediaId,
                operationType,
                JSON.stringify(operationData),
                newFilePath
            ]);

            console.log(`📝 Edit history recorded: ${operationType} operation for media ${mediaId}`);

            return {
                success: true,
                editId: result.insertId
            };

        } catch (error) {
            console.error('Failed to record edit history:', error);
            // Don't fail the main operation if history recording fails
            return {
                success: false,
                editId: null,
                error: error.message
            };
        }
    }

    /**
     * Get edit history for a media item
     */
    async getEditHistory(mediaId) {
        try {
            const query = `
                SELECT id, operation_type, operation_data, new_file_path, operation_date
                FROM model_media_edit_history
                WHERE media_id = ?
                ORDER BY operation_date DESC
                LIMIT ?
            `;

            const results = await this.db.query(query, [mediaId, this.config.maxHistoryVersions]);

            const history = results.map(row => ({
                editId: row.id,
                operation: row.operation_type,
                parameters: typeof row.operation_data === 'string' 
                    ? JSON.parse(row.operation_data) 
                    : row.operation_data,
                resultFile: row.new_file_path,
                date: row.operation_date
            }));

            return {
                success: true,
                history
            };

        } catch (error) {
            console.error('Error getting edit history:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Clean up old edit versions
     */
    async cleanupOldVersions(mediaId, keepLatest = 5) {
        try {
            // Get edit history
            const historyResult = await this.getEditHistory(mediaId);
            if (!historyResult.success || historyResult.history.length <= keepLatest) {
                return { success: true, deletedCount: 0 };
            }

            // Get versions to delete
            const versionsToDelete = historyResult.history.slice(keepLatest);
            let deletedCount = 0;

            for (const version of versionsToDelete) {
                try {
                    // Delete file
                    const absolutePath = this.getAbsolutePath(version.resultFile);
                    await fs.unlink(absolutePath);

                    // Delete database record
                    await this.db.query('DELETE FROM model_media_edit_history WHERE id = ?', [version.editId]);
                    
                    deletedCount++;
                } catch (deleteError) {
                    console.warn(`Failed to delete version ${version.editId}:`, deleteError.message);
                }
            }

            console.log(`🧹 Cleaned up ${deletedCount} old edit versions for media ${mediaId}`);

            return {
                success: true,
                deletedCount
            };

        } catch (error) {
            console.error('Error cleaning up old versions:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = ImageProcessingService;