# MuseNest Theme Design Guidelines

## Overview

This comprehensive guide provides complete technical specifications for designing themes in the MuseNest platform. All themes must follow these universal patterns to ensure consistency, maintainability, and proper functionality across all model sites.

**Target Audience:** Human designers and AI systems creating or modifying MuseNest themes.

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Universal Page Structure](#universal-page-structure)
3. [API Data Sources](#api-data-sources)
4. [Dynamic Elements System](#dynamic-elements-system)
5. [Page-by-Page Technical Specifications](#page-by-page-technical-specifications)
6. [Theme Implementation Requirements](#theme-implementation-requirements)
7. [Database Schemas](#database-schemas)
8. [Error Handling](#error-handling)

---

## System Architecture

### Theme Organization

```
themes/
├── [theme-name]/
│   ├── layouts/
│   │   └── main.handlebars       # Main layout wrapper
│   ├── pages/
│   │   ├── home.handlebars       # Homepage
│   │   ├── about.handlebars      # About page
│   │   ├── gallery.handlebars    # Gallery page
│   │   ├── rates.handlebars      # Rates page
│   │   ├── contact.handlebars    # Contact page
│   │   ├── etiquette.handlebars  # Etiquette page
│   │   └── calendar.handlebars   # Calendar page
│   ├── partials/
│   │   ├── navigation.handlebars # Navigation component
│   │   └── footer.handlebars     # Footer component
│   └── assets/                   # Theme-specific assets
```

### Route Structure

All model pages follow the pattern: `/{modelSlug}/{page}?preview_theme={themeId}`

- **Model Resolution:** `src/routes/model_sites.js:getModelBySlug()`
- **Theme Assignment:** Database-driven via `models.theme_set_id`
- **Preview Mode:** Optional theme override via URL parameter
- **Dynamic Colors:** Loaded from `color_palettes` and `color_palette_values` tables

---

## Universal Page Structure

### Common Template Variables

Every page receives these base variables:

```javascript
{
  // Model Information
  model: {
    id: number,
    name: string,
    slug: string,
    email: string
  },
  
  // Content (page-specific)
  content: object,
  
  // Site Information
  siteName: string,
  modelSlug: string,
  modelName: string,
  modelId: number,
  
  // Theme System
  theme: {
    name: string,           // e.g., "luxury", "basic"
    colors: object,         // Dynamic color values
    isPreview: boolean,     // Preview mode flag
    previewThemeId: number  // Preview theme ID
  },
  
  // Navigation
  navigation: [
    { name: "Home", url: string, active: boolean },
    { name: "About", url: string, active: boolean },
    // ... other pages based on publication status
  ],
  
  // Current Page Context
  currentPage: string,        // "home", "about", etc.
  siteUrl: string,           // Base URL with preview params
  previewParam: string,      // Query string for preview
  year: number              // Current year
}
```

### Dynamic Color System

All themes receive dynamic colors via CSS variables:

```css
:root {
  /* Primary Brand Colors */
  --theme-primary: #{theme.colors.primary};
  --theme-secondary: #{theme.colors.secondary};
  --theme-accent: #{theme.colors.accent};
  
  /* Background Colors */
  --theme-bg: #{theme.colors.bg};
  --theme-bg-light: #{theme.colors.bg-light};
  --theme-surface: #{theme.colors.surface};
  --theme-overlay: #{theme.colors.overlay};
  
  /* Text Colors */
  --theme-text: #{theme.colors.text};
  --theme-text-light: #{theme.colors.text-light};
  --theme-text-dark: #{theme.colors.text-dark};
  
  /* Component Colors */
  --theme-border: #{theme.colors.border};
  --theme-card-bg: #{theme.colors.card-bg};
  --theme-btn-bg: #{theme.colors.btn-bg};
  --theme-btn-text: #{theme.colors.btn-text};
}
```

---

## API Data Sources

### Data Loading Flow

1. **Model Resolution:** `/src/routes/model_sites.js` handles all page requests
2. **Content Loading:** Page-specific content loaded via `getModelContent(modelId, pageType)`
3. **Color Loading:** Dynamic colors loaded via `loadColorPalette(paletteId, themeId)`
4. **Pre-loading:** Additional data loaded for specific pages (testimonials, gallery images, calendar events)

### Database Tables by Data Type

| Data Type | Primary Table | API Endpoint | Purpose |
|-----------|---------------|--------------|---------|
| Model Info | `models` | Built into route | Basic model data |
| Home Content | `model_home_page_content` | `/api/model-home-content/:slug/home` | Homepage sections |
| About Content | `model_about_page_content` | `/api/model-about-content` | About page data |
| Gallery Data | `model_gallery_sections`, `model_gallery_section_media` | `/api/universal-gallery/config` | Gallery sections & images |
| Rates Data | `model_rates`, `model_rates_page_content` | `/api/model-rates/:slug` | Pricing information |
| Calendar Events | `calendar_availability` | `/api/model-calendar/:slug` | Availability data |
| Contact Info | `model_contact_page_content` | Server-side loading | Contact details |
| Etiquette Rules | `model_etiquette_page_content` | Server-side loading | Guidelines |
| Testimonials | `testimonials` | Pre-loaded in route | Client reviews |
| Color Schemes | `color_palettes`, `color_palette_values` | Server-side loading | Dynamic theming |

---

## Dynamic Elements System

### Always Dynamic Elements

**These elements are always dynamic and must use variables:**

1. **All Colors** - Use CSS custom properties from `theme.colors`
2. **Model Information** - Use `{{model.name}}`, `{{modelSlug}}`
3. **Navigation Links** - Use `{{previewParam}}` for preview mode
4. **Content Visibility** - Use conditional rendering with `{{#if}}`
5. **Image URLs** - Use dynamic paths with model slug

### Example Dynamic Implementation

```handlebars
<!-- CORRECT: Dynamic color usage -->
<div style="background-color: var(--theme-primary); color: var(--theme-text);">

<!-- INCORRECT: Hardcoded colors -->
<div style="background-color: #3B82F6; color: #1F2937;">

<!-- CORRECT: Dynamic navigation -->
<a href="/{{modelSlug}}/about{{previewParam}}">About</a>

<!-- INCORRECT: Static navigation -->
<a href="/modelexample/about">About</a>
```

---

## Page-by-Page Technical Specifications

## 1. HOME PAGE (`/home`)

### API Calls Made
- **Primary:** Server-side content loading via `getModelContent(modelId, 'home')`
- **Data Source:** `model_home_page_content` table
- **Pre-loaded Data:** 
  - Testimonials: `testimonials` table (featured only, limit 10)
  - Gallery Images: `gallery_images` + `content_moderation` (approved, limit 5)
  - Calendar Events: `calendar_availability` (upcoming, configurable count)

### Dynamic Elements
- **Colors:** All colors via `theme.colors` object
- **Content Visibility:** All sections controlled by `*_section_visible` flags
- **Hero Background:** `heroBackgroundImageUrl` (optional image override)
- **Button Links:** Dynamic routing with `{{previewParam}}`
- **Model Information:** `{{siteName}}`, `{{modelSlug}}`

### Hero Background Image Implementation
**CRITICAL:** Proper hero background implementation prevents visual conflicts and maintains theme aesthetics.

#### Database Fields Available:
- `heroBackgroundImageUrl` - Full URL to background image (optional)
- `hero_background_opacity` - DECIMAL(3,2) controlling image transparency (default: 0.6)

#### Implementation Pattern (REQUIRED):
```handlebars
<!-- Smart Background System -->
<section style="{{#if content.heroBackgroundImageUrl}}background: #000000;{{else}}background: linear-gradient(135deg, var(--theme-primary), var(--theme-secondary));{{/if}} min-height: 80vh; position: relative;">
    
    <!-- Parallax Background Image with Database-Controlled Opacity -->
    {{#if content.heroBackgroundImageUrl}}
    <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; 
                background-image: url('{{content.heroBackgroundImageUrl}}'); 
                background-size: cover; 
                background-position: center; 
                background-attachment: fixed; 
                opacity: {{#if content.hero_background_opacity}}{{content.hero_background_opacity}}{{else}}0.6{{/if}}; 
                z-index: 0;"></div>
    {{/if}}
    
    <!-- Content with proper z-index -->
    <div style="position: relative; z-index: 2;">
        <!-- Hero content here -->
    </div>
</section>
```

#### Key Implementation Rules:
1. **Smart Background Switching:**
   - **With Image:** Use pure black background (`#000000`) to eliminate color interference
   - **Without Image:** Use theme gradient or solid colors as normal
   - **Never:** Mix gradient backgrounds with hero images (creates "dusty" visual effects)

2. **Database-Driven Opacity:**
   - Always use `{{content.hero_background_opacity}}` instead of hardcoded values
   - Provide fallback: `{{#if content.hero_background_opacity}}{{content.hero_background_opacity}}{{else}}0.6{{/if}}`
   - Default should be 0.6 (60%) for good visibility while maintaining text readability

3. **Proper Layering:**
   - Background image: `z-index: 0`
   - Content container: `z-index: 2` (minimum)
   - Decorative elements: `z-index: 1` (optional, between background and content)

4. **Admin Control Benefits:**
   - Opacity becomes configurable through admin interface
   - No code changes needed for different image prominence levels
   - Consistent implementation across all themes

#### Common Mistakes to Avoid:
❌ **Wrong:** Hardcoded opacity values
```handlebars
<div style="opacity: 0.3; ...">  <!-- Fixed value, not admin-controllable -->
```

❌ **Wrong:** Gradient + Image backgrounds (creates muddy colors)
```handlebars
<section style="background: linear-gradient(...); ...">  <!-- Always active -->
    <div style="background-image: url(...); ...">       <!-- Creates color interference -->
```

❌ **Wrong:** Missing z-index layering
```handlebars
<div>Hero content</div>  <!-- No z-index, may be hidden behind background -->
```

✅ **Correct:** Database-driven, smart background system
```handlebars
<section style="{{#if content.heroBackgroundImageUrl}}background: #000000;{{else}}background: linear-gradient(...);{{/if}}">
    {{#if content.heroBackgroundImageUrl}}
    <div style="opacity: {{#if content.hero_background_opacity}}{{content.hero_background_opacity}}{{else}}0.6{{/if}}; z-index: 0; ...">
    {{/if}}
    <div style="position: relative; z-index: 2;">Content</div>
</section>
```

### Content Structure
```javascript
home_content: {
  // Hero Section
  hero_section_visible: boolean,
  hero_title: string,
  hero_subtitle: string,
  hero_description: string,
  hero_button_1_text: string,
  hero_button_1_link: string,
  hero_button_2_text: string,
  hero_button_2_link: string,
  heroBackgroundImageUrl: string,    // Optional - full URL to background image
  hero_background_opacity: decimal,  // Optional - 0.0 to 1.0, controls image transparency (default: 0.6)
  
  // About Preview Section
  about_section_visible: boolean,
  portrait_section_visible: boolean,
  about_title: string,
  about_paragraph_1: string,
  about_paragraph_2: string,
  about_link_text: string,
  about_link_destination: string,
  portrait_image_url: string,       // Dynamically resolved
  portrait_alt: string,
  
  // Services Section
  services_section_visible: boolean,
  services_title: string,
  services_subtitle: string,
  service_1_title: string,
  service_1_description: string,
  service_1_icon: string,
  service_2_title: string,
  service_2_description: string,
  service_2_icon: string,
  service_3_title: string,
  service_3_description: string,
  service_3_icon: string,
  
  // Gallery Preview Section
  gallery_section_visible: boolean,
  gallery_section_title: string,
  gallery_button_text: string,
  
  // Travel/Calendar Section
  travel_section_visible: boolean,
  travel_section_title: string,
  travel_display_count: number,     // Default: 3
  travel_cta_text: string,
  travel_cta_link: string,
  
  // Testimonials Section
  testimonials_section_visible: boolean,
  testimonials_section_title: string,
  testimonials_display_count: number, // Default: 3
  
  // CTA Section
  cta_section_visible: boolean,
  cta_section_title: string,
  cta_section_subtitle: string,
  cta_button_1_text: string,
  cta_button_1_link: string,
  cta_button_2_text: string,
  cta_button_2_link: string
}
```

### Additional Template Variables
```javascript
{
  testimonials: [],           // Pre-loaded testimonials
  galleryImages: [],         // Pre-loaded gallery preview images  
  upcomingEvents: []         // Pre-loaded calendar events
}
```

### Critical Template Variable Mappings

**IMPORTANT:** The server loads data with specific field names. Templates must use the correct variable names:

**Testimonials Data Structure:**
```javascript
// Server query: SELECT client_name as name, testimonial_text as text, rating, created_at
testimonials: [
  {
    name: string,        // Client name (anonymized)
    text: string,        // Testimonial content
    rating: number       // Star rating (1-5)
  }
]

// CORRECT template usage:
{{#each testimonials}}
  "{{this.text}}" - {{this.name}}
{{/each}}

// INCORRECT template usage:
{{#each testimonials}}
  "{{testimonial}}" - {{client_name}}  // These field names don't exist
{{/each}}
```

**Upcoming Events Data Structure:**
```javascript
// Server query: Calendar events for travel/location availability section
upcomingEvents: [
  {
    location: string,       // Location name (e.g., "DTC Incall", "Denver Incall")
    date: Date,            // Event date
    dateRange: string,     // Formatted date range (e.g., "August 26-29, 2025")
    notes: string          // Optional additional notes
  }
]

// CORRECT template usage:
{{#each upcomingEvents}}
  <h3>{{this.location}}</h3>
  <div>{{this.dateRange}}</div>
  {{#if this.notes}}<p>{{this.notes}}</p>{{/if}}
{{/each}}

// INCORRECT template usage:
{{#each calendar_events}}    // Wrong array name
  <h3>{{location}}</h3>      // Missing 'this.' prefix
  <div>{{date_range}}</div>  // Wrong field name
{{/each}}
```

**Gallery Images Data Structure:**
```javascript
// Server query: SELECT filename, caption
galleryImages: [
  {
    filename: string,    // Image filename only
    caption: string      // Optional caption text
  }
]

// CORRECT template usage:
{{#each galleryImages}}
  <img src="/uploads/{{../modelSlug}}/public/gallery/{{this.filename}}" 
       alt="{{#if this.caption}}{{this.caption}}{{else}}Gallery image{{/if}}">
{{/each}}

// INCORRECT template usage:
{{#each gallery_images}}         // Wrong array name
  <img src="{{this.url}}"        // Wrong field name
       alt="{{this.alt}}">       // Wrong field name
{{/each}}
```

### Database Queries
1. **Content:** `SELECT * FROM model_home_page_content WHERE model_id = ?`
2. **Testimonials:** `SELECT client_name as name, testimonial_text as text, rating FROM testimonials WHERE model_id = ? AND is_featured = 1 ORDER BY created_at DESC LIMIT 10`
3. **Gallery:** `SELECT filename, caption FROM gallery_images WHERE model_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 5`
4. **Calendar:** `SELECT location, service_type, start_date, end_date FROM calendar_availability WHERE model_id = ? AND start_date >= CURDATE() ORDER BY start_date ASC LIMIT ?`

**Note:** Services are NOT pre-loaded for home pages. Services data is only available on the rates page via separate API calls.

---

## 2. ABOUT PAGE (`/about`)

### API Calls Made
- **Primary:** Server-side content loading via `getModelContent(modelId, 'about')`
- **Data Source:** `model_about_page_content` table

### Dynamic Elements
- **Portrait Image:** `portraitImageUrl` resolved from `portrait_image_id`
- **Quick Facts:** Built from `qf_*` database fields
- **Services List:** Individual service fields with visibility controls
- **Interests Tags:** Comma-separated string split into individual tags

### Content Structure
```javascript
about_content: {
  // Page Header
  page_title_visible: boolean,
  page_title: string,
  page_subtitle: string,
  
  // Main Content
  main_content_visible: boolean,
  main_paragraph_1: string,
  main_paragraph_2: string,
  main_paragraph_3: string,
  main_paragraph_4: string,
  
  // Portrait Section
  portrait_visible: boolean,
  portrait_image_id: number,
  portraitImageUrl: string,          // Resolved dynamically from portrait_image_id
  portrait_alt: string,
  
  // Services Section
  services_visible: boolean,
  services_title: string,
  service_1: string,
  service_2: string,
  service_3: string,
  service_4: string,
  service_5: string,
  
  // Interests Section
  interests_visible: boolean,
  interests_title: string,
  interests: string,                 // Comma-separated string, split by templates
  
  // Quick Facts Section (Individual Fields)
  facts_visible: boolean,            // Also known as quick_facts_visible in templates
  facts_title: string,               // Also known as quick_facts_title in templates
  fact_age: string,
  fact_age_visible: boolean,
  fact_height: string,
  fact_height_visible: boolean,
  fact_languages: string,
  fact_languages_visible: boolean,
  fact_education: string,
  fact_education_visible: boolean,
  fact_availability: string,
  fact_availability_visible: boolean,
  
  // Quick Facts (Dynamic Array - Built from above fields during server load)
  quickFacts: [                      // Constructed from visible fact_* fields
    { 
      question: string,              // Field labels (e.g., "Age", "Height", "Languages")
      answer: string                 // Field values from fact_* database fields
    }
  ],
  
  // Custom Facts (JSON)
  custom_facts: string,              // JSON array of {question, answer} objects
  custom_facts_visible: boolean,
  
  // CTA Section
  about_cta_visible: boolean,
  cta_title: string,
  cta_description: string,
  cta_button_1_text: string,
  cta_button_1_link: string,         // Page slug (calendar, contact, rates, etc.)
  cta_button_2_text: string,
  cta_button_2_link: string
}
```

### Template Usage Examples

**Portrait Image Display:**
```handlebars
{{#if about_content.portrait_visible}}
  <img src="{{about_content.portraitImageUrl}}" 
       alt="{{#if about_content.portrait_alt}}{{about_content.portrait_alt}}{{else}}Professional Portrait{{/if}}">
{{/if}}
```

**Quick Facts Iteration (Dynamic Array):**
```handlebars
{{#if about_content.facts_visible}}
  {{#if about_content.quickFacts}}
    {{#each about_content.quickFacts}}
      <div>
        <div class="question">{{this.question}}</div>
        <div class="answer">{{this.answer}}</div>
      </div>
    {{/each}}
  {{/if}}
{{/if}}
```

**Individual Quick Facts (Raw Fields):**
```handlebars
{{#if about_content.facts_visible}}
  {{#if about_content.fact_age_visible}}
    <div>Age: {{about_content.fact_age}}</div>
  {{/if}}
  {{#if about_content.fact_height_visible}}
    <div>Height: {{about_content.fact_height}}</div>
  {{/if}}
  {{#if about_content.fact_languages_visible}}
    <div>Languages: {{about_content.fact_languages}}</div>
  {{/if}}
  {{#if about_content.fact_education_visible}}
    <div>Education: {{about_content.fact_education}}</div>
  {{/if}}
  {{#if about_content.fact_availability_visible}}
    <div>Availability: {{about_content.fact_availability}}</div>
  {{/if}}
{{/if}}
```

**Custom Facts (JSON):**
```handlebars
{{#if about_content.custom_facts_visible}}
  {{#if about_content.custom_facts}}
    {{#each (parseJSON about_content.custom_facts)}}
      <div>
        <div class="question">{{this.question}}</div>
        <div class="answer">{{this.answer}}</div>
      </div>
    {{/each}}
  {{/if}}
{{/if}}
```


**Interests Tags:**
```handlebars
{{#if about_content.interests_visible}}
  {{#if about_content.interests}}
    {{#each (split about_content.interests ',')}}
      <span class="interest-tag">{{trim this}}</span>
    {{/each}}
  {{/if}}
{{/if}}
```

**Services List:**
```handlebars
{{#if about_content.services_visible}}
  <ul>
    {{#if about_content.service_1}}<li>{{about_content.service_1}}</li>{{/if}}
    {{#if about_content.service_2}}<li>{{about_content.service_2}}</li>{{/if}}
    {{#if about_content.service_3}}<li>{{about_content.service_3}}</li>{{/if}}
    {{#if about_content.service_4}}<li>{{about_content.service_4}}</li>{{/if}}
    {{#if about_content.service_5}}<li>{{about_content.service_5}}</li>{{/if}}
  </ul>
{{/if}}
```

**CTA Buttons:**
```handlebars
{{#if about_content.about_cta_visible}}
  {{#if about_content.cta_button_1_text}}
    <a href="/{{modelSlug}}/{{#if about_content.cta_button_1_link}}{{about_content.cta_button_1_link}}{{else}}calendar{{/if}}{{previewParam}}">
      {{about_content.cta_button_1_text}}
    </a>
  {{/if}}
  {{#if about_content.cta_button_2_text}}
    <a href="/{{modelSlug}}/{{#if about_content.cta_button_2_link}}{{about_content.cta_button_2_link}}{{else}}contact{{/if}}{{previewParam}}">
      {{about_content.cta_button_2_text}}
    </a>
  {{/if}}
{{/if}}
```

### Database Queries
1. **Content:** `SELECT * FROM model_about_page_content WHERE model_id = ?`
2. **Portrait Image:** `SELECT filename FROM gallery_images WHERE id = ? AND model_id = ? AND is_active = 1`

### Server-Side Processing
The server should build the `quickFacts` array dynamically from individual fact fields:
```javascript
// Build quickFacts array from visible individual fact fields
const quickFacts = [];
if (content.fact_age_visible && content.fact_age) {
  quickFacts.push({ question: 'Age', answer: content.fact_age });
}
if (content.fact_height_visible && content.fact_height) {
  quickFacts.push({ question: 'Height', answer: content.fact_height });
}
if (content.fact_languages_visible && content.fact_languages) {
  quickFacts.push({ question: 'Languages', answer: content.fact_languages });
}
if (content.fact_education_visible && content.fact_education) {
  quickFacts.push({ question: 'Education', answer: content.fact_education });
}
if (content.fact_availability_visible && content.fact_availability) {
  quickFacts.push({ question: 'Availability', answer: content.fact_availability });
}

// Add custom facts if they exist
if (content.custom_facts_visible && content.custom_facts) {
  try {
    const customFacts = JSON.parse(content.custom_facts);
    quickFacts.push(...customFacts);
  } catch (e) {
    console.warn('Invalid custom_facts JSON:', content.custom_facts);
  }
}

content.quickFacts = quickFacts;
```

### Template Variable Aliases
Some templates may use alternate names for backward compatibility:
- `about_content.facts_visible` ↔ `about_content.quick_facts_visible`
- `about_content.facts_title` ↔ `about_content.quick_facts_title`

---

## 3. GALLERY PAGE (`/gallery`)

### API Calls Made
- **Universal Gallery System:** `{{{renderUniversalGallery modelSlug previewTheme=previewThemeId}}}`
- **Data Sources:** 
  - `model_gallery_page_content` (page settings and configuration)
  - `model_gallery_sections` (section definitions and layout)
  - `model_gallery_section_media` (image assignments to sections)
  - `model_media_library` (actual media files and metadata)

### Dynamic Elements
- **Universal Gallery Render:** Uses server-side rendering with Universal Gallery System
- **Gallery Sections:** Dynamically rendered based on selected sections
- **Layout Types:** Grid, Masonry, Carousel, Lightbox Grid
- **Image URLs:** Dynamic paths with model slug
- **Lightbox Integration:** JavaScript-based image previews
- **Theme CSS Variables:** Can be overridden per theme

### Content Structure
```javascript
// From model_gallery_page_content table
gallery_content: {
  // Page Header
  page_title: string,
  page_subtitle: string,
  page_description: string,
  gallery_header_visible: boolean,
  
  // Gallery Settings
  default_layout: string,            // 'masonry', 'grid', 'carousel'
  enable_filters: boolean,
  enable_lightbox: boolean,
  enable_fullscreen: boolean,
  show_captions: boolean,
  images_per_page: number,           // Default: 20
  
  // Navigation Settings
  show_categories: boolean,
  show_search: boolean,
  show_sort_options: boolean
}

// From Universal Gallery System (server-rendered)
gallerySections: [
  {
    id: number,
    name: string,
    slug: string,
    description: string,
    layout: string,                  // "grid", "masonry", "carousel"
    layoutSettings: {
      columns: number,
      gap: string,
      autoplay: boolean,             // For carousel
      show_dots: boolean,
      show_arrows: boolean
    },
    items: [
      {
        id: string,
        alt: string,
        caption: string,
        srcThumb: string,             // Thumbnail URL
        srcFull: string,              // Full-size URL
        width: number,
        height: number
      }
    ]
  }
]
```

### Template Implementation
All themes use the Universal Gallery System for consistent gallery functionality, with theme-specific styling:

**Basic Implementation:**
```handlebars
<!-- Universal Gallery System for Basic Theme -->
{{{renderUniversalGallery modelSlug previewTheme=previewThemeId}}}

<!-- Load Universal Gallery System CSS and JavaScript -->
<link rel="stylesheet" href="/templates/universal/gallery-styles.css">
<script src="/templates/universal/gallery-script.js"></script>

<!-- Basic Theme Gallery CSS Variables Override -->
<style>
:root {
    --gallery-primary: #2563eb;
    --gallery-primary-hover: #1d4ed8;
    --gallery-background: #ffffff;
    --gallery-border-radius: 8px;
    --gallery-grid-columns-desktop: 3;
}
</style>
```

**Custom Styling (Royal-Gem Example):**
```handlebars
<!-- Page Header with theme content -->
{{#if gallery_content.gallery_header_visible}}
<div class="theme-header">
    <h1>{{#if gallery_content.page_title}}{{gallery_content.page_title}}{{else}}Default Title{{/if}}</h1>
    {{#if gallery_content.page_subtitle}}<p>{{gallery_content.page_subtitle}}</p>{{/if}}
</div>
{{/if}}

<!-- Universal Gallery System -->
<div class="theme-gallery-wrapper">
    {{{renderUniversalGallery modelSlug previewTheme=previewThemeId}}}
</div>

<!-- Theme-specific CSS overrides -->
<style>
:root {
    --gallery-primary: var(--theme-primary, #d4af37);
    --gallery-accent: var(--theme-accent, #ffd700);
    /* ... other theme variables */
}

/* Override Universal Gallery styles */
.universal-gallery-section {
    background: var(--theme-surface) !important;
    border: 1px solid var(--theme-border) !important;
}
</style>
```

### Required Elements
1. **Universal Gallery Call:** `{{{renderUniversalGallery modelSlug previewTheme=previewThemeId}}}`
2. **CSS Include:** `<link rel="stylesheet" href="/templates/universal/gallery-styles.css">`
3. **JS Include:** `<script src="/templates/universal/gallery-script.js"></script>`
4. **Theme Variables:** CSS custom properties for gallery styling
5. **Optional:** Page header using `gallery_content.*` variables

### Database Queries
1. **Content:** `SELECT * FROM model_gallery_page_content WHERE model_id = ?`
2. **Gallery Sections:** `SELECT * FROM model_gallery_sections WHERE model_id = ?`
3. **Section Media:** `SELECT * FROM model_gallery_section_media WHERE section_id IN (?)`
4. **Media Files:** `SELECT * FROM model_media_library WHERE id IN (?)`

---

## 4. RATES PAGE (`/rates`)

### API Calls Made
- **Primary:** Server-side content loading via `getModelContent(modelId, 'rates')`
- **Data Sources:**
  - `model_rates_page_content` (page configuration)
  - `rates` (service rates data - incall, outcall, extended)
  - `donations` (donation/investment information)
  - `additional_services` (extra services and fees)

### Dynamic Elements
- **Sticky Navigation:** Auto-generated from visible sections
- **Rates Tables:** Dynamic rendering based on rates data
- **Section Visibility:** Each section can be toggled on/off
- **Mobile Responsive:** Horizontal scrollable navigation tabs

### Content Structure
```javascript
rates_content: {
  // Page Header
  page_title: string,
  page_subtitle: string,
  rates_header_visible: boolean,
  hero_divider_visible: boolean,
  hero_divider_type: string,         // 'line' or 'icon'
  hero_divider_icon: string,         // CSS class for icon
  
  // Navigation Labels
  nav_rates_label: string,
  nav_extended_label: string,
  nav_services_label: string,
  nav_policies_label: string,
  nav_payment_label: string,
  nav_contact_label: string,
  
  // Rates Table Section
  rates_table_visible: boolean,
  table_title: string,
  table_description: string,
  show_service_name_column: boolean,
  show_duration_column: boolean,
  show_price_column: boolean,
  
  // Service Type Sections
  rates_incall_visible: boolean,
  incall_show_service_name: boolean,
  incall_show_duration: boolean,
  incall_show_price: boolean,
  
  rates_outcall_visible: boolean,
  outcall_show_service_name: boolean,
  outcall_show_duration: boolean,
  outcall_show_price: boolean,
  
  rates_extended_visible: boolean,
  extended_show_service_name: boolean,
  extended_show_duration: boolean,
  extended_show_price: boolean,
  
  // Additional Sections
  donations_visible: boolean,
  donation_title: string,
  donation_description: string,
  
  rates_payment_visible: boolean,
  rates_additional_visible: boolean,
  terms_visible: boolean,
  terms_title: string,
  terms_content: string,
  
  // CTA Section
  cta_visible: boolean,
  cta_title: string,
  cta_description: string,
  cta_button_1_text: string,
  cta_button_1_link: string,
  cta_button_2_text: string,
  cta_button_2_link: string
}

// Pre-loaded Rates Data
rates: {
  incall: [
    {
      service_name: string,
      duration: string,
      price: string,
      description: string
    }
  ],
  outcall: [...],
  extended: [...]
}

// Additional Services Data
additionalServices: [
  {
    service_name: string,
    price: string,
    description: string
  }
]

// Donations/Investment Information
donations: [
  {
    category: string,
    amount: string,
    description: string
  }
]
```

### Template Usage Examples

**Sticky Navigation with Auto-generated Links:**
```handlebars
<!-- Sticky Navigation -->
<div id="sticky-nav" class="nav-sticky">
  <nav>
    {{#if rates_content.rates_table_visible}}
      <a href="#rates-section" data-section="rates-section">{{#if rates_content.nav_rates_label}}{{rates_content.nav_rates_label}}{{else}}Rates{{/if}}</a>
    {{/if}}
    {{#if rates.extended.length}}
      <a href="#extended-section" data-section="extended-section">{{#if rates_content.nav_extended_label}}{{rates_content.nav_extended_label}}{{else}}Extended{{/if}}</a>
    {{/if}}
    {{#if rates_content.rates_additional_visible}}
      <a href="#services-section" data-section="services-section">{{#if rates_content.nav_services_label}}{{rates_content.nav_services_label}}{{else}}Services{{/if}}</a>
    {{/if}}
    {{#if rates_content.terms_visible}}
      <a href="#policies-section" data-section="policies-section">{{#if rates_content.nav_policies_label}}{{rates_content.nav_policies_label}}{{else}}Policies{{/if}}</a>
    {{/if}}
    {{#if rates_content.rates_payment_visible}}
      <a href="#payment-section" data-section="payment-section">{{#if rates_content.nav_payment_label}}{{rates_content.nav_payment_label}}{{else}}Payment{{/if}}</a>
    {{/if}}
    {{#if rates_content.cta_visible}}
      <a href="#contact-section" data-section="contact-section">{{#if rates_content.nav_contact_label}}{{rates_content.nav_contact_label}}{{else}}Contact{{/if}}</a>
    {{/if}}
  </nav>
</div>
```

**Service Rates Tables (Incall, Outcall, Extended):**
```handlebars
{{#if rates_content.rates_table_visible}}
<section id="rates-section">
  <h2>{{#if rates_content.table_title}}{{rates_content.table_title}}{{else}}Service Rates{{/if}}</h2>
  {{#if rates_content.table_description}}<p>{{rates_content.table_description}}</p>{{/if}}
  
  <!-- Incall Services -->
  {{#if rates_content.rates_incall_visible}}
    {{#if rates.incall.length}}
    <div class="rates-subsection">
      <h3>Incall Services</h3>
      <div class="rates-table">
        {{#each rates.incall}}
          <div class="rate-item">
            {{#if ../rates_content.incall_show_service_name}}<div class="service-name">{{this.service_name}}</div>{{/if}}
            {{#if ../rates_content.incall_show_duration}}<div class="duration">{{this.duration}}</div>{{/if}}
            {{#if ../rates_content.incall_show_price}}<div class="price">{{this.price}}</div>{{/if}}
            {{#if this.description}}<div class="description">{{this.description}}</div>{{/if}}
          </div>
        {{/each}}
      </div>
    </div>
    {{/if}}
  {{/if}}
  
  <!-- Outcall Services -->
  {{#if rates_content.rates_outcall_visible}}
    {{#if rates.outcall.length}}
    <div class="rates-subsection">
      <h3>Outcall Services</h3>
      <div class="rates-table">
        {{#each rates.outcall}}
          <div class="rate-item">
            {{#if ../rates_content.outcall_show_service_name}}<div class="service-name">{{this.service_name}}</div>{{/if}}
            {{#if ../rates_content.outcall_show_duration}}<div class="duration">{{this.duration}}</div>{{/if}}
            {{#if ../rates_content.outcall_show_price}}<div class="price">{{this.price}}</div>{{/if}}
            {{#if this.description}}<div class="description">{{this.description}}</div>{{/if}}
          </div>
        {{/each}}
      </div>
    </div>
    {{/if}}
  {{/if}}
  
  <!-- Extended Services -->
  {{#if rates_content.rates_extended_visible}}
    {{#if rates.extended.length}}
    <div class="rates-subsection">
      <h3>{{#if rates_content.nav_extended_label}}{{rates_content.nav_extended_label}}{{else}}Extended Services{{/if}}</h3>
      <div class="rates-table">
        {{#each rates.extended}}
          <div class="rate-item">
            {{#if ../rates_content.extended_show_service_name}}<div class="service-name">{{this.service_name}}</div>{{/if}}
            {{#if ../rates_content.extended_show_duration}}<div class="duration">{{this.duration}}</div>{{/if}}
            {{#if ../rates_content.extended_show_price}}<div class="price">{{this.price}}</div>{{/if}}
            {{#if this.description}}<div class="description">{{this.description}}</div>{{/if}}
          </div>
        {{/each}}
      </div>
    </div>
    {{/if}}
  {{/if}}
</section>
{{/if}}
```

**Additional Services Section:**
```handlebars
{{#if rates_content.rates_additional_visible}}
  {{#if additionalServices.length}}
  <section id="services-section">
    <h2>Additional Services</h2>
    <div class="additional-services">
      {{#each additionalServices}}
        <div class="service-item">
          <div class="service-name">{{this.service_name}}</div>
          <div class="service-price">{{this.price}}</div>
          {{#if this.description}}<div class="service-description">{{this.description}}</div>{{/if}}
        </div>
      {{/each}}
    </div>
  </section>
  {{/if}}
{{/if}}
```

**Terms & Policies Section:**
```handlebars
{{#if rates_content.terms_visible}}
<section id="policies-section">
  <h2>{{#if rates_content.terms_title}}{{rates_content.terms_title}}{{else}}Terms & Policies{{/if}}</h2>
  {{#if rates_content.terms_content}}
    <div class="terms-content">
      {{{rates_content.terms_content}}}
    </div>
  {{/if}}
</section>
{{/if}}
```

**JavaScript for Sticky Navigation:**
```javascript
// Sticky navigation with IntersectionObserver
document.addEventListener('DOMContentLoaded', function() {
  const stickyNav = document.getElementById('sticky-nav');
  const sections = document.querySelectorAll('section[id]');
  const navLinks = stickyNav.querySelectorAll('a[data-section]');

  // IntersectionObserver for active link highlighting
  const observerOptions = {
    root: null,
    rootMargin: '-20% 0px -80% 0px',
    threshold: 0
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const activeLink = stickyNav.querySelector(`a[data-section="${entry.target.id}"]`);
        navLinks.forEach(link => link.classList.remove('active'));
        if (activeLink) activeLink.classList.add('active');
      }
    });
  }, observerOptions);

  sections.forEach(section => observer.observe(section));

  // Smooth scrolling for navigation links
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('data-section');
      const targetSection = document.getElementById(targetId);
      if (targetSection) {
        targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
});
```

### Database Queries
1. **Content:** `SELECT * FROM model_rates_page_content WHERE model_id = ?`
2. **Rates:** `SELECT * FROM rates WHERE model_id = ? ORDER BY service_type, sort_order`
3. **Additional Services:** `SELECT * FROM additional_services WHERE model_id = ? AND is_active = 1`
4. **Donations:** `SELECT * FROM donations WHERE model_id = ? AND is_active = 1`

---

## 5. ETIQUETTE PAGE (`/etiquette`)

### API Calls Made
- **Primary:** Server-side content loading via `getModelContent(modelId, 'etiquette')`
- **Data Source:** `model_etiquette_page_content` table

### Dynamic Elements
- **2x2 Grid Layout:** Four main sections in responsive grid with comprehensive subsections
- **Section Visibility Controls:** Each major section can be hidden/shown via `*_visible` flags
- **Detailed Subsections:** Each section has 3 detailed subsections with individual titles and content
- **Full-Width Safety Section:** Special section spanning full width with 3-column layout
- **CTA Section:** Questions and contact integration with preview parameter support

### Content Structure
```javascript
etiquette_content: {
  // Page Header
  page_title: string,
  page_subtitle: string,
  etiquette_header_visible: boolean,
  
  // Booking & Screening Section
  etiquette_booking_visible: boolean,
  booking_title: string,
  booking_initial_contact_title: string,
  booking_initial_contact_text: string,
  booking_screening_title: string,
  booking_screening_text: string,
  booking_advance_title: string,
  booking_advance_text: string,
  
  // Respect & Boundaries Section
  etiquette_respect_visible: boolean,
  respect_title: string,
  respect_mutual_title: string,
  respect_mutual_text: string,
  respect_boundaries_title: string,
  respect_boundaries_text: string,
  respect_personal_title: string,
  respect_personal_text: string,
  
  // Hygiene & Presentation Section
  etiquette_hygiene_visible: boolean,
  hygiene_title: string,
  hygiene_personal_title: string,
  hygiene_personal_text: string,
  hygiene_attire_title: string,
  hygiene_attire_text: string,
  hygiene_substances_title: string,
  hygiene_substances_text: string,
  
  // Cancellation Policy Section
  etiquette_cancellation_visible: boolean,
  cancellation_title: string,
  cancellation_advance_title: string,
  cancellation_advance_text: string,
  cancellation_noshow_title: string,
  cancellation_noshow_text: string,
  cancellation_my_title: string,
  cancellation_my_text: string,
  
  // Safety & Discretion Section (Full Width)
  etiquette_safety_visible: boolean,
  safety_title: string,
  safety_confidentiality_title: string,
  safety_confidentiality_text: string,
  safety_environment_title: string,
  safety_environment_text: string,
  safety_communication_title: string,
  safety_communication_text: string,
  
  // Questions/Contact CTA Section
  etiquette_questions_visible: boolean,
  questions_title: string,
  questions_text: string,
  questions_button_text: string,
  questions_button_link: string
}
```

### Template Usage Examples

**2x2 Grid Layout with Comprehensive Subsections:**
```handlebars
<!-- 2x2 Grid Layout -->
<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(500px, 1fr)); gap: 2rem; margin-bottom: 3rem;">
  
  <!-- Booking & Screening -->
  {{#if etiquette_content.etiquette_booking_visible}}
  <div class="section-card">
    <h2>{{#if etiquette_content.booking_title}}{{etiquette_content.booking_title}}{{else}}Booking & Screening{{/if}}</h2>
    
    <div>
      <h3>{{#if etiquette_content.booking_initial_contact_title}}{{etiquette_content.booking_initial_contact_title}}{{else}}Initial Contact{{/if}}</h3>
      <p>{{#if etiquette_content.booking_initial_contact_text}}{{etiquette_content.booking_initial_contact_text}}{{else}}Please introduce yourself politely and include your desired date, time, and duration when reaching out.{{/if}}</p>
    </div>
    
    <div>
      <h3>{{#if etiquette_content.booking_screening_title}}{{etiquette_content.booking_screening_title}}{{else}}Screening Process{{/if}}</h3>
      <p>{{#if etiquette_content.booking_screening_text}}{{etiquette_content.booking_screening_text}}{{else}}For everyone's safety, a brief screening process is required for all new clients.{{/if}}</p>
    </div>
    
    <div>
      <h3>{{#if etiquette_content.booking_advance_title}}{{etiquette_content.booking_advance_title}}{{else}}Advance Booking{{/if}}</h3>
      <p>{{#if etiquette_content.booking_advance_text}}{{etiquette_content.booking_advance_text}}{{else}}I prefer bookings made at least 24 hours in advance.{{/if}}</p>
    </div>
  </div>
  {{/if}}
  
  <!-- Respect & Boundaries -->
  {{#if etiquette_content.etiquette_respect_visible}}
  <div class="section-card">
    <h2>{{#if etiquette_content.respect_title}}{{etiquette_content.respect_title}}{{else}}Respect & Boundaries{{/if}}</h2>
    
    <div>
      <h3>{{#if etiquette_content.respect_mutual_title}}{{etiquette_content.respect_mutual_title}}{{else}}Mutual Respect{{/if}}</h3>
      <p>{{#if etiquette_content.respect_mutual_text}}{{etiquette_content.respect_mutual_text}}{{else}}I treat all clients with respect and kindness, and I expect the same in return.{{/if}}</p>
    </div>
    
    <div>
      <h3>{{#if etiquette_content.respect_boundaries_title}}{{etiquette_content.respect_boundaries_title}}{{else}}Professional Boundaries{{/if}}</h3>
      <p>{{#if etiquette_content.respect_boundaries_text}}{{etiquette_content.respect_boundaries_text}}{{else}}Our time together is for companionship and social interaction.{{/if}}</p>
    </div>
    
    <div>
      <h3>{{#if etiquette_content.respect_personal_title}}{{etiquette_content.respect_personal_title}}{{else}}Personal Information{{/if}}</h3>
      <p>{{#if etiquette_content.respect_personal_text}}{{etiquette_content.respect_personal_text}}{{else}}Please do not ask for personal information beyond what is shared publicly.{{/if}}</p>
    </div>
  </div>
  {{/if}}
  
  <!-- Hygiene & Presentation -->
  {{#if etiquette_content.etiquette_hygiene_visible}}
  <div class="section-card">
    <h2>{{#if etiquette_content.hygiene_title}}{{etiquette_content.hygiene_title}}{{else}}Hygiene & Presentation{{/if}}</h2>
    
    <div>
      <h3>{{#if etiquette_content.hygiene_personal_title}}{{etiquette_content.hygiene_personal_title}}{{else}}Personal Hygiene{{/if}}</h3>
      <p>{{#if etiquette_content.hygiene_personal_text}}{{etiquette_content.hygiene_personal_text}}{{else}}Please arrive freshly showered and well-groomed.{{/if}}</p>
    </div>
    
    <div>
      <h3>{{#if etiquette_content.hygiene_attire_title}}{{etiquette_content.hygiene_attire_title}}{{else}}Attire{{/if}}</h3>
      <p>{{#if etiquette_content.hygiene_attire_text}}{{etiquette_content.hygiene_attire_text}}{{else}}Dress appropriately for our planned activities.{{/if}}</p>
    </div>
    
    <div>
      <h3>{{#if etiquette_content.hygiene_substances_title}}{{etiquette_content.hygiene_substances_title}}{{else}}Substances{{/if}}</h3>
      <p>{{#if etiquette_content.hygiene_substances_text}}{{etiquette_content.hygiene_substances_text}}{{else}}Please do not arrive under the influence of alcohol or other substances.{{/if}}</p>
    </div>
  </div>
  {{/if}}
  
  <!-- Cancellation Policy -->
  {{#if etiquette_content.etiquette_cancellation_visible}}
  <div class="section-card">
    <h2>{{#if etiquette_content.cancellation_title}}{{etiquette_content.cancellation_title}}{{else}}Cancellation Policy{{/if}}</h2>
    
    <div>
      <h3>{{#if etiquette_content.cancellation_advance_title}}{{etiquette_content.cancellation_advance_title}}{{else}}Advance Notice{{/if}}</h3>
      <p>{{#if etiquette_content.cancellation_advance_text}}{{etiquette_content.cancellation_advance_text}}{{else}}Please provide at least 2 hours notice for cancellations.{{/if}}</p>
    </div>
    
    <div>
      <h3>{{#if etiquette_content.cancellation_noshow_title}}{{etiquette_content.cancellation_noshow_title}}{{else}}No-Shows{{/if}}</h3>
      <p>{{#if etiquette_content.cancellation_noshow_text}}{{etiquette_content.cancellation_noshow_text}}{{else}}No-shows without notice will result in being blacklisted from future bookings.{{/if}}</p>
    </div>
    
    <div>
      <h3>{{#if etiquette_content.cancellation_my_title}}{{etiquette_content.cancellation_my_title}}{{else}}My Cancellations{{/if}}</h3>
      <p>{{#if etiquette_content.cancellation_my_text}}{{etiquette_content.cancellation_my_text}}{{else}}In the rare event I need to cancel, I'll provide as much notice as possible.{{/if}}</p>
    </div>
  </div>
  {{/if}}
</div>
```

**Full-Width Safety & Discretion Section:**
```handlebars
<!-- Safety & Discretion (Full Width) -->
{{#if etiquette_content.etiquette_safety_visible}}
<div class="safety-section full-width">
  <h2>{{#if etiquette_content.safety_title}}{{etiquette_content.safety_title}}{{else}}Safety & Discretion{{/if}}</h2>
  
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 2rem;">
    <div class="safety-item">
      <h3>{{#if etiquette_content.safety_confidentiality_title}}{{etiquette_content.safety_confidentiality_title}}{{else}}Confidentiality{{/if}}</h3>
      <p>{{#if etiquette_content.safety_confidentiality_text}}{{etiquette_content.safety_confidentiality_text}}{{else}}Your privacy is paramount. All interactions remain strictly confidential.{{/if}}</p>
    </div>
    
    <div class="safety-item">
      <h3>{{#if etiquette_content.safety_environment_title}}{{etiquette_content.safety_environment_title}}{{else}}Safe Environment{{/if}}</h3>
      <p>{{#if etiquette_content.safety_environment_text}}{{etiquette_content.safety_environment_text}}{{else}}I maintain a safe, clean, and welcoming environment for all meetings.{{/if}}</p>
    </div>
    
    <div class="safety-item">
      <h3>{{#if etiquette_content.safety_communication_title}}{{etiquette_content.safety_communication_title}}{{else}}Professional Communication{{/if}}</h3>
      <p>{{#if etiquette_content.safety_communication_text}}{{etiquette_content.safety_communication_text}}{{else}}All communications are handled professionally and discreetly.{{/if}}</p>
    </div>
  </div>
</div>
{{/if}}
```

**Questions/Contact CTA Section:**
```handlebars
{{#if etiquette_content.etiquette_questions_visible}}
<section class="cta-section">
  <h2>{{#if etiquette_content.questions_title}}{{etiquette_content.questions_title}}{{else}}Questions About Etiquette?{{/if}}</h2>
  <p>{{#if etiquette_content.questions_text}}{{etiquette_content.questions_text}}{{else}}If you have any questions about these guidelines or need clarification on any policies, please don't hesitate to reach out.{{/if}}</p>
  <a href="/{{modelSlug}}/{{#if etiquette_content.questions_button_link}}{{etiquette_content.questions_button_link}}{{else}}contact{{/if}}{{previewParam}}">
    {{#if etiquette_content.questions_button_text}}{{etiquette_content.questions_button_text}}{{else}}Contact Me{{/if}}
  </a>
</section>
{{/if}}
```

### Database Queries
1. **Content:** `SELECT * FROM model_etiquette_page_content WHERE model_id = ?`

---

## 6. CONTACT PAGE (`/contact`)

### API Calls Made
- **Primary:** Server-side content loading via `getModelContent(modelId, 'contact')`
- **Data Source:** `model_contact_page_content` table
- **Form Processing:** POST to `/api/contact` or model-specific contact endpoint

### Dynamic Elements
- **Contact Form:** Multi-field form with validation
- **Conditional Sections:** Each major section can be hidden/shown
- **Form Field Labels:** Customizable labels and placeholders
- **Guidelines & Location:** Informational sections about contact process

### Content Structure
```javascript
contact_content: {
  // Page Header
  page_title: string,
  page_subtitle: string,
  page_subtext: string,
  contact_header_visible: boolean,
  
  // Contact Form Section
  contact_form_visible: boolean,
  form_title: string,
  form_name_label: string,
  form_email_label: string,
  form_phone_label: string,
  form_date_label: string,
  form_duration_label: string,
  form_duration_options: string,         // JSON array of duration options
  form_message_label: string,
  form_message_placeholder: string,
  form_button_text: string,
  form_destination_email: string,
  
  // Direct Contact Section
  contact_direct_visible: boolean,
  direct_title: string,
  direct_email_label: string,
  direct_phone_label: string,
  direct_response_label: string,
  direct_response_text: string,
  
  // Guidelines Section
  contact_guidelines_visible: boolean,
  guidelines_title: string,
  guideline_1: string,
  guideline_2: string,
  guideline_3: string,
  guideline_4: string,
  guideline_5: string,
  
  // Location Section
  contact_location_visible: boolean,
  location_title: string,
  location_area_text: string,
  location_services_text: string,
  location_travel_text: string,
  
  // Privacy Section
  contact_privacy_visible: boolean,
  privacy_title: string,
  privacy_text: string
}
```

### Template Usage Examples

**Contact Form:**
```handlebars
{{#if contact_content.contact_form_visible}}
<div class="contact-form-section">
  <h2>{{#if contact_content.form_title}}{{contact_content.form_title}}{{else}}Send a Message{{/if}}</h2>
  
  <form method="POST" id="contactForm">
    <!-- Honeypot field for spam prevention -->
    <input type="text" name="website" style="display: none;" tabindex="-1" autocomplete="off">
    
    <div>
      <label for="name">{{#if contact_content.form_name_label}}{{contact_content.form_name_label}}{{else}}Your Name{{/if}}*</label>
      <input type="text" id="name" name="name" required>
    </div>
    
    <div>
      <label for="email">{{#if contact_content.form_email_label}}{{contact_content.form_email_label}}{{else}}Email Address{{/if}}*</label>
      <input type="email" id="email" name="email" required>
    </div>
    
    <div>
      <label for="duration">{{#if contact_content.form_duration_label}}{{contact_content.form_duration_label}}{{else}}Duration{{/if}}</label>
      <select id="duration" name="duration">
        {{#if contact_content.form_duration_options}}
          {{#each (parseJSON contact_content.form_duration_options)}}
            <option value="{{this.value}}">{{this.label}}</option>
          {{/each}}
        {{else}}
          <option value="1">1 Hour</option>
          <option value="2">2 Hours</option>
          <option value="4">4 Hours</option>
        {{/if}}
      </select>
    </div>
    
    <div>
      <label for="message">{{#if contact_content.form_message_label}}{{contact_content.form_message_label}}{{else}}Message{{/if}}*</label>
      <textarea id="message" name="message" required 
                placeholder="{{#if contact_content.form_message_placeholder}}{{contact_content.form_message_placeholder}}{{else}}Please tell me about yourself and what you're looking for...{{/if}}"></textarea>
    </div>
    
    <button type="submit">{{#if contact_content.form_button_text}}{{contact_content.form_button_text}}{{else}}Send Message{{/if}}</button>
  </form>
</div>
{{/if}}
```

**Direct Contact Information:**
```handlebars
{{#if contact_content.contact_direct_visible}}
<div class="direct-contact-section">
  <h2>{{#if contact_content.direct_title}}{{contact_content.direct_title}}{{else}}Direct Contact{{/if}}</h2>
  
  <div>
    <strong>{{#if contact_content.direct_email_label}}{{contact_content.direct_email_label}}{{else}}Email{{/if}}:</strong>
    <a href="mailto:{{modelEmail}}">{{modelEmail}}</a>
  </div>
  
  {{#if modelPhone}}
  <div>
    <strong>{{#if contact_content.direct_phone_label}}{{contact_content.direct_phone_label}}{{else}}Phone{{/if}}:</strong>
    <a href="tel:{{modelPhone}}">{{modelPhone}}</a>
  </div>
  {{/if}}
  
  <p><strong>{{#if contact_content.direct_response_label}}{{contact_content.direct_response_label}}{{else}}Response Time{{/if}}:</strong> {{#if contact_content.direct_response_text}}{{contact_content.direct_response_text}}{{else}}Within 24 hours{{/if}}</p>
</div>
{{/if}}
```

**Guidelines Section:**
```handlebars
{{#if contact_content.contact_guidelines_visible}}
<div class="guidelines-section">
  <h3>{{#if contact_content.guidelines_title}}{{contact_content.guidelines_title}}{{else}}Contact Guidelines{{/if}}</h3>
  <ul>
    {{#if contact_content.guideline_1}}<li>{{contact_content.guideline_1}}</li>{{/if}}
    {{#if contact_content.guideline_2}}<li>{{contact_content.guideline_2}}</li>{{/if}}
    {{#if contact_content.guideline_3}}<li>{{contact_content.guideline_3}}</li>{{/if}}
    {{#if contact_content.guideline_4}}<li>{{contact_content.guideline_4}}</li>{{/if}}
    {{#if contact_content.guideline_5}}<li>{{contact_content.guideline_5}}</li>{{/if}}
  </ul>
</div>
{{/if}}
```

### Database Queries
1. **Content:** `SELECT * FROM model_contact_page_content WHERE model_id = ?`
2. **Model Info:** `SELECT email, phone FROM models WHERE id = ?`

---

## 7. CALENDAR PAGE (`/calendar`)

### API Calls Made
- **Primary:** Server-side content loading via `getModelContent(modelId, 'calendar')`
- **Calendar Data:** `/api/model-calendar/:slug?year=YYYY&month=MM` for availability data
- **Data Sources:**
  - `calendar_availability` (event data)
  - `model_calendar_page_content` (page configuration - if exists)

### Dynamic Elements
- **Interactive Calendar:** JavaScript-powered monthly grid view with full navigation
- **Dual View Modes:** List view (mobile) and month view (desktop) with responsive switching
- **Calendar Navigation:** Previous/Next month navigation with keyboard support
- **Event Display:** Color-coded availability spans with location information
- **Event Rendering:** Complex span positioning algorithm for multi-day events
- **Mobile Responsive:** Automatic view switching based on screen size
- **Loading States:** Professional loading indicators and error handling
- **Legend System:** Color-coded status indicators (Available, Travel, Vacation, Unavailable)

### Content Structure
```javascript
// Calendar page uses minimal content structure for headers
// Most functionality is JavaScript-driven with API data
calendar_content: {
  // Page Header
  page_title: string,              // Default: "My Calendar"  
  page_subtitle: string,           // Default: "View my current location and availability..."
  
  // Calendar Settings (if model_calendar_page_content exists)
  default_view: string,            // 'month' or 'list'
  show_past_events: boolean,
  event_limit_per_day: number,
  enable_booking: boolean          // Future feature
}

// Calendar API Response Structure (from /api/model-calendar/:slug)
{
  success: boolean,
  data: {
    calendar: {
      year: number,
      month: number,                 // 1-12
      monthName: string,             // "January", "February", etc.
      weeks: [
        {
          days: [number],            // Array of 7 numbers (0 for empty cells, 1-31 for days)
          spans: [
            {
              start_day: number,     // Starting day of the month
              start_pos: number,     // Starting position (0-6, Sunday=0)
              width: number,         // Width in days (1-7)
              duration: number,      // Duration in days
              location: string,      // Location name (e.g., "Denver Incall")
              status: string,        // "available", "travel", "vacation", "unavailable"
              color: string          // Hex color override (optional)
            }
          ]
        }
      ]
    }
  }
}
```

### Template Implementation
The Calendar page requires comprehensive JavaScript implementation with API integration:

**Page Structure:**
```handlebars
<!-- Calendar Page Header -->
<div class="page-header">
  <h1>{{#if calendar_content.page_title}}{{calendar_content.page_title}}{{else}}My Calendar{{/if}}</h1>
  <p>{{#if calendar_content.page_subtitle}}{{calendar_content.page_subtitle}}{{else}}View my current location and availability. Check where I'm traveling and when I'm available for appointments.{{/if}}</p>
</div>

<!-- View Toggle (Mobile Only) -->
<div class="view-toggle md:hidden">
  <button id="list-view-btn" class="active">List</button>
  <button id="month-view-btn">Month</button>
</div>

<!-- Calendar Navigation -->
<div class="calendar-nav">
  <button id="prev-month">← Previous</button>
  <h2 id="month-title"></h2>
  <button id="next-month">Next →</button>
</div>

<!-- Calendar Grid (Desktop) -->
<div id="calendar-container">
  <!-- Calendar Header -->
  <div class="calendar-header">
    <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
  </div>
  <!-- Calendar Body (Generated by JavaScript) -->
  <div id="calendar-grid">
    <div class="loading-state">Loading calendar...</div>
  </div>
</div>

<!-- List View (Mobile) -->
<div id="list-container" class="hidden">
  <div id="list-view">
    <div class="loading-state">Loading events...</div>
  </div>
</div>

<!-- Event Legend -->
<div class="calendar-legend">
  <div class="legend-item"><span class="color available"></span>Available</div>
  <div class="legend-item"><span class="color travel"></span>Travel</div>
  <div class="legend-item"><span class="color vacation"></span>Vacation</div>
  <div class="legend-item"><span class="color unavailable"></span>Unavailable</div>
</div>

<!-- Contact CTA -->
<div class="contact-cta">
  <a href="/{{modelSlug}}/contact{{previewParam}}">Contact Me</a>
</div>
```

**Required JavaScript Implementation:**
```javascript
(function() {
    const slug = {{{json modelSlug}}};
    let currentYear = new Date().getFullYear();
    let currentMonth = new Date().getMonth() + 1;
    
    // Core calendar loading function
    async function loadCalendar(year = currentYear, month = currentMonth) {
        try {
            const response = await fetch(`/api/model-calendar/${slug}?year=${year}&month=${month}`);
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to load calendar');
            }
            
            const calendar = data.data.calendar;
            currentYear = year;
            currentMonth = month;
            
            // Update month title
            monthTitle.textContent = `${calendar.monthName} ${calendar.year}`;
            
            // Generate calendar grid with spans
            generateCalendarGrid(calendar);
            generateListView(calendar);
            
        } catch (error) {
            console.error('Error loading calendar:', error);
            showErrorState();
        }
    }
    
    // Complex grid generation with event spans
    function generateCalendarGrid(calendar) {
        let gridHtml = '';
        
        calendar.weeks.forEach((week, weekIndex) => {
            gridHtml += `<div class="calendar-week">`;
            
            // Generate day cells
            week.days.forEach((day, dayIndex) => {
                const isToday = day === new Date().getDate() && 
                              currentMonth === (new Date().getMonth() + 1) && 
                              currentYear === new Date().getFullYear();
                
                gridHtml += `
                    <div class="calendar-day ${day === 0 ? 'empty' : ''} ${isToday ? 'today' : ''}">
                        ${day > 0 ? `<div class="day-number">${day}</div>` : ''}
                    </div>
                `;
            });
            
            // Generate availability spans positioned absolutely
            week.spans.forEach((span, spanIndex) => {
                const eventColors = {
                    'available': '#10b981',
                    'travel': '#3b82f6',
                    'vacation': '#f59e0b',
                    'unavailable': '#6b7280'
                };
                
                const bgColor = eventColors[span.status] || span.color;
                
                gridHtml += `
                    <div class="event-span" style="
                        background-color: ${bgColor};
                        left: ${span.start_pos * 14.285714}%; 
                        width: ${span.width * 14.285714}%;
                        top: ${32 + (spanIndex * 28)}px; 
                        height: 24px;">
                        <span>${span.location}</span>
                    </div>
                `;
            });
            
            gridHtml += '</div>';
        });
        
        calendarGrid.innerHTML = gridHtml;
    }
    
    // Navigation event listeners
    prevButton.addEventListener('click', () => {
        if (currentMonth === 1) {
            currentMonth = 12;
            currentYear--;
        } else {
            currentMonth--;
        }
        loadCalendar(currentYear, currentMonth);
    });
    
    nextButton.addEventListener('click', () => {
        if (currentMonth === 12) {
            currentMonth = 1;
            currentYear++;
        } else {
            currentMonth++;
        }
        loadCalendar(currentYear, currentMonth);
    });
    
    // Keyboard navigation support
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            prevButton.click();
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            nextButton.click();
        }
    });
    
    // Responsive view switching
    function switchView(view) {
        if (view === 'list') {
            calendarContainer.classList.add('hidden');
            listContainer.classList.remove('hidden');
        } else {
            calendarContainer.classList.remove('hidden');
            listContainer.classList.add('hidden');
        }
    }
    
    // Initialize calendar
    loadCalendar();
})();
```

### JavaScript API Integration
The calendar loads data dynamically via JavaScript:

```javascript
// Example of calendar API integration
async function loadCalendarData(modelSlug, month, year) {
  const response = await fetch(`/api/model-calendar/${modelSlug}?month=${month}&year=${year}`);
  const data = await response.json();
  return data.events;
}

// Event rendering in calendar grid
function renderCalendarEvent(event) {
  return `
    <div class="calendar-event ${event.status}" title="${event.location} - ${event.service_type}">
      <div class="event-time">${formatTime(event.start_date)}</div>
      <div class="event-location">${event.location}</div>
    </div>
  `;
}
```

### Database Queries
1. **Events:** `SELECT * FROM calendar_availability WHERE model_id = ? AND date >= ? AND date <= ? ORDER BY date, start_time`
2. **Model Info:** `SELECT name, slug FROM models WHERE id = ?`
3. **Page Content:** `SELECT * FROM model_calendar_page_content WHERE model_id = ?` (optional)

### API Endpoints
- **GET** `/api/model-calendar/:slug` - Get calendar events for a model
- **GET** `/api/model-calendar/:slug?month=MM&year=YYYY` - Get events for specific month
- **POST** `/api/model-calendar/:slug/events` - Create new calendar event (admin only)

---

## 8. CONTACT PAGE (`/contact`)

### API Calls Made
- **Primary:** Server-side content loading via `getModelContent(modelId, 'contact')`  
- **Model Info:** Direct model properties for contact details
- **Data Sources:**
  - `model_contact_page_content` (comprehensive page configuration with 20+ fields)
  - `models` table (email, phone, location)

### Dynamic Elements
- **Advanced Contact Form:** Multi-field form with spam protection, validation, and loading states
- **Section Visibility Controls:** All sections can be hidden/shown via `*_visible` flags
- **Direct Contact Section:** Configurable email, phone, and response time information
- **Booking Guidelines:** Up to 4 configurable guideline bullet points
- **Location & Services:** Configurable area and services information  
- **Privacy & Discretion:** Configurable privacy messaging with special styling
- **Form Validation:** Client-side validation with honeypot spam protection and throttling
- **Professional Error Handling:** Field-specific error messages and loading states

### Content Structure
```javascript
contact_content: {
  // Page Header
  contact_header_visible: boolean,
  page_title: string,               // Default: "Contact Me"
  page_subtitle: string,
  
  // Contact Form Section
  contact_form_visible: boolean,
  form_title: string,               // Default: "Send a Message"
  form_name_label: string,          // Default: "Your Name"
  form_email_label: string,         // Default: "Email Address"
  form_phone_label: string,         // Default: "Phone Number (Optional)"
  form_date_label: string,          // Default: "Preferred Date"
  form_duration_label: string,      // Default: "Duration"
  form_duration_options: string,    // CSV: "1 Hour,90 Minutes,2 Hours,3 Hours,Overnight,Extended (please specify)"
  form_message_label: string,       // Default: "Message"
  form_message_placeholder: string, // Default: "Please introduce yourself and describe..."
  form_button_text: string,         // Default: "Send Message"
  
  // Direct Contact Section
  contact_direct_visible: boolean,
  direct_title: string,             // Default: "Direct Contact"
  direct_email_label: string,       // Default: "Email"
  direct_phone_label: string,       // Default: "Phone"
  direct_response_text: string,     // Default: "I typically respond within 2-4 hours"
  
  // Booking Guidelines Section
  contact_guidelines_visible: boolean,
  guidelines_title: string,         // Default: "Booking Guidelines"
  guideline_1: string,
  guideline_2: string,
  guideline_3: string,
  guideline_4: string,
  
  // Location & Services Section
  contact_location_visible: boolean,
  location_title: string,           // Default: "Location & Services"
  location_area_text: string,
  location_services_text: string,
  
  // Privacy & Discretion Section
  contact_privacy_visible: boolean,
  privacy_title: string,            // Default: "Privacy & Discretion"
  privacy_text: string              // Default: "All communications are handled with the utmost discretion..."
}
```

### Template Implementation
**Page Structure with Section Visibility:**
```handlebars
<!-- Page Header -->
{{#if contact_content.contact_header_visible}}
<div class="page-header">
  <h1>{{#if contact_content.page_title}}{{contact_content.page_title}}{{else}}Contact Me{{/if}}</h1>
  {{#if contact_content.page_subtitle}}
    <p>{{contact_content.page_subtitle}}</p>
  {{/if}}
</div>
{{/if}}

<div class="contact-layout">
  <!-- Contact Form -->
  {{#if contact_content.contact_form_visible}}
  <div class="contact-form-section">
    <h2>{{#if contact_content.form_title}}{{contact_content.form_title}}{{else}}Send a Message{{/if}}</h2>
    
    <form method="POST" id="contact-form">
      <!-- Honeypot field for spam protection -->
      <input type="text" name="website" style="display: none;" tabindex="-1" autocomplete="off">
      
      <div class="form-field">
        <label>{{#if contact_content.form_name_label}}{{contact_content.form_name_label}}{{else}}Your Name{{/if}} *</label>
        <input type="text" name="name" required>
        <div class="error-message"></div>
      </div>
      
      <div class="form-field">
        <label>{{#if contact_content.form_email_label}}{{contact_content.form_email_label}}{{else}}Email Address{{/if}} *</label>
        <input type="email" name="email" required>
        <div class="error-message"></div>
      </div>
      
      <div class="form-field">
        <label>{{#if contact_content.form_phone_label}}{{contact_content.form_phone_label}}{{else}}Phone Number (Optional){{/if}}</label>
        <input type="tel" name="phone">
        <div class="error-message"></div>
      </div>
      
      <div class="form-field">
        <label>{{#if contact_content.form_date_label}}{{contact_content.form_date_label}}{{else}}Preferred Date{{/if}}</label>
        <input type="date" name="date">
        <div class="error-message"></div>
      </div>
      
      <div class="form-field">
        <label>{{#if contact_content.form_duration_label}}{{contact_content.form_duration_label}}{{else}}Duration{{/if}}</label>
        <select name="duration">
          <option value="">Select duration</option>
          {{#each (split (or contact_content.form_duration_options "1 Hour,90 Minutes,2 Hours,3 Hours,Overnight,Extended (please specify)") ",")}}
            <option value="{{trim this}}">{{trim this}}</option>
          {{/each}}
        </select>
        <div class="error-message"></div>
      </div>
      
      <div class="form-field">
        <label>{{#if contact_content.form_message_label}}{{contact_content.form_message_label}}{{else}}Message{{/if}} *</label>
        <textarea name="message" rows="6" required 
                  placeholder="{{#if contact_content.form_message_placeholder}}{{contact_content.form_message_placeholder}}{{else}}Please introduce yourself and describe what type of encounter you're seeking...{{/if}}"></textarea>
        <div class="error-message"></div>
      </div>
      
      <button type="submit">
        <span class="button-text">{{#if contact_content.form_button_text}}{{contact_content.form_button_text}}{{else}}Send Message{{/if}}</span>
        <span class="spinner">Sending...</span>
      </button>
    </form>
  </div>
  {{/if}}
  
  <!-- Contact Information Sections -->
  <div class="contact-info-sections">
    <!-- Direct Contact -->
    {{#if contact_content.contact_direct_visible}}
    <div class="contact-section">
      <h2>{{#if contact_content.direct_title}}{{contact_content.direct_title}}{{else}}Direct Contact{{/if}}</h2>
      <div class="contact-methods">
        <div class="contact-method">
          <span class="label">{{#if contact_content.direct_email_label}}{{contact_content.direct_email_label}}{{else}}Email{{/if}}</span>
          <a href="mailto:{{contactEmail}}">{{contactEmail}}</a>
        </div>
        {{#if contactPhone}}
        <div class="contact-method">
          <span class="label">{{#if contact_content.direct_phone_label}}{{contact_content.direct_phone_label}}{{else}}Phone{{/if}}</span>
          <a href="tel:{{contactPhone}}">{{contactPhone}}</a>
        </div>
        {{/if}}
        <div class="contact-method">
          <span class="label">Response Time</span>
          <span>{{#if contact_content.direct_response_text}}{{contact_content.direct_response_text}}{{else}}I typically respond within 2-4 hours{{/if}}</span>
        </div>
      </div>
    </div>
    {{/if}}
    
    <!-- Booking Guidelines -->
    {{#if contact_content.contact_guidelines_visible}}
    <div class="contact-section">
      <h3>{{#if contact_content.guidelines_title}}{{contact_content.guidelines_title}}{{else}}Booking Guidelines{{/if}}</h3>
      <ul class="guidelines-list">
        {{#if contact_content.guideline_1}}<li>{{contact_content.guideline_1}}</li>{{/if}}
        {{#if contact_content.guideline_2}}<li>{{contact_content.guideline_2}}</li>{{/if}}
        {{#if contact_content.guideline_3}}<li>{{contact_content.guideline_3}}</li>{{/if}}
        {{#if contact_content.guideline_4}}<li>{{contact_content.guideline_4}}</li>{{/if}}
      </ul>
    </div>
    {{/if}}
    
    <!-- Location & Services -->
    {{#if contact_content.contact_location_visible}}
    <div class="contact-section">
      <h3>{{#if contact_content.location_title}}{{contact_content.location_title}}{{else}}Location & Services{{/if}}</h3>
      <ul class="location-list">
        {{#if contact_content.location_area_text}}<li>{{contact_content.location_area_text}}</li>{{/if}}
        {{#if contact_content.location_services_text}}<li>{{contact_content.location_services_text}}</li>{{/if}}
      </ul>
    </div>
    {{/if}}
    
    <!-- Privacy & Discretion -->
    {{#if contact_content.contact_privacy_visible}}
    <div class="contact-section privacy-section">
      <h3>{{#if contact_content.privacy_title}}{{contact_content.privacy_title}}{{else}}Privacy & Discretion{{/if}}</h3>
      <p>{{#if contact_content.privacy_text}}{{contact_content.privacy_text}}{{else}}All communications are handled with the utmost discretion and confidentiality. Your privacy is my priority.{{/if}}</p>
    </div>
    {{/if}}
  </div>
</div>
```

**Required JavaScript for Form Handling:**
```javascript
// Contact form handling with spam protection
let lastSubmitTime = 0;
const SUBMIT_COOLDOWN = 5000; // 5 seconds

document.getElementById('contact-form')?.addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Throttle submissions
    const now = Date.now();
    if (now - lastSubmitTime < SUBMIT_COOLDOWN) {
        showError('Please wait before submitting again.');
        return;
    }
    
    // Get form data
    const formData = new FormData(this);
    const data = Object.fromEntries(formData);
    
    // Check honeypot field
    if (data.website) {
        // Silent fail for bots
        return;
    }
    
    // Clear previous errors
    clearErrors();
    
    // Validate required fields
    let hasErrors = false;
    
    if (!data.name?.trim()) {
        showFieldError('name', 'Name is required.');
        hasErrors = true;
    }
    
    if (!data.email?.trim()) {
        showFieldError('email', 'Email is required.');
        hasErrors = true;
    } else if (!isValidEmail(data.email)) {
        showFieldError('email', 'Please enter a valid email address.');
        hasErrors = true;
    }
    
    if (!data.message?.trim()) {
        showFieldError('message', 'Message is required.');
        hasErrors = true;
    }
    
    if (hasErrors) return;
    
    // Show loading state
    const submitBtn = this.querySelector('button[type="submit"]');
    const buttonText = submitBtn.querySelector('.button-text');
    const spinner = submitBtn.querySelector('.spinner');
    
    submitBtn.disabled = true;
    buttonText.style.display = 'none';
    spinner.style.display = 'inline';
    
    // Simulate form submission (replace with actual API call)
    setTimeout(() => {
        lastSubmitTime = now;
        
        // Reset button state
        submitBtn.disabled = false;
        buttonText.style.display = 'inline';
        spinner.style.display = 'none';
        
        // Show success message
        showSuccess('Thank you for your message! I will get back to you soon.');
        
        // Reset form
        this.reset();
    }, 2000);
});

// Validation helper functions
function showFieldError(fieldName, message) {
    const field = document.querySelector(`[name="${fieldName}"]`);
    const errorDiv = field.parentElement.querySelector('.error-message');
    
    field.style.borderColor = '#ef4444';
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

function clearErrors() {
    document.querySelectorAll('input, textarea, select').forEach(field => {
        field.style.borderColor = '#d1d5db';
    });
    document.querySelectorAll('.error-message').forEach(error => {
        error.style.display = 'none';
    });
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
```

### Database Queries
1. **Contact Content:** `SELECT * FROM model_contact_page_content WHERE model_id = ?`
2. **Model Info:** `SELECT email, phone, location FROM models WHERE id = ?`

---

## SUMMARY: Theme Development Quick Reference

### Universal Template Variables
Available on all page types:
- `modelSlug` - Model's URL slug
- `siteName` - Model's display name
- `previewParam` - Preview query parameter for theme testing
- `previewThemeId` - Current theme ID for preview mode
- `theme.colors.*` - Dynamic color palette variables

### Common Content Structure Patterns

**Page Header Pattern:**
```handlebars
{{#if page_content.page_title_visible}}
  <h1>{{#if page_content.page_title}}{{page_content.page_title}}{{else}}Default Title{{/if}}</h1>
  {{#if page_content.page_subtitle}}<p>{{page_content.page_subtitle}}</p>{{/if}}
{{/if}}
```

**Section Visibility Pattern:**
```handlebars
{{#if page_content.section_visible}}
  <section>
    <h2>{{#if page_content.section_title}}{{page_content.section_title}}{{else}}Default Section Title{{/if}}</h2>
    <!-- Section content -->
  </section>
{{/if}}
```

**CTA Button Pattern:**
```handlebars
{{#if page_content.cta_button_1_text}}
  <a href="/{{modelSlug}}/{{#if page_content.cta_button_1_link}}{{page_content.cta_button_1_link}}{{else}}default{{/if}}{{previewParam}}">
    {{page_content.cta_button_1_text}}
  </a>
{{/if}}
```

### Database Table Reference
| Page Type | Content Table | Pre-loaded Data Tables |
|-----------|---------------|------------------------|
| Home | `model_home_page_content` | `testimonials`, `gallery_images`, `calendar_availability` |
| About | `model_about_page_content` | `gallery_images` (for portrait) |
| Gallery | `model_gallery_page_content` | Uses Universal Gallery System |
| Rates | `model_rates_page_content` | `rates`, `additional_services`, `donations` |
| Etiquette | `model_etiquette_page_content` | None |
| Contact | `model_contact_page_content` | None |
| Calendar | `model_calendar_page_content` (optional) | `calendar_availability` (via API) |

### API Integration Points
- **Universal Gallery:** `{{{renderUniversalGallery modelSlug previewTheme=previewThemeId}}}`
- **Calendar Events:** `/api/model-calendar/:slug`
- **Contact Form:** POST to `/api/contact` or model-specific endpoint
- **Theme Preview:** All URLs include `{{previewParam}}` for preview mode

### Theme CSS Variable Standards
Themes should define these CSS variables for consistency:
- `--theme-primary` - Primary brand color
- `--theme-secondary` - Secondary accent color  
- `--theme-text` - Main text color
- `--theme-text-muted` - Muted text color
- `--theme-background` - Background color
- `--theme-border` - Border color

### Best Practices
1. **Always provide fallback content** for empty database fields
2. **Use consistent section visibility patterns** across all pages
3. **Include `{{previewParam}}` on all internal links** for theme preview mode
4. **Test with empty/minimal content** to ensure graceful degradation
5. **Use semantic HTML structure** for accessibility
6. **Implement responsive design patterns** for mobile compatibility
7. **Follow the established naming conventions** for CSS classes and variables
