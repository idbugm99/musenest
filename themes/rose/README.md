# Rose Theme (Theme 17)

A refined, elegant theme with a rose-inspired visual language. This theme is visual-only: all functionality (galleries, pagination, lightbox, etc.) is handled by the Universal systems. The theme provides templates, sprite-based icons, and CSS tokens.

## Folder structure
- `layouts/main.handlebars`: Base layout; preloads the SVG sprite; adds skip-link and A11y defaults
- `partials/navigation.handlebars`: Primary navigation with ARIA roles and mobile menu
- `pages/`: Theme pages (home, about, gallery, rates, calendar, etiquette, contact)
- `assets/icons/sprite.svg`: Canonical icon sprite (24x24, stroke="currentColor")
- `public/themes/rose/rose.css`: Theme tokens and components
- `assets/rose-enhancements.css` and `rose-interactions.js`: Optional extra visuals/interactions

## Design tokens
Tokens are defined in `public/themes/rose/rose.css` and mapped to universal `--theme-*` variables.
- Accent: `--rose`, neutral: `--charcoal`, surfaces: `--porcelain`, metallic accent: `--gold`
- Mapped variables:
  - `--theme-accent`, `--theme-bg-primary|secondary|tertiary|light`, `--theme-text-*`, `--theme-border-*`, `--theme-card-bg`, `--theme-shadow*`

## Components in CSS
- `.theme-card`, `.rose-enhanced` (subtle gradient border), `.rose-button`
- `.rose-section-header .header-text` underline rule
- `.rose-vine-border` inner dashed border frame
- Focus visibility: `:where(a, button, .rose-button):focus-visible` for keyboard users

## Icon sprite usage
The sprite is preloaded once in `layouts/main.handlebars` (inserted at DOM start on `DOMContentLoaded`).

### Add an icon
```html
<svg class="rose-icon icon-md"><use href="/themes/rose/assets/icons/sprite.svg#rose"></use></svg>
```

### Utilities
- Base color: `.rose-icon { color: var(--rose); }`
- Sizes: `.icon-xs|.icon-sm|.icon-md|.icon-lg|.icon-xl`
- Variants: `.icon-accent`, `.icon-muted`

### Accessibility
Decorative icons must not be announced:
```html
<div aria-hidden="true">
  <svg class="rose-icon icon-sm" aria-hidden="true" focusable="false">
    <use href="/themes/rose/assets/icons/sprite.svg#bud"></use>
  </svg>
</div>
```
Active nav link uses a small bud icon; all decorative sprite containers were marked `aria-hidden`.

## Hero background, overlay opacity, parallax
Use `.rose-garden-bg` for parallax and color wash; provide image via inline style.

### Example (Home)
```handlebars
<section class="relative rose-garden-bg ..." 
         {{#if content.heroBackgroundImageUrl}}
           style="background-image: url('{{content.heroBackgroundImageUrl}}')"
         {{/if}}>
  {{#if content.heroBackgroundImageUrl}}
  <div class="absolute inset-0 bg-black" style="opacity: {{#if content.hero_background_opacity}}{{content.hero_background_opacity}}{{else}}{{#if hero_background_opacity}}{{hero_background_opacity}}{{else}}0.6{{/if}}{{/if}};"></div>
  {{/if}}
  ...
</section>
```

### Other pages
- About header: `about_content.headerBackgroundImageUrl`
- Rates header: `rates_content.headerBackgroundImageUrl`
- Rates extended: `rates_content.extendedBackgroundImageUrl`
- About additional: `about_content.additionalBackgroundImageUrl`
- Calendar header: `calendar_content.headerBackgroundImageUrl`
- Contact header: `contact_content.headerBackgroundImageUrl`
- Overlay opacity field (if present): `*_content.hero_background_opacity` or page-level `hero_background_opacity`; default `0.6`.

### Parallax fallbacks
- Mobile: `.rose-garden-bg { background-attachment: scroll; }` at `max-width: 768px`
- Reduced motion: respects `prefers-reduced-motion: reduce`
- Utility: `.rose-bg-fixed` to force fixed attachment if needed

## Navigation and A11y
- Skip link added before nav; `<main id="main-content">` target
- `<nav role="navigation" aria-label="Primary">`, desktop menu uses `role="menubar"` and `role="menuitem"`
- `aria-current="page"` for the active link
- Mobile menu announces the same via `role="menu"`

## Universal Gallery integration
- `pages/gallery.handlebars` uses the Universal Gallery render helper and overrides variables via `:root → --gallery-*` mapping. No theme JS modifies gallery behavior.

## Migration notes
- Remove legacy inline decorative SVGs/petal PNGs; replace with sprite `<svg><use ...></use></svg>`
- Use `.rose-icon` utilities for sizing and coloring; keep decorative containers `aria-hidden`
- Ensure DB has the image URL fields listed above if you want page-level hero images; the theme gracefully falls back to solid accent if unset
- Use universal `--theme-*` tokens in new components; do not hardcode brand colors in templates
- For CTAs over imagery, prefer light button on dark overlay (`bg-white text-gray-900`) which is used on Home/Rates when an image is present

## Theming tips
- Favor high contrast: deep text on light surfaces; white on accent/imagery
- Use sprite icons as dividers or small accents (not large background elements)
- Keep animations subtle; all motion respects reduced-motion settings

## Troubleshooting
- If icons don’t render: confirm sprite preload ran (look for hidden `<div id="rose-sprite">` in DOM) and the symbol ID exists in `assets/icons/sprite.svg`
- If parallax seems static: on mobile and reduced-motion, parallax is disabled by design
- If overlays look too dark/light: update `*_content.hero_background_opacity` or page-level `hero_background_opacity` in DB
