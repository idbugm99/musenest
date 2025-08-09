-- Table-driven rates for per-item management
CREATE TABLE IF NOT EXISTS model_rates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  model_id INT NOT NULL,
  rate_type ENUM('incall','outcall','extended') NOT NULL,
  service_name VARCHAR(200) NULL,
  duration VARCHAR(100) NULL,
  price VARCHAR(100) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_visible TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_model_type_sort (model_id, rate_type, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS model_rate_terms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  model_id INT NOT NULL,
  category ENUM('payment','additional') NOT NULL,
  term_text VARCHAR(500) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_visible TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_terms_model_cat_sort (model_id, category, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


