# Template 5 "Velvet Nocturne" Dark Theme Redesign Plan

## Project Overview
Transform Template 5 (Modern) into a luxurious dark theme called "Velvet Nocturne" with BDSM-luxury aesthetic while maintaining all existing HTML structure and dynamic data.

## Non-Negotiables ✅
- [x] No HTML structure changes - only add classes and CSS
- [x] No image dimming filters (filter: brightness() etc.)  
- [x] Two visible slides in carousels mandatory
- [x] AA contrast minimum for all text; AAA for body text
- [x] Respect prefers-reduced-motion

## Phase 1: Foundation & Architecture

### Step 1.1: Create CSS File Structure
- [ ] Create `/themes/dark/velvet-nocturne.css`
- [ ] Set up CSS variable architecture
- [ ] Implement global foundation styles

### Step 1.2: CSS Variables Setup
```css
:root {
  /* Core Colors */
  --bg-0:#0c0c0f; --bg-1:#121218; --bg-2:#171722; --panel:#1c1c28;
  --ink-0:#ffffff; --ink-1:#e9e9f1; --ink-2:#b9b9c8; --muted:#8b8ba3;
  
  /* BDSM Luxe Accents */
  --accent:#00e0d1;          /* teal neon */
  --accent-2:#8a2be2;        /* electric violet */
  --cta:#ff2a6d;             /* seductive pink-red */
  --success:#31d0aa; --warn:#ffb84d; --error:#ff5577;
  
  /* Effects */
  --border:#252536; --border-soft:#1a1a26; 
  --glow: 0 0 24px rgba(0,224,209,.25);
  
  /* Typography */
  --font-sans: ui-sans-serif, Inter, system-ui, sans-serif;
  --font-display: "Cormorant Garamond", "Playfair Display", Georgia, serif;
  
  /* Spacing & Geometry */
  --radius-xs:8px; --radius:16px; --radius-lg:24px; --radius-xl:32px;
  --space-1:8px; --space-2:12px; --space-3:16px; --space-4:24px; 
  --space-5:32px; --space-6:48px;
  
  /* Motion */
  --easing:cubic-bezier(.22,.61,.36,1);
  --dur-1:120ms; --dur-2:220ms; --dur-3:420ms;
}
```

### Step 1.3: Global Foundation
- [ ] Implement radial gradient background
- [ ] Set base typography and color scheme
- [ ] Create `.section` and `.card` base classes

## Phase 2: Navigation & Header

### Step 2.1: Navigation Bar
- [ ] Implement matte black navbar with backdrop blur
- [ ] Add active page glow indicator
- [ ] Ensure AA contrast compliance

```css
.navbar { 
  background: rgba(10,10,14,.8); 
  backdrop-filter: blur(10px); 
  border-bottom:1px solid var(--border); 
}
.navbar a.active { 
  color: var(--ink-0); 
  box-shadow: inset 0 -2px 0 0 var(--accent); 
}
```

## Phase 3: Interactive Components

### Step 3.1: Button System
- [ ] Create sensual button base styles
- [ ] Implement `.btn-primary` with seductive gradient
- [ ] Add `.btn-outline` with teal accent
- [ ] Ensure hover states with subtle motion

### Step 3.2: Form Components
- [ ] Style `.input`, `.select`, `.textarea` 
- [ ] Implement focus states with teal glow
- [ ] Ensure large touch targets (≥40px)
- [ ] Test autofill compatibility

## Phase 4: Gallery & Carousel (Critical)

### Step 4.1: Carousel Container
- [ ] **CRITICAL**: Ensure two images visible on desktop
- [ ] Implement proper overflow masking
- [ ] Add dark panel background with glow

```css
.carousel-container { 
  position: relative; 
  overflow: hidden; 
  border-radius: var(--radius-lg); 
  border:1px solid var(--border); 
  background: #0f0f15; 
  box-shadow: var(--glow); 
  padding: var(--space-3); 
}
```

### Step 4.2: Carousel Track & Items
- [ ] Maintain `display:flex` on `.carousel-track`
- [ ] Set proper flex basis: 320px desktop, 280px tablet, 100% mobile
- [ ] **NO FILTERS** on `.gallery-image` - preserve vivid photography

### Step 4.3: Navigation Controls
- [ ] Style carousel arrows with glass morphism
- [ ] Implement dots with active teal glow
- [ ] Position at z-8 (above images but below modals)

### Step 4.4: Responsive Carousel Rules
- [ ] Desktop: 2 images visible
- [ ] Tablet (≤1024px): 1.5 images visible 
- [ ] Mobile (≤720px): 1 image visible

## Phase 5: Content Cards & Layout

### Step 5.1: Rate Cards
- [ ] Implement leather-panel gradient effect
- [ ] Add subtle accent borders
- [ ] Style pricing typography with display font

### Step 5.2: Badges & Tags
- [ ] Create base `.badge` styling
- [ ] Add `.badge.kink` with teal accent
- [ ] Implement `.badge.premium` with pink accent

## Phase 6: Modal & Lightbox

### Step 6.1: Lightbox Implementation
- [ ] Dark backdrop with blur
- [ ] Ensure z-30 layering (highest)
- [ ] ESC key functionality
- [ ] **NO OVERLAYS** above images

```css
.lightbox-backdrop { 
  position:fixed; 
  inset:0; 
  background: rgba(0,0,0,.75); 
  backdrop-filter: blur(6px); 
}
```

## Phase 7: Motion & Accessibility

### Step 7.1: Micro-interactions
- [ ] Implement `.hover-rise` class
- [ ] Use subtle scale/translate (no bouncy effects)
- [ ] Respect `prefers-reduced-motion`

### Step 7.2: Accessibility Compliance
- [ ] Body text ≥16px, line-height 1.5-1.7
- [ ] Focus states distinct from hover (teal ring)
- [ ] Touch targets ≥40px height
- [ ] WCAG AA contrast testing

## Phase 8: Page-Specific Styling

### Step 8.1: Hero Sections
- [ ] Short copy styling with display font
- [ ] Primary CTA + secondary button layout
- [ ] Sensual phrasing implementation

### Step 8.2: Content Sections
- [ ] Apply `.section` class to major content blocks
- [ ] Implement card layouts for rate tables
- [ ] Style gallery collections

## Phase 9: Z-Index & Layering

### Step 9.1: Layer Hierarchy
- [ ] z-10: header/navbar
- [ ] z-20: dropdowns/navigation
- [ ] z-30: modals/lightbox
- [ ] z-8: carousel navigation
- [ ] z-5: carousel/images
- [ ] z-0: decorative elements

## Phase 10: Integration & Testing

### Step 10.1: Template Integration
- [ ] Add CSS file to Template 5 structure
- [ ] Apply classes to existing HTML elements
- [ ] Test all dynamic data functionality

### Step 10.2: Cross-Browser Testing
- [ ] Chrome/Safari/Firefox compatibility
- [ ] Mobile responsiveness verification
- [ ] Touch interaction testing

## Phase 11: Final QA Checklist

### Step 11.1: Accessibility Audit
- [ ] All text passes WCAG AA on dark backgrounds
- [ ] Focus indicators visible and distinct
- [ ] Keyboard navigation functional
- [ ] Screen reader compatibility

### Step 11.2: Functionality Verification
- [ ] Two images visible in desktop carousel
- [ ] One image visible on mobile carousel
- [ ] Lightbox opens above all elements
- [ ] ESC closes lightbox
- [ ] All buttons have hover/active/focus states

### Step 11.3: Visual Quality Assurance
- [ ] No element uses opacity:0/visibility:hidden unintentionally
- [ ] No CSS hides images or places overlays above them
- [ ] Forms readable with themed autofill states
- [ ] Image loading performance optimized (first two: loading="eager")

### Step 11.4: Motion & Performance
- [ ] `prefers-reduced-motion` respected
- [ ] Smooth transitions without jank
- [ ] GPU acceleration where appropriate
- [ ] No accessibility violations

## Implementation Order Priority

1. **Phase 1** (Foundation) - Critical base setup
2. **Phase 4** (Gallery/Carousel) - Most complex, highest risk
3. **Phase 2** (Navigation) - User experience foundation  
4. **Phase 3** (Interactive Components) - User interaction
5. **Phase 5-6** (Cards/Modals) - Content presentation
6. **Phase 7-8** (Motion/Page-specific) - Polish
7. **Phase 9** (Z-Index) - Layer management
8. **Phase 10-11** (Integration/Testing) - Quality assurance

## Success Criteria

✅ **Functional Requirements:**
- Two gallery images visible simultaneously on desktop
- All existing Template 5 functionality preserved
- No image dimming or hiding filters applied
- Smooth carousel navigation with proper boundaries

✅ **Design Requirements:**
- Luxurious dark theme with BDSM-luxury aesthetic
- Teal/violet/pink accent color scheme implemented
- Professional typography with display fonts
- Subtle motion and hover effects

✅ **Accessibility Requirements:**
- WCAG AA compliance for all text
- AAA compliance for body text where possible
- Keyboard navigation fully functional
- Screen reader compatibility maintained

✅ **Performance Requirements:**
- Smooth 60fps animations
- Fast loading with optimized image delivery
- Mobile-responsive across all breakpoints
- Cross-browser compatibility

## Risk Mitigation

**High Risk Areas:**
1. **Carousel functionality** - Test extensively with multiple images
2. **Z-index conflicts** - Document all layering decisions
3. **Accessibility compliance** - Regular contrast testing
4. **Mobile responsiveness** - Test on actual devices

**Mitigation Strategies:**
- Incremental implementation with testing at each phase
- Backup of original Template 5 before modifications
- Automated accessibility testing tools
- Cross-browser testing suite

---

**Estimated Timeline:** 3-4 development sessions
**Testing Phase:** 1 session dedicated to QA
**Total Effort:** 4-5 focused work sessions

This plan ensures systematic implementation while maintaining all non-negotiable requirements and delivering a premium dark theme experience.