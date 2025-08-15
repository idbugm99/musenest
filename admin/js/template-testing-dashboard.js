class TemplateTestingDashboard {
    constructor() {
        this.activeTests = new Map();
        this.testResults = [];
        this.templates = {};
        this.testSuites = {};
        this.pollInterval = null;
        
        this.initializeEventListeners();
        this.loadInitialData();
    }

    initializeEventListeners() {
        // Main action buttons
        document.getElementById('runTestsBtn').addEventListener('click', () => {
            this.runSingleTest();
        });
        
        document.getElementById('batchTestBtn').addEventListener('click', () => {
            this.openBatchTestModal();
        });
        
        document.getElementById('compareTemplatesBtn').addEventListener('click', () => {
            this.openComparisonModal();
        });
        
        document.getElementById('generateReportBtn').addEventListener('click', () => {
            this.generateReport();
        });
        
        document.getElementById('refreshTestResults').addEventListener('click', () => {
            this.loadTestResults();
        });

        // Results filter
        document.getElementById('resultsFilter').addEventListener('change', (e) => {
            this.filterResults(e.target.value);
        });

        // Modal event listeners
        this.setupModalEventListeners();
        
        // Template selector
        document.getElementById('templateSelector').addEventListener('change', (e) => {
            this.updateRunButton();
        });
    }

    setupModalEventListeners() {
        // Test details modal
        document.getElementById('closeDetailsModal').addEventListener('click', () => {
            this.closeDetailsModal();
        });
        
        document.getElementById('downloadReport').addEventListener('click', () => {
            this.downloadTestReport();
        });
        
        document.getElementById('rerunFromModal').addEventListener('click', () => {
            this.rerunTestFromModal();
        });

        // Batch test modal
        document.getElementById('cancelBatchTest').addEventListener('click', () => {
            this.closeBatchTestModal();
        });
        
        document.getElementById('startBatchTest').addEventListener('click', () => {
            this.startBatchTest();
        });

        // Comparison modal
        document.getElementById('closeComparisonModal').addEventListener('click', () => {
            this.closeComparisonModal();
        });
        
        document.getElementById('runComparison').addEventListener('click', () => {
            this.runTemplateComparison();
        });

        // Close modals on backdrop click
        document.getElementById('testDetailsModal').addEventListener('click', (e) => {
            if (e.target.id === 'testDetailsModal') {
                this.closeDetailsModal();
            }
        });
    }

    async loadInitialData() {
        try {
            // Load templates
            await this.loadTemplates();
            
            // Load test suites
            await this.loadTestSuites();
            
            // Load existing test results
            await this.loadTestResults();
            
            // Start polling for active tests
            this.startPolling();
        } catch (error) {
            console.error('Failed to load initial data:', error);
            this.showNotification('Failed to load dashboard data', 'error');
        }
    }

    async loadTemplates() {
        try {
            const response = await fetch('/api/template-management/templates');
            const result = await response.json();
            
            if (result.success) {
                this.templates = result.data;
                this.populateTemplateSelectors();
            }
        } catch (error) {
            console.error('Failed to load templates:', error);
        }
    }

    async loadTestSuites() {
        try {
            const response = await fetch('/api/template-testing/suites');
            const result = await response.json();
            
            if (result.success) {
                this.testSuites = result.data;
            }
        } catch (error) {
            console.error('Failed to load test suites:', error);
        }
    }

    async loadTestResults() {
        try {
            const response = await fetch('/api/template-testing/results?limit=20');
            const result = await response.json();
            
            if (result.success) {
                this.testResults = result.data.results || [];
                this.renderTestResults();
                this.updateResultsCount();
            }
        } catch (error) {
            console.error('Failed to load test results:', error);
        }
    }

    populateTemplateSelectors() {
        const selectors = [
            'templateSelector',
            'compareTemplate1', 
            'compareTemplate2'
        ];
        
        selectors.forEach(selectorId => {
            const selector = document.getElementById(selectorId);
            selector.innerHTML = selector.querySelector('option[value=""]').outerHTML;
            
            Object.entries(this.templates).forEach(([templateId, template]) => {
                const option = document.createElement('option');
                option.value = templateId;
                option.textContent = `${template.name} (${template.category})`;
                selector.appendChild(option);
            });
        });

        // Populate batch test template list
        this.populateBatchTemplateList();
    }

    populateBatchTemplateList() {
        const container = document.getElementById('batchTemplateList');
        container.innerHTML = '';
        
        Object.entries(this.templates).forEach(([templateId, template]) => {
            const label = document.createElement('label');
            label.className = 'flex items-center p-2 hover:bg-gray-50 rounded';
            
            label.innerHTML = `
                <input type="checkbox" class="batch-template-checkbox" value="${templateId}">
                <span class="ml-3 text-sm">
                    <span class="font-medium">${template.name}</span>
                    <span class="text-gray-500 ml-2">${template.category}</span>
                </span>
            `;
            
            container.appendChild(label);
        });
    }

    renderTestResults() {
        const container = document.getElementById('testResultsGrid');
        const emptyState = document.getElementById('emptyResultsState');
        
        if (this.testResults.length === 0) {
            container.classList.add('hidden');
            emptyState.classList.remove('hidden');
            return;
        }
        
        container.classList.remove('hidden');
        emptyState.classList.add('hidden');
        container.innerHTML = '';
        
        this.testResults.forEach(result => {
            const card = this.createTestResultCard(result);
            container.appendChild(card);
        });
    }

    createTestResultCard(result) {
        const template = document.getElementById('testResultCardTemplate');
        const card = template.content.cloneNode(true);
        
        // Set basic info
        card.querySelector('.template-name').textContent = this.templates[result.templateId]?.name || result.templateId;
        card.querySelector('.test-time').textContent = this.formatRelativeTime(result.startTime);
        
        // Set status indicator
        const statusIndicator = card.querySelector('.status-indicator');
        statusIndicator.classList.add(result.status || 'unknown');
        
        // Set summary stats
        if (result.summary) {
            card.querySelector('.passed-count .count').textContent = result.summary.passed;
            card.querySelector('.failed-count .count').textContent = result.summary.failed;
            card.querySelector('.warnings-count .count').textContent = result.summary.warnings;
        }
        
        // Set overall status badge
        const statusBadge = card.querySelector('.overall-status-badge');
        statusBadge.textContent = result.status || 'Unknown';
        statusBadge.classList.add(result.status || 'unknown');
        
        // Add test suite indicators
        this.addTestSuiteIndicators(card, result);
        
        // Add event listeners
        card.querySelector('.view-details-btn').addEventListener('click', () => {
            this.viewTestDetails(result);
        });
        
        card.querySelector('.rerun-test-btn').addEventListener('click', () => {
            this.rerunTest(result.templateId);
        });
        
        return card;
    }

    addTestSuiteIndicators(card, result) {
        const suitesGrid = card.querySelector('.suites-grid');
        suitesGrid.innerHTML = '';
        
        const suites = ['structural', 'content', 'styles', 'responsive', 'accessibility', 'performance', 'compatibility'];
        
        suites.forEach(suite => {
            const indicator = document.createElement('div');
            indicator.className = 'test-suite-indicator';
            indicator.title = this.testSuites[suite]?.name || suite;
            
            if (result.tests && result.tests[suite]) {
                const suiteTests = result.tests[suite];
                const hasErrors = Object.values(suiteTests).some(test => test && !test.passed && test.severity === 'error');
                const hasWarnings = Object.values(suiteTests).some(test => test && !test.passed && test.severity === 'warning');
                const allPassed = Object.values(suiteTests).every(test => !test || test.passed);
                
                if (hasErrors) {
                    indicator.classList.add('failed');
                    indicator.textContent = '✗';
                } else if (hasWarnings) {
                    indicator.classList.add('warning');
                    indicator.textContent = '⚠';
                } else if (allPassed) {
                    indicator.classList.add('passed');
                    indicator.textContent = '✓';
                } else {
                    indicator.classList.add('not-run');
                    indicator.textContent = '-';
                }
            } else {
                indicator.classList.add('not-run');
                indicator.textContent = '-';
            }
            
            suitesGrid.appendChild(indicator);
        });
    }

    async runSingleTest() {
        const templateId = document.getElementById('templateSelector').value;
        const suite = document.getElementById('testSuiteSelector').value;
        
        if (!templateId) {
            this.showNotification('Please select a template to test', 'warning');
            return;
        }
        
        try {
            this.setTestingInProgress(true);
            
            const url = suite === 'all' ? 
                `/api/template-testing/validate/${templateId}` :
                `/api/template-testing/validate/${templateId}/${suite}`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.addActiveTest(result.data);
                this.showNotification(`Test started for ${this.templates[templateId].name}`, 'info');
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Failed to start test:', error);
            this.showNotification(`Test failed: ${error.message}`, 'error');
        } finally {
            this.setTestingInProgress(false);
        }
    }

    async startBatchTest() {
        const selectedTemplates = Array.from(document.querySelectorAll('.batch-template-checkbox:checked'))
            .map(checkbox => checkbox.value);
        
        const selectedSuites = Array.from(document.querySelectorAll('.batch-suite-checkbox:checked'))
            .map(checkbox => checkbox.value);
        
        if (selectedTemplates.length === 0) {
            this.showNotification('Please select at least one template', 'warning');
            return;
        }
        
        try {
            this.closeBatchTestModal();
            this.setTestingInProgress(true);
            
            const response = await fetch('/api/template-testing/batch-validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    templateIds: selectedTemplates,
                    options: { suites: selectedSuites }
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                result.data.results.forEach(testResult => {
                    this.addActiveTest(testResult);
                });
                this.showNotification(`Batch test started for ${selectedTemplates.length} templates`, 'info');
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Failed to start batch test:', error);
            this.showNotification(`Batch test failed: ${error.message}`, 'error');
        } finally {
            this.setTestingInProgress(false);
        }
    }

    addActiveTest(testResult) {
        this.activeTests.set(testResult.testId, testResult);
        this.renderActiveTest(testResult);
        this.updateActiveTestsSection();
    }

    renderActiveTest(testResult) {
        const template = document.getElementById('activeTestCardTemplate');
        const card = template.content.cloneNode(true);
        
        card.querySelector('.template-name').textContent = this.templates[testResult.templateId]?.name || testResult.templateId;
        card.querySelector('.test-status').textContent = 'Running tests...';
        
        const container = document.getElementById('activeTestsList');
        const cardElement = card.querySelector('.active-test-card');
        cardElement.dataset.testId = testResult.testId;
        
        container.appendChild(card);
    }

    updateActiveTestsSection() {
        const section = document.getElementById('activeTestsSection');
        const count = this.activeTests.size;
        
        document.getElementById('activeTestCount').textContent = count;
        
        if (count > 0) {
            section.classList.remove('hidden');
        } else {
            section.classList.add('hidden');
        }
    }

    startPolling() {
        this.pollInterval = setInterval(() => {
            this.pollActiveTests();
        }, 2000);
    }

    async pollActiveTests() {
        if (this.activeTests.size === 0) return;
        
        for (const [testId, testData] of this.activeTests.entries()) {
            try {
                const response = await fetch(`/api/template-testing/results/${testId}`);
                const result = await response.json();
                
                if (result.success && result.data.status !== 'running') {
                    // Test completed
                    this.completeActiveTest(testId, result.data);
                }
            } catch (error) {
                console.error(`Failed to poll test ${testId}:`, error);
            }
        }
    }

    completeActiveTest(testId, completedResult) {
        // Remove from active tests
        this.activeTests.delete(testId);
        
        // Remove active test card
        const cardElement = document.querySelector(`[data-test-id="${testId}"]`);
        if (cardElement) {
            cardElement.remove();
        }
        
        // Add to results
        this.testResults.unshift(completedResult);
        
        // Update UI
        this.updateActiveTestsSection();
        this.renderTestResults();
        this.updateResultsCount();
        
        // Show notification
        const templateName = this.templates[completedResult.templateId]?.name || completedResult.templateId;
        const message = completedResult.status === 'passed' ? 
            `Tests passed for ${templateName}` : 
            `Tests completed for ${templateName} with issues`;
        
        this.showNotification(message, completedResult.status === 'passed' ? 'success' : 'warning');
    }

    viewTestDetails(result) {
        this.currentTestResult = result;
        
        // Set modal title
        const templateName = this.templates[result.templateId]?.name || result.templateId;
        document.getElementById('detailsModalTitle').textContent = `${templateName} Test Results`;
        document.getElementById('detailsModalSubtitle').textContent = `Test ID: ${result.testId} • ${this.formatRelativeTime(result.startTime)}`;
        
        // Set footer info
        document.getElementById('testDuration').textContent = result.duration ? `${result.duration}ms` : '--';
        document.getElementById('testId').textContent = result.testId;
        
        // Render suite tabs and content
        this.renderTestDetailsTabs(result);
        this.renderTestDetailsContent(result);
        
        // Show modal
        document.getElementById('testDetailsModal').classList.remove('hidden');
    }

    renderTestDetailsTabs(result) {
        const container = document.getElementById('suiteTabsContainer');
        container.innerHTML = '';
        
        Object.entries(result.tests || {}).forEach(([suiteId, suiteTests]) => {
            const tab = document.createElement('button');
            tab.className = 'tab-button';
            tab.dataset.suite = suiteId;
            tab.textContent = this.testSuites[suiteId]?.name || suiteId;
            
            // Add status indicator
            const hasErrors = Object.values(suiteTests).some(test => test && !test.passed && test.severity === 'error');
            const hasWarnings = Object.values(suiteTests).some(test => test && !test.passed && test.severity === 'warning');
            
            if (hasErrors) {
                tab.innerHTML += ' <span class="text-red-500">✗</span>';
            } else if (hasWarnings) {
                tab.innerHTML += ' <span class="text-yellow-500">⚠</span>';
            } else {
                tab.innerHTML += ' <span class="text-green-500">✓</span>';
            }
            
            tab.addEventListener('click', () => {
                this.showTestSuiteDetails(suiteId, suiteTests);
                document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
                tab.classList.add('active');
            });
            
            container.appendChild(tab);
        });
        
        // Activate first tab
        const firstTab = container.querySelector('.tab-button');
        if (firstTab) {
            firstTab.click();
        }
    }

    showTestSuiteDetails(suiteId, suiteTests) {
        const container = document.getElementById('testDetailsContent');
        
        let html = `<h3 class="text-lg font-semibold mb-4">${this.testSuites[suiteId]?.name || suiteId} Tests</h3>`;
        html += '<div class="space-y-4">';
        
        Object.entries(suiteTests).forEach(([testName, test]) => {
            if (!test || typeof test !== 'object') return;
            
            const statusClass = test.passed ? 'border-green-500 bg-green-50' : 
                               test.severity === 'error' ? 'border-red-500 bg-red-50' : 
                               'border-yellow-500 bg-yellow-50';
            
            const statusIcon = test.passed ? '✅' : test.severity === 'error' ? '❌' : '⚠️';
            
            html += `
                <div class="test-detail-card border-l-4 ${statusClass} p-4 rounded-r-lg">
                    <div class="flex items-start justify-between">
                        <div>
                            <h4 class="font-medium flex items-center">
                                ${statusIcon} ${testName}
                            </h4>
                            <p class="text-gray-600 mt-1">${test.message}</p>
                            ${test.details ? `<pre class="text-xs text-gray-500 mt-2 bg-gray-100 p-2 rounded">${JSON.stringify(test.details, null, 2)}</pre>` : ''}
                        </div>
                        <span class="text-xs px-2 py-1 rounded ${test.severity === 'error' ? 'bg-red-100 text-red-700' : test.severity === 'warning' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}">
                            ${test.severity || 'info'}
                        </span>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
    }

    async rerunTest(templateId) {
        // Set the template selector and run test
        document.getElementById('templateSelector').value = templateId;
        await this.runSingleTest();
    }

    async generateReport() {
        const templateId = document.getElementById('templateSelector').value;
        
        if (!templateId) {
            this.showNotification('Please select a template to generate report', 'warning');
            return;
        }
        
        try {
            const response = await fetch(`/api/template-testing/report/${templateId}?format=html`);
            
            if (response.ok) {
                const htmlContent = await response.text();
                const newWindow = window.open('', '_blank');
                newWindow.document.write(htmlContent);
                newWindow.document.close();
            } else {
                throw new Error('Failed to generate report');
            }
        } catch (error) {
            console.error('Report generation failed:', error);
            this.showNotification('Failed to generate report', 'error');
        }
    }

    // Modal management
    openBatchTestModal() {
        document.getElementById('batchTestModal').classList.remove('hidden');
    }

    closeBatchTestModal() {
        document.getElementById('batchTestModal').classList.add('hidden');
    }

    openComparisonModal() {
        document.getElementById('comparisonModal').classList.remove('hidden');
    }

    closeComparisonModal() {
        document.getElementById('comparisonModal').classList.add('hidden');
    }

    closeDetailsModal() {
        document.getElementById('testDetailsModal').classList.add('hidden');
        this.currentTestResult = null;
    }

    // Utility methods
    updateRunButton() {
        const templateSelected = document.getElementById('templateSelector').value;
        const runBtn = document.getElementById('runTestsBtn');
        runBtn.disabled = !templateSelected;
    }

    setTestingInProgress(inProgress) {
        const runBtn = document.getElementById('runTestsBtn');
        const batchBtn = document.getElementById('batchTestBtn');
        
        runBtn.disabled = inProgress;
        batchBtn.disabled = inProgress;
        
        if (inProgress) {
            runBtn.innerHTML = `
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white inline mr-2"></div>
                Testing...
            `;
        } else {
            runBtn.innerHTML = `
                <svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                Run Tests
            `;
        }
    }

    filterResults(filter) {
        // Implement result filtering logic
        console.log('Filtering results by:', filter);
    }

    updateResultsCount() {
        document.getElementById('totalResultsCount').textContent = this.testResults.length;
    }

    formatRelativeTime(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diffMs = now - time;
        
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return time.toLocaleDateString();
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm transition-all transform ${
            type === 'success' ? 'bg-green-500 text-white' :
            type === 'error' ? 'bg-red-500 text-white' :
            type === 'warning' ? 'bg-yellow-500 text-white' :
            'bg-blue-500 text-white'
        }`;
        
        notification.innerHTML = `
            <div class="flex items-center justify-between">
                <p class="mr-2">${message}</p>
                <button onclick="this.parentElement.parentElement.remove()" class="text-white hover:text-gray-200">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    destroy() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }
    }
}

// Initialize the dashboard when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.templateTestingDashboard = new TemplateTestingDashboard();
});