/**
 * Content Moderation API Service
 * Reusable frontend service for all content moderation operations
 * Uses existing backend APIs - no reinventing the wheel!
 */
class ContentModerationAPI {
    
    /**
     * Submit image for moderation analysis
     * Uses: /api/enhanced-content-moderation/upload
     * 
     * @param {File} file - Image file to upload
     * @param {Object} options - Upload options
     * @param {string} options.modelId - Model ID
     * @param {string} options.modelSlug - Model slug
     * @param {string} options.usageIntent - 'public_site', 'paysite', 'store', 'private'
     * @param {string} options.contextType - 'public_gallery', 'profile_pic', etc.
     * @param {string} options.title - Optional title
     * @param {string} options.description - Optional description
     * @returns {Promise<Object>} Moderation result
     */
    static async submitForModeration(file, options = {}) {
        try {
            const {
                modelId,
                modelSlug,
                usageIntent = 'public_site',
                contextType = 'public_gallery',
                title,
                description
            } = options;

            // Validate required params
            if (!file) {
                throw new Error('Image file is required');
            }
            if (!modelId || !modelSlug) {
                throw new Error('modelId and modelSlug are required');
            }

            // Create form data
            const formData = new FormData();
            formData.append('image', file);
            formData.append('model_id', modelId.toString());
            formData.append('model_slug', modelSlug);
            formData.append('usage_intent', usageIntent);
            formData.append('context_type', contextType);
            
            if (title) formData.append('title', title);
            if (description) formData.append('description', description);

            // Call existing API
            const response = await fetch('/api/enhanced-content-moderation/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'Upload failed');
            }

            return {
                success: true,
                contentModerationId: result.data.content_moderation_id,
                status: result.data.status,
                nudityScore: result.data.nudity_score,
                riskScore: result.data.final_risk_score,
                riskLevel: result.data.risk_level,
                humanReviewRequired: result.data.human_review_required,
                data: result.data
            };

        } catch (error) {
            console.error('ContentModerationAPI.submitForModeration error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get moderation status for a model
     * Uses: /api/enhanced-content-moderation/model/:model_id/status
     */
    static async getModerationStatus(modelId) {
        try {
            const response = await fetch(`/api/enhanced-content-moderation/model/${modelId}/status`);
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'Failed to get status');
            }

            return {
                success: true,
                data: result
            };

        } catch (error) {
            console.error('ContentModerationAPI.getModerationStatus error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get admin review queue
     * Uses: /api/enhanced-content-moderation/admin/queue
     */
    static async getAdminQueue(page = 1, limit = 20) {
        try {
            const response = await fetch(`/api/enhanced-content-moderation/admin/queue?page=${page}&limit=${limit}`);
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'Failed to get queue');
            }

            return {
                success: true,
                data: result
            };

        } catch (error) {
            console.error('ContentModerationAPI.getAdminQueue error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Approve content item
     * Uses: /api/enhanced-content-moderation/admin/approve
     */
    static async approveContent(itemId, adminNotes = '') {
        try {
            const response = await fetch(`/api/enhanced-content-moderation/admin/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    item_id: itemId,
                    admin_notes: adminNotes
                })
            });

            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'Failed to approve');
            }

            return {
                success: true,
                data: result
            };

        } catch (error) {
            console.error('ContentModerationAPI.approveContent error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Approve content with blur
     * Uses: /api/enhanced-content-moderation/admin/approve-with-blur
     */
    static async approveWithBlur(itemId, adminNotes = '') {
        try {
            const response = await fetch(`/api/enhanced-content-moderation/admin/approve-with-blur`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    item_id: itemId,
                    admin_notes: adminNotes
                })
            });

            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'Failed to approve with blur');
            }

            return {
                success: true,
                data: result
            };

        } catch (error) {
            console.error('ContentModerationAPI.approveWithBlur error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Reject content item
     * Uses: /api/enhanced-content-moderation/admin/reject
     */
    static async rejectContent(itemId, rejectionReason, adminNotes = '') {
        try {
            const response = await fetch(`/api/enhanced-content-moderation/admin/reject`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    item_id: itemId,
                    rejection_reason: rejectionReason,
                    admin_notes: adminNotes
                })
            });

            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'Failed to reject');
            }

            return {
                success: true,
                data: result
            };

        } catch (error) {
            console.error('ContentModerationAPI.rejectContent error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Batch upload images
     * Uses submitForModeration() for each image
     */
    static async batchUpload(files, options = {}) {
        try {
            const results = [];
            const totalFiles = files.length;
            
            console.log(`Starting batch upload of ${totalFiles} files...`);

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                console.log(`Processing file ${i + 1}/${totalFiles}: ${file.name}`);
                
                const result = await this.submitForModeration(file, {
                    ...options,
                    // Add batch metadata
                    title: options.title || `Batch upload ${i + 1}/${totalFiles}`,
                    description: options.description || `Auto-uploaded file: ${file.name}`
                });

                results.push({
                    fileName: file.name,
                    ...result
                });

                // Small delay to avoid overwhelming the server
                if (i < files.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            const successCount = results.filter(r => r.success).length;
            const failureCount = results.filter(r => !r.success).length;

            return {
                success: true,
                totalFiles,
                successCount,
                failureCount,
                results
            };

        } catch (error) {
            console.error('ContentModerationAPI.batchUpload error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get moderation rules for specific usage intent
     * Uses: /api/enhanced-content-moderation/rules/:usage_intent
     */
    static async getModerationRules(usageIntent) {
        try {
            const response = await fetch(`/api/enhanced-content-moderation/rules/${usageIntent}`);
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'Failed to get rules');
            }

            return {
                success: true,
                data: result
            };

        } catch (error) {
            console.error('ContentModerationAPI.getModerationRules error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Submit appeal for rejected content
     * Uses: /api/enhanced-content-moderation/appeal
     */
    static async submitAppeal(itemId, appealReason, additionalInfo = '') {
        try {
            const response = await fetch('/api/enhanced-content-moderation/appeal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    item_id: itemId,
                    appeal_reason: appealReason,
                    additional_info: additionalInfo
                })
            });

            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'Failed to submit appeal');
            }

            return {
                success: true,
                data: result
            };

        } catch (error) {
            console.error('ContentModerationAPI.submitAppeal error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Export for use in HTML pages or modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ContentModerationAPI;
}