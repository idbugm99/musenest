# New Theme Build — Operator Instructions (for Claude)

> **Purpose**: Create a complete theme (assets, tokens, CSS, and pages) using our **DB schema**: `theme_sets`, `theme_set_pages`, `color_palettes`, and `color_palette_values`. Always ask the user targeted questions first, then generate everything without back‑and‑forth.

---

## 0. Prerequisites

* **Theme Sets** → stored in `theme_sets` (`name` field is kebab-case slug, MUST be unique; validate before insert), linked to pages via `theme_set_pages`.
* **Color Palettes** → stored in `color_palettes`, with their 17 token values in `color_palette_values` (using `palette_id` column).
* **CSS Variables** → themes must read palette values into CSS variables.
* **Assets** → `/themes/{slug}/assets/` for SVGs, images, and optional fonts.
* **Pages** → Home, About, Gallery, Services & Rates, FAQ, Calendar, Settings.
* **Theme Mapping** → Must be added to `/src/routes/model_sites.js` themeMapping object or theme won't load.

---

## 1. Intake Questions (must ask before building)

### A. Identity

1. Theme name (human) and **slug** (kebab-case).
2. Base theme to inherit from (`default`, `rose`, `dark`, `bdsm`) or start blank.

### B. Visual Direction

3. 3–6 style keywords (e.g., “gem, opulent, glossy”, “minimal, airy, serif”).
4. Mood reference (upload images or describe).
5. Layout vibe: compact / comfortable / spacious.

### C. Colors

6. Provide brand colors or say “generate from keywords”.
7. Preferred base: **light**, **dark**, or **auto**.
8. Accessibility target (AA minimum; AAA if specified). If custom palette inherits from an existing palette set `inherit=yes` and describe fallback strategy for any missing token (use parent token ▶️ default ▶️ computed tint).

### D. Typography

9. Preferred fonts (system or Google Fonts).
10. Display vs body weight ranges (e.g., 300–900).

### E. Icons / SVGs

11. Do you have SVGs to upload? If yes, upload and specify usage.
12. If not, search Font Awesome (free set only unless “Pro” specified). Clarify:

* Style (Solid/Regular/Brands).
* Stroke width (thin/regular/bold).
* Any icons to avoid.

### F. Motion

13. Parallax: apply to all pages / specific pages / none.
14. If enabled: speed (0.1–0.8), depth layers, and disable on mobile (yes/no).
15. Other animations: subtle fades only / include slides / include scale.

### G. Components Emphasis

16. Which sections are must‑have (hero, CTA, grid, testimonials, pricing, FAQ accordion, gallery masonry, contact form, calendar embed).

### H. Technical

17. Slug for model/site using this theme (must match models.slug); confirm it exists.  
18. Custom palette inheritance (yes/no).  
19. SEO/performance constraints (e.g., no heavy images, LCP < 2.5 s, provide WebP fallback).

> **After intake**: Summarize choices in a checklist and wait for a single “Confirm” before proceeding.

---

## 2. Plan Outputs

1. New entry in `theme_sets`.
2. New rows in `theme_set_pages` for required sections.
3. New row in `color_palettes` linked to theme\_set\_id.
4. 17 token rows in `color_palette_values`.
5. Handlebars templates and CSS variables (`themes/{slug}/{slug}.hbs` and `{slug}.css`).
6. Assets folder (`/themes/{slug}/assets/`).
7. Parallax configuration JSON.
8. README with build summary.
9. **SQL Patch file** (`/themes/{slug}/setup.sql`) containing all inserts inside a transaction so ops can replay the migration.

---

## 3. Color Palette Creation

* **If colors provided**: normalize to 17‑token schema.
* **If generated**: produce swatches (primary, secondary, accent, neutrals).
* Ensure contrast: WCAG AA (text & buttons ≥ 4.5 : 1). Flag any failures; if automated fix is allowed, adjust lightness by ±5 % increments until pass.

**Core 17 Tokens**:
`primary`, `secondary`, `accent`, `bg`, `bg-alt`, `surface`, `overlay`, `text`, `text-subtle`, `link`, `link-hover`, `focus`, `success`, `warning`, `error`, `border`, `border-muted`

---

## 4. Icons & SVGs

1. If user uploads SVGs: sanitize, store under `/themes/{slug}/assets/svg/`, and sprite if possible.
2. If using Font Awesome: search by keywords, suggest 6–12 options, confirm free vs Pro, normalize to 24×24, set `currentColor`.
3. Create `icons.json` mapping logical names to file paths.
4. If external fonts/SVGs are used, add required CSP `font-src` / `img-src` notes in README.

---

## 5. Parallax & Motion

* Create `/themes/{slug}/parallax.json` with global + page‑specific settings. If parallax is **on**, also add a `data-parallax="true"` attr to each section div.
* Respect reduced-motion preferences and mobile disables.

---

## 6. CSS Variables

* Generate `themes/{slug}/{slug}.css` – map the 17 tokens to `--theme-*` **exactly** like **Royal-Gem** does (this is the gold standard).  
* No other hex codes are allowed beyond the mapping block. Derived effects must use `color-mix()` / opacity over canonical vars.

---

## 7. Page Build

* **Home** → Hero, feature grid, CTA, testimonials (LIMIT: use `content.testimonials_display_count` from `model_home_page_content` table, fallback to 3).
* **About** → Bio, mission, photo banner, CTA.
* **Gallery** → Masonry grid, filters, lightbox.
* **Services & Rates** → Pricing cards, badges, CTA.
* **FAQ** → Accordion, contact CTA.
* **Calendar** → Availability embed using status-color map (`success`,`accent`,`warning`,`border-subtle`).
* **Settings** → Form controls styled with input tokens.

> Pages must: use 17 DB tokens, meet contrast targets, include focus-visible states, and respect reduced-motion.

---

## 8. DB Updates

* Add new theme to `theme_sets`.
* Insert page rows in `theme_set_pages`.
* Insert new palette in `color_palettes`.
* Insert 17 token rows into `color_palette_values`.
* **CRITICAL: Add theme name to theme mapping** in `/src/routes/model_sites.js` in the `themeMapping` object (line ~583).
* Wrap inserts in a single transaction; roll back on error.  
* Fill unspecified palette tokens with defaults (see §12) and document which were defaulted in README.

### Required API Calls and Database Fields

**Testimonials Display Limit**: Use `content.testimonials_display_count` from `model_home_page_content` table:
- Handlebars syntax: `{{#if (lt @index (or content.testimonials_display_count 3))}}`
- Database field: `testimonials_display_count INT DEFAULT 3`
- API endpoint: Loaded via `/api/model-home-page` or model content routes
- Fallback: Always provide fallback value of 3 if database value is null

### Database Schema Format (Use EXACT column names)

**theme_sets table:**
```sql
INSERT INTO `theme_sets` (
    `name`,                    -- kebab-case slug (NOT 'slug' column)
    `display_name`,           -- Human readable name
    `description`,            -- Theme description
    `category`,               -- enum: 'professional','luxury','creative','business'
    `features`,               -- JSON object of features
    `industry_features`,      -- JSON object of industry features
    `pricing_tier`,           -- enum: 'free','premium','enterprise'
    `is_active`              -- tinyint(1), default 1
) VALUES (...);
```

**color_palettes table:**
```sql
INSERT INTO `color_palettes` (
    `name`,                   -- kebab-case palette name
    `display_name`,           -- Human readable name
    `description`,            -- Palette description
    `is_system_palette`,      -- tinyint(1), set to 1 for themes
    `theme_set_id`,           -- FK to theme_sets.id
    `is_public`              -- tinyint(1), set to 1
) VALUES (...);
```

**color_palette_values table:**
```sql
INSERT INTO `color_palette_values` (
    `palette_id`,             -- FK to color_palettes.id (NOT color_palette_id)
    `token_name`,            -- Token name (e.g., 'primary', 'secondary')
    `token_value`,           -- Color value (e.g., '#d63384')
    `token_description`      -- Description of token usage
) VALUES (...);
```

**theme_set_pages table:**
```sql
INSERT INTO `theme_set_pages` (
    `theme_set_id`,          -- FK to theme_sets.id
    `page_type_id`,          -- FK to page_types.id (use: 1=home, 2=about, 3=contact, 4=gallery, 5=rates, 9=calendar, 16=etiquette)
    `template_file`,         -- Path to template file
    `has_custom_layout`,     -- tinyint(1), 1 for custom templates, 0 for inherited
    `features`,              -- JSON object of page features
    `is_available`          -- tinyint(1), default 1
) VALUES (...);
```

---

## 9. QA Checklist

* All text/buttons/links meet AA contrast.
* Hover/focus states visible.
* Parallax disabled under reduced-motion and on small screens.
* SVGs sanitized; icons aligned to 24px grid.
* No missing tokens; no console errors.
* Images optimized (≤ 200 kB, WebP preferred, lazy-loaded).

---

## 10. Deliverables

1. `/themes/{slug}/` folder with CSS, assets, `parallax.json`, and `icons.json`.
2. DB entries in `theme_sets`, `theme_set_pages`, `color_palettes`, `color_palette_values`.
3. Built pages with requested sections.
4. `README.md` summarizing choices.

---

## 11. Scripted Prompts for Claude

* **Intake start** → “I’m about to build a full theme. Answer these in one go…”
* **Icon source** → “Upload SVGs now, or say ‘search Font Awesome’ + keywords and style.”
* **Parallax** → “Apply to all pages, specific pages (list), or none? Speed? Disable on mobile?”
* **Confirm plan** → “Here’s the plan I’ll execute. Reply ‘Confirm’ to proceed.”
* **Completion** → “Theme generated. Here are your files, DB patch, and preview instructions.”

---

## 12. Minimal Defaults

If no colors are provided, set these **standard tokens** (editable later):

* `bg = #ffffff`
* `bg-alt = #f8fafc`
* `surface = #ffffff`
* `overlay = rgba(0, 0, 0, 0.05)`
* `text = #1e293b`
* `text-subtle = #64748b`
* `border = #e2e8f0`
* `border-muted = #e5e7eb`
* `primary = #3b82f6`
* `secondary = #6b7280`
* `accent = #0ea5e9`
* `link = #3b82f6`
* `link-hover = #2563eb`
* `focus = #2563eb`
* `success = #10b981`
* `warning = #f59e0b`
* `error = #ef4444`

---

## 13. Guided Page‑Build Plan (use `dynamic-theme-implementation-plan.md`)

**Goal**: Derive a concrete, page-by-page build plan directly from `docs/theme_design_instructions/dynamic-theme-implementation-plan.md` and execute it without back-and-forth.

**Steps**

1. **Read & Parse** the guidelines file. Extract required pages, sections, components, and any accessibility, motion, or content rules.
2. **Summarize Requirements** back to the user as a single checklist (pages, sections, motion rules, assets, icon set, typography, tokens) and request a single **“Confirm”**.
3. **Foundation**

   * Bind the selected color palette (17 tokens) to CSS variables.
   * Create typography scale and spacing tokens (consistent with guidelines).
   * Prepare icon map (`icons.json`) and parallax config if requested.
4. **Per‑Page Plan** (repeat for each page listed in the guidelines):

   * List sections in order (e.g., Home → Hero, Features, CTA, Testimonials, etc.).
   * For each section: layout spec, content placeholders, components, motion, and token usage.
   * Accessibility: heading order, focus states, contrast checks.
   * Responsiveness: breakpoints and stacking rules.
5. **Templates**

   * Generate Handlebars templates for each page/section with semantic HTML and classes that consume CSS variables.
   * Include conditional blocks for optional sections noted in the guidelines.
6. **Assets**

   * Place SVGs/icons and images in `/themes/{slug}/assets/`; update `icons.json` with logical names.
7. **DB Updates**

   * Ensure `theme_sets` has the theme, `theme_set_pages` has all pages/sections, and palette tokens are inserted in `color_palette_values`.
8. **QA Pass**

   * Validate against the guidelines: sections present, tokens applied, motion rules respected, a11y checks green.
9. **Deliver Plan + Artifacts**

   * Provide the final checklist, file map, and instructions to preview.

---

### Token Reference (Standardized)

`primary`, `secondary`, `accent`, `bg`, `bg-alt`, `surface`, `overlay`, `text`, `text-subtle`, `link`, `link-hover`, `focus`, `success`, `warning`, `error`, `border`, `border-muted`

---

## 13. Theme Design Guidelines Integration

* Follow the steps outlined in **theme\_design\_guidelines.md**.
* Create a detailed, step‑by‑step execution plan for building out the entire theme.
* Cover every themed page: Home, About, Gallery, Services & Rates, FAQ, Calendar, and Settings.
* Ensure each page uses the standardized tokens, mapped sections, and DB fields documented in the guidelines.
* Incorporate parallax, icons, typography, and motion effects as specified during intake.
* Provide a final checklist verifying that all pages are consistent with the guidelines and ready for QA.

---

**End of Instructions**
