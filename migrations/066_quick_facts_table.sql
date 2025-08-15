-- Migration 066: Add Quick Facts Table
-- This table stores custom quick facts for each model's about page

CREATE TABLE IF NOT EXISTS `quick_facts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `model_id` int(11) NOT NULL,
  `question` varchar(255) NOT NULL,
  `answer` text NOT NULL,
  `display_order` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_model_id` (`model_id`),
  KEY `idx_display_order` (`display_order`),
  KEY `idx_is_active` (`is_active`),
  CONSTRAINT `fk_quick_facts_model` FOREIGN KEY (`model_id`) REFERENCES `models` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add quick_facts_visible field to model_about_page_content if it doesn't exist
ALTER TABLE `model_about_page_content` 
ADD COLUMN IF NOT EXISTS `quick_facts_visible` tinyint(1) DEFAULT 1 AFTER `interests_visible`;

-- Insert some sample quick facts for existing models
INSERT INTO `quick_facts` (`model_id`, `question`, `answer`, `display_order`) 
SELECT 
  m.id,
  'Age',
  '25',
  1
FROM `models` m 
WHERE m.slug = 'modelexample'
LIMIT 1;

INSERT INTO `quick_facts` (`model_id`, `question`, `answer`, `display_order`) 
SELECT 
  m.id,
  'Height',
  '5\'8"',
  2
FROM `models` m 
WHERE m.slug = 'modelexample'
LIMIT 1;

INSERT INTO `quick_facts` (`model_id`, `question`, `answer`, `display_order`) 
SELECT 
  m.id,
  'Languages',
  'English, French',
  3
FROM `models` m 
WHERE m.slug = 'modelexample'
LIMIT 1;

-- Update existing about page content to show quick facts by default
UPDATE `model_about_page_content` 
SET `quick_facts_visible` = 1 
WHERE `quick_facts_visible` IS NULL;
