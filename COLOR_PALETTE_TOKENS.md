# Color Palette Token Reference

This document defines the complete set of color tokens that every color palette must support in the phoenix4ge theme system.

## Core Brand Colors
| Token | Description |
|-------|-------------|
| `primary` | Main brand or theme color |
| `secondary` | Complementary color to primary |
| `accent` | Highlight or accent color |

## Background Colors
| Token | Description |
|-------|-------------|
| `bg` | Default background |
| `bg-light` | Lighter background section |
| `bg-dark` | Darker background section |
| `surface` | Surface/background for cards, modals |
| `overlay` | Semi-transparent overlay layer |

## Text Colors
| Token | Description |
|-------|-------------|
| `text` | Default text color |
| `text-muted` | Subtle/less prominent text |
| `text-light` | Light text for dark backgrounds |
| `text-dark` | Dark text for light backgrounds |

## Border Colors
| Token | Description |
|-------|-------------|
| `border` | Default border |
| `border-light` | Lighter border |
| `border-dark` | Darker border |
| `divider` | Divider/separator lines |

## Link Colors
| Token | Description |
|-------|-------------|
| `link` | Link text |
| `link-hover` | Link on hover |
| `link-visited` | Link after visit |
| `link-active` | Active link state |
| `focus-ring` | Outline highlight for focus |

## Button Colors
| Token | Description |
|-------|-------------|
| `btn-bg` | Button background |
| `btn-text` | Button text |
| `btn-border` | Button border |
| `btn-bg-hover` | Button background hover |
| `btn-text-hover` | Button text hover |
| `btn-disabled-bg` | Disabled button background |
| `btn-disabled-text` | Disabled button text |

## Form Input Colors
| Token | Description |
|-------|-------------|
| `input-bg` | Input field background |
| `input-text` | Input text color |
| `input-border` | Input border |
| `input-placeholder` | Input placeholder text |
| `input-focus-ring` | Input focus outline |
| `switch-on` | Toggle/switch ON color |
| `switch-off` | Toggle/switch OFF color |

## Card Colors
| Token | Description |
|-------|-------------|
| `card-bg` | Card background |
| `card-text` | Card text |
| `card-border` | Card border |
| `card-shadow` | Card shadow |

## Navigation Colors
| Token | Description |
|-------|-------------|
| `nav-bg` | Navigation bar background |
| `nav-text` | Navigation text |
| `nav-border` | Navigation border |

## Footer Colors
| Token | Description |
|-------|-------------|
| `footer-bg` | Footer background |
| `footer-text` | Footer text |
| `footer-border` | Footer border |

## Hero Section Colors
| Token | Description |
|-------|-------------|
| `hero-bg` | Hero section background |
| `hero-text` | Hero section text |
| `hero-overlay` | Hero section overlay |

## Badge & Tag Colors
| Token | Description |
|-------|-------------|
| `badge-bg` | Badge background |
| `badge-text` | Badge text |
| `tag-bg` | Tag background |
| `tag-text` | Tag text |

## Table Colors
| Token | Description |
|-------|-------------|
| `table-header-bg` | Table header background |
| `table-header-text` | Table header text |
| `table-row-bg` | Table row background |
| `table-row-hover` | Table row hover |
| `table-border` | Table border |

## Alert & Status Colors
| Token | Description |
|-------|-------------|
| `alert-bg` | Alert background |
| `alert-text` | Alert text |
| `alert-border` | Alert border |
| `success` | Success/positive color |
| `warning` | Warning color |
| `danger` | Error/danger color |
| `info` | Informational color |

## Overlay & Modal Colors
| Token | Description |
|-------|-------------|
| `tooltip-bg` | Tooltip background |
| `tooltip-text` | Tooltip text |
| `popover-bg` | Popover background |
| `popover-text` | Popover text |
| `modal-bg` | Modal background |
| `modal-text` | Modal text |
| `backdrop` | Modal/page backdrop |

## Chart Colors
| Token | Description |
|-------|-------------|
| `chart-1` | Chart data series 1 |
| `chart-2` | Chart data series 2 |
| `chart-3` | Chart data series 3 |
| `chart-4` | Chart data series 4 |
| `chart-5` | Chart data series 5 |
| `chart-6` | Chart data series 6 |

## Usage Guidelines

### Creating New Color Palettes
1. **Every palette must define all 65 tokens** listed above
2. **Use semantic naming** - tokens should describe purpose, not appearance
3. **Maintain contrast ratios** - ensure text/background combinations meet WCAG AA standards
4. **Test across themes** - palettes should work with all theme layouts

### Implementation Notes
- Tokens can reference CSS variables (e.g., `var(--primary)`)
- Hex values, RGB, HSL, and named colors are supported
- Empty token values will fall back to theme defaults
- Custom palettes override theme defaults on a per-token basis

### Database Schema
```sql
CREATE TABLE theme_default_palettes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    theme_set_id INT NOT NULL,
    token_name VARCHAR(50) NOT NULL,
    token_description TEXT,
    token_value VARCHAR(100) NOT NULL,
    -- ... other fields
);
```

## Token Hierarchy
1. **Custom Palette Values** (highest priority)
2. **Theme Default Values** (medium priority)  
3. **System Fallback Values** (lowest priority)

This ensures that:
- Models can override any color with custom palettes
- Themes provide sensible defaults
- System never breaks due to missing colors