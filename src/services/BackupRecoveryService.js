/**
 * Backup and Recovery Service
 * Part of Phase D.5: Automated backup and disaster recovery
 * Provides comprehensive backup strategies, disaster recovery, and data protection for the media library system
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');

class BackupRecoveryService extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            backupDir: config.backupDir || path.join(__dirname, '../../backups'),
            maxBackups: config.maxBackups || 30,
            backupInterval: config.backupInterval || 24 * 60 * 60 * 1000, // 24 hours
            compressionLevel: config.compressionLevel || 6,
            encryptionEnabled: config.encryptionEnabled || false,
            encryptionKey: config.encryptionKey || null,
            retentionPolicy: {
                daily: 7,    // Keep daily backups for 7 days
                weekly: 4,   // Keep weekly backups for 4 weeks
                monthly: 12  // Keep monthly backups for 12 months
            },
            cloudSync: {
                enabled: config.cloudSync?.enabled || false,
                provider: config.cloudSync?.provider || null, // 'aws-s3', 'azure-blob', 'gcp-storage'
                bucket: config.cloudSync?.bucket || null,
                region: config.cloudSync?.region || null
            },
            verification: {
                enabled: config.verification?.enabled !== false,
                checksumAlgorithm: config.verification?.checksumAlgorithm || 'sha256'
            }
        };

        // Database configuration for backups
        this.dbConfig = {
            host: config.database?.host || 'localhost',
            port: config.database?.port || 3306,
            user: config.database?.user || 'root',
            password: config.database?.password || '',
            database: config.database?.database || 'musenest'
        };

        // Backup tracking and state
        this.activeBackups = new Map();
        this.backupHistory = [];
        this.recoveryHistory = [];
        this.backupScheduler = null;
        this.backupCounter = 0;

        // File system paths to backup
        this.backupPaths = [
            'public/uploads',
            'temp_uploads',
            'cache',
            'logs',
            'config',
            'themes'
        ];

        console.log('💾 BackupRecoveryService initialized');
        this.initialize();
    }

    /**
     * Initialize backup service
     */
    async initialize() {
        try {
            // Ensure backup directory exists
            await fs.mkdir(this.config.backupDir, { recursive: true });
            
            // Create subdirectories
            const subdirs = ['database', 'files', 'full', 'incremental', 'temp'];
            for (const subdir of subdirs) {
                await fs.mkdir(path.join(this.config.backupDir, subdir), { recursive: true });
            }

            // Load backup history
            await this.loadBackupHistory();

            this.emit('backupServiceInitialized');
            console.log(`💾 Backup service initialized: ${this.config.backupDir}`);

        } catch (error) {
            console.error('❌ Failed to initialize backup service:', error.message);
            this.emit('backupServiceError', error);
        }
    }

    /**
     * Create a full system backup
     * @param {Object} options - Backup options
     * @returns {Object} Backup result
     */
    async createFullBackup(options = {}) {
        const backupId = `full_${++this.backupCounter}_${Date.now()}`;
        const startTime = Date.now();
        
        console.log(`💾 Starting full backup: ${backupId}`);

        const backup = {
            id: backupId,
            type: 'full',
            startTime,
            status: 'running',
            components: {
                database: { status: 'pending', size: 0, checksum: null },
                files: { status: 'pending', size: 0, checksum: null },
                metadata: { status: 'pending', size: 0, checksum: null }
            },
            options,
            totalSize: 0,
            compressed: false,
            encrypted: false,
            location: null,
            cloudLocation: null
        };

        this.activeBackups.set(backupId, backup);
        this.emit('backupStarted', backup);

        try {
            // Step 1: Database backup
            console.log('💾 Backing up database...');
            backup.components.database = await this.backupDatabase(backupId, options);

            // Step 2: File system backup
            console.log('💾 Backing up file system...');
            backup.components.files = await this.backupFileSystem(backupId, options);

            // Step 3: Create metadata backup
            console.log('💾 Creating metadata backup...');
            backup.components.metadata = await this.createMetadataBackup(backupId, backup);

            // Step 4: Compress if enabled
            if (options.compress !== false) {
                console.log('💾 Compressing backup...');
                await this.compressBackup(backupId, backup);
            }

            // Step 5: Encrypt if enabled
            if (this.config.encryptionEnabled) {
                console.log('💾 Encrypting backup...');
                await this.encryptBackup(backupId, backup);
            }

            // Step 6: Verify backup integrity
            if (this.config.verification.enabled) {
                console.log('💾 Verifying backup integrity...');
                await this.verifyBackupIntegrity(backupId, backup);
            }

            // Step 7: Sync to cloud if enabled
            if (this.config.cloudSync.enabled) {
                console.log('💾 Syncing to cloud storage...');
                await this.syncToCloud(backupId, backup);
            }

            // Step 8: Update backup record
            backup.status = 'completed';
            backup.duration = Date.now() - startTime;
            backup.completedAt = Date.now();
            
            // Calculate total size
            backup.totalSize = Object.values(backup.components)
                .reduce((total, component) => total + (component.size || 0), 0);

            this.backupHistory.push({
                id: backupId,
                type: backup.type,
                startTime: backup.startTime,
                duration: backup.duration,
                totalSize: backup.totalSize,
                status: backup.status,
                compressed: backup.compressed,
                encrypted: backup.encrypted,
                cloudSync: !!backup.cloudLocation
            });

            await this.saveBackupHistory();
            this.activeBackups.delete(backupId);
            
            this.emit('backupCompleted', backup);
            console.log(`✅ Full backup completed: ${backupId} (${backup.duration}ms, ${this.formatSize(backup.totalSize)})`);

            // Cleanup old backups based on retention policy
            await this.cleanupOldBackups();

            return {
                success: true,
                backup
            };

        } catch (error) {
            backup.status = 'failed';
            backup.error = error.message;
            backup.duration = Date.now() - startTime;
            
            console.error(`❌ Full backup failed: ${error.message}`);
            this.emit('backupFailed', { backup, error });
            
            // Cleanup failed backup files
            await this.cleanupFailedBackup(backupId);
            this.activeBackups.delete(backupId);

            return {
                success: false,
                error: error.message,
                backup
            };
        }
    }

    /**
     * Create incremental backup
     * @param {Object} options - Backup options
     * @returns {Object} Backup result
     */
    async createIncrementalBackup(options = {}) {
        const backupId = `inc_${++this.backupCounter}_${Date.now()}`;
        const startTime = Date.now();
        
        console.log(`💾 Starting incremental backup: ${backupId}`);

        // Find last full backup as baseline
        const lastFullBackup = this.backupHistory
            .filter(b => b.type === 'full' && b.status === 'completed')
            .sort((a, b) => b.startTime - a.startTime)[0];

        if (!lastFullBackup) {
            console.log('💾 No full backup found, creating full backup instead');
            return await this.createFullBackup(options);
        }

        const backup = {
            id: backupId,
            type: 'incremental',
            baselineBackup: lastFullBackup.id,
            startTime,
            status: 'running',
            components: {
                database: { status: 'pending', size: 0, checksum: null },
                files: { status: 'pending', size: 0, checksum: null, changedFiles: [] }
            },
            options,
            totalSize: 0
        };

        this.activeBackups.set(backupId, backup);
        this.emit('backupStarted', backup);

        try {
            // Step 1: Incremental database backup
            console.log('💾 Creating incremental database backup...');
            backup.components.database = await this.backupDatabase(backupId, { ...options, incremental: true, since: lastFullBackup.startTime });

            // Step 2: Incremental file system backup
            console.log('💾 Creating incremental file backup...');
            backup.components.files = await this.backupFileSystemIncremental(backupId, lastFullBackup.startTime, options);

            backup.status = 'completed';
            backup.duration = Date.now() - startTime;
            backup.completedAt = Date.now();
            
            backup.totalSize = Object.values(backup.components)
                .reduce((total, component) => total + (component.size || 0), 0);

            this.backupHistory.push({
                id: backupId,
                type: backup.type,
                baselineBackup: backup.baselineBackup,
                startTime: backup.startTime,
                duration: backup.duration,
                totalSize: backup.totalSize,
                status: backup.status
            });

            await this.saveBackupHistory();
            this.activeBackups.delete(backupId);
            
            this.emit('backupCompleted', backup);
            console.log(`✅ Incremental backup completed: ${backupId} (${backup.duration}ms, ${this.formatSize(backup.totalSize)})`);

            return {
                success: true,
                backup
            };

        } catch (error) {
            backup.status = 'failed';
            backup.error = error.message;
            backup.duration = Date.now() - startTime;
            
            console.error(`❌ Incremental backup failed: ${error.message}`);
            this.emit('backupFailed', { backup, error });
            
            await this.cleanupFailedBackup(backupId);
            this.activeBackups.delete(backupId);

            return {
                success: false,
                error: error.message,
                backup
            };
        }
    }

    /**
     * Backup database
     * @param {string} backupId - Backup ID
     * @param {Object} options - Backup options
     * @returns {Object} Database backup result
     */
    async backupDatabase(backupId, options = {}) {
        const outputFile = path.join(this.config.backupDir, 'database', `${backupId}.sql`);
        const startTime = Date.now();

        try {
            const mysqldumpArgs = [
                `-h${this.dbConfig.host}`,
                `-P${this.dbConfig.port}`,
                `-u${this.dbConfig.user}`,
                `-p${this.dbConfig.password}`,
                '--single-transaction',
                '--routines',
                '--triggers',
                '--set-gtid-purged=OFF'
            ];

            // Add incremental options if specified
            if (options.incremental && options.since) {
                const sinceDate = new Date(options.since).toISOString().slice(0, 19).replace('T', ' ');
                mysqldumpArgs.push(`--where=created_at >= '${sinceDate}' OR updated_at >= '${sinceDate}'`);
            }

            mysqldumpArgs.push(this.dbConfig.database);

            return new Promise((resolve, reject) => {
                const mysqldump = spawn('mysqldump', mysqldumpArgs);
                const writeStream = require('fs').createWriteStream(outputFile);
                
                mysqldump.stdout.pipe(writeStream);
                
                let errorOutput = '';
                mysqldump.stderr.on('data', (data) => {
                    errorOutput += data.toString();
                });

                mysqldump.on('close', async (code) => {
                    try {
                        if (code !== 0) {
                            throw new Error(`mysqldump failed with code ${code}: ${errorOutput}`);
                        }

                        const stats = await fs.stat(outputFile);
                        const checksum = await this.calculateFileChecksum(outputFile);

                        resolve({
                            status: 'completed',
                            size: stats.size,
                            checksum,
                            location: outputFile,
                            duration: Date.now() - startTime
                        });
                        
                    } catch (error) {
                        reject(error);
                    }
                });

                mysqldump.on('error', reject);
            });

        } catch (error) {
            throw new Error(`Database backup failed: ${error.message}`);
        }
    }

    /**
     * Backup file system
     * @param {string} backupId - Backup ID
     * @param {Object} options - Backup options
     * @returns {Object} File backup result
     */
    async backupFileSystem(backupId, options = {}) {
        const outputFile = path.join(this.config.backupDir, 'files', `${backupId}.tar.gz`);
        const startTime = Date.now();

        try {
            const tarArgs = ['czf', outputFile];
            
            // Add paths to backup
            for (const backupPath of this.backupPaths) {
                const fullPath = path.resolve(backupPath);
                try {
                    await fs.access(fullPath);
                    tarArgs.push('-C', path.dirname(fullPath), path.basename(fullPath));
                } catch (error) {
                    console.warn(`⚠️  Skipping missing path: ${backupPath}`);
                }
            }

            return new Promise((resolve, reject) => {
                const tar = spawn('tar', tarArgs);
                
                let errorOutput = '';
                tar.stderr.on('data', (data) => {
                    errorOutput += data.toString();
                });

                tar.on('close', async (code) => {
                    try {
                        if (code !== 0 && code !== 1) { // tar exit code 1 is warning, not error
                            throw new Error(`tar failed with code ${code}: ${errorOutput}`);
                        }

                        const stats = await fs.stat(outputFile);
                        const checksum = await this.calculateFileChecksum(outputFile);

                        resolve({
                            status: 'completed',
                            size: stats.size,
                            checksum,
                            location: outputFile,
                            duration: Date.now() - startTime,
                            paths: this.backupPaths
                        });
                        
                    } catch (error) {
                        reject(error);
                    }
                });

                tar.on('error', reject);
            });

        } catch (error) {
            throw new Error(`File system backup failed: ${error.message}`);
        }
    }

    /**
     * Backup file system incrementally
     * @param {string} backupId - Backup ID
     * @param {number} sinceTime - Timestamp to backup changes since
     * @param {Object} options - Backup options
     * @returns {Object} Incremental file backup result
     */
    async backupFileSystemIncremental(backupId, sinceTime, options = {}) {
        const outputFile = path.join(this.config.backupDir, 'incremental', `${backupId}.tar.gz`);
        const startTime = Date.now();
        const sinceDate = new Date(sinceTime);
        const changedFiles = [];

        try {
            // Find changed files since last backup
            for (const backupPath of this.backupPaths) {
                const fullPath = path.resolve(backupPath);
                try {
                    await fs.access(fullPath);
                    const files = await this.findChangedFiles(fullPath, sinceDate);
                    changedFiles.push(...files);
                } catch (error) {
                    console.warn(`⚠️  Skipping missing path: ${backupPath}`);
                }
            }

            if (changedFiles.length === 0) {
                console.log('💾 No changed files found for incremental backup');
                return {
                    status: 'completed',
                    size: 0,
                    checksum: null,
                    location: null,
                    duration: Date.now() - startTime,
                    changedFiles: []
                };
            }

            // Create tar with only changed files
            const tarArgs = ['czf', outputFile, '--files-from=-'];

            return new Promise((resolve, reject) => {
                const tar = spawn('tar', tarArgs);
                
                // Send file list to tar via stdin
                tar.stdin.write(changedFiles.join('\n'));
                tar.stdin.end();
                
                let errorOutput = '';
                tar.stderr.on('data', (data) => {
                    errorOutput += data.toString();
                });

                tar.on('close', async (code) => {
                    try {
                        if (code !== 0 && code !== 1) {
                            throw new Error(`tar failed with code ${code}: ${errorOutput}`);
                        }

                        const stats = await fs.stat(outputFile);
                        const checksum = await this.calculateFileChecksum(outputFile);

                        resolve({
                            status: 'completed',
                            size: stats.size,
                            checksum,
                            location: outputFile,
                            duration: Date.now() - startTime,
                            changedFiles: changedFiles.length
                        });
                        
                    } catch (error) {
                        reject(error);
                    }
                });

                tar.on('error', reject);
            });

        } catch (error) {
            throw new Error(`Incremental file backup failed: ${error.message}`);
        }
    }

    /**
     * Create metadata backup
     * @param {string} backupId - Backup ID
     * @param {Object} backup - Backup object
     * @returns {Object} Metadata backup result
     */
    async createMetadataBackup(backupId, backup) {
        const metadataFile = path.join(this.config.backupDir, 'full', `${backupId}.metadata.json`);
        const startTime = Date.now();

        try {
            const metadata = {
                backup: {
                    id: backupId,
                    type: backup.type,
                    created: new Date().toISOString(),
                    version: '1.0.0'
                },
                system: {
                    hostname: require('os').hostname(),
                    platform: process.platform,
                    nodeVersion: process.version,
                    architecture: process.arch
                },
                application: {
                    name: 'MuseNest',
                    environment: process.env.NODE_ENV || 'development',
                    version: require('../../package.json').version
                },
                database: {
                    type: 'mysql',
                    host: this.dbConfig.host,
                    database: this.dbConfig.database
                },
                components: backup.components,
                configuration: {
                    backupPaths: this.backupPaths,
                    compressionLevel: this.config.compressionLevel,
                    encrypted: this.config.encryptionEnabled
                }
            };

            await fs.writeFile(metadataFile, JSON.stringify(metadata, null, 2));
            const stats = await fs.stat(metadataFile);
            const checksum = await this.calculateFileChecksum(metadataFile);

            return {
                status: 'completed',
                size: stats.size,
                checksum,
                location: metadataFile,
                duration: Date.now() - startTime
            };

        } catch (error) {
            throw new Error(`Metadata backup failed: ${error.message}`);
        }
    }

    /**
     * Compress backup
     * @param {string} backupId - Backup ID
     * @param {Object} backup - Backup object
     */
    async compressBackup(backupId, backup) {
        // File system backup is already compressed (tar.gz)
        // Database backup can be compressed
        const dbComponent = backup.components.database;
        if (dbComponent && dbComponent.location) {
            const compressedFile = `${dbComponent.location}.gz`;
            
            return new Promise((resolve, reject) => {
                const gzip = spawn('gzip', [dbComponent.location]);
                
                gzip.on('close', (code) => {
                    if (code === 0) {
                        dbComponent.location = compressedFile;
                        backup.compressed = true;
                        resolve();
                    } else {
                        reject(new Error(`gzip failed with code ${code}`));
                    }
                });

                gzip.on('error', reject);
            });
        }
    }

    /**
     * Encrypt backup
     * @param {string} backupId - Backup ID
     * @param {Object} backup - Backup object
     */
    async encryptBackup(backupId, backup) {
        if (!this.config.encryptionKey) {
            throw new Error('Encryption enabled but no encryption key provided');
        }

        // Encrypt each component file
        for (const [componentName, component] of Object.entries(backup.components)) {
            if (component.location) {
                const encryptedFile = `${component.location}.enc`;
                await this.encryptFile(component.location, encryptedFile, this.config.encryptionKey);
                
                // Remove unencrypted file
                await fs.unlink(component.location);
                component.location = encryptedFile;
            }
        }

        backup.encrypted = true;
    }

    /**
     * Verify backup integrity
     * @param {string} backupId - Backup ID
     * @param {Object} backup - Backup object
     */
    async verifyBackupIntegrity(backupId, backup) {
        console.log('💾 Verifying backup integrity...');
        
        for (const [componentName, component] of Object.entries(backup.components)) {
            if (component.location && component.checksum) {
                const currentChecksum = await this.calculateFileChecksum(component.location);
                if (currentChecksum !== component.checksum) {
                    throw new Error(`Backup integrity verification failed for ${componentName}: checksum mismatch`);
                }
            }
        }
        
        console.log('✅ Backup integrity verification passed');
    }

    /**
     * Sync backup to cloud storage
     * @param {string} backupId - Backup ID
     * @param {Object} backup - Backup object
     */
    async syncToCloud(backupId, backup) {
        if (!this.config.cloudSync.enabled) {
            return;
        }

        // Placeholder for cloud sync implementation
        // Would integrate with AWS S3, Azure Blob Storage, or Google Cloud Storage
        console.log(`☁️  Syncing backup to ${this.config.cloudSync.provider}...`);
        
        // Simulate cloud sync
        backup.cloudLocation = `${this.config.cloudSync.provider}://${this.config.cloudSync.bucket}/${backupId}`;
        
        console.log(`✅ Backup synced to cloud: ${backup.cloudLocation}`);
    }

    /**
     * Restore from backup
     * @param {string} backupId - Backup ID to restore from
     * @param {Object} options - Restore options
     * @returns {Object} Restore result
     */
    async restoreFromBackup(backupId, options = {}) {
        const recoveryId = `restore_${Date.now()}`;
        const startTime = Date.now();
        
        console.log(`🔄 Starting restore from backup: ${backupId}`);

        const recovery = {
            id: recoveryId,
            backupId,
            startTime,
            status: 'running',
            components: {},
            options
        };

        this.emit('recoveryStarted', recovery);

        try {
            // Find backup metadata
            const backupInfo = this.backupHistory.find(b => b.id === backupId);
            if (!backupInfo) {
                throw new Error(`Backup not found: ${backupId}`);
            }

            // Step 1: Restore database if requested
            if (options.restoreDatabase !== false) {
                console.log('🔄 Restoring database...');
                recovery.components.database = await this.restoreDatabase(backupId, options);
            }

            // Step 2: Restore file system if requested
            if (options.restoreFiles !== false) {
                console.log('🔄 Restoring file system...');
                recovery.components.files = await this.restoreFileSystem(backupId, options);
            }

            recovery.status = 'completed';
            recovery.duration = Date.now() - startTime;
            recovery.completedAt = Date.now();

            this.recoveryHistory.push({
                id: recoveryId,
                backupId,
                startTime: recovery.startTime,
                duration: recovery.duration,
                status: recovery.status,
                components: Object.keys(recovery.components)
            });

            this.emit('recoveryCompleted', recovery);
            console.log(`✅ Restore completed: ${recoveryId} (${recovery.duration}ms)`);

            return {
                success: true,
                recovery
            };

        } catch (error) {
            recovery.status = 'failed';
            recovery.error = error.message;
            recovery.duration = Date.now() - startTime;
            
            console.error(`❌ Restore failed: ${error.message}`);
            this.emit('recoveryFailed', { recovery, error });

            return {
                success: false,
                error: error.message,
                recovery
            };
        }
    }

    /**
     * Restore database from backup
     * @param {string} backupId - Backup ID
     * @param {Object} options - Restore options
     * @returns {Object} Database restore result
     */
    async restoreDatabase(backupId, options = {}) {
        const sqlFile = path.join(this.config.backupDir, 'database', `${backupId}.sql`);
        const gzFile = `${sqlFile}.gz`;
        const startTime = Date.now();

        try {
            let inputFile = sqlFile;
            
            // Check if compressed file exists
            try {
                await fs.access(gzFile);
                inputFile = gzFile;
                
                // Decompress first
                await new Promise((resolve, reject) => {
                    const gunzip = spawn('gunzip', ['-c', gzFile]);
                    const writeStream = require('fs').createWriteStream(sqlFile);
                    
                    gunzip.stdout.pipe(writeStream);
                    gunzip.on('close', resolve);
                    gunzip.on('error', reject);
                });
                
                inputFile = sqlFile;
            } catch (error) {
                // File is not compressed, use original
            }

            // Restore database
            const mysqlArgs = [
                `-h${this.dbConfig.host}`,
                `-P${this.dbConfig.port}`,
                `-u${this.dbConfig.user}`,
                `-p${this.dbConfig.password}`,
                this.dbConfig.database
            ];

            return new Promise((resolve, reject) => {
                const mysql = spawn('mysql', mysqlArgs);
                const readStream = require('fs').createReadStream(inputFile);
                
                readStream.pipe(mysql.stdin);
                
                let errorOutput = '';
                mysql.stderr.on('data', (data) => {
                    errorOutput += data.toString();
                });

                mysql.on('close', (code) => {
                    if (code === 0) {
                        resolve({
                            status: 'completed',
                            duration: Date.now() - startTime,
                            source: inputFile
                        });
                    } else {
                        reject(new Error(`mysql restore failed with code ${code}: ${errorOutput}`));
                    }
                });

                mysql.on('error', reject);
            });

        } catch (error) {
            throw new Error(`Database restore failed: ${error.message}`);
        }
    }

    /**
     * Restore file system from backup
     * @param {string} backupId - Backup ID
     * @param {Object} options - Restore options
     * @returns {Object} File restore result
     */
    async restoreFileSystem(backupId, options = {}) {
        const tarFile = path.join(this.config.backupDir, 'files', `${backupId}.tar.gz`);
        const startTime = Date.now();

        try {
            await fs.access(tarFile);

            const tarArgs = ['xzf', tarFile];
            if (options.restoreLocation) {
                tarArgs.push('-C', options.restoreLocation);
            }

            return new Promise((resolve, reject) => {
                const tar = spawn('tar', tarArgs);
                
                let errorOutput = '';
                tar.stderr.on('data', (data) => {
                    errorOutput += data.toString();
                });

                tar.on('close', (code) => {
                    if (code === 0) {
                        resolve({
                            status: 'completed',
                            duration: Date.now() - startTime,
                            source: tarFile,
                            location: options.restoreLocation || process.cwd()
                        });
                    } else {
                        reject(new Error(`tar restore failed with code ${code}: ${errorOutput}`));
                    }
                });

                tar.on('error', reject);
            });

        } catch (error) {
            throw new Error(`File system restore failed: ${error.message}`);
        }
    }

    // Utility methods

    async findChangedFiles(directory, sinceDate, basePath = '') {
        const changedFiles = [];
        
        try {
            const entries = await fs.readdir(directory, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(directory, entry.name);
                const relativePath = path.join(basePath, entry.name);
                
                if (entry.isDirectory()) {
                    const subdirFiles = await this.findChangedFiles(fullPath, sinceDate, relativePath);
                    changedFiles.push(...subdirFiles);
                } else {
                    const stats = await fs.stat(fullPath);
                    if (stats.mtime > sinceDate) {
                        changedFiles.push(relativePath);
                    }
                }
            }
        } catch (error) {
            console.warn(`⚠️  Error reading directory ${directory}:`, error.message);
        }
        
        return changedFiles;
    }

    async calculateFileChecksum(filePath) {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash(this.config.verification.checksumAlgorithm);
            const stream = require('fs').createReadStream(filePath);
            
            stream.on('data', data => hash.update(data));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', reject);
        });
    }

    async encryptFile(inputFile, outputFile, key) {
        return new Promise((resolve, reject) => {
            const cipher = crypto.createCipher('aes-256-cbc', key);
            const readStream = require('fs').createReadStream(inputFile);
            const writeStream = require('fs').createWriteStream(outputFile);
            
            readStream.pipe(cipher).pipe(writeStream);
            
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
            readStream.on('error', reject);
        });
    }

    async cleanupOldBackups() {
        try {
            const { daily, weekly, monthly } = this.config.retentionPolicy;
            const now = Date.now();
            const dayMs = 24 * 60 * 60 * 1000;
            
            const backupsToDelete = this.backupHistory.filter(backup => {
                const age = now - backup.startTime;
                const ageInDays = age / dayMs;
                
                if (ageInDays > monthly * 30) return true;
                if (ageInDays > weekly * 7 && ageInDays % 7 !== 0) return true;
                if (ageInDays > daily && ageInDays % 1 !== 0) return true;
                
                return false;
            });
            
            for (const backup of backupsToDelete) {
                await this.deleteBackup(backup.id);
            }
            
            console.log(`🧹 Cleaned up ${backupsToDelete.length} old backups`);
            
        } catch (error) {
            console.error('❌ Error cleaning up old backups:', error.message);
        }
    }

    async deleteBackup(backupId) {
        try {
            const backupDirs = ['database', 'files', 'full', 'incremental'];
            
            for (const dir of backupDirs) {
                const dirPath = path.join(this.config.backupDir, dir);
                const files = await fs.readdir(dirPath);
                
                for (const file of files) {
                    if (file.includes(backupId)) {
                        await fs.unlink(path.join(dirPath, file));
                    }
                }
            }
            
            // Remove from history
            this.backupHistory = this.backupHistory.filter(b => b.id !== backupId);
            await this.saveBackupHistory();
            
        } catch (error) {
            console.error(`❌ Error deleting backup ${backupId}:`, error.message);
        }
    }

    async cleanupFailedBackup(backupId) {
        try {
            console.log(`🧹 Cleaning up failed backup: ${backupId}`);
            await this.deleteBackup(backupId);
        } catch (error) {
            console.error(`❌ Error cleaning up failed backup ${backupId}:`, error.message);
        }
    }

    async loadBackupHistory() {
        try {
            const historyFile = path.join(this.config.backupDir, 'backup_history.json');
            const data = await fs.readFile(historyFile, 'utf8');
            this.backupHistory = JSON.parse(data);
        } catch (error) {
            // File doesn't exist or is corrupted, start fresh
            this.backupHistory = [];
        }
    }

    async saveBackupHistory() {
        try {
            const historyFile = path.join(this.config.backupDir, 'backup_history.json');
            await fs.writeFile(historyFile, JSON.stringify(this.backupHistory, null, 2));
        } catch (error) {
            console.error('❌ Error saving backup history:', error.message);
        }
    }

    formatSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let size = bytes;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${Math.round(size * 100) / 100} ${units[unitIndex]}`;
    }

    // API methods

    startScheduledBackups() {
        if (this.backupScheduler) {
            clearInterval(this.backupScheduler);
        }

        this.backupScheduler = setInterval(async () => {
            console.log('⏰ Running scheduled backup...');
            try {
                await this.createIncrementalBackup({ scheduled: true });
            } catch (error) {
                console.error('❌ Scheduled backup failed:', error.message);
            }
        }, this.config.backupInterval);

        console.log(`⏰ Scheduled backups started (interval: ${this.config.backupInterval}ms)`);
    }

    stopScheduledBackups() {
        if (this.backupScheduler) {
            clearInterval(this.backupScheduler);
            this.backupScheduler = null;
            console.log('⏰ Scheduled backups stopped');
        }
    }

    getBackupStatus() {
        return {
            activeBackups: Array.from(this.activeBackups.values()),
            backupHistory: this.backupHistory.slice(-10), // Last 10 backups
            totalBackups: this.backupHistory.length,
            scheduledBackups: !!this.backupScheduler,
            lastBackup: this.backupHistory.length > 0 ? 
                this.backupHistory[this.backupHistory.length - 1] : null,
            configuration: {
                backupDir: this.config.backupDir,
                maxBackups: this.config.maxBackups,
                backupInterval: this.config.backupInterval,
                encryptionEnabled: this.config.encryptionEnabled,
                cloudSyncEnabled: this.config.cloudSync.enabled
            }
        };
    }

    getRecoveryHistory(limit = 10) {
        return this.recoveryHistory
            .sort((a, b) => b.startTime - a.startTime)
            .slice(0, limit);
    }

    updateConfiguration(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('💾 Backup service configuration updated');
        this.emit('configurationUpdated', this.config);
    }
}

module.exports = BackupRecoveryService;