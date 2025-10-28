# phoenix4ge Template Field Naming Scheme Documentation

## Overview

This document defines the comprehensive field naming conventions and database integration patterns used throughout the phoenix4ge theme system to ensure 100% consistency between database structure and Handlebars template usage.

## Core Naming Principles

### 1. **Snake Case Convention**
- All template variables use `snake_case` formatting
- Database field names are preserved exactly as defined in MySQL schema
- NO conversion between camelCase/PascalCase and snake_case for newer page types

### 2. **Structured Content Prefixes**
Each page type uses a dedicated content namespace:
- **Home pages**: `home_content.field_name`
- **About pages**: `about_content.field_name` 
- **Rates pages**: `rates_content.field_name`
- **Contact pages**: `contact_content.field_name`
- **Etiquette pages**: `etiquette_content.field_name`
- **Gallery pages**: `gallery_content.field_name`

### 3. **Visibility Control Pattern**
All sections implement database-driven visibility:
```handlebars
{{#if page_content.section_visible}}
    <!-- Section content -->
{{/if}}
```

## Database Table Mapping

### Core Page Content Tables
| Page Type | Database Table | Template Prefix |
|-----------|---------------|----------------|
| Home | `model_home_page_content` | `home_content.` |
| About | `model_about_page_content` | `about_content.` |
| Rates | `model_rates_page_content` | `rates_content.` |
| Contact | `model_contact_page_content` | `contact_content.` |
| Etiquette | `model_etiquette_page_content` | `etiquette_content.` |
| Gallery | `model_gallery_page_content` | `gallery_content.` |

## Field Categories and Naming Patterns

### 1. **Page Structure Fields**
```handlebars
{{page_content.page_title}}           <!-- Main page title -->
{{page_content.page_subtitle}}        <!-- Page subtitle/description -->
{{page_content.page_description}}     <!-- Meta description -->
```

### 2. **Section Visibility Controls**
Pattern: `[page]_[section]_visible`
```handlebars
{{#if home_content.hero_section_visible}}
{{#if rates_content.rates_table_visible}}
{{#if contact_content.contact_form_visible}}
```

### 3. **Content Fields**
Pattern: `[section]_[content_type]`
```handlebars
{{rates_content.hero_title}}
{{about_content.portrait_image_url}}
{{contact_content.form_name_label}}
```

### 4. **Configuration Fields**
```handlebars
{{gallery_content.enable_lightbox}}
{{gallery_content.images_per_page}}
{{rates_content.rates_background_tint_visible}}
```

## Template Implementation Examples

### Complete Section Example
```handlebars
<!-- Hero Section with Full Database Integration -->
{{#if home_content.hero_section_visible}}
<section class="hero-section" 
         style="{{#if home_content.hero_background_image}}background-image: url('{{home_content.hero_background_image}}'){{/if}}">
    <div class="container">
        <h1 class="hero-title">
            {{#if home_content.hero_title}}{{home_content.hero_title}}{{else}}Welcome{{/if}}
        </h1>
        {{#if home_content.hero_subtitle}}
        <p class="hero-subtitle">{{home_content.hero_subtitle}}</p>
        {{/if}}
        {{#if home_content.hero_cta_visible}}
        <a href="{{home_content.hero_cta_link}}" class="hero-btn">
            {{#if home_content.hero_cta_text}}{{home_content.hero_cta_text}}{{else}}Learn More{{/if}}
        </a>
        {{/if}}
    </div>
</section>
{{/if}}
```

### List Processing Example
```handlebars
<!-- Split comma-separated content into individual items -->
<div class="space-y-3">
    {{#each (split rates_content.payment_terms " • ")}}
    <div class="flex items-start">
        <i class="fas fa-credit-card text-blue-600 mr-3 mt-1 flex-shrink-0"></i>
        <span class="text-gray-700">{{this}}</span>
    </div>
    {{/each}}
</div>
```

## Fallback Value Standards

### 1. **Required Fallbacks**
All user-facing content fields MUST include fallback values:
```handlebars
{{#if content.field_name}}{{content.field_name}}{{else}}Professional Fallback{{/if}}
```

### 2. **Professional Fallback Examples**
- Page titles: Use service-appropriate defaults ("Contact Me", "My Services", "About Me")
- Form labels: Use clear, standard labels ("Your Name", "Email Address")
- Button text: Use action-oriented text ("Send Message", "View Portfolio")
- Descriptions: Provide helpful placeholder content

### 3. **Empty State Handling**
```handlebars
{{#if content.optional_field}}
<div class="optional-content">{{content.optional_field}}</div>
{{/if}}
<!-- No fallback for truly optional content -->
```

## Router Implementation Pattern

### Database Loading
```javascript
} else if (pageType === 'rates') {
    // Get rates page content from model_rates_page_content table
    const [ratesRows] = await db.execute(`
        SELECT * FROM model_rates_page_content WHERE model_id = ?
    `, [modelId]);
    
    if (ratesRows.length > 0) {
        content = ratesRows[0];
    }
}
```

### Snake Case Preservation
```javascript
// Exception: Modern pages use snake_case field names directly - no conversion needed
if (page === 'etiquette' || page === 'contact' || page === 'about' || page === 'rates' || page === 'gallery') {
    Object.keys(rawContent).forEach(key => {
        pageContent[key] = rawContent[key];
    });
}
```

### Template Context Assignment
```javascript
// Pass rates content for rates page
...(page === 'rates' ? { rates_content: pageContent } : {}),
// Pass contact content for contact page
...(page === 'contact' ? { contact_content: pageContent } : {}),
```

## Validation Checklist

### ✅ **Template Audit Requirements**
For any page template, verify:

1. **100% Database Field Coverage**
   - Every database field is used in template OR
   - Unused fields are documented as intentionally excluded

2. **Case Consistency**
   - All variables use exact database field names
   - No camelCase/PascalCase inconsistencies

3. **Visibility Controls**
   - All major sections have `_visible` toggle controls
   - Sections can be independently enabled/disabled

4. **Fallback Values**
   - All user-facing content has professional fallbacks
   - Fallbacks maintain site functionality if database empty

5. **Template Variable Validation**
   - No template variables that don't map to database fields
   - No hardcoded content that should be database-driven

## Legacy System Note

**DEPRECATED**: Old `content.*` system from `content_templates` table
- Used inconsistent field naming
- Limited configurability 
- Being phased out in favor of structured page content tables

**CURRENT**: Structured `[page]_content.*` system
- Dedicated table per page type
- Comprehensive field coverage
- Database-driven visibility controls
- Professional fallback handling

## Implementation Priority

### Phase 1: ✅ **COMPLETED**
- Home page standardization (`home_content.*`)
- About page standardization (`about_content.*`)
- Rates page standardization (`rates_content.*`)
- Contact page standardization (`contact_content.*`)
- Etiquette page standardization (`etiquette_content.*`)
- Gallery page standardization (`gallery_content.*`)

### Phase 2: **Future Enhancements**
- Additional page types (Services, Portfolio, Blog)
- Enhanced gallery configurability
- Advanced theme customization options
- Multi-language content support

---

**Last Updated**: August 13, 2025
**System Version**: phoenix4ge Basic Theme v2.0
**Compliance Status**: 100% for implemented page types