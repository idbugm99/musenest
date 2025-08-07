# MuseNest Referral Tracking System

A comprehensive referral code system that tracks client referrals, supports commission calculations, and provides detailed analytics for future monetization.

## 🏗 System Architecture Overview

### How the Referral System Works

The MuseNest referral system operates on a multi-layered architecture designed for scalability, accuracy, and future commission payouts:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   User Creates  │    │   New Client     │    │   System Logs   │
│  Referral Code  │───▶│  Uses Code to    │───▶│   & Tracks      │
│   "MAYA2025"    │    │   Sign Up        │    │   Commission    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ referral_codes  │    │ Client Creation  │    │referral_usage   │
│     table       │    │   with Tracking  │    │     _log        │
│                 │    │   (users table)  │    │                 │
│ • Code: MAYA25  │    │ • referral_code_ │    │ • Full audit    │
│ • Owner: Maya   │    │   used: MAYA25   │    │ • Commission    │
│ • Usage: 3/10   │    │ • referred_by:   │    │   tracking      │
│ • Active: true  │    │   maya_user_id   │    │ • Analytics     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Core System Flow

1. **Code Generation Phase**
   - User requests referral code via API or admin panel
   - System generates unique, readable code (avoiding confusing characters)
   - Code stored with usage limits, expiry dates, and campaign links

2. **Referral Usage Phase**
   - New client enters referral code during signup
   - System validates code (active, not expired, under usage limit)
   - Client account created with referral tracking fields populated

3. **Logging & Analytics Phase**
   - Detailed log entry created in `referral_usage_log`
   - Usage counter automatically incremented via database trigger
   - Commission eligibility determined and tracked

4. **Future Commission Phase** (Ready for activation)
   - System calculates commissions based on subscription tiers
   - Tracks payment status and pending amounts
   - Supports different commission structures per campaign

## 🚀 Quick Start

### 1. Apply the Migration
```bash
cd /Users/programmer/Projects/musenest
node run-referral-migration.js
```

### 2. Test the System
```javascript
// Create a referral code for user ID 1
const ReferralCodeGenerator = require('./utils/referral-code-generator');
const code = await ReferralCodeGenerator.createReferralCode(1, {
    name: 'Maya',
    email: 'maya@example.com',
    codeName: 'Maya VIP Code'
});
console.log('Generated code:', code.code); // e.g., "MAYA25"
```

### 3. Sign Up with Referral Code
```javascript
// POST /api/clients
{
    "name": "New Client",
    "email": "newclient@example.com", 
    "business_type": "escort",
    "referral_code": "MAYA25"  // <- This tracks the referral
}
```

## 📊 Database Schema

### Core Tables

#### `referral_codes`
Stores referral codes created by users
```sql
- id (Primary Key)
- client_id (Foreign Key to users.id)
- code (Unique referral code, e.g., "MAYA2025")
- code_name (Optional friendly name)
- usage_limit (NULL = unlimited)
- usage_count (Auto-incremented by trigger)
- expires_at (Optional expiry date)
- is_active (Enable/disable code)
- campaign_id (Link to promotional campaigns)
```

#### `referral_usage_log`
Detailed logging of every referral use
```sql
- referral_code_id (Which code was used)
- referred_user_id (New user who signed up)
- referrer_user_id (User who owned the code)
- signup_ip, signup_user_agent (Fraud prevention) 
- commission_eligible, commission_amount (Future payouts)
- used_at (Timestamp)
```

#### `users` (Enhanced)
Added referral tracking columns:
```sql
- referral_code_used (Code entered during signup)
- referred_by_user_id (Who referred this user)
```

#### `referral_campaigns` (Future Enhancement)
Campaign management for promotions:
```sql
- campaign_name, description
- commission_type (percentage, flat_rate, tier_based)
- commission_value, bonus_threshold
- starts_at, ends_at
```

## 🛠 Complete API Reference

### Overview
The referral system exposes RESTful API endpoints for creating, managing, and tracking referral codes. All endpoints return JSON responses with consistent error handling.

**Base URL**: `/api/`  
**Authentication**: Uses existing MuseNest authentication middleware  
**Content-Type**: `application/json`

### Error Response Format
```json
{
    "success": false,
    "error": "Human readable error message",
    "details": ["Additional error details array (optional)"]
}
```

---

### 📝 Client Registration & Referral Processing

#### Create New Client with Referral Code
**Endpoint**: `POST /api/clients`  
**Purpose**: Register new client account with optional referral tracking  
**Authentication**: Required

**Request Body**:
```json
{
    "name": "string (required)",
    "email": "string (required, unique)",  
    "phone": "string (optional)",
    "business_type": "string (required)",
    "description": "string (optional)",
    "template_id": "number (optional)",
    "subscription_tier_id": "number (optional)",
    "ai_config": "object (optional)",
    "status": "string (default: 'active')",
    "trial_days": "number (default: 7)",
    "client_type": "string (default: 'muse_owned')",
    "region_id": "number (default: 1)",
    "sales_channel_id": "number (default: 30)",
    "referral_code": "string (optional) - The referral code to apply"
}
```

**Success Response**:
```json
{
    "success": true,
    "message": "Client created successfully",
    "data": {
        "user_id": 123,
        "model_id": 456, 
        "account_number": "MO-US-30-240001",
        "subscription_id": 789,
        "temp_password": "abc123def",
        "login_url": "/login?email=client@example.com",
        "site_url": "/clientslug",
        "referral_info": {
            "code_used": "MAYA2025",
            "referred_by": "maya@example.com"
        }
    }
}
```

**Error Responses**:
- `400`: Missing required fields, email exists, invalid referral code
- `500`: Server error during account creation

**Referral Code Validation Process**:
1. Format validation (6-12 chars, no confusing characters)
2. Database lookup (code exists and is active)
3. Expiry check (not expired if expiry date set)
4. Usage limit check (under limit if limit set)
5. Logging (IP, user agent, commission eligibility)

---

### 🎫 Referral Code Management

#### Create New Referral Code
**Endpoint**: `POST /api/clients/:id/referral-codes`  
**Purpose**: Generate new referral code for existing client  
**Authentication**: Required

**URL Parameters**:
- `id` (number): Client user ID

**Request Body**:
```json
{
    "code_name": "string (optional) - Friendly name for the code",
    "usage_limit": "number|null (optional) - Max uses (null = unlimited)",
    "expires_at": "string|null (optional) - ISO date string",
    "custom_code": "string (optional) - Request specific code"
}
```

**Success Response**:
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

**Error Responses**:
- `404`: Client not found
- `400`: Invalid custom code format or duplicate code
- `500`: Database error during creation

---

#### Get Client's Referral Codes
**Endpoint**: `GET /api/clients/:id/referral-codes`  
**Purpose**: Retrieve all referral codes owned by client  
**Authentication**: Required

**URL Parameters**:
- `id` (number): Client user ID

**Success Response**:
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
            "created_at": "2025-08-04T12:00:00.000Z",
            "updated_at": "2025-08-04T15:30:00.000Z"
        }
    ]
}
```

**Response Fields**:
- `usage_count`: Database trigger-maintained count
- `actual_usage_count`: Calculated from usage log (more accurate)
- `eligible_referrals`: Signups eligible for commission
- `total_commission_earned`: Sum of all commission amounts

---

#### Validate Referral Code
**Endpoint**: `GET /api/referral-codes/validate/:code`  
**Purpose**: Check if referral code is valid and get details  
**Authentication**: Not required (public endpoint)

**URL Parameters**:
- `code` (string): Referral code to validate

**Success Response (Valid Code)**:
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

**Success Response (Invalid Code)**:
```json
{
    "valid": false,
    "error": "Referral code not found or inactive"
}
```

**Validation Errors**:
- "Invalid code format" - Wrong character set or length
- "Referral code not found or inactive" - Code doesn't exist
- "Referral code has expired" - Past expiry date
- "Referral code has reached its usage limit" - No uses remaining

---

### 📊 Analytics & Reporting

#### Get Referral Analytics
**Endpoint**: `GET /api/clients/:id/referral-analytics`  
**Purpose**: Comprehensive referral performance data  
**Authentication**: Required

**URL Parameters**:
- `id` (number): Client user ID

**Success Response**:
```json
{
    "success": true,
    "data": {
        "codes": [
            {
                "id": 1,
                "code": "MAYA2025",
                "code_name": "Maya VIP Code",
                "created_at": "2025-08-04T12:00:00.000Z",
                "usage_count": 3,
                "usage_limit": 10,
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
                "signup_ip": "192.168.1.100",
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

**Analytics Data Points**:
- **Performance by Code**: Usage stats, conversion rates
- **Time-based Analysis**: Recent activity trends
- **Commission Tracking**: Earned vs. paid amounts
- **Recent Activity**: Last 10 referral signups with details

---

#### Generate Code Suggestions
**Endpoint**: `POST /api/clients/:id/referral-codes/suggestions`  
**Purpose**: Get AI-generated referral code suggestions  
**Authentication**: Required

**URL Parameters**:
- `id` (number): Client user ID

**Success Response**:
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

**Suggestion Algorithm**:
1. **Name-based codes**: User's name + year/suffix
2. **Email-based codes**: Email username + modifiers  
3. **Brand codes**: "MUSE" + year/numbers
4. **Random fallback**: Safe character combinations
5. **Uniqueness check**: All suggestions verified as available

---

### 🔄 System Integration Endpoints

#### Bulk Referral Data Export
**Endpoint**: `GET /api/admin/referral-export`  
**Purpose**: Export referral data for commission processing  
**Authentication**: Admin required

**Query Parameters**:
- `start_date` (string): ISO date - filter from date
- `end_date` (string): ISO date - filter to date  
- `format` (string): 'json' or 'csv' - export format
- `commission_status` (string): 'all', 'eligible', 'paid', 'pending'

**Success Response**:
```json
{
    "success": true,
    "data": {
        "total_records": 150,
        "export_date": "2025-08-04T16:00:00.000Z",
        "filters_applied": {
            "start_date": "2025-07-01",
            "end_date": "2025-08-04",
            "commission_status": "eligible"
        },
        "referrals": [
            {
                "referral_code": "MAYA2025",
                "referrer_email": "maya@example.com",
                "referred_email": "newuser@example.com", 
                "signup_date": "2025-08-04T15:30:00.000Z",
                "commission_amount": "9.99",
                "commission_eligible": true,
                "commission_paid": false,
                "subscription_tier": "Premium",
                "signup_ip": "192.168.1.100"
            }
        ]
    }
}
```

---

## 🔧 System Implementation Details

### Database Relationships & Constraints

The referral system maintains data integrity through carefully designed relationships:

```sql
-- Core relationship flow
users (id) ←── referral_codes (client_id)
     │
     └── referred_by_user_id ←── users (referral_code_used)
                                     │
                                     └── referral_usage_log (referred_user_id)
```

#### Key Constraints
- **Unique Codes**: Each referral code must be globally unique
- **Active Referrer**: Only active users can create referral codes
- **Valid Referrer**: Self-referrals are prevented by business logic
- **Cascade Deletes**: User deletion removes their referral codes
- **Foreign Key Integrity**: All relationships maintained with proper constraints

### Automatic Triggers & Maintenance

#### Usage Count Trigger
```sql
CREATE TRIGGER update_referral_usage_count
AFTER INSERT ON referral_usage_log
FOR EACH ROW
BEGIN
    UPDATE referral_codes 
    SET usage_count = usage_count + 1,
        updated_at = NOW()
    WHERE id = NEW.referral_code_id;
END
```

**Purpose**: Automatically increment usage counter when referral is used  
**Benefits**: Real-time accuracy, no manual maintenance required

### Security & Fraud Prevention

#### Multi-Layer Validation
1. **Format Validation**: Client-side and server-side format checking
2. **Uniqueness Validation**: Database-level unique constraints
3. **Business Rule Validation**: Expiry dates, usage limits, active status
4. **Fraud Detection**: IP tracking, user agent logging, pattern analysis

#### Data Integrity Measures
- **Transaction Wrapping**: All referral operations in database transactions
- **Rollback on Error**: Failed signups don't increment usage counters
- **Audit Trail**: Complete log of all referral activities
- **Commission Eligibility**: Manual review flags for suspicious activity

### Performance Considerations

#### Database Indexing Strategy
```sql
-- Primary indexes for fast lookups
INDEX idx_code ON referral_codes(code);
INDEX idx_referral_code_used ON users(referral_code_used);
INDEX idx_referred_by_user ON users(referred_by_user_id);

-- Analytics indexes for dashboard queries
INDEX idx_usage_tracking ON referral_codes(usage_count, usage_limit);
INDEX idx_active_codes ON referral_codes(is_active, expires_at);
INDEX idx_commission_tracking ON referral_usage_log(commission_eligible, commission_paid);
```

#### Query Optimization
- **Analytical Views**: Pre-computed `referral_performance` view for dashboards
- **Efficient Joins**: Optimized queries using proper join strategies
- **Pagination Support**: Large result sets handled with LIMIT/OFFSET
- **Caching Strategy**: Frequently accessed codes cached at application layer

### Integration with MuseNest Business Model

#### Commission Calculation Framework
```javascript
// Future commission calculation example
const calculateCommission = (subscriptionAmount, referralTier) => {
    const baseCommission = subscriptionAmount * 0.10; // 10% base rate
    const tierMultiplier = getReferralTierMultiplier(referralTier);
    return baseCommission * tierMultiplier;
};
```

#### Subscription Integration Points
- **Trial Conversions**: Track when referred users convert from trial
- **Tier Upgrades**: Commission on subscription tier increases
- **Retention Bonuses**: Additional commission for long-term referrals
- **Churn Impact**: Adjust commissions for referred user cancellations

#### White Label Partner Support
```sql
-- Campaign structure for partner programs
INSERT INTO referral_campaigns (
    campaign_name, 
    commission_type, 
    commission_value,
    bonus_threshold
) VALUES (
    'White Label Partner Q4 2025',
    'percentage',
    3.00,  -- 3% for white label partners
    25     -- Bonus after 25 referrals
);
```

## 🎯 Code Generation Rules

### Format Standards
- **Length**: 6-12 characters
- **Characters**: Uppercase letters and numbers only
- **Excluded**: Confusing characters (O, 0, I, L, 1)
- **Pattern**: Name-based or random generation

### Generation Examples
```javascript
// Name-based codes
"MAYA2025"    // Maya + current year
"SARAH25"     // Sarah + year suffix  
"ROSEVIP"     // Rose + VIP suffix

// Email-based codes
"AMANDA25"    // amanda@example.com → AMANDA25

// Random codes (fallback)
"REF8H92N"    // Pure random when name unavailable
```

## 📈 Analytics & Reporting

### Performance View
The system includes a pre-built `referral_performance` view:
```sql
SELECT * FROM referral_performance 
WHERE referrer_email = 'maya@example.com';
```

### Key Metrics Tracked
- **Usage Statistics**: Total uses, recent activity
- **Commission Data**: Earnings, pending payments
- **Conversion Tracking**: Signup success rates
- **Fraud Prevention**: IP tracking, user agent logging

## 🔧 Programmatic Usage

### Using the Utility Class
```javascript
const ReferralCodeGenerator = require('./utils/referral-code-generator');

// Generate a code
const code = await ReferralCodeGenerator.generate({
    name: 'Maya',
    email: 'maya@example.com',
    length: 8,
    suffix: 'VIP'
});

// Validate format
const validation = ReferralCodeGenerator.validateCodeFormat('MAYA2025');
console.log(validation.valid); // true/false
console.log(validation.errors); // Array of error messages

// Create in database
const referralCode = await ReferralCodeGenerator.createReferralCode(userId, {
    name: 'Maya',
    codeName: 'Maya VIP Code',
    usageLimit: 50,
    expiresAt: new Date('2025-12-31')
});
```

## 🔒 Security & Fraud Prevention

### Built-in Protections
- **Unique Code Validation**: Database constraints prevent duplicates
- **Usage Limits**: Optional caps on code usage
- **Expiry Dates**: Time-limited codes
- **IP Tracking**: Monitor signup locations
- **User Agent Logging**: Browser fingerprinting
- **Commission Eligibility**: Flag for manual review

### Validation Layers
1. **Format Validation**: Character set and length rules
2. **Database Lookup**: Active code verification
3. **Business Rules**: Expiry and usage limit checks
4. **Fraud Detection**: IP and pattern analysis (future)

## 🚀 Future Enhancements

### Commission System
The foundation is ready for commission payouts:
```sql
-- Already tracked in referral_usage_log
commission_amount DECIMAL(10,2)
commission_eligible BOOLEAN  
commission_paid BOOLEAN
```

### Campaign Management
Support for promotional campaigns:
- Seasonal promotions (e.g., "Holiday 2025")
- Tier-based commissions (more referrals = higher %)
- Bonus thresholds (e.g., bonus after 10 referrals)

### Advanced Analytics
- Conversion funnels
- Referral source attribution  
- Geographic analysis
- Lifetime value tracking

## 📝 Implementation Checklist

- [x] Database schema migration
- [x] Referral code generation utility
- [x] API endpoints for CRUD operations
- [x] Client registration integration
- [x] Validation and security measures
- [x] Analytics and reporting views
- [x] Migration runner script
- [x] Comprehensive documentation

### Testing Checklist
- [ ] Run migration: `node run-referral-migration.js`
- [ ] Create test referral code via API
- [ ] Sign up new client with referral code
- [ ] Verify referral tracking in database
- [ ] Test analytics endpoints
- [ ] Validate error handling (expired/invalid codes)

## 💼 Business Workflows & Use Cases

### Typical Referral Workflow

#### 1. Client Creates Referral Code
```javascript
// Step 1: Client (Maya) creates her referral code
POST /api/clients/123/referral-codes
{
    "code_name": "Maya's VIP Referrals",
    "usage_limit": 50
}

// Response: Code "MAYA2025" created
```

#### 2. Client Shares Code
- **Social Media**: "Join MuseNest with code MAYA2025 for exclusive access!"
- **Email Campaigns**: Personalized referral links with embedded codes
- **Direct Messaging**: Share code with potential clients directly
- **Business Cards**: Include referral code on marketing materials

#### 3. New Client Uses Code
```javascript
// Step 2: New client (Sarah) signs up with Maya's code
POST /api/clients
{
    "name": "Sarah Johnson",
    "email": "sarah@example.com",
    "business_type": "escort",
    "referral_code": "MAYA2025",
    "subscription_tier_id": 2
}

// System automatically:
// - Validates MAYA2025 is active and under limit
// - Creates Sarah's account with referral tracking
// - Logs the referral usage with IP/browser info
// - Increments Maya's code usage count
```

#### 4. Commission Tracking (Future)
```javascript
// System tracks commission eligibility
{
    "referral_code": "MAYA2025",
    "referred_user": "sarah@example.com",
    "subscription_amount": 39.95,
    "commission_rate": 0.10,
    "commission_amount": 3.99,
    "commission_eligible": true,
    "commission_paid": false
}
```

### Advanced Use Cases

#### Campaign-Based Referrals
```sql
-- Special holiday campaign
INSERT INTO referral_campaigns (
    campaign_name,
    description,
    commission_type,
    commission_value,
    starts_at,
    ends_at
) VALUES (
    'Holiday 2025 Bonus',
    'Double commission for holiday referrals',
    'percentage',
    20.00,  -- 20% during campaign
    '2025-11-01 00:00:00',
    '2025-12-31 23:59:59'
);

-- Link referral codes to campaign
UPDATE referral_codes 
SET campaign_id = 1 
WHERE code IN ('MAYA2025', 'SARAH25');
```

#### White Label Partner Integration
```javascript
// White label agency creates codes for their models
POST /api/clients/456/referral-codes
{
    "code_name": "Agency XYZ - Model Maya",
    "usage_limit": 100,
    "custom_code": "XYZ-MAYA"
}

// Commission structure
// - 10% to Maya (direct referrer)
// - 3% to Agency XYZ (white label partner)
// - Total: 13% commission tracked
```

#### Tier-Based Commission Structure
```javascript
const getTierMultiplier = (totalReferrals) => {
    if (totalReferrals >= 100) return 1.5;  // 150% of base
    if (totalReferrals >= 50) return 1.25;  // 125% of base
    if (totalReferrals >= 25) return 1.1;   // 110% of base
    return 1.0; // Base rate
};

// Example: Maya has 75 total referrals
// Base commission: $39.95 * 10% = $3.99
// Tier multiplier: 1.25 (she's in the 50+ tier)
// Final commission: $3.99 * 1.25 = $4.99
```

### Analytics & Reporting Workflows

#### Monthly Commission Report
```javascript
// Generate commission report for Maya
GET /api/clients/123/referral-analytics?period=monthly

// Response includes:
{
    "period": "2025-08",
    "total_referrals": 12,
    "new_referrals": 8,
    "commission_earned": 119.64,
    "commission_pending": 119.64,
    "top_performing_code": "MAYA2025",
    "conversion_rate": 0.24  // 24% of people who see code sign up
}
```

#### Business Intelligence Dashboard
```sql
-- Top performing referrers (for admin dashboard)
SELECT 
    u.email as referrer,
    COUNT(rul.id) as total_referrals,
    SUM(rul.commission_amount) as total_commission,
    AVG(rul.commission_amount) as avg_commission_per_referral
FROM users u
JOIN referral_codes rc ON u.id = rc.client_id
JOIN referral_usage_log rul ON rc.id = rul.referral_code_id
WHERE rul.used_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY u.id, u.email
ORDER BY total_referrals DESC
LIMIT 10;
```

### Integration with Frontend

#### React Component Example
```jsx
const ReferralCodeGenerator = ({ userId }) => {
    const [codes, setCodes] = useState([]);
    const [isGenerating, setIsGenerating] = useState(false);

    const generateCode = async (codeName) => {
        setIsGenerating(true);
        try {
            const response = await fetch(`/api/clients/${userId}/referral-codes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code_name: codeName })
            });
            const result = await response.json();
            
            if (result.success) {
                setCodes([...codes, result.data]);
                toast.success(`Code ${result.data.code} created!`);
            }
        } catch (error) {
            toast.error('Failed to create referral code');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="referral-generator">
            <h3>My Referral Codes</h3>
            {codes.map(code => (
                <div key={code.id} className="referral-code-card">
                    <strong>{code.code}</strong>
                    <span>{code.usage_count}/{code.usage_limit || '∞'} uses</span>
                    <button onClick={() => copyToClipboard(code.code)}>
                        Copy Code
                    </button>
                </div>
            ))}
            <button onClick={() => generateCode('My New Code')} disabled={isGenerating}>
                {isGenerating ? 'Generating...' : 'Create New Code'}
            </button>
        </div>
    );
};
```

#### Signup Form Integration
```jsx
const SignupForm = () => {
    const [formData, setFormData] = useState({});
    const [referralCode, setReferralCode] = useState('');
    const [referralValid, setReferralValid] = useState(null);

    const validateReferralCode = async (code) => {
        if (!code) return;
        
        try {
            const response = await fetch(`/api/referral-codes/validate/${code}`);
            const result = await response.json();
            setReferralValid(result);
        } catch (error) {
            setReferralValid({ valid: false, error: 'Failed to validate code' });
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            {/* Standard signup fields */}
            <input 
                type="text" 
                placeholder="Referral Code (Optional)"
                value={referralCode}
                onChange={(e) => {
                    setReferralCode(e.target.value);
                    validateReferralCode(e.target.value);
                }}
            />
            
            {referralValid && (
                <div className={`referral-status ${referralValid.valid ? 'valid' : 'invalid'}`}>
                    {referralValid.valid 
                        ? `✓ Code by ${referralValid.data.referrer_name}` 
                        : `✗ ${referralValid.error}`
                    }
                </div>
            )}
            
            <button type="submit">Create Account</button>
        </form>
    );
};
```

## 🆘 Troubleshooting

### Common Issues

**Migration fails with "Table already exists"**
- This is normal on re-runs. The script skips existing structures.

**Referral code not found during signup**
- Verify code exists: `SELECT * FROM referral_codes WHERE code = 'YOURCODE'`
- Check if code is active: `is_active = true`
- Verify expiry date: `expires_at IS NULL OR expires_at > NOW()`

**Usage count not updating**
- Check the trigger: `SHOW TRIGGERS LIKE 'update_referral_usage_count'`
- Manually update if needed: `UPDATE referral_codes SET usage_count = usage_count + 1 WHERE id = ?`

### Debug Queries
```sql
-- Check referral performance for a user
SELECT * FROM referral_performance WHERE referrer_user_id = 1;

-- Recent referral activity
SELECT * FROM referral_usage_log ORDER BY used_at DESC LIMIT 10;

-- Users who signed up with referrals
SELECT email, referral_code_used, referred_by_user_id 
FROM users WHERE referral_code_used IS NOT NULL;
```

---

**Built for MuseNest** - Scalable referral tracking that grows with your business 🚀