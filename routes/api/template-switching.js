const express = require('express');
const router = express.Router();
const templateSwitcher = require('../../services/templateSwitcher');
const templateManager = require('../../services/templateManager');
const { requireAuth, requireRole } = require('../../middleware/auth');

// Switch template for current user/model
router.post('/switch', requireAuth, async (req, res) => {
    try {
        const { currentTemplate, newTemplate, options = {} } = req.body;
        const modelId = req.user.modelId || req.body.modelId;
        
        if (!currentTemplate || !newTemplate) {
            return res.status(400).json({
                success: false,
                error: 'Both currentTemplate and newTemplate are required'
            });
        }
        
        if (!modelId) {
            return res.status(400).json({
                success: false,
                error: 'Model ID is required'
            });
        }
        
        if (currentTemplate === newTemplate) {
            return res.status(400).json({
                success: false,
                error: 'Current and new templates must be different'
            });
        }
        
        const switchResult = await templateSwitcher.switchTemplate(
            modelId,
            currentTemplate,
            newTemplate,
            {
                ...options,
                userId: req.user.id,
                userAgent: req.get('User-Agent'),
                ip: req.ip
            }
        );
        
        res.json({
            success: true,
            data: switchResult
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Check template compatibility
router.post('/compatibility-check', requireAuth, async (req, res) => {
    try {
        const { currentTemplate, newTemplate } = req.body;
        
        if (!currentTemplate || !newTemplate) {
            return res.status(400).json({
                success: false,
                error: 'Both currentTemplate and newTemplate are required'
            });
        }
        
        // Use the switcher's compatibility check method
        const compatibility = await templateSwitcher.checkTemplateCompatibility(currentTemplate, newTemplate);
        
        res.json({
            success: true,
            data: compatibility
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get switch status
router.get('/status/:switchId', requireAuth, async (req, res) => {
    try {
        const { switchId } = req.params;
        const switchRecord = templateSwitcher.findSwitchInHistory(switchId);
        
        if (!switchRecord) {
            return res.status(404).json({
                success: false,
                error: 'Switch record not found'
            });
        }
        
        // Check if user has permission to view this switch
        if (switchRecord.modelId !== req.user.modelId && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        
        res.json({
            success: true,
            data: switchRecord
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Rollback template switch
router.post('/rollback/:switchId', requireAuth, async (req, res) => {
    try {
        const { switchId } = req.params;
        const switchRecord = templateSwitcher.findSwitchInHistory(switchId);
        
        if (!switchRecord) {
            return res.status(404).json({
                success: false,
                error: 'Switch record not found'
            });
        }
        
        // Check permissions
        if (switchRecord.modelId !== req.user.modelId && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        
        const rollbackResult = await templateSwitcher.rollbackSwitch(switchId);
        
        res.json({
            success: true,
            data: rollbackResult
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get switch history for current model
router.get('/history', requireAuth, async (req, res) => {
    try {
        const modelId = req.user.modelId;
        const { limit = 10, offset = 0 } = req.query;
        
        let history = templateSwitcher.getSwitchHistory(modelId);
        
        // Apply pagination
        const total = history.length;
        history = history.slice(offset, offset + parseInt(limit));
        
        res.json({
            success: true,
            data: {
                switches: history,
                pagination: {
                    total,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: offset + parseInt(limit) < total
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Admin: Get all switch history
router.get('/admin/history', requireAuth, requireRole(['admin']), async (req, res) => {
    try {
        const { modelId, limit = 50, offset = 0 } = req.query;
        
        let history = templateSwitcher.getSwitchHistory(modelId || null);
        
        // Apply pagination
        const total = history.length;
        history = history.slice(offset, offset + parseInt(limit));
        
        res.json({
            success: true,
            data: {
                switches: history,
                pagination: {
                    total,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: offset + parseInt(limit) < total
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Admin: Batch template switch
router.post('/admin/batch-switch', requireAuth, requireRole(['admin']), async (req, res) => {
    try {
        const { switches } = req.body;
        
        if (!Array.isArray(switches) || switches.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Switches array is required'
            });
        }
        
        // Validate each switch request
        for (const switchRequest of switches) {
            if (!switchRequest.modelId || !switchRequest.currentTemplateId || !switchRequest.newTemplateId) {
                return res.status(400).json({
                    success: false,
                    error: 'Each switch must have modelId, currentTemplateId, and newTemplateId'
                });
            }
        }
        
        const results = await templateSwitcher.batchSwitch(switches);
        
        const summary = {
            total: results.length,
            successful: results.filter(r => r.status === 'completed' || r.status === 'pending').length,
            failed: results.filter(r => r.status === 'failed').length
        };
        
        res.json({
            success: true,
            data: {
                results,
                summary
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Admin: Get switch statistics
router.get('/admin/stats', requireAuth, requireRole(['admin']), async (req, res) => {
    try {
        const stats = templateSwitcher.getSwitchStats();
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Admin: Force switch (bypass compatibility checks)
router.post('/admin/force-switch', requireAuth, requireRole(['admin']), async (req, res) => {
    try {
        const { modelId, currentTemplate, newTemplate, reason } = req.body;
        
        if (!modelId || !currentTemplate || !newTemplate) {
            return res.status(400).json({
                success: false,
                error: 'modelId, currentTemplate, and newTemplate are required'
            });
        }
        
        const switchResult = await templateSwitcher.switchTemplate(
            modelId,
            currentTemplate,
            newTemplate,
            {
                forceSwitch: true,
                reason: reason || 'Admin force switch',
                adminUserId: req.user.id,
                userAgent: req.get('User-Agent'),
                ip: req.ip
            }
        );
        
        res.json({
            success: true,
            data: switchResult
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Preview template switch (dry run)
router.post('/preview-switch', requireAuth, async (req, res) => {
    try {
        const { currentTemplate, newTemplate } = req.body;
        const modelId = req.user.modelId || req.body.modelId;
        
        if (!currentTemplate || !newTemplate || !modelId) {
            return res.status(400).json({
                success: false,
                error: 'currentTemplate, newTemplate, and modelId are required'
            });
        }
        
        // Perform validation without actually switching
        const validation = await templateSwitcher.validateTemplates(currentTemplate, newTemplate);
        
        // Get template information
        const [currentInfo, newInfo] = await Promise.all([
            templateManager.getTemplateInfo(currentTemplate),
            templateManager.getTemplateInfo(newTemplate)
        ]);
        
        const preview = {
            validation,
            comparison: {
                current: currentInfo,
                new: newInfo
            },
            estimatedSwitchTime: '2-5 seconds',
            backupRequired: true,
            potentialIssues: validation.compatibility?.warnings || []
        };
        
        res.json({
            success: true,
            data: preview
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Cancel pending switch
router.delete('/cancel/:switchId', requireAuth, async (req, res) => {
    try {
        const { switchId } = req.params;
        
        // Find the switch in the queue
        const queueIndex = templateSwitcher.switchQueue.findIndex(
            sw => sw.switchId === switchId && sw.modelId === req.user.modelId
        );
        
        if (queueIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Pending switch not found or already processed'
            });
        }
        
        // Remove from queue
        const canceledSwitch = templateSwitcher.switchQueue.splice(queueIndex, 1)[0];
        canceledSwitch.status = 'canceled';
        canceledSwitch.canceledAt = new Date().toISOString();
        
        // Add to history
        templateSwitcher.addToHistory(canceledSwitch);
        
        res.json({
            success: true,
            data: canceledSwitch
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get queue status
router.get('/queue/status', requireAuth, async (req, res) => {
    try {
        const modelId = req.user.modelId;
        
        // Filter queue for current model (if not admin)
        let queue = templateSwitcher.switchQueue;
        if (req.user.role !== 'admin') {
            queue = queue.filter(sw => sw.modelId === modelId);
        }
        
        const status = {
            isProcessing: templateSwitcher.isProcessingSwitch,
            queueLength: queue.length,
            userSwitches: queue.filter(sw => sw.modelId === modelId),
            estimatedWaitTime: `${queue.length * 3} seconds`
        };
        
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;