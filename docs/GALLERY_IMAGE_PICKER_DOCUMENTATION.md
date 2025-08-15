# Gallery Image Picker - Complete Documentation

## Overview

The Gallery Image Picker is a comprehensive image management system for MuseNest, providing advanced multi-select capabilities, public safety enforcement, batch operations, and enterprise-grade performance optimizations.

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [API Reference](#api-reference)
- [Frontend Components](#frontend-components)
- [Performance & Caching](#performance--caching)
- [Security & Safety](#security--safety)
- [Monitoring & Analytics](#monitoring--analytics)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)

## Features

### Core Functionality
- **Multi-select Image Management**: Select and manage multiple images simultaneously with persistent selection across pagination and filters
- **Advanced Filtering**: Filter by status (approved, approved_blurred, all), context (public_site, paysite, private), and search terms
- **Batch Operations**: Add, remove, and move images between gallery sections in batch operations
- **Public Safety Enforcement**: Automatic content filtering for public sections with server-side validation
- **Real-time Upload**: Upload and automatically select new images within the picker interface
- **Performance Caching**: 5-minute request caching with deduplication for optimal performance

### User Experience
- **Bootstrap 5.3 Design**: Modern, responsive interface with gradient effects and smooth animations
- **Accessibility Compliant**: WCAG 2.1 AA compliant with keyboard navigation and screen reader support
- **Progress Tracking**: Real-time progress indicators for batch operations with detailed results
- **Error Handling**: Graceful error handling with user-friendly messages and recovery options

### Enterprise Features
- **Comprehensive Analytics**: Real-time performance metrics and user behavior tracking
- **Production Monitoring**: Health checks, alerts, and Prometheus metrics export
- **Database Optimization**: Composite indexes for sub-100ms query performance
- **Security Hardening**: Input validation, SQL injection protection, and path traversal prevention

## Architecture

### System Components

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend UI   │    │   API Endpoints  │    │    Database     │
│                 │    │                  │    │                 │
│ • Gallery Modal │◄──►│ • Library API    │◄──►│ • Media Library │
│ • Multi-select  │    │ • Batch Ops      │    │ • Gallery Imgs  │
│ • Filters       │    │ • Upload API     │    │ • Sections      │
│ • Progress UI   │    │ • Monitoring     │    │ • Models        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Performance   │    │    Security      │    │   Monitoring    │
│                 │    │                  │    │                 │
│ • Request Cache │    │ • Input Valid.   │    │ • Real-time     │
│ • Deduplication │    │ • Safety Enforce │    │ • Metrics       │
│ • DB Indexes    │    │ • Rate Limiting  │    │ • Health Checks │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Data Flow

1. **User Interaction**: User opens gallery picker and applies filters
2. **API Request**: Frontend sends request to `/api/model-gallery/:slug/library`
3. **Cache Check**: System checks for cached response (5-minute TTL)
4. **Database Query**: Optimized query with composite indexes (<100ms)
5. **Safety Validation**: Content filtering based on section visibility
6. **Response**: Paginated results with metadata returned to frontend
7. **UI Update**: Grid updates with smooth animations and accessibility features
8. **Analytics**: Performance metrics and user interactions tracked

## API Reference

### Library Listing API

```http
GET /api/model-gallery/:modelSlug/library
```

#### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | `approved` | Filter by moderation status (`approved`, `approved_blurred`, `all`) |
| `context` | string | `all` | Filter by usage intent (`public_site`, `paysite`, `private`, `all`) |
| `search` | string | `""` | Search term for filename filtering |
| `sort` | string | `newest` | Sort order (`newest`, `oldest`, `name`) |
| `page` | number | `1` | Page number for pagination |
| `limit` | number | `24` | Items per page (max 100) |
| `section_id` | number | `null` | Optional section ID to check inclusion status |

#### Response

```json
{
  "success": true,
  "data": {
    "images": [
      {
        "id": 123,
        "filename": "example_image.jpg",
        "size": 1048576,
        "width": 1920,
        "height": 1080,
        "moderation_status": "approved",
        "usage_intent": "public_site",
        "created_at": "2025-08-10T12:00:00.000Z",
        "in_section": false
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 24,
      "total": 150,
      "pages": 7
    }
  }
}
```

### Batch Add API

```http
POST /api/model-gallery/:modelSlug/sections/:id/images/batch
```

#### Request Body

```json
{
  "filenames": ["image1.jpg", "image2.jpg"],
  "caption": "Optional caption",
  "tags": "Optional tags"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "summary": {
      "added": 2,
      "skipped": 0,
      "failed": 0
    },
    "results": [
      {
        "filename": "image1.jpg",
        "status": "added",
        "reason": null
      },
      {
        "filename": "image2.jpg", 
        "status": "added",
        "reason": null
      }
    ]
  }
}
```

### Batch Remove API

```http
DELETE /api/model-gallery/:modelSlug/sections/:id/images/batch
```

#### Request Body

```json
{
  "filenames": ["image1.jpg", "image2.jpg"]
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "removed": 2,
    "total_requested": 2,
    "results": [
      {
        "filename": "image1.jpg",
        "status": "removed"
      },
      {
        "filename": "image2.jpg",
        "status": "removed"
      }
    ]
  }
}
```

## Frontend Components

### Gallery Image Picker Modal

**File**: `/admin/components/gallery-image-picker.html`

#### JavaScript API

```javascript
// Open the picker
window.openGalleryImagePicker({
  slug: 'model-slug',
  sectionId: 123,
  sectionInfo: {
    title: 'Section Name',
    is_visible: true // public vs private section
  }
});

// Access picker instance
const picker = window.galleryImagePicker;

// Get selected images
const selected = picker.selectedImages; // Set of filenames

// Clear selection
picker.clearSelection();

// Toggle multi-select mode
picker.toggleMultiSelectMode();
```

#### CSS Classes

```css
/* Core picker styles */
.picker-image-tile          /* Individual image tiles */
.picker-image-tile.selected /* Selected state */
.picker-image-tile.disabled /* Disabled/unavailable images */
.multi-select-mode          /* Container in multi-select mode */

/* Status badges */
.status-badge-approved      /* Green badge for approved */
.status-badge-approved_blurred /* Blue badge for approved_blurred */
.status-badge-pending       /* Yellow badge for pending */
.status-badge-flagged       /* Red badge for flagged */

/* Context badges */
.context-badge-public_site  /* Teal badge for public content */
.context-badge-paysite      /* Purple badge for paysite content */
.context-badge-private      /* Gray badge for private content */

/* Selection management */
.selected-chip              /* Individual selected image chips */
.selected-chip .remove-chip /* Remove button within chips */
```

### Integration Example

```html
<!-- In gallery management page -->
<button type="button" class="btn btn-primary" onclick="openGalleryImagePicker({
  slug: '{{ model.slug }}', 
  sectionId: {{ section.id }},
  sectionInfo: {
    title: '{{ section.title }}',
    is_visible: {{ section.is_visible }}
  }
})">
  <i class="fas fa-images me-1"></i>Add Images to Gallery
</button>

<!-- Include the picker component -->
{{> gallery-image-picker}}
```

## Performance & Caching

### Request Caching

The system implements intelligent caching with these features:

- **5-minute TTL**: Cached responses expire after 5 minutes
- **Request Deduplication**: Identical concurrent requests share results
- **Cache Size Limit**: Maximum 50 cached responses to prevent memory issues
- **Cache Keys**: Include all filter parameters for accurate cache hits

#### Cache Configuration

```javascript
// Configuration in gallery-image-picker.html
this.requestCache = new Map();
this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
this.pendingRequests = new Map();
```

### Database Optimization

#### Production Indexes

The following indexes provide optimal query performance:

```sql
-- Library listing optimization
CREATE INDEX idx_gallery_library_optimal 
ON model_media_library (model_slug, moderation_status, usage_intent, upload_date);

-- Gallery section images
CREATE INDEX idx_gallery_section_images 
ON gallery_images (model_id, section_id, is_active, order_index);

-- Model sections
CREATE INDEX idx_model_sections 
ON gallery_sections (model_id, is_visible, sort_order);

-- Filename validation
CREATE INDEX idx_media_library_filename 
ON model_media_library (model_slug, filename, is_deleted);

-- Content filtering
CREATE INDEX idx_media_library_moderation 
ON model_media_library (moderation_status, usage_intent, upload_date);
```

#### Query Performance

- **Library queries**: < 100ms typical response time
- **Batch operations**: < 30s for 50 images
- **Upload processing**: < 5s per image
- **Cache hit rate**: > 80% for library requests

## Security & Safety

### Public Safety Enforcement

The system automatically enforces content safety rules:

#### Public Sections
- Only `approved` or `approved_blurred` content allowed
- Only `public_site` usage intent permitted
- Server-side validation prevents bypassing UI restrictions
- Security violations logged for monitoring

#### Private Sections
- All content types allowed
- Warnings shown for flagged content
- User confirmation required for mixed safety content

### Input Validation

```javascript
// Filename validation regex
const filenameRegex = /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(jpg|jpeg|png|gif|webp)$/i;

// Security checks
- Path traversal protection (no ../, /, \\)
- Filename length limit (255 characters)
- File type validation
- SQL injection prevention
- Rate limiting protection
```

### Security Headers

Production deployment includes:

```javascript
// Content Security Policy
CSP_DEFAULT_SRC: "'self'"
CSP_SCRIPT_SRC: "'self' 'unsafe-inline'"
CSP_STYLE_SRC: "'self' 'unsafe-inline' https://cdn.jsdelivr.net"
CSP_IMG_SRC: "'self' data: https:"

// Additional headers
HSTS_MAX_AGE: 31536000
FORCE_HTTPS: true
```

## Monitoring & Analytics

### Health Check Endpoint

```http
GET /api/gallery-monitoring/health
```

Returns comprehensive health information:

```json
{
  "success": true,
  "data": {
    "status": "healthy", // healthy, warning, critical
    "timestamp": 1754812901855,
    "metrics": {
      "requests": {
        "total": 150,
        "errors": 2,
        "errorRate": 1.33
      },
      "cache": {
        "hits": 120,
        "misses": 30,
        "hitRate": 80
      },
      "performance": {
        "responseTime": {
          "avg": 85,
          "p95": 150,
          "p99": 200
        }
      }
    },
    "uptime": 86400
  }
}
```

### Metrics Tracking

The system tracks comprehensive metrics:

#### Request Metrics
- Total requests, success/error counts
- Response times (average, p95, p99)
- Cache hit/miss rates
- Database query performance

#### Operation Metrics
- Batch add/remove operations
- Upload operations and success rates
- Image processing times
- Bytes processed

#### User Behavior
- Picker opens and interactions
- Search usage patterns
- Filter change frequency
- Multi-select adoption

#### Error Tracking
- Validation errors
- Security violations
- Database errors
- File system errors

### Prometheus Integration

```http
GET /api/gallery-monitoring/prometheus
```

Exports metrics in Prometheus format for monitoring tools:

```
# TYPE gallery_library_requests_total counter
gallery_library_requests_total 150

# TYPE gallery_library_response_time histogram
gallery_library_response_time_count 150
gallery_library_response_time_sum 12750
gallery_library_response_time{quantile="0.5"} 75
gallery_library_response_time{quantile="0.95"} 150
gallery_library_response_time{quantile="0.99"} 200
```

### Live Monitoring

```http
GET /api/gallery-monitoring/live
```

Server-Sent Events endpoint for real-time monitoring:

```javascript
const eventSource = new EventSource('/api/gallery-monitoring/live');
eventSource.onmessage = function(event) {
  const data = JSON.parse(event.data);
  if (data.type === 'health') {
    updateHealthDashboard(data.data);
  }
};
```

## Production Deployment

### Environment Configuration

Copy `.env.production.example` to `.env` and configure:

```bash
# Essential settings
NODE_ENV=production
DB_HOST=your-production-db-host
DB_PASSWORD=your-strong-password
JWT_SECRET=your-super-secure-jwt-secret-at-least-32-characters

# Gallery-specific settings  
GALLERY_BATCH_LIMIT=50
GALLERY_CACHE_TTL=300
GALLERY_CONCURRENT_UPLOADS=3
GALLERY_PICKER_ANALYTICS_ENABLED=true

# Performance optimization
ENABLE_COMPRESSION=true
CDN_ENABLED=true
CDN_URL=https://cdn.yourdomain.com

# Security
FORCE_HTTPS=true
RATE_LIMIT_MAX=100
```

### Deployment Checklist

Run the deployment readiness check:

```bash
node scripts/gallery-picker-deploy-check.js
```

This validates:
- ✅ Database indexes exist
- ✅ Environment variables configured  
- ✅ File system permissions
- ✅ API endpoints available
- ✅ Query performance (<100ms)
- ✅ Security configuration

### Database Setup

1. **Create production indexes**:
   ```bash
   node scripts/add_gallery_production_indexes.js
   ```

2. **Verify performance**:
   ```bash
   node scripts/gallery-picker-deploy-check.js
   ```

### Monitoring Setup

1. **Health checks**: Configure load balancer to monitor `/api/gallery-monitoring/health`
2. **Metrics collection**: Point Prometheus to `/api/gallery-monitoring/prometheus`
3. **Alerting**: Set up alerts for:
   - Error rate > 5%
   - Response time > 1000ms
   - Cache hit rate < 70%

### Performance Targets

Production deployment should achieve:

| Metric | Target | Critical Threshold |
|--------|--------|--------------------|
| Library API Response | < 100ms | > 500ms |
| Batch Operation Time | < 30s | > 60s |
| Upload Processing | < 5s/image | > 15s/image |
| Cache Hit Rate | > 80% | < 50% |
| Error Rate | < 1% | > 5% |
| Database Query Time | < 50ms | > 200ms |

## Troubleshooting

### Common Issues

#### 1. Images Not Loading

**Symptoms**: Gallery shows "No Image" placeholders

**Solutions**:
```bash
# Check file permissions
chmod -R 755 public/uploads

# Verify file paths in database match actual files
node scripts/normalize_uploads.js MODEL_SLUG

# Check database-file consistency
SELECT filename FROM model_media_library 
WHERE model_slug = 'MODEL_SLUG' 
AND filename NOT IN (SELECT filename FROM actual_files);
```

#### 2. Slow Performance

**Symptoms**: Library queries taking > 500ms

**Solutions**:
```bash
# Check database indexes
SHOW INDEX FROM model_media_library;

# Add missing indexes
node scripts/add_gallery_production_indexes.js

# Analyze slow queries
EXPLAIN SELECT * FROM model_media_library 
WHERE model_slug = 'example' AND moderation_status = 'approved';
```

#### 3. Batch Operations Failing

**Symptoms**: 500 errors during batch add/remove

**Solutions**:
```bash
# Check server logs
tail -f logs/error.log

# Verify database connection
node scripts/verify-db.js

# Test with smaller batch sizes
curl -X POST /api/model-gallery/MODEL_SLUG/sections/ID/images/batch \
  -d '{"filenames": ["single-image.jpg"]}'
```

#### 4. Cache Not Working

**Symptoms**: Every request hits database

**Check Analytics**:
```bash
curl localhost:3000/api/gallery-monitoring/metrics | jq '.data.metrics | 
  {hits: ."gallery.library.cache.hits", misses: ."gallery.library.cache.misses"}'
```

**Solutions**:
- Verify request parameters are identical
- Check cache TTL configuration
- Restart server to clear corrupted cache

#### 5. Security Violations

**Symptoms**: Public sections allowing inappropriate content

**Check Logs**:
```bash
grep "Security violation" logs/app.log
curl localhost:3000/api/gallery-monitoring/metrics | 
  jq '.data.metrics."gallery.errors.security_violations"'
```

**Solutions**:
- Verify section `is_visible` flag
- Check content `moderation_status` and `usage_intent`
- Review server-side validation logic

### Debug Mode

Enable detailed logging in development:

```bash
# Environment variables
DEBUG=gallery-picker:*
LOG_LEVEL=debug

# Check analytics in real-time
curl localhost:3000/api/gallery-monitoring/live
```

### Performance Profiling

```bash
# Monitor database performance
SHOW PROCESSLIST;
SHOW STATUS LIKE 'Slow_queries';

# Check memory usage
node --inspect server.js
# Connect Chrome DevTools for heap profiling

# Monitor file system
df -h public/uploads/
ls -la public/uploads/MODEL_SLUG/ | wc -l
```

### Support Resources

- **Health Dashboard**: `/api/gallery-monitoring/health`
- **Live Metrics**: `/api/gallery-monitoring/live`
- **Performance Data**: `/api/gallery-monitoring/performance`
- **Error Logs**: Check application logs for detailed error messages
- **Database Queries**: Use `EXPLAIN` to analyze slow queries

---

## Conclusion

The Gallery Image Picker provides a comprehensive, enterprise-grade solution for image management with advanced features, robust security, and extensive monitoring. This documentation covers all aspects of the system from basic usage to production deployment and troubleshooting.

For additional support or feature requests, please refer to the system monitoring endpoints and application logs for detailed diagnostic information.