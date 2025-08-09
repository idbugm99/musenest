# MuseNest Media Library API Documentation

**Version:** 2.0  
**Last Updated:** August 9, 2025  
**Base URL:** `/api/model-media-library`  

## 📋 **Table of Contents**
- [Authentication & Authorization](#authentication--authorization)
- [Media Library Management](#media-library-management)
- [Category Management](#category-management)
- [Image Processing Operations](#image-processing-operations)
- [Advanced Workflow APIs](#advanced-workflow-apis)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Response Formats](#response-formats)

---

## 🔐 **Authentication & Authorization**

### **Authentication Method**
The API uses session-based authentication with admin role verification.

```http
Headers:
  Cookie: connect.sid=<session-id>
  Content-Type: application/json (for JSON requests)
  Content-Type: multipart/form-data (for file uploads)
```

### **Authorization Levels**
- **Admin**: Full access to all endpoints for their assigned model
- **Model Owner**: Full access to media library for owned models
- **System Admin**: Access to all models and system-wide operations

---

## 📚 **Media Library Management**

### **1. List Media Items**

```http
GET /api/model-media-library/{modelSlug}
```

**Description:** Retrieve paginated list of media items with filtering and search capabilities.

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | No | 1 | Page number for pagination |
| `limit` | integer | No | 24 | Items per page (1-100) |
| `search` | string | No | "" | Search in filename, alt text, caption |
| `category` | string | No | "" | Filter by category ID or "all" |
| `status` | string | No | "" | Filter by moderation status |
| `sort` | string | No | "newest" | Sort order: `newest`, `oldest`, `name`, `size` |

**Example Request:**
```http
GET /api/model-media-library/jane-doe?page=1&limit=12&search=headshot&category=portraits&status=approved&sort=newest
```

**Response:**
```json
{
  "success": true,
  "media": [
    {
      "id": 123,
      "model_slug": "jane-doe",
      "filename": "IMG_20250809_headshot_001.jpg",
      "original_filename": "Professional_Headshot_001.jpg",
      "file_url": "/uploads/jane-doe/media/IMG_20250809_headshot_001.jpg",
      "thumbnail_url": "/uploads/jane-doe/media/thumbs/IMG_20250809_headshot_001.jpg",
      "file_size": 2485760,
      "image_width": 1920,
      "image_height": 1080,
      "moderation_status": "approved",
      "category_id": 5,
      "category_name": "Portraits",
      "category_color": "#007bff",
      "alt_text": "Professional headshot in studio lighting",
      "caption": "Professional headshot taken in studio with soft lighting",
      "upload_date": "2025-08-09T14:30:00.000Z",
      "last_modified": "2025-08-09T14:35:22.000Z",
      "watermark_applied": true,
      "processing_status": "completed"
    }
  ],
  "pagination": {
    "total": 147,
    "page": 1,
    "pages": 13,
    "limit": 12,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

### **2. Upload Media Files**

```http
POST /api/model-media-library/{modelSlug}/upload
```

**Description:** Upload multiple image files with watermarking and automatic moderation submission.

**Content-Type:** `multipart/form-data`

**Form Data Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `files` | File[] | Yes | Array of image files (max 20 files) |
| `apply_watermark` | boolean | No | Apply watermark to uploaded images (default: true) |
| `category_id` | integer | No | Category ID for uploaded images |
| `usage_intent` | string | No | Intended usage: `public_site`, `gallery`, `profile` |
| `context_type` | string | No | Upload context: `media_library`, `direct_upload` |
| `title` | string | No | Title for uploaded media |
| `description` | string | No | Description for uploaded media |

**File Constraints:**
- **Supported Formats:** JPEG, JPG, PNG, GIF, WebP
- **Maximum File Size:** 50MB per file
- **Maximum Files:** 20 files per request
- **Maximum Total Size:** 500MB per request

**Example Request:**
```javascript
const formData = new FormData();
formData.append('files', file1);
formData.append('files', file2);
formData.append('apply_watermark', 'true');
formData.append('category_id', '5');
formData.append('usage_intent', 'gallery');
formData.append('title', 'Portfolio Update Batch');

fetch('/api/model-media-library/jane-doe/upload', {
    method: 'POST',
    body: formData
});
```

**Response:**
```json
{
  "success": true,
  "message": "Upload completed successfully",
  "uploaded": [
    {
      "id": 124,
      "filename": "IMG_20250809_batch_001.jpg",
      "original_filename": "Portfolio_Update_001.jpg",
      "file_url": "/uploads/jane-doe/media/IMG_20250809_batch_001.jpg",
      "thumbnail_url": "/uploads/jane-doe/media/thumbs/IMG_20250809_batch_001.jpg",
      "moderation_status": "pending",
      "processing_status": "completed",
      "watermark_applied": true,
      "dimensions": {
        "width": 1920,
        "height": 1080
      },
      "file_size": 2847392,
      "processing_time": 285
    }
  ],
  "failed": [
    {
      "filename": "corrupt_image.jpg",
      "error": "Invalid image format",
      "processing_stage": "validation"
    }
  ],
  "summary": {
    "total": 2,
    "successful": 1,
    "failed": 1
  }
}
```

---

### **3. Get Media Item Details**

```http
GET /api/model-media-library/{modelSlug}/{mediaId}
```

**Description:** Retrieve detailed information about a specific media item.

**Example Request:**
```http
GET /api/model-media-library/jane-doe/123
```

**Response:**
```json
{
  "success": true,
  "media": {
    "id": 123,
    "model_slug": "jane-doe",
    "filename": "IMG_20250809_headshot_001.jpg",
    "original_filename": "Professional_Headshot_001.jpg",
    "file_url": "/uploads/jane-doe/media/IMG_20250809_headshot_001.jpg",
    "thumbnail_url": "/uploads/jane-doe/media/thumbs/IMG_20250809_headshot_001.jpg",
    "file_size": 2485760,
    "image_width": 1920,
    "image_height": 1080,
    "moderation_status": "approved",
    "moderation_score": 15.2,
    "moderation_notes": "Content approved - professional portrait",
    "category_id": 5,
    "category_name": "Portraits",
    "alt_text": "Professional headshot in studio lighting",
    "caption": "Professional headshot taken in studio with soft lighting",
    "upload_date": "2025-08-09T14:30:00.000Z",
    "last_modified": "2025-08-09T14:35:22.000Z",
    "watermark_applied": true,
    "processing_status": "completed",
    "edit_history": [
      {
        "operation": "crop",
        "timestamp": "2025-08-09T14:32:15.000Z",
        "parameters": {
          "x": 100,
          "y": 50,
          "width": 800,
          "height": 600
        }
      }
    ]
  }
}
```

---

### **4. Delete Media Item**

```http
DELETE /api/model-media-library/{modelSlug}/{mediaId}
```

**Description:** Soft delete a media item (marks as deleted but preserves data for audit).

**Example Request:**
```http
DELETE /api/model-media-library/jane-doe/123
```

**Response:**
```json
{
  "success": true,
  "message": "Media deleted successfully"
}
```

---

## 📂 **Category Management**

### **1. List Categories**

```http
GET /api/model-media-library/{modelSlug}/categories
```

**Description:** Retrieve all active categories for a model with media counts.

**Response:**
```json
{
  "success": true,
  "categories": [
    {
      "id": 5,
      "category_name": "Portraits",
      "category_slug": "portraits",
      "category_description": "Professional portrait photography",
      "category_color": "#007bff",
      "category_order": 1,
      "media_count": 23
    },
    {
      "id": 6,
      "category_name": "Fashion",
      "category_slug": "fashion",
      "category_description": "Fashion and style photography",
      "category_color": "#28a745",
      "category_order": 2,
      "media_count": 45
    }
  ]
}
```

---

### **2. Create Category**

```http
POST /api/model-media-library/{modelSlug}/categories
```

**Description:** Create a new media category for the model.

**Request Body:**
```json
{
  "category_name": "Lifestyle",
  "category_description": "Casual lifestyle photography",
  "category_color": "#ffc107"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Category created successfully",
  "category": {
    "id": 7,
    "category_name": "Lifestyle",
    "category_slug": "lifestyle",
    "category_description": "Casual lifestyle photography",
    "category_color": "#ffc107",
    "category_order": 3
  }
}
```

---

## 🎨 **Image Processing Operations**

### **1. Crop Image**

```http
POST /api/model-media-library/{modelSlug}/{mediaId}/crop
```

**Description:** Crop image to specified dimensions and coordinates.

**Request Body:**
```json
{
  "x": 100,
  "y": 50,
  "width": 800,
  "height": 600,
  "output_format": "jpeg",
  "quality": 95
}
```

**Response:**
```json
{
  "success": true,
  "message": "Image cropped successfully",
  "result": {
    "original_dimensions": { "width": 1920, "height": 1080 },
    "new_dimensions": { "width": 800, "height": 600 },
    "processing_time": 145,
    "file_size_change": -1024000,
    "operation_id": "crop_20250809_143022_001"
  }
}
```

---

### **2. Rotate Image**

```http
POST /api/model-media-library/{modelSlug}/{mediaId}/rotate
```

**Description:** Rotate image by specified angle.

**Request Body:**
```json
{
  "angle": 90,
  "output_format": "jpeg",
  "quality": 95
}
```

**Response:**
```json
{
  "success": true,
  "message": "Image rotated successfully",
  "result": {
    "rotation_applied": 90,
    "new_dimensions": { "width": 1080, "height": 1920 },
    "processing_time": 89,
    "operation_id": "rotate_20250809_143045_001"
  }
}
```

---

### **3. Resize Image**

```http
POST /api/model-media-library/{modelSlug}/{mediaId}/resize
```

**Description:** Resize image to specified dimensions with various fit options.

**Request Body:**
```json
{
  "width": 1200,
  "height": 800,
  "fit": "cover",
  "position": "center",
  "background": { "r": 255, "g": 255, "b": 255 },
  "output_format": "jpeg",
  "quality": 90
}
```

**Fit Options:**
- `cover`: Preserves aspect ratio, may crop
- `contain`: Preserves aspect ratio, no cropping
- `fill`: Stretches to exact dimensions
- `inside`: Resizes to fit inside dimensions
- `outside`: Resizes to fit outside dimensions

**Response:**
```json
{
  "success": true,
  "message": "Image resized successfully",
  "result": {
    "original_dimensions": { "width": 1920, "height": 1080 },
    "new_dimensions": { "width": 1200, "height": 800 },
    "fit_method": "cover",
    "processing_time": 167,
    "operation_id": "resize_20250809_143112_001"
  }
}
```

---

### **4. Apply Filters**

```http
POST /api/model-media-library/{modelSlug}/{mediaId}/filter
```

**Description:** Apply various image filters and adjustments.

**Request Body:**
```json
{
  "brightness": 1.1,
  "contrast": 1.2,
  "saturation": 0.9,
  "blur": 0,
  "sharpen": 1,
  "gamma": 1.0,
  "output_format": "jpeg",
  "quality": 95
}
```

**Filter Parameters:**
- `brightness`: 0.0 to 2.0 (1.0 = no change)
- `contrast`: 0.0 to 2.0 (1.0 = no change)  
- `saturation`: 0.0 to 2.0 (1.0 = no change)
- `blur`: 0 to 100 (0 = no blur)
- `sharpen`: 0 to 10 (0 = no sharpening)
- `gamma`: 0.1 to 3.0 (1.0 = no change)

**Response:**
```json
{
  "success": true,
  "message": "Filters applied successfully",
  "result": {
    "filters_applied": {
      "brightness": 1.1,
      "contrast": 1.2,
      "saturation": 0.9,
      "sharpen": 1
    },
    "processing_time": 234,
    "operation_id": "filter_20250809_143205_001"
  }
}
```

---

### **5. Get Edit History**

```http
GET /api/model-media-library/{modelSlug}/{mediaId}/history
```

**Description:** Retrieve complete edit history for a media item.

**Response:**
```json
{
  "success": true,
  "history": [
    {
      "id": 1,
      "operation": "crop",
      "timestamp": "2025-08-09T14:32:15.000Z",
      "parameters": {
        "x": 100,
        "y": 50,
        "width": 800,
        "height": 600
      },
      "processing_time": 145,
      "admin_user": "admin@musenest.com"
    },
    {
      "id": 2,
      "operation": "filter",
      "timestamp": "2025-08-09T14:35:20.000Z",
      "parameters": {
        "brightness": 1.1,
        "contrast": 1.2
      },
      "processing_time": 89,
      "admin_user": "admin@musenest.com"
    }
  ]
}
```

---

## 🚀 **Advanced Workflow APIs**

### **1. Batch Operations**

```http
POST /api/batch-operations/{modelSlug}/approve
```

**Description:** Batch approve multiple media items.

**Request Body:**
```json
{
  "media_ids": [123, 124, 125, 126],
  "batch_notes": "Portfolio update batch approval"
}
```

---

### **2. Moderation Webhooks**

```http
POST /api/moderation-webhooks/result
```

**Description:** Webhook endpoint for receiving moderation results from external services.

**Request Body:**
```json
{
  "moderation_tracking_id": "mod_20250809_143000_abc123",
  "model_slug": "jane-doe",
  "moderation_status": "approved",
  "moderation_score": 15.2,
  "confidence_score": 0.95,
  "risk_level": "low",
  "human_review_required": false,
  "detected_parts": ["face"],
  "violation_types": [],
  "processing_time": 2500,
  "webhook_signature": "sha256=..."
}
```

---

### **3. Performance Analytics**

```http
GET /api/analytics/{modelSlug}/media-performance
```

**Description:** Get performance analytics for media library operations.

**Response:**
```json
{
  "success": true,
  "analytics": {
    "total_media": 147,
    "upload_success_rate": 0.95,
    "average_processing_time": 245,
    "moderation_approval_rate": 0.92,
    "storage_usage": {
      "total_size_mb": 2847,
      "approved_size_mb": 2456,
      "pending_size_mb": 391
    },
    "category_distribution": {
      "Portraits": 45,
      "Fashion": 38,
      "Lifestyle": 32,
      "Editorial": 32
    }
  }
}
```

---

## ❌ **Error Handling**

### **Error Response Format**

All errors follow a consistent format:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "error": "Technical error details",
  "error_code": "SPECIFIC_ERROR_CODE",
  "timestamp": "2025-08-09T14:30:00.000Z",
  "request_id": "req_20250809_143000_001"
}
```

### **HTTP Status Codes**

| Code | Description | Usage |
|------|-------------|-------|
| **200** | Success | Request completed successfully |
| **201** | Created | Resource created successfully |
| **400** | Bad Request | Invalid request parameters |
| **401** | Unauthorized | Authentication required |
| **403** | Forbidden | Insufficient permissions |
| **404** | Not Found | Resource not found |
| **409** | Conflict | Resource conflict (duplicate) |
| **413** | Payload Too Large | File size exceeds limit |
| **415** | Unsupported Media Type | Invalid file format |
| **422** | Unprocessable Entity | Validation error |
| **429** | Too Many Requests | Rate limit exceeded |
| **500** | Internal Server Error | Server error |
| **503** | Service Unavailable | Service temporarily unavailable |

### **Common Error Codes**

| Error Code | Description | Resolution |
|------------|-------------|------------|
| `MODEL_NOT_FOUND` | Model slug not found | Verify model slug exists |
| `MEDIA_NOT_FOUND` | Media item not found | Verify media ID exists |
| `INVALID_FILE_FORMAT` | Unsupported file type | Use supported image formats |
| `FILE_TOO_LARGE` | File exceeds size limit | Reduce file size to under 50MB |
| `UPLOAD_LIMIT_EXCEEDED` | Too many files in request | Limit to 20 files per request |
| `MODERATION_FAILED` | Moderation service error | Retry request or contact support |
| `PROCESSING_ERROR` | Image processing failed | Check image integrity |
| `CATEGORY_EXISTS` | Category name already exists | Use unique category name |
| `INVALID_PARAMETERS` | Invalid request parameters | Check parameter types and values |
| `RATE_LIMIT_EXCEEDED` | API rate limit reached | Wait and retry request |

---

## 🚦 **Rate Limiting**

### **Rate Limits**

| Endpoint Category | Limit | Window |
|-------------------|-------|--------|
| **Media Upload** | 100 requests | 1 hour |
| **Image Processing** | 500 operations | 1 hour |
| **General API** | 1000 requests | 1 hour |
| **Webhook Endpoints** | 10,000 requests | 1 hour |

### **Rate Limit Headers**

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 847
X-RateLimit-Reset: 1691594400
X-RateLimit-Window: 3600
```

---

## 📊 **Response Formats**

### **Success Response Structure**

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { /* Response data */ },
  "meta": {
    "timestamp": "2025-08-09T14:30:00.000Z",
    "processing_time": 125,
    "request_id": "req_20250809_143000_001"
  }
}
```

### **Pagination Structure**

```json
{
  "pagination": {
    "total": 147,
    "page": 1,
    "pages": 15,
    "limit": 10,
    "hasNext": true,
    "hasPrev": false,
    "nextPage": 2,
    "prevPage": null
  }
}
```

### **File Upload Progress**

For large file uploads, the API supports progress tracking:

```json
{
  "upload_progress": {
    "total_files": 5,
    "processed_files": 3,
    "current_file": "portfolio_image_004.jpg",
    "progress_percent": 60,
    "estimated_completion": "2025-08-09T14:32:30.000Z"
  }
}
```

---

## 🔧 **SDK Examples**

### **JavaScript/Node.js**

```javascript
// Initialize MuseNest Media API client
class MuseNestMediaAPI {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl;
    this.headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  async uploadMedia(modelSlug, files, options = {}) {
    const formData = new FormData();
    
    files.forEach(file => formData.append('files', file));
    Object.keys(options).forEach(key => {
      formData.append(key, options[key]);
    });

    const response = await fetch(
      `${this.baseUrl}/api/model-media-library/${modelSlug}/upload`,
      {
        method: 'POST',
        body: formData,
        headers: { 'Authorization': this.headers.Authorization }
      }
    );

    return await response.json();
  }

  async getMedia(modelSlug, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(
      `${this.baseUrl}/api/model-media-library/${modelSlug}?${queryString}`,
      { headers: this.headers }
    );

    return await response.json();
  }
}

// Usage
const api = new MuseNestMediaAPI('https://api.musenest.com', 'your-api-key');

const uploadResult = await api.uploadMedia('jane-doe', files, {
  apply_watermark: true,
  category_id: 5
});

const mediaList = await api.getMedia('jane-doe', {
  page: 1,
  limit: 12,
  status: 'approved'
});
```

### **Python**

```python
import requests
import json
from typing import List, Dict, Any

class MuseNestMediaAPI:
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
    
    def upload_media(self, model_slug: str, files: List, **options) -> Dict[str, Any]:
        url = f"{self.base_url}/api/model-media-library/{model_slug}/upload"
        
        file_data = [('files', (f.name, f, f.content_type)) for f in files]
        form_data = {**options}
        
        headers = {'Authorization': self.headers['Authorization']}
        
        response = requests.post(url, files=file_data, data=form_data, headers=headers)
        return response.json()
    
    def get_media(self, model_slug: str, **params) -> Dict[str, Any]:
        url = f"{self.base_url}/api/model-media-library/{model_slug}"
        response = requests.get(url, params=params, headers=self.headers)
        return response.json()
    
    def crop_image(self, model_slug: str, media_id: int, crop_params: Dict) -> Dict[str, Any]:
        url = f"{self.base_url}/api/model-media-library/{model_slug}/{media_id}/crop"
        response = requests.post(url, json=crop_params, headers=self.headers)
        return response.json()

# Usage
api = MuseNestMediaAPI('https://api.musenest.com', 'your-api-key')

upload_result = api.upload_media('jane-doe', files, apply_watermark=True, category_id=5)
media_list = api.get_media('jane-doe', page=1, limit=12, status='approved')
```

---

## 🧪 **Testing Guidelines**

### **API Testing Checklist**

1. **Authentication Testing**
   - [ ] Valid session authentication
   - [ ] Invalid/expired session handling
   - [ ] Admin role permission verification

2. **Input Validation Testing**
   - [ ] File format validation
   - [ ] File size limit enforcement
   - [ ] Parameter type validation
   - [ ] SQL injection prevention

3. **Performance Testing**
   - [ ] Large file upload handling
   - [ ] Concurrent request processing
   - [ ] Response time validation
   - [ ] Memory usage monitoring

4. **Error Handling Testing**
   - [ ] Network failure recovery
   - [ ] Service unavailability handling
   - [ ] Invalid data processing
   - [ ] Rate limit enforcement

### **Postman Collection**

A comprehensive Postman collection is available at:
`/docs/postman/MuseNest_Media_API_Collection.json`

---

## 📞 **Support & Contact**

For API support and technical questions:
- **Documentation:** `/docs/API_DOCUMENTATION.md`
- **GitHub Issues:** Create an issue in the repository
- **Email Support:** support@musenest.com

---

*This documentation is generated automatically and updated with each API version release.*