-- Migration: Add Structured Account Number System (BIN-style)
-- Date: 2025-08-04
-- Description: Implements credit card BIN-inspired account numbering system

-- Add account number column to models table
ALTER TABLE `models` ADD COLUMN `account_number` VARCHAR(12) UNIQUE NULL AFTER `id`;
CREATE UNIQUE INDEX `idx_account_number` ON `models` (`account_number`);

-- Create client type mapping table
CREATE TABLE `client_type_codes` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `client_type` ENUM('muse_owned', 'white_label', 'sub_client', 'admin') NOT NULL UNIQUE,
    `type_code` INT NOT NULL UNIQUE,
    `description` VARCHAR(100) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert client type mappings
INSERT INTO `client_type_codes` (`client_type`, `type_code`, `description`) VALUES
('muse_owned', 1, 'Direct MuseNest clients'),
('white_label', 2, 'White label agency clients'),
('sub_client', 3, 'Sub-clients under parent accounts'),
('admin', 9, 'System templates and admin accounts');

-- Create sales channel mapping table
CREATE TABLE `sales_channels` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `channel_code` INT NOT NULL UNIQUE,
    `channel_name` VARCHAR(50) NOT NULL UNIQUE,
    `description` VARCHAR(200),
    `is_active` BOOLEAN DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sales channel mappings
INSERT INTO `sales_channels` (`channel_code`, `channel_name`, `description`) VALUES
(10, 'website', 'Direct website registration'),
(20, 'referral', 'Client referral program'),
(30, 'manual', 'Manual admin creation'),
(40, 'api', 'API integration signup'),
(50, 'partner', 'Partner channel signup'),
(99, 'system', 'System-generated accounts');

-- Create region mapping table
CREATE TABLE `regions` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `region_code` INT NOT NULL UNIQUE,
    `region_name` VARCHAR(50) NOT NULL,
    `country_code` VARCHAR(3),
    `description` VARCHAR(100),
    `is_active` BOOLEAN DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert region mappings (common regions)
INSERT INTO `regions` (`region_code`, `region_name`, `country_code`, `description`) VALUES
(1, 'US', 'USA', 'United States'),
(44, 'UK', 'GBR', 'United Kingdom'),
(49, 'DE', 'DEU', 'Germany'),
(33, 'FR', 'FRA', 'France'),
(61, 'AU', 'AUS', 'Australia'),
(1, 'CA', 'CAN', 'Canada'),
(99, 'INTL', 'INT', 'International/Other');

-- Add sales channel and region tracking to models table
ALTER TABLE `models` ADD COLUMN `sales_channel_id` INT NULL AFTER `account_number`;
ALTER TABLE `models` ADD COLUMN `region_id` INT NULL AFTER `sales_channel_id`;

-- Add foreign key constraints
ALTER TABLE `models` ADD CONSTRAINT `fk_sales_channel` 
    FOREIGN KEY (`sales_channel_id`) REFERENCES `sales_channels`(`id`) ON DELETE SET NULL;
    
ALTER TABLE `models` ADD CONSTRAINT `fk_region` 
    FOREIGN KEY (`region_id`) REFERENCES `regions`(`id`) ON DELETE SET NULL;

-- Create account number generation sequence table for unique IDs
CREATE TABLE `account_sequence` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `last_sequence` INT NOT NULL DEFAULT 100000,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Initialize sequence
INSERT INTO `account_sequence` (`last_sequence`) VALUES (100000);

-- Add comments for clarity
ALTER TABLE `models` MODIFY COLUMN `account_number` VARCHAR(12) UNIQUE NULL 
COMMENT 'Structured account number: [TT][CC][SS][RRRRRR] format';

ALTER TABLE `models` MODIFY COLUMN `sales_channel_id` INT NULL 
COMMENT 'Reference to sales_channels table for account number generation';

ALTER TABLE `models` MODIFY COLUMN `region_id` INT NULL 
COMMENT 'Reference to regions table for account number generation';