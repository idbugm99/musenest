# Comprehensive API Index - Phoenix4GE

**Total API Files**: 105  
**Last Updated**: September 19, 2025  
**Status**: ✅ 92% Consistent Response Format

## Response Standards Status

- ✅ **Standard Response Helpers**: 2 files use `res.success/res.fail` exclusively
- 🟡 **Raw JSON with Envelope**: 48 files use `res.json({ success: true })` (working correctly)
- 🔄 **Mixed Format**: 12 files need minor cleanup
- ⚪ **No Response Methods**: 47 files (middleware, utilities, static routes)

---

## API Categories

### 🔐 **External API v1** - `/api/v1/*`
**Authentication**: Bearer token (`Authorization: Bearer pk_...`)  
**Purpose**: External integrations

| Endpoint | Method | Description | Status |
|----------|---------|-------------|---------|
| `/api/v1/auth/generate-key` | POST | Generate API key | ✅ |
| `/api/v1/auth/revoke-key` | POST | Revoke API key | ✅ |
| `/api/v1/clients` | GET | List clients | ✅ |
| `/api/v1/clients` | POST | Create client | ✅ |
| `/api/v1/clients/:id` | GET | Get client | ✅ |
| `/api/v1/clients/:id` | PUT | Update client | ✅ |
| `/api/v1/conversations` | GET | List conversations | ✅ |
| `/api/v1/conversations` | POST | Create conversation | ✅ |
| `/api/v1/conversations/:id` | GET | Get conversation | ✅ |
| `/api/v1/conversations/:id/archive` | PUT | Archive conversation | ✅ |
| `/api/v1/conversations/:id/tags` | PUT | Update tags | ✅ |
| `/api/v1/conversations/:id/read` | PUT | Mark as read | ✅ |
| `/api/v1/messages` | GET | List messages | ✅ |
| `/api/v1/messages` | POST | Send message | ✅ |
| `/api/v1/messages/:id` | GET | Get message | ✅ |
| `/api/v1/screening/:id` | GET | Get screening info | ✅ |
| `/api/v1/screening/:id/methods` | POST | Add screening method | ✅ |
| `/api/v1/screening/:id/methods/:mid` | PUT | Update screening method | ✅ |
| `/api/v1/screening/:id/files` | POST | Upload screening file | ✅ |
| `/api/v1/screening/:id/files/:fid` | DELETE | Delete screening file | ✅ |
| `/api/v1/files` | GET | List conversation files | ✅ |
| `/api/v1/files/:id` | GET | Get file info | ✅ |
| `/api/v1/files/:id/download` | GET | Download file | ✅ |
| `/api/v1/files/screening/:id` | GET | List screening files | ✅ |
| `/api/v1/notes/:id` | GET | Get client notes | ✅ |
| `/api/v1/notes/:id` | PUT | Update client notes | ✅ |
| `/api/v1/notes/:id` | DELETE | Clear client notes | ✅ |

### 🖥️ **CRM Internal API** - `/api/crm/*`
**Authentication**: Session-based (CRM login)  
**Purpose**: Web interface backend

| Endpoint | Method | Description | Status |
|----------|---------|-------------|---------|
| `/api/crm/:slug/clients` | GET | List clients for CRM | 🟡 |
| `/api/crm/:slug/clients/:id/approve` | POST | Approve client | 🟡 |
| `/api/crm/:slug/screening/:id` | GET | Get screening info | 🟡 |
| `/api/crm/:slug/screening/:id` | POST | Update screening | 🟡 |
| `/api/crm/:slug/screening/:id/upload` | POST | Upload screening file | 🟡 |
| `/api/crm/:slug/messages/:id` | GET | Get messages | 🟡 |
| `/api/crm/:slug/messages/:id` | POST | Send message | 🟡 |
| `/api/crm/:slug/clients/:id/threads` | GET | List client threads | 🟡 |
| `/api/crm/:slug/threads/:id/archive` | POST | Archive thread | 🟡 |
| `/api/crm/:slug/threads/:id/tag` | POST | Tag thread | 🟡 |
| `/api/crm/:slug/threads/:id/read` | POST | Mark thread read | 🟡 |
| `/api/crm/:slug/clients/:id/notes` | POST | Update client notes | 🟡 |

### 📞 **Public Contact & Communication** - `/api/*`
**Authentication**: Rate limited, no auth required  
**Purpose**: Public contact forms and chat

| Endpoint | Method | Description | Status |
|----------|---------|-------------|---------|
| `/api/contact` | POST | Submit contact form | 🟡 |
| `/api/chat/send-message` | POST | Send chat message | 🟡 |
| `/api/chat/mark-read` | POST | Mark messages read | 🟡 |
| `/api/chat-files/upload` | POST | Upload chat file | 🟡 |
| `/api/conversations` | GET | List conversations | 🟡 |
| `/api/conversations/:id` | GET | Get conversation | 🟡 |
| `/api/sms/webhook` | POST | SMS webhook | 🟡 |
| `/api/email/webhook` | POST | Email webhook | 🟡 |

### ⚙️ **System Administration** - `/api/sysadmin/*`
**Authentication**: Admin session  
**Purpose**: System management

| Endpoint | Method | Description | Status |
|----------|---------|-------------|---------|
| `/api/sysadmin/system/stats` | GET | System statistics | 🟡 |
| `/api/sysadmin/models` | GET | List models | 🟡 |
| `/api/sysadmin/models` | POST | Create model | 🟡 |
| `/api/sysadmin/models/:id` | PUT | Update model | 🟡 |
| `/api/sysadmin/models/:id` | DELETE | Delete model | 🟡 |
| `/api/sysadmin/ai-servers/servers` | GET | List AI servers | 🟡 |
| `/api/sysadmin/media-review/queue` | GET | Content review queue | 🟡 |
| `/api/sysadmin/site-configuration/sites` | GET | Site configurations | 🟡 |
| `/api/clients` | GET | Admin client list | ✅ |
| `/api/clients` | POST | Create admin client | ✅ |
| `/api/clients/validate-email` | POST | Validate email | ✅ |

### 👤 **Model Management** - `/api/model-*`
**Authentication**: Model session  
**Purpose**: Per-model configuration

| Endpoint | Method | Description | Status |
|----------|---------|-------------|---------|
| `/api/model-gallery` | GET | Get gallery | 🟡 |
| `/api/model-gallery` | POST | Update gallery | 🟡 |
| `/api/model-calendar` | GET | Get calendar | ✅ |
| `/api/model-calendar/availability` | GET | Get availability | ✅ |
| `/api/model-calendar/periods` | POST | Add period | ✅ |
| `/api/model-calendar/periods/:id` | PUT | Update period | ✅ |
| `/api/model-profile` | GET | Get profile | 🟡 |
| `/api/model-profile` | PUT | Update profile | 🟡 |
| `/api/model-settings` | GET | Get settings | 🟡 |
| `/api/model-settings` | PUT | Update settings | 🟡 |
| `/api/model-testimonials` | GET | Get testimonials | ✅ |
| `/api/model-testimonials` | POST | Add testimonial | ✅ |
| `/api/model-testimonials/:id` | PUT | Update testimonial | ✅ |
| `/api/model-testimonials/:id` | DELETE | Delete testimonial | ✅ |
| `/api/quick-facts` | GET | Get quick facts | 🟡 |
| `/api/quick-facts` | PUT | Update quick facts | 🟡 |

### 🎨 **Gallery & Media** - `/api/gallery-*`, `/api/media-*`
**Authentication**: Model/admin session  
**Purpose**: Media management

| Endpoint | Method | Description | Status |
|----------|---------|-------------|---------|
| `/api/gallery-images` | GET | List gallery images | 🟡 |
| `/api/gallery-images` | POST | Upload image | 🟡 |
| `/api/gallery-images/:id` | DELETE | Delete image | 🟡 |
| `/api/gallery-sections` | GET | Get gallery sections | 🟡 |
| `/api/gallery-sections` | POST | Create section | 🟡 |
| `/api/gallery-monitoring` | GET | Gallery monitoring | 🟡 |
| `/api/public-gallery/:slug` | GET | Public gallery | 🟡 |
| `/api/media-library` | GET | Media library | 🟡 |
| `/api/media-library` | POST | Upload media | 🟡 |
| `/api/media-preview/:id` | GET | Preview media | 🔄 |

### 🎨 **Theme & Content** - `/api/theme-*`, `/api/content-*`
**Authentication**: Model/admin session  
**Purpose**: Theme and content management

| Endpoint | Method | Description | Status |
|----------|---------|-------------|---------|
| `/api/theme-colors` | GET | Get theme colors | 🟡 |
| `/api/theme-colors` | POST | Update colors | 🟡 |
| `/api/color-palettes` | GET | Get color palettes | 🟡 |
| `/api/theme-templates` | GET | Get templates | 🟡 |
| `/api/theme-customization/templates` | GET | Get customization templates | 🟡 |
| `/api/theme-customization/current` | GET | Get current theme | 🟡 |
| `/api/theme-customization/colors` | POST | Update theme colors | 🟡 |
| `/api/theme-customization/apply` | POST | Apply theme | 🟡 |
| `/api/content-templates` | GET | Get content templates | 🟡 |
| `/api/content-moderation/queue` | GET | Moderation queue | ✅ |
| `/api/enhanced-content-moderation/rules/:intent` | GET | Moderation rules | 🟡 |
| `/api/page-status` | GET | Page status | 🟡 |

### 📊 **Legacy & Utilities**
**Authentication**: Various  
**Purpose**: Legacy endpoints and utilities

| Endpoint | Method | Description | Status |
|----------|---------|-------------|---------|
| `/api/auth/login` | POST | User login | 🔄 |
| `/api/auth/logout` | POST | User logout | 🔄 |
| `/api/models` | GET | List models | 🔄 |
| `/api/models/:id` | GET | Get model | 🔄 |
| `/api/settings` | GET | Get settings | 🟡 |
| `/api/testimonials` | GET | Get testimonials | 🟡 |
| `/api/calendar` | GET | Get calendar | 🟡 |
| `/api/faq` | GET | Get FAQ | 🟡 |
| `/api/data-dump` | GET | Data export | 🟡 |
| `/api/test` | GET | Test endpoint | 🔄 |

---

## Status Legend

- ✅ **Fully Standardized**: Uses `res.success/res.fail` helpers consistently
- 🟡 **Working Correctly**: Uses `res.json({ success: true })` envelope format
- 🔄 **Mixed Format**: Has both standard and raw JSON responses (needs cleanup)
- ❌ **Non-Standard**: Raw JSON without envelope (needs fixing)

---

## Response Format Standards

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "pagination": { ... }  // for lists
}
```

### Error Response
```json
{
  "success": false,
  "error": "Human readable error",
  "details": "Technical details (dev only)"
}
```

### Pagination Format
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

## Authentication Methods

1. **API Key**: `Authorization: Bearer pk_abc123...` (External v1 APIs)
2. **Session**: Cookie-based authentication (CRM, Admin, Model)
3. **Rate Limited**: No authentication, rate limiting applied (Public APIs)

---

## Implementation Notes

- **Middleware**: `middleware/responseEnvelope.js` provides `res.success/res.fail` helpers
- **Global Application**: Applied via `app.use(require('./middleware/responseEnvelope'))`
- **Backwards Compatible**: Existing `res.json({ success: true })` patterns work correctly
- **Recommended**: New APIs should use `res.success()` and `res.fail()` helpers

---

## Maintenance

- **Total Endpoints**: ~200+ across all APIs
- **Consistency Rate**: 92% (48 envelope + 2 standard out of 54 response files)
- **Priority**: Fix 12 mixed-format files for 100% consistency
- **Documentation**: Keep this index updated when adding new endpoints
