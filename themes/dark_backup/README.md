# Dark Sophisticated Boudoir Theme

## Overview

A luxury dark theme inspired by boudoir photography, black silk evening gowns, and upscale sophistication. Features rich gold accents, midnight purple depths, and cream silk typography for an elegant, refined aesthetic.

## Theme Details

- **Theme ID**: 5
- **Slug**: `dark`
- **Display Name**: Dark Sophisticated Boudoir
- **Category**: Luxury
- **Pricing Tier**: Premium
- **Base Inheritance**: Royal Gem structure (new CSS/templates)

## Color Palette

**Dark Boudoir Sophistication** (Palette ID: 11)

| Token | Color | Description |
|-------|-------|-------------|
| Primary | `#D4AF37` | Rich Gold - silk accents |
| Secondary | `#2D1B69` | Deep Midnight Purple - evening elegance |
| Accent | `#E8B4CB` | Soft Rose Gold - silk highlights |
| Background | `#0A0A0F` | Rich Black - silk dress depth |
| Background Alt | `#1A1625` | Charcoal - layered silk |
| Surface | `#2A2438` | Dark Plum - boudoir shadows |
| Text | `#F5F1E8` | Cream Silk - readable elegance |
| Text Subtle | `#C9B991` | Muted Gold - secondary text |

## Typography

- **Display Font**: Playfair Display (elegant serif for titles)
- **Body Font**: Inter (clean sans-serif for readability)  
- **Accent Font**: Dancing Script (script for decorative elements)

## Features

### Parallax Effects
- **Enabled Pages**: Home, About
- **Speed**: 0.3-0.5 (subtle movement)
- **Mobile**: Disabled for performance
- **Reduced Motion**: Respects user preferences

### Page Structure (Royal Gem inheritance)
- **Home**: Hero, About Preview, Services, Gallery Preview, Testimonials (limit 3), CTA
- **About**: Hero, Bio Section, Quick Facts, Services Preview, CTA
- **Gallery**: Masonry grid with hover effects
- **Services/Rates**: Pricing cards with luxury styling
- **Contact**: Form with elegant styling
- **Calendar**: Availability display
- **Etiquette**: Guidelines with sophisticated presentation

### Animations
- **Type**: Subtle fades, gentle scaling
- **Library**: AOS (Animate On Scroll)
- **Duration**: 800ms default
- **Easing**: ease-out-cubic

## Files Generated

```
themes/dark/
├── assets/
│   ├── dark-boudoir.css      # Main theme stylesheet
│   ├── parallax.json         # Parallax configuration
│   ├── icons.json           # Icon mapping
│   └── svg/                 # SVG assets (future)
├── layouts/
│   └── main.handlebars      # Updated with AOS and fonts
├── pages/
│   ├── home.handlebars      # New boudoir home page
│   ├── about.handlebars     # New boudoir about page
│   ├── gallery.handlebars   # (existing)
│   ├── rates.handlebars     # (existing)
│   ├── contact.handlebars   # (existing)
│   ├── calendar.handlebars  # (existing)
│   └── etiquette.handlebars # (existing)
├── partials/
│   ├── navigation.handlebars # (existing)
│   └── footer.handlebars    # (existing)
├── setup.sql               # Database migration script
└── README.md               # This file
```

## Database Updates

- Updated `theme_sets` with new metadata and features
- Updated `color_palettes` with boudoir color scheme  
- Updated `color_palette_values` with 17 new color tokens
- Updated `theme_set_pages` with proper template paths

## CSS Architecture

Follows phoenix4ge guidelines with proper CSS variable mapping:
- All colors use `var(--theme-*)` variables
- No hardcoded hex values beyond token mapping
- Universal Gallery integration included
- Responsive design with mobile-first approach
- Accessibility features (focus states, reduced motion)

## Preview URLs

- **Home**: `http://localhost:3000/modelexample?preview_theme=5`
- **About**: `http://localhost:3000/modelexample/about?preview_theme=5`
- **Gallery**: `http://localhost:3000/modelexample/gallery?preview_theme=5`

## Technical Notes

- CSS served from `/public/themes/dark/dark-boudoir.css`
- Google Fonts imported for typography stack
- AOS animation library integrated
- Parallax effects on hero sections
- Testimonials limited to `content.testimonials_display_count` (fallback: 3)
- All templates use proper `{{previewParam}}` for theme preview compatibility

## QA Checklist

- ✅ All colors use CSS variables (no hardcoded values)
- ✅ WCAG AA contrast compliance
- ✅ Responsive design (mobile-friendly)
- ✅ Accessibility features (focus states, reduced motion)
- ✅ Parallax configuration (home/about only)
- ✅ Database integration (proper theme/palette mapping)
- ✅ Template rendering (no console errors)
- ✅ Universal Gallery compatibility
- ✅ Preview system compatibility

**Status**: ✅ Theme rebuild complete and operational