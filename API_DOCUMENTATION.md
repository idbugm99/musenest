# MuseNest API Documentation

**Version:** 1.0  
**Date:** August 2, 2025  
**Purpose:** Complete inventory of all REST API endpoints with detailed specifications

---

## 🔌 **API Architecture Overview**

### **Base URL Structure**
- **Admin Routes:** `/api/`
- **Public Routes:** `/` (theme-based routing)
- **Authentication:** JWT-based with middleware protection
- **Response Format:** JSON with consistent `{ success: boolean, data?: any, error?: string }` structure

---

## 🎯 **Core Business Management APIs**

### **Client Management APIs**

#### **GET /api/clients**
- **Purpose:** Retrieve paginated list of all clients with filtering and search
- **Method:** GET
- **Authentication:** Admin access required
- **Auto-Save Trigger:** ❌ (Read operation)
- **Parameters:**
  - `page` (optional): Page number (default: 1)
  - `limit` (optional): Items per page (default: 20)
  - `search` (optional): Search term for email/model name
  - `status` (optional): Filter by user role/status
  - `sort` (optional): Sort field (default: created_at)
- **Response Format:**
```json
{
  "success": true,
  "data": [
    {
      "id": 8,
      "email": "client@example.com",
      "name": "client@example.com",
      "status": "model",
      "created_at": "2025-07-26T15:02:31.000Z",
      "model_id": 5,
      "model_name": "Client Site",
      "model_slug": "clientsite"
    }
  ],
  "clients": [...], // Backward compatibility
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 25,
    "pages": 2
  }
}
```

#### **GET /api/clients/:id**
- **Purpose:** Get detailed information for a specific client
- **Method:** GET
- **Authentication:** Admin access required
- **Auto-Save Trigger:** ❌ (Read operation)
- **Response Format:**
```json
{
  "success": true,
  "data": {
    "id": 8,
    "email": "client@example.com",
    "name": "client@example.com",
    "status": "model",
    "created_at": "2025-07-26T15:02:31.000Z",
    "model_id": 5,
    "model_name": "Client Site",
    "model_slug": "clientsite",
    "subscription_id": 12,
    "subscription_tier": "Premium Plan",
    "subscription_price": "39.95",
    "subscription_status": "active",
    "ai_config": {
      "auto_moderation": true,
      "ai_chat": true,
      "moderation_level": "moderate"
    }
  }
}
```

#### **POST /api/clients**
- **Purpose:** Create new client account with full onboarding setup and referral tracking
- **Method:** POST
- **Authentication:** Admin access required
- **Auto-Save Trigger:** ✅ (Creates new client)
- **Request Body:**
```json
{
  "name": "Client Name",
  "email": "client@example.com",
  "phone": "+1234567890",
  "business_type": "escort",
  "description": "Business description",
  "template_id": 2,
  "subscription_tier_id": 3,
  "client_type": "muse_owned",
  "region_id": 1,
  "sales_channel_id": 30,
  "referral_code": "MAYA2025",
  "ai_config": {
    "auto_moderation": true,
    "ai_chat": true,
    "content_generation": false,
    "smart_scheduling": false,
    "moderation_level": "moderate",
    "ai_personality": "friendly"
  },
  "status": "active",
  "trial_days": 7
}
```
- **Response Format:**
```json
{
  "success": true,
  "message": "Client created successfully",
  "data": {
    "user_id": 15,
    "model_id": 8,
    "account_number": "MO-US-30-240001",
    "subscription_id": 12,
    "temp_password": "abc123xyz",
    "login_url": "/login?email=client%40example.com",
    "site_url": "/clientsite_1722960231",
    "referral_info": {
      "code_used": "MAYA2025",
      "referred_by": "maya@example.com"
    }
  }
}
```

#### **PUT /api/clients/:id**
- **Purpose:** Update client information and settings
- **Method:** PUT
- **Authentication:** Admin access required
- **Auto-Save Trigger:** ✅ (Updates client data)
- **Request Body (partial updates supported):**
```json
{
  "name": "Updated Name",
  "email": "newemail@example.com",
  "phone": "+1987654321",
  "status": "active",
  "business_type": "camgirl",
  "site_name": "New Site Name",
  "tagline": "New tagline"
}
```
- **Response Format:**
```json
{
  "success": true,
  "message": "Client updated successfully"
}
```

#### **GET /api/clients/templates**
- **Purpose:** Get available templates for client onboarding
- **Method:** GET
- **Authentication:** Admin access required
- **Auto-Save Trigger:** ❌ (Read operation)
- **Response Format:**
```json
{
  "success": true,
  "templates": [
    {
      "id": 2,
      "name": "Glamour Elite",
      "description": "Sophisticated design with elegant animations",
      "preview_image": "/assets/theme-previews/glamour.jpg",
      "style": "luxury",
      "category": "luxury",
      "business_type": null
    }
  ]
}
```

### **Subscription Management APIs** (Enhanced)

### **Client Management** (`/routes/api/system-management.js`)

#### **Get System Statistics**
- **Endpoint:** `GET /api/system-management/stats`
- **Purpose:** Dashboard KPIs and system overview
- **Authentication:** Required
- **Auto-Save:** N/A (read-only)

#### **List All Clients**
- **Endpoint:** `GET /api/system-management/clients`
- **Purpose:** Paginated client list with filtering
- **Query Parameters:** `page`, `limit`, `status`, `search`
- **Auto-Save:** N/A (read-only)

#### **Update Client Details**
- **Endpoint:** `PUT /api/system-management/clients/:id`
- **Purpose:** Modify client account information
- **Auto-Save:** ✅ **Triggers on field blur**

---

## 🤖 **AI Configuration Management** (`/routes/api/site-configuration.js`)

#### **List All Sites**
- **Endpoint:** `GET /api/site-configuration/sites`
- **Purpose:** Multi-tenant site management overview
- **Auto-Save:** N/A (read-only)

#### **Update Site Configuration**
- **Endpoint:** `PUT /api/site-configuration/sites/:id/config`
- **Purpose:** Modify AI detection settings
- **Auto-Save:** ✅ **Triggers on slider/input change**

#### **Deploy Configuration**
- **Endpoints:** 
  - `POST /api/site-configuration/sites/:id/deploy` (standard)
  - `POST /api/site-configuration/sites/:id/deploy-resilient` (with retry)
  - `POST /api/site-configuration/sites/:id/deploy-with-validation` (tier-gated)
- **Purpose:** Deploy AI configuration to live servers
- **Auto-Save:** N/A (explicit deployment action)

#### **Server Health Check**
- **Endpoint:** `GET /api/site-configuration/servers/health`
- **Purpose:** Real-time AI server status monitoring
- **Auto-Refresh:** ✅ **Updates every 30 seconds**

---

## 💳 **Subscription Management** (`/routes/api/site-configuration.js`)

#### **Get All Tiers**
- **Endpoint:** `GET /api/site-configuration/subscription/tiers`
- **Purpose:** Available subscription packages
- **Auto-Save:** N/A (read-only)

#### **Create/Update Tier**
- **Endpoint:** `POST /api/site-configuration/subscription/tiers`
- **Purpose:** Tier management (create new or update existing)
- **Auto-Save:** ✅ **Triggers on form field changes**

#### **Get Subscription Analytics**
- **Endpoint:** `GET /api/site-configuration/subscription/analytics`
- **Purpose:** Business intelligence and revenue metrics
- **Auto-Refresh:** ✅ **Updates every 5 minutes**

---

## 🔄 **Auto-Save Implementation Pattern**

```javascript
// Generic auto-save function for all forms
async function autoSave(endpoint, data, fieldName) {
    try {
        const response = await fetch(endpoint, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            showSaveIndicator('success', fieldName);
        } else {
            showSaveIndicator('error', fieldName);
        }
    } catch (error) {
        showSaveIndicator('error', fieldName, error.message);
    }
}

// Attach to form fields
document.querySelectorAll('.auto-save').forEach(field => {
    field.addEventListener('blur', (e) => {
        const data = { [e.target.name]: e.target.value };
        autoSave(`/api/resource/${resourceId}`, data, e.target.name);
    });
});
```

---

## 🎫 **Referral System APIs**

### **Referral Code Management**

#### **POST /api/clients/:id/referral-codes**
- **Purpose:** Create new referral code for existing client
- **Method:** POST
- **Authentication:** Admin access required
- **Auto-Save Trigger:** ✅ (Creates referral code)
- **Request Body:**
```json
{
  "code_name": "Maya VIP Code",
  "usage_limit": 10,
  "expires_at": "2025-12-31T23:59:59.000Z",
  "custom_code": "MAYA2025"
}
```
- **Response Format:**
```json
{
  "success": true,
  "message": "Referral code created successfully",
  "data": {
    "id": 1,
    "code": "MAYA2025",
    "code_name": "Maya VIP Code",
    "usage_limit": 10,
    "usage_count": 0,
    "expires_at": "2025-12-31T23:59:59.000Z",
    "is_active": true,
    "created_at": "2025-08-04T12:00:00.000Z"
  }
}
```

#### **GET /api/clients/:id/referral-codes**
- **Purpose:** Retrieve all referral codes owned by client
- **Method:** GET
- **Authentication:** Admin access required
- **Auto-Save Trigger:** ❌ (Read operation)
- **Response Format:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "MAYA2025",
      "code_name": "Maya VIP Code",
      "usage_limit": 10,
      "usage_count": 3,
      "actual_usage_count": 3,
      "eligible_referrals": 3,
      "total_commission_earned": "29.97",
      "expires_at": null,
      "is_active": true,
      "created_at": "2025-08-04T12:00:00.000Z"
    }
  ]
}
```

#### **GET /api/referral-codes/validate/:code**
- **Purpose:** Validate referral code and get details (public endpoint)
- **Method:** GET
- **Authentication:** Not required
- **Auto-Save Trigger:** ❌ (Read operation)
- **Response Format:**
```json
{
  "valid": true,
  "data": {
    "code": "MAYA2025",
    "code_name": "Maya VIP Code",
    "referrer_email": "maya@example.com",
    "referrer_name": "Maya",
    "usage_count": 3,
    "usage_limit": 10,
    "expires_at": null
  }
}
```

### **Referral Analytics**

#### **GET /api/clients/:id/referral-analytics**
- **Purpose:** Comprehensive referral performance data and commission tracking
- **Method:** GET
- **Authentication:** Admin access required
- **Auto-Save Trigger:** ❌ (Read operation)
- **Response Format:**
```json
{
  "success": true,
  "data": {
    "codes": [
      {
        "id": 1,
        "code": "MAYA2025",
        "code_name": "Maya VIP Code",
        "total_signups": 3,
        "signups_last_30_days": 2,
        "signups_last_7_days": 1,
        "total_commission_earned": "29.97",
        "commission_paid": "0.00"
      }
    ],
    "recent_referrals": [
      {
        "used_at": "2025-08-04T15:30:00.000Z",
        "referred_user_email": "newuser@example.com",
        "referral_code_used": "MAYA2025",
        "commission_amount": "9.99",
        "commission_eligible": true
      }
    ],
    "summary": {
      "total_codes": 2,
      "active_codes": 2,
      "total_referrals": 7,
      "total_commission_earned": 69.93,
      "commission_pending": 69.93
    }
  }
}
```

#### **POST /api/clients/:id/referral-codes/suggestions**
- **Purpose:** Generate AI-powered referral code suggestions
- **Method:** POST
- **Authentication:** Admin access required
- **Auto-Save Trigger:** ❌ (Suggestion generation)
- **Response Format:**
```json
{
  "success": true,
  "suggestions": [
    "MAYA2025",
    "MAYAVIP",
    "MAYA25",
    "MUSE2025",
    "REF8H92N"
  ]
}
```

---

**Last Updated:** August 4, 2025  
**Total Endpoints:** 80+ documented API endpoints  
**Status:** Ready for Business Manager CRM integration with full referral system support