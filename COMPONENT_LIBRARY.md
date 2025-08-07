# MuseNest Component Library

**Version:** 1.0  
**Date:** August 2, 2025  
**Purpose:** Comprehensive inventory of all reusable UI components, templates, and code patterns

---

## 🎨 **Frontend Components**

### **Business Manager Components**

#### **MuseNest Business Manager**
- **Files:** `/admin/musenest-business-manager.html`
- **Purpose:** Main CRM interface with comprehensive business management tools
- **Dependencies:** Bootstrap 5, Font Awesome
- **Features:**
  - Left-hand navigation with organized sections
  - Dashboard with KPI metrics and recent activity
  - Dynamic section loading with component injection
  - Mobile responsive design
  - Real-time data refresh capabilities
- **Usage:** Primary admin interface for managing all business operations
- **Auto-Save:** N/A (loads other components)
- **JavaScript Class:** `BusinessManager`

#### **Client Management Interface**
- **Files:** `/admin/components/client-management.html`
- **Purpose:** Complete client management with search, filtering, and profile editing
- **Dependencies:** Bootstrap 5, Font Awesome, auto-save-input, data-table, kpi-card
- **Features:**
  - Client list with search and filter capabilities
  - KPI dashboard showing key client metrics
  - Modal-based client profile editing
  - Real-time data loading and refresh
  - Bulk operations support
- **Usage:** `window.clientManager = new ClientManagement();`
- **Auto-Save:** ✅ Field-level auto-save for all profile edits
- **API Endpoints:** `/api/clients`, `/api/clients/:id`
- **JavaScript Class:** `ClientManagement`

#### **Client Onboarding Wizard**
- **Files:** `/admin/components/client-onboarding-wizard.html`
- **Purpose:** Multi-step client onboarding with template and subscription selection
- **Dependencies:** Bootstrap 5, Font Awesome
- **Features:**
  - 5-step progress indicator wizard
  - Template gallery with preview images
  - Subscription tier selection with pricing
  - AI configuration options
  - Complete account creation workflow
  - Form validation and error handling
- **Usage:** `window.clientOnboarding = new ClientOnboarding();`
- **Auto-Save:** Manual (step-by-step completion)
- **API Endpoints:** `/api/clients`, `/api/clients/templates`, `/api/site-configuration/subscription/tiers`
- **JavaScript Class:** `ClientOnboarding`

#### **KPI Dashboard Card**
- **Files:** `/admin/components/kpi-card.html`
- **Purpose:** Reusable KPI metric display card with auto-refresh
- **Dependencies:** Bootstrap 5, Font Awesome
- **Features:**
  - Animated metric values with trend indicators
  - Hover effects and visual feedback
  - Auto-refresh capabilities
  - Customizable icons and colors
  - Responsive layout
- **Usage:** Include HTML template and populate via JavaScript
- **Auto-Save:** N/A (display only)
- **JavaScript Class:** `KPICard`

#### **Auto-Save Input Field**
- **Files:** `/admin/components/auto-save-input.html`
- **Purpose:** Form input with real-time auto-save functionality
- **Dependencies:** Bootstrap 5
- **Features:**
  - Visual save indicators (success/error/saving)
  - Field-level and batch save modes
  - Error handling with validation feedback
  - Debounced saving to prevent excessive requests
- **Usage:** Add `class="auto-save"` and `data-endpoint`, `data-resource-id` attributes
- **Auto-Save:** ✅ Core auto-save functionality component
- **JavaScript Functions:** `autoSaveField()`, `showSaveIndicator()`

#### **Enhanced Data Table**
- **Files:** `/admin/components/data-table.html`
- **Purpose:** Feature-rich data table with search, filter, sorting, and pagination
- **Dependencies:** Bootstrap 5, Font Awesome
- **Features:**
  - Real-time search and filtering
  - Column sorting with visual indicators
  - Pagination with configurable page sizes
  - Responsive design with horizontal scrolling
  - Customizable action buttons
  - Auto-refresh capabilities
- **Usage:** `new DataTable('container-id', config)`
- **Auto-Save:** N/A (display and interaction only)
- **JavaScript Class:** `DataTable`

### **Navigation Components**

#### **Main Navigation Bar**
- **Files:** 
  - `/templates/*/components/navigation.html` (template-specific)
  - `/admin/site-configuration-enhanced.html` (lines 159-169)
- **Purpose:** Primary site navigation with responsive collapse
- **Dependencies:** Bootstrap 5, Font Awesome
- **Features:** 
  - Responsive hamburger menu
  - Active state indicators
  - Brand logo placement
  - Mobile-optimized dropdown
- **CSS Classes:** `.navbar`, `.navbar-expand-lg`, `.navbar-brand`
- **JavaScript:** Bootstrap collapse functionality
- **Reuse Pattern:** Copy navigation structure, update links and branding

#### **Admin Sidebar Navigation**
- **File:** `/admin/business-management.html` 
- **Purpose:** Left-hand admin menu with collapsible sections
- **Dependencies:** Bootstrap 5, Font Awesome icons
- **Features:**
  - Collapsible menu sections
  - Icon + text labels
  - Active state highlighting
  - Responsive behavior
- **CSS Classes:** `.sidebar`, `.nav-link`, `.collapse`
- **Reuse Pattern:** Sidebar structure with customizable menu items

### **Dashboard Components**

#### **KPI Cards**
- **Files:** 
  - `/admin/subscription-tier-management.html` (lines 66-103)
  - `/admin/site-configuration-enhanced.html` (health dashboard)
- **Purpose:** Display key metrics with icons and values
- **Dependencies:** Bootstrap 5, Font Awesome
- **Structure:**
  ```html
  <div class="bg-white rounded-lg shadow p-6">
      <div class="flex items-center">
          <div class="p-2 bg-[color]-100 rounded-lg">
              <i class="fas fa-[icon] text-[color]-600"></i>
          </div>
          <div class="ml-4">
              <p class="text-sm font-medium text-gray-600">[Label]</p>
              <p class="text-2xl font-semibold text-gray-900">[Value]</p>
          </div>
      </div>
  </div>
  ```
- **Color Schemes:** Green (revenue), Blue (users), Purple (analytics), Yellow (activity)
- **JavaScript Integration:** Dynamic value updates via API calls
- **Reuse Pattern:** Copy card structure, customize icon/color/API endpoint

#### **Chart Components**
- **File:** `/admin/subscription-tier-management.html` (lines 409-439)
- **Purpose:** Data visualization with Chart.js
- **Dependencies:** Chart.js CDN
- **Chart Types:**
  - **Doughnut Chart:** Revenue by tier breakdown
  - **Line Chart:** Usage trends over time
- **Features:**
  - Real-time data updates
  - Responsive design
  - Color-coded legends
  - Interactive tooltips
- **JavaScript Pattern:**
  ```javascript
  const chart = new Chart(ctx, {
      type: 'doughnut|line|bar',
      data: { labels: [], datasets: [{}] },
      options: { responsive: true }
  });
  ```
- **Reuse Pattern:** Copy chart initialization, customize data sources

### **Form Components**

#### **Enhanced Form Inputs**
- **Files:** 
  - `/admin/subscription-tier-management.html` (lines 137-185)
  - `/admin/site-configuration-enhanced.html` (configuration forms)
- **Purpose:** Consistent form styling with validation
- **Dependencies:** Bootstrap 5
- **Input Types:**
  - Text inputs with floating labels
  - Number inputs with step controls
  - Textarea with auto-resize
  - Select dropdowns with search
  - Checkbox groups with labels
  - Range sliders with value display
- **CSS Classes:** `.form-control`, `.form-label`, `.form-check`
- **Validation:** Real-time validation with error states
- **Save-on-Change:** Automatic persistence on field blur
- **Reuse Pattern:** Copy input structure, add auto-save JavaScript

#### **Modal Components**
- **Files:**
  - `/admin/subscription-tier-management.html` (lines 119-270)
  - `/admin/media-review-modal.html`
- **Purpose:** Consistent modal dialogs for editing/viewing
- **Dependencies:** Bootstrap 5 modal system
- **Features:**
  - Responsive sizing (sm, md, lg, xl)
  - Form integration
  - Close button handling
  - Backdrop click to close
  - Keyboard escape support
- **Structure:**
  ```html
  <div class="modal fade" id="[modal-id]">
      <div class="modal-dialog modal-[size]">
          <div class="modal-content">
              <div class="modal-header">
                  <h5 class="modal-title">[Title]</h5>
                  <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">[Content]</div>
              <div class="modal-footer">[Actions]</div>
          </div>
      </div>
  </div>
  ```
- **JavaScript Integration:** Auto-populate forms, handle submissions
- **Reuse Pattern:** Copy modal structure, customize content and handlers

### **Data Display Components**

#### **Enhanced Data Tables**
- **Files:**
  - `/admin/site-configuration-enhanced.html` (site list display)
  - `/admin/system-admin-dashboard.html` (user management tables)
- **Purpose:** Sortable, filterable data display with actions
- **Dependencies:** Bootstrap 5, DataTables (optional)
- **Features:**
  - Search and filter capabilities
  - Column sorting
  - Pagination
  - Row actions (edit, delete, view)
  - Status indicators with color coding
  - Responsive column hiding
- **CSS Classes:** `.table`, `.table-striped`, `.table-hover`
- **JavaScript:** Search, sort, filter functionality
- **Action Buttons:** Edit, delete, duplicate, view details
- **Reuse Pattern:** Copy table structure, customize columns and data source

#### **Status Indicators**
- **Files:** Multiple admin pages
- **Purpose:** Visual status representation with colors
- **Types:**
  - **Badges:** `.badge .bg-success|warning|danger|info`
  - **Pills:** `.badge .rounded-pill`
  - **Dots:** Colored circles for compact status
- **Status Types:**
  - Active/Inactive (green/gray)
  - Online/Offline (green/red)
  - Pending/Complete (yellow/green)
  - Success/Error (green/red)
- **Reuse Pattern:** Consistent color scheme across all status displays

### **Business Template Components**

#### **Template Gallery Cards**
- **Files:** `/templates/*/index.html` (various template examples)
- **Purpose:** Preview cards for business templates
- **Features:**
  - Thumbnail previews
  - Template metadata
  - Selection controls
  - Category filtering
- **Structure:**
  ```html
  <div class="template-card border rounded-lg overflow-hidden hover:shadow-lg">
      <img src="[preview]" class="w-full h-48 object-cover">
      <div class="p-4">
          <h3 class="font-semibold">[Template Name]</h3>
          <p class="text-gray-600">[Description]</p>
          <div class="flex justify-between items-center mt-4">
              <span class="badge">[Category]</span>
              <button class="btn btn-primary btn-sm">Select</button>
          </div>
      </div>
  </div>
  ```
- **JavaScript:** Template selection, preview modal
- **Reuse Pattern:** Copy card structure, customize template data

## 🔧 **JavaScript Components**

### **Auto-Save Functionality**
- **Files:** Various admin pages with forms
- **Purpose:** Save form data on field change (blur event)
- **Pattern:**
  ```javascript
  // Auto-save on field change
  document.querySelectorAll('.auto-save').forEach(field => {
      field.addEventListener('blur', async (e) => {
          const data = { [e.target.name]: e.target.value };
          await saveToAPI(endpoint, data);
          showSaveIndicator('saved');
      });
  });
  ```
- **Dependencies:** Fetch API for HTTP requests
- **Features:**
  - Visual save indicators
  - Error handling
  - Debounced saves for rapid changes
- **Reuse Pattern:** Add `.auto-save` class, define API endpoint

### **Real-time Data Updates**
- **Files:** `/admin/subscription-tier-management.html`, health monitoring
- **Purpose:** Periodic data refresh without page reload
- **Pattern:**
  ```javascript
  // Refresh data every 30 seconds
  setInterval(async () => {
      const data = await fetch('/api/endpoint').then(r => r.json());
      updateDisplayElements(data);
  }, 30000);
  ```
- **Features:**
  - Configurable refresh intervals
  - Error handling for failed requests
  - Loading states
- **Reuse Pattern:** Copy refresh logic, customize data endpoints

### **Search and Filter System**
- **Files:** Multiple admin pages with data tables
- **Purpose:** Client-side data filtering and search
- **Pattern:**
  ```javascript
  // Search functionality
  document.getElementById('search').addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      filterTableRows(query);
  });
  ```
- **Features:**
  - Multi-column search
  - Category filtering
  - Real-time results
- **Reuse Pattern:** Copy search handlers, customize filter criteria

## 🎯 **UI Patterns & Standards**

### **Color Scheme**
- **Primary:** Blue (#3B82F6)
- **Success:** Green (#10B981)  
- **Warning:** Yellow (#F59E0B)
- **Danger:** Red (#EF4444)
- **Gray Scale:** #F9FAFB, #F3F4F6, #E5E7EB, #D1D5DB, #9CA3AF, #6B7280, #374151, #1F2937

### **Typography**
- **Headings:** Font weights 600-700, responsive sizing
- **Body:** Font weight 400, 14-16px base size
- **Labels:** Font weight 500, 12-14px
- **Monospace:** Code, API responses, technical data

### **Spacing System**
- **Margins:** 0.25rem, 0.5rem, 1rem, 1.5rem, 2rem, 3rem
- **Padding:** Consistent with margin scale
- **Component Gaps:** 1rem standard, 1.5rem for section separation

### **Button Patterns**
- **Primary:** `.btn .btn-primary` for main actions
- **Secondary:** `.btn .btn-outline-primary` for secondary actions
- **Danger:** `.btn .btn-danger` for destructive actions
- **Small:** `.btn .btn-sm` for compact areas
- **Icon Buttons:** Icon + text with consistent spacing

## 📱 **Responsive Patterns**

### **Breakpoints**
- **Mobile:** < 768px (stack components vertically)
- **Tablet:** 768px - 1024px (2-column layouts)
- **Desktop:** > 1024px (full multi-column layouts)

### **Mobile Adaptations**
- **Navigation:** Hamburger menu collapse
- **Tables:** Horizontal scroll or card layouts
- **Forms:** Full-width inputs, larger touch targets
- **Modals:** Full-screen on mobile

---

## 🔄 **Component Reuse Guidelines**

### **Before Creating New Components:**
1. **Check this library** for existing patterns
2. **Look for similar functionality** in existing pages
3. **Consider extending** existing components vs creating new
4. **Update this documentation** when adding new reusable components

### **When Reusing Components:**
1. **Copy the complete structure** including dependencies
2. **Customize data sources** and API endpoints
3. **Maintain consistent styling** with existing patterns
4. **Test responsive behavior** across breakpoints
5. **Add auto-save functionality** for form components

### **Component Updates:**
- **Document changes** when modifying reusable components
- **Update all instances** when making breaking changes
- **Version control** critical component modifications
- **Test cross-page compatibility** after updates

---

**Last Updated:** August 2, 2025  
**Total Components:** 25+ reusable patterns identified  
**Coverage:** Admin interfaces, business templates, forms, data display  
**Status:** Ready for Business Manager integration