/**
 * Content Moderation Service with Usage Intent & Auto-Moderation Rules
 * Handles the refined workflow for model uploads with flexible approval system
 */

const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');

class ContentModerationService {
    constructor(dbConnection) {
        this.db = dbConnection;
        this.baseUploadPath = path.join(__dirname, '../../public/uploads');
        this.rules = new Map(); // Cache for moderation rules
    }

    /**
     * Load moderation rules from database for specific usage intent
     */
    async loadModerationRules(usageIntent) {
        try {
            const [rules] = await this.db.execute(
                'SELECT * FROM moderation_rules_config WHERE usage_intent = ? AND is_active = TRUE',
                [usageIntent]
            );

            const ruleSet = {};
            rules.forEach(rule => {
                ruleSet[rule.rule_name] = {
                    type: rule.rule_type,
                    value: JSON.parse(rule.rule_value)
                };
            });

            this.rules.set(usageIntent, ruleSet);
            return ruleSet;
        } catch (error) {
            console.error('Error loading moderation rules:', error);
            return this.getDefaultRules(usageIntent);
        }
    }

    /**
     * Get default rules if database rules fail
     */
    getDefaultRules(usageIntent) {
        const defaultRules = {
            public_site: {
                nudity_threshold: { type: 'nudity_threshold', value: { max_confidence: 20, auto_flag: true } },
                blocked_labels: { type: 'blocked_labels', value: ['GENITALIA', 'SEXUAL_ACTIVITY', 'ANUS_EXPOSED'] },
                auto_approve_threshold: { type: 'auto_approve', value: { max_confidence: 10, allowed_labels: ['COVERED', 'CLOTHED'] } }
            },
            paysite: {
                nudity_threshold: { type: 'nudity_threshold', value: { max_confidence: 80, auto_flag: true } },
                blocked_labels: { type: 'blocked_labels', value: ['SEXUAL_ACTIVITY', 'ILLEGAL_CONTENT'] },
                auto_approve_threshold: { type: 'auto_approve', value: { max_confidence: 60, allowed_labels: ['BREAST_EXPOSED', 'BUTTOCKS_EXPOSED'] } }
            },
            store: {
                nudity_threshold: { type: 'nudity_threshold', value: { max_confidence: 90, auto_flag: true } },
                blocked_labels: { type: 'blocked_labels', value: ['ILLEGAL_CONTENT', 'VIOLENCE'] },
                auto_approve_threshold: { type: 'auto_approve', value: { max_confidence: 85, allowed_labels: ['GENITALIA', 'BREAST_EXPOSED', 'BUTTOCKS_EXPOSED'] } }
            },
            private: {
                nudity_threshold: { type: 'nudity_threshold', value: { max_confidence: 95, auto_flag: false } },
                blocked_labels: { type: 'blocked_labels', value: ['ILLEGAL_CONTENT'] },
                auto_approve_threshold: { type: 'auto_approve', value: { max_confidence: 95, allowed_labels: ['*'] } }
            }
        };

        return defaultRules[usageIntent] || defaultRules.public_site;
    }

    /**
     * Create folder structure for a model
     */
    async createModelFolderStructure(modelSlug) {
        const modelPath = path.join(this.baseUploadPath, modelSlug);
        const folders = ['originals', 'thumbs', 'public', 'public/blurred', 'paysite', 'store', 'rejected', 'private'];

        try {
            for (const folder of folders) {
                const folderPath = path.join(modelPath, folder);
                await fs.mkdir(folderPath, { recursive: true });
            }
            console.log(`Folder structure created for model: ${modelSlug}`);
            return true;
        } catch (error) {
            console.error('Error creating folder structure:', error);
            return false;
        }
    }

    /**
     * Process uploaded image through moderation workflow
     */
    async processUploadedImage(imageData) {
        const {
            filePath,
            originalName,
            modelId,
            modelSlug,
            usageIntent = 'public_site',
            contextType = 'public_gallery'
        } = imageData;

        console.log('ContentModerationService processing:', { 
            filePath, 
            originalName, 
            modelId, 
            modelSlug, 
            usageIntent, 
            contextType 
        });

        // Validate required fields
        if (!modelSlug) {
            throw new Error('modelSlug is required for processing');
        }
        if (!modelId) {
            throw new Error('modelId is required for processing');
        }
        if (!filePath) {
            throw new Error('filePath is required for processing');
        }
        if (!originalName) {
            throw new Error('originalName is required for processing');
        }

        try {
            // 1. Ensure folder structure exists
            await this.createModelFolderStructure(modelSlug);

            // 2. Move file to originals folder
            const originalPath = await this.moveToOriginals(filePath, modelSlug, originalName);

            // 3. Get AI analysis
            const aiAnalysis = await this.analyzeWithNudeNet(originalPath, contextType, modelId);

            // 4. Apply auto-moderation rules
            const moderationResult = await this.applyModerationRules(aiAnalysis, usageIntent);

            // 5. Store in database
            const contentModerationId = await this.storeModerationResult({
                ...moderationResult,
                originalPath,
                modelId,
                usageIntent,
                contextType,
                image_path: originalPath // Ensure image_path is set
            });

            // 6. Handle flagged content
            if (moderationResult.flagged) {
                await this.handleFlaggedContent(contentModerationId, {
                    ...moderationResult,
                    modelId
                });
            }

            // 7. Process approved content
            if (moderationResult.moderation_status === 'approved') {
                await this.processApprovedContent(contentModerationId, originalPath, modelSlug, usageIntent);
            }

            return {
                success: true,
                contentModerationId,
                ...moderationResult
            };

        } catch (error) {
            console.error('Error processing uploaded image:', error);
            return {
                success: false,
                error: error.message,
                moderation_status: 'error'
            };
        }
    }

    /**
     * Move uploaded file to originals folder
     */
    async moveToOriginals(tempFilePath, modelSlug, originalName) {
        const timestamp = Date.now();
        const ext = path.extname(originalName);
        const baseName = path.basename(originalName, ext);
        const newFileName = `${timestamp}_${baseName}${ext}`;
        const originalPath = path.join(this.baseUploadPath, modelSlug, 'originals', newFileName);

        await fs.rename(tempFilePath, originalPath);
        return originalPath;
    }

    /**
     * Analyze image with NudeNet
     */
    async analyzeWithNudeNet(imagePath, contextType, modelId) {
        return new Promise((resolve, reject) => {
            const remoteFilePath = `/tmp/upload_${Date.now()}_${path.basename(imagePath)}`;

            // Copy to EC2
            const scpCommand = spawn('scp', [
                '-i', '/Users/programmer/Projects/nudenet-key.pem',
                '-o', 'ConnectTimeout=10',
                '-o', 'StrictHostKeyChecking=no',
                imagePath,
                `ubuntu@18.191.50.72:${remoteFilePath}`
            ]);

            scpCommand.on('close', (scpCode) => {
                if (scpCode !== 0) {
                    return reject(new Error('Failed to copy file to EC2 for analysis'));
                }

                // Analyze via SSH
                const analysisData = JSON.stringify({
                    image_path: remoteFilePath,
                    context_type: contextType,
                    model_id: parseInt(modelId)
                });

                const sshCommand = spawn('ssh', [
                    '-i', '/Users/programmer/Projects/nudenet-key.pem',
                    '-o', 'ConnectTimeout=10',
                    '-o', 'StrictHostKeyChecking=no',
                    'ubuntu@18.191.50.72',
                    `curl -s -X POST "http://localhost:5001/analyze" -H "Content-Type: application/json" -d '${analysisData}'`
                ]);

                let output = '';
                sshCommand.stdout.on('data', (data) => {
                    output += data.toString();
                });

                sshCommand.on('close', (sshCode) => {
                    // Clean up remote file
                    spawn('ssh', [
                        '-i', '/Users/programmer/Projects/nudenet-key.pem',
                        'ubuntu@18.191.50.72',
                        `rm -f ${remoteFilePath}`
                    ]);

                    if (sshCode !== 0) {
                        return reject(new Error('Failed to analyze image on EC2'));
                    }

                    try {
                        const result = JSON.parse(output);
                        resolve(result.success ? result.result : result);
                    } catch (parseError) {
                        reject(new Error('Failed to parse AI analysis response'));
                    }
                });
            });
        });
    }

    /**
     * Apply moderation rules based on usage intent
     */
    async applyModerationRules(aiAnalysis, usageIntent) {
        const rules = this.rules.get(usageIntent) || await this.loadModerationRules(usageIntent);
        
        const result = {
            ...aiAnalysis,
            usage_intent: usageIntent,
            flagged: false,
            auto_blocked: false,
            human_review_required: false,
            final_location: 'originals'
        };

        // Check nudity threshold
        if (rules.nudity_threshold) {
            const threshold = rules.nudity_threshold.value.max_confidence;
            const autoFlag = rules.nudity_threshold.value.auto_flag;
            
            if (result.nudity_score > threshold && autoFlag) {
                result.flagged = true;
                result.auto_blocked = true;
                result.human_review_required = true;
                result.moderation_status = 'flagged';
            }
        }

        // Check blocked labels
        if (rules.blocked_labels && result.detected_parts) {
            const blockedLabels = rules.blocked_labels.value;
            const detectedLabels = Object.keys(result.detected_parts);
            
            const hasBlockedLabel = detectedLabels.some(label => 
                blockedLabels.includes(label.toUpperCase()) || 
                blockedLabels.includes(this.mapDetectionToLabel(label))
            );

            if (hasBlockedLabel) {
                result.flagged = true;
                result.auto_blocked = true;
                result.human_review_required = true;
                result.moderation_status = 'flagged';
            }
        }

        // Auto-approve if within threshold
        if (!result.flagged && rules.auto_approve_threshold) {
            const autoApprove = rules.auto_approve_threshold.value;
            if (result.nudity_score <= autoApprove.max_confidence) {
                result.moderation_status = 'approved';
                result.final_location = this.getFinalLocation(usageIntent);
            }
        }

        // Default to flagged for manual review if not auto-approved
        if (!result.moderation_status) {
            result.flagged = true;
            result.human_review_required = true;
            result.moderation_status = 'flagged';
        }

        return result;
    }

    /**
     * Map AI detection labels to standardized labels
     */
    mapDetectionToLabel(detection) {
        const mapping = {
            'genitalia': 'GENITALIA',
            'breast': 'BREAST_EXPOSED',
            'buttocks': 'BUTTOCKS_EXPOSED',
            'anus': 'ANUS_EXPOSED'
        };
        return mapping[detection.toLowerCase()] || detection.toUpperCase();
    }

    /**
     * Get final location based on usage intent
     */
    getFinalLocation(usageIntent) {
        const locationMap = {
            'public_site': 'public',
            'paysite': 'paysite',
            'store': 'store',
            'private': 'private'
        };
        return locationMap[usageIntent] || 'originals';
    }

    /**
     * Store moderation result in database
     */
    async storeModerationResult(data) {
        const query = `
            INSERT INTO content_moderation (
                image_path, original_path, model_id, context_type, usage_intent,
                nudity_score, detected_parts, part_locations, pose_classification,
                explicit_pose_score, generated_caption, policy_violations,
                moderation_status, human_review_required, flagged, auto_blocked,
                confidence_score, final_location
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            data.image_path || data.originalPath || null,
            data.originalPath || null,
            data.modelId || null,
            data.contextType || null,
            data.usageIntent || null,
            data.nudity_score || 0,
            JSON.stringify(data.detected_parts || {}),
            JSON.stringify(data.part_locations || {}),
            data.pose_classification || null,
            data.explicit_pose_score || 0,
            data.generated_caption || null,
            JSON.stringify(data.policy_violations || []),
            data.moderation_status || null,
            data.human_review_required ? 1 : 0,
            data.flagged ? 1 : 0,
            data.auto_blocked ? 1 : 0,
            data.confidence_score || 0,
            data.final_location || 'originals'
        ];

        const [result] = await this.db.execute(query, values);
        return result.insertId;
    }

    /**
     * Handle flagged content (add to moderation queue)
     */
    async handleFlaggedContent(contentModerationId, moderationResult) {
        const queueQuery = `
            INSERT INTO moderation_queue (
                content_moderation_id, priority, queue_type, model_id
            ) VALUES (?, ?, ?, ?)
        `;

        const priority = this.determinePriority(moderationResult);
        const queueType = moderationResult.auto_blocked ? 'auto_flagged' : 'manual_review';

        await this.db.execute(queueQuery, [
            contentModerationId,
            priority,
            queueType,
            moderationResult.modelId
        ]);

        console.log(`Content flagged and added to moderation queue: ${contentModerationId}`);
    }

    /**
     * Determine priority based on analysis results
     */
    determinePriority(moderationResult) {
        if (moderationResult.nudity_score > 90) return 'urgent';
        if (moderationResult.nudity_score > 70) return 'high';
        if (moderationResult.nudity_score > 40) return 'medium';
        return 'low';
    }

    /**
     * Process approved content (create symlinks/copies)
     */
    async processApprovedContent(contentModerationId, originalPath, modelSlug, usageIntent) {
        const finalLocation = this.getFinalLocation(usageIntent);
        const finalFolder = path.join(this.baseUploadPath, modelSlug, finalLocation);
        const fileName = path.basename(originalPath);
        const finalPath = path.join(finalFolder, fileName);

        try {
            // Create symbolic link (or copy if symlink fails)
            try {
                await fs.symlink(originalPath, finalPath);
            } catch (symlinkError) {
                await fs.copyFile(originalPath, finalPath);
            }

            // Update database with final path
            await this.db.execute(
                'UPDATE content_moderation SET image_path = ? WHERE id = ?',
                [finalPath, contentModerationId]
            );

            console.log(`Approved content processed: ${finalPath}`);
        } catch (error) {
            console.error('Error processing approved content:', error);
        }
    }

    /**
     * Create appeal for flagged content
     */
    async createAppeal(contentModerationId, modelId, appealData) {
        const { reason, message } = appealData;

        const query = `
            INSERT INTO moderation_appeals (
                content_moderation_id, model_id, appeal_reason, appeal_message
            ) VALUES (?, ?, ?, ?)
        `;

        const [result] = await this.db.query(query, [
            contentModerationId,
            modelId,
            reason,
            message
        ]);

        // Update content moderation record
        await this.db.execute(
            'UPDATE content_moderation SET appeal_requested = TRUE WHERE id = ?',
            [contentModerationId]
        );

        // Add to appeal queue
        await this.db.execute(
            `INSERT INTO moderation_queue (
                content_moderation_id, appeal_id, priority, queue_type, model_id
            ) VALUES (?, ?, ?, ?, ?)`,
            [contentModerationId, result.insertId, 'medium', 'appeal', modelId]
        );

        return result.insertId;
    }

    /**
     * Admin approval with blur
     */
    async approveWithBlur(contentModerationId, blurSettings, adminNotes, reviewedBy) {
        // TODO: Generate blurred version using blur settings
        const blurredPath = await this.generateBlurredVersion(contentModerationId, blurSettings);

        await this.db.execute(`
            UPDATE content_moderation 
            SET moderation_status = 'approved',
                blur_settings = ?,
                blurred_path = ?,
                final_location = 'public_blurred',
                admin_notes = ?,
                reviewed_by = ?,
                reviewed_at = NOW()
            WHERE id = ?
        `, [
            JSON.stringify(blurSettings),
            blurredPath,
            adminNotes,
            reviewedBy,
            contentModerationId
        ]);

        // Remove from moderation queue
        await this.db.execute(
            'DELETE FROM moderation_queue WHERE content_moderation_id = ?',
            [contentModerationId]
        );
    }

    /**
     * Generate blurred version (placeholder - integrate with blur tool)
     */
    async generateBlurredVersion(contentModerationId, blurSettings) {
        // This would integrate with the existing blur tool functionality
        // For now, return placeholder path
        const [content] = await this.db.execute(
            'SELECT original_path, model_id FROM content_moderation cm JOIN models m ON cm.model_id = m.id WHERE cm.id = ?',
            [contentModerationId]
        );

        if (content[0]) {
            const originalPath = content[0].original_path;
            const blurredFileName = `blurred_${Date.now()}_${path.basename(originalPath)}`;
            return path.join(path.dirname(originalPath), '..', 'public', 'blurred', blurredFileName);
        }

        return null;
    }
}

module.exports = ContentModerationService;