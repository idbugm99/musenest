-- Backup of gallery configurations before Universal Gallery Admin refactor
-- Generated: August 17, 2025
-- Purpose: Preserve existing gallery configurations during system refactor

-- Backup business_types table
CREATE TABLE backup_business_types_20250817 AS SELECT * FROM business_types;

-- Backup gallery_business_configs table  
CREATE TABLE backup_gallery_business_configs_20250817 AS SELECT * FROM gallery_business_configs;

-- Backup gallery_layout_types table
CREATE TABLE backup_gallery_layout_types_20250817 AS SELECT * FROM gallery_layout_types;

-- Backup gallery_system_defaults table
CREATE TABLE backup_gallery_system_defaults_20250817 AS SELECT * FROM gallery_system_defaults;

-- Backup model_gallery_sections table
CREATE TABLE backup_model_gallery_sections_20250817 AS SELECT * FROM model_gallery_sections;

-- Backup model_gallery_page_content table
CREATE TABLE backup_model_gallery_page_content_20250817 AS SELECT * FROM model_gallery_page_content;

-- Current gallery_business_configs data for reference:
-- escort: masonry preferred, 16 images/page, professional styling
-- camgirl: grid preferred, 20 images/page, vibrant styling  
-- retail: grid preferred, 24 images/page, clean design
-- photographer: masonry preferred, 15 images/page, artistic styling

-- Current business_types: escort, camgirl, massage, salon, restaurant, professional

SELECT 'Backup completed - existing configurations preserved' as status;