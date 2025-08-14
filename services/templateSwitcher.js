const fs = require('fs').promises;
const path = require('path');
const templateManager = require('./templateManager');

class TemplateSwitcher {
    constructor() {
        this.switchHistory = [];
        this.maxHistorySize = 50;
        this.switchQueue = [];
        this.isProcessingSwitch = false;
    }

    /**
     * Switch template for a specific model
     */
    async switchTemplate(modelId, currentTemplateId, newTemplateId, options = {}) {
        const switchId = this.generateSwitchId();
        const switchContext = {
            switchId,
            modelId,
            currentTemplateId,
            newTemplateId,
            options,
            timestamp: new Date().toISOString(),
            status: 'pending'
        };

        try {
            // Add to queue
            this.switchQueue.push(switchContext);
            
            // Process if not already processing
            if (!this.isProcessingSwitch) {
                await this.processQueue();
            }
            
            return switchContext;
        } catch (error) {
            switchContext.status = 'failed';
            switchContext.error = error.message;
            throw error;
        }
    }

    async processQueue() {
        this.isProcessingSwitch = true;
        
        while (this.switchQueue.length > 0) {
            const switchContext = this.switchQueue.shift();
            
            try {
                await this.executeSingleSwitch(switchContext);
                switchContext.status = 'completed';
                
                // Add to history
                this.addToHistory(switchContext);
                
            } catch (error) {
                switchContext.status = 'failed';
                switchContext.error = error.message;
                console.error('Template switch failed:', error);
            }
        }
        
        this.isProcessingSwitch = false;
    }

    async executeSingleSwitch(switchContext) {
        const { modelId, currentTemplateId, newTemplateId, options } = switchContext;
        
        // Validate templates
        await this.validateTemplates(currentTemplateId, newTemplateId);
        
        // Create backup if enabled
        if (options.createBackup !== false) {
            switchContext.backupPath = await this.createSwitchBackup(modelId, currentTemplateId);
        }
        
        // Perform pre-switch validation
        await this.preValidation(modelId, newTemplateId);
        
        // Update database
        await this.updateModelTemplate(modelId, newTemplateId);
        
        // Clear template caches
        await this.clearTemplateCache(modelId);
        
        // Perform post-switch validation
        await this.postValidation(modelId, newTemplateId);
        
        // Log the switch
        console.log(`Template switch completed: Model ${modelId} from ${currentTemplateId} to ${newTemplateId}`);
        
        return switchContext;
    }

    async validateTemplates(currentTemplateId, newTemplateId) {
        // Validate current template
        const currentValidation = await templateManager.validateTemplate(currentTemplateId);
        if (!currentValidation.valid) {
            throw new Error(`Current template validation failed: ${currentValidation.error}`);
        }
        
        // Validate new template
        const newValidation = await templateManager.validateTemplate(newTemplateId);
        if (!newValidation.valid) {
            throw new Error(`New template validation failed: ${newValidation.error}`);
        }
        
        // Check compatibility
        const compatibility = await this.checkTemplateCompatibility(currentTemplateId, newTemplateId);
        if (!compatibility.compatible && !compatibility.canForce) {
            throw new Error(`Templates are not compatible: ${compatibility.reason}`);
        }
        
        return { currentValidation, newValidation, compatibility };
    }

    async checkTemplateCompatibility(templateA, templateB) {
        try {
            const templateAInfo = await templateManager.getTemplateInfo(templateA);
            const templateBInfo = await templateManager.getTemplateInfo(templateB);
            
            const compatibility = {
                compatible: true,
                canForce: true,
                warnings: [],
                reason: null
            };
            
            // Check version compatibility
            const versionA = this.parseVersion(templateAInfo.version);
            const versionB = this.parseVersion(templateBInfo.version);
            
            if (versionA.major !== versionB.major) {
                compatibility.warnings.push('Major version difference detected');
            }
            
            // Check feature compatibility
            const missingFeatures = templateAInfo.features.filter(
                feature => !templateBInfo.features.includes(feature)
            );
            
            if (missingFeatures.length > 0) {
                compatibility.warnings.push(`Some features may not be available: ${missingFeatures.join(', ')}`);
            }
            
            // Check customization compatibility
            if (templateAInfo.compatibility?.customization !== templateBInfo.compatibility?.customization) {
                compatibility.warnings.push('Customization capabilities differ between templates');
            }
            
            return compatibility;
        } catch (error) {
            return {
                compatible: false,
                canForce: true,
                warnings: [],
                reason: `Compatibility check failed: ${error.message}`
            };
        }
    }

    parseVersion(versionString) {
        const parts = versionString.split('.').map(Number);
        return {
            major: parts[0] || 0,
            minor: parts[1] || 0,
            patch: parts[2] || 0
        };
    }

    async createSwitchBackup(modelId, templateId) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path.join(__dirname, '../backups/template-switches');
        const backupPath = path.join(backupDir, `model-${modelId}-${templateId}-${timestamp}`);
        
        try {
            await fs.mkdir(backupDir, { recursive: true });
            
            // Create backup metadata
            const backupMetadata = {
                modelId,
                templateId,
                timestamp,
                type: 'template-switch-backup',
                created: new Date().toISOString()
            };
            
            // Save backup metadata
            await fs.writeFile(
                path.join(backupPath, 'backup-metadata.json'),
                JSON.stringify(backupMetadata, null, 2)
            );
            
            // In a real implementation, this would backup:
            // - Current template settings from database
            // - Any customizations
            // - Asset files
            // - Configuration files
            
            console.log(`Template switch backup created: ${backupPath}`);
            return backupPath;
        } catch (error) {
            console.error(`Backup creation failed: ${error.message}`);
            // Don't fail the switch if backup fails, just log it
            return null;
        }
    }

    async preValidation(modelId, templateId) {
        // Validate that the model exists
        // In a real implementation, this would check the database
        console.log(`Pre-validation: Model ${modelId} switching to template ${templateId}`);
        
        // Validate template files exist and are accessible
        const validation = await templateManager.validateTemplate(templateId);
        if (!validation.valid) {
            throw new Error(`Pre-validation failed: ${validation.error}`);
        }
        
        // Check for any model-specific requirements
        await this.validateModelRequirements(modelId, templateId);
        
        return true;
    }

    async validateModelRequirements(modelId, templateId) {
        // This would validate model-specific requirements
        // For example:
        // - Does the model have required content for this template?
        // - Are there any restrictions on this model?
        // - Does the model's subscription tier support this template?
        
        console.log(`Validating model requirements for ${modelId} with template ${templateId}`);
        return true;
    }

    async updateModelTemplate(modelId, newTemplateId) {
        // In a real implementation, this would update the database
        // UPDATE models SET template = ? WHERE id = ?
        
        console.log(`Updating model ${modelId} template to ${newTemplateId}`);
        
        // Simulate database update
        return new Promise(resolve => {
            setTimeout(() => {
                console.log(`Database updated: Model ${modelId} template = ${newTemplateId}`);
                resolve(true);
            }, 100);
        });
    }

    async clearTemplateCache(modelId) {
        // Clear any cached template data for this model
        await templateManager.clearCache();
        
        // Clear any model-specific caches
        console.log(`Template cache cleared for model ${modelId}`);
    }

    async postValidation(modelId, newTemplateId) {
        // Validate that the switch was successful
        console.log(`Post-validation: Model ${modelId} template switch to ${newTemplateId}`);
        
        // Check that template renders correctly
        try {
            await templateManager.renderTemplate(newTemplateId, 'home', { 
                model: { id: modelId } 
            });
        } catch (error) {
            throw new Error(`Post-validation failed: Template rendering error - ${error.message}`);
        }
        
        return true;
    }

    async rollbackSwitch(switchId) {
        const switchRecord = this.findSwitchInHistory(switchId);
        if (!switchRecord) {
            throw new Error(`Switch record not found: ${switchId}`);
        }
        
        if (switchRecord.status !== 'completed') {
            throw new Error('Can only rollback completed switches');
        }
        
        // Perform rollback by switching back
        const rollbackContext = await this.switchTemplate(
            switchRecord.modelId,
            switchRecord.newTemplateId,
            switchRecord.currentTemplateId,
            { 
                isRollback: true, 
                originalSwitchId: switchId,
                createBackup: false // Don't create backup for rollbacks
            }
        );
        
        console.log(`Template switch rolled back: ${switchId}`);
        return rollbackContext;
    }

    async batchSwitch(switches) {
        const results = [];
        
        for (const switchRequest of switches) {
            try {
                const result = await this.switchTemplate(
                    switchRequest.modelId,
                    switchRequest.currentTemplateId,
                    switchRequest.newTemplateId,
                    switchRequest.options
                );
                results.push(result);
            } catch (error) {
                results.push({
                    ...switchRequest,
                    status: 'failed',
                    error: error.message
                });
            }
        }
        
        return results;
    }

    generateSwitchId() {
        return `switch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    addToHistory(switchContext) {
        this.switchHistory.unshift(switchContext);
        
        // Limit history size
        if (this.switchHistory.length > this.maxHistorySize) {
            this.switchHistory = this.switchHistory.slice(0, this.maxHistorySize);
        }
    }

    findSwitchInHistory(switchId) {
        return this.switchHistory.find(record => record.switchId === switchId);
    }

    getSwitchHistory(modelId = null) {
        if (modelId) {
            return this.switchHistory.filter(record => record.modelId === modelId);
        }
        return this.switchHistory;
    }

    getSwitchStats() {
        const stats = {
            totalSwitches: this.switchHistory.length,
            successful: this.switchHistory.filter(r => r.status === 'completed').length,
            failed: this.switchHistory.filter(r => r.status === 'failed').length,
            queueLength: this.switchQueue.length,
            isProcessing: this.isProcessingSwitch
        };
        
        // Most popular templates
        const templateCounts = {};
        this.switchHistory
            .filter(r => r.status === 'completed')
            .forEach(r => {
                templateCounts[r.newTemplateId] = (templateCounts[r.newTemplateId] || 0) + 1;
            });
        
        stats.popularTemplates = Object.entries(templateCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([template, count]) => ({ template, count }));
        
        return stats;
    }

    async cleanup() {
        // Clean old backups
        const backupDir = path.join(__dirname, '../backups/template-switches');
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        
        try {
            const backups = await fs.readdir(backupDir, { withFileTypes: true });
            
            for (const backup of backups) {
                if (backup.isDirectory()) {
                    const backupPath = path.join(backupDir, backup.name);
                    const stats = await fs.stat(backupPath);
                    
                    if (stats.mtime.getTime() < thirtyDaysAgo) {
                        await fs.rmdir(backupPath, { recursive: true });
                        console.log(`Cleaned old backup: ${backup.name}`);
                    }
                }
            }
        } catch (error) {
            console.error('Backup cleanup failed:', error);
        }
    }
}

module.exports = new TemplateSwitcher();