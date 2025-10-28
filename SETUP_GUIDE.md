# phoenix4ge Setup Guide - Phase 1 Complete!

## 🎉 What's Been Completed

✅ **Database Schema** - Fully normalized MySQL schema  
✅ **Data Migration Scripts** - Extract data from RoseMastos SQLite  
✅ **JWT Authentication** - Complete auth system with middleware  
✅ **Core API Routes** - Auth and Models management  
✅ **Theme System** - Database-driven themes with colors  
✅ **Project Structure** - Professional Node.js architecture  

---

## 🚀 Quick Setup (5 minutes)

### 1. Install Dependencies
```bash
cd /Users/programmer/Projects/phoenix4ge
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

Edit `.env` with your MySQL credentials:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=phoenix4ge
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
```

### 3. Setup Database
```bash
# Create database
mysql -u root -p -e "CREATE DATABASE phoenix4ge;"

# Run schema migrations
npm run migrate
```

### 4. Migrate Your RoseMastos Data
```bash
# This will copy all your existing data to phoenix4ge
npm run migrate-data
```

### 5. Start Development Server
```bash
npm run dev
```

**Server will be running at:** http://localhost:3000

---

## 🧪 Testing the System

### Test Database Schema
```bash
# Check health endpoint
curl http://localhost:3000/health

# Should return:
# {
#   "status": "OK",
#   "database": "Connected",
#   "timestamp": "2025-07-24T..."
# }
```

### Test Authentication System

#### 1. Register New User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123",
    "name": "Test User"
  }'
```

#### 2. Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com", 
    "password": "TestPass123"
  }'
```

Save the `token` from the response for next requests.

#### 3. Get User Profile
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

### Test Models API

#### 1. Get User's Models
```bash
curl -X GET http://localhost:3000/api/models \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

#### 2. Get Model Details
```bash
curl -X GET http://localhost:3000/api/models/modelexample \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

#### 3. Update Site Settings
```bash
curl -X PUT http://localhost:3000/api/models/modelexample/settings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "site_name": "My Updated Portfolio",
    "model_name": "Updated Model Name",
    "tagline": "Professional model services"
  }'
```

#### 4. Get Available Themes
```bash
curl -X GET http://localhost:3000/api/models/modelexample/themes \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

#### 5. Apply Theme
```bash
curl -X POST http://localhost:3000/api/models/modelexample/theme \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "theme_id": 3
  }'
```

---

## 📊 Migration Report

After running `npm run migrate-data`, check the generated report:
```bash
cat migration-report.json
```

This shows exactly what data was migrated from RoseMastos.

---

## 🔍 Verify Your Data

### Check Migrated Models
```bash
mysql -u root -p phoenix4ge -e "SELECT id, name, slug, status FROM models;"
```

### Check Migrated Users  
```bash
mysql -u root -p phoenix4ge -e "SELECT id, email, role FROM users;"  
```

### Check Gallery Images
```bash
mysql -u root -p phoenix4ge -e "SELECT COUNT(*) as total_images FROM gallery_images;"
```

### Check FAQ Items
```bash
mysql -u root -p phoenix4ge -e "SELECT COUNT(*) as total_faqs FROM faq_items;"
```

---

## 🐛 Troubleshooting

### Database Connection Issues
```bash
# Test MySQL connection
mysql -u root -p -e "SELECT 1;"

# Check if database exists
mysql -u root -p -e "SHOW DATABASES LIKE 'phoenix4ge';"
```

### Migration Issues
```bash
# Check migration logs
npm run migrate 2>&1 | tee migration.log

# Reset database if needed
mysql -u root -p -e "DROP DATABASE IF EXISTS phoenix4ge; CREATE DATABASE phoenix4ge;"
npm run migrate
```

### Authentication Issues
- Make sure JWT_SECRET is set in .env
- Check that bcrypt rounds are reasonable (12 is good)
- Verify user exists in database

---

## 🎯 What's Next (Phase 2)

Now that Phase 1 is complete, you can choose the next focus:

### A. **Dynamic Routing** (Recommended)
- Implement `/<slug>/` model homepage routes
- Database-driven page rendering  
- Theme template selection

### B. **Content Management API**
- Gallery image CRUD operations
- FAQ management endpoints
- Page content editing

### C. **Complete Theme Templates**
- Build luxury theme templates
- Create modern theme templates
- Develop dark theme templates

### D. **Admin Dashboard**
- Web interface for content management
- Image upload and editing
- Settings configuration UI

---

## 📝 Architecture Notes

### Security Features ✅
- JWT authentication with expiration
- Password hashing with bcrypt (12 rounds)
- Role-based authorization (model, admin, sysadmin)
- Model access control (owner, admin, editor, viewer)
- Input validation with express-validator
- Rate limiting and CORS protection

### Database Features ✅
- Fully normalized schema (no JSON fields)
- Foreign key constraints
- Connection pooling
- Transaction support
- Query error handling

### API Features ✅
- RESTful endpoint design
- Consistent error responses  
- Validation middleware
- Authentication middleware
- Role-based access control

**Phase 1 is COMPLETE! 🎉**

Your phoenix4ge foundation is ready for development. All your RoseMastos data has been migrated to the new normalized structure, and the authentication system is fully functional.

Choose your next phase and let's continue building! 🚀