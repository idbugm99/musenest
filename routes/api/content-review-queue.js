/**
 * Media Review Queue API - Seamless Media Governance Flow
 * Provides unified interface for admin media moderation with thumbnails and review actions
 */

// DEBUG: Test if this file is even being loaded removed for production

const express = require('express');
const path = require('path');
const fsPromises = require('fs').promises;
const db = require('../../config/database');
const logger = require('../../utils/logger');
const ContentModerationService = require('../../src/services/ContentModerationService');
const router = express.Router();

/**
 * Get media review queue with filtering and pagination
 */
router.get('/queue', async (req, res) => {
    try {
        const {
            status = 'pending',
            priority,
            queue_type,
            usage_intent,
            model_search,
            page = 1,
            limit = 20,
            sort_by = 'flagged_at',
            sort_order = 'DESC'
        } = req.query;

        // Build query with safe LIMIT interpolation (values are validated)
        const limitValue = Math.max(1, Math.min(100, parseInt(limit))); // Clamp between 1-100
        const offsetValue = Math.max(0, (parseInt(page) - 1) * limitValue);
        
        const query = `
            SELECT 
                id, model_name, review_status, nudity_score, priority, queue_type, 
                usage_intent, flagged_at, original_path, detected_parts, context_type,
                appeal_reason, appeal_message, appeal_requested, final_risk_score,
                risk_level, combined_assessment, pose_classification, explicit_pose_score
            FROM media_review_queue 
            WHERE review_status = ?
            ORDER BY flagged_at DESC
            LIMIT ${limitValue} OFFSET ${offsetValue}
        `;

        logger.debug('media-review.queue list', { page, limit: limitValue, status });
        
        const [queueItems] = await db.execute(query, [status]);
        
        logger.debug('media-review.queue list result', { count: queueItems.length });

        // Get total count
        const [countResult] = await db.execute(
            'SELECT COUNT(*) as total FROM media_review_queue WHERE review_status = ?', 
            [status]
        );
        const total = countResult[0].total;

        // Process queue items to add thumbnail paths and convert data types
        const processedItems = await Promise.all(queueItems.map(async (item) => {
            // Generate thumbnail path
            const thumbnailPath = await generateThumbnailPath(item.original_path, item.model_name);
            
            // Parse JSON fields
            const detectedParts = typeof item.detected_parts === 'string' 
                ? JSON.parse(item.detected_parts || '{}') 
                : item.detected_parts || {};
            
            const partLocations = typeof item.part_locations === 'string'
                ? JSON.parse(item.part_locations || '{}')
                : item.part_locations || {};

            const policyViolations = typeof item.policy_violations === 'string'
                ? JSON.parse(item.policy_violations || '[]')
                : item.policy_violations || [];

            const blurSettings = typeof item.blur_settings === 'string' && item.blur_settings
                ? JSON.parse(item.blur_settings)
                : null;

            const combinedAssessment = typeof item.combined_assessment === 'string' 
                ? JSON.parse(item.combined_assessment || '{}') 
                : item.combined_assessment || {};

            return {
                ...item,
                // Convert numeric fields from strings to numbers
                nudity_score: parseFloat(item.nudity_score) || 0,
                explicit_pose_score: parseFloat(item.explicit_pose_score) || 0,
                final_risk_score: parseFloat(item.final_risk_score) || null,
                // Processed fields
                thumbnail_path: thumbnailPath,
                detected_parts: detectedParts,
                part_locations: partLocations,
                policy_violations: policyViolations,
                blur_settings: blurSettings,
                combined_assessment: combinedAssessment,
                has_appeal: Boolean(item.appeal_requested)
            };
        }));

        res.set('Cache-Control', 'private, max-age=15');
        res.json({
            success: true,
            queue: processedItems,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            },
            filters: { status, priority, queue_type, usage_intent, model_search }
        });

    } catch (error) {
        logger.error('media-review.queue error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Failed to fetch media review queue',
            error: error.message
        });
    }
});

/**
 * Get queue statistics for dashboard
 */
router.get('/stats', async (req, res) => {
    try {
        const [stats] = await db.execute('SELECT * FROM media_queue_stats');
        
        // Get additional stats
        const [priorityStats] = await db.execute(`
            SELECT 
                priority,
                COUNT(*) as count
            FROM media_review_queue 
            WHERE review_status = 'pending'
            GROUP BY priority
        `);

        const [usageIntentStats] = await db.execute(`
            SELECT 
                usage_intent,
                COUNT(*) as count,
                AVG(nudity_score) as avg_score
            FROM media_review_queue 
            WHERE review_status = 'pending'
            GROUP BY usage_intent
        `);

        const [queueTypeStats] = await db.execute(`
            SELECT 
                queue_type,
                COUNT(*) as count
            FROM media_review_queue 
            WHERE review_status = 'pending'
            GROUP BY queue_type
        `);

        res.json({
            success: true,
            overview: stats[0] || {
                total_queue: 0,
                urgent_items: 0,
                appeal_items: 0,
                auto_flagged: 0,
                approved_items: 0,
                blurred_items: 0,
                rejected_items: 0,
                avg_nudity_score: 0
            },
            priority_breakdown: priorityStats,
            usage_intent_breakdown: usageIntentStats,
            queue_type_breakdown: queueTypeStats
        });

    } catch (error) {
        console.error('Error fetching queue stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch queue statistics',
            details: error.message
        });
    }
});

/**
 * Get single media item for detailed review
 */
router.get('/item/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const [items] = await db.execute(
            'SELECT * FROM media_review_queue WHERE id = ?',
            [id]
        );

        if (items.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Media item not found'
            });
        }

        const item = items[0];
        
        // Process JSON fields, convert data types, and add additional data
        const processedItem = {
            ...item,
            // Convert numeric fields from strings to numbers
            nudity_score: parseFloat(item.nudity_score) || 0,
            explicit_pose_score: parseFloat(item.explicit_pose_score) || 0,
            final_risk_score: parseFloat(item.final_risk_score) || null,
            // Parse JSON fields
            detected_parts: typeof item.detected_parts === 'string' 
                ? JSON.parse(item.detected_parts || '{}') 
                : item.detected_parts || {},
            part_locations: typeof item.part_locations === 'string'
                ? JSON.parse(item.part_locations || '{}')
                : item.part_locations || {},
            policy_violations: typeof item.policy_violations === 'string'
                ? JSON.parse(item.policy_violations || '[]')
                : item.policy_violations || [],
            combined_assessment: typeof item.combined_assessment === 'string' 
                ? JSON.parse(item.combined_assessment || '{}') 
                : item.combined_assessment || {},
            blur_settings: typeof item.blur_settings === 'string' && item.blur_settings
                ? JSON.parse(item.blur_settings)
                : null,
            thumbnail_path: await generateThumbnailPath(item.original_path, item.model_name),
            has_appeal: Boolean(item.appeal_requested)
        };

        res.json({ success: true, item: processedItem });

    } catch (error) {
        logger.error('media-review.item error', { error: error.message });
        res.status(500).json({ success: false, message: 'Failed to fetch media item', error: error.message });
    }
});

/**
 * Approve media item (move to appropriate folder)
 */
router.post('/approve/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { admin_notes, reviewed_by = 1, final_location } = req.body;

        console.log('🟢 APPROVE: Starting approve process for ID:', id);
        console.log('🟢 APPROVE: Request body:', req.body);

        const [items] = await db.execute(
            'SELECT * FROM media_review_queue WHERE id = ?',
            [id]
        );

        console.log('🟢 APPROVE: Database query result:', items.length, 'items found');

        if (items.length === 0) {
            console.log('🔴 APPROVE: No items found for ID:', id);
            return res.fail(404, 'Media item not found');
        }

        const item = items[0];
        console.log('🟢 APPROVE: Item found:', { 
            model_name: item.model_name,
            usage_intent: item.usage_intent,
            content_moderation_id: item.content_moderation_id 
        });
        
        const targetLocation = final_location || getFinalLocationFromUsageIntent(item.usage_intent);
        console.log('🟢 APPROVE: Target location determined:', targetLocation);

        // Move file to appropriate folder
        console.log('🟢 APPROVE: About to move file:', {
            original_path: item.original_path,
            model_name: item.model_name,
            targetLocation
        });
        
        const success = await moveMediaFile(item.original_path, item.model_name, targetLocation);
        console.log('🟢 APPROVE: File move result:', success);
        
        if (!success) {
            console.log('🔴 APPROVE: Failed to move media file');
            throw new Error('Failed to move media file');
        }

        // Update media review queue
        console.log('🟢 APPROVE: About to update media review queue');
        await db.execute(`
            UPDATE media_review_queue 
            SET 
                review_status = 'approved',
                final_location = ?,
                file_moved = TRUE,
                moved_at = NOW(),
                reviewed_by = ?,
                reviewed_at = NOW(),
                updated_at = NOW()
            WHERE id = ?
        `, [targetLocation, reviewed_by, id]);
        console.log('🟢 APPROVE: Media review queue updated successfully');

        // Update original content_moderation record
        console.log('🟢 APPROVE: About to update content_moderation record:', item.content_moderation_id);
        await db.execute(`
            UPDATE content_moderation 
            SET 
                moderation_status = 'approved',
                final_location = ?,
                reviewed_by = ?,
                reviewed_at = NOW()
            WHERE id = ?
        `, [targetLocation, reviewed_by, item.content_moderation_id]);
        console.log('🟢 APPROVE: Content moderation record updated successfully');

        // CRITICAL FIX: Update model_media_library table (where gallery gets data from)
        console.log('🟢 APPROVE: About to update model_media_library table');
        const libraryUpdateResult = await db.execute(`
            UPDATE model_media_library 
            SET moderation_status = 'approved' 
            WHERE model_slug = ? AND filename LIKE ?
        `, [item.model_slug, `%${path.basename(item.original_path)}%`]);
        console.log('🟢 APPROVE: Model media library updated, affected rows:', libraryUpdateResult[0].affectedRows);

        console.log('🟢 APPROVE: All operations completed successfully, sending response');
        res.success({ final_location: targetLocation }, { message: 'Media approved and moved successfully' });

    } catch (error) {
        console.log('🔴 APPROVE: Error occurred:', error.message);
        console.log('🔴 APPROVE: Error stack:', error.stack);
        logger.error('media-review.approve error', { error: error.message });
        res.fail(500, 'Failed to approve media', error.message);
    }
});

/**
 * Approve media with blur (create blurred version)
 */
router.post('/approve-blur/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log('Approve blur request for ID:', id);
        console.log('Request body:', req.body);
        
        fs.appendFileSync('/tmp/blur_debug.log', `=== APPROVE-BLUR ENDPOINT CALLED ===\n`);
        fs.appendFileSync('/tmp/blur_debug.log', `ID: ${id}\n`);
        fs.appendFileSync('/tmp/blur_debug.log', `Request body: ${JSON.stringify(req.body, null, 2)}\n`);
        
        const { 
            blur_settings = { strength: 6, opacity: 0.8, shape: 'rounded' },
            admin_notes, 
            reviewed_by = 1 
        } = req.body;
        
        console.log('Raw request body:', JSON.stringify(req.body, null, 2));
        console.log('Extracted blur_settings:', blur_settings);
        console.log('Extracted admin_notes type and length:', typeof admin_notes, admin_notes ? admin_notes.length : 0);
        console.log('Extracted reviewed_by type and value:', typeof reviewed_by, reviewed_by);
        console.log('=== SHAPE DEBUG START ===');
        console.log('blur_settings received:', JSON.stringify(blur_settings, null, 2));
        console.log('shape value:', blur_settings.shape);
        console.log('shape type:', typeof blur_settings.shape);
        console.log('=== SHAPE DEBUG END ===');

        const [items] = await db.execute(
            'SELECT * FROM media_review_queue WHERE id = ?',
            [id]
        );

        if (items.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Media item not found'
            });
        }

        const item = items[0];

        // Create blurred version with error handling
        console.log('Starting blur processing...');
        
        fs.appendFileSync('/tmp/blur_debug.log', `About to call createBlurredVersion with settings: ${JSON.stringify(blur_settings, null, 2)}\n`);
        
        let blurredPath;
        try {
            // Use the working ContentModerationService instead of custom logic
            const moderationService = new ContentModerationService(db);
            blurredPath = await moderationService.generateBlurredVersion(item.content_moderation_id, blur_settings);
            console.log('Blur processing completed, path:', blurredPath);
            fs.appendFileSync('/tmp/blur_debug.log', `Blur processing completed successfully\n`);
        } catch (blurError) {
            console.error('BLUR PROCESSING FAILED:', blurError);
            console.error('Blur error stack:', blurError.stack);
            fs.appendFileSync('/tmp/blur_debug.log', `BLUR ERROR: ${blurError.message}\n`);
            throw new Error(`Blur processing failed: ${blurError.message}`);
        }
        
        // Move original to public folder and blurred version as well
        const originalMoved = await moveMediaFile(item.original_path, item.model_name, 'public');
        
        if (!originalMoved) {
            throw new Error('Failed to move media files');
        }

        // Update media review queue
        await db.execute(`
            UPDATE media_review_queue 
            SET 
                review_status = 'approved_blurred',
                blur_settings = ?,
                blurred_path = ?,
                blur_applied = TRUE,
                final_location = 'public_blurred',
                file_moved = TRUE,
                moved_at = NOW(),
                reviewed_by = ?,
                reviewed_at = NOW(),
                updated_at = NOW()
            WHERE id = ?
        `, [JSON.stringify(blur_settings), blurredPath, reviewed_by, id]);

        // Update original content_moderation record
        console.log('Updating content_moderation record with ID:', item.content_moderation_id);
        console.log('Blur settings JSON:', JSON.stringify(blur_settings));
        console.log('Admin notes:', admin_notes);
        console.log('Reviewed by:', reviewed_by);
        
        try {
            console.log('Starting content_moderation update process...');
            console.log('Content moderation ID:', item.content_moderation_id);
            
            // Simple, single update with just the required fields
            const updateResult = await db.execute(`
                UPDATE content_moderation 
                SET 
                    moderation_status = 'approved',
                    final_location = 'public_blurred',
                    reviewed_by = ?,
                    reviewed_at = NOW()
                WHERE id = ?
            `, [reviewed_by, item.content_moderation_id]);
            
            console.log('Content moderation update successful, affected rows:', updateResult.affectedRows);
            
            // Verify the update worked
            const [verifyRecord] = await db.execute(
                'SELECT moderation_status, final_location FROM content_moderation WHERE id = ?',
                [item.content_moderation_id]
            );
            console.log('Verified record after update:', verifyRecord[0]);
            
            // CRITICAL FIX: Update media_review_queue status to approved_blurred
            console.log('Updating media_review_queue status to approved_blurred...');
            const queueUpdateResult = await db.execute(`
                UPDATE media_review_queue 
                SET 
                    review_status = 'approved_blurred',
                    reviewed_at = NOW(),
                    updated_at = NOW()
                WHERE id = ?
            `, [id]);
            
            console.log('Media review queue update successful, affected rows:', queueUpdateResult.affectedRows);

            // CRITICAL FIX: Update model_media_library table (where gallery gets data from)
            console.log('🟡 APPROVE-BLUR: About to update model_media_library table');
            const libraryUpdateResult = await db.execute(`
                UPDATE model_media_library 
                SET moderation_status = 'approved' 
                WHERE model_slug = ? AND filename LIKE ?
            `, [item.model_slug, `%${path.basename(item.original_path)}%`]);
            console.log('🟡 APPROVE-BLUR: Model media library updated, affected rows:', libraryUpdateResult[0].affectedRows);
            
        } catch (updateError) {
            console.error('Error updating content_moderation:', updateError);
            console.error('Error message:', updateError.message);
            console.error('Error code:', updateError.code);
            console.error('SQL State:', updateError.sqlState);
            console.error('SQL Message:', updateError.sqlMessage);
            console.error('Full error object:', JSON.stringify(updateError, null, 2));
            throw updateError;
        }

        res.json({ success: true, blurred_path: blurredPath, blur_settings, message: 'Media approved with blur successfully' });

    } catch (error) {
        logger.error('media-review.approve-blur error', { error: error.message });
        res.status(500).json({ success: false, message: 'Failed to approve media with blur', error: error.message });
    }
});

/**
 * Reject media item (move to rejected folder)
 */
router.post('/reject/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { admin_notes, reviewed_by = 1, reason } = req.body;

        if (!admin_notes || !admin_notes.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Admin notes are required for rejection'
            });
        }

        const [items] = await db.execute(
            'SELECT * FROM media_review_queue WHERE id = ?',
            [id]
        );

        if (items.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Media item not found'
            });
        }

        const item = items[0];

        // Move file to rejected folder
        const success = await moveMediaFile(item.original_path, item.model_name, 'rejected');
        
        if (!success) {
            throw new Error('Failed to move media file to rejected folder');
        }

        // Update media review queue
        await db.execute(`
            UPDATE media_review_queue 
            SET 
                review_status = 'rejected',
                final_location = 'rejected',
                file_moved = TRUE,
                moved_at = NOW(),
                reviewed_by = ?,
                reviewed_at = NOW(),
                updated_at = NOW()
            WHERE id = ?
        `, [reviewed_by, id]);

        // Update original content_moderation record
        await db.execute(`
            UPDATE content_moderation 
            SET 
                moderation_status = 'rejected',
                final_location = 'rejected',
                reviewed_by = ?,
                reviewed_at = NOW()
            WHERE id = ?
        `, [reviewed_by, item.content_moderation_id]);

        // CRITICAL FIX: Update model_media_library table (where gallery gets data from)
        console.log('🔴 REJECT: About to update model_media_library table');
        const libraryUpdateResult = await db.execute(`
            UPDATE model_media_library 
            SET moderation_status = 'rejected' 
            WHERE model_slug = ? AND filename LIKE ?
        `, [item.model_slug, `%${path.basename(item.original_path)}%`]);
        console.log('🔴 REJECT: Model media library updated, affected rows:', libraryUpdateResult[0].affectedRows);

        res.json({ success: true, reason: 'Rejected by admin', message: 'Media rejected and moved to rejected folder' });

    } catch (error) {
        logger.error('media-review.reject error', { error: error.message });
        res.status(500).json({ success: false, message: 'Failed to reject media', error: error.message });
    }
});

/**
 * Helper function to generate thumbnail path
 */
async function generateThumbnailPath(originalPath, modelName) {
    if (!originalPath) return '/placeholder-thumbnail.jpg';
    
    try {
        const fileName = path.basename(originalPath);
        const thumbFileName = `thumb_${fileName}`;
        const modelSlug = modelName.toLowerCase().replace(/\s+/g, '-');
        
        // Check if thumbnail exists
        const thumbPath = path.join(__dirname, '../../public/uploads', modelSlug, 'thumbs', thumbFileName);
        
        try {
            await fsPromises.access(thumbPath);
            return `/uploads/${modelSlug}/thumbs/${thumbFileName}`;
        } catch {
            // Thumbnail doesn't exist, return original or placeholder
            const originalWebPath = originalPath.replace(path.join(__dirname, '../../public'), '');
            return originalWebPath || '/placeholder-thumbnail.jpg';
        }
    } catch (error) {
        console.error('Error generating thumbnail path:', error);
        return '/placeholder-thumbnail.jpg';
    }
}

/**
 * Helper function to get final location from usage intent
 */
function getFinalLocationFromUsageIntent(usageIntent) {
    const locationMap = {
        'public_site': 'public',
        'paysite': 'paysite',
        'store': 'store',
        'private': 'private'
    };
    return locationMap[usageIntent] || 'public';
}

/**
 * Helper function to move media file to target folder
 */
async function moveMediaFile(originalPath, modelName, targetFolder) {
    try {
        if (!originalPath || !modelName || !targetFolder) {
            throw new Error('Missing required parameters for file move');
        }

        const modelSlug = modelName.toLowerCase().replace(/\s+/g, '-');
        const fileName = path.basename(originalPath);
        const targetDir = path.join(__dirname, '../../public/uploads', modelSlug, targetFolder);
        const targetPath = path.join(targetDir, fileName);

        // Ensure target directory exists
        await fsPromises.mkdir(targetDir, { recursive: true });

        // Check if source file exists
        try {
            await fsPromises.access(originalPath);
        } catch {
            console.warn(`Source file not found: ${originalPath}`);
            return true; // Don't fail if source doesn't exist
        }

        // Move file (copy then delete to avoid cross-device issues)
        await fsPromises.copyFile(originalPath, targetPath);
        
        console.log(`Media file moved: ${originalPath} → ${targetPath}`);
        return true;

    } catch (error) {
        console.error('Error moving media file:', error);
        return false;
    }
}

/**
 * Helper function to create blurred version with actual blur effects
 */
async function createBlurredVersion(originalPath, modelName, blurSettings) {
    try {
        fs.appendFileSync('/tmp/blur_debug.log', `=== createBlurredVersion called ===\n`);
        fs.appendFileSync('/tmp/blur_debug.log', `blurSettings: ${JSON.stringify(blurSettings, null, 2)}\n`);
        fs.appendFileSync('/tmp/blur_debug.log', `overlayPositions exists: ${!!blurSettings.overlayPositions}\n`);
        fs.appendFileSync('/tmp/blur_debug.log', `overlayPositions keys: ${blurSettings.overlayPositions ? Object.keys(blurSettings.overlayPositions) : 'none'}\n`);
        
        const sharp = require('sharp');
        const modelSlug = modelName.toLowerCase().replace(/\s+/g, '-');
        const fileName = path.basename(originalPath);
        const blurredFileName = `blurred_${Date.now()}_${fileName}`;
        const blurredDir = path.join(__dirname, '../../public/uploads', modelSlug, 'public', 'blurred');
        const blurredPath = path.join(blurredDir, blurredFileName);

        // Ensure directory exists
        await fsPromises.mkdir(blurredDir, { recursive: true });

        if (!originalPath) {
            console.warn('No original path provided');
            return null;
        }

        try {
            await fsPromises.access(originalPath);
        } catch {
            console.warn('Original file not accessible:', originalPath);
            return null;
        }

        console.log('Creating blurred version with settings:', blurSettings);
        console.log('Original path:', originalPath);
        console.log('Output path:', blurredPath);
        
        // DETAILED COORDINATE DEBUGGING
        console.log('=== COORDINATE DEBUGGING START ===');
        if (blurSettings.overlayPositions) {
            for (const [part, coords] of Object.entries(blurSettings.overlayPositions)) {
                console.log(`${part} coordinates from admin interface:`, coords);
            }
        }

        // Check both raw and auto-rotated dimensions to debug coordinate issues
        const rawImage = sharp(originalPath, { autoRotate: false });
        const rawMetadata = await rawImage.metadata();
        
        const autoImage = sharp(originalPath);
        const autoMetadata = await autoImage.metadata();
        
        console.log('Raw image dimensions:', rawMetadata.width, 'x', rawMetadata.height, 'orientation:', rawMetadata.orientation);
        console.log('Auto-rotated image dimensions:', autoMetadata.width, 'x', autoMetadata.height);
        
        // Use RAW image and manually apply the same coordinate transformation as admin interface
        // The admin interface shows the rotated version, so we need to map coordinates back to raw
        let processedImage = sharp(originalPath, { autoRotate: false });

        // Apply blur to specific regions if overlay positions are provided
        if (blurSettings.overlayPositions && Object.keys(blurSettings.overlayPositions).length > 0) {
            console.log('Applying selective blur to regions:', Object.keys(blurSettings.overlayPositions));
            fs.appendFileSync('/tmp/blur_debug.log', `Entering overlayPositions loop with ${Object.keys(blurSettings.overlayPositions).length} regions\n`);
            
            // Create blur overlay for each region with calibration factor to match admin interface
            const blurCalibrationFactor = 1.25; // Calibrate to match admin preview intensity (2.5 / 2 for new range)
            const rawBlurRadius = blurSettings.strength || 6;
            const blurRadius = Math.max(1, Math.min(100, rawBlurRadius * blurCalibrationFactor));
            console.log(`Blur calibration: admin setting ${rawBlurRadius}px → actual ${blurRadius}px (${blurCalibrationFactor}x factor)`);
            
            // Collect all blur regions for single composite operation
            const blurRegions = [];
            
            for (const [bodyPart, position] of Object.entries(blurSettings.overlayPositions)) {
                console.log(`Processing blur for ${bodyPart} (received coords):`, position);
                console.log(`Auto-rotated image dimensions: ${autoMetadata.width}x${autoMetadata.height}`);
                
                // Frontend already sends coordinates in EXIF-stripped coordinate space (matching NudeNet)
                // No transformation needed - use coordinates directly
                let left = Math.round(position.x);
                let top = Math.round(position.y);
                let width = Math.round(position.width);
                let height = Math.round(position.height);
                
                console.log(`Using EXIF-stripped coordinates directly (matching NudeNet space):`);
                console.log(`  Coords: x=${left}, y=${top}, w=${width}, h=${height}`);
                
                console.log(`Final blur coordinates for processing: ${left},${top} ${width}x${height}`);
                
                // Extract region from RAW image using transformed coordinates
                // But composite will use original admin coordinates after EXIF rotation
                let compositeLeft, compositeTop;
                
                if (rawMetadata.orientation === 6) {
                    // For compositing after EXIF rotation, use original admin coordinates
                    compositeLeft = Math.round(position.x);
                    compositeTop = Math.round(position.y);
                    console.log(`Composite will use admin coordinates after rotation: ${compositeLeft},${compositeTop}`);
                } else {
                    // No rotation, use transformed coordinates for composite
                    compositeLeft = left;
                    compositeTop = top;
                }
                
                // Debug coordinates (no longer saving debug images)
                console.log(`DEBUG: Would extract region at ${left},${top} ${width}x${height}`);
                
                // Validate extraction bounds before calling sharp.extract()
                if (left < 0 || top < 0 || width <= 0 || height <= 0) {
                    console.error(`Invalid extraction bounds: left=${left}, top=${top}, width=${width}, height=${height}`);
                    throw new Error(`Invalid extraction coordinates: bounds must be positive and within image dimensions`);
                }
                
                if (left + width > rawMetadata.width || top + height > rawMetadata.height) {
                    console.error(`Extraction bounds exceed image dimensions:`);
                    console.error(`  Requested: ${left},${top} ${width}x${height}`);
                    console.error(`  Image size: ${rawMetadata.width}x${rawMetadata.height}`);
                    console.error(`  Right edge: ${left + width} (max: ${rawMetadata.width})`);
                    console.error(`  Bottom edge: ${top + height} (max: ${rawMetadata.height})`);
                    throw new Error(`Extraction area exceeds image boundaries`);
                }
                
                // Extract the region from RAW image using validated coordinates
                const originalRegion = await sharp(originalPath, { autoRotate: false })
                    .extract({ left, top, width, height })
                    .toBuffer();
                
                // Rotate the extracted region to match final image orientation if needed
                let orientedRegion = originalRegion;
                if (rawMetadata.orientation === 6) {
                    // For EXIF 6, rotate the extracted region 90° clockwise to match final orientation
                    orientedRegion = await sharp(originalRegion)
                        .rotate(90)
                        .toBuffer();
                    console.log(`Rotated extracted region 90° clockwise to match final image orientation`);
                }
                
                // Create blurred version of the oriented region
                console.log(`Creating blurred region with ${blurRadius}px blur...`);
                let blurredRegion = await sharp(orientedRegion)
                    .blur(blurRadius)
                    .toBuffer();
                
                // Apply shape mask if not rectangular
                const blurShape = (blurSettings.shape || 'square').toString().trim().toLowerCase();
                console.log(`Blur shape setting received: '${blurShape}' (type: ${typeof blurShape})`);
                
                // TEMPORARY: Disable force oval to see if that's breaking things
                const debugForceOval = false;
                const actualShape = debugForceOval ? 'oval' : blurShape;
                console.log(`DEBUG: Using shape = '${actualShape}' (original was '${blurShape}')`);
                
                // Apply oval shape if requested - simple approach
                console.log(`TESTING: actualShape='${actualShape}', blurShape='${blurShape}'`);
                
                // Write debug info to file to track what's happening
                fs.appendFileSync('/tmp/blur_debug.log', `Shape test: actualShape='${actualShape}', blurShape='${blurShape}'\n`);
                
                if (actualShape === 'oval') {
                    console.log(`*** OVAL SHAPE DETECTED - APPLYING CIRCULAR MASK ***`);
                    fs.appendFileSync('/tmp/blur_debug.log', `*** OVAL CONDITION MATCHED ***\n`);
                    console.log(`Applying oval shape to ${bodyPart} blur region`);
                    try {
                        // Simple oval mask: create a circular crop
                        const regionMeta = await sharp(blurredRegion).metadata();
                        const minDim = Math.min(regionMeta.width, regionMeta.height);
                        const radius = Math.floor(minDim / 2) - 2;
                        
                        console.log(`Creating oval mask with radius ${radius} for ${regionMeta.width}x${regionMeta.height} region`);
                        
                        // Create circular SVG mask (compatible with older Sharp versions)
                        const size = Math.min(regionMeta.width, regionMeta.height);
                        
                        // Create circular SVG mask
                        const circularMask = Buffer.from(
                            `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 1}" fill="white"/>
                            </svg>`
                        );
                        
                        // Resize blur region to square and apply circular mask
                        blurredRegion = await sharp(blurredRegion)
                            .resize(size, size, { fit: 'cover', position: 'center' })
                            .composite([{ input: circularMask, blend: 'dest-in' }])
                            .png()
                            .toBuffer();
                        
                        console.log(`Applied circular mask using SVG with radius ${size/2 - 1}`);
                        console.log(`Successfully applied oval mask to ${bodyPart}`);
                    } catch (ovalError) {
                        console.error(`Oval mask failed for ${bodyPart}:`, ovalError.message);
                        console.log(`Continuing with rectangular blur for ${bodyPart}`);
                        // blurredRegion remains unchanged - rectangular blur
                    }
                } else if (actualShape === 'rounded') {
                    console.log(`*** ROUNDED SHAPE DETECTED - APPLYING ROUNDED RECTANGLE MASK ***`);
                    fs.appendFileSync('/tmp/blur_debug.log', `*** ROUNDED CONDITION MATCHED ***\n`);
                    console.log(`Applying rounded rectangle shape to ${bodyPart} blur region`);
                    try {
                        const regionMeta = await sharp(blurredRegion).metadata();
                        const cornerRadius = Math.min(regionMeta.width, regionMeta.height) * 0.2; // 20% of smallest dimension
                        
                        console.log(`Creating rounded rectangle mask with ${cornerRadius}px corners for ${regionMeta.width}x${regionMeta.height} region`);
                        
                        // Create rounded rectangle SVG mask
                        const roundedRectMask = Buffer.from(
                            `<svg width="${regionMeta.width}" height="${regionMeta.height}" xmlns="http://www.w3.org/2000/svg">
                                <rect x="0" y="0" width="${regionMeta.width}" height="${regionMeta.height}" rx="${cornerRadius}" ry="${cornerRadius}" fill="white"/>
                            </svg>`
                        );
                        
                        // Apply rounded rectangle mask
                        blurredRegion = await sharp(blurredRegion)
                            .composite([{ input: roundedRectMask, blend: 'dest-in' }])
                            .png()
                            .toBuffer();
                        
                        console.log(`Applied rounded rectangle mask with ${cornerRadius}px corners`);
                        console.log(`Successfully applied rounded mask to ${bodyPart}`);
                    } catch (roundedError) {
                        console.error(`Rounded mask failed for ${bodyPart}:`, roundedError.message);
                        console.log(`Continuing with rectangular blur for ${bodyPart}`);
                        // blurredRegion remains unchanged - rectangular blur
                    }
                } else {
                    console.log(`Using rectangular blur for ${bodyPart} (shape: ${actualShape})`);
                }
                
                // Debug blur processing (no longer saving debug images)
                console.log(`DEBUG: Applied ${blurRadius}px blur to ${bodyPart} region`);
                
                // Create white overlay to match admin interface preview
                const opacity = Math.max(0, Math.min(1, blurSettings.opacity || 0.8));
                
                // Get blurred region dimensions (might be different if oval was applied)
                const blurredMeta = await sharp(blurredRegion).metadata();
                
                // Create white overlay with user-specified opacity from admin interface
                // Apply calibration factor to match admin interface preview (similar to blur calibration)
                const opacityCalibrationFactor = 2.5; // Calibrate to match admin preview opacity
                const enhancedOpacity = Math.min(1.0, opacity * opacityCalibrationFactor);
                console.log(`Creating white overlay with opacity: ${enhancedOpacity} (${enhancedOpacity * 100}%)`);
                fs.appendFileSync('/tmp/blur_debug.log', `Creating white overlay with opacity: ${enhancedOpacity} (${enhancedOpacity * 100}%)\n`);
                
                let whiteOverlay = await sharp({
                    create: {
                        width: blurredMeta.width,
                        height: blurredMeta.height,
                        channels: 4,
                        background: { r: 255, g: 255, b: 255, alpha: enhancedOpacity }
                    }
                }).png().toBuffer();
                
                // Apply matching shape to white overlay
                if (actualShape === 'oval') {
                    try {
                        console.log(`Applying circular shape to white overlay to match blur`);
                        fs.appendFileSync('/tmp/blur_debug.log', `Attempting to apply circular shape to white overlay\n`);
                        
                        const overlaySize = Math.min(blurredMeta.width, blurredMeta.height);
                        
                        // Create circular SVG mask for white overlay (same as blur region)
                        const overlayCircularMask = Buffer.from(
                            `<svg width="${overlaySize}" height="${overlaySize}" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="${overlaySize/2}" cy="${overlaySize/2}" r="${overlaySize/2 - 1}" fill="white"/>
                            </svg>`
                        );
                        
                        // Apply circular mask to white overlay using SVG
                        whiteOverlay = await sharp(whiteOverlay)
                            .resize(overlaySize, overlaySize, { fit: 'cover', position: 'center' })
                            .composite([{ input: overlayCircularMask, blend: 'dest-in' }])
                            .png()
                            .toBuffer();
                            
                        fs.appendFileSync('/tmp/blur_debug.log', `Successfully applied circular shape to white overlay using SVG\n`);
                    } catch (overlayError) {
                        console.error(`White overlay circular processing failed:`, overlayError.message);
                        fs.appendFileSync('/tmp/blur_debug.log', `WHITE OVERLAY ERROR: ${overlayError.message}\n`);
                        // Continue with rectangular white overlay if circular fails
                    }
                } else if (actualShape === 'rounded') {
                    try {
                        console.log(`Applying rounded rectangle shape to white overlay to match blur`);
                        fs.appendFileSync('/tmp/blur_debug.log', `Attempting to apply rounded rectangle shape to white overlay\n`);
                        
                        const cornerRadius = Math.min(blurredMeta.width, blurredMeta.height) * 0.2; // Same as blur region
                        
                        // Create rounded rectangle SVG mask for white overlay (same as blur region)
                        const overlayRoundedMask = Buffer.from(
                            `<svg width="${blurredMeta.width}" height="${blurredMeta.height}" xmlns="http://www.w3.org/2000/svg">
                                <rect x="0" y="0" width="${blurredMeta.width}" height="${blurredMeta.height}" rx="${cornerRadius}" ry="${cornerRadius}" fill="white"/>
                            </svg>`
                        );
                        
                        // Apply rounded rectangle mask to white overlay using SVG
                        whiteOverlay = await sharp(whiteOverlay)
                            .composite([{ input: overlayRoundedMask, blend: 'dest-in' }])
                            .png()
                            .toBuffer();
                            
                        fs.appendFileSync('/tmp/blur_debug.log', `Successfully applied rounded rectangle shape to white overlay using SVG\n`);
                    } catch (overlayError) {
                        console.error(`White overlay rounded processing failed:`, overlayError.message);
                        fs.appendFileSync('/tmp/blur_debug.log', `WHITE OVERLAY ERROR: ${overlayError.message}\n`);
                        // Continue with rectangular white overlay if rounded fails
                    }
                }
                
                // For content moderation, use fully blurred region as base (no blending with original)
                // Apply white overlay directly on top of blurred region for maximum obscuring
                console.log(`Compositing white overlay onto blurred region...`);
                fs.appendFileSync('/tmp/blur_debug.log', `Compositing white overlay with ${enhancedOpacity * 100}% opacity onto blurred region\n`);
                
                const blendedRegion = await sharp(blurredRegion)
                    .composite([
                        {
                            input: whiteOverlay,
                            blend: 'over'  // White overlay with user-specified opacity
                        }
                    ])
                    .toBuffer();
                
                console.log(`White overlay composite completed`);
                fs.appendFileSync('/tmp/blur_debug.log', `White overlay composite completed successfully\n`);
                
                console.log(`Extracted from RAW image at: ${left},${top} ${width}x${height}`);
                console.log(`Applied blur radius: ${blurRadius}px (${blurSettings.strength}px setting)`);
                console.log(`Applied white overlay with ${enhancedOpacity * 100}% opacity (enhanced from ${opacity * 100}%)`);
                console.log(`Preparing for composite at: ${compositeLeft},${compositeTop}`);
                
                // Add to blur regions array for batch composite
                blurRegions.push({
                    input: blendedRegion,
                    left: compositeLeft,
                    top: compositeTop
                });
            }
            
            // Apply all blur regions in a single composite operation
            console.log(`Applying ${blurRegions.length} blur regions in single composite operation`);
            processedImage = processedImage.composite(blurRegions);
        } else {
            // Apply global blur if no specific regions are defined with calibration factor
            const blurCalibrationFactor = 1.25; // Same calibration as selective blur (2.5 / 2 for new range)
            const rawBlurRadius = blurSettings.strength || 6;
            const blurRadius = Math.max(1, Math.min(100, rawBlurRadius * blurCalibrationFactor));
            console.log(`Applying global blur: admin setting ${rawBlurRadius}px → actual ${blurRadius}px (${blurCalibrationFactor}x factor)`);
            processedImage = processedImage.blur(blurRadius);
        }

        // Apply EXIF rotation to the final output for proper display orientation
        if (rawMetadata.orientation) {
            console.log('Applying EXIF rotation to final output for proper display orientation');
            processedImage = processedImage.rotate(); // This applies EXIF rotation
        } else {
            console.log('No EXIF orientation found, keeping RAW image as-is'); 
        }
        
        // Save the processed image with detailed logging
        console.log('Attempting to save processed image to:', blurredPath);
        try {
            await processedImage.jpeg({ quality: 90 }).toFile(blurredPath);
            console.log('SUCCESS: Blurred image saved successfully to:', blurredPath);
            
            // Verify the file was actually created
            const stats = await fsPromises.stat(blurredPath);
            console.log('File verification - Size:', stats.size, 'bytes');
            
            return `/uploads/${modelSlug}/public/blurred/${blurredFileName}`;
        } catch (saveError) {
            console.error('FAILED to save blurred image:', saveError);
            throw saveError;
        }

    } catch (error) {
        console.error('Error creating blurred version:', error);
        console.error('Error stack:', error.stack);
        return null;
    }
}

/**
 * Generate Sharp.js blur preview without saving
 */
router.post('/preview-blur', async (req, res) => {
    try {
        const { 
            mediaId,
            filePath, 
            blurSettings,
            overlayPositions 
        } = req.body;

        if (!blurSettings) {
            return res.status(400).json({
                success: false,
                error: 'Blur settings are required'
            });
        }

        let absoluteFilePath;
        let modelName = 'Preview';

        if (mediaId) {
            // Handle media queue image
            console.log('🔍 Processing media queue image with ID:', mediaId);
            
            const [items] = await db.execute(
                'SELECT original_path, model_name FROM media_review_queue WHERE id = ?',
                [mediaId]
            );
            
            if (!items.length) {
                return res.status(404).json({
                    success: false,
                    error: 'Media item not found'
                });
            }
            
            const item = items[0];
            absoluteFilePath = item.original_path;
            modelName = item.model_name || 'Preview';
            
            console.log('🔍 Retrieved from media queue:', absoluteFilePath);
            
        } else if (filePath && filePath !== 'unknown') {
            // Handle uploaded image
            console.log('🔍 Processing uploaded image with path:', filePath);
            
            // Convert relative path to absolute filesystem path
            if (!path.isAbsolute(filePath)) {
                if (filePath.startsWith('/uploads')) {
                    absoluteFilePath = path.join(__dirname, '../../public', filePath);
                } else if (filePath.startsWith('uploads')) {
                    absoluteFilePath = path.join(__dirname, '../../public', filePath);
                } else {
                    absoluteFilePath = path.join(__dirname, '../../public/uploads', filePath);
                }
            } else {
                absoluteFilePath = filePath;
            }
            
            // Extract model name from file path
            const pathParts = absoluteFilePath.split('/');
            const modelSlug = pathParts.find(part => part.includes('escort') || part.includes('model')) || 'preview';
            modelName = modelSlug.charAt(0).toUpperCase() + modelSlug.slice(1);
            
        } else {
            return res.status(400).json({
                success: false,
                error: 'Either mediaId or filePath is required'
            });
        }

        console.log('🔍 Final file path for preview:', absoluteFilePath);
        console.log('🔍 Model name:', modelName);
        console.log('🔍 Blur settings:', blurSettings);
        console.log('🔍 Overlay positions:', overlayPositions);
        
        // Create preview blur settings with overlay positions
        const previewBlurSettings = {
            ...blurSettings,
            overlayPositions: overlayPositions
        };
        
        // Check if file exists before calling createBlurredVersion
        try {
            await fsPromises.access(absoluteFilePath);
            console.log('✅ File exists and is accessible:', absoluteFilePath);
        } catch (err) {
            console.error('❌ File not accessible:', absoluteFilePath, 'Error:', err.message);
            return res.status(404).json({
                success: false,
                error: 'File not found or not accessible',
                details: `Cannot access file: ${absoluteFilePath}`
            });
        }
        
        const blurredPath = await createBlurredVersion(absoluteFilePath, modelName, previewBlurSettings);
        
        console.log('🔍 createBlurredVersion returned:', blurredPath);
        console.log('🔍 blurredPath type:', typeof blurredPath);

        if (blurredPath) {
            // Return the preview image path for frontend to display
            const publicDir = path.join(__dirname, '../../public');
            const relativePath = blurredPath.replace(publicDir, '');
            
            console.log('✅ Sharp.js preview generated:', blurredPath);
            console.log('✅ Relative path for frontend:', relativePath);
            
            res.json({
                success: true,
                previewPath: relativePath,
                message: 'Sharp.js blur preview generated successfully'
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to generate blur preview',
                details: 'createBlurredVersion returned null'
            });
        }

    } catch (error) {
        console.error('Error generating blur preview:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error during preview generation',
            details: error.message
        });
    }
});

module.exports = router;