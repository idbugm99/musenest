# Color System Implementation Plan

Here's a tight, no‑drift plan you can hand to Claude/Cursor today.

## Phase 1 — Crawl & Inventory (no opinions, just facts)

### What to scan
- `/themes/**/{*.css,*.scss,*.sass,*.less,*.html,*.hbs,*.jsx,*.tsx}`
- `/themes/**/tailwind.config.{js,ts}`
- Inline styles and utility classes in templates.

### What to extract
- **Hex**: `#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b`
- **RGB/A**: `rgba?\([^)]*\)`
- **HSL/A**: `hsla?\([^)]*\)`
- **CSS vars**: `var\(--[a-z0-9\-]+\)`
- **Tailwind color utilities**: `(?:bg|text|border|from|via|to|ring|outline)-(?:[a-z]+)-(?:\d{2,3})\b` (capture the rose-500 style names)
- **Gradients**: `linear-gradient\([^)]*\)`

### Output shape (per hit)
```json
{
  "theme": "rose",
  "file": "themes/rose/home.hbs",
  "line": 128,
  "usage": "bg",
  "raw": "#7C3AED",
  "context_hint": "btn-primary|nav|link|card|hero|footer|badge|chip|alert|table|tag"
}
```

### Drop‑in Node script (save as tools/color-audit.mjs)
```javascript
import fs from "node:fs";
import path from "node:path";

const ROOTS = ["themes"]; // add more roots if needed
const EXTS = new Set([".css",".scss",".sass",".less",".html",".hbs",".jsx",".tsx",".js",".ts"]);
const RE = {
  hex: /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g,
  rgb: /rgba?\([^)]*\)/g,
  hsl: /hsla?\([^)]*\)/g,
  cssVar: /var\(--[a-z0-9\-]+\)/gi,
  tw: /\b(?:bg|text|border|from|via|to|ring|outline)-([a-z]+)-(\d{2,3})\b/g,
  grad: /linear-gradient\([^)]*\)/g
};

const HINTS = [
  "btn","button","link","nav","header","footer","card","badge","chip","alert",
  "table","tag","hero","pill","banner","toast","tooltip","modal","input","select"
];

const results = [];

function scanFile(fp){
  const rel = fp;
  const theme = rel.split(path.sep)[1] || "unknown";
  const txt = fs.readFileSync(fp, "utf8");
  const lines = txt.split(/\r?\n/);
  const add = (m, line, type, extra={}) => {
    results.push({
      theme,
      file: rel,
      line,
      type,
      raw: m,
      usage: guessUsage(lines[line-1]),
      ...extra
    });
  };
  const run = (regex, type) => {
    lines.forEach((lineStr, idx) => {
      let m;
      regex.lastIndex = 0;
      while ((m = regex.exec(lineStr)) !== null) add(m[0], idx+1, type);
    });
  };
  run(RE.hex, "hex");
  run(RE.rgb, "rgb");
  run(RE.hsl, "hsl");
  run(RE.cssVar, "cssVar");
  run(RE.grad, "gradient");
  lines.forEach((lineStr, idx) => {
    let m;
    RE.tw.lastIndex = 0;
    while ((m = RE.tw.exec(lineStr)) !== null) {
      add(m[0], idx+1, "tailwind", { twColor: `${m[1]}-${m[2]}` });
    }
  });
}

function guessUsage(line){
  const lo = line.toLowerCase();
  for (const h of HINTS) if (lo.includes(h)) return h;
  if (/\bhover\b/.test(lo)) return "hover";
  if (/\bfocus\b/.test(lo)) return "focus";
  return "unknown";
}

function walk(dir){
  for (const ent of fs.readdirSync(dir, { withFileTypes:true })) {
    const fp = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(fp);
    else if (EXTS.has(path.extname(ent.name))) scanFile(fp);
  }
}

for (const r of ROOTS) if (fs.existsSync(r)) walk(r);

fs.mkdirSync("reports", { recursive:true });
fs.writeFileSync("reports/color-inventory.json", JSON.stringify(results, null, 2));
console.log(`Wrote reports/color-inventory.json with ${results.length} entries`);
```

### How to run
```bash
node tools/color-audit.mjs
# => reports/color-inventory.json
```

## Phase 2 — Normalize to your master token set

Use the universal tokens we discussed (bg, surface, text, primary, secondary, accent, link, btn-bg, btn-text, nav-bg, footer-bg, etc.). For each inventory row:

### Classifier rules (fast heuristics):
- If usage contains `btn` → `btn-bg` (and neighbors `btn-text`, `btn-bg-hover` from hover lines)
- `link` → `link` / `link-hover`
- `nav` → `nav-bg` or `nav-text` (decide by CSS property context if available)
- `footer` → `footer-bg`/`footer-text`
- `hero` with overlay/opacity → `overlay` or `hero-overlay-opacity`
- Borders → `border` / `card-border`
- If Tailwind class `text-*` → map to `text` unless inside nav/footer/card blocks
- If `unknown` → fall back to `accent` or keep as unknown bucket to review

### Emit a per‑theme mapping table
CSV columns: `theme,file,line,raw_type,raw_value,tw_color,usage_hint,token`

Provide a small post‑processor that reads `color-inventory.json`, applies the rules, and writes `reports/theme-token-map.csv`. (If you want, I can produce that script too.)

## Phase 3 — Build the "fancy table" (the one your UI will use)

Aggregate by `(theme, token)` → final default value. Where multiple distinct values map to the same token inside a theme:
- Prefer the most frequent value
- If conflict remains, keep both and flag for manual decision

### Output:
- `reports/palette-defaults.json` (machine)
- `reports/palette-defaults.csv` (human)

### Sample CSV:
```csv
theme,token,value,source_count,example_files
rose,primary,#7C3AED,12,"home.hbs, buttons.css, nav.css"
rose,secondary,#6B7280,7,"cards.css, badges.css"
rose,accent,#F59E0B,5,"cta.css"
rose,bg,#FFFFFF,18,"base.css"
rose,text,#1F2937,14,"typography.css"
...
```

## Phase 4 — Standardize + Fill Gaps

- Any missing tokens per theme → fill from nearest neighbor (text-muted from text at 70% opacity, etc.) so every theme has a complete token set.
- Convert CSS vars / Tailwind to tokens:
  - If you already use Tailwind, keep it—but bind utilities to CSS variables in the Tailwind config (so utilities still resolve via `var(--color-*)` under the hood).

## Phase 5 — Color Palette API System

### Database Schema (Completed ✅)
- **16 complete color palettes** with 79-80 tokens each
- **Two-tier system**: `theme_sets` (layout) + `color_palettes` (colors)
- **Custom palette workflow**: Models can create personalized color schemes
- **Proper relationships**: Foreign keys linking themes to default palettes

### Model Color Resolution Logic
**Current State Example - Model 39 (modelexample):**
- `models.theme_set_id = 1` (Basic theme - determines layout/templates)
- `models.active_color_palette_id = 1` (Ocean Blue palette - determines colors)
- **Result**: Basic theme layout with Ocean Blue colors

**Color Resolution Hierarchy:**
1. **Active Color Palette** (`models.active_color_palette_id`) - highest priority
2. **Theme Default Palette** (`theme_sets.default_palette_id`) - fallback
3. **System defaults** - final fallback

### Admin Panel Workflow
**Viewing Colors:**
- Load model's active theme and show current palette colors in table
- If `active_color_palette.created_by_model_id = current_model_id` → Show edit controls
- Else → Show read-only with "Create Custom" option

**Editing Colors (Custom Palette Creation):**
1. **Trigger**: Any color modification in admin panel
2. **Creates new entry**:
   ```sql
   INSERT INTO color_palettes (
       name: 'custom-[model_slug]-palette',
       is_system_palette: 0,
       created_by_model_id: [model_id],
       theme_set_id: [current_theme_id]
   )
   ```
3. **Copy + modify**: Clone current palette with user changes
4. **Update model**: `active_color_palette_id = [new_custom_palette_id]`

**Theme Switching:**
- Always resets `active_color_palette_id` to new theme's `default_palette_id`
- Preserves custom palettes for later reactivation
- Safety net: Can always return to known-good defaults

## Phase 6 — API Endpoints

### Required Endpoints
```javascript
// Get model's current color scheme
GET /api/models/:id/colors

// Get all available palettes for model
GET /api/models/:id/palettes

// Update model's active palette
PUT /api/models/:id/palette
Body: { palette_id: number }

// Create custom palette from edits
POST /api/models/:id/palettes/custom
Body: { 
  name: string,
  color_edits: { token_name: token_value }
}

// Update custom palette colors
PUT /api/palettes/:id/colors
Body: { token_name: token_value }
```

### Response Formats
```javascript
// Current color scheme response
{
  theme: { id, name, display_name },
  palette: { id, name, display_name, is_custom },
  colors: {
    primary: '#0ea5e9',
    secondary: '#0891b2',
    // ... all 79 tokens
  }
}
```

## Phase 7 — Template Integration

### Theme Renderer Updates
**Current**: Templates use hardcoded colors from theme CSS files
**New**: Templates receive color tokens from database at render time

### Handlebars Context Enhancement
```javascript
// In theme renderer
const colorContext = {
  theme: themeData,
  colors: paletteColors, // All 79 tokens from database
  model: modelData
};

// Template receives:
{{colors.primary}}     // '#0ea5e9'
{{colors.nav-bg}}      // '#0ea5e9' 
{{colors.btn-bg}}      // 'var(--primary)'
```

### CSS Variable Injection
```html
<style>
:root {
  --primary: {{colors.primary}};
  --secondary: {{colors.secondary}};
  --bg: {{colors.bg}};
  /* ... all tokens */
}
</style>
```

### Backward Compatibility
- Templates still work with hardcoded colors if database fails
- Gradual migration: Override specific tokens while keeping others static
- CSS variables provide clean abstraction layer

---

## Implementation Status

✅ **Completed Phases:**
1. **Color audit** - 607 color entries found across themes
2. **Token classification** - Mapped colors to semantic tokens  
3. **Default palettes** - Built complete color schemes for all themes
4. **Database schema** - Two-tier system with relationships
5. **Standardization** - 79-token schema with complete coverage
6. **Relationships** - Theme-to-palette foreign keys established
7. **Cleanup** - Removed obsolete tables

🔄 **Next Steps:**
1. **API endpoints** - Enable frontend access to color data
2. **Admin interface** - Update theme management UI
3. **Template integration** - Make pages render using database colors

**End Goal**: Models can select any theme layout + any color palette, with pages rendering dynamically using database values instead of hardcoded theme colors.