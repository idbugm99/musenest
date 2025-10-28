/**
 * Phoenix4Ge Theme Gallery Configuration Types
 * Generated from ThemeConfigSchema.json v1.0.0
 * 
 * These types define the contract for theme-specific gallery configurations
 * in the universal gallery system.
 */

/**
 * Responsive breakpoint configuration
 */
export interface ThemeBreakpoints {
  sm?: number; // default: 576
  md?: number; // default: 768
  lg?: number; // default: 992
  xl?: number; // default: 1200
}

/**
 * Responsive column configuration for grid layouts
 */
export interface ResponsiveColumns {
  sm: number; // 1-6, default: 2
  md: number; // 1-8, default: 3
  lg: number; // 1-12, default: 4
}

/**
 * CSS class mappings for gallery components
 */
export interface ThemeCSSClasses {
  gallery: string;        // Main gallery container class
  section: string;        // Gallery section container class
  item: string;           // Individual gallery item class
  lightbox: string;       // Lightbox modal container class
  navigation?: string;    // Navigation controls class
  caption?: string;       // Image caption container class
  filters?: string;       // Gallery filters/controls container class
  pagination?: string;    // Pagination controls container class
}

/**
 * Animation class mappings for theme-specific effects
 */
export interface ThemeAnimations {
  hover?: string;         // Hover effect class for gallery items
  transition?: string;    // General transition class
  lightboxOpen?: string;  // Lightbox opening animation class
  lightboxClose?: string; // Lightbox closing animation class
}

/**
 * Theme-specific icon mappings (text or CSS classes)
 */
export interface ThemeIcons {
  close?: string;         // Close button icon/text (default: "✕")
  fullscreen?: string;    // Fullscreen toggle icon/text (default: "⤢")
  prev?: string;          // Previous navigation icon/text (default: "‹")
  next?: string;          // Next navigation icon/text (default: "›")
  grid?: string;          // Grid layout icon/text (default: "⊞")
  masonry?: string;       // Masonry layout icon/text (default: "⊡")
  carousel?: string;      // Carousel layout icon/text (default: "⊲")
}

/**
 * Grid layout specific configuration
 */
export interface GridLayoutConfig {
  defaultColumns?: ResponsiveColumns;
  aspectRatio?: string;   // "1:1", "16:9", "auto", etc.
}

/**
 * Masonry layout specific configuration
 */
export interface MasonryLayoutConfig {
  columnWidth?: number;   // 200-500, default: 280
  gutter?: number;        // 10-50, default: 20
}

/**
 * Carousel layout specific configuration
 */
export interface CarouselLayoutConfig {
  autoplay?: boolean;         // default: false
  autoplaySpeed?: number;     // 1000-10000, default: 5000
  slidesToShow?: number;      // 1-5, default: 1
  infinite?: boolean;         // default: true
}

/**
 * Layout-specific configuration overrides
 */
export interface ThemeLayouts {
  grid?: GridLayoutConfig;
  masonry?: MasonryLayoutConfig;
  carousel?: CarouselLayoutConfig;
}

/**
 * Theme-specific customization options
 */
export interface ThemeCustomizations {
  enableHoverEffects?: boolean;   // default: true
  enableAnimations?: boolean;     // default: true
  enableParallax?: boolean;       // default: false
  enableBlurBackground?: boolean; // default: false
  colorScheme?: 'light' | 'dark' | 'auto'; // default: 'light'
}

/**
 * Theme-specific asset paths
 */
export interface ThemeAssets {
  cssFile?: string;       // Main CSS file, default: "style.css"
  jsFile?: string;        // Optional theme-specific JavaScript file
  fontFiles?: string[];   // Additional font files to load (max 10)
}

/**
 * Complete theme gallery configuration
 */
export interface ThemeGalleryConfig {
  theme: string;                      // Theme identifier (pattern: ^[a-z][a-z0-9_-]*$)
  version: '1.0.0';                   // Schema version
  prefix: string;                     // CSS class prefix (pattern: ^[a-z][a-z0-9_-]*$)
  displayName?: string;               // Human-readable theme name (max 50 chars)
  cssClasses: ThemeCSSClasses;        // Required CSS class mappings
  animations?: ThemeAnimations;       // Optional animation classes
  icons?: ThemeIcons;                 // Optional icon overrides
  layouts?: ThemeLayouts;             // Layout-specific configurations
  customizations?: ThemeCustomizations; // Theme customization options
  breakpoints?: ThemeBreakpoints;     // Responsive breakpoint overrides
  assets?: ThemeAssets;               // Theme asset paths
}

/**
 * Gallery data structure returned by UniversalGalleryService
 * This is the data-only contract - no HTML/JS included
 */
export interface GalleryDataV1 {
  layout: 'grid' | 'masonry' | 'carousel' | 'lightbox_grid';
  items: GalleryItem[];
  categories: string[];
  pagination: GalleryPagination;
  filters: GalleryFilters;
  settings: GallerySettings;
}

/**
 * Individual gallery item data structure
 */
export interface GalleryItem {
  id: string;
  alt: string;
  caption?: string;
  srcThumb: string;       // Thumbnail URL
  srcMed: string;         // Medium resolution URL
  srcFull: string;        // Full resolution URL
  aspect: number;         // Width/height aspect ratio
  flagged?: boolean;      // Content moderation flag
  width?: number;         // Original width in pixels
  height?: number;        // Original height in pixels
  category?: string;      // Gallery category/section
  uploadDate?: string;    // ISO date string
  featured?: boolean;     // Featured/highlighted item
}

/**
 * Gallery pagination information
 */
export interface GalleryPagination {
  page: number;           // Current page (1-based)
  pageSize: number;       // Items per page
  total: number;          // Total number of items
  totalPages: number;     // Total number of pages
  hasNext: boolean;       // Has next page
  hasPrev: boolean;       // Has previous page
}

/**
 * Gallery filter state
 */
export interface GalleryFilters {
  category?: string;      // Selected category filter
  sort?: 'recent' | 'popular' | 'featured' | 'oldest';
  search?: string;        // Search query
}

/**
 * Gallery display settings
 */
export interface GallerySettings {
  lightbox: boolean;
  fullscreen: boolean;
  captions: boolean;
  imageInfo: boolean;
  categoryFilter: boolean;
  sortOptions: boolean;
  searchEnabled: boolean;
  masonryRowHeight?: number;
  gridCols: ResponsiveColumns;
  autoplay?: boolean;
  autoplaySpeed?: number;
}

/**
 * Gallery service response envelope
 */
export interface GalleryServiceResponse {
  success: boolean;
  data?: GalleryDataV1;
  error?: string;
  timestamp: string;
}

/**
 * Theme configuration validation result
 */
export interface ThemeConfigValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
  config?: ThemeGalleryConfig;
}

/**
 * Precedence levels for configuration inheritance
 */
export type ConfigPrecedence = 'system' | 'theme' | 'model';

/**
 * Configuration with precedence metadata
 */
export interface ConfigWithPrecedence<T> {
  value: T;
  source: ConfigPrecedence;
  timestamp: string;
}

/**
 * Gallery configuration store interface
 */
export interface GalleryConfigStore {
  getSystemDefaults(): Promise<GallerySettings>;
  getThemeConfig(themeId: string): Promise<ThemeGalleryConfig>;
  getModelConfig(modelId: string): Promise<Partial<GallerySettings>>;
  resolveConfig(modelId: string, themeId: string): Promise<GallerySettings>;
}

// Re-export for convenience
export type { ThemeGalleryConfig as ThemeConfig };
export type { GalleryDataV1 as GalleryData };