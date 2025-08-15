# Home Page Content Editor Mapping

Maps fields in **Admin → Home Page Content Editor** to the `model_home_page_content` table.

| UI Section | Field Label | DB Table | Column | Notes |
|------------|-------------|----------|--------|-------|
| About Section | Link Destination | model_home_page_content | about_link_destination | enum ('about','contact','gallery','rates','calendar') |
| About Section | Link Text | model_home_page_content | about_link_text | |
| About Section | About Section Visible | model_home_page_content | about_section_visible | boolean |
| About Section | Title | model_home_page_content | about_title | |
| About Section | First Paragraph | model_home_page_content | about_paragraph_1 | |
| About Section | Second Paragraph | model_home_page_content | about_paragraph_2 | |

| UI Section | Field Label | DB Table | Column | Notes |
| Hero Section | Section Visible | model_home_page_content | hero_section_visible | boolean |
| Hero Section | Title | model_home_page_content | hero_title | |
| Hero Section | Subtitle | model_home_page_content | hero_subtitle | |
| Hero Section | Background Image ID | model_home_page_content | hero_background_image_id | FK → gallery_images.id |
| Hero Section | Background Opacity | model_home_page_content | hero_background_opacity | decimal |
| Hero Section | Button 1 Text | model_home_page_content | hero_button_1_text | |
| Hero Section | Button 1 Link | model_home_page_content | hero_button_1_link | |
| Hero Section | Button 2 Text | model_home_page_content | hero_button_2_text | |
| Hero Section | Button 2 Link | model_home_page_content | hero_button_2_link | |

| Portrait Section | Section Visible | model_home_page_content | portrait_section_visible | boolean |
| Portrait Section | Portrait Image ID | model_home_page_content | portrait_image_id | FK → gallery_images.id |
| Portrait Section | Alt Text | model_home_page_content | portrait_alt | |
| Gallery Section | Gallery Section Visible | model_home_page_content | gallery_section_visible | boolean |
| Gallery Section | Gallery Section Title | model_home_page_content | gallery_section_title | |
| Gallery Section | Featured Gallery Section ID | model_home_page_content | featured_gallery_section_id | FK → gallery_sections.id |
| Gallery Section | Gallery Button Text | model_home_page_content | gallery_button_text | |
| Gallery Section | Gallery Button Link | model_home_page_content | gallery_button_link | |
