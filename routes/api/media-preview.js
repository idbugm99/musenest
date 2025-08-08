/**
 * Media Preview API - Watermarked Admin Previews
 * Secure image preview with watermarking for admin use
 * Created: August 7, 2025 - Phase 2 Backend Infrastructure
 */

const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const router = express.Router();
const db = require('../../config/database');
const logger = require('../../utils/logger');

// Import the watermark service (will be created)
let AdminWatermarkService = null;
try {
    AdminWatermarkService = require('../../src/services/AdminWatermarkService');
} catch (error) {
    console.warn('AdminWatermarkService not yet implemented, using fallback');
}

/**
 * Get watermarked preview image
 * GET /api/media-preview/:id/:type?token=security_token
 * Types: thumbnail, full, lightbox
 */
router.get('/:id/:type?', async (req, res) => {
    try {
        const contentId = parseInt(req.params.id);
        const previewType = req.params.type || 'thumbnail';
        const securityToken = req.query.token;

        // Validate parameters
        if (!contentId || isNaN(contentId)) {
            return res.fail(400, 'Invalid content ID');
        }

        if (!['thumbnail', 'full', 'lightbox'].includes(previewType)) {
            return res.fail(400, 'Invalid preview type. Must be: thumbnail, full, or lightbox');
        }

        // Get content info from database
        const [contentInfo] = await db.execute(`
            SELECT 
                cm.id,
                cm.image_path,
                cm.original_path,
                cm.blurred_path,
                cm.model_id,
                cm.admin_preview_watermarked,
                cm.watermark_generated_at,
                cm.preview_access_count,
                m.name as model_name
            FROM content_moderation cm
            LEFT JOIN models m ON cm.model_id = m.id
            WHERE cm.id = ?
        `, [contentId]);

        if (contentInfo.length === 0) return res.fail(404, 'Content not found');

        const content = contentInfo[0];

        // For now, implement basic image serving with planned watermark integration
        // TODO: Integrate AdminWatermarkService once Sharp.js is installed
        
        if (AdminWatermarkService) {
            // Full watermark service implementation
            const watermarkService = new AdminWatermarkService();
            await watermarkService.initialize();

            const adminUserId = req.user?.id || 1; // Default admin user, will be from auth
            
            const result = await watermarkService.generateWatermarkedPreview(
                content.original_path || content.image_path,
                contentId,
                adminUserId,
                previewType
            );

            if (result.success) {
                // Update access count
                await db.execute(`
                    UPDATE content_moderation 
                    SET preview_access_count = preview_access_count + 1,
                        admin_preview_watermarked = TRUE,
                        watermark_generated_at = NOW()
                    WHERE id = ?
                `, [contentId]);

                // Serve watermarked image
                const imageBuffer = await fs.readFile(result.watermarkedPath);
                res.set({
                    'Content-Type': 'image/jpeg',
                    'Cache-Control': 'private, no-cache, no-store',
                    'X-Content-Type-Options': 'nosniff',
                    'X-Security-Token': result.securityToken
                });
                return res.send(imageBuffer);
            } else {
                logger.warn('media-preview watermark generation failed', { error: result.error });
                // Fall through to basic serving
            }
        }

        // Fallback: Basic image serving with planned watermark headers
        // Prefer blurred asset when available to avoid exposing originals
        const publicRoot = path.join(__dirname, '../../public');
        const toFsPath = (p) => {
            if (!p) return null;
            if (p.startsWith('/uploads/')) return path.join(publicRoot, p.replace(/^\//, ''));
            return p; // already absolute on-disk path
        };

        const blurredFs = toFsPath(content.blurred_path);
        const imageFs = toFsPath(content.image_path);
        const originalFs = toFsPath(content.original_path);
        const imagePath = blurredFs || imageFs || originalFs;
        
        // Check if image file exists
        try {
            await fs.access(imagePath);
        } catch (fileError) {
            return res.fail(404, 'Image file not found on disk', imagePath);
        }

        // Log preview access for audit
        const adminUserId = req.user?.id || 1; // Will be from proper auth
        await logPreviewAccess(adminUserId, contentId, previewType, imagePath, req);

        // Update access count
        await db.execute(`
            UPDATE content_moderation 
            SET preview_access_count = preview_access_count + 1
            WHERE id = ?
        `, [contentId]);

        // Serve image with security headers
        res.set({
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'private, no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-Admin-Preview': 'true',
            'X-Watermark-Status': AdminWatermarkService ? 'enabled' : 'pending',
            'X-Preview-Path': blurredFs ? 'blurred' : (imageFs ? 'image' : 'original')
        });

        // For thumbnails, we could resize here, but for now serve original
        const imageBuffer = await fs.readFile(imagePath);
        res.send(imageBuffer);

        } catch (error) {
            logger.error('media-preview error', { error: error.message });
            res.fail(500, 'Failed to generate preview', error.message);
        }
});

/**
 * Get preview metadata without serving image
 * GET /api/media-preview/:id/info
 */
router.get('/info/:id', async (req, res) => {
    try {
        const contentId = parseInt(req.params.id);

        if (!contentId || isNaN(contentId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid content ID'
            });
        }

        // Get comprehensive content info
        const [contentInfo] = await db.execute(`
            SELECT 
                cm.id,
                cm.image_path,
                cm.original_path,
                cm.model_id,
                cm.nudity_score,
                cm.final_risk_score,
                cm.risk_level,
                cm.moderation_status,
                cm.final_location,
                cm.admin_preview_watermarked,
                cm.watermark_generated_at,
                cm.preview_access_count,
                cm.created_at,
                
                -- Model info
                m.name as model_name,
                m.display_name as model_display_name,
                
                -- Review queue info if exists
                mrq.review_status,
                mrq.priority,
                mrq.violation_category,
                mrq.violation_severity,
                mrq.flagged_at,
                mrq.reviewed_at
                
            FROM content_moderation cm
            LEFT JOIN models m ON cm.model_id = m.id
            LEFT JOIN media_review_queue mrq ON cm.id = mrq.content_moderation_id
            WHERE cm.id = ?
        `, [contentId]);

        if (contentInfo.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Content not found'
            });
        }

        const content = contentInfo[0];

        // Get recent preview access logs
        const [recentAccess] = await db.execute(`
            SELECT 
                admin_username,
                preview_type,
                access_timestamp,
                ip_address
            FROM admin_preview_log
            WHERE content_moderation_id = ?
            ORDER BY access_timestamp DESC
            LIMIT 10
        `, [contentId]);

        // Check if image file exists
        const imagePath = content.original_path || content.image_path;
        let fileExists = false;
        let fileSize = null;
        
        try {
            const stats = await fs.stat(imagePath);
            fileExists = true;
            fileSize = stats.size;
        } catch (error) {
            fileExists = false;
        }

        res.json({
            success: true,
            content: {
                ...content,
                nudity_score: parseFloat(content.nudity_score) || 0,
                final_risk_score: parseFloat(content.final_risk_score) || null,
                violation_severity: parseFloat(content.violation_severity) || null
            },
            file_info: {
                path: imagePath,
                exists: fileExists,
                size_bytes: fileSize
            },
            preview_info: {
                watermarked: Boolean(content.admin_preview_watermarked),
                access_count: content.preview_access_count || 0,
                last_watermark: content.watermark_generated_at
            },
            recent_access: recentAccess,
            available_preview_types: ['thumbnail', 'full', 'lightbox']
        });

    } catch (error) {
        console.error('Preview info error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get preview info',
            details: error.message
        });
    }
});

/**
 * Batch preview URLs for multiple content items
 * POST /api/media-preview/batch-urls
 * Body: { content_ids: [1, 2, 3], preview_type: 'thumbnail' }
 */
router.post('/batch-urls', async (req, res) => {
    try {
        const { content_ids, preview_type = 'thumbnail' } = req.body;

        if (!Array.isArray(content_ids) || content_ids.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'content_ids must be a non-empty array'
            });
        }

        if (content_ids.length > 100) {
            return res.status(400).json({
                success: false,
                error: 'Maximum 100 content IDs allowed per batch'
            });
        }

        const validIds = content_ids.filter(id => Number.isInteger(id) && id > 0);
        
        if (validIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No valid content IDs provided'
            });
        }

        // Get content info for all IDs
        const placeholders = validIds.map(() => '?').join(',');
        const [contentItems] = await db.execute(`
            SELECT 
                cm.id,
                cm.image_path,
                cm.original_path,
                m.name as model_name,
                cm.moderation_status
            FROM content_moderation cm
            LEFT JOIN models m ON cm.model_id = m.id
            WHERE cm.id IN (${placeholders})
        `, validIds);

        // Generate preview URLs
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const previewUrls = contentItems.map(item => ({
            content_id: item.id,
            model_name: item.model_name,
            preview_url: `${baseUrl}/api/media-preview/${item.id}/${preview_type}`,
            info_url: `${baseUrl}/api/media-preview/${item.id}/info`,
            status: item.moderation_status
        }));

        // Identify missing IDs
        const foundIds = contentItems.map(item => item.id);
        const missingIds = validIds.filter(id => !foundIds.includes(id));

        res.json({
            success: true,
            preview_urls: previewUrls,
            requested_count: validIds.length,
            found_count: contentItems.length,
            missing_ids: missingIds,
            preview_type: preview_type
        });

    } catch (error) {
        console.error('Batch preview URLs error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate batch preview URLs',
            details: error.message
        });
    }
});

/**
 * Helper function to log preview access for audit trail
 */
async function logPreviewAccess(adminUserId, contentId, previewType, imagePath, req) {
    try {
        const adminUsername = req.user?.username || 'unknown_admin';
        const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
        const userAgent = req.get('User-Agent') || 'unknown';
        const sessionId = req.session?.id || req.sessionID || 'no_session';

        // Get model name for the log
        const [modelInfo] = await db.execute(`
            SELECT m.name as model_name
            FROM content_moderation cm
            LEFT JOIN models m ON cm.model_id = m.id
            WHERE cm.id = ?
        `, [contentId]);

        const modelName = modelInfo.length > 0 ? modelInfo[0].model_name : 'unknown_model';

        await db.execute(`
            INSERT INTO admin_preview_log (
                admin_user_id, admin_username, content_moderation_id, 
                model_name, preview_type, image_path, 
                ip_address, user_agent, session_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            adminUserId, adminUsername, contentId,
            modelName, previewType, imagePath,
            ipAddress, userAgent, sessionId
        ]);

    } catch (error) {
        console.error('Preview access logging failed:', error);
        // Don't fail the main request if logging fails
    }
}

module.exports = router;