# Rates & Services Mapping

Maps fields in **Admin → Rates Page Content Editor** and Services tables to their storage locations.

| UI Section | Field Label | DB Table | Column | Notes |
|------------|-------------|----------|--------|-------|
| Page Header | Page Title | model_rates_page_content | page_title | |
| Page Header | Page Subtitle | model_rates_page_content | page_subtitle | |
| Page Header | Section Visible | model_rates_page_content | rates_header_visible | boolean |
| Sticky Navigation Labels | Rates | model_rates_page_content | nav_rates_label | *Stored in flexible CT key—see note* |
| Sticky Navigation Labels | Extended | model_rates_page_content | nav_extended_label | "" |
| Sticky Navigation Labels | Services | model_rates_page_content | nav_services_label | "" |
| Sticky Navigation Labels | Policies | model_rates_page_content | nav_policies_label | "" |
| Sticky Navigation Labels | Payment | model_rates_page_content | nav_payment_label | "" |
| Sticky Navigation Labels | Contact | model_rates_page_content | nav_contact_label | "" |
| Rates Table | Incall Rates Visible | model_rates_page_content | rates_incall_visible | boolean |
| Rates Table | Outcall Rates Visible | model_rates_page_content | rates_outcall_visible | boolean |
| Rates Table | Extended Rates Visible | model_rates_page_content | rates_extended_visible | boolean |
| Incall Rates | Service Name | services | name | category_id references incall category |
| Incall Rates | Duration | services | duration | |
| Incall Rates | Price | services | price | |
| Incall Rates | Is Active | services | is_active | |
| Outcall Rates | Service Name | services | name | category_id references outcall category |
| Outcall Rates | Duration | services | duration | |
| Outcall Rates | Price | services | price | |
| Additional Services | Service Name | services | name | category_id references additional services category |
| Additional Services | Description | services | description | |
| Additional Services | Price | services | price | |
| Service Categories | Category Name | service_categories | name | |
| Service Categories | Slug | service_categories | slug | |
| Service Categories | Visible | service_categories | is_visible | boolean |
| Policies & Terms | Terms Visible | model_rates_page_content | terms_visible | boolean |
| Policies & Terms | Terms Title | model_rates_page_content | terms_title | |
| Policies & Terms | Terms Content | model_rates_page_content | terms_content | |
| CTA Section | CTA Visible | model_rates_page_content | cta_visible | boolean |
| CTA Section | CTA Title | model_rates_page_content | cta_title | |
| CTA Section | CTA Description | model_rates_page_content | cta_description | |
| CTA Section | CTA Button 1 Text | model_rates_page_content | cta_button_1_text | |
| CTA Section | CTA Button 1 Link | model_rates_page_content | cta_button_1_link | |
| CTA Section | CTA Button 2 Text | model_rates_page_content | cta_button_2_text | |
| CTA Section | CTA Button 2 Link | model_rates_page_content | cta_button_2_link | |

*Note: some sticky navigation labels are stored via the Content Template (CT) key-value system rather than dedicated columns. These will be captured once the CT mapping is documented.*
