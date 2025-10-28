-- Migration: Add Client Type System Support
-- Date: 2025-08-04
-- Description: Adds client_type and parent_client_id columns to support white label, muse-owned, and sub-client relationships

-- Add client_type column to models table
ALTER TABLE `models` ADD COLUMN `client_type` ENUM('white_label', 'muse_owned', 'sub_client', 'admin') NOT NULL DEFAULT 'muse_owned' AFTER `status`;

-- Add parent_client_id for hierarchical relationships
ALTER TABLE `models` ADD COLUMN `parent_client_id` INT NULL AFTER `client_type`;

-- Add foreign key constraint for parent relationship
ALTER TABLE `models` ADD CONSTRAINT `fk_parent_client` 
    FOREIGN KEY (`parent_client_id`) REFERENCES `models`(`id`) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX `idx_client_type` ON `models`(`client_type`);
CREATE INDEX `idx_parent_client` ON `models`(`parent_client_id`);

-- Update existing admin models to have correct client_type
UPDATE `models` SET `client_type` = 'admin' WHERE `status` = 'admin';

-- Add comments for clarity
ALTER TABLE `models` MODIFY COLUMN `client_type` ENUM('white_label', 'muse_owned', 'sub_client', 'admin') NOT NULL DEFAULT 'muse_owned' 
COMMENT 'Type of client: white_label (external agencies), muse_owned (direct phoenix4ge clients), sub_client (nested under parent), admin (system templates)';

ALTER TABLE `models` MODIFY COLUMN `parent_client_id` INT NULL 
COMMENT 'Parent client ID for hierarchical relationships (sub_clients reference their parent)';