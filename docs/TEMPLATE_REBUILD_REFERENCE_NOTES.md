# Template Rebuild Reference Notes
*Quick reference for template development*

## 📋 Critical Field Naming Patterns

### Page Content Prefixes
```handlebars
{{home_content.field_name}}      <!-- Home pages -->
{{about_content.field_name}}     <!-- About pages -->
{{rates_content.field_name}}     <!-- Rates pages -->
{{contact_content.field_name}}   <!-- Contact pages -->
{{etiquette_content.field_name}} <!-- Etiquette pages -->
{{gallery_content.field_name}}   <!-- Gallery pages -->
```

### Mandatory Visibility Pattern
```handlebars
{{#if page_content.section_visible}}
    <!-- Section content -->
{{/if}}
```

### Professional Fallback Pattern
```handlebars
{{#if page_content.field_name}}{{page_content.field_name}}{{else}}Professional Fallback{{/if}}
```

## 🎨 Creative Freedom Boundaries

### ✅ ALLOWED Creative Changes
- Visual design and styling
- Layout structure and composition
- Animation and interaction effects
- Typography and color schemes
- Section arrangement and merging

### ❌ FORBIDDEN Changes
- Ignoring database content
- Breaking user control (visibility toggles)
- Missing fallbacks for critical content
- Hardcoded content that should be database-driven
- Renaming or deleting existing fields

### 🎯 Creative Theme Directions
- **Glamour**: Movie star, spotlight effects, high drama, polished imagery
- **Luxury**: Opulent, gold accents, marble textures, regal layouts
- **Modern**: Clean, gradient-based, flat design, micro-interactions
- **Dark**: Deep tones, neon accents, cinematic lighting

## 🔧 Add New Field Protocol

1. **Admin Panel**: Add field to admin form (snake_case naming)
2. **Database**: Add column to content table (with migration)
3. **API**: Update GET/PUT endpoints to include field
4. **Template**: Use exact database field name
5. **Fallbacks**: Add professional fallbacks
6. **Toggle**: Create `*_visible` toggle if optional

## ✅ Quality Checklist (Quick Reference)

### Database Integration
- [ ] All database fields used in template
- [ ] All visibility controls function correctly
- [ ] All forms use database-driven labels
- [ ] All content has professional fallbacks

### Cross-Template Compatibility
- [ ] Switch Basic → New Theme (no breakage)
- [ ] Switch New Theme → Basic (no breakage)
- [ ] All page types render correctly after switch

### Design Quality
- [ ] Mobile responsive on all screen sizes
- [ ] Professional appearance with empty database
- [ ] Professional appearance with full content
- [ ] Fast loading performance

## 📊 Database Table Reference

| Page Type | Database Table | Required Fields |
|-----------|---------------|-----------------|
| Home | `model_home_page_content` | hero_section_visible, about_section_visible |
| About | `model_about_page_content` | page_title_visible, main_content_visible |
| Rates | `model_rates_page_content` | rates_table_visible, donations_visible |
| Contact | `model_contact_page_content` | contact_form_visible, contact_direct_visible |
| Etiquette | `model_etiquette_page_content` | etiquette_booking_visible, etiquette_respect_visible |
| Gallery | `model_gallery_page_content` | gallery_header_visible, enable_lightbox |

## 🚨 Common Pitfalls to Avoid

1. **Hardcoding Content**: Always use database fields with fallbacks
2. **Ignoring Visibility**: Every `*_visible` flag must be honored
3. **Breaking Fallbacks**: Empty database must still look professional
4. **Case Mismatches**: Use exact database field names (snake_case)
5. **Missing Responsiveness**: Test on all screen sizes
6. **Performance Issues**: Optimize images and minimize CSS/JS bloat

## 📁 File Structure Template

```
themes/[theme_name]/
├── pages/
│   ├── home.handlebars
│   ├── about.handlebars
│   ├── rates.handlebars
│   ├── contact.handlebars
│   ├── etiquette.handlebars
│   └── gallery.handlebars
├── layouts/
│   └── main.handlebars
├── partials/
│   └── [shared components]
└── assets/
    ├── css/
    ├── js/
    └── images/
```

---
*Created: August 13, 2025*
*Status: Ready for template development*