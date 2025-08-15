# Basic Template Analysis & Blueprint
*Complete analysis of the Basic Template structure*

## 📁 File Structure Analysis

### Core Template Files (Basic Theme)
```
themes/basic/
├── assets/                 # Static assets (CSS, JS, images)
├── layouts/
│   └── main.handlebars    # Main layout wrapper
├── pages/                 # Individual page templates
│   ├── about.handlebars
│   ├── calendar.handlebars
│   ├── contact.handlebars
│   ├── etiquette.handlebars
│   ├── faq.handlebars
│   ├── gallery.handlebars
│   ├── home.handlebars
│   └── rates.handlebars
└── partials/              # Reusable components
    ├── footer.handlebars
    └── navigation.handlebars
```

## 📊 Database Integration Status

### Completed Pages (100% Database Integration)
- ✅ **home.handlebars** - Uses `home_content.*` system
- ✅ **about.handlebars** - Uses `about_content.*` system  
- ✅ **rates.handlebars** - Uses `rates_content.*` system
- ✅ **contact.handlebars** - Uses `contact_content.*` system
- ✅ **etiquette.handlebars** - Uses `etiquette_content.*` system
- ✅ **gallery.handlebars** - Uses `gallery_content.*` system

### Additional Pages (Status Unknown)
- ❓ **calendar.handlebars** - Needs analysis
- ❓ **faq.handlebars** - Needs analysis

## 🎯 Template Features Analysis

### Required Features (Must be preserved in all new templates)
1. **Visibility Controls**: All `*_visible` toggles must function
2. **Professional Fallbacks**: All content fields have fallback values
3. **Responsive Design**: Mobile-first, works on all screen sizes
4. **Database Field Integration**: All available fields are utilized
5. **Cross-browser Compatibility**: Works in all modern browsers

### Basic Theme Characteristics
- Clean, professional appearance
- Bootstrap-based responsive grid
- Subtle animations (AOS library)
- Professional color scheme
- Standard typography hierarchy
- Form functionality with validation
- Lightbox gallery system

## 📋 Blueprint Checklist for New Templates

When creating new templates, ensure they maintain:

### 1. Database Field Compatibility
- [ ] All `home_content.*` fields integrated
- [ ] All `about_content.*` fields integrated
- [ ] All `rates_content.*` fields integrated
- [ ] All `contact_content.*` fields integrated
- [ ] All `etiquette_content.*` fields integrated
- [ ] All `gallery_content.*` fields integrated

### 2. Visibility System
- [ ] All section visibility toggles honored
- [ ] Sections can be independently enabled/disabled
- [ ] Page renders correctly with any combination of visible/hidden sections

### 3. Fallback System
- [ ] Professional fallbacks for all user-facing content
- [ ] Template functions correctly with empty database
- [ ] No broken layouts when content is missing

### 4. Layout Structure
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Professional navigation system
- [ ] Consistent footer implementation
- [ ] Form functionality preserved

### 5. Performance Standards
- [ ] Fast loading times
- [ ] Optimized images and assets
- [ ] Minimal CSS/JS bloat
- [ ] Efficient database queries

## 🔧 Technical Implementation Notes

### Key Handlebars Patterns Used in Basic
```handlebars
<!-- Visibility Control Pattern -->
{{#if content.section_visible}}
    <section>Content</section>
{{/if}}

<!-- Fallback Content Pattern -->
{{#if content.field_name}}{{content.field_name}}{{else}}Professional Fallback{{/if}}

<!-- List Processing Pattern -->
{{#each (split content.list_field " • ")}}
    <div>{{this}}</div>
{{/each}}

<!-- Conditional Styling Pattern -->
<div class="{{#if content.style_option}}custom-style{{else}}default-style{{/if}}">
```

### CSS Framework and Libraries
- **Bootstrap 5.3**: Responsive grid and utilities
- **Tailwind CSS**: Additional utility classes  
- **AOS**: Animate On Scroll library
- **Font Awesome**: Icon system
- **Custom CSS**: Theme-specific styling

### JavaScript Functionality
- Form validation and submission
- Lightbox gallery system
- Carousel navigation
- Mobile menu toggle
- Smooth scrolling
- Animation triggers

## 🎨 Design System Reference

### Color Scheme Variables
```css
:root {
    --basic-primary: #2563eb;    /* Primary brand color */
    --basic-secondary: #64748b;  /* Secondary text color */
    --basic-accent: #f59e0b;     /* Accent color */
    --basic-bg: #f8fafc;        /* Background color */
    --basic-card: #ffffff;      /* Card background */
}
```

### Typography Scale
- **Headings**: Font weight 700, responsive sizing
- **Body**: Font weight 400, 16px base size
- **Labels**: Font weight 500, 14px size
- **Captions**: Font weight 400, 12px size

### Spacing System
- Based on 0.25rem increments (4px base)
- Consistent padding and margins
- Responsive spacing adjustments

## 🚨 Critical Elements (Do Not Change)

### Database Integration
- All field names must match exactly
- All visibility controls must be preserved
- All fallback mechanisms must function

### Core Functionality  
- Form submission and validation
- Navigation between pages
- Gallery lightbox system
- Mobile responsiveness

### Performance Requirements
- Page load times under 2 seconds
- Mobile-optimized images
- Efficient CSS and JavaScript

---

**Analysis Complete**: August 13, 2025  
**Status**: Ready for template rebuilding  
**Next Step**: Create template backups and begin new theme development