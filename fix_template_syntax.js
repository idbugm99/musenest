#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class TemplateSyntaxFixer {
    constructor() {
        this.templatesDir = path.join(__dirname, 'templates');
        this.fixedCount = 0;
        this.errorCount = 0;
    }

    async run() {
        console.log('🔧 Starting comprehensive template syntax fix...\n');
        
        const themes = ['glamour', 'luxury', 'basic'];
        
        for (const theme of themes) {
            console.log(`\n📁 Processing ${theme} theme templates...`);
            await this.processTheme(theme);
        }
        
        console.log(`\n✅ Template syntax fix complete!`);
        console.log(`   Fixed: ${this.fixedCount} templates`);
        console.log(`   Errors: ${this.errorCount} templates`);
    }

    async processTheme(theme) {
        const themeDir = path.join(this.templatesDir, theme);
        
        if (!fs.existsSync(themeDir)) {
            console.log(`   ⚠️  Theme directory ${theme} not found`);
            return;
        }

        const files = fs.readdirSync(themeDir).filter(f => f.endsWith('.html'));
        
        for (const file of files) {
            const filePath = path.join(themeDir, file);
            console.log(`   🔄 Fixing ${file}...`);
            
            try {
                await this.fixTemplate(filePath, theme, file);
                this.fixedCount++;
                console.log(`   ✅ Fixed ${file}`);
            } catch (error) {
                console.error(`   ❌ Error fixing ${file}:`, error.message);
                this.errorCount++;
            }
        }
    }

    async fixTemplate(filePath, theme, filename) {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Apply comprehensive fixes
        content = this.fixBrokenConditionals(content);
        content = this.fixVariableReferences(content);
        content = this.fixJinja2Syntax(content);
        content = this.removeDuplicateContent(content, theme, filename);
        content = this.fixTemplateStructure(content, theme, filename);
        content = this.addMissingContent(content, theme, filename);
        
        // Write the fixed content
        fs.writeFileSync(filePath, content);
    }

    fixBrokenConditionals(content) {
        // Fix broken nested conditionals
        content = content.replace(/{{#if site_settings and site_settings\.model_name}}{{{{site_settings\.model_name}}{{else}}{{.*?}}{{\/if}}}}/g, 
            '{{#if site_settings.model_name}}{{site_settings.model_name}}{{else}}{{model.name}}{{/if}}');
        
        // Fix parentheses in conditionals
        content = content.replace(/{{.*?\(\(.*?\)\).*?}}/g, (match) => {
            return match.replace(/\(\(([^)]+)\)\)/g, '$1');
        });
        
        // Fix malformed if conditions
        content = content.replace(/{{#if current_model}}{{#if site_settings and site_settings\.model_name}}{{{{site_settings\.model_name}}{{else}}{{.*?}}{{\/if}}}}{{else}}{{'.*?'}}{{\/if}}/g,
            '{{#if site_settings.model_name}}{{site_settings.model_name}}{{else}}{{#if model.name}}{{model.name}}{{else}}Model Example{{/if}}{{/if}}');
        
        return content;
    }

    fixVariableReferences(content) {
        // Fix broken variable syntax
        content = content.replace(/{{{{([^}]+)}}}/g, '{{$1}}');
        content = content.replace(/{{([^}]+)}}/g, (match, variable) => {
            // Clean up complex variable references
            if (variable.includes('and') || variable.includes('or')) {
                return match; // Keep complex conditionals as-is
            }
            return `{{${variable.trim()}}}`;
        });
        
        return content;
    }

    fixJinja2Syntax(content) {
        // Fix remaining Jinja2 for loops
        content = content.replace(/{%\s*set\s+([^%]+)\s*%}/g, '{{! Set $1 }}');
        content = content.replace(/{%\s*for\s+([^%]+)\s*%}/g, '{{#each $1}}');
        content = content.replace(/{%\s*endfor\s*%}/g, '{{/each}}');
        
        // Fix Python-style string formatting
        content = content.replace(/'%04d-%02d-%02d'\|format\([^)]+\)/g, 'formatted_date');
        
        // Fix Python method calls
        content = content.replace(/\|\.length/g, '.length');
        content = content.replace(/([^}]+)\|title/g, '$1');
        
        return content;
    }

    removeDuplicateContent(content, theme, filename) {
        // Remove duplicate meta tags
        const metaTags = content.match(/<meta[^>]*>/g);
        if (metaTags && metaTags.length > 10) {
            // Find the end of the first head section
            const firstHeadEnd = content.indexOf('</head>');
            if (firstHeadEnd > 0) {
                const beforeHead = content.substring(0, firstHeadEnd + 7);
                const afterHead = content.substring(firstHeadEnd + 7);
                
                // Remove duplicate meta tags from the body
                const cleanedAfterHead = afterHead.replace(/<meta[^>]*>/g, '');
                content = beforeHead + cleanedAfterHead;
            }
        }
        
        // Remove duplicate style blocks
        const styleBlocks = content.match(/<style[^>]*>[\s\S]*?<\/style>/g);
        if (styleBlocks && styleBlocks.length > 1) {
            // Keep only the first comprehensive style block
            let hasMainStyle = false;
            content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/g, (match) => {
                if (!hasMainStyle && match.includes('Theme Colors')) {
                    hasMainStyle = true;
                    return match;
                }
                return '';
            });
        }
        
        return content;
    }

    fixTemplateStructure(content, theme, filename) {
        // Ensure proper HTML5 structure
        if (!content.includes('<!DOCTYPE html>')) {
            content = '<!DOCTYPE html>\n' + content;
        }
        
        // Fix page content placeholders
        const pageTitle = filename.replace('.html', '').charAt(0).toUpperCase() + filename.replace('.html', '').slice(1);
        const simpleContent = `
    <!-- ${pageTitle} Page Content -->
    <section class="py-16 ${this.getThemeBackground(theme)}">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="text-center mb-12">
                <h1 class="text-4xl font-bold mb-6 ${this.getThemeText(theme)}">${pageTitle}</h1>
                <p class="text-xl ${this.getThemeSecondaryText(theme)} max-w-3xl mx-auto">
                    Welcome to the ${pageTitle.toLowerCase()} page.
                </p>
            </div>
            
            <div class="text-center">
                <p class="text-lg ${this.getThemeSecondaryText(theme)} mb-8">
                    Content for this page will be managed through the admin interface.
                </p>
                <a href="/{{model.slug}}/contact" class="${this.getThemeButton(theme)}">
                    Contact Me
                </a>
            </div>
        </div>
    </section>`;
        
        // Replace placeholder content with proper structured content
        if (content.includes('<!-- Page Content -->') && 
            !content.includes('<section') && 
            !content.includes('py-16')) {
            content = content.replace(
                /<!-- Page Content -->[\s\S]*?<script>/,
                simpleContent + '\n    \n    <script>'
            );
        }
        
        return content;
    }

    addMissingContent(content, theme, filename) {
        // Ensure AOS initialization is present
        if (!content.includes('AOS.init')) {
            const aosScript = `
    <script>
        // Initialize AOS
        AOS.init({
            duration: 800,
            once: true,
            offset: 100
        });
    </script>`;
            
            if (content.includes('</body>')) {
                content = content.replace('</body>', aosScript + '\n</body>');
            }
        }
        
        return content;
    }

    getThemeBackground(theme) {
        const backgrounds = {
            glamour: 'bg-glamour-background',
            luxury: 'bg-black relative',
            basic: 'bg-white'
        };
        return backgrounds[theme] || 'bg-white';
    }

    getThemeText(theme) {
        const textColors = {
            glamour: 'text-glamour-primary',
            luxury: 'text-white',
            basic: 'text-basic-primary'
        };
        return textColors[theme] || 'text-gray-900';
    }

    getThemeSecondaryText(theme) {
        const textColors = {
            glamour: 'text-glamour-text',
            luxury: 'text-gray-300',
            basic: 'text-gray-600'
        };
        return textColors[theme] || 'text-gray-600';
    }

    getThemeButton(theme) {
        const buttons = {
            glamour: 'bg-glamour-primary text-white px-8 py-3 rounded-lg font-semibold hover:bg-opacity-90 transition-colors',
            luxury: 'bg-white text-black px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors',
            basic: 'bg-basic-primary text-white px-8 py-3 rounded-lg font-semibold hover:bg-opacity-90 transition-colors'
        };
        return buttons[theme] || 'bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors';
    }
}

// Run the fixer if called directly
if (require.main === module) {
    const fixer = new TemplateSyntaxFixer();
    fixer.run().catch(console.error);
}

module.exports = TemplateSyntaxFixer;