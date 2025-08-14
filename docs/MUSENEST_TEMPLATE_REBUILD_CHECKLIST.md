# MuseNest Template Rebuild Checklist
*Based on Basic Template Standards*

## Overview

This checklist ensures that all new themes maintain 100% compatibility with the MuseNest database structure while providing creative freedom for unique visual designs. Every template rebuild must follow these standards to guarantee plug-and-play compatibility.

## 1. Source of Truth

### Baseline Standard
- **The rebuilt Basic template (Template 1) is the functional blueprint** for every other template
- All field names, database integration, and visibility logic must match the `TEMPLATE_FIELD_NAMING_SCHEME.md`
- All creative liberties must comply with `TEMPLATE_CREATIVE_FLEXIBILITY_GUIDELINES.md`
- **If a field in Basic has a `_visible` toggle, that visibility control must be honored in all templates**

### Documentation Compliance
- [ ] Review `TEMPLATE_FIELD_NAMING_SCHEME.md` for exact field naming patterns
- [ ] Follow `TEMPLATE_CREATIVE_FLEXIBILITY_GUIDELINES.md` for acceptable modifications
- [ ] Use Basic template as functional reference for all database integrations

## 2. Field & Database Rules

### Existing Field Support
- [ ] **All existing admin page content fields from Basic must be supported and render correctly** in every template
- [ ] All `[page]_content.*` field patterns must be preserved exactly
- [ ] All visibility toggles (`*_visible`) must function identically to Basic template

### Add New Field Protocol
When a new design element is needed:

1. **Admin Panel**
   - [ ] Add the field to the admin panel form
   - [ ] Use consistent naming convention (snake_case)
   - [ ] Include appropriate form validation

2. **Database**
   - [ ] Add the column to the correct content table (snake_case, correct prefix)
   - [ ] Use appropriate data types (VARCHAR, TEXT, TINYINT for booleans)
   - [ ] Create database migration script

3. **API Integration**
   - [ ] Update API GET endpoints to include the new field
   - [ ] Update API PUT endpoints to accept the new field
   - [ ] Test API responses include new field data

4. **Template Implementation**
   - [ ] Implement in the template using the exact database field name
   - [ ] Add professional fallbacks if no content exists
   - [ ] If optional content, create a corresponding `*_visible` toggle

5. **Documentation**
   - [ ] Document new field in API reference
   - [ ] Add to template field naming scheme
   - [ ] Include in testing protocols

## 3. Design Maximization

### Theme Creative Direction
Each theme name defines its creative approach:

- **Glamour** → Movie star aesthetic, dramatic visuals, spotlight effects
- **Luxury** → Opulent design, gold accents, regal atmosphere
- **Modern** → Flat/gradient design, geometric elements, micro-interactions
- **Dark** → Deep tones, neon accents, cinematic mood

### Design Implementation Rules
- [ ] Add new layout elements or effects as needed while maintaining database compatibility
- [ ] If building a one-page layout, merge sections elegantly while honoring all `*_visible` toggles
- [ ] Maintain professional appearance with both full and empty content
- [ ] Ensure theme personality is evident throughout all pages

### Visual Standards
- [ ] Responsive design across all screen sizes
- [ ] Consistent color scheme and typography
- [ ] Professional fallback content styling
- [ ] Smooth transitions and animations (where appropriate)

## 4. Backwards Compatibility

### Critical Compatibility Requirements
- [ ] **Switching from Basic to any theme must be plug-and-play with no breakage**
- [ ] **No renaming or deleting existing fields**
- [ ] **All new fields must be optional** (have appropriate fallbacks)
- [ ] **Layouts must gracefully handle empty fields** without breaking structure

### Testing Scenarios
- [ ] Switch from Basic → New Theme with full dataset
- [ ] Switch from Basic → New Theme with minimal dataset
- [ ] Switch from New Theme → Basic (both directions work)
- [ ] All page types render correctly after theme switch
- [ ] All forms continue to function after theme switch

## 5. API & System Updates

### API Requirements
All new fields and changes must:
- [ ] Be documented in the API reference
- [ ] Be tested for GET and PUT operations
- [ ] Work with both old and new templates
- [ ] Include proper validation and error handling

### Theme Management
- [ ] Theme switching handled by one database field (e.g., `active_theme`)
- [ ] **Future requirement**: Seasonal themes (e.g., Christmas) will use the same field and must be swappable without extra code changes
- [ ] Theme metadata properly stored and retrievable

### Database Schema Updates
- [ ] All new columns use appropriate data types
- [ ] Migration scripts created and tested
- [ ] Rollback procedures documented
- [ ] Index optimization considered for new fields

## 6. Testing & QA

### Functional Tests
- [ ] **All database fields render correctly**
- [ ] **All `*_visible` toggles hide/show sections properly**
- [ ] **All fallbacks render if content is missing**
- [ ] Forms submit and save correctly
- [ ] Navigation functions properly
- [ ] External links work as expected

### Cross-Template Tests
- [ ] **Switch between Basic and any theme with the same dataset — no breakage**
- [ ] Content appears consistently across themes
- [ ] Admin panel functions identically regardless of active theme
- [ ] Database queries return same data for all themes

### Design QA
- [ ] **Fully responsive across devices** (mobile, tablet, desktop)
- [ ] **Works with both full and empty data**
- [ ] **No layout overlap or broken sections** when content is missing
- [ ] Typography remains readable at all screen sizes
- [ ] Images and media display correctly
- [ ] Color contrast meets accessibility standards

### Performance
- [ ] **Optimized image usage** (proper sizing, compression)
- [ ] **Minimal CSS/JS bloat**
- [ ] Fast loading times across all pages
- [ ] Efficient database queries
- [ ] Proper caching implementation

## 7. Deliverables for Each Rebuilt Template

### Required Files
- [ ] **Handlebars template files for each page type**
  - `home.handlebars`
  - `about.handlebars`
  - `rates.handlebars`
  - `contact.handlebars`
  - `etiquette.handlebars`
  - `gallery.handlebars`

### Database Updates
- [ ] **Updated database schema** (if new fields added)
- [ ] Migration scripts with rollback procedures
- [ ] Schema documentation updates

### API Updates
- [ ] **Updated API GET/PUT endpoints**
- [ ] API endpoint testing results
- [ ] Updated API documentation

### Admin Interface
- [ ] **Updated admin panel forms** (if new fields added)
- [ ] Form validation updates
- [ ] Admin interface testing results

### Documentation
- [ ] **Documentation of new fields, layouts, and theme-specific features**
- [ ] Updated field naming scheme (if changes made)
- [ ] Theme-specific usage guidelines
- [ ] Installation and setup instructions

### Quality Assurance
- [ ] **QA report confirming backwards compatibility**
- [ ] Cross-browser testing results
- [ ] Performance benchmark results
- [ ] Accessibility audit results

## Pre-Launch Checklist

### Final Verification
- [ ] All items in this checklist completed
- [ ] Basic template still functions after any system changes
- [ ] New theme passes all compatibility tests
- [ ] Documentation is complete and accurate
- [ ] Performance meets established benchmarks

### Deployment Readiness
- [ ] Database migrations tested in staging environment
- [ ] Theme switching functionality verified
- [ ] Rollback procedures tested and documented
- [ ] User acceptance testing completed

### Post-Launch Monitoring
- [ ] Error monitoring in place
- [ ] Performance monitoring active
- [ ] User feedback collection method established
- [ ] Support documentation ready for users

---

## Template Rebuild Success Criteria

A template rebuild is considered successful when:

1. **100% Database Compatibility**: All fields from Basic template work identically
2. **Seamless Theme Switching**: Users can switch between themes without any data loss or functionality breaking
3. **Creative Design Achievement**: Theme successfully expresses its intended aesthetic while maintaining professional standards
4. **Performance Standards Met**: Loading times and responsiveness meet or exceed Basic template benchmarks
5. **Documentation Complete**: All changes documented and future developers can easily understand and maintain the theme

---

**Last Updated**: August 13, 2025  
**Version**: 1.0  
**Status**: Production Ready  
**Compliance Level**: Required for all theme development