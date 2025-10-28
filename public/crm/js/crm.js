/**
 * phoenix4ge CRM System JavaScript
 * Common functionality for all CRM pages
 */

class CRMSystem {
    constructor() {
        this.currentPage = this.getCurrentPage();
        this.modelSlug = this.getModelSlug();
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.initializeComponents();
        this.setupGlobalSearch();
    }
    
    getCurrentPage() {
        const path = window.location.pathname;
        if (path.includes('/dashboard')) return 'dashboard';
        if (path.includes('/clients')) return 'clients';
        if (path.includes('/visits')) return 'visits';
        if (path.includes('/financial')) return 'financial';
        if (path.includes('/screening')) return 'screening';
        if (path.includes('/settings')) return 'settings';
        return 'dashboard';
    }
    
    getModelSlug() {
        const path = window.location.pathname;
        const match = path.match(/\/([^\/]+)\/crm/);
        return match ? match[1] : null;
    }
    
    bindEvents() {
        // Global search
        $(document).on('input', '#globalSearch', this.handleGlobalSearch.bind(this));
        
        // Form submissions
        $(document).on('submit', '#addClientForm', this.handleAddClient.bind(this));
        $(document).on('submit', '#addVisitForm', this.handleAddVisit.bind(this));
        
        // Modal events
        $(document).on('show.bs.modal', '.modal', this.handleModalShow.bind(this));
        $(document).on('hidden.bs.modal', '.modal', this.handleModalHide.bind(this));
        
        // Filter changes
        $(document).on('change', '.filter-select', this.handleFilterChange.bind(this));
        
        // Search input
        $(document).on('input', '.search-input', this.handleSearchInput.bind(this));
    }
    
    initializeComponents() {
        // Initialize tooltips
        this.initTooltips();
        
        // Initialize date pickers
        this.initDatePickers();
        
        // Initialize select2 if available
        this.initSelect2();
        
        // Set active navigation
        this.setActiveNavigation();
    }
    
    initTooltips() {
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }
    
    initDatePickers() {
        // Set today's date as default for date inputs
        const today = new Date().toISOString().split('T')[0];
        $('input[type="date"]').each(function() {
            if (!$(this).val()) {
                $(this).val(today);
            }
        });
    }
    
    initSelect2() {
        // Initialize Select2 if the library is loaded
        if (typeof $.fn.select2 !== 'undefined') {
            $('.select2').select2({
                theme: 'bootstrap-5',
                width: '100%'
            });
        }
    }
    
    setActiveNavigation() {
        const currentPage = this.currentPage;
        $(`.nav-link[href*="/${currentPage}"]`).addClass('active');
    }
    
    setupGlobalSearch() {
        // Debounced global search
        let searchTimeout;
        $('#globalSearch').on('input', function() {
            clearTimeout(searchTimeout);
            const query = $(this).val().trim();
            
            if (query.length >= 2) {
                searchTimeout = setTimeout(() => {
                    CRMSystem.performGlobalSearch(query);
                }, 300);
            }
        });
    }
    
    static performGlobalSearch(query) {
        console.log('Performing global search for:', query);
        
        // Show loading state
        $('#globalSearch').addClass('loading');
        
        // This will be implemented once the database is set up
        setTimeout(() => {
            $('#globalSearch').removeClass('loading');
            CRMSystem.showAlert('Search functionality will be available once the database is set up!', 'info');
        }, 1000);
    }
    
    handleGlobalSearch(event) {
        const query = event.target.value.trim();
        if (query.length >= 2) {
            this.performGlobalSearch(query);
        }
    }
    
    handleAddClient(event) {
        event.preventDefault();
        
        // Show coming soon message for now
        CRMSystem.showAlert('Client management will be available once the database is set up!', 'info');
        
        // Close modal
        $('#addClientModal').modal('hide');
        
        // Reset form
        event.target.reset();
    }
    
    handleAddVisit(event) {
        event.preventDefault();
        
        // Show coming soon message for now
        CRMSystem.showAlert('Visit recording will be available once the database is set up!', 'info');
        
        // Close modal
        $('#addVisitModal').modal('hide');
        
        // Reset form
        event.target.reset();
        
        // Set today's date
        $('#visitDate').val(new Date().toISOString().split('T')[0]);
    }
    
    handleModalShow(event) {
        const modal = event.target;
        const modalId = modal.id;
        
        // Handle specific modal initialization
        if (modalId === 'addClientModal') {
            this.initAddClientModal();
        } else if (modalId === 'addVisitModal') {
            this.initAddVisitModal();
        }
    }
    
    handleModalHide(event) {
        const modal = event.target;
        const modalId = modal.id;
        
        // Handle specific modal cleanup
        if (modalId === 'addClientModal') {
            this.cleanupAddClientModal();
        } else if (modalId === 'addVisitModal') {
            this.cleanupAddVisitModal();
        }
    }
    
    initAddClientModal() {
        // Focus on first input
        $('#clientIdentifier').focus();
        
        // Set default screening method
        $('#screeningMethod').val('none');
    }
    
    initAddVisitModal() {
        // Set today's date
        $('#visitDate').val(new Date().toISOString().split('T')[0]);
        
        // Focus on client selection
        $('#visitClient').focus();
    }
    
    cleanupAddClientModal() {
        // Reset form
        $('#addClientForm')[0].reset();
    }
    
    cleanupAddVisitModal() {
        // Reset form
        $('#addVisitForm')[0].reset();
        
        // Reset date to today
        $('#visitDate').val(new Date().toISOString().split('T')[0]);
    }
    
    handleFilterChange(event) {
        const filterType = event.target.name;
        const filterValue = event.target.value;
        
        console.log(`Filter changed: ${filterType} = ${filterValue}`);
        
        // This will be implemented once the database is set up
        CRMSystem.showAlert('Filtering will be available once the database is set up!', 'info');
    }
    
    handleSearchInput(event) {
        const query = event.target.value.trim();
        
        if (query.length >= 2) {
            console.log('Searching for:', query);
            
            // This will be implemented once the database is set up
            CRMSystem.showAlert('Search functionality will be available once the database is set up!', 'info');
        }
    }
    
    // Static utility methods
    static showAlert(message, type = 'info', duration = 5000) {
        const alertHtml = `
            <div class="alert alert-${type} alert-dismissible fade show" role="alert">
                <i class="fas fa-${CRMSystem.getAlertIcon(type)} me-2"></i>
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        // Remove existing alerts
        $('.alert').remove();
        
        // Add new alert
        $('.crm-content').prepend(alertHtml);
        
        // Auto-hide after duration
        setTimeout(() => {
            $('.alert').fadeOut();
        }, duration);
        
        // Scroll to top to show alert
        $('html, body').animate({ scrollTop: 0 }, 300);
    }
    
    static getAlertIcon(type) {
        const icons = {
            success: 'check-circle',
            info: 'info-circle',
            warning: 'exclamation-triangle',
            danger: 'exclamation-triangle'
        };
        return icons[type] || 'info-circle';
    }
    
    static formatCurrency(amount) {
        if (!amount || isNaN(amount)) return '$0.00';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    }
    
    static formatDate(date, format = 'MMM DD, YYYY') {
        if (!date) return '';
        
        const d = new Date(date);
        const options = {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        };
        
        return d.toLocaleDateString('en-US', options);
    }
    
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    static throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
}

// Initialize CRM system when DOM is ready
$(document).ready(function() {
    // Initialize CRM system
    window.crmSystem = new CRMSystem();
    
    // Auto-hide alerts after 5 seconds
    setTimeout(function() {
        $('.alert').fadeOut();
    }, 5000);
    
    // Handle enter key in search inputs
    $('.search-input, #globalSearch').on('keypress', function(e) {
        if (e.which === 13) {
            e.preventDefault();
            $(this).blur();
        }
    });
    
    // Initialize any page-specific functionality
    if (typeof initPageSpecific !== 'undefined') {
        initPageSpecific();
    }
});

// Global utility functions
window.CRMUtils = {
    showAlert: CRMSystem.showAlert,
    formatCurrency: CRMSystem.formatCurrency,
    formatDate: CRMSystem.formatDate,
    debounce: CRMSystem.debounce,
    throttle: CRMSystem.throttle
};
