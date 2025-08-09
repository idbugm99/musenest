# MuseNest Media Library: Quick Reference Guide

**Version:** 2.0  
**Last Updated:** August 9, 2025  
**Quick Access:** Essential commands, endpoints, and code snippets

---

## 🚀 **Quick Start Commands**

```bash
# Setup
git clone https://github.com/your-org/musenest.git
cd musenest
npm install
cp .env.example .env  # Configure your settings
npm run db:migrate
npm run dev

# Testing
npm test                              # All tests
npm run test:integration             # Integration tests only
node tests/integration/moderation-workflow-test.js  # Full workflow test

# Production
npm run build                        # Build for production
pm2 start ecosystem.config.js       # Start with PM2
pm2 logs musenest-media             # View logs
```

---

## 📡 **Essential API Endpoints**

### **Media Management**
```http
GET    /api/model-media-library/{modelSlug}                    # List media
POST   /api/model-media-library/{modelSlug}/upload            # Upload files
GET    /api/model-media-library/{modelSlug}/{mediaId}         # Get media details
DELETE /api/model-media-library/{modelSlug}/{mediaId}         # Delete media
```

### **Image Processing**
```http
POST   /api/model-media-library/{modelSlug}/{mediaId}/crop    # Crop image
POST   /api/model-media-library/{modelSlug}/{mediaId}/rotate  # Rotate image
POST   /api/model-media-library/{modelSlug}/{mediaId}/resize  # Resize image
POST   /api/model-media-library/{modelSlug}/{mediaId}/filter  # Apply filters
```

### **Categories**
```http
GET    /api/model-media-library/{modelSlug}/categories        # List categories
POST   /api/model-media-library/{modelSlug}/categories        # Create category
```

### **System Health**
```http
GET    /api/health                                           # Health check
GET    /api/analytics/{modelSlug}/media-performance          # Analytics
```

---

## 🛠️ **Code Snippets**

### **Upload Files (JavaScript)**
```javascript
async function uploadFiles(modelSlug, files) {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    formData.append('apply_watermark', 'true');
    
    const response = await fetch(`/api/model-media-library/${modelSlug}/upload`, {
        method: 'POST',
        body: formData
    });
    
    return await response.json();
}
```

### **Process Image (JavaScript)**
```javascript
async function cropImage(modelSlug, mediaId, cropData) {
    const response = await fetch(`/api/model-media-library/${modelSlug}/${mediaId}/crop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            x: cropData.x,
            y: cropData.y,
            width: cropData.width,
            height: cropData.height
        })
    });
    
    return await response.json();
}
```

### **Database Query (Node.js)**
```javascript
// Get media with pagination
async function getMedia(modelSlug, page = 1, limit = 24) {
    const offset = (page - 1) * limit;
    
    const query = `
        SELECT mml.*, mmc.category_name
        FROM model_media_library mml
        LEFT JOIN model_media_categories mmc ON mml.category_id = mmc.id
        WHERE mml.model_slug = ? AND mml.is_deleted = 0
        ORDER BY mml.upload_date DESC
        LIMIT ? OFFSET ?
    `;
    
    return await db.query(query, [modelSlug, limit, offset]);
}
```

### **Service Initialization Pattern**
```javascript
// Standard service initialization
class MyCustomService {
    constructor(dbConnection, options = {}) {
        this.db = dbConnection;
        this.config = { ...defaultOptions, ...options };
    }
    
    async initialize() {
        try {
            // Setup logic here
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}
```

---

## 🎨 **Frontend Integration**

### **Initialize Media Library**
```javascript
// In your HTML page
<script src="/admin/js/media-library.js"></script>
<script>
document.addEventListener('DOMContentLoaded', function() {
    const modelSlug = 'your-model-slug';
    window.mediaLibrary = new MuseNestMediaLibrary(modelSlug);
});
</script>
```

### **Upload Handler**
```javascript
// Handle file uploads
document.getElementById('file-input').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    const result = await mediaLibrary.handleFileUpload(files);
    console.log('Upload result:', result);
});
```

### **Image Editor Integration**
```javascript
// Open image editor
function editImage(mediaId) {
    mediaLibrary.editImage(mediaId);
}

// Apply crop operation
async function applyCrop(mediaId, cropParams) {
    const result = await mediaLibrary.cropImage(mediaId, cropParams);
    if (result.success) {
        mediaLibrary.showNotification('Image cropped successfully', 'success');
        mediaLibrary.loadMedia(); // Refresh grid
    }
}
```

---

## 🗄️ **Database Schemas**

### **Media Library Table**
```sql
CREATE TABLE model_media_library (
    id INT PRIMARY KEY AUTO_INCREMENT,
    model_slug VARCHAR(100) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_size BIGINT UNSIGNED,
    image_width INT UNSIGNED,
    image_height INT UNSIGNED,
    moderation_status ENUM('pending','approved','rejected','flagged') DEFAULT 'pending',
    category_id INT UNSIGNED,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    watermark_applied BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    
    INDEX idx_model_status (model_slug, moderation_status),
    INDEX idx_upload_date (upload_date DESC)
);
```

### **Categories Table**
```sql
CREATE TABLE model_media_categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    model_slug VARCHAR(100) NOT NULL,
    category_name VARCHAR(100) NOT NULL,
    category_slug VARCHAR(100) NOT NULL,
    category_description TEXT,
    category_color VARCHAR(7) DEFAULT '#007bff',
    category_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    
    UNIQUE KEY unique_category (model_slug, category_slug)
);
```

---

## ⚙️ **Configuration Examples**

### **Environment Variables**
```bash
# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=musenest_db
DB_USER=musenest_user
DB_PASSWORD=secure_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Media Settings
MEDIA_MAX_FILE_SIZE=52428800
WATERMARK_ENABLED=true
MEDIA_STORAGE_PATH=/uploads/

# External APIs
MODERATION_API_ENDPOINT=https://api.moderation-service.com
MODERATION_API_KEY=your_api_key
```

### **Service Configuration**
```javascript
// Initialize services with configuration
const uploadService = new MediaUploadService(db, {
    enableWatermarking: true,
    maxFileSize: 50 * 1024 * 1024,
    allowedFormats: ['jpeg', 'png', 'gif', 'webp']
});

const cacheService = new GalleryCacheService({
    defaultTTL: 3600,
    enableCompression: true
});

const notificationService = new AdminNotificationService(db, {
    enableRealTime: true,
    enableEmail: false,
    maxNotificationsPerHour: 100
});
```

---

## 🐛 **Debugging Quick Fixes**

### **Common Issues & Solutions**

**Upload fails with ENOENT:**
```javascript
// Ensure directory exists
const uploadDir = path.join(process.cwd(), 'public', 'uploads', modelSlug);
await fs.mkdir(uploadDir, { recursive: true });
```

**Database connection timeout:**
```javascript
// Increase timeout in database config
const pool = mysql.createPool({
    acquireTimeout: 60000,
    timeout: 60000,
    // ... other options
});
```

**Memory issues with image processing:**
```javascript
// Always destroy Sharp instances
const sharpInstance = sharp(inputPath);
try {
    await sharpInstance.resize(800, 600).toFile(outputPath);
} finally {
    sharpInstance.destroy();
}
```

### **Enable Debug Logging**
```bash
# Enable all debug logs
DEBUG=musenest:* npm run dev

# Enable specific module logs  
DEBUG=musenest:media,musenest:upload npm run dev
```

---

## 📊 **Performance Tips**

### **Database Optimization**
```sql
-- Add essential indexes
ALTER TABLE model_media_library ADD INDEX idx_model_category (model_slug, category_id);
ALTER TABLE model_media_library ADD INDEX idx_status_date (moderation_status, upload_date DESC);

-- Optimize queries with proper LIMIT
SELECT * FROM model_media_library 
WHERE model_slug = ? 
ORDER BY upload_date DESC 
LIMIT 24 OFFSET ?;
```

### **Image Processing Optimization**
```javascript
// Use appropriate quality settings
const settings = {
    thumbnail: { quality: 80, progressive: true },
    web: { quality: 85, progressive: true },
    print: { quality: 95, progressive: false }
};

// Generate progressive JPEG
await sharp(input)
    .jpeg({ quality: 85, progressive: true })
    .toFile(output);
```

### **Caching Strategy**
```javascript
// Cache expensive operations
const cache = require('./utils/cache');

async function getMediaWithCache(modelSlug, options) {
    const cacheKey = `media:${modelSlug}:${JSON.stringify(options)}`;
    
    let data = await cache.get(cacheKey);
    if (!data) {
        data = await fetchMediaFromDB(modelSlug, options);
        await cache.set(cacheKey, data, 1800); // 30 minutes
    }
    
    return data;
}
```

---

## 🔒 **Security Checklist**

### **File Upload Security**
```javascript
// Validate file type by reading file signature
const fileType = require('file-type');
const detectedType = await fileType.fromFile(filePath);

if (!allowedMimes.includes(detectedType.mime)) {
    throw new Error('Invalid file type');
}
```

### **SQL Injection Prevention**
```javascript
// Always use parameterized queries
const query = 'SELECT * FROM media WHERE model_slug = ? AND status = ?';
const results = await db.query(query, [modelSlug, status]);

// Never use string concatenation
// const query = `SELECT * FROM media WHERE model_slug = '${modelSlug}'`; // DON'T!
```

### **Access Control**
```javascript
// Verify user permissions
async function checkMediaAccess(userId, modelSlug) {
    const query = `
        SELECT COUNT(*) as count 
        FROM model_users 
        WHERE user_id = ? AND model_slug = ? AND role IN ('admin', 'owner')
    `;
    const result = await db.query(query, [userId, modelSlug]);
    return result[0].count > 0;
}
```

---

## 📞 **Emergency Procedures**

### **System Recovery**
```bash
# Restart all services
pm2 restart all

# Check system health
curl http://localhost:3000/api/health

# View recent errors
pm2 logs musenest-media --err --lines 50

# Database connection test
mysql -h localhost -u musenest_user -p musenest_db -e "SELECT COUNT(*) FROM model_media_library;"
```

### **Rollback Procedures**
```bash
# Rollback database migration
npm run db:rollback

# Rollback to previous deployment
pm2 restart musenest-media --update-env

# Restore from backup
gunzip < /backup/database_latest.sql.gz | mysql musenest_db
```

---

## 🎯 **Testing Commands**

```bash
# Run all tests
npm test

# Run specific test file
npm test tests/integration/moderation-workflow-test.js

# Run with coverage
npm run test:coverage

# Test specific service
node -e "
const service = require('./src/services/MediaUploadService.js');
console.log('Service loaded successfully');
"

# Test database connection
node -e "
const db = require('./config/database.js');
db.query('SELECT 1').then(() => console.log('DB OK')).catch(console.error);
"
```

---

## 🔗 **Useful Links**

- **API Documentation:** `docs/API_DOCUMENTATION.md`
- **How-To Guide:** `docs/HOW_TO_GUIDE.md` 
- **System Review:** `docs/MEDIA_GALLERY_OPERATIONS_REVIEW.md`
- **Integration Status:** `docs/PHASE_B_INTEGRATION_COMPLETE.md`

---

*Keep this reference handy for quick access to common operations and troubleshooting. For detailed information, refer to the comprehensive documentation files.*