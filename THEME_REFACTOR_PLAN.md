# Theme/Template System Refactor Plan

## Goal
Create a hybrid theme system with shared templates and theme-specific styling to eliminate color coding nightmares and reduce maintenance overhead.

## Current State
- 4+ themes with nearly identical templates
- Inline styles hardcoded in each template
- Color changes require editing multiple handlebars files
- Adding new features means coding 4+ times

## Target State
- Shared base templates for common pages (home, about, rates, contact, calendar, gallery)
- Universal CSS variables for consistent color hierarchy
- Theme-specific styling only (CSS/layouts)
- Add new features once, work everywhere

## Phase 1: Standardize Color Hierarchy (PRIORITY)
**Timeline: Complete this phase first**

### 1.1 Define Universal Color Variables
- Create standard color hierarchy that works across all themes
- Define semantic names: `--theme-primary`, `--theme-secondary`, `--theme-accent`
- Map to actual colors per theme in theme CSS files

### 1.2 Update All Theme Layouts
- Add universal color variables to each theme's `main.handlebars`
- Dark: `--theme-primary: #a855f7`
- Rose: `--theme-primary: #dc2626`  
- Luxury: `--theme-primary: #d4af37`
- Modern: `--theme-primary: [define]`

### 1.3 Create Universal CSS Classes
- `.theme-bg-primary`, `.theme-text-primary`, `.theme-card`
- Same class names work across all themes
- Add to each theme's layout file

## Phase 2: Create Shared Templates
**Timeline: After Phase 1 complete**

### 2.1 Create Shared Directory Structure
```
themes/
├── shared/
│   ├── pages/
│   │   ├── home.handlebars
│   │   ├── about.handlebars
│   │   ├── rates.handlebars
│   │   ├── contact.handlebars
│   │   ├── calendar.handlebars
│   │   └── gallery.handlebars
│   └── components/
│       ├── testimonials.handlebars
│       ├── location-cards.handlebars
│       └── gallery-grid.handlebars
├── dark/layouts/main.handlebars
├── rose/layouts/main.handlebars
├── luxury/layouts/main.handlebars
└── modern/layouts/main.handlebars
```

### 2.2 Migrate Templates to Shared
- Take best template from existing themes
- Remove ALL inline styles
- Replace with universal CSS classes
- Test with all themes

### 2.3 Update Template Engine Routing
- Modify template loading to check shared/ first
- Allow theme-specific overrides if needed
- Update all page routes to use shared templates

## Phase 3: Cleanup & Testing
**Timeline: After Phase 2 complete**

### 3.1 Remove Duplicate Templates
- Delete theme-specific template files
- Keep only layouts and theme-specific overrides
- Clean up file structure

### 3.2 Test All Themes
- Verify each theme renders correctly
- Ensure color consistency
- Test theme switching functionality

### 3.3 Document System
- Create developer guide for adding new features
- Document color variable hierarchy
- Create component override guidelines

## Success Criteria
- [ ] One place to change colors (theme CSS files only)
- [ ] One template file per page type
- [ ] New features added once, work everywhere
- [ ] All themes maintain visual distinctiveness
- [ ] Zero inline styles in templates
- [ ] Theme switching works seamlessly

## Implementation Priority
1. **Phase 1.1-1.3**: Fix color hierarchy (CRITICAL - solves current nightmare)
2. **Phase 2.1-2.2**: Create shared templates  
3. **Phase 2.3**: Update routing
4. **Phase 3**: Cleanup and testing

## Notes
- Focus on Phase 1 first - this solves the immediate color coding problem
- Don't add new features during refactor
- Test frequently with existing themes
- Keep theme visual differences intact