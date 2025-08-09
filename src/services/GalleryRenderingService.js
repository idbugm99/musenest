/**
 * Gallery Rendering Service for MuseNest
 * Part of Phase 5: Gallery Layouts Implementation (Enhanced with Phase C Caching)
 * Handles rendering of gallery sections on public model sites with performance optimization
 */

const GalleryCacheService = require('./GalleryCacheService');
const MediaMetadataService = require('./MediaMetadataService');

class GalleryRenderingService {
    constructor(dbConnection, cacheService = null) {
        this.db = dbConnection;
        this.cacheService = cacheService || new GalleryCacheService(); // Use provided cache or create new one
        this.metadataService = new MediaMetadataService(dbConnection, this.cacheService);
        
        // Default settings for each layout type
        this.defaultSettings = {
            grid: {
                grid_columns: 3,
                grid_gap: 20,
                grid_aspect: '1:1',
                grid_lightbox: true,
                grid_captions: false
            },
            masonry: {
                masonry_column_width: 250,
                masonry_gap: 15,
                masonry_lightbox: true
            },
            carousel: {
                carousel_autoplay: '5000',
                carousel_transition: 'slide',
                carousel_height: '400',
                carousel_indicators: true,
                carousel_controls: true
            },
            lightbox_grid: {
                lightbox_thumb_size: 120,
                lightbox_columns: 6,
                lightbox_gap: 10,
                lightbox_captions: true,
                lightbox_thumbnails: true
            }
        };
    }

    /**
     * Initialize the gallery rendering service
     */
    async initialize() {
        try {
            console.log('🎨 Initializing GalleryRenderingService...');
            
            // Test database connectivity
            await this.db.execute('SELECT 1');
            
            return { success: true };
        } catch (error) {
            console.error('❌ GalleryRenderingService initialization failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get all published gallery sections for a model with caching
     * @param {string} modelSlug - The model slug
     * @param {boolean} useCache - Whether to use cache (default: true)
     * @returns {Object} Gallery sections data
     */
    async getPublishedGallerySections(modelSlug, useCache = true) {
        const startTime = Date.now();
        
        try {
            // Try to get from cache first
            if (useCache) {
                const cachedData = await this.cacheService.getCachedGallery(modelSlug, 'published');
                if (cachedData) {
                    console.log(`💾 Cache HIT: Published gallery for ${modelSlug} (${Date.now() - startTime}ms)`);
                    return cachedData;
                }
            }
            
            console.log(`🖼️ Loading published gallery sections for model: ${modelSlug}`);

            // Get published sections with their media
            const sectionsQuery = `
                SELECT 
                    mgs.id,
                    mgs.section_name,
                    mgs.section_slug,
                    mgs.layout_type,
                    mgs.layout_settings,
                    mgs.section_order,
                    COUNT(mgsm.media_id) as media_count
                FROM model_gallery_sections mgs
                LEFT JOIN model_gallery_section_media mgsm ON mgs.id = mgsm.section_id
                WHERE mgs.model_slug = ? AND mgs.is_published = 1
                GROUP BY mgs.id
                ORDER BY mgs.section_order ASC, mgs.created_date ASC
            `;

            const sections = await this.db.query(sectionsQuery, [modelSlug]);

            if (!sections || sections.length === 0) {
                return {
                    success: true,
                    sections: [],
                    message: 'No published gallery sections found'
                };
            }

            // Load media for each section
            const sectionsWithMedia = await Promise.all(
                sections.map(async (section) => {
                    const media = await this.getSectionMedia(section.id);
                    
                    // Parse layout settings
                    let layoutSettings = {};
                    try {
                        layoutSettings = typeof section.layout_settings === 'string' 
                            ? JSON.parse(section.layout_settings) 
                            : section.layout_settings || {};
                    } catch (e) {
                        console.warn(`Failed to parse layout settings for section ${section.id}:`, e);
                        layoutSettings = {};
                    }

                    // Apply default settings
                    const defaultSettings = this.defaultSettings[section.layout_type] || {};
                    const mergedSettings = { ...defaultSettings, ...layoutSettings };

                    return {
                        ...section,
                        layout_settings: mergedSettings,
                        media: media.success ? media.media : [],
                        renderHtml: await this.renderSection(section, media.success ? media.media : [], mergedSettings)
                    };
                })
            );

            console.log(`✅ Loaded ${sectionsWithMedia.length} gallery sections for ${modelSlug}`);

            const result = {
                success: true,
                sections: sectionsWithMedia,
                totalSections: sectionsWithMedia.length,
                totalImages: sectionsWithMedia.reduce((sum, section) => sum + section.media.length, 0),
                cached: false,
                loadTime: Date.now() - startTime
            };

            // Cache the result for future requests
            if (useCache && result.success) {
                await this.cacheService.setCachedGallery(modelSlug, 'published', result, 1800); // Cache for 30 minutes
                console.log(`💾 Cached published gallery for ${modelSlug} (${result.loadTime}ms)`);
            }

            return result;

        } catch (error) {
            console.error('❌ Error loading gallery sections:', error);
            return {
                success: false,
                error: error.message,
                sections: []
            };
        }
    }

    /**
     * Get media for a specific gallery section with metadata caching
     * @param {number} sectionId - The section ID
     * @returns {Object} Media data
     */
    async getSectionMedia(sectionId) {
        try {
            // First get media IDs and gallery-specific data
            const mediaQuery = `
                SELECT 
                    mml.id,
                    mml.model_slug,
                    mgsm.display_order,
                    mgsm.custom_caption,
                    mgsm.is_featured
                FROM model_gallery_section_media mgsm
                INNER JOIN model_media_library mml ON mgsm.media_id = mml.id
                WHERE mgsm.section_id = ? 
                  AND mml.is_deleted = 0 
                  AND mml.moderation_status = 'approved'
                ORDER BY mgsm.display_order ASC, mml.upload_date ASC
            `;

            const [rows] = await this.db.execute(mediaQuery, [sectionId]);

            if (!rows || rows.length === 0) {
                return {
                    success: true,
                    media: []
                };
            }

            // Get metadata for all media using batch processing
            const mediaIds = rows.map(row => row.id);
            const modelSlug = rows[0].model_slug; // All should have same model_slug
            
            const metadataResult = await this.metadataService.getBatchMediaMetadata(
                modelSlug, 
                mediaIds, 
                false // Don't need extended data for gallery rendering
            );

            // Merge gallery-specific data with cached metadata
            const enrichedMedia = rows.map(row => {
                const metadataEntry = metadataResult.results.find(r => r.mediaId == row.id);
                
                if (!metadataEntry || !metadataEntry.success) {
                    // Fallback for missing metadata
                    console.warn(`⚠️ Missing metadata for media ${row.id}, using basic data`);
                    return {
                        id: row.id,
                        display_order: row.display_order,
                        custom_caption: row.custom_caption,
                        is_featured: row.is_featured,
                        file_url: `/uploads/${row.model_slug}/media/unknown.jpg`,
                        thumbnail_url: `/uploads/${row.model_slug}/media/thumbs/unknown.jpg`
                    };
                }

                const metadata = metadataEntry.metadata;
                
                return {
                    id: metadata.id,
                    filename: metadata.filename,
                    original_filename: metadata.originalFilename,
                    file_path: metadata.filePath,
                    image_width: metadata.dimensions.width,
                    image_height: metadata.dimensions.height,
                    mime_type: metadata.mimeType,
                    file_size: metadata.fileSize,
                    model_slug: metadata.modelSlug,
                    display_order: row.display_order,
                    custom_caption: row.custom_caption,
                    is_featured: row.is_featured,
                    file_url: metadata.urls.media,
                    thumbnail_url: metadata.urls.thumbnail,
                    // Additional metadata for enhanced rendering
                    aspect_ratio: metadata.dimensions.aspectRatio,
                    blur_hash: metadata.blurHash,
                    color_palette: metadata.colorPalette
                };
            });

            console.log(`🖼️ Loaded ${enrichedMedia.length} media items for section ${sectionId} (${metadataResult.cached} cached)`);

            return {
                success: true,
                media: enrichedMedia,
                cacheStats: {
                    total: metadataResult.totalRequested,
                    cached: metadataResult.cached,
                    loadTime: metadataResult.loadTime
                }
            };

        } catch (error) {
            console.error('❌ Error loading section media:', error);
            return {
                success: false,
                error: error.message,
                media: []
            };
        }
    }

    /**
     * Render a gallery section as HTML
     * @param {Object} section - Section data
     * @param {Array} media - Media array
     * @param {Object} settings - Layout settings
     * @returns {string} Rendered HTML
     */
    async renderSection(section, media, settings) {
        try {
            switch (section.layout_type) {
                case 'grid':
                    return this.renderGridLayout(section, media, settings);
                case 'masonry':
                    return this.renderMasonryLayout(section, media, settings);
                case 'carousel':
                    return this.renderCarouselLayout(section, media, settings);
                case 'lightbox_grid':
                    return this.renderLightboxGridLayout(section, media, settings);
                default:
                    return this.renderGridLayout(section, media, settings);
            }
        } catch (error) {
            console.error(`❌ Error rendering section ${section.id}:`, error);
            return `<div class="gallery-error">Error rendering gallery section</div>`;
        }
    }

    /**
     * Render Grid Layout
     */
    renderGridLayout(section, media, settings) {
        if (!media || media.length === 0) {
            return `<div class="gallery-empty">No images in this gallery</div>`;
        }

        const {
            grid_columns = 3,
            grid_gap = 20,
            grid_aspect = '1:1',
            grid_lightbox = true,
            grid_captions = false
        } = settings;

        const aspectRatioStyle = grid_aspect === 'auto' ? '' : `aspect-ratio: ${grid_aspect.replace(':', '/')};`;
        
        const html = `
        <div class="gallery-section gallery-grid" data-section-id="${section.id}" data-layout="grid">
            <div class="gallery-header">
                <h3 class="gallery-title">${section.section_name}</h3>
            </div>
            <div class="grid-container" style="
                display: grid;
                grid-template-columns: repeat(${grid_columns}, 1fr);
                gap: ${grid_gap}px;
                margin-top: 20px;
            ">
                ${media.map((item, index) => `
                <div class="grid-item" data-index="${index}">
                    <div class="grid-image-wrapper" style="${aspectRatioStyle} overflow: hidden; border-radius: 8px; cursor: ${grid_lightbox ? 'pointer' : 'default'};">
                        <img src="${item.thumbnail_url || item.file_url}" 
                             alt="${item.custom_caption || item.original_filename}"
                             data-full-url="${item.file_url}"
                             style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease;"
                             ${grid_lightbox ? `onclick="openLightbox('${item.file_url}', '${(item.custom_caption || '').replace(/'/g, '&apos;')}', ${index}, 'gallery-${section.id}')"` : ''}
                             onmouseover="this.style.transform='scale(1.05)'"
                             onmouseout="this.style.transform='scale(1)'">
                    </div>
                    ${grid_captions && (item.custom_caption || item.original_filename) ? `
                    <div class="grid-caption" style="margin-top: 8px; font-size: 0.9rem; color: #666; text-align: center;">
                        ${item.custom_caption || item.original_filename}
                    </div>
                    ` : ''}
                </div>
                `).join('')}
            </div>
        </div>`;

        return html;
    }

    /**
     * Render Masonry Layout
     */
    renderMasonryLayout(section, media, settings) {
        if (!media || media.length === 0) {
            return `<div class="gallery-empty">No images in this gallery</div>`;
        }

        const {
            masonry_column_width = 250,
            masonry_gap = 15,
            masonry_lightbox = true
        } = settings;

        const html = `
        <div class="gallery-section gallery-masonry" data-section-id="${section.id}" data-layout="masonry">
            <div class="gallery-header">
                <h3 class="gallery-title">${section.section_name}</h3>
            </div>
            <div class="masonry-container" style="
                column-count: auto;
                column-width: ${masonry_column_width}px;
                column-gap: ${masonry_gap}px;
                margin-top: 20px;
            ">
                ${media.map((item, index) => `
                <div class="masonry-item" data-index="${index}" style="
                    break-inside: avoid;
                    margin-bottom: ${masonry_gap}px;
                    border-radius: 8px;
                    overflow: hidden;
                    cursor: ${masonry_lightbox ? 'pointer' : 'default'};
                ">
                    <img src="${item.file_url}" 
                         alt="${item.custom_caption || item.original_filename}"
                         style="width: 100%; height: auto; display: block; transition: transform 0.3s ease;"
                         ${masonry_lightbox ? `onclick="openLightbox('${item.file_url}', '${(item.custom_caption || '').replace(/'/g, '&apos;')}', ${index}, 'gallery-${section.id}')"` : ''}
                         onmouseover="this.style.transform='scale(1.02)'"
                         onmouseout="this.style.transform='scale(1)'">
                </div>
                `).join('')}
            </div>
        </div>`;

        return html;
    }

    /**
     * Render Carousel Layout
     */
    renderCarouselLayout(section, media, settings) {
        if (!media || media.length === 0) {
            return `<div class="gallery-empty">No images in this gallery</div>`;
        }

        const {
            carousel_autoplay = 'false',
            carousel_transition = 'slide',
            carousel_height = '400',
            carousel_indicators = true,
            carousel_controls = true
        } = settings;

        const carouselId = `carousel-${section.id}`;
        const autoplayAttr = carousel_autoplay !== 'false' ? `data-bs-ride="carousel" data-bs-interval="${carousel_autoplay}"` : '';
        const heightStyle = carousel_height === 'auto' ? 'height: auto;' : `height: ${carousel_height}px;`;

        const html = `
        <div class="gallery-section gallery-carousel" data-section-id="${section.id}" data-layout="carousel">
            <div class="gallery-header">
                <h3 class="gallery-title">${section.section_name}</h3>
            </div>
            <div id="${carouselId}" class="carousel slide" ${autoplayAttr} style="margin-top: 20px;">
                ${carousel_indicators ? `
                <div class="carousel-indicators">
                    ${media.map((_, index) => `
                    <button type="button" data-bs-target="#${carouselId}" data-bs-slide-to="${index}" 
                            ${index === 0 ? 'class="active" aria-current="true"' : ''} 
                            aria-label="Slide ${index + 1}"></button>
                    `).join('')}
                </div>
                ` : ''}
                
                <div class="carousel-inner" style="${heightStyle} border-radius: 12px; overflow: hidden;">
                    ${media.map((item, index) => `
                    <div class="carousel-item ${index === 0 ? 'active' : ''}">
                        <img src="${item.file_url}" 
                             class="d-block w-100" 
                             alt="${item.custom_caption || item.original_filename}"
                             style="height: 100%; object-fit: cover;">
                        ${item.custom_caption ? `
                        <div class="carousel-caption d-none d-md-block">
                            <p>${item.custom_caption}</p>
                        </div>
                        ` : ''}
                    </div>
                    `).join('')}
                </div>
                
                ${carousel_controls ? `
                <button class="carousel-control-prev" type="button" data-bs-target="#${carouselId}" data-bs-slide="prev">
                    <span class="carousel-control-prev-icon" aria-hidden="true"></span>
                    <span class="visually-hidden">Previous</span>
                </button>
                <button class="carousel-control-next" type="button" data-bs-target="#${carouselId}" data-bs-slide="next">
                    <span class="carousel-control-next-icon" aria-hidden="true"></span>
                    <span class="visually-hidden">Next</span>
                </button>
                ` : ''}
            </div>
        </div>`;

        return html;
    }

    /**
     * Render Lightbox Grid Layout
     */
    renderLightboxGridLayout(section, media, settings) {
        if (!media || media.length === 0) {
            return `<div class="gallery-empty">No images in this gallery</div>`;
        }

        const {
            lightbox_thumb_size = 120,
            lightbox_columns = 6,
            lightbox_gap = 10,
            lightbox_captions = true,
            lightbox_thumbnails = true
        } = settings;

        const html = `
        <div class="gallery-section gallery-lightbox-grid" data-section-id="${section.id}" data-layout="lightbox_grid">
            <div class="gallery-header">
                <h3 class="gallery-title">${section.section_name}</h3>
            </div>
            <div class="lightbox-grid-container" style="
                display: grid;
                grid-template-columns: repeat(${lightbox_columns}, 1fr);
                gap: ${lightbox_gap}px;
                margin-top: 20px;
            ">
                ${media.map((item, index) => `
                <div class="lightbox-grid-item" data-index="${index}">
                    <div class="lightbox-thumbnail" style="
                        width: ${lightbox_thumb_size}px;
                        height: ${lightbox_thumb_size}px;
                        border-radius: 6px;
                        overflow: hidden;
                        cursor: pointer;
                        position: relative;
                    ">
                        <img src="${item.thumbnail_url || item.file_url}" 
                             alt="${item.custom_caption || item.original_filename}"
                             style="width: 100%; height: 100%; object-fit: cover; transition: all 0.3s ease;"
                             onclick="openLightbox('${item.file_url}', '${(item.custom_caption || '').replace(/'/g, '&apos;')}', ${index}, 'gallery-${section.id}')"
                             onmouseover="this.style.transform='scale(1.1)'; this.parentElement.style.boxShadow='0 4px 12px rgba(0,0,0,0.3)'"
                             onmouseout="this.style.transform='scale(1)'; this.parentElement.style.boxShadow='none'">
                        <div class="lightbox-overlay" style="
                            position: absolute;
                            top: 0;
                            left: 0;
                            right: 0;
                            bottom: 0;
                            background: rgba(0,0,0,0.5);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            opacity: 0;
                            transition: opacity 0.3s ease;
                        " onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0'">
                            <i class="fas fa-expand text-white"></i>
                        </div>
                    </div>
                </div>
                `).join('')}
            </div>
        </div>`;

        return html;
    }

    /**
     * Generate gallery JavaScript for interactive features
     * @param {Array} sections - Gallery sections
     * @returns {string} JavaScript code
     */
    generateGalleryScript(sections) {
        const allMedia = sections.reduce((acc, section) => {
            section.media.forEach((media, index) => {
                acc[`gallery-${section.id}`] = acc[`gallery-${section.id}`] || [];
                acc[`gallery-${section.id}`].push({
                    url: media.file_url,
                    caption: media.custom_caption || media.original_filename,
                    index: index
                });
            });
            return acc;
        }, {});

        return `
        <script>
        // Gallery Media Data
        window.galleryData = ${JSON.stringify(allMedia)};
        
        // Lightbox functionality
        function openLightbox(imageUrl, caption, index, galleryId) {
            const lightboxHtml = \`
                <div class="modal fade" id="gallery-lightbox" tabindex="-1" aria-hidden="true">
                    <div class="modal-dialog modal-xl">
                        <div class="modal-content bg-transparent border-0">
                            <div class="modal-body p-0 position-relative">
                                <button type="button" class="btn-close btn-close-white position-absolute top-0 end-0 m-3" 
                                        data-bs-dismiss="modal" aria-label="Close" style="z-index: 1050;"></button>
                                <div class="lightbox-content text-center">
                                    <img src="\${imageUrl}" alt="\${caption}" 
                                         style="max-width: 100%; max-height: 90vh; object-fit: contain;" id="lightbox-image">
                                    \${caption ? \`<div class="lightbox-caption mt-3 text-white">\${caption}</div>\` : ''}
                                </div>
                                <div class="lightbox-nav">
                                    <button class="btn btn-light position-absolute top-50 start-0 ms-3" 
                                            onclick="navigateLightbox(-1, '\${galleryId}')" style="transform: translateY(-50%);">
                                        <i class="fas fa-chevron-left"></i>
                                    </button>
                                    <button class="btn btn-light position-absolute top-50 end-0 me-3" 
                                            onclick="navigateLightbox(1, '\${galleryId}')" style="transform: translateY(-50%);">
                                        <i class="fas fa-chevron-right"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            \`;
            
            // Remove existing lightbox
            const existingLightbox = document.getElementById('gallery-lightbox');
            if (existingLightbox) existingLightbox.remove();
            
            // Add new lightbox
            document.body.insertAdjacentHTML('beforeend', lightboxHtml);
            
            // Store current state
            window.currentLightbox = { galleryId, index };
            
            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('gallery-lightbox'));
            modal.show();
            
            // Remove after hide
            document.getElementById('gallery-lightbox').addEventListener('hidden.bs.modal', function() {
                this.remove();
            });
        }
        
        function navigateLightbox(direction, galleryId) {
            if (!window.galleryData[galleryId] || !window.currentLightbox) return;
            
            const gallery = window.galleryData[galleryId];
            let newIndex = window.currentLightbox.index + direction;
            
            if (newIndex < 0) newIndex = gallery.length - 1;
            if (newIndex >= gallery.length) newIndex = 0;
            
            const newImage = gallery[newIndex];
            const lightboxImage = document.getElementById('lightbox-image');
            const lightboxCaption = document.querySelector('.lightbox-caption');
            
            if (lightboxImage) {
                lightboxImage.src = newImage.url;
                lightboxImage.alt = newImage.caption;
            }
            
            if (lightboxCaption) {
                lightboxCaption.textContent = newImage.caption;
            }
            
            window.currentLightbox.index = newIndex;
        }
        
        // Keyboard navigation
        document.addEventListener('keydown', function(e) {
            if (document.getElementById('gallery-lightbox')) {
                if (e.key === 'ArrowLeft') navigateLightbox(-1, window.currentLightbox?.galleryId);
                if (e.key === 'ArrowRight') navigateLightbox(1, window.currentLightbox?.galleryId);
                if (e.key === 'Escape') {
                    const modal = bootstrap.Modal.getInstance(document.getElementById('gallery-lightbox'));
                    if (modal) modal.hide();
                }
            }
        });
        </script>
        
        <style>
        .gallery-section {
            margin-bottom: 3rem;
        }
        
        .gallery-title {
            font-size: 1.75rem;
            font-weight: 600;
            color: #333;
            margin-bottom: 0;
            text-align: center;
        }
        
        .gallery-empty {
            text-align: center;
            padding: 3rem;
            color: #666;
            font-style: italic;
        }
        
        .gallery-error {
            text-align: center;
            padding: 2rem;
            background: #f8d7da;
            color: #721c24;
            border-radius: 8px;
            margin: 1rem 0;
        }
        
        /* Responsive adjustments */
        @media (max-width: 768px) {
            .grid-container {
                grid-template-columns: repeat(2, 1fr) !important;
                gap: 10px !important;
            }
            
            .masonry-container {
                column-width: 200px !important;
                column-gap: 10px !important;
            }
            
            .lightbox-grid-container {
                grid-template-columns: repeat(4, 1fr) !important;
                gap: 8px !important;
            }
        }
        
        @media (max-width: 480px) {
            .grid-container {
                grid-template-columns: 1fr !important;
            }
            
            .lightbox-grid-container {
                grid-template-columns: repeat(3, 1fr) !important;
            }
        }
        </style>
        `;
    }
}

module.exports = GalleryRenderingService;