/**
 * File Storage Management Service
 * Part of Phase B.3: Moderation System Integration  
 * Handles file operations, cleanup, and storage optimization for media library
 */

const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const sharp = require('sharp');

class FileStorageManager {
    constructor(dbConnection, baseUploadPath = null) {
        this.db = dbConnection;
        this.baseUploadPath = baseUploadPath || path.join(__dirname, '../../public/uploads');
        this.tempDir = path.join(this.baseUploadPath, 'temp');
        this.maxFileAge = 24 * 60 * 60 * 1000; // 24 hours in ms
        this.cleanupInterval = 60 * 60 * 1000; // 1 hour in ms
        
        console.log('🗃️ FileStorageManager initialized');
        console.log(`📁 Base upload path: ${this.baseUploadPath}`);
        
        // Start periodic cleanup
        this.startPeriodicCleanup();
    }

    /**
     * Initialize storage directories and start cleanup process
     */
    async initialize() {
        try {
            // Ensure base directories exist
            await this.ensureDirectoryExists(this.baseUploadPath);
            await this.ensureDirectoryExists(this.tempDir);
            
            console.log('✅ FileStorageManager initialized successfully');
            
            // Run initial cleanup
            await this.cleanupOrphanedFiles();
            
            return { success: true };
        } catch (error) {
            console.error('❌ FileStorageManager initialization failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Ensure directory exists, create if not
     * @param {string} dirPath 
     */
    async ensureDirectoryExists(dirPath) {
        try {
            await fs.mkdir(dirPath, { recursive: true });
        } catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }

    /**
     * Create model-specific directory structure
     * @param {string} modelSlug 
     * @returns {Object} Directory paths
     */
    async createModelDirectories(modelSlug) {
        const modelBaseDir = path.join(this.baseUploadPath, modelSlug);
        
        const directories = {
            base: modelBaseDir,
            originals: path.join(modelBaseDir, 'originals'),
            media: path.join(modelBaseDir, 'media'),
            thumbs: path.join(modelBaseDir, 'media', 'thumbs'),
            temp: path.join(modelBaseDir, 'temp'),
            public: path.join(modelBaseDir, 'public'),
            blurred: path.join(modelBaseDir, 'public', 'blurred'),
            rejected: path.join(modelBaseDir, 'rejected')
        };

        try {
            // Create all directories
            for (const [key, dirPath] of Object.entries(directories)) {
                await this.ensureDirectoryExists(dirPath);
            }

            console.log(`📁 Created directory structure for model: ${modelSlug}`);
            return { success: true, directories };
        } catch (error) {
            console.error(`❌ Error creating directories for ${modelSlug}:`, error);
            throw error;
        }
    }

    /**
     * Move file from temp to permanent location
     * @param {string} tempPath 
     * @param {string} modelSlug 
     * @param {string} filename 
     * @param {string} category - originals, media, thumbs, etc.
     * @returns {string} Final file path
     */
    async moveToCategory(tempPath, modelSlug, filename, category = 'originals') {
        try {
            // Ensure model directories exist
            const { directories } = await this.createModelDirectories(modelSlug);
            
            if (!directories[category]) {
                throw new Error(`Invalid category: ${category}`);
            }

            const finalPath = path.join(directories[category], filename);
            
            // Check if source file exists
            try {
                await fs.access(tempPath, fs.constants.R_OK);
            } catch (accessError) {
                throw new Error(`Source file not accessible: ${tempPath}`);
            }

            // Move file
            await fs.rename(tempPath, finalPath);
            
            console.log(`📂 Moved file to ${category}: ${filename}`);
            return finalPath;
        } catch (error) {
            console.error(`❌ Error moving file to ${category}:`, error);
            throw error;
        }
    }

    /**
     * Copy file to multiple locations (for different processing stages)
     * @param {string} sourcePath 
     * @param {string} modelSlug 
     * @param {string} filename 
     * @param {Array} categories 
     * @returns {Object} Paths for each category
     */
    async copyToMultipleCategories(sourcePath, modelSlug, filename, categories) {
        const results = {};
        
        try {
            const { directories } = await this.createModelDirectories(modelSlug);
            
            for (const category of categories) {
                if (!directories[category]) {
                    throw new Error(`Invalid category: ${category}`);
                }

                const targetPath = path.join(directories[category], filename);
                await fs.copyFile(sourcePath, targetPath);
                results[category] = targetPath;
                console.log(`📋 Copied to ${category}: ${filename}`);
            }

            return { success: true, paths: results };
        } catch (error) {
            console.error('❌ Error copying to multiple categories:', error);
            throw error;
        }
    }

    /**
     * Generate secure filename with timestamp and hash
     * @param {string} originalFilename 
     * @param {string} prefix - Optional prefix
     * @returns {string} Secure filename
     */
    generateSecureFilename(originalFilename, prefix = '') {
        const ext = path.extname(originalFilename).toLowerCase();
        const timestamp = Date.now();
        const randomHash = crypto.randomBytes(8).toString('hex');
        const baseName = path.basename(originalFilename, ext)
            .replace(/[^a-z0-9_-]+/gi, '_')
            .substring(0, 30);
        
        const prefixPart = prefix ? `${prefix}_` : '';
        return `${prefixPart}${timestamp}_${randomHash}_${baseName}${ext}`;
    }

    /**
     * Get file statistics
     * @param {string} filePath 
     * @returns {Object} File stats
     */
    async getFileStats(filePath) {
        try {
            const stats = await fs.stat(filePath);
            let imageInfo = null;

            // Get image metadata if it's an image
            try {
                const metadata = await sharp(filePath).metadata();
                imageInfo = {
                    width: metadata.width,
                    height: metadata.height,
                    format: metadata.format,
                    channels: metadata.channels,
                    hasAlpha: metadata.hasAlpha
                };
            } catch (imageError) {
                // Not an image or corrupted image
            }

            return {
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime,
                accessed: stats.atime,
                isFile: stats.isFile(),
                isDirectory: stats.isDirectory(),
                image: imageInfo
            };
        } catch (error) {
            console.error(`❌ Error getting file stats for ${filePath}:`, error);
            throw error;
        }
    }

    /**
     * Delete file safely with verification
     * @param {string} filePath 
     * @returns {boolean} Success status
     */
    async deleteFile(filePath) {
        try {
            // Verify file exists first
            try {
                await fs.access(filePath, fs.constants.F_OK);
            } catch (accessError) {
                console.log(`ℹ️ File already deleted or doesn't exist: ${filePath}`);
                return true;
            }

            // Delete the file
            await fs.unlink(filePath);
            console.log(`🗑️ Deleted file: ${path.basename(filePath)}`);
            return true;
        } catch (error) {
            console.error(`❌ Error deleting file ${filePath}:`, error);
            return false;
        }
    }

    /**
     * Delete multiple files with batch processing
     * @param {Array} filePaths 
     * @returns {Object} Deletion results
     */
    async deleteMultipleFiles(filePaths) {
        let deleted = 0;
        let failed = 0;
        const errors = [];

        for (const filePath of filePaths) {
            try {
                const success = await this.deleteFile(filePath);
                if (success) {
                    deleted++;
                } else {
                    failed++;
                }
            } catch (error) {
                failed++;
                errors.push({ filePath, error: error.message });
            }
        }

        console.log(`🗑️ Batch deletion complete: ${deleted} deleted, ${failed} failed`);
        return {
            deleted,
            failed,
            errors
        };
    }

    /**
     * Clean up orphaned files (files not in database)
     */
    async cleanupOrphanedFiles() {
        console.log('🧹 Starting orphaned files cleanup...');
        
        try {
            // Get all media files from database
            const [dbFiles] = await this.db.execute(`
                SELECT DISTINCT file_path, filename 
                FROM model_media_library 
                WHERE is_deleted = 0 AND file_path IS NOT NULL
            `);

            const dbFilePaths = new Set(dbFiles.map(f => f.file_path));
            const dbFileNames = new Set(dbFiles.map(f => f.filename));

            console.log(`📊 Found ${dbFilePaths.size} files in database`);

            // Scan file system for media files
            const orphanedFiles = [];
            const modelDirs = await this.getModelDirectories();

            for (const modelDir of modelDirs) {
                const modelSlug = path.basename(modelDir);
                const mediaDir = path.join(modelDir, 'media');

                try {
                    await fs.access(mediaDir);
                    const files = await fs.readdir(mediaDir);

                    for (const filename of files) {
                        const fullPath = path.join(mediaDir, filename);
                        const webPath = `/uploads/${modelSlug}/media/${filename}`;

                        // Skip if in database
                        if (dbFilePaths.has(webPath) || dbFileNames.has(filename)) {
                            continue;
                        }

                        // Check file age (only delete old orphaned files)
                        const stats = await fs.stat(fullPath);
                        const fileAge = Date.now() - stats.mtime.getTime();

                        if (fileAge > this.maxFileAge) {
                            orphanedFiles.push(fullPath);
                        }
                    }
                } catch (dirError) {
                    // Directory doesn't exist, skip
                }
            }

            if (orphanedFiles.length > 0) {
                console.log(`🗑️ Found ${orphanedFiles.length} orphaned files to delete`);
                const results = await this.deleteMultipleFiles(orphanedFiles);
                console.log(`✅ Orphaned files cleanup: ${results.deleted} deleted, ${results.failed} failed`);
            } else {
                console.log('✅ No orphaned files found');
            }

        } catch (error) {
            console.error('❌ Error during orphaned files cleanup:', error);
        }
    }

    /**
     * Clean up temporary files older than maxFileAge
     */
    async cleanupTempFiles() {
        console.log('🧹 Cleaning up temporary files...');
        
        try {
            const tempFiles = [];
            
            // Clean global temp directory
            await this.findOldFiles(this.tempDir, tempFiles);

            // Clean model-specific temp directories
            const modelDirs = await this.getModelDirectories();
            for (const modelDir of modelDirs) {
                const modelTempDir = path.join(modelDir, 'temp');
                await this.findOldFiles(modelTempDir, tempFiles);
            }

            if (tempFiles.length > 0) {
                console.log(`🗑️ Found ${tempFiles.length} old temp files to delete`);
                const results = await this.deleteMultipleFiles(tempFiles);
                console.log(`✅ Temp files cleanup: ${results.deleted} deleted, ${results.failed} failed`);
            } else {
                console.log('✅ No old temp files found');
            }

        } catch (error) {
            console.error('❌ Error during temp files cleanup:', error);
        }
    }

    /**
     * Find old files in directory
     * @param {string} directory 
     * @param {Array} fileList - Array to push found files to
     */
    async findOldFiles(directory, fileList) {
        try {
            await fs.access(directory);
            const files = await fs.readdir(directory);

            for (const filename of files) {
                const fullPath = path.join(directory, filename);
                const stats = await fs.stat(fullPath);

                if (stats.isFile()) {
                    const fileAge = Date.now() - stats.mtime.getTime();
                    if (fileAge > this.maxFileAge) {
                        fileList.push(fullPath);
                    }
                }
            }
        } catch (error) {
            // Directory doesn't exist or inaccessible, skip
        }
    }

    /**
     * Get all model directories
     * @returns {Array} Model directory paths
     */
    async getModelDirectories() {
        try {
            const entries = await fs.readdir(this.baseUploadPath, { withFileTypes: true });
            return entries
                .filter(entry => entry.isDirectory() && entry.name !== 'temp')
                .map(entry => path.join(this.baseUploadPath, entry.name));
        } catch (error) {
            console.error('❌ Error getting model directories:', error);
            return [];
        }
    }

    /**
     * Get storage statistics
     * @returns {Object} Storage stats
     */
    async getStorageStatistics() {
        try {
            let totalSize = 0;
            let fileCount = 0;
            const modelStats = {};

            const modelDirs = await this.getModelDirectories();

            for (const modelDir of modelDirs) {
                const modelSlug = path.basename(modelDir);
                const modelSize = await this.getDirectorySize(modelDir);
                
                modelStats[modelSlug] = {
                    size_bytes: modelSize.totalSize,
                    file_count: modelSize.fileCount,
                    size_mb: Math.round((modelSize.totalSize / (1024 * 1024)) * 100) / 100
                };

                totalSize += modelSize.totalSize;
                fileCount += modelSize.fileCount;
            }

            return {
                success: true,
                storage: {
                    total_size_bytes: totalSize,
                    total_size_mb: Math.round((totalSize / (1024 * 1024)) * 100) / 100,
                    total_size_gb: Math.round((totalSize / (1024 * 1024 * 1024)) * 100) / 100,
                    total_files: fileCount,
                    models: modelStats
                }
            };
        } catch (error) {
            console.error('❌ Error getting storage statistics:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get directory size recursively
     * @param {string} dirPath 
     * @returns {Object} Size info
     */
    async getDirectorySize(dirPath) {
        let totalSize = 0;
        let fileCount = 0;

        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);

                if (entry.isFile()) {
                    const stats = await fs.stat(fullPath);
                    totalSize += stats.size;
                    fileCount++;
                } else if (entry.isDirectory()) {
                    const subDirSize = await this.getDirectorySize(fullPath);
                    totalSize += subDirSize.totalSize;
                    fileCount += subDirSize.fileCount;
                }
            }
        } catch (error) {
            // Directory doesn't exist or inaccessible, return 0
        }

        return { totalSize, fileCount };
    }

    /**
     * Start periodic cleanup process
     */
    startPeriodicCleanup() {
        console.log(`⏰ Starting periodic cleanup every ${Math.round(this.cleanupInterval / 60000)} minutes`);
        
        setInterval(async () => {
            console.log('🔄 Running periodic cleanup...');
            try {
                await this.cleanupTempFiles();
                await this.cleanupOrphanedFiles();
                console.log('✅ Periodic cleanup completed');
            } catch (error) {
                console.error('❌ Periodic cleanup error:', error);
            }
        }, this.cleanupInterval);
    }

    /**
     * Stop cleanup process (for graceful shutdown)
     */
    stopPeriodicCleanup() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            console.log('🛑 Periodic cleanup stopped');
        }
    }
}

module.exports = FileStorageManager;