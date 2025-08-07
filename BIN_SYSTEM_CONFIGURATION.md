# MuseNest BIN-Style Account System Configuration
**Created:** August 4, 2025  
**Version:** 1.0  
**Status:** ✅ Ready for Production  

---

## 🎯 **System Overview**

The MuseNest BIN-style account numbering system provides structured 12-digit account numbers that encode business intelligence data while appearing professional to clients.

### **Account Number Format: `[TT][CC][SS][RRRRRR]`**

| Segment | Length | Purpose | Range |
|---------|--------|---------|-------|
| **TT** | 2 digits | Client Type Code | 01-09, 99 |
| **CC** | 2 digits | Country/Region Code | 01-99 (ITU-T standard) |
| **SS** | 2 digits | Sales Channel Code | 10-99 |
| **RRRRRR** | 6 digits | Sequential Unique ID | 100001-999999 |

---

## 🏢 **Client Type Codes (TT)**

### **Standard Configuration**
```sql
INSERT INTO client_type_codes (client_type, type_code, description) VALUES
('muse_owned', 1, 'Direct MuseNest clients - primary revenue source'),
('white_label', 2, 'White label agency partners - shared revenue'),
('sub_client', 3, 'Sub-clients under parent accounts - nested billing'),
('admin', 9, 'System templates and demo accounts - non-revenue');
```

### **Business Logic**
- **01 (MuseNest)**: Direct customers, full revenue attribution
- **02 (White Label)**: Agency partners, revenue sharing model
- **03 (Sub-client)**: Hierarchical accounts, parent billing relationship
- **09 (Admin)**: System templates, excluded from business metrics

---

## 🌍 **International Region Codes (CC)**

### **ITU-T Country Code Standard**
Based on International Telecommunication Union country calling codes for global consistency:

```sql
INSERT INTO regions (region_code, region_name, country_code, currency, timezone) VALUES
(1, 'United States', 'US', 'USD', 'America/New_York'),
(44, 'United Kingdom', 'GB', 'GBP', 'Europe/London'),
(49, 'Germany', 'DE', 'EUR', 'Europe/Berlin'),
(33, 'France', 'FR', 'EUR', 'Europe/Paris'),
(61, 'Australia', 'AU', 'AUD', 'Australia/Sydney'),
(81, 'Japan', 'JP', 'JPY', 'Asia/Tokyo'),
(86, 'China', 'CN', 'CNY', 'Asia/Shanghai'),
(91, 'India', 'IN', 'INR', 'Asia/Kolkata'),
(55, 'Brazil', 'BR', 'BRL', 'America/Sao_Paulo'),
(52, 'Mexico', 'MX', 'MXN', 'America/Mexico_City'),
(7, 'Russia', 'RU', 'RUB', 'Europe/Moscow'),
(34, 'Spain', 'ES', 'EUR', 'Europe/Madrid'),
(39, 'Italy', 'IT', 'EUR', 'Europe/Rome'),
(31, 'Netherlands', 'NL', 'EUR', 'Europe/Amsterdam'),
(46, 'Sweden', 'SE', 'SEK', 'Europe/Stockholm'),
(47, 'Norway', 'NO', 'NOK', 'Europe/Oslo'),
(41, 'Switzerland', 'CH', 'CHF', 'Europe/Zurich'),
(43, 'Austria', 'AT', 'EUR', 'Europe/Vienna'),
(32, 'Belgium', 'BE', 'EUR', 'Europe/Brussels'),
(99, 'International', 'INTL', 'USD', 'UTC');
```

### **Regional Expansion Strategy**
- **Phase 1**: English-speaking markets (US, UK, AU)
- **Phase 2**: European Union (DE, FR, ES, IT, NL)
- **Phase 3**: Asia-Pacific (JP, AU, SG)
- **Phase 4**: Latin America (BR, MX, AR)
- **Code 99**: Catch-all for unlisted countries

---

## 🤝 **Sales Channel Codes (SS)**

### **Standard Configuration**
```sql
INSERT INTO sales_channels (channel_code, channel_name, description, commission_rate, attribution_window) VALUES
(10, 'website', 'Direct website registration', 0.00, 30),
(20, 'referral', 'Client referral program', 10.00, 90),
(30, 'manual', 'Manual admin creation', 0.00, NULL),
(40, 'api', 'API integration signup', 0.00, 30),
(50, 'partner', 'Partner channel signup', 5.00, 60),
(60, 'affiliate', 'Affiliate marketing program', 15.00, 30),
(70, 'social', 'Social media campaigns', 2.00, 14),
(80, 'email', 'Email marketing campaigns', 1.00, 7),
(90, 'event', 'Trade show and events', 0.00, 90),
(99, 'system', 'System-generated accounts', 0.00, NULL);
```

### **Channel Attribution Model**
- **Attribution Window**: Days to track conversion source
- **Commission Rate**: Percentage for channel partners
- **Revenue Impact**: Different LTV by acquisition channel

---

## 🔢 **Sequential ID Management (RRRRRR)**

### **Database Implementation**
```sql
CREATE TABLE account_sequence (
    id INT PRIMARY KEY AUTO_INCREMENT,
    last_sequence INT NOT NULL DEFAULT 100000,
    reserved_range_start INT NULL,
    reserved_range_end INT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Initialize with starting sequence
INSERT INTO account_sequence (last_sequence) VALUES (100000);
```

### **Sequence Management Rules**
- **Starting Point**: 100001 (first customer account)
- **Range**: 100001 to 999999 (899,999 accounts maximum)
- **Atomic Updates**: Thread-safe increment operations
- **Reserved Ranges**: Block sequences for special purposes

---

## 📊 **Account Number Examples**

### **Live Production Examples**
| Account Number | Breakdown | Description |
|----------------|-----------|-------------|
| `010110100001` | US MuseNest Website #1 | First US direct customer via website |
| `024420200045` | UK White Label Referral #45 | UK agency client from referral program |
| `030130300123` | US Sub-client Manual #123 | US sub-account created manually |
| `099999100002` | International Admin System #2 | System template (Escort Example) |
| `014950100500` | DE MuseNest Partner #500 | German client via partner channel |
| `028140150750` | JP White Label API #750 | Japanese agency via API integration |

### **Geographic Distribution Analysis**
```sql
-- Analyze client distribution by region
SELECT 
    r.region_name,
    COUNT(*) as client_count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM models), 2) as percentage
FROM models m
JOIN regions r ON m.region_id = r.region_code
WHERE m.account_number IS NOT NULL
GROUP BY r.region_code, r.region_name
ORDER BY client_count DESC;
```

---

## 🛠 **Setup Implementation**

### **1. Database Schema Setup**
```bash
# Run the BIN system migration
cd /Users/programmer/Projects/musenest
node -e "
const db = require('./config/database');

async function setupBINSystem() {
    // Create client type codes table
    await db.execute(\`
        CREATE TABLE IF NOT EXISTS client_type_codes (
            id INT PRIMARY KEY AUTO_INCREMENT,
            client_type ENUM('muse_owned', 'white_label', 'sub_client', 'admin') NOT NULL UNIQUE,
            type_code INT NOT NULL UNIQUE,
            description VARCHAR(200) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    \`);
    
    // Create regions table
    await db.execute(\`
        CREATE TABLE IF NOT EXISTS regions (
            region_code INT PRIMARY KEY,
            region_name VARCHAR(50) NOT NULL,
            country_code VARCHAR(3) NOT NULL,
            currency VARCHAR(3) NOT NULL,
            timezone VARCHAR(50) DEFAULT 'UTC',
            status ENUM('active', 'inactive') DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    \`);
    
    // Create sales channels table
    await db.execute(\`
        CREATE TABLE IF NOT EXISTS sales_channels (
            channel_code INT PRIMARY KEY,
            channel_name VARCHAR(50) NOT NULL UNIQUE,
            description VARCHAR(200),
            commission_rate DECIMAL(5,2) DEFAULT 0.00,
            attribution_window INT DEFAULT 30,
            status ENUM('active', 'inactive') DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    \`);
    
    console.log('✅ BIN system tables created successfully');
}

setupBINSystem().catch(console.error);
"
```

### **2. Populate Default Data**
```bash
# Populate with standard configuration
mysql -u root -D musenest << 'EOF'
-- Client Types
INSERT IGNORE INTO client_type_codes (client_type, type_code, description) VALUES
('muse_owned', 1, 'Direct MuseNest clients - primary revenue source'),
('white_label', 2, 'White label agency partners - shared revenue'),
('sub_client', 3, 'Sub-clients under parent accounts - nested billing'),
('admin', 9, 'System templates and demo accounts - non-revenue');

-- Regions (ITU-T standard)
INSERT IGNORE INTO regions (region_code, region_name, country_code, currency) VALUES
(1, 'United States', 'US', 'USD'),
(44, 'United Kingdom', 'GB', 'GBP'),
(49, 'Germany', 'DE', 'EUR'),
(33, 'France', 'FR', 'EUR'),
(61, 'Australia', 'AU', 'AUD'),
(81, 'Japan', 'JP', 'JPY'),
(99, 'International', 'INTL', 'USD');

-- Sales Channels
INSERT IGNORE INTO sales_channels (channel_code, channel_name, description, commission_rate) VALUES
(10, 'website', 'Direct website registration', 0.00),
(20, 'referral', 'Client referral program', 10.00),
(30, 'manual', 'Manual admin creation', 0.00),
(40, 'api', 'API integration signup', 0.00),
(50, 'partner', 'Partner channel signup', 5.00),
(99, 'system', 'System-generated accounts', 0.00);
EOF
```

---

## 🎯 **Business Intelligence Benefits**

### **1. Instant Recognition Patterns**
- **Revenue Accounts**: `01****` = MuseNest direct customers
- **Partner Revenue**: `02****` = White label shared revenue
- **System Accounts**: `09****` = Non-revenue templates
- **Geographic Focus**: `*01***` = US market, `*44***` = UK market

### **2. Advanced Analytics Capabilities**
```sql
-- Revenue attribution by acquisition channel
SELECT 
    sc.channel_name,
    COUNT(*) as signups,
    sc.commission_rate,
    SUM(estimated_ltv) as total_revenue
FROM models m
JOIN sales_channels sc ON m.sales_channel_id = sc.channel_code
WHERE m.client_type = 'muse_owned'
GROUP BY sc.channel_code
ORDER BY total_revenue DESC;

-- Geographic performance analysis
SELECT 
    r.region_name,
    COUNT(*) as clients,
    AVG(monthly_revenue) as avg_revenue,
    r.currency
FROM models m
JOIN regions r ON m.region_id = r.region_code
WHERE m.account_number IS NOT NULL
GROUP BY r.region_code;
```

### **3. Fraud Detection Patterns**
- Unusual regional patterns (bulk accounts from unexpected locations)
- Channel mismatch detection (API signups without integration)
- Sequence gap analysis (missing account numbers)

---

## 🔧 **Account Number Generator Integration**

### **Generator Usage**
```javascript
const AccountNumberGenerator = require('./utils/account-number-generator');

// Generate new account number
const accountNumber = await AccountNumberGenerator.generate(
    'muse_owned',  // client_type
    1,             // region_id (US)
    10             // sales_channel_id (website)
);
// Result: "010110100001"

// Parse existing account number
const parsed = AccountNumberGenerator.parseAccountNumber('024420200045');
console.log(parsed);
// {
//   typeCode: 2,
//   regionCode: 44,
//   channelCode: 20,
//   sequentialId: 200045,
//   description: "White Label • UK • Referral"
// }
```

---

## 📈 **Scaling Considerations**

### **Account Number Capacity**
- **Current Range**: 100,001 to 999,999 (899,999 accounts)
- **Extension Path**: Add prefix digit for 8,999,990 accounts
- **Estimated Capacity**: 50+ years at 18K signups/year

### **Regional Expansion**
- **ITU-T Compliance**: Globally recognized country codes
- **Currency Support**: Multi-currency billing ready
- **Timezone Awareness**: Built-in timezone mapping

### **Performance Optimization**
- **Indexed Lookups**: All code mappings indexed
- **Cached Mappings**: Frequent lookups cached in memory
- **Batch Generation**: Bulk account creation supported

---

## 🔒 **Security & Compliance**

### **Data Privacy**
- **No PII in Account Numbers**: Only business codes, no personal data
- **GDPR Compliant**: Account numbers remain valid after user data deletion
- **Audit Trail**: Full creation and modification history

### **Business Continuity**
- **Backup Strategy**: Code mappings backed up daily
- **Disaster Recovery**: Account generation continues during outages
- **Migration Path**: Easy migration to new numbering schemes

---

**Status**: ✅ Production Ready  
**Next Review**: Q1 2026  
**Maintainer**: MuseNest Development Team  

This BIN-style account system provides MuseNest with enterprise-grade account numbering that scales globally while embedding valuable business intelligence in every account number.