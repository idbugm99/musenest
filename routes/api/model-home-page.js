const express = require('express');
const { query } = require('../../config/database');
const router = express.Router();

/**
 * GET /api/model-content/:slug/home-page
 * Get home page content for a specific model
 */
router.get('/model-content/:slug/home-page', async (req, res) => {
    try {
        const modelSlug = req.params.slug;
        
        // Get model ID from slug
        const modelResult = await query(
            'SELECT id FROM models WHERE slug = ?',
            [modelSlug]
        );
        
        if (!modelResult.length) {
            return res.status(404).json({
                success: false,
                message: 'Model not found'
            });
        }
        
        const modelId = modelResult[0].id;
        
        // Get home page content
        const contentResult = await query(
            'SELECT * FROM model_home_page_content WHERE model_id = ?',
            [modelId]
        );
        
        if (!contentResult.length) {
            // Return default content if none exists
            return res.json({
                success: true,
                content: {
                    hero_section_visible: true,
                    hero_title: 'Welcome',
                    hero_subtitle: 'Elegance & Sophistication',
                    hero_button_1_text: 'View Calendar',
                    hero_button_1_link: 'calendar',
                    hero_button_2_text: 'Contact Me',
                    hero_button_2_link: 'contact',
                    about_section_visible: true,
                    about_title: 'About Me',
                    about_paragraph_1: '',
                    about_paragraph_2: '',
                    about_link_text: 'Learn More',
                    about_link_destination: 'about',
                    portrait_section_visible: true,
                    portrait_image_id: null,
                    portrait_alt: 'Professional portrait',
                    gallery_section_visible: true,
                    gallery_section_title: 'Gallery',
                    gallery_button_text: 'View Gallery',
                    gallery_button_link: 'gallery',
                    featured_gallery_section_id: null,
                    testimonials_section_visible: true,
                    testimonials_section_title: 'What Clients Say',
                    testimonials_display_count: 3,
                    cta_section_visible: true,
                    cta_section_title: 'Ready to Meet?',
                    cta_section_subtitle: 'Let\'s create an unforgettable experience together...',
                    cta_button_1_text: 'Book Now',
                    cta_button_1_link: 'calendar',
                    cta_button_2_text: 'Learn More',
                    cta_button_2_link: 'about'
                }
            });
        }
        
        res.json({
            success: true,
            content: contentResult[0]
        });
        
    } catch (error) {
        console.error('Error fetching home page content:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

/**
 * PUT /api/model-content/:slug/home-page
 * Update home page content for a specific model
 */
router.put('/model-content/:slug/home-page', async (req, res) => {
    try {
        const modelSlug = req.params.slug;
        const updates = req.body;
        
        // Get model ID from slug
        const modelResult = await query(
            'SELECT id FROM models WHERE slug = ?',
            [modelSlug]
        );
        
        if (!modelResult.length) {
            return res.status(404).json({
                success: false,
                message: 'Model not found'
            });
        }
        
        const modelId = modelResult[0].id;
        
        // Check if content exists
        const existingContent = await query(
            'SELECT id FROM model_home_page_content WHERE model_id = ?',
            [modelId]
        );
        
        if (!existingContent.length) {
            // Create new record with all defaults first
            await query(`
                INSERT INTO model_home_page_content (
                    model_id, 
                    hero_title, 
                    hero_subtitle, 
                    about_title, 
                    gallery_section_title, 
                    testimonials_section_title, 
                    cta_section_title
                ) VALUES (?, 'Welcome', 'Elegance & Sophistication', 'About Me', 'Gallery', 'What Clients Say', 'Ready to Meet?')
            `, [modelId]);
        }
        
        // Build dynamic update query based on provided fields
        const allowedFields = [
            'hero_section_visible', 'hero_title', 'hero_subtitle', 'hero_background_image_id', 'hero_background_opacity',
            'hero_button_1_text', 'hero_button_1_link', 'hero_button_2_text', 'hero_button_2_link',
            'about_section_visible', 'about_title', 'about_paragraph_1', 'about_paragraph_2', 
            'about_link_text', 'about_link_destination', 'portrait_image_id', 'portrait_alt', 'portrait_section_visible',
            'gallery_section_visible', 'featured_gallery_section_id', 'gallery_section_title', 
            'gallery_button_text', 'gallery_button_link',
            'testimonials_section_visible', 'testimonials_section_title', 'testimonials_display_count',
            'cta_section_visible', 'cta_section_title', 'cta_section_subtitle', 
            'cta_button_1_text', 'cta_button_1_link', 'cta_button_2_text', 'cta_button_2_link'
        ];
        
        const updateFields = [];
        const updateValues = [];
        
        for (const [field, value] of Object.entries(updates)) {
            if (allowedFields.includes(field)) {
                updateFields.push(`${field} = ?`);
                
                // Handle boolean fields
                if (field.includes('visible') || field.includes('show')) {
                    updateValues.push(value ? 1 : 0);
                } else if (value === '' || value === null) {
                    updateValues.push(null);
                } else {
                    updateValues.push(value);
                }
            }
        }
        
        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid fields to update'
            });
        }
        
        // Add updated_at
        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        updateValues.push(modelId);
        
        const updateQuery = `
            UPDATE model_home_page_content 
            SET ${updateFields.join(', ')} 
            WHERE model_id = ?
        `;
        
        await query(updateQuery, updateValues);
        
        res.json({
            success: true,
            message: 'Home page content updated successfully'
        });
        
    } catch (error) {
        console.error('Error updating home page content:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

/**
 * GET /api/model-gallery/:slug/images
 * Get gallery images for a specific model (for dropdowns)
 */
router.get('/model-gallery/:slug/images', async (req, res) => {
    try {
        const modelSlug = req.params.slug;
        
        // Get model ID from slug
        const modelResult = await query(
            'SELECT id FROM models WHERE slug = ?',
            [modelSlug]
        );
        
        if (!modelResult.length) {
            return res.status(404).json({
                success: false,
                message: 'Model not found'
            });
        }
        
        const modelId = modelResult[0].id;
        
        // Get gallery images
        const images = await query(`
            SELECT id, filename, category, caption 
            FROM gallery_images 
            WHERE model_id = ? AND status = 'approved' 
            ORDER BY created_at DESC
            LIMIT 50
        `, [modelId]);
        
        res.json({
            success: true,
            images: images
        });
        
    } catch (error) {
        console.error('Error fetching gallery images:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

/**
 * GET /api/model-gallery/:slug/sections
 * Get gallery sections for a specific model (for dropdowns)
 */
router.get('/model-gallery/:slug/sections', async (req, res) => {
    try {
        const modelSlug = req.params.slug;
        
        // Get model ID from slug
        const modelResult = await query(
            'SELECT id FROM models WHERE slug = ?',
            [modelSlug]
        );
        
        if (!modelResult.length) {
            return res.status(404).json({
                success: false,
                message: 'Model not found'
            });
        }
        
        const modelId = modelResult[0].id;
        
        // Get gallery sections with image counts
        const sections = await query(`
            SELECT 
                gs.id,
                gs.title,
                gs.layout_type,
                gs.is_visible,
                COUNT(gi.id) as image_count
            FROM gallery_sections gs
            LEFT JOIN gallery_images gi ON gs.id = gi.section_id AND gi.status = 'approved'
            WHERE gs.model_id = ?
            GROUP BY gs.id, gs.title, gs.layout_type, gs.is_visible
            ORDER BY gs.sort_order ASC, gs.title ASC
        `, [modelId]);
        
        // Add images array for each section (simplified for dropdown use)
        const sectionsWithImages = sections.map(section => ({
            ...section,
            images: { length: section.image_count }
        }));
        
        res.json({
            success: true,
            sections: sectionsWithImages
        });
        
    } catch (error) {
        console.error('Error fetching gallery sections:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

module.exports = router;