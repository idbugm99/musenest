/**
 * Deployment API Routes
 * Part of Phase D.1: Production deployment and configuration management
 * Provides API endpoints for deployment orchestration and environment management
 */

const express = require('express');
const router = express.Router();
const DeploymentOrchestrationService = require('../../src/services/DeploymentOrchestrationService');

// Initialize service
let deploymentService = null;

// Middleware to initialize deployment service
router.use((req, res, next) => {
    if (!deploymentService) {
        deploymentService = new DeploymentOrchestrationService();
        console.log('🚀 DeploymentOrchestrationService initialized for API routes');
    }
    next();
});

/**
 * POST /api/deployment/execute
 * Execute deployment to target environment
 */
router.post('/execute', async (req, res) => {
    try {
        if (!deploymentService) {
            return res.status(500).json({
                success: false,
                error: 'Deployment service not initialized'
            });
        }

        const { 
            targetEnvironment, 
            configuration = {}, 
            options = {} 
        } = req.body;

        if (!targetEnvironment) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: targetEnvironment'
            });
        }

        // Validate target environment
        const availableEnvironments = deploymentService.getEnvironmentOptions();
        const validEnvironment = availableEnvironments.find(env => env.name === targetEnvironment);
        
        if (!validEnvironment) {
            return res.status(400).json({
                success: false,
                error: `Invalid target environment. Available: ${availableEnvironments.map(e => e.name).join(', ')}`
            });
        }

        console.log(`🚀 Starting deployment to ${targetEnvironment}`);

        // Execute deployment
        const result = await deploymentService.executeDeployment(
            targetEnvironment, 
            configuration, 
            options
        );

        if (result.success) {
            res.json({
                success: true,
                message: 'Deployment completed successfully',
                deploymentId: result.deploymentId,
                environment: result.environment,
                duration: result.duration,
                steps: {
                    total: result.steps || 7,
                    completed: result.completedSteps
                }
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Deployment failed',
                deploymentId: result.deploymentId,
                error: result.error,
                environment: result.environment,
                duration: result.duration,
                steps: {
                    total: result.totalSteps,
                    completed: result.completedSteps
                }
            });
        }

    } catch (error) {
        console.error('❌ Error in deployment execution:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to execute deployment'
        });
    }
});

/**
 * GET /api/deployment/status/:deploymentId
 * Get deployment status by ID
 */
router.get('/status/:deploymentId', (req, res) => {
    try {
        if (!deploymentService) {
            return res.status(500).json({
                success: false,
                error: 'Deployment service not initialized'
            });
        }

        const { deploymentId } = req.params;

        if (!deploymentId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameter: deploymentId'
            });
        }

        const deployment = deploymentService.getDeploymentStatus(deploymentId);

        if (!deployment) {
            return res.status(404).json({
                success: false,
                error: 'Deployment not found'
            });
        }

        // Calculate progress
        const totalSteps = deployment.steps.length;
        const completedSteps = deployment.steps.filter(s => s.status === 'completed').length;
        const failedSteps = deployment.steps.filter(s => s.status === 'failed').length;
        const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

        res.json({
            success: true,
            deployment: {
                id: deployment.id,
                status: deployment.status,
                targetEnvironment: deployment.targetEnvironment,
                startTime: deployment.startTime,
                completedAt: deployment.completedAt,
                failedAt: deployment.failedAt,
                totalDuration: deployment.totalDuration,
                progress: {
                    percentage: progress,
                    completed: completedSteps,
                    failed: failedSteps,
                    total: totalSteps
                },
                currentStep: deployment.status === 'running' ? 
                    deployment.steps.find(s => s.status === 'running')?.step || 'unknown' : null,
                error: deployment.error
            }
        });

    } catch (error) {
        console.error('❌ Error getting deployment status:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get deployment status'
        });
    }
});

/**
 * GET /api/deployment/status/:deploymentId/detailed
 * Get detailed deployment status with step information
 */
router.get('/status/:deploymentId/detailed', (req, res) => {
    try {
        if (!deploymentService) {
            return res.status(500).json({
                success: false,
                error: 'Deployment service not initialized'
            });
        }

        const { deploymentId } = req.params;
        const deployment = deploymentService.getDeploymentStatus(deploymentId);

        if (!deployment) {
            return res.status(404).json({
                success: false,
                error: 'Deployment not found'
            });
        }

        res.json({
            success: true,
            deployment: {
                id: deployment.id,
                status: deployment.status,
                targetEnvironment: deployment.targetEnvironment,
                startTime: deployment.startTime,
                completedAt: deployment.completedAt,
                failedAt: deployment.failedAt,
                totalDuration: deployment.totalDuration,
                error: deployment.error,
                configuration: deployment.configuration,
                options: deployment.options,
                steps: deployment.steps.map(step => ({
                    step: step.step,
                    status: step.status,
                    duration: step.duration,
                    details: step.details,
                    errors: step.errors
                }))
            }
        });

    } catch (error) {
        console.error('❌ Error getting detailed deployment status:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get detailed deployment status'
        });
    }
});

/**
 * GET /api/deployment/history
 * Get deployment history
 */
router.get('/history', (req, res) => {
    try {
        if (!deploymentService) {
            return res.status(500).json({
                success: false,
                error: 'Deployment service not initialized'
            });
        }

        const { limit = 10 } = req.query;
        const history = deploymentService.getDeploymentHistory(parseInt(limit));

        const formattedHistory = history.map(deployment => ({
            id: deployment.id,
            status: deployment.status,
            targetEnvironment: deployment.targetEnvironment,
            startTime: deployment.startTime,
            completedAt: deployment.completedAt,
            failedAt: deployment.failedAt,
            totalDuration: deployment.totalDuration,
            stepsCompleted: deployment.steps.filter(s => s.status === 'completed').length,
            totalSteps: deployment.steps.length,
            error: deployment.error
        }));

        res.json({
            success: true,
            history: formattedHistory,
            total: formattedHistory.length,
            limit: parseInt(limit)
        });

    } catch (error) {
        console.error('❌ Error getting deployment history:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get deployment history'
        });
    }
});

/**
 * GET /api/deployment/environments
 * Get available deployment environments
 */
router.get('/environments', (req, res) => {
    try {
        if (!deploymentService) {
            return res.status(500).json({
                success: false,
                error: 'Deployment service not initialized'
            });
        }

        const environments = deploymentService.getEnvironmentOptions();
        const currentEnv = deploymentService.getCurrentEnvironmentConfig();

        res.json({
            success: true,
            environments,
            currentEnvironment: {
                name: currentEnv.environment,
                displayName: currentEnv.name,
                configuration: {
                    database: currentEnv.database,
                    caching: currentEnv.caching,
                    ssl: currentEnv.ssl,
                    minMemory: currentEnv.minMemory
                }
            }
        });

    } catch (error) {
        console.error('❌ Error getting environments:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get environment information'
        });
    }
});

/**
 * POST /api/deployment/validate
 * Validate deployment configuration without executing
 */
router.post('/validate', async (req, res) => {
    try {
        if (!deploymentService) {
            return res.status(500).json({
                success: false,
                error: 'Deployment service not initialized'
            });
        }

        const { 
            targetEnvironment, 
            configuration = {} 
        } = req.body;

        if (!targetEnvironment) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: targetEnvironment'
            });
        }

        // Validate target environment
        const availableEnvironments = deploymentService.getEnvironmentOptions();
        const validEnvironment = availableEnvironments.find(env => env.name === targetEnvironment);
        
        if (!validEnvironment) {
            return res.status(400).json({
                success: false,
                error: `Invalid target environment. Available: ${availableEnvironments.map(e => e.name).join(', ')}`
            });
        }

        console.log(`🔍 Validating deployment configuration for ${targetEnvironment}`);

        // Run validation (using the pre-deployment validation method)
        const validationResult = await deploymentService.runPreDeploymentValidation(
            targetEnvironment, 
            configuration
        );

        res.json({
            success: validationResult.success,
            environment: targetEnvironment,
            validation: {
                passed: validationResult.success,
                duration: validationResult.duration,
                checks: validationResult.details,
                errors: validationResult.errors || [],
                warnings: validationResult.warnings || []
            },
            message: validationResult.success ? 
                'Deployment configuration is valid' : 
                'Deployment configuration has issues'
        });

    } catch (error) {
        console.error('❌ Error validating deployment:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to validate deployment configuration'
        });
    }
});

/**
 * GET /api/deployment/service-status
 * Get deployment service status and configuration
 */
router.get('/service-status', (req, res) => {
    try {
        if (!deploymentService) {
            return res.status(500).json({
                success: false,
                error: 'Deployment service not initialized'
            });
        }

        const currentEnv = deploymentService.getCurrentEnvironmentConfig();
        const history = deploymentService.getDeploymentHistory(5);
        const recentDeployments = history.length;
        const successfulDeployments = history.filter(d => d.status === 'completed').length;

        res.json({
            success: true,
            serviceStatus: {
                initialized: true,
                currentEnvironment: currentEnv.environment,
                uptime: process.uptime(),
                deploymentHistory: {
                    recent: recentDeployments,
                    successful: successfulDeployments,
                    successRate: recentDeployments > 0 ? 
                        Math.round((successfulDeployments / recentDeployments) * 100) : 0
                },
                supportedEnvironments: deploymentService.getEnvironmentOptions().length,
                systemInfo: {
                    nodeVersion: process.version,
                    platform: process.platform,
                    architecture: process.arch,
                    memoryUsage: {
                        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
                    }
                }
            }
        });

    } catch (error) {
        console.error('❌ Error getting service status:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get service status'
        });
    }
});

module.exports = router;