#!/usr/bin/env node

/**
 * Comprehensive Performance Test Runner
 * 
 * Orchestrates all performance tests and generates consolidated reports
 * for the Universal Gallery System performance benchmarking suite.
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const testConfig = require('../setup/test-config');

class PerformanceTestRunner {
    constructor() {
        this.results = {
            startTime: Date.now(),
            endTime: null,
            totalDuration: 0,
            testSuites: [],
            summary: {},
            recommendations: [],
            environment: {
                node: process.version,
                platform: process.platform,
                arch: process.arch,
                memory: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
            }
        };
        
        this.testSuites = [
            {
                name: 'Core Web Vitals Benchmarks',
                file: 'performance-benchmarks.test.js',
                description: 'Tests Core Web Vitals compliance across gallery configurations',
                priority: 'high',
                estimatedTime: 120000 // 2 minutes
            },
            {
                name: 'Load Testing',
                file: 'load-testing.test.js',
                description: 'Concurrent user simulation and stress testing',
                priority: 'high',
                estimatedTime: 180000 // 3 minutes
            },
            {
                name: 'Accessibility Performance',
                file: 'accessibility-performance.test.js',
                description: 'Screen reader, keyboard navigation, and a11y performance',
                priority: 'medium',
                estimatedTime: 90000 // 1.5 minutes
            },
            {
                name: 'Visual Regression Performance',
                file: 'visual-regression-performance.test.js',
                description: 'Screenshot capture and image comparison performance',
                priority: 'medium',
                estimatedTime: 120000 // 2 minutes
            }
        ];
    }

    async run() {
        console.log('🚀 Starting Universal Gallery Performance Test Suite');
        console.log('=' .repeat(60));
        
        const estimatedTotal = this.testSuites.reduce((sum, suite) => sum + suite.estimatedTime, 0);
        console.log(`📊 Running ${this.testSuites.length} test suites (estimated: ${Math.round(estimatedTotal / 1000 / 60)}min)`);
        console.log();

        try {
            // Setup performance test environment
            await this.setupEnvironment();
            
            // Run each test suite
            for (const suite of this.testSuites) {
                await this.runTestSuite(suite);
            }
            
            // Generate consolidated report
            await this.generateConsolidatedReport();
            
            console.log('✅ Performance test suite completed successfully!');
            console.log(`📈 Total duration: ${Math.round(this.results.totalDuration / 1000)}s`);
            console.log(`📊 Report generated: ${path.join(testConfig.paths.reports, 'consolidated-performance-report.html')}`);
            
        } catch (error) {
            console.error('❌ Performance test suite failed:', error.message);
            process.exit(1);
        } finally {
            await this.cleanup();
        }
    }

    async setupEnvironment() {
        console.log('🛠️  Setting up performance test environment...');
        
        // Ensure reports directory exists
        const reportDir = path.join(testConfig.paths.reports);
        await fs.mkdir(reportDir, { recursive: true });
        
        // Clear any existing performance reports
        const performanceDirs = ['performance', 'load-testing', 'accessibility-performance', 'visual-performance'];
        for (const dir of performanceDirs) {
            const dirPath = path.join(reportDir, dir);
            try {
                await fs.rmdir(dirPath, { recursive: true });
            } catch (e) {
                // Directory might not exist, ignore
            }
        }
        
        // Warm up the test server if needed
        try {
            const testSetup = require('../setup/test-setup');
            await testSetup.setupGlobal();
            console.log('✅ Test environment ready');
        } catch (error) {
            console.warn('⚠️  Could not set up test environment:', error.message);
        }
    }

    async runTestSuite(suite) {
        console.log(`\n🧪 Running ${suite.name}...`);
        console.log(`   ${suite.description}`);
        console.log(`   Priority: ${suite.priority} | Est. time: ${Math.round(suite.estimatedTime / 1000)}s`);
        
        const startTime = Date.now();
        const testFile = path.join(__dirname, suite.file);
        
        try {
            const result = await this.executeTest(testFile);
            const duration = Date.now() - startTime;
            
            const suiteResult = {
                name: suite.name,
                file: suite.file,
                status: 'passed',
                duration,
                startTime,
                endTime: Date.now(),
                stdout: result.stdout,
                stderr: result.stderr,
                exitCode: result.code || 0
            };
            
            this.results.testSuites.push(suiteResult);
            
            console.log(`   ✅ Completed in ${Math.round(duration / 1000)}s`);
            
        } catch (error) {
            const duration = Date.now() - startTime;
            
            const suiteResult = {
                name: suite.name,
                file: suite.file,
                status: 'failed',
                duration,
                startTime,
                endTime: Date.now(),
                error: error.message,
                exitCode: error.code || 1
            };
            
            this.results.testSuites.push(suiteResult);
            
            console.log(`   ❌ Failed after ${Math.round(duration / 1000)}s: ${error.message}`);
        }
    }

    executeTest(testFile) {
        return new Promise((resolve, reject) => {
            const jestPath = path.join(__dirname, '../node_modules/.bin/jest');
            const args = [
                testFile,
                '--verbose',
                '--runInBand',
                '--detectOpenHandles',
                '--forceExit',
                '--maxWorkers=1'
            ];
            
            const child = spawn('npx', ['jest', ...args], {
                cwd: path.join(__dirname, '..'),
                stdio: ['pipe', 'pipe', 'pipe']
            });
            
            let stdout = '';
            let stderr = '';
            
            child.stdout.on('data', (data) => {
                stdout += data.toString();
                process.stdout.write(data); // Real-time output
            });
            
            child.stderr.on('data', (data) => {
                stderr += data.toString();
                process.stderr.write(data); // Real-time output
            });
            
            child.on('close', (code) => {
                if (code === 0) {
                    resolve({ stdout, stderr, code });
                } else {
                    const error = new Error(`Test failed with exit code ${code}`);
                    error.code = code;
                    error.stdout = stdout;
                    error.stderr = stderr;
                    reject(error);
                }
            });
            
            child.on('error', (error) => {
                error.stdout = stdout;
                error.stderr = stderr;
                reject(error);
            });
        });
    }

    async generateConsolidatedReport() {
        console.log('\n📊 Generating consolidated performance report...');
        
        this.results.endTime = Date.now();
        this.results.totalDuration = this.results.endTime - this.results.startTime;
        
        // Calculate summary statistics
        const passedSuites = this.results.testSuites.filter(s => s.status === 'passed');
        const failedSuites = this.results.testSuites.filter(s => s.status === 'failed');
        const totalDuration = this.results.testSuites.reduce((sum, s) => sum + s.duration, 0);
        
        this.results.summary = {
            totalSuites: this.results.testSuites.length,
            passedSuites: passedSuites.length,
            failedSuites: failedSuites.length,
            successRate: (passedSuites.length / this.results.testSuites.length) * 100,
            totalTestDuration: totalDuration,
            averageSuiteDuration: totalDuration / this.results.testSuites.length
        };
        
        // Collect individual test reports
        await this.collectIndividualReports();
        
        // Generate recommendations
        this.generateRecommendations();
        
        // Write consolidated report
        const reportDir = path.join(testConfig.paths.reports);
        await fs.mkdir(reportDir, { recursive: true });
        
        // JSON report
        await fs.writeFile(
            path.join(reportDir, 'consolidated-performance-report.json'),
            JSON.stringify(this.results, null, 2)
        );
        
        // HTML report
        const htmlReport = this.generateHTML();
        await fs.writeFile(
            path.join(reportDir, 'consolidated-performance-report.html'),
            htmlReport
        );
        
        console.log('✅ Consolidated report generated');
    }

    async collectIndividualReports() {
        const reportMappings = [
            { dir: 'performance', file: 'performance-report.json', name: 'Core Performance' },
            { dir: 'load-testing', file: 'load-test-report.json', name: 'Load Testing' },
            { dir: 'accessibility-performance', file: 'accessibility-performance-report.json', name: 'Accessibility Performance' },
            { dir: 'visual-performance', file: 'visual-performance-report.json', name: 'Visual Performance' }
        ];
        
        this.results.individualReports = {};
        
        for (const mapping of reportMappings) {
            const reportPath = path.join(testConfig.paths.reports, mapping.dir, mapping.file);
            try {
                const reportData = await fs.readFile(reportPath, 'utf8');
                this.results.individualReports[mapping.name] = JSON.parse(reportData);
            } catch (error) {
                console.warn(`⚠️  Could not load ${mapping.name} report: ${error.message}`);
            }
        }
    }

    generateRecommendations() {
        this.results.recommendations = [];
        
        // Check test suite success rate
        if (this.results.summary.successRate < 100) {
            this.results.recommendations.push({
                type: 'reliability',
                priority: 'high',
                title: 'Fix Failed Performance Tests',
                description: `${this.results.summary.failedSuites} test suite(s) failed. Review error logs and fix underlying performance issues.`
            });
        }
        
        // Check test duration
        if (this.results.summary.averageSuiteDuration > 150000) { // 2.5 minutes
            this.results.recommendations.push({
                type: 'efficiency',
                priority: 'medium',
                title: 'Optimize Test Suite Duration',
                description: 'Performance tests are taking longer than expected. Consider optimizing test scenarios or running tests in parallel.'
            });
        }
        
        // Collect recommendations from individual reports
        for (const [reportName, reportData] of Object.entries(this.results.individualReports || {})) {
            if (reportData.recommendations) {
                for (const rec of reportData.recommendations) {
                    this.results.recommendations.push({
                        ...rec,
                        source: reportName
                    });
                }
            }
        }
    }

    generateHTML() {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Universal Gallery - Consolidated Performance Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { border-bottom: 2px solid #28a745; padding-bottom: 20px; margin-bottom: 30px; text-align: center; }
        .header h1 { color: #28a745; margin: 0; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .summary-card { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; }
        .summary-card.warning { background: linear-gradient(135deg, #ffc107 0%, #fd7e14 100%); }
        .summary-card.danger { background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); }
        .summary-card h3 { margin: 0 0 10px 0; font-size: 2em; }
        .summary-card p { margin: 0; opacity: 0.9; }
        .test-suite { background: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px; }
        .test-suite.passed { border-left: 4px solid #28a745; }
        .test-suite.failed { border-left: 4px solid #dc3545; }
        .suite-header { display: flex; justify-content: space-between; align-items: center; }
        .suite-status { padding: 4px 12px; border-radius: 4px; color: white; font-weight: bold; }
        .suite-status.passed { background: #28a745; }
        .suite-status.failed { background: #dc3545; }
        .recommendations { background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .recommendation { padding: 15px; margin: 10px 0; border-radius: 4px; }
        .recommendation.high { background: #ffebee; border-left: 4px solid #f44336; }
        .recommendation.medium { background: #fff3e0; border-left: 4px solid #ff9800; }
        .recommendation.low { background: #e8f5e8; border-left: 4px solid #4caf50; }
        .environment { background: #f1f3f4; padding: 15px; border-radius: 4px; margin: 20px 0; }
        .timestamp { color: #666; font-size: 0.9em; }
        pre { background: #f8f9fa; padding: 15px; border-radius: 4px; overflow-x: auto; white-space: pre-wrap; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Universal Gallery Performance Report</h1>
            <p class="timestamp">Generated: ${new Date(this.results.endTime).toISOString()}</p>
            <p>Total Duration: ${Math.round(this.results.totalDuration / 1000)}s | Environment: ${this.results.environment.platform} ${this.results.environment.arch}</p>
        </div>
        
        <div class="summary">
            <div class="summary-card">
                <h3>${this.results.summary.totalSuites}</h3>
                <p>Test Suites</p>
            </div>
            <div class="summary-card${this.results.summary.failedSuites > 0 ? ' danger' : ''}">
                <h3>${this.results.summary.passedSuites}/${this.results.summary.totalSuites}</h3>
                <p>Passed</p>
            </div>
            <div class="summary-card${this.results.summary.successRate < 100 ? ' warning' : ''}">
                <h3>${Math.round(this.results.summary.successRate)}%</h3>
                <p>Success Rate</p>
            </div>
            <div class="summary-card">
                <h3>${Math.round(this.results.summary.averageSuiteDuration / 1000)}s</h3>
                <p>Avg Duration</p>
            </div>
        </div>
        
        <h2>📋 Test Suite Results</h2>
        ${this.results.testSuites.map(suite => `
            <div class="test-suite ${suite.status}">
                <div class="suite-header">
                    <h3>${suite.name}</h3>
                    <span class="suite-status ${suite.status}">${suite.status.toUpperCase()}</span>
                </div>
                <p><strong>File:</strong> ${suite.file}</p>
                <p><strong>Duration:</strong> ${Math.round(suite.duration / 1000)}s</p>
                <p><strong>Timestamp:</strong> ${new Date(suite.startTime).toISOString()}</p>
                ${suite.error ? `<p><strong>Error:</strong> ${suite.error}</p>` : ''}
            </div>
        `).join('')}
        
        <h2>💡 Performance Recommendations</h2>
        <div class="recommendations">
            ${this.results.recommendations.length > 0 ? this.results.recommendations.slice(0, 10).map(rec => `
                <div class="recommendation ${rec.priority}">
                    <h4>${rec.title}${rec.source ? ` (${rec.source})` : ''}</h4>
                    <p>${rec.description}</p>
                    <small><strong>Priority:</strong> ${rec.priority.toUpperCase()} | <strong>Type:</strong> ${rec.type}</small>
                </div>
            `).join('') : '<p>No recommendations - all performance metrics are optimal! ✅</p>'}
        </div>
        
        <h2>🖥️ Environment</h2>
        <div class="environment">
            <p><strong>Node.js:</strong> ${this.results.environment.node}</p>
            <p><strong>Platform:</strong> ${this.results.environment.platform} ${this.results.environment.arch}</p>
            <p><strong>Memory:</strong> ${this.results.environment.memory}</p>
            <p><strong>Test Config:</strong> ${testConfig.environment.name || 'Default'}</p>
        </div>
        
        <h2>🔗 Individual Reports</h2>
        <div class="individual-reports">
            <p>Detailed performance reports are available in the following locations:</p>
            <ul>
                <li><a href="./performance/performance-report.html">Core Web Vitals & Performance Benchmarks</a></li>
                <li><a href="./load-testing/load-test-report.html">Load Testing & Stress Testing</a></li>
                <li><a href="./accessibility-performance/accessibility-performance-report.html">Accessibility Performance</a></li>
                <li><a href="./visual-performance/visual-performance-report.html">Visual Regression Performance</a></li>
            </ul>
        </div>
    </div>
</body>
</html>`;
    }

    async cleanup() {
        console.log('\n🧹 Cleaning up test environment...');
        
        try {
            const testSetup = require('../setup/test-setup');
            await testSetup.teardownGlobal();
        } catch (error) {
            console.warn('⚠️  Cleanup warning:', error.message);
        }
    }
}

// Run the performance test suite if this file is executed directly
if (require.main === module) {
    const runner = new PerformanceTestRunner();
    runner.run().catch(error => {
        console.error('💥 Performance test runner failed:', error);
        process.exit(1);
    });
}

module.exports = PerformanceTestRunner;