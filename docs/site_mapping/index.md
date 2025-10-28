# Admin UI → Database Field Mapping

This documentation catalogues how every editable field in the phoenix4ge admin interface is persisted to the database.

## Why this exists
1. Designers can see exactly which database columns a theme can surface or style.
2. Engineers can avoid creating orphan settings or leaving stale ones behind.
3. Scripts / AI agents can automatically reason about mappings by reading the machine-readable file `_machine-map.yaml`.

## File layout

| File | Purpose |
|------|---------|
| `_machine-map.yaml` | Machine-readable master mapping. One entry per field. |
| `settings.md` (and siblings) | Human-friendly per-page mapping tables. |
| `orphan_checker_example.py` | Script outline that shows how to detect orphan fields or unmapped DB columns. |

## Adding a new mapping
1. Edit `_machine-map.yaml` and add a new list item.
2. Add (or update) the relevant per-page `.md` file.
3. Run the orphan-checker script to confirm there are no new orphans.

## Page Index
- [Settings](settings.md)
- [About Page](about_page.md)
- [Gallery](gallery.md)
- [Rates & Services](services_rates.md)
- [FAQ](faq.md)
- [Calendar / Availability](calendar.md)
- [Home Page](home_page.md)
