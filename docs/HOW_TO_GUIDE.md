# phoenix4ge Media Library: Developer's "How To" Guide

**Last Updated:** August 9, 2025  
**Audience:** Developers, System Administrators, Technical Staff  
**Difficulty Level:** Intermediate to Advanced  

## 📋 **Table of Contents**
- [Getting Started](#getting-started)
- [System Architecture Understanding](#system-architecture-understanding)
- [Development Environment Setup](#development-environment-setup)
- [Common Development Tasks](#common-development-tasks)
- [Debugging & Troubleshooting](#debugging--troubleshooting)
- [Performance Optimization](#performance-optimization)
- [Security Best Practices](#security-best-practices)
- [Deployment & Maintenance](#deployment--maintenance)
- [Extending the System](#extending-the-system)

---

## 🚀 **Getting Started**

### **What You Need to Know**

The phoenix4ge Media Library is a comprehensive, enterprise-grade media management system built with:
- **Backend:** Node.js, Express.js, MySQL
- **Frontend:** Bootstrap 5.3, Vanilla JavaScript (ES6+)
- **Image Processing:** Sharp library
- **Caching:** Redis
- **Queue Processing:** Bull queue with Redis
- **External APIs:** Content moderation services

### **Prerequisites**

Before working with the system, ensure you have:
- **Node.js 18+** installed
- **MySQL 8.0+** or compatible database
- **Redis 6.0+** for caching and queues
- **Git** for version control
- **Basic understanding** of: JavaScript, SQL, REST APIs
- **Intermediate knowledge** of: Node.js, Express.js, async programming

---

## 🏗️ **System Architecture Understanding**

### **Core Components Hierarchy**

```
┌─ Frontend Layer ────────────────────────────┐
│  • Bootstrap 5.3 UI Components             │
│  • JavaScript Classes (ES6+)               │
│  • Real-time WebSocket Connections         │
└─────────────────────────────────────────────┘
           ↓ HTTP/WebSocket
┌─ API Layer ─────────────────────────────────┐
│  • Express.js REST Endpoints               │
│  • Multer File Upload Handling             │
│  • Authentication Middleware               │
└─────────────────────────────────────────────┘
           ↓ Service Calls
┌─ Business Logic Layer ──────────────────────┐
│  • 36 Specialized Services                 │
│  • Event-Driven Architecture               │
│  • Dependency Injection Pattern            │
└─────────────────────────────────────────────┘
           ↓ Database/External APIs
┌─ Data & Integration Layer ──────────────────┐
│  • MySQL Database                          │
│  • Redis Cache & Queues                    │
│  • External Moderation APIs                │
│  • File System Storage                     │
└─────────────────────────────────────────────┘
```

### **Service Categories**

The system is organized into logical service groups:

1. **Core Media Services (Phase A-B)**
   - `MediaUploadService` - File upload and processing
   - `ModerationCallbackHandler` - Async moderation results
   - `FileStorageService` - File organization
   - `MediaLogger` - Comprehensive logging

2. **Performance Services (Phase C)**
   - `GalleryCacheService` - Redis-based caching
   - `ImageProcessingQueue` - Background job processing
   - `ThumbnailOptimizationService` - Image optimization

3. **Security Services (Phase F)**
   - `SecurityMonitoringService` - Threat detection
   - `ComplianceFrameworkService` - Regulatory compliance
   - `IncidentResponseService` - Security incident handling

---

## 💻 **Development Environment Setup**

### **1. Clone and Install**

```bash
# Clone the repository
git clone https://github.com/your-org/phoenix4ge.git
cd phoenix4ge

# Install dependencies
npm install

# Install development dependencies
npm install --save-dev nodemon jest supertest
```

### **2. Environment Configuration**

Create `.env` file with required configuration:

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=phoenix4ge_db
DB_USER=phoenix4ge_user
DB_PASSWORD=secure_password

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_password

# Media Library Configuration
MEDIA_MAX_FILE_SIZE=52428800  # 50MB in bytes
MEDIA_QUALITY=95
MEDIA_STORAGE_PATH=/uploads/
WATERMARK_ENABLED=true

# Moderation API Configuration
MODERATION_API_ENDPOINT=https://api.moderation-service.com
MODERATION_API_KEY=your_moderation_api_key
MODERATION_WEBHOOK_URL=https://your-domain.com/api/moderation-webhooks/result
MODERATION_WEBHOOK_SECRET=your_webhook_secret

# Logging Configuration
LOG_LEVEL=info
ENABLE_DATABASE_LOGGING=true
ENABLE_FILE_LOGGING=false

# Security Configuration
SESSION_SECRET=your_very_secure_session_secret
ENCRYPTION_KEY=your_32_character_encryption_key
```

### **3. Database Setup**

```bash
# Run database migrations
npm run db:migrate

# Seed initial data (optional)
npm run db:seed

# Create test database
npm run db:test:setup
```

### **4. Start Development Server**

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm run start

# Run tests
npm test

# Run specific test suite
npm test -- tests/integration/
```

---

## 🛠️ **Common Development Tasks**

### **Task 1: Adding a New Media Processing Operation**

**Scenario:** You want to add a "blur" operation for images.

**Step 1:** Create the processing method in `ImageProcessingService.js`

```javascript
// src/services/ImageProcessingService.js

async blurImage(mediaId, options = {}) {
    const startTime = Date.now();
    
    try {
        // Validate options
        const { blur = 1, outputFormat = 'jpeg', quality = 95 } = options;
        
        if (blur < 0 || blur > 100) {
            throw new Error('Blur value must be between 0 and 100');
        }

        // Get media data
        const media = await this.getMediaById(mediaId);
        if (!media) {
            throw new Error('Media not found');
        }

        // Process image
        const inputPath = this.getMediaFilePath(media);
        const outputPath = this.generateOutputPath(media, 'blur');

        await sharp(inputPath)
            .blur(blur)
            .toFormat(outputFormat, { quality })
            .toFile(outputPath);

        // Update database
        await this.updateMediaRecord(mediaId, {
            processing_stage: 'blur_applied',
            last_operation: 'blur',
            last_operation_params: JSON.stringify({ blur, outputFormat, quality })
        });

        // Log operation
        await this.logOperation(mediaId, 'blur', {
            blur,
            outputFormat,
            quality,
            processing_time: Date.now() - startTime
        });

        return {
            success: true,
            operation_id: `blur_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            processing_time: Date.now() - startTime,
            output_path: outputPath
        };

    } catch (error) {
        console.error(`Blur operation failed for media ${mediaId}:`, error);
        return {
            success: false,
            error: error.message
        };
    }
}
```

**Step 2:** Add API endpoint in `routes/api/model-media-library.js`

```javascript
// Add new route for blur operation
router.post('/:modelSlug/:mediaId/blur', async (req, res) => {
    try {
        const { modelSlug, mediaId } = req.params;
        const { blur = 1, output_format = 'jpeg', quality = 95 } = req.body;

        // Validate parameters
        if (typeof blur !== 'number' || blur < 0 || blur > 100) {
            return res.status(400).json({
                success: false,
                message: 'Invalid blur value. Must be between 0 and 100.'
            });
        }

        // Verify model exists
        const model = await getModelBySlug(modelSlug);
        if (!model) return res.status(404).json({ success: false, message: 'Model not found' });

        // Initialize and process image
        const imageProcessor = new ImageProcessingService(db);
        const initResult = await imageProcessor.initialize();
        
        if (!initResult.success) {
            return res.status(500).json({
                success: false,
                message: 'Image processing service initialization failed',
                error: initResult.error
            });
        }

        // Perform blur operation
        const blurResult = await imageProcessor.blurImage(mediaId, {
            blur, outputFormat: output_format, quality
        });

        if (blurResult.success) {
            res.json({
                success: true,
                message: 'Blur effect applied successfully',
                result: blurResult
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Blur operation failed',
                error: blurResult.error
            });
        }

    } catch (error) {
        logger.error('Blur operation error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during blur operation',
            error: error.message
        });
    }
});
```

**Step 3:** Add frontend support in `media-library.js`

```javascript
// Add method to phoenix4geMediaLibrary class
async applyBlur(mediaId, blurAmount = 1) {
    try {
        const response = await fetch(
            `/api/model-media-library/${this.modelSlug}/${mediaId}/blur`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ blur: blurAmount })
            }
        );

        const result = await response.json();

        if (result.success) {
            this.showNotification('Blur effect applied successfully', 'success');
            this.loadMedia(); // Refresh the grid
        } else {
            this.showNotification(`Blur failed: ${result.message}`, 'error');
        }

        return result;

    } catch (error) {
        console.error('Blur operation error:', error);
        this.showNotification('Blur operation failed', 'error');
        return { success: false, error: error.message };
    }
}
```

---

### **Task 2: Creating a Custom Service**

**Scenario:** You need to create a service for managing image metadata extraction.

**Step 1:** Create the service file

```javascript
// src/services/ImageMetadataService.js

const sharp = require('sharp');
const ExifReader = require('exifreader');
const fs = require('fs').promises;

class ImageMetadataService {
    constructor(dbConnection, options = {}) {
        this.db = dbConnection;
        this.config = {
            extractExif: options.extractExif !== false,
            extractColors: options.extractColors === true,
            cacheResults: options.cacheResults !== false
        };
        
        this.metadataCache = new Map();
        console.log('📊 ImageMetadataService initialized');
    }

    /**
     * Initialize the service
     */
    async initialize() {
        try {
            // Check database table exists
            await this.ensureMetadataTable();
            return { success: true };
        } catch (error) {
            console.error('Failed to initialize ImageMetadataService:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Extract comprehensive metadata from image
     */
    async extractMetadata(mediaId) {
        try {
            const media = await this.getMediaById(mediaId);
            if (!media) {
                throw new Error('Media not found');
            }

            const filePath = this.getMediaFilePath(media);
            const metadata = {};

            // Extract basic image info with Sharp
            const imageInfo = await sharp(filePath).metadata();
            metadata.basic = {
                width: imageInfo.width,
                height: imageInfo.height,
                format: imageInfo.format,
                space: imageInfo.space,
                channels: imageInfo.channels,
                depth: imageInfo.depth,
                density: imageInfo.density,
                hasProfile: imageInfo.hasProfile,
                hasAlpha: imageInfo.hasAlpha
            };

            // Extract EXIF data if enabled
            if (this.config.extractExif) {
                const fileBuffer = await fs.readFile(filePath);
                const exifTags = ExifReader.load(fileBuffer);
                metadata.exif = this.processExifData(exifTags);
            }

            // Extract dominant colors if enabled
            if (this.config.extractColors) {
                const colorStats = await sharp(filePath)
                    .resize(100, 100)
                    .raw()
                    .toBuffer({ resolveWithObject: true });
                metadata.colors = this.extractDominantColors(colorStats);
            }

            // Store in database
            await this.storeMetadata(mediaId, metadata);

            // Cache results
            if (this.config.cacheResults) {
                this.metadataCache.set(mediaId, metadata);
            }

            return {
                success: true,
                metadata
            };

        } catch (error) {
            console.error(`Metadata extraction failed for media ${mediaId}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Process EXIF data into useful format
     */
    processExifData(exifTags) {
        const processed = {};
        
        // Camera information
        if (exifTags.Make && exifTags.Model) {
            processed.camera = {
                make: exifTags.Make.description,
                model: exifTags.Model.description
            };
        }

        // Shooting settings
        if (exifTags.ExposureTime || exifTags.FNumber || exifTags.ISO) {
            processed.settings = {
                exposureTime: exifTags.ExposureTime?.description,
                fNumber: exifTags.FNumber?.description,
                iso: exifTags.ISO?.description,
                focalLength: exifTags.FocalLength?.description
            };
        }

        // Location data (if available)
        if (exifTags.GPSLatitude && exifTags.GPSLongitude) {
            processed.location = {
                latitude: this.parseGPSCoordinate(exifTags.GPSLatitude),
                longitude: this.parseGPSCoordinate(exifTags.GPSLongitude)
            };
        }

        // Timestamp
        if (exifTags.DateTime) {
            processed.dateTime = exifTags.DateTime.description;
        }

        return processed;
    }

    /**
     * Store metadata in database
     */
    async storeMetadata(mediaId, metadata) {
        const query = `
            INSERT INTO media_metadata (media_id, basic_info, exif_data, color_data, extracted_at)
            VALUES (?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
                basic_info = VALUES(basic_info),
                exif_data = VALUES(exif_data),
                color_data = VALUES(color_data),
                extracted_at = NOW()
        `;

        await this.db.execute(query, [
            mediaId,
            JSON.stringify(metadata.basic || {}),
            JSON.stringify(metadata.exif || {}),
            JSON.stringify(metadata.colors || {})
        ]);
    }

    // Additional helper methods...
    async getMediaById(mediaId) { /* Implementation */ }
    getMediaFilePath(media) { /* Implementation */ }
    extractDominantColors(colorStats) { /* Implementation */ }
    parseGPSCoordinate(coordinate) { /* Implementation */ }
    async ensureMetadataTable() { /* Implementation */ }
}

module.exports = ImageMetadataService;
```

**Step 2:** Register the service in your application

```javascript
// In your main application file or service container
const ImageMetadataService = require('./src/services/ImageMetadataService');

// Initialize the service
const metadataService = new ImageMetadataService(db, {
    extractExif: true,
    extractColors: true,
    cacheResults: true
});

await metadataService.initialize();

// Use the service
const result = await metadataService.extractMetadata(123);
```

---

### **Task 3: Adding Database Migrations**

**Scenario:** You need to add a new table for tracking media analytics.

**Step 1:** Create migration file

```javascript
// migrations/20250809_add_media_analytics_table.js

exports.up = async function(knex) {
    return knex.schema.createTable('media_analytics', function(table) {
        table.increments('id').primary();
        table.integer('media_id').unsigned().references('id').inTable('model_media_library');
        table.string('model_slug', 100).notNullable();
        table.integer('view_count').defaultTo(0);
        table.integer('download_count').defaultTo(0);
        table.integer('edit_count').defaultTo(0);
        table.decimal('engagement_score', 5, 2).defaultTo(0.00);
        table.timestamp('last_viewed_at').nullable();
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
        
        // Indexes
        table.index(['media_id']);
        table.index(['model_slug']);
        table.index(['engagement_score']);
        table.index(['created_at']);
    });
};

exports.down = async function(knex) {
    return knex.schema.dropTable('media_analytics');
};
```

**Step 2:** Run migration

```bash
# Run the migration
npm run db:migrate

# Rollback if needed
npm run db:rollback
```

---

## 🐛 **Debugging & Troubleshooting**

### **Common Issues and Solutions**

#### **Issue 1: Upload Fails with "ENOENT" Error**

**Symptoms:**
```
Error: ENOENT: no such file or directory, open '/uploads/model/media-temp/file.jpg'
```

**Solution:**
```javascript
// Check directory creation in MediaUploadService
const uploadDir = path.join(process.cwd(), 'public', 'uploads', modelSlug, 'media-temp');

// Ensure directory exists
await fs.mkdir(uploadDir, { recursive: true });
console.log(`Upload directory ensured: ${uploadDir}`);
```

**Prevention:**
- Always use `{ recursive: true }` when creating directories
- Check file permissions on the uploads directory
- Verify the correct path resolution

#### **Issue 2: Database Connection Timeouts**

**Symptoms:**
```
Error: Connection lost: The server closed the connection.
Error: Pool timeout
```

**Solution:**
```javascript
// config/database.js - Optimize connection pool
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    acquireTimeout: 60000,
    timeout: 60000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

// Test connection periodically
setInterval(async () => {
    try {
        await pool.execute('SELECT 1');
    } catch (error) {
        console.error('Database health check failed:', error);
    }
}, 30000);
```

#### **Issue 3: Memory Leaks in Image Processing**

**Symptoms:**
```
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed
```

**Solution:**
```javascript
// Use Sharp efficiently with proper cleanup
async processImage(inputPath, outputPath, operations) {
    let sharpInstance = sharp(inputPath);
    
    try {
        // Apply operations
        operations.forEach(op => {
            switch(op.type) {
                case 'resize':
                    sharpInstance = sharpInstance.resize(op.width, op.height);
                    break;
                case 'crop':
                    sharpInstance = sharpInstance.extract(op.region);
                    break;
            }
        });
        
        await sharpInstance.toFile(outputPath);
        
    } finally {
        // Clean up Sharp instance
        sharpInstance.destroy();
    }
}
```

### **Debug Tools and Techniques**

#### **1. Enable Debug Logging**

```javascript
// Set debug environment variable
DEBUG=phoenix4ge:* npm run dev

// Or in code:
const debug = require('debug');
const log = debug('phoenix4ge:media');

log('Processing file:', filename);
log('Options:', options);
```

#### **2. Database Query Logging**

```javascript
// Enable query logging in development
if (process.env.NODE_ENV === 'development') {
    const originalExecute = db.execute;
    db.execute = async function(query, params) {
        console.log('SQL Query:', query);
        console.log('Parameters:', params);
        const start = Date.now();
        const result = await originalExecute.call(this, query, params);
        console.log('Query took:', Date.now() - start, 'ms');
        return result;
    };
}
```

#### **3. Performance Monitoring**

```javascript
// Add performance monitoring wrapper
function withTiming(name, fn) {
    return async function(...args) {
        const start = process.hrtime.bigint();
        try {
            const result = await fn.apply(this, args);
            const end = process.hrtime.bigint();
            console.log(`${name} took: ${Number(end - start) / 1000000}ms`);
            return result;
        } catch (error) {
            const end = process.hrtime.bigint();
            console.log(`${name} failed after: ${Number(end - start) / 1000000}ms`);
            throw error;
        }
    };
}

// Usage
const timedProcessImage = withTiming('processImage', processImage);
```

---

## 🚀 **Performance Optimization**

### **Database Optimization**

#### **1. Add Proper Indexes**

```sql
-- Essential indexes for media library
ALTER TABLE model_media_library 
ADD INDEX idx_model_status (model_slug, moderation_status);

ALTER TABLE model_media_library 
ADD INDEX idx_upload_date (upload_date DESC);

ALTER TABLE model_media_library 
ADD INDEX idx_category_status (category_id, moderation_status);

-- Composite index for common queries
ALTER TABLE model_media_library 
ADD INDEX idx_model_category_date (model_slug, category_id, upload_date DESC);
```

#### **2. Optimize Queries**

```javascript
// Instead of multiple queries:
const media = await db.query('SELECT * FROM model_media_library WHERE model_slug = ?', [modelSlug]);
const categories = await db.query('SELECT * FROM model_media_categories WHERE model_slug = ?', [modelSlug]);

// Use a single JOIN query:
const mediaWithCategories = await db.query(`
    SELECT 
        mml.*,
        mmc.category_name,
        mmc.category_color
    FROM model_media_library mml
    LEFT JOIN model_media_categories mmc ON mml.category_id = mmc.id
    WHERE mml.model_slug = ?
    ORDER BY mml.upload_date DESC
`, [modelSlug]);
```

### **Image Processing Optimization**

#### **1. Use Appropriate Image Quality Settings**

```javascript
// Different quality settings for different use cases
const qualitySettings = {
    thumbnail: { format: 'jpeg', quality: 80, progressive: true },
    web: { format: 'jpeg', quality: 85, progressive: true },
    print: { format: 'jpeg', quality: 95, progressive: false },
    archive: { format: 'png', compressionLevel: 6 }
};

async function processForWeb(inputPath, outputPath) {
    await sharp(inputPath)
        .resize(1920, 1080, { 
            fit: 'inside', 
            withoutEnlargement: true 
        })
        .jpeg(qualitySettings.web)
        .toFile(outputPath);
}
```

#### **2. Implement Progressive Loading**

```javascript
// Generate multiple sizes for responsive images
async function generateResponsiveSizes(inputPath, baseName) {
    const sizes = [
        { width: 400, suffix: 'sm' },
        { width: 800, suffix: 'md' },
        { width: 1200, suffix: 'lg' },
        { width: 1920, suffix: 'xl' }
    ];
    
    const results = await Promise.all(
        sizes.map(async ({ width, suffix }) => {
            const outputPath = `${baseName}_${suffix}.jpg`;
            await sharp(inputPath)
                .resize(width, null, { 
                    fit: 'inside', 
                    withoutEnlargement: true 
                })
                .jpeg({ quality: 85, progressive: true })
                .toFile(outputPath);
            return { size: suffix, path: outputPath };
        })
    );
    
    return results;
}
```

### **Caching Strategy**

#### **1. Redis Cache Implementation**

```javascript
// src/utils/cacheManager.js
const redis = require('redis');
const client = redis.createClient();

class CacheManager {
    constructor() {
        this.defaultTTL = 3600; // 1 hour
    }
    
    async get(key) {
        try {
            const value = await client.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.error('Cache get error:', error);
            return null;
        }
    }
    
    async set(key, value, ttl = this.defaultTTL) {
        try {
            await client.setex(key, ttl, JSON.stringify(value));
        } catch (error) {
            console.error('Cache set error:', error);
        }
    }
    
    async del(key) {
        try {
            await client.del(key);
        } catch (error) {
            console.error('Cache delete error:', error);
        }
    }
    
    // Cache wrapper function
    async cached(key, fetchFunction, ttl = this.defaultTTL) {
        let data = await this.get(key);
        
        if (data === null) {
            data = await fetchFunction();
            await this.set(key, data, ttl);
        }
        
        return data;
    }
}

// Usage in service
const cache = new CacheManager();

async function getMediaLibrary(modelSlug, options) {
    const cacheKey = `media_library:${modelSlug}:${JSON.stringify(options)}`;
    
    return await cache.cached(cacheKey, async () => {
        return await db.query(/* your query */);
    }, 1800); // 30 minutes
}
```

---

## 🔒 **Security Best Practices**

### **File Upload Security**

#### **1. Comprehensive File Validation**

```javascript
// src/utils/fileValidator.js
const fileType = require('file-type');
const fs = require('fs').promises;

class FileValidator {
    constructor() {
        this.allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        this.allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        this.maxFileSize = 50 * 1024 * 1024; // 50MB
    }
    
    async validateFile(filePath, originalName) {
        const errors = [];
        
        try {
            // Check file exists
            const stats = await fs.stat(filePath);
            
            // Check file size
            if (stats.size > this.maxFileSize) {
                errors.push(`File size ${stats.size} exceeds maximum allowed size ${this.maxFileSize}`);
            }
            
            // Check file type by reading file signature
            const detectedType = await fileType.fromFile(filePath);
            if (!detectedType || !this.allowedMimes.includes(detectedType.mime)) {
                errors.push(`Invalid file type. Detected: ${detectedType?.mime || 'unknown'}`);
            }
            
            // Check file extension
            const ext = path.extname(originalName).toLowerCase();
            if (!this.allowedExtensions.includes(ext)) {
                errors.push(`Invalid file extension: ${ext}`);
            }
            
            // Check for suspicious filenames
            if (this.containsSuspiciousPatterns(originalName)) {
                errors.push('Filename contains suspicious patterns');
            }
            
            return {
                isValid: errors.length === 0,
                errors,
                detectedType: detectedType?.mime,
                fileSize: stats.size
            };
            
        } catch (error) {
            return {
                isValid: false,
                errors: [`File validation error: ${error.message}`]
            };
        }
    }
    
    containsSuspiciousPatterns(filename) {
        const suspiciousPatterns = [
            /\.php$/i, /\.asp$/i, /\.jsp$/i, /\.exe$/i, /\.bat$/i,
            /\.sh$/i, /\.cmd$/i, /script/i, /javascript:/i
        ];
        
        return suspiciousPatterns.some(pattern => pattern.test(filename));
    }
}
```

#### **2. Secure File Storage**

```javascript
// Secure file storage with proper permissions
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

class SecureFileStorage {
    constructor(baseUploadPath) {
        this.baseUploadPath = baseUploadPath;
        this.tempDirectory = path.join(baseUploadPath, '.temp');
    }
    
    async secureStore(tempFilePath, modelSlug, filename) {
        // Generate secure filename
        const timestamp = Date.now();
        const hash = crypto.createHash('sha256')
            .update(`${modelSlug}_${filename}_${timestamp}`)
            .digest('hex').substring(0, 16);
        const ext = path.extname(filename);
        const secureFilename = `${timestamp}_${hash}${ext}`;
        
        // Create model-specific directory with proper permissions
        const modelDir = path.join(this.baseUploadPath, modelSlug, 'media');
        await fs.mkdir(modelDir, { recursive: true, mode: 0o755 });
        
        // Store file with restricted permissions
        const finalPath = path.join(modelDir, secureFilename);
        await fs.copyFile(tempFilePath, finalPath);
        await fs.chmod(finalPath, 0o644);
        
        // Remove temp file
        await fs.unlink(tempFilePath);
        
        return {
            storedPath: finalPath,
            filename: secureFilename,
            relativePath: `/uploads/${modelSlug}/media/${secureFilename}`
        };
    }
}
```

### **SQL Injection Prevention**

```javascript
// Always use parameterized queries
class SecureDBAccess {
    constructor(dbConnection) {
        this.db = dbConnection;
    }
    
    // Good: Parameterized query
    async getMediaBySlug(modelSlug, status) {
        const query = `
            SELECT * FROM model_media_library 
            WHERE model_slug = ? AND moderation_status = ?
            ORDER BY upload_date DESC
        `;
        return await this.db.query(query, [modelSlug, status]);
    }
    
    // Bad: String concatenation (DON'T DO THIS)
    async getMediaBySlugUnsafe(modelSlug, status) {
        const query = `
            SELECT * FROM model_media_library 
            WHERE model_slug = '${modelSlug}' AND moderation_status = '${status}'
        `;
        return await this.db.query(query); // VULNERABLE!
    }
    
    // Complex query with proper parameterization
    async searchMediaSecure(modelSlug, searchTerm, categoryId, limit, offset) {
        let query = `
            SELECT mml.*, mmc.category_name
            FROM model_media_library mml
            LEFT JOIN model_media_categories mmc ON mml.category_id = mmc.id
            WHERE mml.model_slug = ?
        `;
        const params = [modelSlug];
        
        if (searchTerm) {
            query += ` AND (mml.original_filename LIKE ? OR mml.alt_text LIKE ?)`;
            params.push(`%${searchTerm}%`, `%${searchTerm}%`);
        }
        
        if (categoryId) {
            query += ` AND mml.category_id = ?`;
            params.push(categoryId);
        }
        
        query += ` ORDER BY mml.upload_date DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);
        
        return await this.db.query(query, params);
    }
}
```

---

## 🚀 **Deployment & Maintenance**

### **Production Deployment Checklist**

#### **1. Environment Preparation**

```bash
# Production server setup script
#!/bin/bash

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install MySQL 8.0
sudo apt install mysql-server-8.0 -y
sudo mysql_secure_installation

# Install Redis
sudo apt install redis-server -y
sudo systemctl enable redis-server

# Install PM2 for process management
sudo npm install -g pm2

# Create application user
sudo useradd -m -s /bin/bash phoenix4ge
sudo usermod -aG sudo phoenix4ge

# Setup application directory
sudo mkdir -p /var/www/phoenix4ge
sudo chown phoenix4ge:phoenix4ge /var/www/phoenix4ge

# Setup log directory
sudo mkdir -p /var/log/phoenix4ge
sudo chown phoenix4ge:phoenix4ge /var/log/phoenix4ge
```

#### **2. Application Configuration**

```javascript
// ecosystem.config.js - PM2 configuration
module.exports = {
    apps: [{
        name: 'phoenix4ge-media',
        script: './server.js',
        instances: 'max',
        exec_mode: 'cluster',
        env: {
            NODE_ENV: 'production',
            PORT: 3000
        },
        env_production: {
            NODE_ENV: 'production',
            PORT: 3000,
            LOG_LEVEL: 'warn'
        },
        log_file: '/var/log/phoenix4ge/combined.log',
        out_file: '/var/log/phoenix4ge/out.log',
        error_file: '/var/log/phoenix4ge/error.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss',
        merge_logs: true,
        max_memory_restart: '1G',
        node_args: '--max-old-space-size=4096'
    }]
};
```

#### **3. Database Optimization**

```sql
-- Production database optimizations
-- my.cnf or mysql.conf.d/mysqld.cnf

[mysqld]
# Performance optimizations
innodb_buffer_pool_size = 2G
innodb_log_file_size = 256M
innodb_flush_log_at_trx_commit = 2
innodb_file_per_table = 1

# Query cache (if using MySQL < 8.0)
query_cache_type = 1
query_cache_size = 256M

# Connection settings
max_connections = 200
wait_timeout = 300
interactive_timeout = 300

# Slow query logging
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 2
log_queries_not_using_indexes = 1
```

#### **4. Nginx Configuration**

```nginx
# /etc/nginx/sites-available/phoenix4ge
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL Configuration
    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Upload size limits
    client_max_body_size 100M;
    client_body_timeout 60s;

    # Static files
    location /uploads/ {
        alias /var/www/phoenix4ge/public/uploads/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        
        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
    }

    # API endpoints
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts for large uploads
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Application
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### **Monitoring and Maintenance**

#### **1. Health Check Endpoint**

```javascript
// routes/health.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const redis = require('../config/redis');

router.get('/health', async (req, res) => {
    const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        services: {}
    };

    // Check database
    try {
        await db.query('SELECT 1');
        health.services.database = 'healthy';
    } catch (error) {
        health.services.database = 'unhealthy';
        health.status = 'degraded';
    }

    // Check Redis
    try {
        await redis.ping();
        health.services.redis = 'healthy';
    } catch (error) {
        health.services.redis = 'unhealthy';
        health.status = 'degraded';
    }

    // Check disk space
    try {
        const stats = await fs.statvfs('/var/www/phoenix4ge/public/uploads');
        const freeSpacePercent = (stats.bavail * stats.bsize) / (stats.blocks * stats.bsize) * 100;
        health.services.disk = {
            status: freeSpacePercent > 10 ? 'healthy' : 'warning',
            freeSpacePercent: Math.round(freeSpacePercent)
        };
    } catch (error) {
        health.services.disk = 'unknown';
    }

    const statusCode = health.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(health);
});

module.exports = router;
```

#### **2. Log Rotation Script**

```bash
#!/bin/bash
# /etc/logrotate.d/phoenix4ge

/var/log/phoenix4ge/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 phoenix4ge phoenix4ge
    postrotate
        pm2 reloadLogs
    endscript
}
```

#### **3. Backup Script**

```bash
#!/bin/bash
# backup-phoenix4ge.sh

BACKUP_DIR="/backup/phoenix4ge"
DB_NAME="phoenix4ge_db"
UPLOADS_DIR="/var/www/phoenix4ge/public/uploads"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Database backup
mysqldump --single-transaction --routines --triggers $DB_NAME | gzip > $BACKUP_DIR/database_$DATE.sql.gz

# Files backup
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz -C $UPLOADS_DIR .

# Cleanup old backups (keep 30 days)
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

echo "Backup completed: $DATE"
```

---

## 🔧 **Extending the System**

### **Adding New Image Processing Operations**

If you need to add new image processing capabilities:

1. **Add the processing logic** to `ImageProcessingService.js`
2. **Create API endpoint** in `routes/api/model-media-library.js`
3. **Add frontend interface** in `admin/js/image-editor.js`
4. **Update documentation** and tests

### **Integrating External Services**

For external API integrations:

1. **Create dedicated service class** (e.g., `ExternalAPIService.js`)
2. **Implement proper error handling** and retry logic
3. **Add configuration options** via environment variables
4. **Create webhook handlers** for async responses
5. **Add monitoring and alerting** for service health

### **Custom Moderation Providers**

To add support for new moderation services:

1. **Extend `ContentModerationAPI.js`** with provider-specific logic
2. **Add provider configuration** in environment variables
3. **Implement provider-specific** webhook handling
4. **Add provider switching logic** based on configuration

---

## 📚 **Additional Resources**

### **Documentation Files**
- `docs/API_DOCUMENTATION.md` - Complete API reference
- `docs/PHASE_B_INTEGRATION_COMPLETE.md` - Implementation details
- `docs/MEDIA_GALLERY_OPERATIONS_REVIEW.md` - System review and analysis

### **Configuration Files**
- `.env.example` - Environment variable template
- `ecosystem.config.js` - PM2 process management
- `package.json` - Dependencies and scripts

### **Test Files**
- `tests/integration/moderation-workflow-test.js` - End-to-end testing
- `tests/unit/` - Unit tests for individual services

### **Useful Commands**

```bash
# Development
npm run dev                    # Start development server
npm test                      # Run all tests
npm run test:integration      # Run integration tests only
npm run lint                  # Code linting
npm run format               # Code formatting

# Database
npm run db:migrate           # Run database migrations  
npm run db:rollback          # Rollback last migration
npm run db:seed              # Seed database with test data

# Production
pm2 start ecosystem.config.js --env production
pm2 logs phoenix4ge-media      # View logs
pm2 restart phoenix4ge-media   # Restart application
pm2 stop phoenix4ge-media      # Stop application
```

### **Getting Help**

If you encounter issues:

1. **Check the logs** - Application logs contain detailed error information
2. **Review error codes** - API documentation includes common error scenarios
3. **Run health checks** - Use `/health` endpoint to verify system status
4. **Check service status** - Verify database, Redis, and external services are running
5. **Review configuration** - Ensure environment variables are correctly set

---

*This guide covers the essential aspects of working with the phoenix4ge Media Library system. For specific technical questions or advanced customization needs, refer to the source code and comprehensive documentation provided.*