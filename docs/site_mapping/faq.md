# FAQ Module Mapping

Maps fields in **Admin → FAQ Manager** to their storage locations.

| UI Section | Field Label | DB Table | Column | Notes |
|------------|-------------|----------|--------|-------|
| Categories | Category Name | faq_categories | name | |
| Categories | Category Slug | faq_categories | slug | unique per model |
| Categories | Description | faq_categories | description | |
| Categories | Visible | faq_categories | is_visible | boolean |
| Categories | Sort Order | faq_categories | sort_order | |
| FAQ Items | Question | faq_items | question | |
| FAQ Items | Answer | faq_items | answer | |
| FAQ Items | Category | faq_items | category_id | FK → faq_categories.id |
| FAQ Items | Visible | faq_items | is_visible | boolean |
| FAQ Items | Sort Order | faq_items | sort_order | |
