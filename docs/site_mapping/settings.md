# Settings Module Field Mapping

Maps the fields on **Admin → Settings** to their storage locations.

| UI Path | Field Label | DB Table | Column | Notes |
|---------|-------------|----------|--------|-------|
| Admin → Settings → Basic Site Settings | Site Name | site_settings | site_name | |
| Admin → Settings → Basic Site Settings | Model Name | site_settings | model_name | |
| Admin → Settings → Basic Site Settings | Contact Email | site_settings | contact_email | |
| Admin → Settings → Basic Site Settings | Contact Phone | site_settings | contact_phone | |
| Admin → Settings → Basic Site Settings | Default Timezone | — | — | Orphan – not currently stored |
| Admin → Settings → Basic Site Settings | Tagline | site_settings | tagline | |
| Admin → Settings → Calendar Page | Calendar Page Visibility | — | — | Orphan – planned feature |
| Admin → Settings → Branding & Watermark | Header/Logo Image | site_settings | header_image | path string |
| Admin → Settings → Branding & Watermark | Watermark Image | site_settings | watermark_image | |
| Admin → Settings → Branding & Watermark | Watermark Size (% width) | site_settings | watermark_size | integer |
| Admin → Settings → Branding & Watermark | Watermark Opacity | site_settings | watermark_opacity | integer 0-100 |
| Admin → Settings → Branding & Watermark | Watermark Position | site_settings | watermark_position | enum |
