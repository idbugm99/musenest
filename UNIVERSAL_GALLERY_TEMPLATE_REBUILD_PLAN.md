# Universal Gallery & Template Rebuild — Phased Engineering Plan

> **Read first (do not repeat here):**
>
> 1. `TEMPLATE_FIELD_NAMING_SCHEME.md`
> 2. `TEMPLATE_CREATIVE_FLEXIBILITY_GUIDELINES.md`
> 3. `MUSENEST_TEMPLATE_REBUILD_CHECKLIST.md`

This plan operationalizes the must‑fix gaps, clarifications, and future options into concrete phases with deliverables, acceptance criteria, and rollback notes.

---

## Phase 0 — Planning & Contracts

**Goals**

* Lock a strict contract for theme configs.
* Define data‑only service boundary.
* Set shared acceptance criteria (a11y, perf, URL state).

**Tasks**

* **T0.1 Schema/Interface:** Define `ThemeGalleryAdapter` **JSON Schema** (and matching TypeScript interface) with required/optional keys, defaults, examples, and version `v1`.
* **T0.2 Validation:** Implement runtime validation (build‑time + server‑side). Unknown keys → error; missing keys → clear error; optional keys → safe defaults.
* **T0.3 Service Boundary:** Specify `UniversalGalleryService` return shape (data only):

  ```ts
  type GalleryDataV1 = {
    layout: 'grid'|'masonry'|'carousel',
    items: Array<{ id:string; alt:string; caption?:string; srcThumb:string; srcMed:string; srcFull:string; aspect:number; flagged?:boolean; }>,
    categories: string[],
    pagination: { page:number; pageSize:number; total:number },
    filters: { category?:string; sort?:'recent'|'popular' },
    settings: { lightbox:boolean; masonryRowHeight?:number; gridCols:{sm:number;md:number;lg:number} }
  }
  ```
* **T0.4 Accessibility Baseline:** Document required behaviors: focus trap, ESC close, arrow‑key nav, visible focus, `aria-label`s, restore focus on close, `prefers-reduced-motion` handling, Axe pass.
* **T0.5 Performance Baseline:** `srcset/sizes`, explicit dimensions/aspect to prevent CLS, lazy loading below fold, prefetch next lightbox image, CDN caching guidelines.
* **T0.6 URL State:** Define SSR + query‑param contract: `?page=2&cat=portraits&sort=recent`. Hydrate with same data to avoid mismatch.
* **T0.7 Precedence Model:** System defaults → Theme overrides → Model overrides (model wins). Write once in helper.

**Deliverables**

* `ThemeConfigSchema.json` + `types/theme.d.ts`
* `docs/CONTRACTS.md` (service boundary, URL state, precedence, a11y/perf)

**Acceptance Criteria**

* Schema validated at build & runtime; bad configs fail loudly.
* Service returns **no HTML/JS**—data only.
* A11y/perf/URL state baselines documented.

**Rollback**

* None (no prod impact yet).

---

## Phase 1 — Core Universal Gallery (Data → Partials → JS Modules)

**Goals**

* Build the universal gallery rendering stack with **partial overrides** per theme.
* Integrate moderation filtering and visibility.

**Tasks**

* **T1.1 Service Impl:** Build `UniversalGalleryService` (filters moderation, visibility, pagination, categories).
* **T1.2 Partials:** Create core Handlebars partials:

  * `gallery/container.hbs`, `gallery/item.hbs`, `gallery/pagination.hbs`, `gallery/filters.hbs`
  * Use `escapeHTML()` utility for all user strings.
* **T1.3 Enhancements:** JS modules (lightbox, masonry, prefetch) as **progressive enhancement** (no inline JS).
* **T1.4 Theme Hooks:** Enable **named partial overrides**: if `themes/<theme>/partials/gallery/item.hbs` exists, use it; else fallback to core.
* **T1.5 URL State:** SSR first render per query params; pushState on client transitions; handle back/forward.
* **T1.6 Empty/Error States:** "No images yet" panel; per‑item 404 placeholder; admin‑only misconfig warnings.

**Deliverables**

* `services/universal-gallery.ts`
* `views/partials/gallery/*`
* `public/js/gallery/*.js` (lightbox, masonry, prefetch)
* `utils/escapeHTML.ts`

**Acceptance Criteria**

* Works with Basic theme without code changes to templates.
* Axe pass, CLS < 0.05 (test page), lazy loading enabled, prefetch next image.
* URL reflects pagination/filter; sharable/reloadable.

**Rollback**

* Feature‑flag the route to Basic only.

---

## Phase 2 — Admin, API, and Data Model Hardening

**Goals**

* Safe admin editing with scopes and RBAC.
* Idempotent migrations and rollbacks.

**Tasks**

* **T2.1 Scopes & Precedence:** Implement "System defaults → Theme → Model" storage. Add `defaults_version`.
* **T2.2 Admin UI:** Settings editor with scope switcher, validation, and preview. ETag/optimistic concurrency to avoid overwrites.
* **T2.3 API:** GET/PUT endpoints for gallery settings honor schema; return validation errors with actionable messages.
* **T2.4 Migrations:** Batched, idempotent `UP/DOWN` scripts; indexes for any new FKs; migration log table.
* **T2.5 RBAC:** Enforce owner/admin/designer roles on settings endpoints.

**Deliverables**

* Admin forms/views + API handlers
* Migration scripts + `docs/MIGRATIONS.md`
* RBAC policy notes

**Acceptance Criteria**

* Invalid configs rejected with clear error.
* Concurrent admin edits resolved safely.
* Rollback works cleanly.

**Rollback**

* Revert to previous settings tables via DOWN scripts.

---

## Phase 3 — Template Rebuilds (Visual Only, Data‑Compatible)

**Goals**

* Rebuild themes 2–8 **without** altering data contracts.

**Per‑Template Tasks** *(repeat for each)*

* **T3.x.1 Clone from Basic** (preserve all `_visible` toggles, field names, fallbacks).
* **T3.x.2 Apply visual system** per theme brief (layout, tokens, cards, gradient, shadows).
* **T3.x.3 Gallery integration:** use universal partials; add **optional** theme partial overrides only if needed.
* **T3.x.4 QA against same dataset:** swapping Basic ↔ theme must not break.
* **T3.x.5 Docs:** note any **optional** new fields; follow Add‑New‑Field protocol (admin+DB+API), keep optional with defaults.

**Themes**

* `glamour`, `luxury`, `modern`, `dark`, `escort_glamour`, `camgirl_glamour`, `salon_glamour`

**Deliverables**

* Updated theme folders with templates/CSS tokens.
* Short per‑theme QA sheet (checklist below).

**Acceptance Criteria**

* Plug‑and‑play from Basic data; no errors, no hardcoded text.
* All `_visible` honored.
* Lighthouse (dev): Perf ≥ 85, A11y ≥ 90.

**Rollback**

* Revert theme switch to Basic; themes are additive.

---

## Phase 4 — Accessibility & Performance Enforcement in CI

**Goals**

* Prevent regressions automatically.

**Tasks**

* **T4.1 Tests:**

  * **Unit:** schema validation, service data shaping.
  * **Snapshot:** partials with fixture data (grid/masonry/carousel).
  * **E2E (Playwright):** keyboard nav, focus trap, ESC close, URL state, mobile tap targets.
  * **Axe CI:** block on violations.
  * **Perf CI:** budget checks (FCP, CLS, JS size).
* **T4.2 Linting/CSP:** ESLint config, `helmet` CSP (no inline JS; `nonce` for scripts).

**Deliverables**

* `ci/` configs, Playwright tests, Axe runner, perf budgets.

**Acceptance Criteria**

* CI blocks on a11y/perf regressions and invalid theme configs.

**Rollback**

* Temporarily relax thresholds (documented) if needed; do not remove tests.

---

## Phase 5 — i18n Hooks (Future‑Ready)

**Goals**

* Prepare for translations without altering templates later.

**Tasks**

* **T5.1 Strings Map:** Centralize UI strings (buttons/labels) in a translations map; content remains DB‑driven.
* **T5.2 Helpers:** `t('key')` helper with locale selection; default to `en`.
* **T5.3 Fallbacks:** If key missing, show English and log once.

**Deliverables**

* `i18n/` files, `helpers/t.ts`, minimal docs.

**Acceptance Criteria**

* Templates compile with `t()` without requiring immediate translations.

**Rollback**

* Use English map only.

---

## Phase 6 — (Optional Later) Feature Flags & Deprecation Policy

**Goals**

* Controlled rollout and clean lifecycle.

**Tasks**

* **T6.1 Flags:** Server‑side flags for universal gallery per tenant/theme.
* **T6.2 Analytics (privacy‑safe):** Minimal event schema (IDs only), sampling, opt‑out per tenant.
* **T6.3 Deprecation:** Publish dates for retiring legacy theme‑local galleries; migration path & comms.

**Deliverables**

* Feature flag config, analytics doc, deprecation policy.

**Acceptance Criteria**

* Staged rollout possible; legacy paths documented.

**Rollback**

* Flip flag off.

---

## Cross‑Phase Checklists

### Definition of Done (per theme)

* [ ] Uses Basic's fields & `_visible` toggles exactly; no renames.
* [ ] Universal gallery integrated; overrides are optional and minimal.
* [ ] All user strings escaped; no inline JS; CSP passes.
* [ ] Axe: no violations; keyboard flows pass; `prefers-reduced-motion` respected.
* [ ] Images: `srcset/sizes`, fixed aspect, lazy‑load; CLS < 0.05.
* [ ] URL state sharable; SSR first load; hydration consistent.
* [ ] Lighthouse (dev): Perf ≥ 85, A11y ≥ 90.
* [ ] No console errors/warnings.
* [ ] QA sheet completed with screenshots (mobile/desktop).

### Risk & Rollback

* **Risk:** Theme config drift → **Mitigation:** strict schema + validation.
* **Risk:** A11y regressions → **Mitigation:** Axe in CI + E2E.
* **Risk:** CLS from images → **Mitigation:** aspect/width/height + srcset.
* **Rollback:** Theme flag off, revert to Basic; DOWN migrations ready.

---

## Ownership (suggested)

* **Contracts & Schema:** Lead Engineer
* **Service & Partials:** Frontend Eng + Templating Eng
* **Admin/API/DB:** Full‑stack Eng
* **A11y/Perf CI:** QA Eng + DevOps
* **Themes 2–8:** Design Engs (one owner per theme)
* **Docs:** Tech Writer / PM

---

## Timeline (indicative, parallelizable)

* **P0–P1:** 1–2 weeks (contracts, service, core partials)
* **P2:** 1 week (admin/API/migrations)
* **P3:** 1–2 weeks per 3 themes (run in parallel)
* **P4:** 1 week (CI hardening)
* **P5–P6:** As needed (future)

---

## References

* See the **Documentation Suite** for field naming, creative boundaries, and the rebuild checklist.
* All teams must **read those three docs** before starting and use this phased plan as the execution map.