# About Page Content Editor Mapping

Maps fields in **Admin → About Page Content Editor** to the `model_about_page_content` table.

| UI Section | Field Label | DB Table | Column | Notes |
|------------|-------------|----------|--------|-------|
| Page Header | Page Title | model_about_page_content | page_title | |
| Page Header | Page Subtitle | model_about_page_content | page_subtitle | |
| Page Header | Show Title? | model_about_page_content | page_title_visible | boolean |
| Main Content | Main Paragraph 1 | model_about_page_content | main_paragraph_1 | |
| Main Content | Main Paragraph 2 | model_about_page_content | main_paragraph_2 | |
| Main Content | Main Paragraph 3 | model_about_page_content | main_paragraph_3 | |
| Main Content | Main Paragraph 4 | model_about_page_content | main_paragraph_4 | |
| Main Content | Section Visible | model_about_page_content | main_content_visible | boolean |
| Portrait Section | Portrait Visible | model_about_page_content | portrait_visible | boolean |
| Portrait Section | Portrait Image (ID) | model_about_page_content | portrait_image_id | FK → gallery_images.id |
| Portrait Section | Portrait Alt Text | model_about_page_content | portrait_alt | |
| Services Section | Services Visible | model_about_page_content | services_visible | boolean |
| Services Section | Services Title | model_about_page_content | services_title | |
| Services Section | Service 1 | model_about_page_content | service_1 | |
| Services Section | Service 2 | model_about_page_content | service_2 | |
| Services Section | Service 3 | model_about_page_content | service_3 | |
| Services Section | Service 4 | model_about_page_content | service_4 | |
| Services Section | Service 5 | model_about_page_content | service_5 | |
| Interests Section | Interests Visible | model_about_page_content | interests_visible | boolean |
| Interests Section | Interests Title | model_about_page_content | interests_title | |
| Interests Section | Interests Text | model_about_page_content | interests | |
| Facts Section | Facts Visible | model_about_page_content | facts_visible | boolean |
| Facts Section | Facts Title | model_about_page_content | facts_title | |
| Facts Section | Age | model_about_page_content | fact_age | |
| Facts Section | Show Age? | model_about_page_content | fact_age_visible | boolean |
| Facts Section | Height | model_about_page_content | fact_height | |
| Facts Section | Show Height? | model_about_page_content | fact_height_visible | boolean |
| Facts Section | Languages | model_about_page_content | fact_languages | |
| Facts Section | Show Languages? | model_about_page_content | fact_languages_visible | boolean |
| Facts Section | Education | model_about_page_content | fact_education | |
| Facts Section | Show Education? | model_about_page_content | fact_education_visible | boolean |
| Facts Section | Availability | model_about_page_content | fact_availability | |
| Facts Section | Show Availability? | model_about_page_content | fact_availability_visible | boolean |
| Facts Section | Custom Facts JSON | model_about_page_content | custom_facts | JSON list |
| Facts Section | Show Custom Facts? | model_about_page_content | custom_facts_visible | boolean |
| Gallery Section | Gallery Visible | model_about_page_content | gallery_visible | boolean |
| Gallery Section | Gallery Section ID | model_about_page_content | gallery_section_id | FK → gallery_sections.id |
| Gallery Section | Gallery Title | model_about_page_content | gallery_title | |
| CTA Section | Section Visible | model_about_page_content | about_cta_visible | boolean |
| CTA Section | CTA Title | model_about_page_content | cta_title | |
| CTA Section | CTA Description | model_about_page_content | cta_description | |
| CTA Section | CTA Button 1 Text | model_about_page_content | cta_button_1_text | |
| CTA Section | CTA Button 1 Link | model_about_page_content | cta_button_1_link | |
| CTA Section | CTA Button 2 Text | model_about_page_content | cta_button_2_text | |
| CTA Section | CTA Button 2 Link | model_about_page_content | cta_button_2_link | |
