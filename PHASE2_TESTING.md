# Phase 2: Dynamic Routing - Testing Guide

## 🎉 What's Been Completed

✅ **Custom Template Engine** - Handlebars-like syntax with helpers  
✅ **Dynamic Routing System** - Database-driven page rendering  
✅ **Model Homepage Routes** - `/<slug>/` with theme selection  
✅ **Page Routing System** - `/<slug>/<page>` for all page types  
✅ **Theme Integration** - Automatic theme selection from database  
✅ **Content Loading** - Gallery, testimonials, FAQ data from database  

---

## 🚀 Setup & Testing

### 1. Ensure Phase 1 is Complete
Make sure you've already completed Phase 1 setup:
```bash
cd /Users/programmer/Projects/musenest
npm install
npm run migrate
npm run migrate-data
```

### 2. Start Development Server
```bash
npm run dev
```

### 3. Test Your Model Pages

#### Test Model Homepage
Visit your migrated models:
```bash
# If you have these models from RoseMastos:
http://localhost:3000/modelexample/
http://localhost:3000/escortmodel/  
http://localhost:3000/camgirl/
```

**Expected Results:**
- ✅ Page loads with your model's theme (glamour/basic)
- ✅ Model name displays in hero section
- ✅ Site settings (tagline, contact info) appear
- ✅ Gallery images show if available
- ✅ Testimonials display if available
- ✅ Navigation menu works

#### Test Page Routes
Try different page types:
```bash
# FAQ Page (should show your migrated FAQ items)
http://localhost:3000/escortmodel/faq

# Gallery Page (should show all gallery sections)
http://localhost:3000/escortmodel/gallery

# About Page (if you have about content)
http://localhost:3000/escortmodel/about

# Contact Page
http://localhost:3000/escortmodel/contact

# Rates Page (if you have services data)
http://localhost:3000/escortmodel/rates
```

### 4. Test Theme Switching

#### Change Model Theme via API
```bash
# First, get a JWT token by logging in
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your_email@example.com",
    "password": "your_password"
  }'

# Get available themes
curl -X GET http://localhost:3000/api/models/escortmodel/themes \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Apply glamour theme (theme_id: 3)
curl -X POST http://localhost:3000/api/models/escortmodel/theme \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"theme_id": 3}'

# Apply basic theme (theme_id: 1)  
curl -X POST http://localhost:3000/api/models/escortmodel/theme \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"theme_id": 1}'
```

After changing themes, refresh the page to see the new design!

---

## 🔍 What to Look For

### ✅ Homepage Features
- [ ] Model name displays correctly
- [ ] Site tagline appears (if set)
- [ ] Gallery images load (first 12 from first section)
- [ ] Testimonials show (featured ones)
- [ ] Navigation menu has all page links
- [ ] Theme styling applies (colors, fonts, layout)
- [ ] "Get In Touch" button links to contact page

### ✅ FAQ Page Features  
- [ ] FAQ items display in accordion format
- [ ] Questions and answers show correctly
- [ ] Alternating card colors (glamour theme)
- [ ] Smooth accordion animations
- [ ] Empty state shows if no FAQs

### ✅ Gallery Page Features
- [ ] All gallery sections display
- [ ] Images load with correct paths
- [ ] Image captions appear on hover
- [ ] Responsive grid layout
- [ ] Empty state shows if no images

### ✅ Theme Features
- [ ] Basic theme: Clean blue and white design
- [ ] Glamour theme: Dark with golden accents
- [ ] Navigation styling matches theme
- [ ] Button colors match theme
- [ ] Typography reflects theme personality

---

## 🐛 Troubleshooting

### Page Won't Load
```bash
# Check server logs for errors
# Common issues:
# - Database connection problems
# - Missing theme templates
# - Template syntax errors
```

### No Data Showing
```bash
# Verify data migration worked
mysql -u root -p musenest -e "SELECT COUNT(*) FROM gallery_images;"
mysql -u root -p musenest -e "SELECT COUNT(*) FROM faq_items;"
mysql -u root -p musenest -e "SELECT COUNT(*) FROM testimonials;"

# Check model exists and is active
mysql -u root -p musenest -e "SELECT id, name, slug, status FROM models;"
```

### Theme Not Applied
```bash
# Check model has theme assigned
mysql -u root -p musenest -e "
SELECT m.name, t.name as theme, mt.is_active 
FROM models m 
LEFT JOIN model_themes mt ON m.id = mt.model_id 
LEFT JOIN themes t ON mt.theme_id = t.id 
WHERE mt.is_active = true;
"

# If no theme, assign basic theme (id: 1)
# Use the API to set a theme
```

### Images Not Loading
```bash
# Check uploads directory exists
ls -la /Users/programmer/Projects/musenest/public/uploads/

# Check image paths in database
mysql -u root -p musenest -e "SELECT filename FROM gallery_images LIMIT 5;"

# Copy images from RoseMastos if needed
cp -r /Users/programmer/Projects/rosemastos/app/static/images/* /Users/programmer/Projects/musenest/public/uploads/
```

---

## 🎯 Testing Checklist

### Basic Functionality
- [ ] Homepage loads for each model
- [ ] Navigation links work
- [ ] Theme switching works via API
- [ ] Database content displays correctly
- [ ] Images load from uploads directory
- [ ] Mobile responsive design works

### Advanced Features
- [ ] FAQ accordion animations
- [ ] Gallery hover effects
- [ ] Theme-specific styling
- [ ] Error handling (404 for invalid models/pages)
- [ ] Template fallbacks (basic theme as fallback)

### Performance
- [ ] Pages load quickly (< 2 seconds)
- [ ] Template caching works in production
- [ ] Database queries are efficient
- [ ] Images optimize correctly

---

## 🚀 What's Next

Once dynamic routing is working perfectly, you can move to:

### **Option A: Content Management APIs**
- Gallery image upload/management
- FAQ CRUD operations  
- Testimonial management
- Page content editing

### **Option B: Remaining Themes**
- Luxury theme (elegant brown/gold)
- Modern theme (contemporary green/purple)
- Dark theme (dark mode variant)

### **Option C: Admin Dashboard**
- Web interface for content management
- Image upload tools
- Settings configuration
- User management

---

## 📊 Success Metrics

Phase 2 is successful when:
- ✅ All your RoseMastos models render correctly
- ✅ Theme switching works seamlessly  
- ✅ Database content displays properly
- ✅ Navigation and page routing works
- ✅ Mobile responsive design functions
- ✅ Performance is acceptable (< 2s page loads)

**Phase 2 delivers a fully functional model portfolio system with database-driven content and theme switching!** 🎉

Let me know which area you'd like to focus on next!