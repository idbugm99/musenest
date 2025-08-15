# Universal Gallery System Contracts

This document defines the strict contracts for the Universal Gallery System, including service boundaries, accessibility requirements, performance baselines, URL state management, and configuration precedence.

## Service Boundary Contract

### UniversalGalleryService - Data-Only Interface

The `UniversalGalleryService` maintains strict separation of concerns by returning **structured data only** - no HTML, CSS, or JavaScript.

#### Input Contract
```typescript
interface GalleryServiceInput {
  modelSlug: string;         // Model identifier
  themeId: string;           // Theme identifier  
  options?: {
    page?: number;           // Page number (1-based)
    category?: string;       // Category filter
    sort?: 'recent' | 'oldest' | 'featured' | 'popular';
    search?: string;         // Search query
    layout?: 'grid' | 'masonry' | 'carousel' | 'lightbox_grid';
  }
}
```

#### Output Contract
```typescript
interface GalleryServiceResponse {
  success: boolean;
  data?: GalleryDataV1;      // Structured data only
  error?: string;            // Error message if success=false
  timestamp: string;         // ISO 8601 timestamp
}

interface GalleryDataV1 {
  layout: 'grid' | 'masonry' | 'carousel' | 'lightbox_grid';
  items: GalleryItem[];      // Gallery items with metadata
  categories: string[];      // Available categories
  pagination: GalleryPagination;
  filters: GalleryFilters;   // Current filter state
  settings: GallerySettings; // Resolved configuration
}
```

#### Guarantees
- ✅ **No HTML/CSS/JS** in response data
- ✅ **Consistent structure** across all themes
- ✅ **Immutable data** - service doesn't modify database
- ✅ **Error isolation** - service errors don't crash rendering
- ✅ **Performance** - responses under 500ms for typical galleries

---

## Accessibility Baseline Requirements

All gallery implementations must meet **WCAG 2.1 AA** standards.

### Required Behaviors

#### Keyboard Navigation
- ✅ **Tab order**: Logical progression through gallery items
- ✅ **Focus indicators**: Visible focus outline (min 2px contrast)
- ✅ **Arrow keys**: Navigate between images in lightbox
- ✅ **ESC key**: Close lightbox/modals and return focus
- ✅ **Enter/Space**: Activate gallery items
- ✅ **Home/End**: Jump to first/last item in series

#### Focus Management
- ✅ **Focus trap**: Lightbox contains focus within modal
- ✅ **Focus restoration**: Return focus to trigger element on close
- ✅ **Skip links**: "Skip to gallery" link for screen readers
- ✅ **Logical order**: Focus follows visual layout

#### Screen Reader Support
```html
<!-- Required ARIA labels and roles -->
<div role="img" aria-label="Gallery of [count] images">
  <img src="..." alt="[descriptive alt text]" 
       aria-describedby="caption-id" />
  <div id="caption-id">[caption text]</div>
</div>

<!-- Lightbox requirements -->
<div role="dialog" 
     aria-modal="true" 
     aria-labelledby="lightbox-title"
     aria-describedby="lightbox-description">
  <h2 id="lightbox-title">Image Viewer</h2>
  <p id="lightbox-description">Use arrow keys to navigate, ESC to close</p>
</div>
```

#### Motion and Animation
- ✅ **Respect `prefers-reduced-motion`**: Disable animations when requested
- ✅ **Optional animations**: All animations can be disabled
- ✅ **No auto-play**: Carousels don't auto-advance by default
- ✅ **Pause controls**: User can pause any moving content

#### Color and Contrast
- ✅ **Contrast ratios**: Text 4.5:1, UI elements 3:1 minimum
- ✅ **Color independence**: Information not conveyed by color alone
- ✅ **Focus indicators**: High contrast focus outlines

### Testing Requirements
```bash
# Automated accessibility testing
npm run test:a11y          # Axe-core validation
npm run test:keyboard      # Keyboard navigation tests
npm run test:screenreader  # Screen reader compatibility
```

#### CI/CD Gates
- ❌ **Block deployment** on Axe violations
- ❌ **Block deployment** on keyboard navigation failures
- ⚠️ **Warn on deployment** for contrast issues

---

## Performance Baseline Requirements

### Core Web Vitals Targets
- ✅ **LCP (Largest Contentful Paint)**: < 2.5s
- ✅ **FID (First Input Delay)**: < 100ms  
- ✅ **CLS (Cumulative Layout Shift)**: < 0.1

### Image Optimization Requirements

#### Responsive Images
```html
<!-- Required: srcset and sizes -->
<img src="image-800w.jpg"
     srcset="image-400w.jpg 400w,
             image-800w.jpg 800w,
             image-1200w.jpg 1200w"
     sizes="(max-width: 768px) 100vw,
            (max-width: 1200px) 50vw,
            33vw"
     width="800" 
     height="600"
     loading="lazy"
     alt="Descriptive text" />
```

#### Dimension Requirements
- ✅ **Explicit dimensions**: `width` and `height` attributes prevent CLS
- ✅ **Aspect ratios**: CSS `aspect-ratio` for modern browsers
- ✅ **Fallback ratios**: `padding-bottom` technique for older browsers

#### Loading Strategy
- ✅ **Above fold**: Eager loading for first 3-6 images
- ✅ **Below fold**: Lazy loading with `loading="lazy"`
- ✅ **Intersection Observer**: Progressive enhancement for older browsers
- ✅ **Prefetch**: Next/previous lightbox images

### JavaScript Performance
- ✅ **Bundle size**: Gallery JS bundle < 50KB gzipped
- ✅ **Tree shaking**: Unused features not included
- ✅ **Code splitting**: Lazy load lightbox code until needed
- ✅ **Web Workers**: Heavy processing off main thread

### Network Optimization
- ✅ **CDN delivery**: All images served from CDN
- ✅ **Cache headers**: Long-term caching for images
- ✅ **Compression**: WebP/AVIF with fallbacks
- ✅ **Preconnect**: DNS/connection warm-up for image domains

### Performance Monitoring
```javascript
// Performance budget enforcement
const performanceBudget = {
  'bundle.js': '50KB',
  'gallery.css': '20KB',
  'images': '2MB total',
  'fonts': '100KB'
};

// Lighthouse CI thresholds
const lighthouseConfig = {
  performance: 85,    // Minimum score
  accessibility: 90,  // Minimum score
  bestPractices: 90,  // Minimum score
  seo: 95            // Minimum score
};
```

---

## URL State and SSR Contract

### URL Structure
```
/[model]/gallery?page=[n]&cat=[category]&sort=[order]&search=[query]&layout=[type]
```

#### Query Parameters
- `page`: Page number (1-based integer, default: 1)
- `cat`: Category filter (string, must match available categories)
- `sort`: Sort order (`recent|oldest|featured|popular`, default: `recent`)
- `search`: Search query (URL-encoded string)
- `layout`: Layout override (`grid|masonry|carousel|lightbox_grid`)

#### SSR Requirements
- ✅ **First render**: Server renders correct page based on query params
- ✅ **Hydration consistency**: Client and server render identical content
- ✅ **SEO friendly**: All gallery states are crawlable
- ✅ **Social sharing**: Each gallery state has unique URL

#### Client-Side Navigation
```javascript
// Required: Update URL without page reload
const updateURL = (newState) => {
  const url = new URL(window.location);
  url.searchParams.set('page', newState.page);
  url.searchParams.set('cat', newState.category);
  history.pushState(newState, '', url.toString());
};

// Required: Handle browser back/forward
window.addEventListener('popstate', (event) => {
  if (event.state) {
    renderGallery(event.state);
  }
});
```

#### Deep Linking
- ✅ **Shareable URLs**: Every gallery state can be bookmarked/shared
- ✅ **Restoration**: Reload page in exact same state
- ✅ **History**: Back/forward buttons work correctly
- ✅ **Analytics**: URL changes tracked for user journey analysis

---

## Configuration Precedence Model

### Hierarchy (Highest to Lowest Priority)
1. **Model-specific overrides** (stored in `model_gallery_page_content`)
2. **Theme-specific defaults** (from theme `gallery-config.json`)
3. **System-wide defaults** (from `gallery_system_defaults` table)

### Resolution Algorithm
```javascript
async function resolveGalleryConfig(modelSlug, themeId) {
  // 1. Start with system defaults (lowest priority)
  let config = await getSystemDefaults();
  
  // 2. Apply theme-specific overrides (medium priority)
  const themeConfig = await getThemeConfig(themeId);
  if (themeConfig?.galleryDefaults) {
    config = { ...config, ...themeConfig.galleryDefaults };
  }
  
  // 3. Apply model-specific overrides (highest priority)
  const modelConfig = await getModelConfig(modelSlug);
  if (modelConfig) {
    config = { ...config, ...modelConfig };
  }
  
  return config;
}
```

### Configuration Sources

#### System Defaults (Priority: 1)
```sql
-- Stored in gallery_system_defaults table
{
  "enable_lightbox": true,
  "enable_fullscreen": true,
  "show_captions": true,
  "show_image_info": false,
  "default_layout": "masonry",
  "images_per_page": 20
}
```

#### Theme Defaults (Priority: 2)
```json
// themes/[theme]/gallery-config.json
{
  "theme": "rose",
  "galleryDefaults": {
    "enable_lightbox": true,
    "show_captions": true,
    "default_layout": "grid",
    "images_per_page": 24
  }
}
```

#### Model Overrides (Priority: 3)
```sql
-- Stored in model_gallery_page_content table
-- Highest priority - overrides both system and theme defaults
SELECT enable_lightbox, enable_fullscreen, show_captions, default_layout
FROM model_gallery_page_content 
WHERE model_id = ?
```

### Validation Rules
- ✅ **Schema compliance**: All configuration levels must validate against schema
- ✅ **Type safety**: Runtime type checking for all config values
- ✅ **Fallback safety**: Invalid config values fall back to safe defaults
- ✅ **Conflict resolution**: Higher priority always wins, no merging of conflicting values

---

## Error Handling Contract

### Service Error Response
```typescript
interface ServiceError {
  success: false;
  error: string;              // Human-readable error message
  code?: string;              // Machine-readable error code
  details?: object;           // Additional error context
  timestamp: string;          // ISO 8601 timestamp
  retryable?: boolean;        // Whether retry might succeed
}
```

### Error Categories
- **Configuration errors**: Invalid theme config, missing required fields
- **Data errors**: Database connection issues, missing model data
- **Validation errors**: Invalid query parameters, malformed requests
- **Performance errors**: Timeout, rate limiting, resource exhaustion

### Graceful Degradation
- ✅ **Empty state**: Show "No images" message when no data available
- ✅ **Partial failure**: Display available images even if some fail to load
- ✅ **Configuration failure**: Fall back to basic theme with default settings
- ✅ **Network failure**: Show cached/offline content when possible

---

## Testing Contract

### Required Test Coverage
- ✅ **Unit tests**: Service methods, configuration resolution, data processing
- ✅ **Integration tests**: Database queries, theme config loading, API endpoints
- ✅ **E2E tests**: Complete user workflows, keyboard navigation, screen reader
- ✅ **Performance tests**: Load testing, Core Web Vitals measurement
- ✅ **Accessibility tests**: Axe violations, keyboard traps, color contrast

### Test Data Requirements
- ✅ **Fixture data**: Consistent test datasets across environments
- ✅ **Edge cases**: Empty galleries, single images, large datasets
- ✅ **Error scenarios**: Network failures, invalid configurations, missing data
- ✅ **Real-world data**: Production-like datasets for performance testing

---

This contracts document serves as the authoritative specification for all Universal Gallery System implementations. Any deviations from these contracts must be documented and approved through the standard change management process.