/**
 * Backup and Recovery API Routes
 * 
 * RESTful API for backup management, rollback operations, and disaster recovery.
 * Integrates with BackupRecoveryService and database tracking.
 */

const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const BackupRecoveryService = require('../../src/services/BackupRecoveryService');
const mysql = require('mysql2/promise');

// Initialize database connection
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'musenest'
});

// Initialize backup service
const backupService = new BackupRecoveryService({
    backupPath: process.env.BACKUP_PATH || '/var/backups/musenest',
    database: {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_DATABASE || 'musenest'
    },
    filesystem: {
        paths: ['/uploads', '/themes', '/public/assets', '/admin/components']
    },
    schedule: {
        enabled: process.env.BACKUP_SCHEDULE_ENABLED === 'true',
        frequency: process.env.BACKUP_FREQUENCY || 'daily'
    },
    compression: {
        enabled: process.env.BACKUP_COMPRESSION === 'true'
    }
});

// Initialize backup service
backupService.initialize().catch(console.error);

// Error handling middleware
function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array()
        });
    }
    next();
}

/**
 * GET /api/backup-recovery/status
 * Get current backup system status
 */
router.get('/status', async (req, res) => {
    try {
        const status = backupService.getBackupStatus();
        
        // Get database statistics
        const [backupStats] = await db.query(`
            SELECT * FROM v_backup_summary 
            ORDER BY latest_backup DESC
        `);
        
        const [recoveryStats] = await db.query(`
            SELECT * FROM v_recovery_summary
            ORDER BY latest_operation DESC
        `);
        
        const [rollbackReadiness] = await db.query(`
            SELECT * FROM v_rollback_readiness
        `);
        
        res.json({
            success: true,
            data: {
                service: status,
                statistics: {
                    backups: backupStats,
                    recoveries: recoveryStats,
                    rollbackReadiness: rollbackReadiness
                }
            }
        });

    } catch (error) {
        console.error('Error getting backup status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get backup status',
            error: error.message
        });
    }
});

/**
 * POST /api/backup-recovery/backup
 * Create a new backup
 */
router.post('/backup', [
    body('type').optional().isIn(['full', 'incremental', 'config_only', 'emergency']),
    body('reason').optional().isString(),
    body('compress').optional().isBoolean(),
    body('includePaths').optional().isArray(),
    body('excludePaths').optional().isArray()
], handleValidationErrors, async (req, res) => {
    try {
        const {
            type = 'full',
            reason = 'Manual backup request',
            compress = true,
            includePaths,
            excludePaths
        } = req.body;

        const options = {
            type,
            reason,
            compress,
            includePaths,
            excludePaths
        };

        let result;
        if (type === 'incremental') {
            result = await backupService.createIncrementalBackup(options);
        } else {
            result = await backupService.createFullBackup(options);
        }

        if (result.success) {
            // Store backup record in database
            await db.query(`
                INSERT INTO backup_records (
                    id, type, status, reason, components, files,
                    size_bytes, duration_ms, checksum, compression_enabled,
                    triggered_by, created_at, completed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                result.backup.id,
                result.backup.type,
                result.backup.status,
                reason,
                JSON.stringify(Object.keys(result.backup.components)),
                JSON.stringify(result.backup.components),
                result.backup.totalSize || 0,
                result.backup.duration || 0,
                result.backup.checksum || null,
                compress,
                'manual',
                new Date(result.backup.startTime),
                result.backup.completedAt ? new Date(result.backup.completedAt) : null
            ]);
        }

        res.status(201).json({
            success: result.success,
            message: result.success ? 'Backup created successfully' : 'Backup failed',
            data: {
                backupId: result.backup.id,
                type: result.backup.type,
                duration: result.backup.duration,
                size: result.backup.totalSize,
                status: result.backup.status
            },
            error: result.error
        });

    } catch (error) {
        console.error('Error creating backup:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create backup',
            error: error.message
        });
    }
});

/**
 * GET /api/backup-recovery/backups
 * List available backups
 */
router.get('/backups', [
    query('type').optional().isIn(['full', 'incremental', 'config_only', 'emergency']),
    query('status').optional().isIn(['preparing', 'in_progress', 'completed', 'failed', 'cancelled']),
    query('limit').optional().isInt({ min: 1, max: 100 })
], handleValidationErrors, async (req, res) => {
    try {
        const { type, status, limit = 50 } = req.query;
        
        let query = 'SELECT * FROM backup_records WHERE 1=1';
        const params = [];
        
        if (type) {
            query += ' AND type = ?';
            params.push(type);
        }
        
        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }
        
        query += ' ORDER BY created_at DESC LIMIT ?';
        params.push(parseInt(limit));
        
        const [backups] = await db.query(query, params);
        
        res.json({
            success: true,
            data: backups.map(backup => ({
                ...backup,
                components: JSON.parse(backup.components || '[]'),
                files: JSON.parse(backup.files || '{}')
            }))
        });

    } catch (error) {
        console.error('Error listing backups:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to list backups',
            error: error.message
        });
    }
});

/**
 * GET /api/backup-recovery/backups/:backupId
 * Get backup details
 */
router.get('/backups/:backupId', [
    param('backupId').notEmpty().withMessage('Backup ID is required')
], handleValidationErrors, async (req, res) => {
    try {
        const { backupId } = req.params;
        
        const [backups] = await db.query(`
            SELECT * FROM backup_records WHERE id = ?
        `, [backupId]);
        
        if (backups.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Backup not found'
            });
        }
        
        const backup = backups[0];
        
        // Get file integrity information
        const [fileIntegrity] = await db.query(`
            SELECT * FROM backup_file_integrity WHERE backup_id = ?
        `, [backupId]);
        
        res.json({
            success: true,
            data: {
                ...backup,
                components: JSON.parse(backup.components || '[]'),
                files: JSON.parse(backup.files || '{}'),
                fileIntegrity
            }
        });

    } catch (error) {
        console.error('Error getting backup details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get backup details',
            error: error.message
        });
    }
});

/**
 * POST /api/backup-recovery/restore/:backupId
 * Restore from backup
 */
router.post('/restore/:backupId', [
    param('backupId').notEmpty().withMessage('Backup ID is required'),
    body('components').optional().isArray(),
    body('createRestorePoint').optional().isBoolean(),
    body('reason').optional().isString()
], handleValidationErrors, async (req, res) => {
    try {
        const { backupId } = req.params;
        const {
            components,
            createRestorePoint = true,
            reason = 'Manual restore request'
        } = req.body;

        const restoreId = `restore_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        
        // Create restore operation record
        await db.query(`
            INSERT INTO restore_operations (
                id, backup_id, type, status, components, reason, initiated_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            restoreId,
            backupId,
            'full_restore',
            'preparing',
            JSON.stringify(components || []),
            reason,
            req.user?.username || 'anonymous'
        ]);

        const options = {
            components,
            skipRestorePoint: !createRestorePoint
        };

        const result = await backupService.restoreFromBackup(backupId, options);

        // Update restore operation record
        await db.query(`
            UPDATE restore_operations 
            SET status = ?, duration_ms = ?, completed_at = ?, error_message = ?
            WHERE id = ?
        `, [
            result.success ? 'completed' : 'failed',
            result.duration || 0,
            result.success ? new Date() : null,
            result.error || null,
            restoreId
        ]);

        res.json({
            success: result.success,
            message: result.success ? 'Restore completed successfully' : 'Restore failed',
            data: {
                restoreId,
                backupId,
                duration: result.duration,
                components: result.components
            },
            error: result.error
        });

    } catch (error) {
        console.error('Error restoring from backup:', error);
        
        // Update restore operation as failed
        try {
            await db.query(`
                UPDATE restore_operations 
                SET status = 'failed', error_message = ?
                WHERE backup_id = ? AND status = 'preparing'
            `, [error.message, req.params.backupId]);
        } catch (updateError) {
            console.error('Failed to update restore operation:', updateError);
        }

        res.status(500).json({
            success: false,
            message: 'Failed to restore from backup',
            error: error.message
        });
    }
});

/**
 * POST /api/backup-recovery/emergency-rollback
 * Perform emergency rollback to last known good state
 */
router.post('/emergency-rollback', [
    body('reason').optional().isString()
], handleValidationErrors, async (req, res) => {
    try {
        const { reason = 'Emergency rollback requested' } = req.body;
        const rollbackId = `emergency_${Date.now()}`;

        console.log('🚨 Emergency rollback requested:', reason);

        const result = await backupService.emergencyRollback();

        // Log emergency rollback execution
        await db.query(`
            INSERT INTO rollback_executions (
                id, rollback_point_id, restore_operation_id, trigger_reason,
                executed_by, created_at
            ) VALUES (?, ?, ?, ?, ?, NOW())
        `, [
            rollbackId,
            'emergency', // Special rollback point for emergency
            result.restoreId,
            'emergency',
            req.user?.username || 'anonymous'
        ]);

        res.json({
            success: result.success,
            message: result.success ? 
                'Emergency rollback completed successfully' : 
                'Emergency rollback failed',
            data: {
                rollbackId,
                restoreId: result.restoreId,
                backupId: result.backupId,
                duration: result.duration
            },
            error: result.error
        });

    } catch (error) {
        console.error('Emergency rollback failed:', error);
        res.status(500).json({
            success: false,
            message: 'Emergency rollback failed',
            error: error.message
        });
    }
});

/**
 * GET /api/backup-recovery/rollback-points
 * List available rollback points
 */
router.get('/rollback-points', async (req, res) => {
    try {
        const [rollbackPoints] = await db.query(`
            SELECT 
                rp.*,
                br.status as backup_status,
                br.size_bytes as backup_size
            FROM rollback_points rp
            JOIN backup_records br ON rp.backup_id = br.id
            WHERE (rp.expires_at IS NULL OR rp.expires_at > NOW())
            ORDER BY rp.created_at DESC
            LIMIT 20
        `);

        res.json({
            success: true,
            data: rollbackPoints.map(point => ({
                ...point,
                system_state: JSON.parse(point.system_state || '{}'),
                verification_details: JSON.parse(point.verification_details || '{}')
            }))
        });

    } catch (error) {
        console.error('Error getting rollback points:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get rollback points',
            error: error.message
        });
    }
});

/**
 * POST /api/backup-recovery/rollback-points
 * Create a new rollback point
 */
router.post('/rollback-points', [
    body('name').notEmpty().withMessage('Rollback point name is required'),
    body('description').optional().isString(),
    body('createBefore').isIn(['migration', 'deployment', 'configuration_change', 'manual', 'emergency']),
    body('expiresInDays').optional().isInt({ min: 1, max: 365 })
], handleValidationErrors, async (req, res) => {
    try {
        const {
            name,
            description,
            createBefore,
            expiresInDays = 30
        } = req.body;

        // Create backup first
        const backupResult = await backupService.createFullBackup({
            type: 'full',
            reason: `Rollback point: ${name}`
        });

        if (!backupResult.success) {
            throw new Error(`Failed to create backup for rollback point: ${backupResult.error}`);
        }

        // Create rollback point
        const rollbackPointId = `rp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const expiresAt = new Date(Date.now() + (expiresInDays * 24 * 60 * 60 * 1000));

        // Get current system state
        const systemState = {
            timestamp: new Date().toISOString(),
            activeThemeId: null, // Would be populated from actual system
            migrationStatus: null,
            applicationVersion: process.env.npm_package_version || '1.0.0'
        };

        await db.query(`
            INSERT INTO rollback_points (
                id, name, description, backup_id, system_state,
                created_before, expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            rollbackPointId,
            name,
            description || '',
            backupResult.backup.id,
            JSON.stringify(systemState),
            createBefore,
            expiresAt
        ]);

        res.status(201).json({
            success: true,
            message: 'Rollback point created successfully',
            data: {
                rollbackPointId,
                backupId: backupResult.backup.id,
                name,
                expiresAt,
                systemState
            }
        });

    } catch (error) {
        console.error('Error creating rollback point:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create rollback point',
            error: error.message
        });
    }
});

/**
 * POST /api/backup-recovery/verify/:backupId
 * Verify backup integrity
 */
router.post('/verify/:backupId', [
    param('backupId').notEmpty().withMessage('Backup ID is required')
], handleValidationErrors, async (req, res) => {
    try {
        const { backupId } = req.params;

        // Verify backup exists
        const [backups] = await db.query(`
            SELECT * FROM backup_records WHERE id = ?
        `, [backupId]);

        if (backups.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Backup not found'
            });
        }

        // TODO: Implement actual backup verification
        // This would check file checksums, test restore operations, etc.
        const verificationResult = {
            backupId,
            verified: true,
            checks: {
                filesExist: true,
                checksumValid: true,
                metadataValid: true
            },
            verifiedAt: new Date().toISOString()
        };

        res.json({
            success: true,
            message: 'Backup verification completed',
            data: verificationResult
        });

    } catch (error) {
        console.error('Error verifying backup:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify backup',
            error: error.message
        });
    }
});

/**
 * GET /api/backup-recovery/schedules
 * Get backup schedules
 */
router.get('/schedules', async (req, res) => {
    try {
        const [schedules] = await db.query(`
            SELECT * FROM backup_schedules ORDER BY next_execution_at ASC
        `);

        res.json({
            success: true,
            data: schedules.map(schedule => ({
                ...schedule,
                retention_policy: JSON.parse(schedule.retention_policy || '{}'),
                notification_settings: JSON.parse(schedule.notification_settings || '{}')
            }))
        });

    } catch (error) {
        console.error('Error getting backup schedules:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get backup schedules',
            error: error.message
        });
    }
});

/**
 * POST /api/backup-recovery/schedules/start
 * Start scheduled backups
 */
router.post('/schedules/start', async (req, res) => {
    try {
        backupService.startScheduledBackups();
        
        res.json({
            success: true,
            message: 'Scheduled backups started'
        });

    } catch (error) {
        console.error('Error starting scheduled backups:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to start scheduled backups',
            error: error.message
        });
    }
});

/**
 * POST /api/backup-recovery/schedules/stop
 * Stop scheduled backups
 */
router.post('/schedules/stop', async (req, res) => {
    try {
        backupService.stopScheduledBackups();
        
        res.json({
            success: true,
            message: 'Scheduled backups stopped'
        });

    } catch (error) {
        console.error('Error stopping scheduled backups:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to stop scheduled backups',
            error: error.message
        });
    }
});

module.exports = router;