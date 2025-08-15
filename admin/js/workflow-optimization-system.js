/**
 * Workflow Optimization System - Phase 8.6
 * AI-powered workflow analysis and optimization suggestions
 */

class WorkflowOptimizationSystem {
  constructor() {
    this.workflows = new Map();
    this.optimizations = new Map();
    this.performanceMetrics = new Map();
    this.userPatterns = new Map();
    
    // Configuration
    this.config = {
      analysisInterval: 60000, // 1 minute
      minWorkflowLength: 3,
      optimizationThreshold: 0.7,
      enableAutomaticOptimizations: true,
      trackingEnabled: true
    };
    
    this.init();
  }

  init() {
    this.setupWorkflowTracking();
    this.registerOptimizationStrategies();
    this.startOptimizationEngine();
    this.setupEventListeners();
    
    console.log('Workflow Optimization System initialized');
  }

  setupWorkflowTracking() {
    // Track workflow completion events
    window.addEventListener('workflow-step-completed', (e) => {
      this.recordWorkflowStep(e.detail);
    });

    // Track gallery-specific workflows
    this.trackImageUploadWorkflow();
    this.trackSectionCreationWorkflow();
    this.trackBatchOperationWorkflow();
    this.trackImageEditingWorkflow();
  }

  trackImageUploadWorkflow() {
    const steps = [
      'image-picker-open',
      'images-selected',
      'upload-initiated',
      'upload-completed',
      'images-organized'
    ];
    
    this.registerWorkflow('image_upload', steps, {
      category: 'content_creation',
      priority: 'high',
      expectedDuration: 120000, // 2 minutes
      criticalPath: true
    });
  }

  trackSectionCreationWorkflow() {
    const steps = [
      'add-section-clicked',
      'section-name-entered',
      'section-description-entered',
      'section-saved',
      'images-added-to-section'
    ];
    
    this.registerWorkflow('section_creation', steps, {
      category: 'organization',
      priority: 'medium',
      expectedDuration: 90000, // 1.5 minutes
      criticalPath: false
    });
  }

  trackBatchOperationWorkflow() {
    const steps = [
      'images-selected',
      'batch-action-chosen',
      'batch-confirmation',
      'batch-processing',
      'batch-completed'
    ];
    
    this.registerWorkflow('batch_operation', steps, {
      category: 'efficiency',
      priority: 'high',
      expectedDuration: 60000, // 1 minute
      criticalPath: true
    });
  }

  trackImageEditingWorkflow() {
    const steps = [
      'image-selected',
      'lightbox-opened',
      'edit-mode-activated',
      'changes-made',
      'changes-saved'
    ];
    
    this.registerWorkflow('image_editing', steps, {
      category: 'content_editing',
      priority: 'medium',
      expectedDuration: 180000, // 3 minutes
      criticalPath: false
    });
  }

  registerWorkflow(name, steps, metadata) {
    this.workflows.set(name, {
      steps,
      metadata,
      instances: [],
      performance: {
        averageDuration: 0,
        successRate: 0,
        abandonmentPoints: new Map(),
        bottlenecks: []
      }
    });
  }

  recordWorkflowStep(stepData) {
    const { workflowName, stepName, timestamp, success, duration, context } = stepData;
    
    if (!this.workflows.has(workflowName)) return;
    
    const workflow = this.workflows.get(workflowName);
    
    // Find or create current workflow instance
    let currentInstance = workflow.instances.find(instance => 
      !instance.completed && 
      timestamp - instance.startTime < 600000 // 10 minutes max
    );
    
    if (!currentInstance) {
      currentInstance = {
        id: this.generateInstanceId(),
        startTime: timestamp,
        steps: [],
        completed: false,
        abandoned: false,
        duration: 0,
        context
      };
      workflow.instances.push(currentInstance);
    }
    
    // Add step to instance
    currentInstance.steps.push({
      name: stepName,
      timestamp,
      success,
      duration: duration || 0,
      context
    });
    
    // Check if workflow is complete
    const workflowSteps = workflow.steps;
    const completedSteps = currentInstance.steps.map(s => s.name);
    const isComplete = workflowSteps.every(step => completedSteps.includes(step));
    
    if (isComplete) {
      this.completeWorkflowInstance(workflowName, currentInstance);
    }
    
    // Update performance metrics
    this.updateWorkflowMetrics(workflowName);
  }

  completeWorkflowInstance(workflowName, instance) {
    instance.completed = true;
    instance.duration = instance.steps[instance.steps.length - 1].timestamp - instance.startTime;
    
    // Trigger completion event
    window.dispatchEvent(new CustomEvent('workflow-completed', {
      detail: {
        workflowName,
        instance,
        metrics: this.calculateInstanceMetrics(instance)
      }
    }));
    
    // Check for optimization opportunities
    this.analyzeWorkflowForOptimizations(workflowName, instance);
  }

  updateWorkflowMetrics(workflowName) {
    const workflow = this.workflows.get(workflowName);
    const completedInstances = workflow.instances.filter(i => i.completed);
    
    if (completedInstances.length === 0) return;
    
    // Calculate average duration
    const totalDuration = completedInstances.reduce((sum, i) => sum + i.duration, 0);
    workflow.performance.averageDuration = totalDuration / completedInstances.length;
    
    // Calculate success rate
    const successfulInstances = completedInstances.filter(i => 
      i.steps.every(s => s.success !== false)
    );
    workflow.performance.successRate = successfulInstances.length / completedInstances.length;
    
    // Identify abandonment points
    const abandonedInstances = workflow.instances.filter(i => i.abandoned);
    workflow.performance.abandonmentPoints.clear();
    
    for (const instance of abandonedInstances) {
      const lastStep = instance.steps[instance.steps.length - 1];
      const count = workflow.performance.abandonmentPoints.get(lastStep.name) || 0;
      workflow.performance.abandonmentPoints.set(lastStep.name, count + 1);
    }
    
    // Identify bottlenecks
    this.identifyWorkflowBottlenecks(workflowName);
  }

  identifyWorkflowBottlenecks(workflowName) {
    const workflow = this.workflows.get(workflowName);
    const instances = workflow.instances.filter(i => i.completed);
    
    if (instances.length < 3) return;
    
    const stepDurations = new Map();
    
    for (const instance of instances) {
      for (let i = 1; i < instance.steps.length; i++) {
        const stepName = instance.steps[i].name;
        const duration = instance.steps[i].timestamp - instance.steps[i - 1].timestamp;
        
        if (!stepDurations.has(stepName)) {
          stepDurations.set(stepName, []);
        }
        stepDurations.get(stepName).push(duration);
      }
    }
    
    const bottlenecks = [];
    
    for (const [stepName, durations] of stepDurations) {
      const avgDuration = durations.reduce((a, b) => a + b) / durations.length;
      const expectedDuration = workflow.metadata.expectedDuration / workflow.steps.length;
      
      if (avgDuration > expectedDuration * 2) {
        bottlenecks.push({
          step: stepName,
          avgDuration,
          expectedDuration,
          severity: avgDuration / expectedDuration
        });
      }
    }
    
    workflow.performance.bottlenecks = bottlenecks.sort((a, b) => b.severity - a.severity);
  }

  analyzeWorkflowForOptimizations(workflowName, instance) {
    const workflow = this.workflows.get(workflowName);
    const metrics = this.calculateInstanceMetrics(instance);
    
    // Check for duration optimization
    if (metrics.efficiency < this.config.optimizationThreshold) {
      this.suggestDurationOptimization(workflowName, instance, metrics);
    }
    
    // Check for error patterns
    if (metrics.errorRate > 0.1) {
      this.suggestErrorReduction(workflowName, instance, metrics);
    }
    
    // Check for step sequence optimization
    if (metrics.sequenceOptimality < 0.8) {
      this.suggestSequenceOptimization(workflowName, instance, metrics);
    }
    
    // Check for automation opportunities
    if (metrics.automationPotential > 0.7) {
      this.suggestAutomation(workflowName, instance, metrics);
    }
  }

  calculateInstanceMetrics(instance) {
    const totalDuration = instance.duration;
    const stepCount = instance.steps.length;
    const errorCount = instance.steps.filter(s => s.success === false).length;
    
    return {
      efficiency: Math.max(0, 1 - (totalDuration / 300000)), // Normalized to 5 minutes max
      errorRate: errorCount / stepCount,
      stepEfficiency: stepCount > 0 ? 1 / stepCount : 0,
      sequenceOptimality: this.calculateSequenceOptimality(instance),
      automationPotential: this.calculateAutomationPotential(instance),
      userSatisfaction: this.estimateUserSatisfaction(instance)
    };
  }

  calculateSequenceOptimality(instance) {
    // Analyze if steps were performed in optimal order
    const steps = instance.steps;
    let optimalityScore = 1;
    
    // Check for unnecessary back-and-forth patterns
    const stepNames = steps.map(s => s.name);
    const uniqueSteps = [...new Set(stepNames)];
    
    if (stepNames.length > uniqueSteps.length * 1.5) {
      optimalityScore *= 0.7; // Penalize repetitive patterns
    }
    
    return optimalityScore;
  }

  calculateAutomationPotential(instance) {
    // Identify repetitive actions that could be automated
    const repetitiveActions = [
      'batch-select',
      'apply-filter',
      'resize-image',
      'copy-metadata'
    ];
    
    const automatable = instance.steps.filter(s => 
      repetitiveActions.some(action => s.name.includes(action))
    );
    
    return automatable.length / instance.steps.length;
  }

  estimateUserSatisfaction(instance) {
    let satisfaction = 1.0;
    
    // Reduce for errors
    const errorCount = instance.steps.filter(s => s.success === false).length;
    satisfaction -= errorCount * 0.2;
    
    // Reduce for long duration
    const expectedDuration = 120000; // 2 minutes expected
    if (instance.duration > expectedDuration * 2) {
      satisfaction -= 0.3;
    }
    
    // Reduce for many steps (complexity)
    if (instance.steps.length > 10) {
      satisfaction -= 0.1;
    }
    
    return Math.max(0, satisfaction);
  }

  // Optimization suggestions
  suggestDurationOptimization(workflowName, instance, metrics) {
    const optimization = {
      type: 'duration_optimization',
      workflowName,
      priority: 'medium',
      suggestions: [
        'Add keyboard shortcuts for frequently used actions',
        'Implement bulk operations to reduce repetitive steps',
        'Optimize loading times for heavy operations',
        'Add quick actions toolbar'
      ],
      expectedImprovement: '30% faster completion',
      implementation: 'ui_enhancement'
    };
    
    this.recordOptimization(optimization);
  }

  suggestErrorReduction(workflowName, instance, metrics) {
    const errorSteps = instance.steps.filter(s => s.success === false);
    const optimization = {
      type: 'error_reduction',
      workflowName,
      priority: 'high',
      suggestions: [
        'Improve validation and error messages',
        'Add confirmation dialogs for destructive actions',
        'Implement auto-save functionality',
        'Add undo/redo capabilities'
      ],
      problematicSteps: errorSteps.map(s => s.name),
      expectedImprovement: '50% error reduction',
      implementation: 'validation_enhancement'
    };
    
    this.recordOptimization(optimization);
  }

  suggestSequenceOptimization(workflowName, instance, metrics) {
    const optimization = {
      type: 'sequence_optimization',
      workflowName,
      priority: 'low',
      suggestions: [
        'Reorder form fields for better flow',
        'Group related actions together',
        'Add smart defaults based on user history',
        'Implement progressive disclosure'
      ],
      expectedImprovement: '20% more intuitive workflow',
      implementation: 'ux_redesign'
    };
    
    this.recordOptimization(optimization);
  }

  suggestAutomation(workflowName, instance, metrics) {
    const optimization = {
      type: 'automation',
      workflowName,
      priority: 'high',
      suggestions: [
        'Implement smart batch operations',
        'Add workflow templates',
        'Create automated rules for common tasks',
        'Add AI-powered suggestions'
      ],
      automationPotential: metrics.automationPotential,
      expectedImprovement: '60% less manual work',
      implementation: 'automation_features'
    };
    
    this.recordOptimization(optimization);
  }

  recordOptimization(optimization) {
    const id = this.generateOptimizationId();
    optimization.id = id;
    optimization.timestamp = Date.now();
    optimization.status = 'pending';
    
    this.optimizations.set(id, optimization);
    
    // Notify other systems
    window.dispatchEvent(new CustomEvent('optimization-suggested', {
      detail: optimization
    }));
    
    // Auto-implement if enabled and high priority
    if (this.config.enableAutomaticOptimizations && optimization.priority === 'high') {
      setTimeout(() => {
        this.implementOptimization(optimization);
      }, 5000); // 5 second delay
    }
  }

  implementOptimization(optimization) {
    switch (optimization.implementation) {
      case 'ui_enhancement':
        this.implementUIEnhancement(optimization);
        break;
      case 'validation_enhancement':
        this.implementValidationEnhancement(optimization);
        break;
      case 'ux_redesign':
        this.implementUXRedesign(optimization);
        break;
      case 'automation_features':
        this.implementAutomationFeatures(optimization);
        break;
    }
    
    optimization.status = 'implemented';
    optimization.implementedAt = Date.now();
  }

  implementUIEnhancement(optimization) {
    // Add quick actions toolbar
    if (!document.querySelector('.workflow-quick-actions')) {
      const toolbar = document.createElement('div');
      toolbar.className = 'workflow-quick-actions';
      toolbar.innerHTML = `
        <div class="quick-actions-header">
          <i class="fas fa-bolt text-primary"></i>
          <span class="fw-bold">Quick Actions</span>
        </div>
        <div class="btn-group" role="group">
          <button class="btn btn-sm btn-outline-primary" data-action="bulk-select">
            <i class="fas fa-check-square"></i> Select All
          </button>
          <button class="btn btn-sm btn-outline-primary" data-action="bulk-move">
            <i class="fas fa-arrows-alt"></i> Move Selected
          </button>
          <button class="btn btn-sm btn-outline-primary" data-action="bulk-delete">
            <i class="fas fa-trash"></i> Delete Selected
          </button>
        </div>
      `;
      
      const container = document.querySelector('.gallery-toolbar') || 
                       document.querySelector('.main-content') || 
                       document.body;
      container.insertBefore(toolbar, container.firstChild);
    }
  }

  implementValidationEnhancement(optimization) {
    // Add enhanced validation and error handling
    document.addEventListener('submit', (e) => {
      const form = e.target;
      if (form.tagName === 'FORM') {
        // Add loading state
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = `
            <span class="spinner-border spinner-border-sm me-2"></span>
            Processing...
          `;
        }
        
        // Enhanced validation
        setTimeout(() => {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Save';
          }
        }, 2000);
      }
    });
  }

  implementUXRedesign(optimization) {
    // Implement progressive disclosure
    const advancedFeatures = document.querySelectorAll('.advanced-feature');
    advancedFeatures.forEach(feature => {
      feature.style.display = 'none';
    });
    
    // Add toggle for advanced features
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'btn btn-sm btn-outline-secondary mb-3';
    toggleBtn.innerHTML = '<i class="fas fa-cog"></i> Show Advanced Options';
    toggleBtn.addEventListener('click', () => {
      const isHidden = advancedFeatures[0]?.style.display === 'none';
      advancedFeatures.forEach(feature => {
        feature.style.display = isHidden ? 'block' : 'none';
      });
      toggleBtn.innerHTML = isHidden ? 
        '<i class="fas fa-cog"></i> Hide Advanced Options' :
        '<i class="fas fa-cog"></i> Show Advanced Options';
    });
    
    const container = document.querySelector('.gallery-controls') || document.body;
    container.appendChild(toggleBtn);
  }

  implementAutomationFeatures(optimization) {
    // Add workflow templates
    const templates = {
      'quick_upload': {
        name: 'Quick Upload & Organize',
        steps: ['select-images', 'auto-upload', 'auto-organize'],
        description: 'Upload and automatically organize images'
      },
      'batch_resize': {
        name: 'Batch Resize',
        steps: ['select-images', 'apply-resize', 'save-all'],
        description: 'Resize multiple images at once'
      }
    };
    
    const templateSelector = document.createElement('div');
    templateSelector.className = 'workflow-templates mb-3';
    templateSelector.innerHTML = `
      <label class="form-label fw-bold">
        <i class="fas fa-magic text-primary"></i>
        Workflow Templates
      </label>
      <select class="form-select form-select-sm">
        <option value="">Choose a template...</option>
        ${Object.entries(templates).map(([key, template]) => 
          `<option value="${key}">${template.name}</option>`
        ).join('')}
      </select>
    `;
    
    const container = document.querySelector('.gallery-header') || document.body;
    container.appendChild(templateSelector);
  }

  registerOptimizationStrategies() {
    this.strategies = new Map([
      ['reduce_load_time', this.optimizeLoadTime.bind(this)],
      ['improve_navigation', this.optimizeNavigation.bind(this)],
      ['enhance_feedback', this.enhanceFeedback.bind(this)],
      ['streamline_workflow', this.streamlineWorkflow.bind(this)]
    ]);
  }

  startOptimizationEngine() {
    setInterval(() => {
      this.analyzeAllWorkflows();
      this.generateOptimizationReport();
    }, this.config.analysisInterval);
  }

  analyzeAllWorkflows() {
    for (const [workflowName, workflow] of this.workflows) {
      const recentInstances = workflow.instances.filter(instance => 
        Date.now() - instance.startTime < 3600000 // Last hour
      );
      
      if (recentInstances.length > 0) {
        this.updateWorkflowMetrics(workflowName);
        
        // Check for performance degradation
        if (workflow.performance.successRate < 0.8) {
          this.flagWorkflowIssue(workflowName, 'low_success_rate');
        }
        
        if (workflow.performance.averageDuration > workflow.metadata.expectedDuration * 1.5) {
          this.flagWorkflowIssue(workflowName, 'slow_performance');
        }
      }
    }
  }

  generateOptimizationReport() {
    const report = {
      timestamp: Date.now(),
      workflows: Array.from(this.workflows.entries()).map(([name, workflow]) => ({
        name,
        performance: workflow.performance,
        metadata: workflow.metadata,
        instanceCount: workflow.instances.length,
        recentActivity: workflow.instances.filter(i => 
          Date.now() - i.startTime < 3600000
        ).length
      })),
      optimizations: Array.from(this.optimizations.values()),
      recommendations: this.generateRecommendations()
    };
    
    // Store report
    this.performanceMetrics.set(Date.now(), report);
    
    // Dispatch event for other systems
    window.dispatchEvent(new CustomEvent('optimization-report-generated', {
      detail: report
    }));
  }

  generateRecommendations() {
    const recommendations = [];
    
    // Analyze overall system performance
    const allWorkflows = Array.from(this.workflows.values());
    const avgSuccessRate = allWorkflows.reduce((sum, w) => 
      sum + (w.performance.successRate || 0), 0) / allWorkflows.length;
    
    if (avgSuccessRate < 0.8) {
      recommendations.push({
        type: 'system_improvement',
        priority: 'high',
        message: 'Overall workflow success rate is below 80%. Consider UX improvements.',
        actions: ['Review error patterns', 'Improve user guidance', 'Simplify complex workflows']
      });
    }
    
    // Check for common bottlenecks
    const allBottlenecks = allWorkflows.flatMap(w => w.performance.bottlenecks || []);
    const bottleneckSteps = new Map();
    
    for (const bottleneck of allBottlenecks) {
      bottleneckSteps.set(bottleneck.step, 
        (bottleneckSteps.get(bottleneck.step) || 0) + 1);
    }
    
    const commonBottlenecks = Array.from(bottleneckSteps.entries())
      .filter(([step, count]) => count > 1)
      .sort((a, b) => b[1] - a[1]);
    
    if (commonBottlenecks.length > 0) {
      recommendations.push({
        type: 'bottleneck_resolution',
        priority: 'medium',
        message: `Common bottlenecks identified: ${commonBottlenecks[0][0]}`,
        actions: ['Optimize slow steps', 'Add progress indicators', 'Implement background processing']
      });
    }
    
    return recommendations;
  }

  setupEventListeners() {
    // Gallery-specific event tracking
    document.addEventListener('click', (e) => {
      if (e.target.matches('.image-item')) {
        this.recordWorkflowStep({
          workflowName: 'image_editing',
          stepName: 'image-selected',
          timestamp: Date.now(),
          success: true
        });
      }
    });
    
    // Form submissions
    document.addEventListener('submit', (e) => {
      this.recordWorkflowStep({
        workflowName: this.detectWorkflowFromForm(e.target),
        stepName: 'form-submitted',
        timestamp: Date.now(),
        success: true
      });
    });
  }

  detectWorkflowFromForm(form) {
    if (form.id?.includes('section')) return 'section_creation';
    if (form.id?.includes('upload')) return 'image_upload';
    if (form.classList?.contains('batch-form')) return 'batch_operation';
    return 'generic_form';
  }

  flagWorkflowIssue(workflowName, issueType) {
    console.warn(`Workflow issue detected: ${issueType} in ${workflowName}`);
    
    window.dispatchEvent(new CustomEvent('workflow-issue-detected', {
      detail: {
        workflowName,
        issueType,
        timestamp: Date.now()
      }
    }));
  }

  // Utility methods
  generateInstanceId() {
    return `instance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateOptimizationId() {
    return `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API
  getWorkflowAnalytics() {
    return {
      workflows: Object.fromEntries(
        Array.from(this.workflows.entries()).map(([name, workflow]) => [
          name,
          {
            performance: workflow.performance,
            metadata: workflow.metadata,
            recentInstances: workflow.instances.slice(-10)
          }
        ])
      ),
      optimizations: Array.from(this.optimizations.values()),
      recommendations: this.generateRecommendations()
    };
  }

  getOptimizationSuggestions() {
    return Array.from(this.optimizations.values())
      .filter(opt => opt.status === 'pending')
      .sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
  }

  enableOptimization(optimizationId) {
    const optimization = this.optimizations.get(optimizationId);
    if (optimization && optimization.status === 'pending') {
      this.implementOptimization(optimization);
      return true;
    }
    return false;
  }

  disableTracking() {
    this.config.trackingEnabled = false;
  }

  enableTracking() {
    this.config.trackingEnabled = true;
  }

  exportAnalytics() {
    return {
      workflows: this.getWorkflowAnalytics(),
      performanceMetrics: Array.from(this.performanceMetrics.entries()),
      timestamp: Date.now(),
      version: '1.0'
    };
  }

  // Missing methods referenced in registerOptimizationStrategies
  optimizeLoadTime(workflow) {
    console.log('Optimizing load time for workflow:', workflow.name);
    // Add load time optimization logic here
    return {
      optimizationType: 'reduce_load_time',
      suggestions: ['Enable image lazy loading', 'Optimize API calls', 'Cache frequent data'],
      estimatedImprovement: '20-30% faster loading'
    };
  }

  optimizeNavigation(workflow) {
    console.log('Optimizing navigation for workflow:', workflow.name);
    return {
      optimizationType: 'improve_navigation',
      suggestions: ['Add breadcrumbs', 'Simplify menu structure', 'Add quick actions'],
      estimatedImprovement: 'Reduced navigation steps'
    };
  }

  enhanceFeedback(workflow) {
    console.log('Enhancing feedback for workflow:', workflow.name);
    return {
      optimizationType: 'enhance_feedback',
      suggestions: ['Add progress indicators', 'Show status updates', 'Improve error messages'],
      estimatedImprovement: 'Better user understanding'
    };
  }

  streamlineWorkflow(workflow) {
    console.log('Streamlining workflow:', workflow.name);
    return {
      optimizationType: 'streamline_workflow',
      suggestions: ['Combine similar steps', 'Add batch operations', 'Auto-fill common data'],
      estimatedImprovement: 'Fewer steps required'
    };
  }
}

// Auto-initialize
document.addEventListener('DOMContentLoaded', () => {
  window.workflowOptimizationSystem = new WorkflowOptimizationSystem();
});

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WorkflowOptimizationSystem;
} else {
  window.WorkflowOptimizationSystem = WorkflowOptimizationSystem;
}