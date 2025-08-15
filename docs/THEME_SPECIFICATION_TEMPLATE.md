# Theme Specification Template

> **Template Name:** `[THEME_NAME]`  
> **Theme ID:** `[theme-id]`  
> **Category:** `[standard|contemporary|premium|modern|elegant|traditional]`  
> **Version:** `1.0.0`  
> **Author:** `[Author Name]`  
> **Created:** `[Date]`

## Theme Overview

**Description:** [Brief description of the theme's aesthetic and target audience]

**Color Scheme:**
- Primary: `#[HEX_COLOR]`
- Secondary: `#[HEX_COLOR]`
- Accent: `#[HEX_COLOR]`
- Background: `#[HEX_COLOR]` or `linear-gradient(...)`

**Key Features:**
- [Feature 1]
- [Feature 2]
- [Feature 3]

---

## Page Specifications

### 1. Home Page (`home.handlebars`)

#### Database Fields Required
```sql
-- From model_home_page_content table
hero_section_visible BOOLEAN
hero_title VARCHAR(255)
hero_subtitle VARCHAR(500)
hero_background_image_id INT
hero_background_type ENUM('image', 'gradient', 'video')
hero_cta_visible BOOLEAN
hero_cta_text VARCHAR(100)
hero_cta_link VARCHAR(255)

-- About Section
about_section_visible BOOLEAN
about_title VARCHAR(255)
about_subtitle VARCHAR(500)
about_preview_text TEXT
about_cta_visible BOOLEAN
about_cta_text VARCHAR(100)

-- Services Section
services_section_visible BOOLEAN
services_title VARCHAR(255)
services_subtitle VARCHAR(500)
services_grid_layout ENUM('2x2', '3x1', '1x3')

-- Testimonials Section
testimonials_section_visible BOOLEAN
testimonials_title VARCHAR(255)
testimonials_auto_rotate BOOLEAN
testimonials_show_count INT DEFAULT 3

-- Gallery Preview Section
gallery_preview_visible BOOLEAN
gallery_preview_title VARCHAR(255)
gallery_preview_count INT DEFAULT 6
gallery_preview_layout ENUM('grid', 'carousel', 'masonry')

-- Contact CTA Section
contact_cta_visible BOOLEAN
contact_cta_title VARCHAR(255)
contact_cta_text TEXT
contact_cta_background VARCHAR(255)
```

#### API Calls Required
```javascript
// Primary content data
GET /api/model-home-page/${modelId}

// Gallery preview images (if gallery_preview_visible = true)
GET /api/model-gallery/${modelId}/preview?limit=${gallery_preview_count}

// Hero background image (if hero_background_image_id exists)
GET /api/gallery-images/${hero_background_image_id}

// Testimonials (if testimonials_section_visible = true)
GET /api/model-testimonials/${modelId}?limit=${testimonials_show_count}

// Model basic info for fallbacks
GET /api/models/${modelId}/basic-info
```

#### Dynamic Sections
1. **Hero Section**
   - Conditional rendering based on `hero_section_visible`
   - Background handling: image, gradient, or video
   - Dynamic CTA button with custom text and link
   
2. **About Preview Section**
   - Toggleable via `about_section_visible`
   - Preview text with "Read More" link to about page
   
3. **Services Grid**
   - Layout controlled by `services_grid_layout`
   - Service items from predefined list or custom entries
   
4. **Gallery Preview**
   - Dynamic image count via `gallery_preview_count`
   - Multiple layout options: grid, carousel, masonry
   - Links to full gallery page
   
5. **Testimonials Carousel**
   - Auto-rotation based on `testimonials_auto_rotate`
   - Dynamic testimonial count
   
6. **Contact CTA**
   - Full-width section with custom background
   - Dynamic text and styling

#### Template-Specific Settings
```javascript
// Theme configuration options
{
  "heroParallax": true|false,
  "animationSpeed": "fast|normal|slow",
  "sectionSpacing": "compact|normal|spacious",
  "buttonStyle": "rounded|square|pill",
  "cardStyle": "flat|elevated|outlined"
}
```

---

### 2. About Page (`about.handlebars`)

#### Database Fields Required
```sql
-- From model_about_page_content table
page_title_visible BOOLEAN
page_title VARCHAR(255)
page_subtitle VARCHAR(500)

-- Main Content
main_content_visible BOOLEAN
about_paragraph_1 TEXT
about_paragraph_2 TEXT
about_paragraph_3 TEXT

-- Portrait Section
portrait_visible BOOLEAN
portrait_image_id INT
portrait_position ENUM('left', 'right', 'center')
portrait_style ENUM('circular', 'rounded', 'square')

-- Quick Facts
quick_facts_visible BOOLEAN
qf_title VARCHAR(255)
qf_location VARCHAR(255)
qf_languages VARCHAR(255)
qf_education VARCHAR(255)
qf_specialties VARCHAR(255)
qf_experience VARCHAR(255)

-- Personal Story
personal_story_visible BOOLEAN
personal_story_title VARCHAR(255)
personal_story_content TEXT

-- Interests Section
interests_visible BOOLEAN
interests_title VARCHAR(255)
interests_list TEXT -- JSON array of interests

-- CTA Section
about_cta_visible BOOLEAN
about_cta_title VARCHAR(255)
about_cta_text VARCHAR(255)
about_cta_button_text VARCHAR(100)
about_cta_button_link VARCHAR(255)
```

#### API Calls Required
```javascript
// Primary about page content
GET /api/model-about-content/${modelId}

// Portrait image (if portrait_image_id exists)
GET /api/gallery-images/${portrait_image_id}

// Quick facts data (if stored separately)
GET /api/quick-facts/${modelId}

// Additional images for about page gallery
GET /api/model-gallery/${modelId}/about-images

// Model basic info for fallbacks
GET /api/models/${modelId}/basic-info
```

#### Dynamic Sections
1. **Page Header**
   - Dynamic title and subtitle
   - Optional breadcrumb navigation
   
2. **Main Content Area**
   - Multiple paragraph support (1-3 paragraphs)
   - Rich text formatting support
   
3. **Portrait Section**
   - Dynamic positioning (left/right/center)
   - Multiple style options
   - Image optimization and lazy loading
   
4. **Quick Facts Grid**
   - Configurable fact categories
   - Icon-based presentation
   - Responsive grid layout
   
5. **Personal Story**
   - Expandable/collapsible content
   - Rich text support
   
6. **Interests Tags**
   - Dynamic tag cloud or list
   - Clickable interests (optional)
   
7. **About CTA**
   - Custom call-to-action section
   - Contact form integration

---

### 3. Contact Page (`contact.handlebars`)

#### Database Fields Required
```sql
-- From model_contact_page_content table
page_title VARCHAR(255)
contact_intro_text TEXT

-- Contact Header
contact_header_visible BOOLEAN
contact_header_title VARCHAR(255)
contact_header_subtitle VARCHAR(500)

-- Contact Form
contact_form_visible BOOLEAN
contact_form_title VARCHAR(255)
contact_form_subtitle VARCHAR(255)
contact_form_fields JSON -- Array of enabled fields
contact_form_notification_email VARCHAR(255)
contact_form_success_message TEXT
contact_form_require_screening BOOLEAN

-- Direct Contact
contact_direct_visible BOOLEAN
contact_email VARCHAR(255)
contact_phone VARCHAR(20)
contact_preferred_method ENUM('email', 'phone', 'form')
contact_response_time VARCHAR(100)

-- Contact Guidelines
contact_guidelines_visible BOOLEAN
contact_guidelines_title VARCHAR(255)
contact_guidelines_content TEXT
contact_guidelines_list JSON -- Array of guidelines

-- Location Info (if applicable)
contact_location_visible BOOLEAN
contact_city VARCHAR(100)
contact_region VARCHAR(100)
contact_timezone VARCHAR(50)
contact_travel_available BOOLEAN
contact_travel_radius VARCHAR(100)

-- Privacy Notice
contact_privacy_visible BOOLEAN
contact_privacy_title VARCHAR(255)
contact_privacy_content TEXT
```

#### API Calls Required
```javascript
// Contact page content
GET /api/model-contact-rosemastos/${modelId}

// Contact form configuration
GET /api/contact-form-config/${modelId}

// Submit contact form
POST /api/contact-form/${modelId}
// Body: { name, email, phone, message, screening_info, ... }

// Model availability (if integrated)
GET /api/model-calendar/${modelId}/availability

// Model basic contact info
GET /api/models/${modelId}/contact-info
```

#### Dynamic Sections
1. **Contact Header**
   - Dynamic title and introduction
   - Contact method preferences
   
2. **Contact Form**
   - Dynamic field configuration
   - Screening requirements integration
   - Form validation and submission
   - Success/error message handling
   
3. **Direct Contact Methods**
   - Email and phone display
   - Preferred contact method highlighting
   - Response time expectations
   
4. **Contact Guidelines**
   - Etiquette and communication rules
   - Screening requirements
   - Professional boundaries
   
5. **Location Information**
   - Service area display
   - Travel availability
   - Timezone information
   
6. **Privacy Notice**
   - Data handling information
   - Confidentiality assurances

---

### 4. Gallery Page (`gallery.handlebars`)

#### Database Fields Required
```sql
-- From model_gallery_page_content table
page_title VARCHAR(255)
gallery_intro_text TEXT

-- Gallery Settings
gallery_layout ENUM('grid', 'masonry', 'carousel', 'slideshow')
images_per_page INT DEFAULT 20
gallery_pagination_enabled BOOLEAN DEFAULT true
gallery_lightbox_enabled BOOLEAN DEFAULT true
gallery_download_enabled BOOLEAN DEFAULT false

-- Filtering Options
gallery_categories_visible BOOLEAN
gallery_tags_visible BOOLEAN
gallery_search_enabled BOOLEAN
gallery_sort_options JSON -- ['newest', 'oldest', 'popular', 'random']

-- Image Display Settings
gallery_show_captions BOOLEAN DEFAULT true
gallery_show_metadata BOOLEAN DEFAULT false
gallery_watermark_enabled BOOLEAN DEFAULT true
gallery_image_quality ENUM('standard', 'high', 'original')

-- Albums/Sections
gallery_albums_enabled BOOLEAN
gallery_albums_layout ENUM('tabs', 'dropdown', 'sidebar')
```

#### API Calls Required
```javascript
// Gallery page configuration
GET /api/model-gallery/${modelId}/config

// Gallery images with pagination
GET /api/model-gallery/${modelId}/images?page=1&limit=20&category=${category}&sort=${sort}

// Gallery categories/albums
GET /api/model-gallery/${modelId}/categories

// Gallery tags
GET /api/model-gallery/${modelId}/tags

// Search gallery
GET /api/model-gallery/${modelId}/search?q=${searchTerm}

// Image details for lightbox
GET /api/gallery-images/${imageId}/details

// Image views/analytics (if enabled)
POST /api/gallery-images/${imageId}/view

// Gallery statistics
GET /api/model-gallery/${modelId}/stats
```

#### Dynamic Sections
1. **Gallery Header**
   - Page title and introduction
   - Gallery statistics (total images, categories)
   
2. **Gallery Filters**
   - Category/album selector
   - Tag-based filtering
   - Search functionality
   - Sort options
   
3. **Gallery Grid/Layout**
   - Dynamic layout switching
   - Responsive image grid
   - Lazy loading implementation
   - Pagination controls
   
4. **Image Lightbox/Modal**
   - Full-size image display
   - Image navigation (prev/next)
   - Image metadata display
   - Social sharing options
   
5. **Gallery Albums/Categories**
   - Tabbed or dropdown navigation
   - Category-specific views
   - Album thumbnails

---

### 5. Etiquette Page (`etiquette.handlebars`)

#### Database Fields Required
```sql
-- From model_etiquette_simple_content table
-- Page Header
page_title VARCHAR(255) DEFAULT 'Etiquette & Guidelines'
page_subtitle VARCHAR(500) DEFAULT NULL

-- Booking & Screening Section (Card 1 - Top Left)
etiquette_booking_visible BOOLEAN DEFAULT true
booking_title VARCHAR(255) DEFAULT 'Booking & Screening'
booking_initial_contact_title VARCHAR(255) DEFAULT 'Initial Contact'
booking_initial_contact_text TEXT DEFAULT 'Please introduce yourself politely and include your desired date, time, and duration when reaching out.'
booking_screening_title VARCHAR(255) DEFAULT 'Screening Process'
booking_screening_text TEXT DEFAULT 'For everyone\'s safety, a brief screening process is required for all new clients. This includes basic verification and references.'
booking_advance_title VARCHAR(255) DEFAULT 'Advance Booking'
booking_advance_text TEXT DEFAULT 'I prefer bookings made at least 24 hours in advance. Same-day appointments may be available with an additional fee.'

-- Respect & Boundaries Section (Card 2 - Top Right)  
etiquette_respect_visible BOOLEAN DEFAULT true
respect_title VARCHAR(255) DEFAULT 'Respect & Boundaries'
respect_mutual_title VARCHAR(255) DEFAULT 'Mutual Respect'
respect_mutual_text TEXT DEFAULT 'I treat all clients with respect and kindness, and I expect the same in return. Rude or disrespectful behavior will not be tolerated.'
respect_boundaries_title VARCHAR(255) DEFAULT 'Professional Boundaries'
respect_boundaries_text TEXT DEFAULT 'Our time together is for companionship and social interaction. Please respect all boundaries and guidelines.'
respect_personal_title VARCHAR(255) DEFAULT 'Personal Information'
respect_personal_text TEXT DEFAULT 'Please do not ask for personal information beyond what is shared publicly. Discretion works both ways.'

-- Hygiene & Presentation Section (Card 3 - Bottom Left)
etiquette_hygiene_visible BOOLEAN DEFAULT true
hygiene_title VARCHAR(255) DEFAULT 'Hygiene & Presentation'
hygiene_personal_title VARCHAR(255) DEFAULT 'Personal Hygiene'
hygiene_personal_text TEXT DEFAULT 'Please arrive freshly showered and well-groomed. Good personal hygiene is essential for a comfortable experience.'
hygiene_attire_title VARCHAR(255) DEFAULT 'Attire'
hygiene_attire_text TEXT DEFAULT 'Dress appropriately for our planned activities. I will always be well-dressed and expect the same consideration.'
hygiene_substances_title VARCHAR(255) DEFAULT 'Substances'
hygiene_substances_text TEXT DEFAULT 'Please do not arrive under the influence of alcohol or other substances. Light social drinking during our time is acceptable.'

-- Cancellation Policy Section (Card 4 - Bottom Right)
etiquette_cancellation_visible BOOLEAN DEFAULT true
cancellation_title VARCHAR(255) DEFAULT 'Cancellation Policy'
cancellation_advance_title VARCHAR(255) DEFAULT 'Advance Notice'
cancellation_advance_text TEXT DEFAULT 'Please provide at least 2 hours notice for cancellations. Last-minute cancellations may result in a cancellation fee.'
cancellation_noshow_title VARCHAR(255) DEFAULT 'No-Shows'
cancellation_noshow_text TEXT DEFAULT 'No-shows without notice will result in being blacklisted from future bookings.'
cancellation_my_title VARCHAR(255) DEFAULT 'My Cancellations'
cancellation_my_text TEXT DEFAULT 'In the rare event I need to cancel, I will provide as much notice as possible and offer to reschedule.'

-- Safety & Discretion Section (Full Width Dark Card)
etiquette_safety_visible BOOLEAN DEFAULT true
safety_title VARCHAR(255) DEFAULT 'Safety & Discretion'
safety_confidentiality_title VARCHAR(255) DEFAULT 'Confidentiality'
safety_confidentiality_text TEXT DEFAULT 'Your privacy is paramount. All interactions remain strictly confidential.'
safety_environment_title VARCHAR(255) DEFAULT 'Safe Environment'
safety_environment_text TEXT DEFAULT 'I maintain a safe, clean, and welcoming environment for all meetings.'
safety_communication_title VARCHAR(255) DEFAULT 'Professional Communication'
safety_communication_text TEXT DEFAULT 'All communications are handled professionally and discreetly.'

-- Questions/Contact Section (Full Width Card)
etiquette_questions_visible BOOLEAN DEFAULT true
questions_title VARCHAR(255) DEFAULT 'Questions?'
questions_text TEXT DEFAULT 'If you have any questions about these guidelines or need clarification, please don\'t hesitate to reach out.'
questions_button_text VARCHAR(100) DEFAULT 'Contact Me'
questions_button_link VARCHAR(255) DEFAULT 'contact'
```

#### API Calls Required
```javascript
// Etiquette page content (depends on structure used)
GET /api/model-etiquette-simple/${modelId}
// OR
GET /api/model-etiquette-rosemastos/${modelId}

// Model-specific policies
GET /api/models/${modelId}/policies

// Screening requirements
GET /api/models/${modelId}/screening-requirements

// Payment methods and rates (if integrated)
GET /api/model-rates/${modelId}/payment-info
```

#### Layout Structure
```html
<!-- Page Header (Full Width) -->
<div class="text-center mb-12">
  <h1>{{page_title}}</h1>
  {{#if page_subtitle}}<p>{{page_subtitle}}</p>{{/if}}
</div>

<!-- 2x2 Grid Layout (Cards 1-4) -->
<div class="grid md:grid-cols-2 gap-8 mb-12">
  <!-- Card 1: Booking & Screening -->
  <!-- Card 2: Respect & Boundaries -->
</div>
<div class="grid md:grid-cols-2 gap-8 mb-12">
  <!-- Card 3: Hygiene & Presentation -->
  <!-- Card 4: Cancellation Policy -->
</div>

<!-- Full Width Safety Section (Dark Card) -->
<div class="bg-gray-900 p-8 rounded-2xl shadow-lg mb-12">
  <div class="grid md:grid-cols-3 gap-6">
    <!-- 3 columns: Confidentiality, Safe Environment, Communication -->
  </div>
</div>

<!-- Full Width Questions Section -->
<div class="text-center bg-white p-8 rounded-2xl shadow-lg">
  <!-- Questions content with CTA button -->
</div>
```

#### Card Structure Template
Each card follows this pattern:
```html
<div class="bg-white p-8 rounded-2xl shadow-lg" style="box-shadow: 0 10px 30px rgba(2,6,23,0.06);" data-aos="fade-up" data-aos-delay="[100|200|300|400]">
  <!-- Badge -->
  <div class="inline-block px-3 py-1 rounded-full text-xs uppercase font-medium tracking-wide mb-4" 
       style="color: #64748B; border: 1px solid #E5E7EB; font-size: 10px;">
    [BADGE_TEXT]
  </div>
  
  <!-- Card Title -->
  <h2 class="font-semibold mb-6" style="font-size: 22px; line-height: 28px; color: #1F2937;">
    {{#if [section]_title}}{{[section]_title}}{{else}}[DEFAULT_TITLE]{{/if}}
  </h2>
  
  <!-- Sub-sections (3 per card) -->
  <div class="space-y-4">
    <!-- Sub-section 1 -->
    <div>
      <h3 class="font-bold mb-2" style="font-size: 14px; line-height: 22px; color: #1F2937;">
        {{#if [subsection_1]_title}}{{[subsection_1]_title}}{{else}}[DEFAULT_SUBTITLE]{{/if}}
      </h3>
      <p style="font-size: 16px; line-height: 26px; color: #334155;">
        {{#if [subsection_1]_text}}{{[subsection_1]_text}}{{else}}[DEFAULT_TEXT]{{/if}}
      </p>
    </div>
    <!-- Repeat for sub-sections 2 and 3 -->
  </div>
</div>
```

#### Dynamic Sections
1. **Page Header Section**
   - Conditional subtitle rendering
   - Center-aligned layout
   
2. **Card 1: Booking & Screening** (`etiquette_booking_visible`)
   - Badge: "Planning"
   - 3 Sub-sections: Initial Contact, Screening Process, Advance Booking
   - AOS delay: 100ms
   
3. **Card 2: Respect & Boundaries** (`etiquette_respect_visible`)
   - Badge: "Mutual Understanding"
   - 3 Sub-sections: Mutual Respect, Professional Boundaries, Personal Information
   - AOS delay: 200ms
   
4. **Card 3: Hygiene & Presentation** (`etiquette_hygiene_visible`)
   - Badge: "Standards"
   - 3 Sub-sections: Personal Hygiene, Attire, Substances
   - AOS delay: 300ms
   
5. **Card 4: Cancellation Policy** (`etiquette_cancellation_visible`)
   - Badge: "Policies"  
   - 3 Sub-sections: Advance Notice, No-Shows, My Cancellations
   - AOS delay: 400ms
   
6. **Safety & Discretion Section** (`etiquette_safety_visible`)
   - Full-width dark card (bg-gray-900)
   - Badge: "Security" (centered)
   - 3-column grid with icons
   - White text on dark background
   - SVG icons for each column
   - AOS delay: 500ms
   
7. **Questions Section** (`etiquette_questions_visible`)
   - Full-width white card
   - Badge: "Need Help"
   - Center-aligned content
   - CTA button linking to contact page
   - AOS delay: 700ms

---

### 6. Rates Page (`rates.handlebars`)

#### Database Fields Required
```sql
-- From model_rates_page_content table
page_title VARCHAR(255)
rates_intro_text TEXT

-- Rates Display
rates_table_visible BOOLEAN
rates_incall_visible BOOLEAN
rates_outcall_visible BOOLEAN
rates_extended_visible BOOLEAN

-- Rates Content
rates_incall_content TEXT
rates_outcall_content TEXT
rates_extended_content TEXT

-- Additional Services
rates_additional_visible BOOLEAN
additional_services TEXT

-- Payment Information
rates_payment_visible BOOLEAN
payment_methods JSON
payment_terms TEXT
payment_cancellation_policy TEXT

-- Donations Section
donations_visible BOOLEAN
donations_title VARCHAR(255)
donations_content TEXT

-- Terms and Conditions
terms_visible BOOLEAN
terms_title VARCHAR(255)
terms_content TEXT

-- CTA Section
cta_visible BOOLEAN
cta_title VARCHAR(255)
cta_content TEXT
cta_button_text VARCHAR(100)
cta_button_link VARCHAR(255)
```

#### API Calls Required
```javascript
// Rates page content
GET /api/model-rates/${modelId}

// Model-specific rate information
GET /api/models/${modelId}/rates-info

// Payment methods and policies
GET /api/models/${modelId}/payment-info

// Terms and conditions
GET /api/models/${modelId}/terms

// Contact information for booking
GET /api/models/${modelId}/contact-info
```

#### Dynamic Sections
1. **Rates Header**
   - Professional introduction
   - Service overview
   
2. **Service Rates Table**
   - Incall/Outcall rates
   - Extended service options
   - Custom rate structures
   
3. **Additional Services**
   - Extra service offerings
   - Custom packages
   - Special requests
   
4. **Payment Information**
   - Accepted payment methods
   - Payment terms and timing
   - Deposit requirements
   
5. **Donations Section**
   - Gift and donation policies
   - Wish list integration
   
6. **Terms and Conditions**
   - Service terms
   - Cancellation policies
   - Legal disclaimers
   
7. **Contact CTA**
   - Booking call-to-action
   - Contact form integration

---

## CSS/Styling Requirements

### Theme-Specific CSS Variables
Every theme must define these CSS custom properties:
```css
:root {
  /* Core Colors */
  --color-primary: [primary-color];
  --color-secondary: [secondary-color]; 
  --color-accent: [accent-color];
  --color-background: [background-color];
  
  /* Extended Color Palette */
  --color-primary-light: [lightened-primary];
  --color-primary-dark: [darkened-primary];
  --color-text-primary: #1F2937;
  --color-text-secondary: #334155;
  --color-text-muted: #64748B;
  --color-border: #E5E7EB;
  
  /* Typography Scale */
  --font-size-xs: 10px;
  --font-size-sm: 14px;
  --font-size-base: 16px;
  --font-size-lg: 22px;
  --font-size-xl: 28px;
  --font-size-2xl: 36px;
  
  /* Line Heights */
  --line-height-tight: 22px;
  --line-height-normal: 26px;
  --line-height-relaxed: 28px;
  
  /* Spacing Scale */
  --spacing-xs: 0.5rem;
  --spacing-sm: 1rem;
  --spacing-md: 1.5rem;
  --spacing-lg: 2rem;
  --spacing-xl: 3rem;
  --spacing-2xl: 4rem;
  
  /* Border Radius */
  --radius-sm: 0.5rem;
  --radius-md: 0.75rem;
  --radius-lg: 1rem;
  --radius-xl: 1.5rem;
  --radius-2xl: 2rem;
  --radius-full: 9999px;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.07);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
  --shadow-custom: 0 10px 30px rgba(2,6,23,0.06);
  
  /* Animations */
  --transition-fast: 0.15s ease;
  --transition-normal: 0.3s ease;
  --transition-slow: 0.5s ease;
}
```

### Required CSS Classes
Every theme must implement these utility classes:
```css
/* Layout Classes */
.container-custom { max-width: var(--container-width, 1280px); margin: 0 auto; padding: 0 1rem; }
.section-padding { padding: var(--spacing-2xl) 0; }
.card-spacing { padding: var(--spacing-lg); }

/* Text Utilities */
.text-primary { color: var(--color-text-primary); }
.text-secondary { color: var(--color-text-secondary); }
.text-muted { color: var(--color-text-muted); }

/* Background Utilities */
.bg-primary { background-color: var(--color-primary); }
.bg-card { background-color: var(--color-background, white); }
.bg-dark { background-color: #111827; }

/* Component Classes */
.btn-primary {
  background: var(--color-primary);
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: var(--radius-full);
  font-weight: 600;
  transition: var(--transition-normal);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  border: none;
  cursor: pointer;
}

.btn-primary:hover {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
}

.card {
  background: var(--color-background, white);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-custom);
  padding: var(--spacing-lg);
  transition: var(--transition-normal);
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}
```

### Animation Requirements
All themes must include AOS (Animate On Scroll) integration:
```html
<!-- In <head> -->
<link href="https://unpkg.com/aos@2.3.1/dist/aos.css" rel="stylesheet">

<!-- Before closing </body> -->
<script src="https://unpkg.com/aos@2.3.1/dist/aos.js"></script>
<script>AOS.init({ duration: 800, once: true });</script>
```

Standard AOS delays by section:
- First section: `data-aos-delay="100"`
- Second section: `data-aos-delay="200"`
- Continue incrementing by 100ms
- Use `data-aos="fade-up"` for most elements

## Template Integration Requirements

### Required Files Structure
```
themes/[theme-id]/
├── pages/
│   ├── home.handlebars
│   ├── about.handlebars
│   ├── contact.handlebars
│   ├── etiquette.handlebars
│   ├── gallery.handlebars
│   └── rates.handlebars
├── layouts/
│   └── main.handlebars
├── partials/ (optional)
│   ├── navigation.handlebars
│   └── footer.handlebars
└── assets/ (optional)
    ├── css/
    ├── js/
    └── images/
```

### Template Configuration
```json
{
  "id": "[theme-id]",
  "name": "[Theme Name]",
  "description": "[Description]",
  "version": "1.0.0",
  "category": "[category]",
  "status": "stable",
  "features": [
    "Responsive design",
    "Custom animations",
    "Advanced layouts"
  ],
  "colorScheme": {
    "primary": "#[color]",
    "secondary": "#[color]",
    "accent": "#[color]",
    "background": "#[color]"
  },
  "compatibility": {
    "responsive": true,
    "darkMode": false,
    "customization": "advanced"
  },
  "files": {
    "layouts": ["main.handlebars"],
    "pages": ["home.handlebars", "about.handlebars", "contact.handlebars", "etiquette.handlebars", "gallery.handlebars", "rates.handlebars"],
    "partials": []
  }
}
```

### CSS Variables Integration
```css
:root {
  /* Theme Colors */
  --primary-color: [primary-color];
  --secondary-color: [secondary-color];
  --accent-color: [accent-color];
  --background-color: [background-color];
  
  /* Typography */
  --font-family-primary: [font-family];
  --font-size-base: 1rem;
  --line-height-base: 1.6;
  
  /* Spacing */
  --spacing-xs: 0.5rem;
  --spacing-sm: 1rem;
  --spacing-md: 2rem;
  --spacing-lg: 3rem;
  --spacing-xl: 4rem;
  
  /* Border Radius */
  --border-radius-sm: 0.25rem;
  --border-radius-base: 0.5rem;
  --border-radius-lg: 1rem;
  
  /* Animations */
  --animation-duration: 0.3s;
  --animation-easing: ease-in-out;
}
```

### JavaScript Integration Points
```javascript
// Theme-specific JavaScript (if needed)
window.themeConfig = {
  themeName: '[theme-id]',
  features: {
    parallax: true,
    animations: true,
    lazyLoading: true
  },
  settings: {
    animationSpeed: 'normal',
    imageQuality: 'high'
  }
};

// Required event handlers
document.addEventListener('DOMContentLoaded', function() {
  // Initialize theme-specific features
  initializeThemeFeatures();
});
```

### Dependencies and Assets
```json
{
  "dependencies": {
    "css": [
      "https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css",
      "/themes/[theme-id]/assets/css/theme.css"
    ],
    "js": [
      "https://unpkg.com/aos@2.3.1/dist/aos.js",
      "/themes/[theme-id]/assets/js/theme.js"
    ],
    "fonts": [
      "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
    ]
  },
  "performance": {
    "lazyLoadImages": true,
    "minifyCSS": true,
    "criticalCSS": true
  }
}
```

---

## Testing and Validation

### Required Tests
- [ ] All database fields render correctly
- [ ] All API endpoints return expected data
- [ ] Responsive design works on all devices
- [ ] All dynamic sections toggle properly
- [ ] Form submissions work correctly
- [ ] Image loading and optimization functions
- [ ] Accessibility standards are met
- [ ] Performance benchmarks are achieved
- [ ] Cross-browser compatibility confirmed
- [ ] Template switching works seamlessly

### Performance Targets
- [ ] Page load time < 2 seconds
- [ ] First Contentful Paint < 1 second
- [ ] Largest Contentful Paint < 2.5 seconds
- [ ] Cumulative Layout Shift < 0.1
- [ ] First Input Delay < 100ms

### Browser Support
- [ ] Chrome (latest 2 versions)
- [ ] Firefox (latest 2 versions)
- [ ] Safari (latest 2 versions)
- [ ] Edge (latest 2 versions)
- [ ] Mobile browsers (iOS Safari, Chrome Mobile)

---

## Database Integration Checklist

### Database Tables Required
Each page requires a specific content table:
- `model_home_page_content` - Home page fields
- `model_about_page_content` - About page fields  
- `model_contact_page_content` - Contact page fields
- `model_etiquette_simple_content` - Etiquette page fields (or `model_etiquette_rosemastos_content`)
- `model_gallery_page_content` - Gallery page configuration
- `model_rates_page_content` - Rates page fields

### Field Naming Conventions
All database fields must follow these patterns:
- Section visibility: `[section_name]_visible` (BOOLEAN)
- Section titles: `[section_name]_title` (VARCHAR)
- Section content: `[section_name]_text` or `[section_name]_content` (TEXT)
- Sub-section titles: `[section_name]_[subsection]_title` (VARCHAR)
- Sub-section content: `[section_name]_[subsection]_text` (TEXT)

### Handlebars Conditional Pattern
All dynamic content must use this pattern:
```handlebars
{{#if section_visible}}
<div class="section-container">
  <h2>{{#if section_title}}{{section_title}}{{else}}Default Title{{/if}}</h2>
  <p>{{#if section_text}}{{section_text}}{{else}}Default content text{{/if}}</p>
</div>
{{/if}}
```

## Deployment Checklist

### Pre-deployment
- [ ] All database fields documented with exact names and types
- [ ] Default values specified for all fields
- [ ] Template files created following exact structure patterns
- [ ] All conditional {{#if}} statements implemented with fallbacks
- [ ] API endpoints tested with actual database data
- [ ] CSS variables defined and implemented
- [ ] AOS animations configured with correct delays
- [ ] Card structures follow exact HTML pattern
- [ ] Badge text and styling matches specification
- [ ] Typography uses exact font-size and line-height values
- [ ] Shadow values match specification (box-shadow: 0 10px 30px rgba(2,6,23,0.06))
- [ ] Assets optimized and compressed
- [ ] Performance testing completed
- [ ] Cross-browser testing completed
- [ ] Accessibility testing completed

### Post-deployment
- [ ] Template registered in system configuration
- [ ] Database migration created for new content tables
- [ ] All dynamic sections render with test data
- [ ] Template switching tested with actual content
- [ ] Customization options verified
- [ ] Admin editors tested for all content fields
- [ ] User acceptance testing completed
- [ ] Documentation updated
- [ ] Training materials created (if needed)

### Critical Validation Points
- [ ] Every database field referenced in templates exists
- [ ] All fallback text displays when fields are empty
- [ ] Grid layouts responsive on mobile devices
- [ ] AOS animations fire correctly on scroll
- [ ] Color variables apply theme colors consistently
- [ ] Card hover effects work properly
- [ ] Button links navigate to correct pages
- [ ] Form submissions save to correct database fields

---

## Notes and Considerations

### Development Notes
- Maintain consistency with existing template patterns
- Follow the established database field naming conventions
- Ensure all dynamic content has appropriate fallbacks
- Implement proper error handling for API failures
- Use semantic HTML and proper accessibility attributes

### Performance Considerations
- Optimize images for web delivery
- Implement lazy loading for gallery images
- Minimize CSS and JavaScript
- Use efficient database queries
- Cache API responses where appropriate

### Security Considerations
- Sanitize all user inputs
- Validate form submissions server-side
- Protect against XSS vulnerabilities
- Implement proper CSRF protection
- Follow secure coding practices

---

*This template specification should be customized for each new theme, ensuring all dynamic elements and integration points are properly documented and implemented.*