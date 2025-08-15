/**
 * Theme Migration Service
 * 
 * Manages progressive theme rollouts with safety mechanisms,
 * A/B testing, performance monitoring, and automated rollback.
 */

class ThemeMigrationService {
    constructor(database, performanceMonitor, logger) {
        this.db = database;
        this.performanceMonitor = performanceMonitor;
        this.logger = logger;
        this.rollouts = new Map();
        
        // Migration safety thresholds
        this.safetyThresholds = {
            errorRate: 0.05, // 5% error rate max
            performanceDegradation: 0.15, // 15% performance decrease max
            userSatisfaction: 0.8, // 80% satisfaction minimum
            minUserSample: 100, // Minimum users for statistical significance
            testDuration: 24 * 60 * 60 * 1000, // 24 hours minimum test duration
            maxRolloutDuration: 7 * 24 * 60 * 60 * 1000 // 7 days max rollout
        };
        
        // Rollout phases with user percentages
        this.rolloutPhases = [
            { name: 'canary', percentage: 1, duration: 2 * 60 * 60 * 1000 }, // 1% for 2 hours
            { name: 'pilot', percentage: 5, duration: 6 * 60 * 60 * 1000 }, // 5% for 6 hours  
            { name: 'staged', percentage: 25, duration: 12 * 60 * 60 * 1000 }, // 25% for 12 hours
            { name: 'production', percentage: 100, duration: Infinity } // Full rollout
        ];
    }

    /**
     * Initialize a progressive theme migration
     */
    async startMigration(migrationConfig) {
        const {
            id,
            name,
            description,
            sourceTheme,
            targetTheme,
            targetModels,
            schedule,
            testCriteria,
            rollbackCriteria
        } = migrationConfig;

        try {
            this.logger.info(`Starting theme migration: ${name}`, { migrationId: id });

            // Validate migration configuration
            await this.validateMigrationConfig(migrationConfig);

            // Create migration record
            const migration = {
                id,
                name,
                description,
                sourceTheme,
                targetTheme,
                targetModels: targetModels || [], // Empty means all models
                status: 'preparing',
                currentPhase: null,
                startTime: Date.now(),
                endTime: null,
                testCriteria: {
                    ...this.safetyThresholds,
                    ...testCriteria
                },
                rollbackCriteria: {
                    ...this.safetyThresholds,
                    ...rollbackCriteria
                },
                phases: [],
                metrics: {
                    totalUsers: 0,
                    migratedUsers: 0,
                    errors: 0,
                    performanceMetrics: {},
                    userFeedback: []
                },
                schedule: schedule || 'immediate',
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            // Store in database
            await this.db.query(
                'INSERT INTO theme_migrations (id, config, status, created_at) VALUES (?, ?, ?, ?)',
                [id, JSON.stringify(migration), 'preparing', new Date()]
            );

            // Cache active migration
            this.rollouts.set(id, migration);

            // Schedule migration start if needed
            if (schedule === 'immediate') {
                await this.executeNextPhase(id);
            } else {
                await this.scheduleMigration(id, schedule);
            }

            return { success: true, migrationId: id };

        } catch (error) {
            this.logger.error('Failed to start theme migration', { 
                migrationId: id, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Execute the next phase of a migration
     */
    async executeNextPhase(migrationId) {
        const migration = this.rollouts.get(migrationId);
        if (!migration) {
            throw new Error(`Migration ${migrationId} not found`);
        }

        try {
            const currentPhaseIndex = migration.phases.length;
            
            // Check if migration is complete
            if (currentPhaseIndex >= this.rolloutPhases.length) {
                return await this.completeMigration(migrationId);
            }

            const phase = this.rolloutPhases[currentPhaseIndex];
            
            this.logger.info(`Starting migration phase: ${phase.name}`, { 
                migrationId, 
                percentage: phase.percentage 
            });

            // Update migration status
            migration.status = 'in_progress';
            migration.currentPhase = phase.name;
            migration.updatedAt = Date.now();

            // Calculate target user count for this phase
            const totalEligibleUsers = await this.getEligibleUserCount(migration);
            const targetUserCount = Math.ceil(totalEligibleUsers * (phase.percentage / 100));

            // Create phase record
            const phaseRecord = {
                name: phase.name,
                percentage: phase.percentage,
                targetUserCount,
                actualUserCount: 0,
                startTime: Date.now(),
                endTime: null,
                status: 'active',
                metrics: {
                    errors: 0,
                    performanceMetrics: {},
                    userFeedback: [],
                    rollbackTriggers: []
                }
            };

            migration.phases.push(phaseRecord);

            // Update database
            await this.updateMigrationRecord(migration);

            // Apply theme changes to selected users
            await this.applyThemeToUsers(migration, phase, targetUserCount);

            // Start monitoring this phase
            await this.startPhaseMonitoring(migrationId, currentPhaseIndex);

            // Schedule next phase if this isn't the final phase
            if (phase.duration !== Infinity) {
                setTimeout(async () => {
                    try {
                        await this.evaluatePhaseProgress(migrationId, currentPhaseIndex);
                    } catch (error) {
                        this.logger.error('Phase evaluation failed', { 
                            migrationId, 
                            phase: phase.name, 
                            error: error.message 
                        });
                    }
                }, phase.duration);
            }

            return { success: true, phase: phase.name, targetUsers: targetUserCount };

        } catch (error) {
            this.logger.error('Failed to execute migration phase', { 
                migrationId, 
                error: error.message 
            });
            
            // Consider automatic rollback
            await this.evaluateRollbackCriteria(migrationId);
            throw error;
        }
    }

    /**
     * Apply theme changes to selected users for a phase
     */
    async applyThemeToUsers(migration, phase, targetUserCount) {
        try {
            // Get users eligible for this migration
            let userQuery = `
                SELECT m.id, m.slug, m.theme_set_id, u.user_id, u.last_active
                FROM models m
                LEFT JOIN model_users u ON m.id = u.model_id
                WHERE m.status = 'active'
            `;
            
            const params = [];
            
            // Filter by target models if specified
            if (migration.targetModels.length > 0) {
                userQuery += ' AND m.id IN (' + migration.targetModels.map(() => '?').join(',') + ')';
                params.push(...migration.targetModels);
            }
            
            // Order by activity for gradual rollout
            userQuery += ' ORDER BY u.last_active DESC, RAND()';
            
            const [eligibleUsers] = await this.db.query(userQuery, params);

            // Select users for this phase based on strategy
            const selectedUsers = await this.selectUsersForPhase(
                eligibleUsers, 
                targetUserCount, 
                migration, 
                phase
            );

            this.logger.info(`Selected ${selectedUsers.length} users for phase ${phase.name}`, {
                migrationId: migration.id,
                targetCount: targetUserCount,
                actualCount: selectedUsers.length
            });

            // Apply theme changes
            for (const user of selectedUsers) {
                await this.applyThemeToUser(user, migration);
            }

            // Update phase metrics
            const currentPhase = migration.phases[migration.phases.length - 1];
            currentPhase.actualUserCount = selectedUsers.length;
            currentPhase.selectedUsers = selectedUsers.map(u => ({ 
                modelId: u.id, 
                userId: u.user_id,
                appliedAt: Date.now()
            }));

            return selectedUsers;

        } catch (error) {
            this.logger.error('Failed to apply theme to users', { 
                migrationId: migration.id,
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Select users for a migration phase using various strategies
     */
    async selectUsersForPhase(eligibleUsers, targetCount, migration, phase) {
        const strategy = migration.selectionStrategy || 'random';
        
        switch (strategy) {
            case 'canary':
                // Select most active users first for canary testing
                return eligibleUsers
                    .sort((a, b) => new Date(b.last_active) - new Date(a.last_active))
                    .slice(0, targetCount);
                    
            case 'staged':
                // Mix of active and regular users
                const activeUsers = eligibleUsers
                    .filter(u => new Date(u.last_active) > Date.now() - 7 * 24 * 60 * 60 * 1000)
                    .slice(0, Math.floor(targetCount * 0.3));
                const regularUsers = eligibleUsers
                    .filter(u => new Date(u.last_active) <= Date.now() - 7 * 24 * 60 * 60 * 1000)
                    .slice(0, targetCount - activeUsers.length);
                return [...activeUsers, ...regularUsers];
                
            case 'random':
            default:
                // Random selection with consistent hashing for reproducibility
                return this.consistentUserSelection(eligibleUsers, targetCount, migration.id);
        }
    }

    /**
     * Consistent user selection using hash-based approach
     */
    consistentUserSelection(users, targetCount, migrationId) {
        const selected = [];
        const threshold = targetCount / users.length;
        
        for (const user of users) {
            // Create consistent hash based on user and migration
            const hashInput = `${user.id}-${user.user_id || 'anonymous'}-${migrationId}`;
            const hash = this.simpleHash(hashInput);
            const probability = (hash % 1000) / 1000; // 0-1 probability
            
            if (probability < threshold) {
                selected.push(user);
            }
            
            if (selected.length >= targetCount) {
                break;
            }
        }
        
        return selected;
    }

    /**
     * Apply theme to a specific user/model
     */
    async applyThemeToUser(user, migration) {
        try {
            // Create migration tracking record
            await this.db.query(`
                INSERT INTO user_theme_migrations 
                (migration_id, model_id, user_id, old_theme_id, new_theme_id, applied_at, status)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                migration.id,
                user.id,
                user.user_id || null,
                migration.sourceTheme,
                migration.targetTheme,
                new Date(),
                'active'
            ]);

            // Update model's theme if it's a model-level migration
            if (!user.user_id) {
                await this.db.query(
                    'UPDATE models SET theme_set_id = ? WHERE id = ?',
                    [migration.targetTheme, user.id]
                );
            }

            // Log the application
            this.logger.debug('Applied theme to user', {
                migrationId: migration.id,
                modelId: user.id,
                userId: user.user_id,
                oldTheme: migration.sourceTheme,
                newTheme: migration.targetTheme
            });

        } catch (error) {
            this.logger.error('Failed to apply theme to user', {
                migrationId: migration.id,
                modelId: user.id,
                userId: user.user_id,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Start monitoring a migration phase
     */
    async startPhaseMonitoring(migrationId, phaseIndex) {
        const migration = this.rollouts.get(migrationId);
        const phase = migration.phases[phaseIndex];
        
        // Set up performance monitoring
        const monitoringInterval = setInterval(async () => {
            try {
                await this.collectPhaseMetrics(migrationId, phaseIndex);
                await this.evaluateRollbackCriteria(migrationId);
            } catch (error) {
                this.logger.error('Phase monitoring error', { 
                    migrationId, 
                    phaseIndex, 
                    error: error.message 
                });
            }
        }, 60000); // Check every minute

        // Store interval ID for cleanup
        phase.monitoringInterval = monitoringInterval;
        
        this.logger.info('Started phase monitoring', { migrationId, phase: phase.name });
    }

    /**
     * Collect metrics for a migration phase
     */
    async collectPhaseMetrics(migrationId, phaseIndex) {
        const migration = this.rollouts.get(migrationId);
        const phase = migration.phases[phaseIndex];
        
        try {
            // Get error rates for migrated users
            const [errorMetrics] = await this.db.query(`
                SELECT 
                    COUNT(CASE WHEN l.level = 'error' THEN 1 END) as error_count,
                    COUNT(*) as total_requests,
                    AVG(l.response_time) as avg_response_time
                FROM user_theme_migrations utm
                JOIN request_logs l ON l.model_id = utm.model_id
                WHERE utm.migration_id = ? 
                AND l.timestamp > utm.applied_at
                AND l.timestamp > DATE_SUB(NOW(), INTERVAL 1 HOUR)
            `, [migrationId]);

            // Get performance metrics from monitoring service
            const performanceData = await this.performanceMonitor.getPhaseMetrics(
                migrationId, 
                phaseIndex,
                Date.now() - 60 * 60 * 1000 // Last hour
            );

            // Update phase metrics
            phase.metrics = {
                ...phase.metrics,
                errorRate: errorMetrics.total_requests > 0 ? 
                    errorMetrics.error_count / errorMetrics.total_requests : 0,
                avgResponseTime: errorMetrics.avg_response_time || 0,
                performanceMetrics: performanceData,
                lastUpdated: Date.now()
            };

            // Update database
            await this.updateMigrationRecord(migration);

            this.logger.debug('Updated phase metrics', {
                migrationId,
                phase: phase.name,
                errorRate: phase.metrics.errorRate,
                responseTime: phase.metrics.avgResponseTime
            });

        } catch (error) {
            this.logger.error('Failed to collect phase metrics', {
                migrationId,
                phaseIndex,
                error: error.message
            });
        }
    }

    /**
     * Evaluate if rollback criteria are met
     */
    async evaluateRollbackCriteria(migrationId) {
        const migration = this.rollouts.get(migrationId);
        if (!migration || migration.status === 'completed' || migration.status === 'rolled_back') {
            return;
        }

        const currentPhase = migration.phases[migration.phases.length - 1];
        if (!currentPhase) return;

        const criteria = migration.rollbackCriteria;
        const metrics = currentPhase.metrics;
        const triggers = [];

        // Check error rate
        if (metrics.errorRate > criteria.errorRate) {
            triggers.push({
                type: 'error_rate',
                value: metrics.errorRate,
                threshold: criteria.errorRate,
                severity: 'high'
            });
        }

        // Check performance degradation
        if (metrics.performanceMetrics?.degradation > criteria.performanceDegradation) {
            triggers.push({
                type: 'performance_degradation',
                value: metrics.performanceMetrics.degradation,
                threshold: criteria.performanceDegradation,
                severity: 'medium'
            });
        }

        // Check user satisfaction if available
        if (metrics.userFeedback?.length > 0) {
            const satisfaction = this.calculateUserSatisfaction(metrics.userFeedback);
            if (satisfaction < criteria.userSatisfaction) {
                triggers.push({
                    type: 'user_satisfaction',
                    value: satisfaction,
                    threshold: criteria.userSatisfaction,
                    severity: 'medium'
                });
            }
        }

        // Evaluate trigger severity
        const highSeverityTriggers = triggers.filter(t => t.severity === 'high');
        const mediumSeverityTriggers = triggers.filter(t => t.severity === 'medium');

        let shouldRollback = false;
        let rollbackReason = '';

        if (highSeverityTriggers.length > 0) {
            shouldRollback = true;
            rollbackReason = `High severity issues: ${highSeverityTriggers.map(t => t.type).join(', ')}`;
        } else if (mediumSeverityTriggers.length >= 2) {
            shouldRollback = true;
            rollbackReason = `Multiple medium severity issues: ${mediumSeverityTriggers.map(t => t.type).join(', ')}`;
        }

        if (shouldRollback) {
            this.logger.warn('Rollback criteria met', {
                migrationId,
                triggers,
                reason: rollbackReason
            });
            
            await this.rollbackMigration(migrationId, rollbackReason, triggers);
        }
    }

    /**
     * Rollback a migration
     */
    async rollbackMigration(migrationId, reason, triggers = []) {
        const migration = this.rollouts.get(migrationId);
        if (!migration) {
            throw new Error(`Migration ${migrationId} not found`);
        }

        try {
            this.logger.warn(`Rolling back migration: ${migration.name}`, {
                migrationId,
                reason,
                triggers
            });

            migration.status = 'rolling_back';
            migration.rollbackReason = reason;
            migration.rollbackTriggeredAt = Date.now();
            migration.rollbackTriggers = triggers;

            // Stop all phase monitoring
            for (const phase of migration.phases) {
                if (phase.monitoringInterval) {
                    clearInterval(phase.monitoringInterval);
                }
            }

            // Revert theme changes for all affected users
            const [affectedUsers] = await this.db.query(`
                SELECT * FROM user_theme_migrations 
                WHERE migration_id = ? AND status = 'active'
            `, [migrationId]);

            for (const userMigration of affectedUsers) {
                await this.revertUserTheme(userMigration, migration);
            }

            // Update migration status
            migration.status = 'rolled_back';
            migration.endTime = Date.now();
            migration.updatedAt = Date.now();

            await this.updateMigrationRecord(migration);

            // Send rollback notifications
            await this.sendRollbackNotification(migration, reason, triggers);

            this.logger.info('Migration rollback completed', {
                migrationId,
                affectedUsers: affectedUsers.length,
                duration: Date.now() - migration.startTime
            });

            return { success: true, affectedUsers: affectedUsers.length };

        } catch (error) {
            this.logger.error('Failed to rollback migration', {
                migrationId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Revert theme for a specific user
     */
    async revertUserTheme(userMigration, migration) {
        try {
            // Update user migration record
            await this.db.query(`
                UPDATE user_theme_migrations 
                SET status = 'reverted', reverted_at = ?
                WHERE id = ?
            `, [new Date(), userMigration.id]);

            // Revert model theme if needed
            if (!userMigration.user_id) {
                await this.db.query(
                    'UPDATE models SET theme_set_id = ? WHERE id = ?',
                    [userMigration.old_theme_id, userMigration.model_id]
                );
            }

            this.logger.debug('Reverted user theme', {
                migrationId: migration.id,
                modelId: userMigration.model_id,
                userId: userMigration.user_id
            });

        } catch (error) {
            this.logger.error('Failed to revert user theme', {
                migrationId: migration.id,
                userMigrationId: userMigration.id,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Evaluate phase progress and determine if ready for next phase
     */
    async evaluatePhaseProgress(migrationId, phaseIndex) {
        const migration = this.rollouts.get(migrationId);
        const phase = migration.phases[phaseIndex];
        
        try {
            this.logger.info(`Evaluating phase progress: ${phase.name}`, { migrationId });

            // Collect final metrics for this phase
            await this.collectPhaseMetrics(migrationId, phaseIndex);

            // Check if phase meets success criteria
            const meetsSuccessCriteria = await this.evaluateSuccessCriteria(migration, phase);

            if (meetsSuccessCriteria) {
                // End current phase
                phase.status = 'completed';
                phase.endTime = Date.now();
                
                // Stop monitoring
                if (phase.monitoringInterval) {
                    clearInterval(phase.monitoringInterval);
                }

                this.logger.info(`Phase ${phase.name} completed successfully`, { migrationId });

                // Execute next phase
                await this.executeNextPhase(migrationId);
            } else {
                this.logger.warn(`Phase ${phase.name} did not meet success criteria`, { 
                    migrationId,
                    metrics: phase.metrics
                });
                
                // Consider rollback or extended monitoring
                await this.handlePhaseFailure(migrationId, phaseIndex);
            }

        } catch (error) {
            this.logger.error('Phase progress evaluation failed', {
                migrationId,
                phaseIndex,
                error: error.message
            });
        }
    }

    /**
     * Evaluate if a phase meets success criteria
     */
    async evaluateSuccessCriteria(migration, phase) {
        const criteria = migration.testCriteria;
        const metrics = phase.metrics;

        // Must have minimum user sample
        if (phase.actualUserCount < criteria.minUserSample) {
            return false;
        }

        // Error rate must be below threshold
        if (metrics.errorRate > criteria.errorRate) {
            return false;
        }

        // Performance degradation must be acceptable
        if (metrics.performanceMetrics?.degradation > criteria.performanceDegradation) {
            return false;
        }

        // User satisfaction must meet minimum
        if (metrics.userFeedback?.length > 0) {
            const satisfaction = this.calculateUserSatisfaction(metrics.userFeedback);
            if (satisfaction < criteria.userSatisfaction) {
                return false;
            }
        }

        return true;
    }

    /**
     * Handle phase failure
     */
    async handlePhaseFailure(migrationId, phaseIndex) {
        const migration = this.rollouts.get(migrationId);
        const phase = migration.phases[phaseIndex];

        // Extended monitoring for borderline cases
        const extendedDuration = 2 * 60 * 60 * 1000; // 2 hours
        
        this.logger.info('Extending phase monitoring due to borderline metrics', {
            migrationId,
            phase: phase.name,
            extension: extendedDuration / 1000 / 60 + ' minutes'
        });

        setTimeout(async () => {
            await this.evaluatePhaseProgress(migrationId, phaseIndex);
        }, extendedDuration);
    }

    /**
     * Complete a migration
     */
    async completeMigration(migrationId) {
        const migration = this.rollouts.get(migrationId);
        
        try {
            migration.status = 'completed';
            migration.endTime = Date.now();
            migration.updatedAt = Date.now();

            // Stop all monitoring
            for (const phase of migration.phases) {
                if (phase.monitoringInterval) {
                    clearInterval(phase.monitoringInterval);
                }
            }

            // Calculate final statistics
            const totalUsers = await this.calculateMigrationStats(migration);
            migration.metrics.totalUsers = totalUsers.total;
            migration.metrics.migratedUsers = totalUsers.migrated;

            await this.updateMigrationRecord(migration);

            // Send completion notification
            await this.sendCompletionNotification(migration);

            this.logger.info('Migration completed successfully', {
                migrationId,
                duration: migration.endTime - migration.startTime,
                migratedUsers: migration.metrics.migratedUsers
            });

            // Clean up from active rollouts
            this.rollouts.delete(migrationId);

            return { 
                success: true, 
                duration: migration.endTime - migration.startTime,
                migratedUsers: migration.metrics.migratedUsers 
            };

        } catch (error) {
            this.logger.error('Failed to complete migration', {
                migrationId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Get migration status
     */
    async getMigrationStatus(migrationId) {
        const migration = this.rollouts.get(migrationId) || 
            await this.loadMigrationFromDatabase(migrationId);

        if (!migration) {
            throw new Error(`Migration ${migrationId} not found`);
        }

        return {
            id: migration.id,
            name: migration.name,
            status: migration.status,
            currentPhase: migration.currentPhase,
            progress: this.calculateProgress(migration),
            metrics: migration.metrics,
            phases: migration.phases.map(phase => ({
                name: phase.name,
                percentage: phase.percentage,
                status: phase.status,
                targetUserCount: phase.targetUserCount,
                actualUserCount: phase.actualUserCount,
                duration: phase.endTime ? phase.endTime - phase.startTime : Date.now() - phase.startTime,
                metrics: phase.metrics
            })),
            startTime: migration.startTime,
            estimatedCompletion: this.estimateCompletion(migration)
        };
    }

    /**
     * Utility methods
     */
    
    async validateMigrationConfig(config) {
        if (!config.id || !config.name || !config.sourceTheme || !config.targetTheme) {
            throw new Error('Missing required migration configuration fields');
        }

        // Verify themes exist
        const [themes] = await this.db.query(
            'SELECT id FROM theme_sets WHERE id IN (?, ?)',
            [config.sourceTheme, config.targetTheme]
        );

        if (themes.length !== 2) {
            throw new Error('Source or target theme not found');
        }
    }

    async getEligibleUserCount(migration) {
        let query = 'SELECT COUNT(*) as count FROM models WHERE status = "active"';
        const params = [];

        if (migration.targetModels.length > 0) {
            query += ' AND id IN (' + migration.targetModels.map(() => '?').join(',') + ')';
            params.push(...migration.targetModels);
        }

        const [result] = await this.db.query(query, params);
        return result[0].count;
    }

    async updateMigrationRecord(migration) {
        await this.db.query(
            'UPDATE theme_migrations SET config = ?, status = ?, updated_at = ? WHERE id = ?',
            [JSON.stringify(migration), migration.status, new Date(), migration.id]
        );
    }

    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    calculateUserSatisfaction(feedback) {
        if (feedback.length === 0) return 0;
        const positiveCount = feedback.filter(f => f.rating >= 4).length;
        return positiveCount / feedback.length;
    }

    calculateProgress(migration) {
        if (migration.status === 'completed') return 100;
        if (migration.status === 'rolled_back') return 0;
        
        const completedPhases = migration.phases.filter(p => p.status === 'completed').length;
        return (completedPhases / this.rolloutPhases.length) * 100;
    }

    estimateCompletion(migration) {
        if (migration.status === 'completed') return migration.endTime;
        
        const remainingPhases = this.rolloutPhases.slice(migration.phases.length);
        const remainingTime = remainingPhases.reduce((sum, phase) => sum + phase.duration, 0);
        
        return Date.now() + remainingTime;
    }

    async sendRollbackNotification(migration, reason, triggers) {
        // Implementation would send notifications to admins/stakeholders
        this.logger.warn('Migration rollback notification sent', {
            migrationId: migration.id,
            reason,
            triggers
        });
    }

    async sendCompletionNotification(migration) {
        // Implementation would send success notifications
        this.logger.info('Migration completion notification sent', {
            migrationId: migration.id
        });
    }
}

module.exports = ThemeMigrationService;