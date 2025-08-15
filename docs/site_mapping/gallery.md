# Gallery Page Content Editor Mapping

Maps fields in **Admin → Gallery Page Content Editor** and Gallery Manager to their storage locations.

| UI Section | Field Label | DB Table | Column | Notes |
|------------|-------------|----------|--------|-------|
| Page Header | Page Title | model_gallery_page_content | page_title | |
| Page Header | Page Subtitle | model_gallery_page_content | page_subtitle | |
| Page Header | Page Description | model_gallery_page_content | page_description | |
| Page Header | Show Header? | model_gallery_page_content | gallery_header_visible | boolean |
| Layout Settings | Default Layout | model_gallery_page_content | default_layout | enum ('grid','masonry','carousel','slideshow') |
| Layout Settings | Default Grid Columns | model_gallery_page_content | images_per_page | represents per-page count (note: UI selects grid columns, but DB column stores images per page) |
| Layout Settings | Enable Filters | model_gallery_page_content | enable_filters | boolean |
| Layout Settings | Enable Lightbox | model_gallery_page_content | enable_lightbox | boolean |
| Layout Settings | Enable Fullscreen | model_gallery_page_content | enable_fullscreen | boolean |
| Layout Settings | Show Captions | model_gallery_page_content | show_captions | boolean |
| Navigation | Show Categories | model_gallery_page_content | show_categories | boolean |
| Navigation | Show Search | model_gallery_page_content | show_search | boolean |
| Navigation | Show Sort Options | model_gallery_page_content | show_sort_options | boolean |
| Categories Tab | Category Name | gallery_sections | title | |
| Categories Tab | Category Description | gallery_sections | description | |
| Categories Tab | Layout Type | gallery_sections | layout_type | |
| Categories Tab | Grid Columns | gallery_sections | grid_columns | |
| Categories Tab | Visible | gallery_sections | is_visible | boolean |
| Categories Tab | Sort Order | gallery_sections | sort_order | integer |
| Category Settings | Setting Key | gallery_section_settings | setting_key | key/value pair |
| Category Settings | Setting Value | gallery_section_settings | setting_value | |
| Images | Image File | gallery_images | filename | stored in filesystem, path derived |
| Images | Caption | gallery_images | caption | |
| Images | Alt Text | gallery_images | alt_text | |
| Images | Featured? | gallery_images | is_featured | boolean |
| Images | Active? | gallery_images | is_active | boolean |
| Images | Tags | image_tag_assignments | tag_id | FK → image_tags.id |
| Tags Manager | Tag Name | image_tags | name | unique |
