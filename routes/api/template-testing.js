const express = require('express');
const router = express.Router();
const templateTestingService = require('../../services/templateTestingService');
const { requireAuth, requireRole } = require('../../middleware/auth');

// Run comprehensive template validation
router.post('/validate/:templateId', requireAuth, async (req, res) => {
    try {
        const { templateId } = req.params;
        const options = req.body || {};
        
        const testResults = await templateTestingService.validateTemplate(templateId, options);
        
        res.json({
            success: true,
            data: testResults
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Run specific test suite
router.post('/validate/:templateId/:suite', requireAuth, async (req, res) => {
    try {
        const { templateId, suite } = req.params;
        const options = { suites: [suite], ...req.body };
        
        const testResults = await templateTestingService.validateTemplate(templateId, options);
        
        // Filter results to only include requested suite
        const filteredResults = {
            ...testResults,
            tests: { [suite]: testResults.tests[suite] }
        };
        
        res.json({
            success: true,
            data: filteredResults
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get test results by test ID
router.get('/results/:testId', requireAuth, async (req, res) => {
    try {
        const { testId } = req.params;
        const testResults = templateTestingService.getTestResults(testId);
        
        if (!testResults) {
            return res.status(404).json({
                success: false,
                error: 'Test results not found'
            });
        }
        
        res.json({
            success: true,
            data: testResults
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get all test results (admin only)
router.get('/results', requireAuth, requireRole(['admin']), async (req, res) => {
    try {
        const { limit = 50, offset = 0, templateId } = req.query;
        
        let allResults = templateTestingService.getAllTestResults();
        
        // Filter by template ID if specified
        if (templateId) {
            allResults = allResults.filter(result => result.templateId === templateId);
        }
        
        // Sort by most recent first
        allResults.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
        
        // Apply pagination
        const total = allResults.length;
        const paginatedResults = allResults.slice(offset, offset + parseInt(limit));
        
        res.json({
            success: true,
            data: {
                results: paginatedResults,
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

// Run batch validation for multiple templates
router.post('/batch-validate', requireAuth, requireRole(['admin']), async (req, res) => {
    try {
        const { templateIds, options = {} } = req.body;
        
        if (!Array.isArray(templateIds) || templateIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'templateIds array is required'
            });
        }
        
        const batchResults = [];
        const errors = [];
        
        for (const templateId of templateIds) {
            try {
                const results = await templateTestingService.validateTemplate(templateId, options);
                batchResults.push(results);
            } catch (error) {
                errors.push({
                    templateId,
                    error: error.message
                });
            }
        }
        
        const summary = {
            total: templateIds.length,
            successful: batchResults.length,
            failed: errors.length,
            overallPassed: batchResults.filter(r => r.status === 'passed').length,
            overallFailed: batchResults.filter(r => r.status === 'failed').length
        };
        
        res.json({
            success: true,
            data: {
                results: batchResults,
                errors,
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

// Get template validation status
router.get('/status/:templateId', async (req, res) => {
    try {
        const { templateId } = req.params;
        
        // Get the most recent test results for this template
        const allResults = templateTestingService.getAllTestResults();
        const templateResults = allResults
            .filter(result => result.templateId === templateId)
            .sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
        
        const latestResult = templateResults[0];
        
        const status = {
            templateId,
            hasResults: !!latestResult,
            lastTested: latestResult?.startTime || null,
            status: latestResult?.status || 'not_tested',
            summary: latestResult?.summary || null,
            testCount: templateResults.length
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

// Generate test report
router.get('/report/:templateId', requireAuth, async (req, res) => {
    try {
        const { templateId } = req.params;
        const { format = 'json' } = req.query;
        
        // Get all test results for this template
        const allResults = templateTestingService.getAllTestResults();
        const templateResults = allResults
            .filter(result => result.templateId === templateId)
            .sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
        
        if (templateResults.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No test results found for this template'
            });
        }
        
        const latestResult = templateResults[0];
        
        const report = {
            templateId,
            generatedAt: new Date().toISOString(),
            latestTest: latestResult,
            testHistory: templateResults.slice(1, 6), // Last 5 previous tests
            trends: generateTestTrends(templateResults),
            recommendations: generateRecommendations(latestResult)
        };
        
        if (format === 'html') {
            const htmlReport = generateHTMLReport(report);
            res.setHeader('Content-Type', 'text/html');
            res.send(htmlReport);
        } else {
            res.json({
                success: true,
                data: report
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Compare template test results
router.post('/compare', requireAuth, async (req, res) => {
    try {
        const { templateIds } = req.body;
        
        if (!Array.isArray(templateIds) || templateIds.length < 2) {
            return res.status(400).json({
                success: false,
                error: 'At least 2 template IDs required for comparison'
            });
        }
        
        const comparisonData = {};
        
        for (const templateId of templateIds) {
            const allResults = templateTestingService.getAllTestResults();
            const templateResults = allResults
                .filter(result => result.templateId === templateId)
                .sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
            
            comparisonData[templateId] = templateResults[0] || null;
        }
        
        const comparison = {
            templates: comparisonData,
            summary: generateComparisonSummary(comparisonData),
            recommendations: generateComparisonRecommendations(comparisonData)
        };
        
        res.json({
            success: true,
            data: comparison
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get available test suites
router.get('/suites', async (req, res) => {
    try {
        const suites = {
            structural: {
                name: 'Structural Tests',
                description: 'Validates template file structure and syntax',
                tests: ['filesExist', 'requiredPages', 'fileStructure', 'syntaxValidation', 'dependenciesCheck']
            },
            content: {
                name: 'Content Tests', 
                description: 'Tests content rendering and database compatibility',
                tests: ['databaseFields', 'contentRendering', 'dynamicContent', 'emptyStates', 'contentOverflow']
            },
            styles: {
                name: 'Style Tests',
                description: 'Validates CSS and visual consistency',
                tests: ['cssValidity', 'styleConsistency', 'colorContrast', 'fontLoading', 'browserCompatibility']
            },
            responsive: {
                name: 'Responsive Tests',
                description: 'Tests mobile and tablet compatibility',
                tests: ['mobileResponsive', 'tabletCompatible', 'desktopOptimized', 'touchInteractions', 'viewportHandling']
            },
            accessibility: {
                name: 'Accessibility Tests',
                description: 'WCAG compliance and screen reader compatibility',
                tests: ['wcagCompliance', 'keyboardNavigation', 'screenReader', 'focusManagement', 'ariaAttributes']
            },
            performance: {
                name: 'Performance Tests',
                description: 'Load time and optimization validation',
                tests: ['loadTime', 'assetOptimization', 'renderPerformance', 'memoryUsage', 'bundleSize']
            },
            compatibility: {
                name: 'Compatibility Tests',
                description: 'Template switching and integration compatibility',
                tests: ['switchingCompatibility', 'customizationCompatibility', 'databaseCompatibility', 'apiCompatibility', 'versionCompatibility']
            }
        };
        
        res.json({
            success: true,
            data: suites
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Clear test results (admin only)
router.delete('/results', requireAuth, requireRole(['admin']), async (req, res) => {
    try {
        const { templateId, olderThan } = req.query;
        
        if (templateId) {
            // Clear results for specific template
            const allResults = templateTestingService.getAllTestResults();
            const filteredResults = allResults.filter(result => result.templateId !== templateId);
            
            templateTestingService.clearTestResults();
            filteredResults.forEach(result => {
                templateTestingService.testResults.set(result.testId, result);
            });
            
            res.json({
                success: true,
                data: {
                    cleared: allResults.length - filteredResults.length,
                    templateId
                }
            });
        } else if (olderThan) {
            // Clear results older than specified date
            const cutoffDate = new Date(olderThan);
            const allResults = templateTestingService.getAllTestResults();
            const filteredResults = allResults.filter(result => new Date(result.startTime) >= cutoffDate);
            
            templateTestingService.clearTestResults();
            filteredResults.forEach(result => {
                templateTestingService.testResults.set(result.testId, result);
            });
            
            res.json({
                success: true,
                data: {
                    cleared: allResults.length - filteredResults.length,
                    cutoffDate: cutoffDate.toISOString()
                }
            });
        } else {
            // Clear all results
            const count = templateTestingService.getAllTestResults().length;
            templateTestingService.clearTestResults();
            
            res.json({
                success: true,
                data: {
                    cleared: count
                }
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Helper functions
function generateTestTrends(results) {
    if (results.length < 2) return null;
    
    const trends = {
        passRate: {
            current: results[0].summary.passed / results[0].summary.total,
            previous: results[1].summary.passed / results[1].summary.total,
            trend: null
        },
        testCount: {
            current: results[0].summary.total,
            previous: results[1].summary.total,
            trend: null
        }
    };
    
    trends.passRate.trend = trends.passRate.current > trends.passRate.previous ? 'improving' : 
                           trends.passRate.current < trends.passRate.previous ? 'declining' : 'stable';
    
    trends.testCount.trend = trends.testCount.current > trends.testCount.previous ? 'increased' :
                            trends.testCount.current < trends.testCount.previous ? 'decreased' : 'stable';
    
    return trends;
}

function generateRecommendations(testResult) {
    const recommendations = [];
    
    if (testResult.summary.failed > 0) {
        recommendations.push({
            priority: 'high',
            category: 'failures',
            message: `Address ${testResult.summary.failed} failing tests before deployment`,
            action: 'Review failed tests and implement fixes'
        });
    }
    
    if (testResult.summary.warnings > 0) {
        recommendations.push({
            priority: 'medium',
            category: 'warnings',
            message: `Consider addressing ${testResult.summary.warnings} warnings for better quality`,
            action: 'Review warning tests and consider improvements'
        });
    }
    
    const passRate = testResult.summary.passed / testResult.summary.total;
    if (passRate < 0.8) {
        recommendations.push({
            priority: 'high',
            category: 'quality',
            message: `Test pass rate is below 80% (${Math.round(passRate * 100)}%)`,
            action: 'Improve template quality before deployment'
        });
    }
    
    return recommendations;
}

function generateComparisonSummary(comparisonData) {
    const summary = {};
    
    Object.entries(comparisonData).forEach(([templateId, result]) => {
        if (result) {
            summary[templateId] = {
                status: result.status,
                passRate: result.summary.passed / result.summary.total,
                totalTests: result.summary.total,
                lastTested: result.startTime
            };
        } else {
            summary[templateId] = {
                status: 'not_tested',
                passRate: 0,
                totalTests: 0,
                lastTested: null
            };
        }
    });
    
    return summary;
}

function generateComparisonRecommendations(comparisonData) {
    const recommendations = [];
    const templates = Object.keys(comparisonData);
    
    // Find best performing template
    let bestTemplate = null;
    let bestPassRate = 0;
    
    Object.entries(comparisonData).forEach(([templateId, result]) => {
        if (result && result.summary) {
            const passRate = result.summary.passed / result.summary.total;
            if (passRate > bestPassRate) {
                bestPassRate = passRate;
                bestTemplate = templateId;
            }
        }
    });
    
    if (bestTemplate) {
        recommendations.push({
            priority: 'info',
            category: 'performance',
            message: `${bestTemplate} has the highest test pass rate (${Math.round(bestPassRate * 100)}%)`,
            action: 'Consider using as reference for other templates'
        });
    }
    
    return recommendations;
}

function generateHTMLReport(report) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Template Test Report - ${report.templateId}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { border-bottom: 2px solid #333; padding-bottom: 10px; }
            .summary { background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px; }
            .test-suite { margin: 20px 0; }
            .test-result { margin: 5px 0; padding: 5px; border-left: 4px solid #ccc; }
            .passed { border-left-color: #4CAF50; }
            .failed { border-left-color: #f44336; }
            .warning { border-left-color: #ff9800; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Template Test Report</h1>
            <h2>${report.templateId}</h2>
            <p>Generated: ${report.generatedAt}</p>
        </div>
        <div class="summary">
            <h3>Test Summary</h3>
            <p>Status: ${report.latestTest.status}</p>
            <p>Total Tests: ${report.latestTest.summary.total}</p>
            <p>Passed: ${report.latestTest.summary.passed}</p>
            <p>Failed: ${report.latestTest.summary.failed}</p>
            <p>Warnings: ${report.latestTest.summary.warnings}</p>
        </div>
        <!-- Additional HTML content would be generated here -->
    </body>
    </html>
    `;
}

module.exports = router;