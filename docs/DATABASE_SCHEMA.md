# phoenix4ge Database Schema (Initial Migrations 001-004)

This document lists the tables and their columns as defined in the first four SQL migrations found in `phoenix4ge/database/migrations/`.  Later migrations add additional structures, but this serves as the core starting point of the schema.

---

## 001_initial_schema.sql

### users
- `id` INT PRIMARY KEY AUTO_INCREMENT
- `email` VARCHAR(120) UNIQUE NOT NULL
- `password_hash` VARCHAR(255) NOT NULL
- `role` ENUM('model', 'admin', 'sysadmin') NOT NULL DEFAULT 'model'
- `is_active` BOOLEAN DEFAULT TRUE
- `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

### models
- `id` INT PRIMARY KEY AUTO_INCREMENT
- `name` VARCHAR(100) NOT NULL
- `slug` VARCHAR(100) UNIQUE NOT NULL
- `status` ENUM('active', 'suspended', 'trial', 'inactive') DEFAULT 'trial'
- `stripe_customer_id` VARCHAR(255)
- `stripe_subscription_id` VARCHAR(255)
- `subscription_status` ENUM('active', 'past_due', 'canceled', 'incomplete', 'trialing')
- `trial_ends_at` TIMESTAMP NULL
- `next_billing_at` TIMESTAMP NULL
- `balance_due` DECIMAL(10,2) DEFAULT 0.00
- `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

### model_users
- `id` INT PRIMARY KEY AUTO_INCREMENT
- `model_id` INT NOT NULL (FK → models.id)
- `user_id` INT NOT NULL (FK → users.id)
- `role` ENUM('owner', 'admin', 'editor', 'viewer') DEFAULT 'editor'
- `is_active` BOOLEAN DEFAULT TRUE
- `added_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### themes
- `id` INT PRIMARY KEY AUTO_INCREMENT
- `name` VARCHAR(50) UNIQUE NOT NULL
- `display_name` VARCHAR(100) NOT NULL
- `description` TEXT
- `is_active` BOOLEAN DEFAULT TRUE
- `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### theme_colors
- `id` INT PRIMARY KEY AUTO_INCREMENT
- `theme_id` INT NOT NULL (FK → themes.id)
- `color_type` ENUM('primary', 'secondary', 'background', 'text', 'accent', 'border') NOT NULL
- `color_value` VARCHAR(7) NOT NULL

### model_themes
- `id` INT PRIMARY KEY AUTO_INCREMENT
- `model_id` INT NOT NULL (FK → models.id)
- `theme_id` INT NOT NULL (FK → themes.id)
- `is_active` BOOLEAN DEFAULT TRUE
- `applied_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### site_settings
- `id` INT PRIMARY KEY AUTO_INCREMENT
- `model_id` INT NOT NULL (FK → models.id)
- `site_name` VARCHAR(100)
- `model_name` VARCHAR(100)
- `tagline` VARCHAR(255)
- `city` VARCHAR(100)
- `contact_email` VARCHAR(100)
- `contact_phone` VARCHAR(20)
- `header_image` VARCHAR(255)
- `favicon_url` VARCHAR(255)
- `apple_touch_icon_url` VARCHAR(255)
- `watermark_text` TEXT
- `watermark_image` VARCHAR(255)
- `watermark_size` INT DEFAULT 24
- `watermark_opacity` INT DEFAULT 50
- `watermark_position` ENUM('top-left','top-right','bottom-left','bottom-right','center') DEFAULT 'bottom-right'
- `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

### smtp_settings
- `id` INT PRIMARY KEY AUTO_INCREMENT
- `model_id` INT NOT NULL (FK → models.id)
- `smtp_server` VARCHAR(200)
- `smtp_port` INT DEFAULT 587
- `smtp_username` VARCHAR(200)
- `smtp_password` VARCHAR(200)
- `smtp_use_tls` BOOLEAN DEFAULT TRUE
- `smtp_use_ssl` BOOLEAN DEFAULT FALSE
- `is_active` BOOLEAN DEFAULT FALSE

### page_types
- `id` INT PRIMARY KEY AUTO_INCREMENT
- `slug` VARCHAR(50) UNIQUE NOT NULL
- `name` VARCHAR(100) NOT NULL
- `description` TEXT
- `is_active` BOOLEAN DEFAULT TRUE

### pages
- `id` INT PRIMARY KEY AUTO_INCREMENT
- `model_id` INT NOT NULL (FK → models.id)
- `page_type_id` INT NOT NULL (FK → page_types.id)
- `title` VARCHAR(200)
- `subtitle` TEXT
- `is_visible` BOOLEAN DEFAULT TRUE
- `sort_order` INT DEFAULT 0
- `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

### page_sections
- `id` INT PRIMARY KEY AUTO_INCREMENT
- `page_id` INT NOT NULL (FK → pages.id)
- `section_type` ENUM('text', 'image', 'gallery', 'form', 'cta', 'list') NOT NULL
- `section_key` VARCHAR(100) NOT NULL
- `title` VARCHAR(200)
- `content` TEXT
- `image_url` VARCHAR(255)
- `is_visible` BOOLEAN DEFAULT TRUE
- `sort_order` INT DEFAULT 0

### section_metadata
- `id` INT PRIMARY KEY AUTO_INCREMENT
- `section_id` INT NOT NULL (FK → page_sections.id)
- `meta_key` VARCHAR(100) NOT NULL
- `meta_value` TEXT

---

## 002_gallery_system.sql

### gallery_sections
- `id` INT PRIMARY KEY AUTO_INCREMENT
- `model_id` INT NOT NULL (FK → models.id)
- `title` VARCHAR(100) NOT NULL
- `description` TEXT
- `layout_type` ENUM('grid', 'masonry', 'carousel', 'slideshow') DEFAULT 'grid'
- `grid_columns` INT DEFAULT 3
- `is_visible` BOOLEAN DEFAULT TRUE
- `sort_order` INT DEFAULT 0
- `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### gallery_section_settings
- `id` INT PRIMARY KEY AUTO_INCREMENT
- `section_id` INT NOT NULL (FK → gallery_sections.id)
- `setting_key` VARCHAR(100) NOT NULL
- `setting_value` VARCHAR(255)

### gallery_images
- `id` INT PRIMARY KEY AUTO_INCREMENT
- `model_id` INT NOT NULL (FK → models.id)
- `section_id` INT NOT NULL (FK → gallery_sections.id)
- `filename` VARCHAR(255) NOT NULL
- `original_filename` VARCHAR(255)
- `caption` VARCHAR(255)
- `alt_text` VARCHAR(255)
- `file_size` INT
- `width` INT
- `height` INT
- `mime_type` VARCHAR(50)
- `is_featured` BOOLEAN DEFAULT FALSE
- `is_active` BOOLEAN DEFAULT TRUE
- `sort_order` INT DEFAULT 0
- `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### image_tags
- `id` INT PRIMARY KEY AUTO_INCREMENT
- `name` VARCHAR(50) UNIQUE NOT NULL
- `slug` VARCHAR(50) UNIQUE NOT NULL
- `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### image_tag_assignments
- `id` INT PRIMARY KEY AUTO_INCREMENT
- `image_id` INT NOT NULL (FK → gallery_images.id)
- `tag_id` INT NOT NULL (FK → image_tags.id)

---

## 003_faq_services_booking.sql

### faq_categories
- `id` INT PRIMARY KEY AUTO_INCREMENT
- `model_id` INT NOT NULL (FK → models.id)
- `name` VARCHAR(100) NOT NULL
- `slug` VARCHAR(100) NOT NULL
- `description` TEXT
- `sort_order` INT DEFAULT 0
- `is_visible` BOOLEAN DEFAULT TRUE

### faq_items
- `id` INT PRIMARY KEY AUTO_INCREMENT
- `model_id` INT NOT NULL (FK → models.id)
- `category_id` INT (FK → faq_categories.id)
- `question` TEXT NOT NULL
- `answer` TEXT NOT NULL
- `sort_order` INT DEFAULT 0
- `is_visible` BOOLEAN DEFAULT TRUE
- `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

### service_categories
- `id` INT PRIMARY KEY AUTO_INCREMENT
- `model_id` INT NOT NULL (FK → models.id)
- `name` VARCHAR(100) NOT NULL
- `slug` VARCHAR(100) NOT NULL
- `description` TEXT
- `sort_order` INT DEFAULT 0
- `is_visible` BOOLEAN DEFAULT TRUE

### services
- `id` INT PRIMARY KEY AUTO_INCREMENT
- `model_id` INT NOT NULL (FK → models.id)
- `category_id` INT (FK → service_categories.id)
- `name` VARCHAR(100) NOT NULL
- `description` TEXT
- `duration` VARCHAR(50)
- `price` DECIMAL(10,2)
- `price_display` VARCHAR(50)
- `is_active` BOOLEAN DEFAULT TRUE
- `sort_order` INT DEFAULT 0
- `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### availability
- `id` INT PRIMARY KEY AUTO_INCREMENT
- `model_id` INT NOT NULL (FK → models.id)
- `start_date` DATE NOT NULL
- `end_date` DATE NOT NULL
- `start_time` TIME
- `end_time` TIME
- `all_day` BOOLEAN DEFAULT FALSE
- `location` VARCHAR(100)
- `status` ENUM('available', 'booked', 'blocked', 'tentative') DEFAULT 'available'
- `notes` TEXT
- `color` VARCHAR(7) DEFAULT '#3B82F6'
- `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### bookings
- `id` INT PRIMARY KEY AUTO_INCREMENT
- `model_id` INT NOT NULL (FK → models.id)
- `client_name` VARCHAR(100)
- `client_email` VARCHAR(120)
- `client_phone` VARCHAR(20)
- `service_id` INT (FK → services.id)
- `booking_date` DATE NOT NULL
- `booking_time` TIME
- `duration_hours` INT
- `location` VARCHAR(100)
- `special_requests` TEXT
- `status` ENUM('pending', 'confirmed', 'completed', 'cancelled') DEFAULT 'pending'
- `total_amount` DECIMAL(10,2)
- `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

---

## 004_testimonials_menu.sql

### testimonials
- `id` INT PRIMARY KEY AUTO_INCREMENT
- `model_id` INT NOT NULL (FK → models.id)
- `client_name` VARCHAR(100)
- `client_initial` VARCHAR(10)
- `testimonial_text` TEXT NOT NULL
- `rating` INT CHECK (rating >= 1 AND rating <= 5)
- `is_featured` BOOLEAN DEFAULT FALSE
- `is_active` BOOLEAN DEFAULT TRUE
- `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### menu_items
- `id` INT PRIMARY KEY AUTO_INCREMENT
- `model_id` INT NOT NULL (FK → models.id)
- `label` VARCHAR(100) NOT NULL
- `slug` VARCHAR(100) NOT NULL
- `url_path` VARCHAR(200)
- `is_visible` BOOLEAN DEFAULT TRUE
- `sort_order` INT DEFAULT 0
- `is_external` BOOLEAN DEFAULT FALSE

---

*Generated automatically from SQL migrations 001-004 on 2025-08-15.*
