# MuseNest REST API Documentation

## Overview

MuseNest provides comprehensive REST APIs for dynamic content management across model portfolios. All APIs require JWT authentication unless otherwise specified.

## Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

Get a token by authenticating with `/api/auth/login`.

## Gallery Management API

### Base URL: `/api/gallery`

#### Get All Images
```http
GET /api/gallery/images
```
**Response:**
```json
{
  "success": true,
  "images": [
    {
      "id": 1,
      "model_id": 1,
      "section_id": 2,
      "filename": "image-123456789.jpg",
      "caption": "Professional headshot",
      "alt_text": "Professional portrait of model",
      "sort_order": 1,
      "is_featured": 0,
      "section_title": "Professional Photos",
      "created_at": "2025-01-15T10:30:00Z"
    }
  ]
}
```

#### Get Gallery Sections
```http
GET /api/gallery/sections
```
**Response:**
```json
{
  "success": true,
  "sections": [
    {
      "id": 1,
      "model_id": 1,
      "title": "Professional Photos",
      "description": "High-quality professional photography",
      "sort_order": 1,
      "image_count": 5
    }
  ]
}
```

#### Upload Image
```http
POST /api/gallery/upload
Content-Type: multipart/form-data
```
**Body:**
- `image` (file): Image file (max 10MB)
- `caption` (string, optional): Image caption
- `alt_text` (string, optional): Alt text for accessibility
- `section_id` (number, optional): Gallery section ID

**Response:**
```json
{
  "success": true,
  "message": "Image uploaded successfully",
  "image": {
    "id": 15,
    "filename": "image-1642234567890.jpg",
    "caption": "New photo",
    "alt_text": "Description",
    "section_id": 2
  }
}
```

#### Update Image
```http
PUT /api/gallery/images/:id
```
**Body:**
```json
{
  "caption": "Updated caption",
  "alt_text": "Updated alt text",
  "section_id": 2,
  "is_featured": true
}
```

#### Reorder Images
```http
POST /api/gallery/reorder
```
**Body:**
```json
{
  "imageOrders": [
    {"id": 1, "sort_order": 1},
    {"id": 2, "sort_order": 2},
    {"id": 3, "sort_order": 3}
  ]
}
```

#### Delete Image
```http
DELETE /api/gallery/images/:id
```

#### Create Gallery Section
```http
POST /api/gallery/sections
```
**Body:**
```json
{
  "title": "Event Photos",
  "description": "Photos from special events"
}
```

#### Update Gallery Section
```http
PUT /api/gallery/sections/:id
```
**Body:**
```json
{
  "title": "Updated Section Title",
  "description": "Updated description"
}
```

#### Delete Gallery Section
```http
DELETE /api/gallery/sections/:id
```

---

## FAQ Management API

### Base URL: `/api/faq`

#### Get All FAQs
```http
GET /api/faq
```
**Response:**
```json
{
  "success": true,
  "faqs": [
    {
      "id": 1,
      "model_id": 1,
      "question": "What are your rates?",
      "answer": "Please contact me for current rates and availability.",
      "sort_order": 1,
      "is_active": 1,
      "created_at": "2025-01-15T10:30:00Z"
    }
  ]
}
```

#### Get Single FAQ
```http
GET /api/faq/:id
```

#### Create FAQ
```http
POST /api/faq
```
**Body:**
```json
{
  "question": "How do I book an appointment?",
  "answer": "You can book through the contact form or email me directly."
}
```

#### Update FAQ
```http
PUT /api/faq/:id
```
**Body:**
```json
{
  "question": "Updated question?",
  "answer": "Updated answer content.",
  "is_active": true
}
```

#### Reorder FAQs
```http
POST /api/faq/reorder
```
**Body:**
```json
{
  "faqOrders": [
    {"id": 1, "sort_order": 1},
    {"id": 2, "sort_order": 2}
  ]
}
```

#### Toggle FAQ Active Status
```http
PATCH /api/faq/:id/toggle
```

#### Delete FAQ
```http
DELETE /api/faq/:id
```

#### Bulk Operations
```http
POST /api/faq/bulk
```
**Body:**
```json
{
  "action": "activate", // activate, deactivate, delete
  "faqIds": [1, 2, 3]
}
```

---

## Site Settings API

### Base URL: `/api/settings`

#### Get All Settings
```http
GET /api/settings
```
**Response:**
```json
{
  "success": true,
  "settings": {
    "site_name": {
      "value": "My Portfolio",
      "category": "general",
      "updated_at": "2025-01-15T10:30:00Z"
    },
    "theme": {
      "value": "glamour",
      "category": "appearance",
      "updated_at": "2025-01-15T10:30:00Z"
    }
  }
}
```

#### Get Settings by Category
```http
GET /api/settings/category/:category
```

#### Get Single Setting
```http
GET /api/settings/:key
```

#### Update Setting
```http
PUT /api/settings/:key
```
**Body:**
```json
{
  "value": "New Value",
  "category": "general"
}
```

#### Bulk Update Settings
```http
POST /api/settings/bulk
```
**Body:**
```json
{
  "settings": {
    "site_name": {
      "value": "Updated Site Name",
      "category": "general"
    },
    "tagline": {
      "value": "New tagline",
      "category": "general"
    }
  }
}
```

#### Change Theme
```http
POST /api/settings/theme
```
**Body:**
```json
{
  "theme": "glamour" // basic, glamour, luxury, winter, modern, dark
}
```

#### Delete Setting
```http
DELETE /api/settings/:key
```

#### Get Available Categories
```http
GET /api/settings/meta/categories
```

#### Reset Settings
```http
POST /api/settings/reset
```
**Body (optional):**
```json
{
  "category": "appearance" // Reset specific category, or omit to reset all
}
```

---

## Testimonials API

### Base URL: `/api/testimonials`

#### Get All Testimonials
```http
GET /api/testimonials
```
**Response:**
```json
{
  "success": true,
  "testimonials": [
    {
      "id": 1,
      "model_id": 1,
      "testimonial_text": "Amazing experience!",
      "client_name": "John D.",
      "client_initial": "J.D.",
      "rating": 5,
      "location": "New York",
      "sort_order": 1,
      "is_published": 1,
      "is_approved": 1,
      "created_at": "2025-01-15T10:30:00Z"
    }
  ]
}
```

#### Get Public Testimonials (No Auth Required)
```http
GET /api/testimonials/public/:modelSlug
```

#### Get Single Testimonial
```http
GET /api/testimonials/:id
```

#### Create Testimonial
```http
POST /api/testimonials
```
**Body:**
```json
{
  "testimonial_text": "Excellent service and professionalism!",
  "client_name": "Jane Smith",
  "client_initial": "J.S.",
  "rating": 5,
  "location": "Los Angeles",
  "is_published": true,
  "is_approved": true
}
```

#### Update Testimonial
```http
PUT /api/testimonials/:id
```
**Body:**
```json
{
  "testimonial_text": "Updated testimonial text",
  "client_name": "Updated Name",
  "rating": 4,
  "is_published": true
}
```

#### Reorder Testimonials
```http
POST /api/testimonials/reorder
```
**Body:**
```json
{
  "testimonialOrders": [
    {"id": 1, "sort_order": 1},
    {"id": 2, "sort_order": 2}
  ]
}
```

#### Toggle Published Status
```http
PATCH /api/testimonials/:id/publish
```

#### Toggle Approved Status
```http
PATCH /api/testimonials/:id/approve
```

#### Delete Testimonial
```http
DELETE /api/testimonials/:id
```

#### Bulk Operations
```http
POST /api/testimonials/bulk
```
**Body:**
```json
{
  "action": "publish", // publish, unpublish, approve, unapprove, delete
  "testimonialIds": [1, 2, 3]
}
```

---

## Common Response Formats

### Success Response
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {}
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description"
}
```

### Validation Error
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Email is required"
    }
  ]
}
```

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

## Rate Limiting

All APIs are rate-limited to 100 requests per 15-minute window per IP address.

## File Upload Specifications

### Gallery Images
- **Max Size:** 10MB
- **Allowed Types:** JPEG, JPG, PNG, GIF, WebP
- **Thumbnails:** Automatically generated at 300x300px
- **Storage:** Model-specific directories (`/uploads/{model-slug}/`)

## Security Features

- JWT Authentication
- CORS Protection
- Helmet Security Headers
- Rate Limiting
- Input Validation
- SQL Injection Prevention
- File Upload Security

## Example Usage

### JavaScript (Fetch API)
```javascript
// Get JWT token
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});
const { token } = await response.json();

// Use token for authenticated requests
const galleriesResponse = await fetch('/api/gallery/images', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const galleries = await galleriesResponse.json();
```

### cURL Examples
```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"model@example.com","password":"password"}'

# Get FAQs
curl -X GET http://localhost:3000/api/faq \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Create FAQ
curl -X POST http://localhost:3000/api/faq \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question":"How do I book?","answer":"Contact me directly."}'

# Upload Image
curl -X POST http://localhost:3000/api/gallery/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "image=@photo.jpg" \
  -F "caption=Professional photo"
```