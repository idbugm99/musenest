/**
 * Gallery Helper for Theme Integration
 * Part of Phase 5: Gallery Layouts Implementation
 * Provides Handlebars helpers for rendering galleries in themes
 */

const GalleryRenderingService = require('../src/services/GalleryRenderingService');
const db = require('../config/database');

let galleryRenderer = null;

/**
 * Initialize gallery renderer
 */
async function initializeRenderer() {
    if (!galleryRenderer) {
        galleryRenderer = new GalleryRenderingService(db);
        const result = await galleryRenderer.initialize();
        if (!result.success) {
            console.error('Gallery renderer initialization failed:', result.error);
            return null;
        }
    }
    return galleryRenderer;
}

/**
 * Handlebars helper to render all galleries for a model
 * Usage: {{{renderGalleries model.slug}}}
 */
async function renderGalleries(modelSlug, options) {
    try {
        const renderer = await initializeRenderer();
        if (!renderer) return '';

        // Get gallery content settings from template context
        const galleryContent = options?.data?.root?.gallery_content || {};
        
        const galleriesResult = await renderer.getPublishedGallerySections(modelSlug);
        
        if (!galleriesResult.success || galleriesResult.sections.length === 0) {
            return '<div class="galleries-empty">No galleries available</div>';
        }

        // Override default settings with gallery content settings
        const lightboxSettings = {
            enable_lightbox: galleryContent.enable_lightbox,
            enable_fullscreen: galleryContent.enable_fullscreen,
            show_captions: galleryContent.show_captions,
            show_image_info: galleryContent.show_image_info,
            show_search: galleryContent.show_search,
            show_sort_options: galleryContent.show_sort_options,
            show_category_filter: galleryContent.show_category_filter
        };

        // Pass settings to renderer
        renderer.setGalleryContentSettings(lightboxSettings);

        // Render all sections
        const sectionsHtml = galleriesResult.sections
            .map(section => section.renderHtml)
            .join('\n\n');

        // Generate interactive script
        const galleryScript = renderer.generateGalleryScript(galleriesResult.sections);

        return `
            <div class="model-galleries" data-model="${modelSlug}">
                ${sectionsHtml}
            </div>
            ${galleryScript}
        `;

    } catch (error) {
        console.error('Error rendering galleries:', error);
        return '<div class="galleries-error">Error loading galleries</div>';
    }
}

/**
 * Handlebars helper to render a specific gallery section
 * Usage: {{{renderGallerySection model.slug "portfolio"}}}
 */
async function renderGallerySection(modelSlug, sectionSlug) {
    try {
        const renderer = await initializeRenderer();
        if (!renderer) return '';

        // Get specific section
        const sectionQuery = `
            SELECT id, section_name, section_slug, layout_type, layout_settings, section_order
            FROM model_gallery_sections 
            WHERE model_slug = ? AND section_slug = ? AND is_published = 1
        `;
        
        const sections = await db.query(sectionQuery, [modelSlug, sectionSlug]);
        
        if (!sections || sections.length === 0) {
            return `<div class="gallery-not-found">Gallery section "${sectionSlug}" not found</div>`;
        }

        const section = sections[0];

        // Get section media
        const mediaResult = await renderer.getSectionMedia(section.id);
        
        if (!mediaResult.success) {
            return '<div class="gallery-error">Error loading gallery media</div>';
        }

        // Parse and merge settings
        let layoutSettings = {};
        try {
            layoutSettings = typeof section.layout_settings === 'string' 
                ? JSON.parse(section.layout_settings) 
                : section.layout_settings || {};
        } catch (e) {
            layoutSettings = {};
        }

        const defaultSettings = renderer.defaultSettings[section.layout_type] || {};
        const mergedSettings = { ...defaultSettings, ...layoutSettings };

        // Render section
        const sectionHtml = await renderer.renderSection(
            { ...section, layout_settings: mergedSettings }, 
            mediaResult.media, 
            mergedSettings
        );

        // Generate script for this section
        const galleryScript = renderer.generateGalleryScript([{
            ...section,
            media: mediaResult.media
        }]);

        return sectionHtml + '\n' + galleryScript;

    } catch (error) {
        console.error('Error rendering gallery section:', error);
        return '<div class="gallery-error">Error loading gallery section</div>';
    }
}

/**
 * Handlebars helper to get gallery data (for custom rendering)
 * Usage: {{#with (getGalleryData model.slug)}}...{{/with}}
 */
async function getGalleryData(modelSlug) {
    try {
        const renderer = await initializeRenderer();
        if (!renderer) return null;

        const galleriesResult = await renderer.getPublishedGallerySections(modelSlug);
        
        if (!galleriesResult.success) {
            return null;
        }

        return {
            sections: galleriesResult.sections.map(section => ({
                id: section.id,
                name: section.section_name,
                slug: section.section_slug,
                layout_type: section.layout_type,
                layout_settings: section.layout_settings,
                media_count: section.media.length,
                media: section.media
            })),
            totalSections: galleriesResult.totalSections,
            totalImages: galleriesResult.totalImages
        };

    } catch (error) {
        console.error('Error getting gallery data:', error);
        return null;
    }
}

/**
 * Handlebars helper to check if model has galleries
 * Usage: {{#if (hasGalleries model.slug)}}...{{/if}}
 */
async function hasGalleries(modelSlug) {
    try {
        const query = `
            SELECT COUNT(*) as count 
            FROM model_gallery_sections 
            WHERE model_slug = ? AND is_published = 1
        `;
        
        const result = await db.query(query, [modelSlug]);
        return (result && result[0] && result[0].count > 0);

    } catch (error) {
        console.error('Error checking if model has galleries:', error);
        return false;
    }
}

/**
 * Handlebars helper to get gallery section by type
 * Usage: {{{renderGalleryByType model.slug "carousel"}}}
 */
async function renderGalleryByType(modelSlug, layoutType) {
    try {
        const renderer = await initializeRenderer();
        if (!renderer) return '';

        // Get first section of specified type
        const sectionQuery = `
            SELECT id, section_name, section_slug, layout_type, layout_settings, section_order
            FROM model_gallery_sections 
            WHERE model_slug = ? AND layout_type = ? AND is_published = 1
            ORDER BY section_order ASC, created_date ASC
            LIMIT 1
        `;
        
        const sections = await db.query(sectionQuery, [modelSlug, layoutType]);
        
        if (!sections || sections.length === 0) {
            return `<div class="gallery-not-found">No ${layoutType} gallery found</div>`;
        }

        const section = sections[0];

        // Get section media
        const mediaResult = await renderer.getSectionMedia(section.id);
        
        if (!mediaResult.success) {
            return '<div class="gallery-error">Error loading gallery media</div>';
        }

        // Parse and merge settings
        let layoutSettings = {};
        try {
            layoutSettings = typeof section.layout_settings === 'string' 
                ? JSON.parse(section.layout_settings) 
                : section.layout_settings || {};
        } catch (e) {
            layoutSettings = {};
        }

        const defaultSettings = renderer.defaultSettings[section.layout_type] || {};
        const mergedSettings = { ...defaultSettings, ...layoutSettings };

        // Render section
        const sectionHtml = await renderer.renderSection(
            { ...section, layout_settings: mergedSettings }, 
            mediaResult.media, 
            mergedSettings
        );

        // Generate script for this section
        const galleryScript = renderer.generateGalleryScript([{
            ...section,
            media: mediaResult.media
        }]);

        return sectionHtml + '\n' + galleryScript;

    } catch (error) {
        console.error('Error rendering gallery by type:', error);
        return '<div class="gallery-error">Error loading gallery</div>';
    }
}

/**
 * Handlebars helper to get featured gallery images (first N images from all galleries)
 * Usage: {{#each (getFeaturedGalleryImages model.slug 6)}}...{{/each}}
 */
async function getFeaturedGalleryImages(modelSlug, limit = 6) {
    try {
        const query = `
            SELECT DISTINCT
                mml.id,
                mml.filename,
                mml.original_filename,
                mml.image_width,
                mml.image_height,
                mml.model_slug,
                mml.upload_date,
                mgsm.custom_caption,
                mgsm.is_featured,
                mgsm.display_order,
                CONCAT('/uploads/', mml.model_slug, '/media/', mml.filename) as file_url,
                CONCAT('/uploads/', mml.model_slug, '/media/thumbs/', mml.filename) as thumbnail_url
            FROM model_gallery_section_media mgsm
            INNER JOIN model_media_library mml ON mgsm.media_id = mml.id
            INNER JOIN model_gallery_sections mgs ON mgsm.section_id = mgs.id
            WHERE mgs.model_slug = ? 
              AND mgs.is_published = 1
              AND mml.is_deleted = 0 
              AND mml.moderation_status = 'approved'
            ORDER BY 
                mgsm.is_featured DESC,
                mgsm.display_order ASC,
                mml.upload_date DESC
            LIMIT ?
        `;

        const images = await db.query(query, [modelSlug, limit]);
        return images || [];

    } catch (error) {
        console.error('Error getting featured gallery images:', error);
        return [];
    }
}

module.exports = {
    renderGalleries,
    renderGallerySection,
    getGalleryData,
    hasGalleries,
    renderGalleryByType,
    getFeaturedGalleryImages
};