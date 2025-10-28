# API Organization Structure

## Current API Structure

### **Core Standards**
- **Response Format**: All APIs use `res.success(data, extra)` and `res.fail(statusCode, error, details)`
- **Pagination**: `{ page, limit, total, pages }` format
- **Authentication**: Bearer tokens for external APIs, session-based for CRM UI

---

## **API Namespaces**

### **1. External API (v1) - `/api/v1/`**
**Purpose**: External integrations with API key authentication  
**Authentication**: Bearer token (`Authorization: Bearer pk_...`)

```
/api/v1/auth/          - API key management
/api/v1/clients/       - Client CRUD operations  
/api/v1/conversations/ - Thread management
/api/v1/messages/      - Message sending/receiving
/api/v1/screening/     - Client validation workflows
/api/v1/files/         - Attachment management
/api/v1/notes/         - Per-client notes
```

### **2. CRM Internal API - `/api/crm/`**
**Purpose**: Web UI backend for CRM interface  
**Authentication**: Session-based (CRM login)

```
/api/crm/:slug/clients/           - Client list/management
/api/crm/:slug/screening/         - Screening workflows
/api/crm/:slug/messages/          - CRM messaging
/api/crm/:slug/threads/           - Thread operations
/api/crm/:slug/clients/:id/notes  - Client notes
```

### **3. Contact & Communication - `/api/`**
**Purpose**: Public contact forms and chat  
**Authentication**: Rate-limited, no auth required

```
/api/contact/     - Contact form submissions
/api/chat/        - Public chat interface
/api/chat-files/  - Chat file uploads
/api/sms/         - SMS webhooks
/api/email/       - Email processing
/api/conversations/ - Conversation management
```

### **4. Admin System - `/api/sysadmin/`**
**Purpose**: System administration  
**Authentication**: Admin session

```
/api/sysadmin/system/       - System stats
/api/sysadmin/models/       - Model management
/api/sysadmin/ai-servers/   - AI server management
/api/sysadmin/media-review/ - Content moderation
```

### **5. Model Management - `/api/model-*/`**
**Purpose**: Per-model configuration and content  
**Authentication**: Model session

```
/api/model-gallery/      - Gallery management
/api/model-calendar/     - Availability management
/api/model-profile/      - Profile settings
/api/model-settings/     - Model configuration
/api/model-testimonials/ - Review management
/api/model-rates/        - Pricing management
```

### **6. Content & Media - `/api/`**
**Purpose**: Content management and media processing

```
/api/gallery-*/           - Gallery operations
/api/media-library/       - Media management
/api/content-moderation/  - Content review
/api/theme-*/            - Theme management
```

---

## **Response Standards**

### **Success Response**
```json
{
  "success": true,
  "data": { ... },
  "pagination": { ... }  // for lists
}
```

### **Error Response**
```json
{
  "success": false,
  "error": "Human readable error",
  "details": "Technical details (dev only)"
}
```

### **Pagination Format**
```json
{
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "pages": 3
  }
}
```

---

## **File Organization**

```
routes/api/
├── v1/                    # External API (versioned)
│   ├── auth.js           # API key management
│   ├── clients.js        # Client operations
│   ├── conversations.js  # Thread management
│   ├── messages.js       # Message operations
│   ├── screening.js      # Client validation
│   ├── files.js          # File operations
│   └── notes.js          # Client notes
├── crm/                  # CRM web interface APIs
│   ├── clients.js        # Client management
│   ├── screening.js      # Screening workflows
│   ├── messages.js       # CRM messaging
│   ├── threads.js        # Thread operations
│   └── clients-notes.js  # Client notes
├── contact.js            # Public contact forms
├── chat.js               # Public chat
├── chat-files.js         # Chat attachments
├── conversations.js      # Conversation management
├── sms.js                # SMS webhooks
├── email.js              # Email processing
├── admin-system.js       # System admin (/api/sysadmin)
├── admin-clients.js      # Client admin
├── model-*/              # Model-specific APIs
├── gallery-*/            # Gallery management
├── theme-*/              # Theme management
└── content-*/            # Content management
```

---

## **Authentication Patterns**

### **1. API Key (External v1)**
```javascript
const { requireApiAuth } = require('../../../middleware/apiAuth');
router.use(requireApiAuth);
// req.apiAuth = { modelId, modelSlug }
```

### **2. CRM Session (Internal)**
```javascript
const { requireCRMAuth } = require('../../middleware/crmAuth');
router.use(requireCRMAuth);
// req.session.crm = { modelId, modelSlug }
```

### **3. Rate Limited (Public)**
```javascript
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({ ... });
router.use(limiter);
```

---

## **Migration Status**

✅ **Completed**
- v1 APIs standardized with `res.success/res.fail`
- CRM APIs using standard response format
- API key authentication system
- Comprehensive documentation

🔄 **In Progress**
- Server.js route organization
- Legacy API cleanup

📋 **Pending**
- API versioning strategy for breaking changes
- Rate limiting implementation across all APIs
- API metrics and monitoring
