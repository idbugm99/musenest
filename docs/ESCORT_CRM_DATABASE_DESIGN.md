# Escort CRM Database Design

## Overview
Comprehensive client management system for escorts with optional encryption, screening validation, visit tracking, and financial forecasting capabilities.

**Access URL**: `{slug}/crm` (e.g., `modelexample/crm`)
**Authentication**: Separate from admin system, uses same password but dedicated CRM interface
**Purpose**: Dedicated, focused CRM interface to keep admin panel lean and organized

## 🔐 **Access & Authentication**

### **URL Structure**
- **CRM Access**: `/{model_slug}/crm`
- **Admin Access**: `/{model_slug}/admin`
- **Separation**: CRM and Admin are completely separate interfaces

### **Authentication Strategy**
- **Same Password**: Uses the model's admin password for simplicity
- **Separate Sessions**: CRM sessions are independent from admin sessions
- **Dedicated Interface**: CRM has its own login, dashboard, and navigation
- **File Organization**: CRM functionality is in separate files to keep admin lean

### **Benefits of Separation**
1. **Admin Panel**: Remains focused on site management, themes, galleries
2. **CRM Interface**: Dedicated to client management, financial tracking
3. **Maintainability**: Smaller, focused files are easier to maintain
4. **User Experience**: Models can access CRM without navigating admin complexity
5. **Security**: Separate session management for different access levels

## Core Tables

### 1. Client Management
```sql
-- Main client table (encryptable)
CREATE TABLE escort_clients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_id INT NOT NULL,
    client_identifier VARCHAR(255) NOT NULL COMMENT 'Encrypted: name, alias, etc.',
    phone_hash VARCHAR(64) COMMENT 'Hashed phone for matching (not encrypted)',
    email_hash VARCHAR(64) COMMENT 'Hashed email for matching (not encrypted)',
    phone_encrypted TEXT COMMENT 'Encrypted phone number',
    email_encrypted TEXT COMMENT 'Encrypted email address',
    screening_status ENUM('pending', 'approved', 'rejected', 'pending_references') DEFAULT 'pending',
    screening_method ENUM('none', 'references', 'job_validation', 'reference_sites', 'other') DEFAULT 'none',
    reference_sites JSON COMMENT 'Sites like P411, TheOtherBoard, etc.',
    communication_preference ENUM('contact_ok', 'no_contact', 'area_notifications_only') DEFAULT 'contact_ok',
    area_notifications BOOLEAN DEFAULT FALSE,
    notes_encrypted TEXT COMMENT 'Encrypted general notes',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_model_phone (model_id, phone_hash),
    INDEX idx_model_email (model_id, email_hash),
    INDEX idx_screening_status (model_id, screening_status),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2. Client Screening & References
```sql
-- Screening details (encryptable)
CREATE TABLE client_screening (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    screening_type ENUM('references', 'job_validation', 'reference_sites', 'other') NOT NULL,
    details_encrypted TEXT COMMENT 'Encrypted screening details',
    verification_status ENUM('pending', 'verified', 'failed', 'expired') DEFAULT 'pending',
    verified_at TIMESTAMP NULL,
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (client_id) REFERENCES escort_clients(id) ON DELETE CASCADE
);

-- Reference contacts (for screening)
CREATE TABLE client_references (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    reference_name_encrypted VARCHAR(255) COMMENT 'Encrypted reference name',
    reference_contact_encrypted TEXT COMMENT 'Encrypted contact info',
    reference_relationship VARCHAR(100) COMMENT 'How they know the client',
    reference_notes_encrypted TEXT COMMENT 'Encrypted reference notes',
    reference_status ENUM('pending', 'positive', 'negative', 'neutral') DEFAULT 'pending',
    contacted_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (client_id) REFERENCES escort_clients(id) ON DELETE CASCADE
);
```

### 3. Visit Tracking
```sql
-- Visit records (encryptable)
CREATE TABLE client_visits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    visit_date DATE NOT NULL,
    visit_duration INT COMMENT 'Minutes',
    visit_type ENUM('incall', 'outcall', 'overnight', 'travel') DEFAULT 'incall',
    location_encrypted VARCHAR(255) COMMENT 'Encrypted location',
    rate_amount DECIMAL(10,2) COMMENT 'Amount charged',
    rate_type ENUM('hourly', 'fixed', 'overnight', 'travel') DEFAULT 'hourly',
    payment_method ENUM('cash', 'card', 'crypto', 'other') DEFAULT 'cash',
    payment_status ENUM('paid', 'pending', 'partial', 'cancelled') DEFAULT 'paid',
    
    -- Visit details (encrypted)
    notes_encrypted TEXT COMMENT 'Encrypted visit notes',
    preferences_encrypted TEXT COMMENT 'Encrypted client preferences',
    body_characteristics_encrypted TEXT COMMENT 'Encrypted physical notes',
    would_see_again BOOLEAN DEFAULT TRUE,
    client_rating INT CHECK (client_rating >= 1 AND client_rating <= 5),
    
    -- Financial tracking (not encrypted for forecasting)
    actual_amount_received DECIMAL(10,2),
    expenses DECIMAL(10,2),
    net_revenue DECIMAL(10,2),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_client_date (client_id, visit_date),
    INDEX idx_visit_date (visit_date),
    INDEX idx_revenue (visit_date, net_revenue),
    FOREIGN KEY (client_id) REFERENCES escort_clients(id) ON DELETE CASCADE
);
```

### 4. Financial Tracking
```sql
-- Revenue summaries (not encrypted for forecasting)
CREATE TABLE client_revenue_summary (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    total_visits INT DEFAULT 0,
    total_revenue DECIMAL(12,2) DEFAULT 0.00,
    average_rate DECIMAL(10,2) DEFAULT 0.00,
    last_visit_date DATE NULL,
    first_visit_date DATE NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (client_id) REFERENCES escort_clients(id) ON DELETE CASCADE
);

-- Monthly revenue tracking
CREATE TABLE monthly_revenue (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_id INT NOT NULL,
    year_month VARCHAR(7) NOT NULL COMMENT 'Format: YYYY-MM',
    total_revenue DECIMAL(12,2) DEFAULT 0.00,
    total_visits INT DEFAULT 0,
    unique_clients INT DEFAULT 0,
    average_rate DECIMAL(10,2) DEFAULT 0.00,
    
    INDEX idx_model_month (model_id, year_month),
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
);
```

### 5. Encryption Management
```sql
-- Model encryption settings
CREATE TABLE model_encryption_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_id INT NOT NULL UNIQUE,
    encryption_enabled BOOLEAN DEFAULT FALSE,
    encryption_key_hash VARCHAR(255) COMMENT 'Hashed encryption key',
    encryption_salt VARCHAR(255) COMMENT 'Salt for key derivation',
    encryption_algorithm VARCHAR(50) DEFAULT 'AES-256-GCM',
    last_key_entered TIMESTAMP NULL,
    session_expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
);

-- Encryption audit log
CREATE TABLE encryption_audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_id INT NOT NULL,
    action ENUM('enable', 'disable', 'key_change', 'session_start', 'session_expire') NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
);
```

### 6. Communication & Notifications
```sql
-- Area notification preferences
CREATE TABLE area_notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    area_name VARCHAR(255) NOT NULL,
    notification_type ENUM('email', 'sms', 'both') DEFAULT 'email',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (client_id) REFERENCES escort_clients(id) ON DELETE CASCADE
);

-- Communication history (encrypted)
CREATE TABLE communication_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    communication_type ENUM('email', 'sms', 'call', 'text_app') NOT NULL,
    direction ENUM('inbound', 'outbound') NOT NULL,
    subject_encrypted VARCHAR(255) COMMENT 'Encrypted subject/topic',
    content_encrypted TEXT COMMENT 'Encrypted message content',
    communication_date TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (client_id) REFERENCES escort_clients(id) ON DELETE CASCADE
);
```

## 🚀 **Implementation Structure**

### **File Organization**
```
musenest/
├── routes/
│   ├── crm.js                    # CRM-specific routes
│   └── api/
│       └── crm/                  # CRM API endpoints
│           ├── clients.js
│           ├── visits.js
│           ├── screening.js
│           └── financial.js
├── themes/
│   └── crm/                      # Dedicated CRM theme
│       ├── layouts/
│       │   └── main.handlebars
│       ├── pages/
│       │   ├── dashboard.handlebars
│       │   ├── clients.handlebars
│       │   ├── visits.handlebars
│       │   └── financial.handlebars
│       └── partials/
│           ├── navigation.handlebars
│           └── client-card.handlebars
├── middleware/
│   └── crm-auth.js              # CRM authentication middleware
└── public/
    └── crm/                      # CRM-specific assets
        ├── css/
        ├── js/
        └── images/
```

### **Route Structure**
```javascript
// CRM Routes
app.use('/:slug/crm', require('./routes/crm'));

// CRM API Routes
app.use('/api/crm/:slug', require('./routes/api/crm'));

// Admin Routes (separate)
app.use('/:slug/admin', require('./routes/admin'));
```

### **Authentication Flow**
1. **CRM Access**: `/{slug}/crm` → CRM login page
2. **Password Verification**: Uses model's admin password
3. **CRM Session**: Creates separate CRM session
4. **Access Control**: CRM middleware validates CRM sessions
5. **Admin Independence**: Admin sessions remain separate

## 🔐 **Encryption Strategy**

### **What Gets Encrypted:**
- Client names, aliases, personal details
- Phone numbers, email addresses
- Visit notes, preferences, body characteristics
- Reference details
- Communication content

### **What Stays Unencrypted (for functionality):**
- Phone/email hashes (for matching)
- Visit dates, amounts, durations
- Screening status, communication preferences
- Revenue data (for forecasting)
- Area notification preferences

### **Encryption Implementation:**
```javascript
// Example encryption flow
const encryptData = (data, key, salt) => {
    const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha256');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-gcm', derivedKey);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
        encrypted,
        iv: iv.toString('hex'),
        tag: cipher.getAuthTag().toString('hex')
    };
};
```

## 📊 **Forecasting & Analytics**

### **Revenue Forecasting:**
- Monthly trends and seasonality
- Client lifetime value analysis
- Rate optimization recommendations
- Travel planning insights

### **Client Analytics:**
- Screening success rates
- Repeat client patterns
- Geographic distribution
- Service preference trends

## 🚨 **Privacy & Security Features**

### **Data Protection:**
- Optional encryption with user-controlled keys
- Session-based encryption (key expires)
- Reversible encryption (can be disabled)
- Audit logging for encryption changes

### **Access Control:**
- Model-specific data isolation
- IP-based session tracking
- Automatic session expiration
- Encryption key verification

## 🔄 **Data Management**

### **Export/Import:**
- Encrypted data export (with key)
- CSV/JSON format support
- Backup and restore functionality

### **Data Recovery:**
- Clear warnings about key loss
- Encrypted backup storage
- No backdoor access (by design)

## 💡 **Additional Considerations**

### **Legal Compliance:**
- Data retention policies
- Right to be forgotten
- Subpoena response procedures
- International data transfer compliance

### **Performance:**
- Indexed encrypted fields (limited)
- Partitioned tables for large datasets
- Caching for frequently accessed data
- Background encryption/decryption

### **Scalability:**
- Sharding by model_id
- Read replicas for analytics
- Separate encryption key management
- Microservice architecture ready

## 🎯 **Implementation Phases**

### **Phase 1: Core CRM Infrastructure (Weeks 1-2)**
- CRM routing and authentication
- Basic CRM interface structure
- Database tables and migrations

### **Phase 2: Core CRM Features (Weeks 3-6)**
- Client management interface
- Basic visit tracking
- Simple encryption system

### **Phase 3: Advanced Features (Weeks 7-10)**
- Screening system
- Reference management
- Communication tracking

### **Phase 4: Financial & Analytics (Weeks 11-14)**
- Revenue tracking
- Forecasting models
- Advanced reporting

### **Phase 5: Optimization (Weeks 15-16)**
- Performance tuning
- Advanced encryption
- API integrations

## 🔗 **Integration with Existing System**

### **Shared Components**
- **Database**: Uses existing `models` table for authentication
- **Password**: Same as admin password for simplicity
- **Sessions**: Separate session management for CRM vs Admin
- **Themes**: Dedicated CRM theme separate from admin theme

### **Benefits of Integration**
1. **Single Sign-On**: Models don't need separate passwords
2. **Data Consistency**: CRM data integrates with existing model data
3. **Unified Experience**: Seamless transition between CRM and admin
4. **Maintenance**: Shared infrastructure reduces maintenance overhead

This design provides a robust foundation for escort client management while maintaining privacy and enabling future financial forecasting capabilities. The separation from the admin panel ensures both systems remain focused and maintainable.
