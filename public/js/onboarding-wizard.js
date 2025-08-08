class OnboardingWizard {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 4;
        this.selectedData = {
            businessType: null,
            pageSet: null,
            theme: null,
            modelInfo: {}
        };
        this.init();
    }

    init() {
        this.loadBusinessTypes();
        this.setupEventListeners();
        this.updateStepIndicator();
    }

    setupEventListeners() {
        // Step navigation
        document.getElementById('nextStep')?.addEventListener('click', () => this.nextStep());
        document.getElementById('prevStep')?.addEventListener('click', () => this.prevStep());
        
        // Form submission
        document.getElementById('completeOnboarding')?.addEventListener('click', () => this.completeOnboarding());
    }

    async loadBusinessTypes() {
        try {
            const response = await sysFetch('/api/onboarding/business-types');
            const data = await response.json();
            
            if (data.success) {
                this.renderBusinessTypes(data.data);
            }
        } catch (error) {
            console.error('Error loading business types:', error);
        }
    }

    renderBusinessTypes(businessTypes) {
        const container = document.getElementById('businessTypesContainer');
        if (!container) return;

        const groupedTypes = businessTypes.reduce((groups, type) => {
            const category = type.category;
            if (!groups[category]) groups[category] = [];
            groups[category].push(type);
            return groups;
        }, {});

        let html = '';
        for (const [category, types] of Object.entries(groupedTypes)) {
            html += `
                <div class="mb-8">
                    <h3 class="text-lg font-semibold mb-4 capitalize text-gray-700">${category}</h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            `;
            
            types.forEach(type => {
                const warningBadge = type.age_verification_required 
                    ? '<span class="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">18+ Required</span>'
                    : '';
                
                html += `
                    <div class="business-type-card border-2 border-gray-200 rounded-lg p-4 cursor-pointer hover:border-blue-400 transition-colors" 
                         data-type-id="${type.id}" data-type-name="${type.name}">
                        <div class="flex justify-between items-start mb-2">
                            <h4 class="font-semibold text-gray-900">${type.display_name}</h4>
                            ${warningBadge}
                        </div>
                        <p class="text-gray-600 text-sm">${type.description}</p>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = html;
        
        // Add click handlers
        container.querySelectorAll('.business-type-card').forEach(card => {
            card.addEventListener('click', () => this.selectBusinessType(card));
        });
    }

    selectBusinessType(card) {
        // Remove previous selection
        document.querySelectorAll('.business-type-card').forEach(c => {
            c.classList.remove('border-blue-500', 'bg-blue-50');
        });
        
        // Select this card
        card.classList.add('border-blue-500', 'bg-blue-50');
        
        const displayName = card.querySelector('h4').textContent;
        this.selectedData.businessType = {
            id: card.dataset.typeId,
            name: card.dataset.typeName,
            displayName: displayName
        };
        
        // Update summary
        this.updateSummary();
        
        document.getElementById('nextStep').disabled = false;
    }

    async loadPageSets(businessTypeId) {
        try {
            const response = await sysFetch(`/api/onboarding/page-sets/${businessTypeId}`);
            const data = await response.json();
            
            if (data.success) {
                this.renderPageSets(data.data);
            }
        } catch (error) {
            console.error('Error loading page sets:', error);
        }
    }

    renderPageSets(pageSets) {
        const container = document.getElementById('pageSetsContainer');
        if (!container) return;

        let html = '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">';
        
        pageSets.forEach(pageSet => {
            // included_pages and features are already parsed from JSON by the API
            const pages = Array.isArray(pageSet.included_pages) ? pageSet.included_pages : JSON.parse(pageSet.included_pages);
            const features = pageSet.features ? (Array.isArray(pageSet.features) ? pageSet.features : JSON.parse(pageSet.features)) : [];
            
            const tierColor = {
                'basic': 'bg-green-100 text-green-800',
                'professional': 'bg-blue-100 text-blue-800',
                'premium': 'bg-purple-100 text-purple-800',
                'enterprise': 'bg-gray-100 text-gray-800'
            }[pageSet.tier] || 'bg-gray-100 text-gray-800';
            
            html += `
                <div class="page-set-card border-2 border-gray-200 rounded-lg p-6 cursor-pointer hover:border-blue-400 transition-colors"
                     data-set-id="${pageSet.id}" data-set-name="${pageSet.name}">
                    <div class="flex justify-between items-start mb-3">
                        <h4 class="font-semibold text-gray-900">${pageSet.display_name}</h4>
                        <span class="text-xs px-2 py-1 rounded-full ${tierColor}">${pageSet.tier}</span>
                    </div>
                    <p class="text-gray-600 text-sm mb-4">${pageSet.description}</p>
                    
                    <div class="mb-4">
                        <h5 class="font-medium text-gray-700 mb-2">Included Pages (${pages.length}):</h5>
                        <div class="flex flex-wrap gap-1">
                            ${pages.map(page => 
                                `<span class="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">${page}</span>`
                            ).join('')}
                        </div>
                    </div>
                    
                    ${features.length > 0 ? `
                        <div>
                            <h5 class="font-medium text-gray-700 mb-2">Features:</h5>
                            <div class="flex flex-wrap gap-1">
                                ${features.map(feature => 
                                    `<span class="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded">${feature.replace(/_/g, ' ')}</span>`
                                ).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
        
        // Add click handlers
        container.querySelectorAll('.page-set-card').forEach(card => {
            card.addEventListener('click', () => this.selectPageSet(card));
        });
    }

    selectPageSet(card) {
        // Remove previous selection
        document.querySelectorAll('.page-set-card').forEach(c => {
            c.classList.remove('border-blue-500', 'bg-blue-50');
        });
        
        // Select this card
        card.classList.add('border-blue-500', 'bg-blue-50');
        
        const displayName = card.querySelector('h4').textContent;
        this.selectedData.pageSet = {
            id: card.dataset.setId,
            name: card.dataset.setName,
            displayName: displayName
        };
        
        // Update summary
        this.updateSummary();
        
        document.getElementById('nextStep').disabled = false;
    }

    async loadThemes(businessTypeId) {
        try {
            const response = await sysFetch(`/api/onboarding/themes/${businessTypeId}`);
            const data = await response.json();
            
            if (data.success) {
                this.renderThemes(data.data);
            }
        } catch (error) {
            console.error('Error loading themes:', error);
        }
    }

    renderThemes(themeData) {
        const container = document.getElementById('themesContainer');
        if (!container) return;

        let html = '';
        
        // Industry-specific themes first
        if (themeData.industry_specific.length > 0) {
            html += `
                <div class="mb-8">
                    <h3 class="text-lg font-semibold mb-4 text-gray-700">Optimized for Your Industry</h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            `;
            
            themeData.industry_specific.forEach(theme => {
                html += this.renderThemeCard(theme, true);
            });
            
            html += '</div></div>';
        }
        
        // Universal themes
        if (themeData.universal.length > 0) {
            html += `
                <div class="mb-8">
                    <h3 class="text-lg font-semibold mb-4 text-gray-700">Universal Themes</h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            `;
            
            themeData.universal.forEach(theme => {
                html += this.renderThemeCard(theme, false);
            });
            
            html += '</div></div>';
        }
        
        container.innerHTML = html;
        
        // Add click handlers
        container.querySelectorAll('.theme-card').forEach(card => {
            card.addEventListener('click', () => this.selectTheme(card));
        });
    }

    renderThemeCard(theme, isIndustrySpecific) {
        // default_color_scheme is already parsed from JSON by the API
        const colorScheme = typeof theme.default_color_scheme === 'object' ? theme.default_color_scheme : JSON.parse(theme.default_color_scheme);
        const badge = isIndustrySpecific 
            ? '<span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Optimized</span>'
            : '<span class="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">Universal</span>';
        
        return `
            <div class="theme-card border-2 border-gray-200 rounded-lg p-4 cursor-pointer hover:border-blue-400 transition-colors"
                 data-theme-id="${theme.id}" data-theme-name="${theme.name}">
                <div class="flex justify-between items-start mb-3">
                    <h4 class="font-semibold text-gray-900">${theme.display_name}</h4>
                    ${badge}
                </div>
                <p class="text-gray-600 text-sm mb-4">${theme.description}</p>
                
                <!-- Color preview -->
                <div class="flex space-x-2 mb-3">
                    <div class="w-6 h-6 rounded-full border border-gray-300" style="background-color: ${colorScheme.primary}"></div>
                    <div class="w-6 h-6 rounded-full border border-gray-300" style="background-color: ${colorScheme.secondary}"></div>
                    <div class="w-6 h-6 rounded-full border border-gray-300" style="background-color: ${colorScheme.accent}"></div>
                </div>
                
                <span class="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">${theme.category}</span>
            </div>
        `;
    }

    selectTheme(card) {
        // Remove previous selection
        document.querySelectorAll('.theme-card').forEach(c => {
            c.classList.remove('border-blue-500', 'bg-blue-50');
        });
        
        // Select this card
        card.classList.add('border-blue-500', 'bg-blue-50');
        
        const displayName = card.querySelector('h4').textContent;
        this.selectedData.theme = {
            id: card.dataset.themeId,
            name: card.dataset.themeName,
            displayName: displayName
        };
        
        // Update summary
        this.updateSummary();
        
        document.getElementById('nextStep').disabled = false;
    }

    nextStep() {
        if (this.currentStep < this.totalSteps) {
            // Hide current step
            document.getElementById(`step${this.currentStep}`).classList.add('hidden');
            
            this.currentStep++;
            
            // Show next step
            document.getElementById(`step${this.currentStep}`).classList.remove('hidden');
            
            // Load data for the new step
            if (this.currentStep === 2) {
                this.loadPageSets(this.selectedData.businessType.id);
            } else if (this.currentStep === 3) {
                this.loadThemes(this.selectedData.businessType.id);
            }
            
            this.updateStepIndicator();
            this.updateButtons();
        }
    }

    prevStep() {
        if (this.currentStep > 1) {
            // Hide current step
            document.getElementById(`step${this.currentStep}`).classList.add('hidden');
            
            this.currentStep--;
            
            // Show previous step
            document.getElementById(`step${this.currentStep}`).classList.remove('hidden');
            
            this.updateStepIndicator();
            this.updateButtons();
        }
    }

    updateStepIndicator() {
        for (let i = 1; i <= this.totalSteps; i++) {
            const indicator = document.getElementById(`stepIndicator${i}`);
            if (indicator) {
                if (i < this.currentStep) {
                    indicator.className = 'w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-semibold';
                } else if (i === this.currentStep) {
                    indicator.className = 'w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-semibold';
                } else {
                    indicator.className = 'w-8 h-8 rounded-full bg-gray-300 text-gray-600 flex items-center justify-center text-sm font-semibold';
                }
            }
        }
    }

    updateButtons() {
        const nextBtn = document.getElementById('nextStep');
        const prevBtn = document.getElementById('prevStep');
        const completeBtn = document.getElementById('completeOnboarding');
        
        if (prevBtn) prevBtn.style.display = this.currentStep === 1 ? 'none' : 'inline-block';
        if (nextBtn) nextBtn.style.display = this.currentStep === this.totalSteps ? 'none' : 'inline-block';
        if (completeBtn) completeBtn.style.display = this.currentStep === this.totalSteps ? 'inline-block' : 'none';
        
        // Disable next button until selection is made
        if (nextBtn) nextBtn.disabled = true;
    }

    updateSummary() {
        // Update summary display on step 4
        const summaryIndustry = document.getElementById('summaryIndustry');
        const summaryPageSet = document.getElementById('summaryPageSet');
        const summaryTheme = document.getElementById('summaryTheme');
        
        if (summaryIndustry && this.selectedData.businessType) {
            summaryIndustry.textContent = this.selectedData.businessType.displayName || '-';
        }
        
        if (summaryPageSet && this.selectedData.pageSet) {
            summaryPageSet.textContent = this.selectedData.pageSet.displayName || '-';
        }
        
        if (summaryTheme && this.selectedData.theme) {
            summaryTheme.textContent = this.selectedData.theme.displayName || '-';
        }
    }

    async completeOnboarding() {
        // Get all form values
        const modelName = document.getElementById('modelName').value;
        const slug = document.getElementById('slug').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const phone = document.getElementById('phone').value;
        const contactEmail = document.getElementById('contactEmail').value;
        const secondaryPhone = document.getElementById('secondaryPhone').value;
        const preferredContact = document.getElementById('preferredContact').value;
        const dateOfBirth = document.getElementById('dateOfBirth').value;
        const nationality = document.getElementById('nationality').value;
        const currentLocation = document.getElementById('currentLocation').value;
        const referralCode = document.getElementById('referralCode').value;

        // Validate required fields
        if (!modelName || !slug || !email || !password) {
            alert('Please fill in all required fields (Name, URL, Email, and Password)');
            return;
        }

        // Basic password validation
        if (password.length < 8) {
            alert('Password must be at least 8 characters long');
            return;
        }

        try {
            const response = await sysFetch('/api/onboarding/complete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model_name: modelName,
                    slug: slug,
                    business_type_id: this.selectedData.businessType.id,
                    page_set_id: this.selectedData.pageSet.id,
                    theme_set_id: this.selectedData.theme.id,
                    email: email,
                    password: password,
                    phone: phone,
                    contact_email: contactEmail,
                    secondary_phone: secondaryPhone,
                    preferred_contact_method: preferredContact,
                    date_of_birth: dateOfBirth,
                    nationality: nationality,
                    current_location: currentLocation,
                    referral_code_used: referralCode,
                    client_type: 'muse_owned',
                    status: 'trial'
                })
            });

            const data = await response.json();
            
            if (data.success) {
                // Show detailed success message
                let successMessage = `🎉 Welcome to MuseNest!\n\n`;
                successMessage += `✅ Your account has been created successfully\n`;
                successMessage += `🌐 Website URL: ${data.data.website_url}\n`;
                successMessage += `📧 Login Email: ${data.data.email}\n`;
                successMessage += `🔐 Account Password: ${data.data.default_password}\n`;
                successMessage += `📱 Account Number: ${data.data.account_number}\n\n`;
                
                if (data.data.referral_processed) {
                    successMessage += `🎁 Referral code applied successfully!\n\n`;
                }
                
                successMessage += `You can now:\n`;
                successMessage += `• Login to your account at: ${data.data.login_url}\n`;
                successMessage += `• Customize your website settings\n`;
                successMessage += `• Upload photos and content\n`;
                successMessage += `• Start building your online presence\n\n`;
                successMessage += `Click OK to access your dashboard!`;
                
                alert(successMessage);
                window.location.href = '/admin/business-management.html';
            } else {
                alert('Error: ' + data.error);
            }
        } catch (error) {
            console.error('Error completing onboarding:', error);
            alert('An error occurred. Please try again.');
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new OnboardingWizard();
});