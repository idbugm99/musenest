## BDSM Theme - Implementation Notes

### Icons
- Sprite path: `/themes/bdsm/assets/icons/sprite.svg`
- Use with `<svg class="bdsm-icon icon-sm"><use href="/themes/bdsm/assets/icons/sprite.svg#handcuffs"></use></svg>`
- Sizes: `icon-xs|icon-sm|icon-md|icon-lg|icon-xl`
- Colors: default metal, or use `icon-accent` / `icon-muted`

### Layout
- Sprite preload handled in `layouts/main.handlebars`
- Divider before footer: `.bdsm-divider` with `.bdsm-divider__icon`

### Styles
- Core tokens and utilities in `public/themes/bdsm/bdsm.css`
- Cards: `.theme-card` with subtle leather texture
- Buttons: `.bdsm-btn`, variants: `--outline`, `--ghost`
- Badges: `.bdsm-badge --metal|--accent|--muted`
- Links: `.link-soft` for subtle underline on hover
- Reduced motion respected via `@media (prefers-reduced-motion: reduce)`

### Content
- All content is dynamic via DB bindings (no hardcoded copy)


