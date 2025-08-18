-- Migration 072: Theme Gallery Assignments
-- Creates table for assigning gallery profiles to themes
-- Date: August 18, 2025

CREATE TABLE IF NOT EXISTS theme_gallery_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    theme_id INT NOT NULL,
    gallery_profile_id INT NOT NULL,
    is_default_profile BOOLEAN DEFAULT 0,
    display_order INT DEFAULT 1,
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_theme_gallery_assignments_theme_id (theme_id),
    INDEX idx_theme_gallery_assignments_profile_id (gallery_profile_id),
    INDEX idx_theme_gallery_assignments_active (is_active),
    INDEX idx_theme_gallery_assignments_default (is_default_profile),
    
    -- Constraints
    UNIQUE KEY unique_theme_gallery_assignment (theme_id, gallery_profile_id),
    FOREIGN KEY (theme_id) REFERENCES theme_sets(id) ON DELETE CASCADE,
    FOREIGN KEY (gallery_profile_id) REFERENCES gallery_profiles(id) ON DELETE CASCADE
);

-- Create theme customizations table if it doesn't exist
CREATE TABLE IF NOT EXISTS theme_customizations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    theme_id INT NOT NULL,
    custom_css TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_theme_customizations_theme_id (theme_id),
    INDEX idx_theme_customizations_active (is_active),
    
    -- Constraints
    UNIQUE KEY unique_theme_customization (theme_id),
    FOREIGN KEY (theme_id) REFERENCES theme_sets(id) ON DELETE CASCADE
);