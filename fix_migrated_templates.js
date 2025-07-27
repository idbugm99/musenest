#!/usr/bin/env node

/**
 * Template Syntax Fixer for Migrated RoseMastos Templates
 * 
 * This script fixes all the conversion issues from the initial migration
 */

const fs = require('fs').promises;
const path = require('path');

class TemplateFixer {
    constructor() {
        this.templatesPath = '/Users/programmer/Projects/musenest/templates';
        this.themes = ['glamour', 'luxury', 'basic'];
        
        // Advanced syntax fixes
        this.fixRules = [
            // Remove duplicate content and malformed blocks
            { pattern: /<!-- about_glamour\.html -->\s*/g, replacement: '' },
            { pattern: /<!-- .*?\.html -->\s*/g, replacement: '' },
            
            // Fix title duplication and malformed conditionals
            { pattern: /{{#if about_content}}{{about_content\.page_title}}{{else}}{{'About'}}{{\/if}} - {{#if current_model}}{{site_settings\.model_name if site_settings and site_settings\.model_name else \(current_model\.name}}{{else}}{{'Model Example'\)}}{{\/if}}/g, replacement: '' },
            
            // Remove malformed Jinja2 leftovers
            { pattern: /{{super\(\)}}/g, replacement: '' },
            { pattern: /{% elif [^%]*%}/g, replacement: '{{else}}' },
            { pattern: /{% else %}/g, replacement: '{{else}}' },
            
            // Fix complex conditionals - break them down
            { pattern: /{{#if ([^}]+) and ([^}]+)}}([^{]*?){{\/if}}/g, replacement: '{{#if $1}}{{#if $2}}$3{{/if}}{{/if}}' },
            { pattern: /{{#if ([^}]+) or ([^}]+)}}([^{]*?){{\/if}}/g, replacement: '{{#if $1}}$3{{else}}{{#if $2}}$3{{/if}}{{/if}}' },
            
            // Fix Python-style slicing and operators
            { pattern: /{{([^}]+)\[:\d+\]}}/g, replacement: '{{$1}}' },
            { pattern: /{{([^}]+)\.length > 0}}/g, replacement: '{{$1}}' },
            { pattern: /([^}]+) if ([^}]+) else ([^}]+)/g, replacement: '{{#if $2}}{{$1}}{{else}}{{$3}}{{/if}}' },
            
            // Fix URL and image references
            { pattern: /{{url_for\('static', filename=get_model_image_path\([^,]+, ([^)]+)\)\)}}/g, replacement: '/uploads/{{model.slug}}/{{$1}}' },
            { pattern: /url_for\('static', filename=([^)]+)\)/g, replacement: '/uploads/{{model.slug}}/$1' },
            { pattern: /get_model_image_path\([^,]+, ([^)]+)\)/g, replacement: '{{model.slug}}/{{$1}}' },
            
            // Fix variable references
            { pattern: /get_current_model_slug\(\)/g, replacement: '{{model.slug}}' },
            { pattern: /current_model\.name/g, replacement: 'model.name' },
            { pattern: /site_settings\.model_name/g, replacement: 'site_settings.model_name' },
            
            // Fix color theme references that weren't converted
            { pattern: /text-\[{{color_theme\.primary_color}}\]/g, replacement: 'text-glamour-primary' },
            { pattern: /bg-\[{{color_theme\.primary_color}}\]/g, replacement: 'bg-glamour-primary' },
            { pattern: /border-\[{{color_theme\.primary_color}}\]/g, replacement: 'border-glamour-primary' },
            
            // Fix image filename references
            { pattern: /{{([^}]+)\.filename}}/g, replacement: '{{$1}}' },
            
            // Clean up whitespace and empty lines
            { pattern: /\n\s*\n\s*\n/g, replacement: '\n\n' },
            { pattern: /^\s*\n/gm, replacement: '' }
        ];
        
        // Theme-specific color class mappings
        this.themeColorMappings = {
            glamour: {
                'text-glamour-primary': 'text-pink-500',
                'bg-glamour-primary': 'bg-pink-500', 
                'border-glamour-primary': 'border-pink-500'
            },
            luxury: {
                'text-luxury-primary': 'text-purple-600',
                'bg-luxury-primary': 'bg-purple-600',
                'border-luxury-primary': 'border-purple-600'
            },
            basic: {
                'text-basic-primary': 'text-blue-600',
                'bg-basic-primary': 'bg-blue-600',
                'border-basic-primary': 'border-blue-600'
            }
        };
    }
    
    async fixAllTemplates() {
        console.log('🔧 Starting Comprehensive Template Fix\n');
        
        try {
            for (const theme of this.themes) {
                await this.fixThemeTemplates(theme);
            }
            
            // Create theme-specific navigation components
            await this.createNavigationComponents();
            
            console.log('\n✅ All templates fixed successfully!');
            console.log('\n🧪 Test the themes:');
            console.log('curl http://localhost:3000/escortmodel/ (glamour theme)');
            console.log('curl http://localhost:3000/escortmodel/about');
            console.log('curl http://localhost:3000/escortmodel/gallery');
            
        } catch (error) {
            console.error('❌ Template fixing failed:', error);
        }
    }
    
    async fixThemeTemplates(theme) {
        const themePath = path.join(this.templatesPath, theme);
        
        try {
            const files = await fs.readdir(themePath);
            console.log(`🎨 Fixing ${theme} theme templates...`);
            
            for (const file of files) {
                if (file.endsWith('.html') && file !== 'index_with_nav.html') {
                    await this.fixTemplate(theme, file);
                }
            }
            
        } catch (error) {
            console.error(`Error fixing ${theme} theme:`, error.message);
        }
    }
    
    async fixTemplate(theme, filename) {
        const filePath = path.join(this.templatesPath, theme, filename);
        
        try {
            console.log(`  🔧 Fixing ${theme}/${filename}`);
            
            let content = await fs.readFile(filePath, 'utf8');
            
            // Apply all fix rules
            for (const rule of this.fixRules) {
                content = content.replace(rule.pattern, rule.replacement);
            }
            
            // Apply theme-specific fixes
            content = this.applyThemeSpecificFixes(content, theme);
            
            // Clean up and reconstruct template
            content = this.reconstructTemplate(content, theme, filename);
            
            await fs.writeFile(filePath, content, 'utf8');
            console.log(`    ✅ Fixed ${filename}`);
            
        } catch (error) {
            console.error(`    ❌ Error fixing ${filename}:`, error.message);
        }
    }
    
    applyThemeSpecificFixes(content, theme) {
        // Apply theme-specific color class replacements
        if (this.themeColorMappings[theme]) {
            const mappings = this.themeColorMappings[theme];
            for (const [searchClass, replaceClass] of Object.entries(mappings)) {
                const regex = new RegExp(searchClass.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
                content = content.replace(regex, replaceClass);
            }
        }
        
        // Fix theme-specific navigation references
        content = content.replace(
            /{{component "navigation" theme="[^"]*"/g, 
            `{{component "navigation" theme="${theme}"`
        );
        
        return content;
    }
    
    reconstructTemplate(content, theme, filename) {
        // Extract just the main content (everything after <!-- Page Content -->)
        const contentMatch = content.match(/<!-- Page Content -->\s*([\s\S]*?)(?:\s*<script>|\s*$)/);
        let mainContent = contentMatch ? contentMatch[1].trim() : content;
        
        // Remove any remaining template structure duplication
        mainContent = mainContent.replace(/<!DOCTYPE html>[\s\S]*?<body[^>]*>/g, '');
        mainContent = mainContent.replace(/<\/body>\s*<\/html>/g, '');
        
        // Clean up the main content
        mainContent = this.cleanupContent(mainContent);
        
        // Get page name from filename
        const pageName = filename.replace('.html', '');
        const pageTitle = this.getPageTitle(pageName);
        
        // Construct clean template
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${pageTitle} - {{site_settings.model_name}}</title>
    <meta name="description" content="{{site_settings.meta_description}}">
    <meta name="og:title" content="${pageTitle} - {{site_settings.model_name}}">
    <meta name="og:description" content="{{site_settings.meta_description}}">
    <meta name="og:type" content="website">
    <meta name="og:image" content="{{site_settings.og_image}}">
    
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    <link href="https://unpkg.com/aos@2.3.1/dist/aos.css" rel="stylesheet">
    <script src="https://unpkg.com/aos@2.3.1/dist/aos.js"></script>
    
    <!-- Dynamic Theme Colors -->
    <link rel="stylesheet" href="/api/theme-custom/css/{{model.id}}" type="text/css">
    
    <style>
        ${this.getThemeStyles(theme)}
    </style>
</head>
<body class="${this.getBodyClasses(theme)}">
    <!-- Navigation Component -->
    {{component "navigation" theme="${theme}" model=model navigation=navigation}}
    
    <!-- Page Content -->
    ${mainContent}
    
    <script>
        // Initialize AOS
        AOS.init({
            duration: 800,
            once: true,
            offset: 100
        });
    </script>
</body>
</html>`;
    }
    
    cleanupContent(content) {
        // Remove duplicate AOS script tags and other duplications
        content = content.replace(/<link[^>]*aos[^>]*>/g, '');
        content = content.replace(/<script[^>]*aos[^>]*>[\s\S]*?<\/script>/g, '');
        content = content.replace(/document\.addEventListener\('DOMContentLoaded'[\s\S]*?}\);/g, '');
        
        // Clean up image sources
        content = content.replace(/\/uploads\/{{model\.slug}}\/{{([^}]+)}}/g, '/uploads/{{model.slug}}/$1');
        
        // Fix remaining conditional syntax issues
        content = content.replace(/{{#if ([^}]+)}}{{#if ([^}]+)}}([\s\S]*?){{\/if}}{{\/if}}/g, '{{#if $1}}{{#if $2}}$3{{/if}}{{/if}}');
        
        return content.trim();
    }
    
    getPageTitle(pageName) {
        const titles = {
            index: 'Home',
            about: 'About',
            contact: 'Contact', 
            gallery: 'Gallery',
            rates: 'Rates & Services',
            calendar: 'Availability',
            etiquette: 'Etiquette',
            faq: 'FAQ'
        };
        return titles[pageName] || pageName.charAt(0).toUpperCase() + pageName.slice(1);
    }
    
    getThemeStyles(theme) {
        const styles = {
            glamour: `
        /* Glamour Theme Colors */
        :root {
            --glamour-primary: var(--color-primary, #EC4899);
            --glamour-secondary: var(--color-secondary, #BE185D);
            --glamour-accent: var(--color-accent, #F59E0B);
            --glamour-text: var(--color-text, #831843);
            --glamour-background: var(--color-background, #FDF2F8);
        }
        
        .text-glamour-primary { color: var(--glamour-primary); }
        .bg-glamour-primary { background-color: var(--glamour-primary); }
        .border-glamour-primary { border-color: var(--glamour-primary); }
        
        .glamour-gradient {
            background: linear-gradient(135deg, var(--glamour-primary) 0%, var(--glamour-secondary) 100%);
        }
        
        .luxury-grain::before {
            content: "";
            position: absolute;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background-image: url('/uploads/grain.png');
            opacity: 0.15;
            pointer-events: none;
        }
            `,
            luxury: `
        /* Luxury Theme Colors */
        :root {
            --luxury-primary: var(--color-primary, #7C3AED);
            --luxury-secondary: var(--color-secondary, #5B21B6);
            --luxury-accent: var(--color-accent, #F59E0B);
            --luxury-text: var(--color-text, #581C87);
            --luxury-background: var(--color-background, #FAF5FF);
        }
        
        .text-luxury-primary { color: var(--luxury-primary); }
        .bg-luxury-primary { background-color: var(--luxury-primary); }
        .border-luxury-primary { border-color: var(--luxury-primary); }
        
        .luxury-gradient {
            background: linear-gradient(135deg, var(--luxury-primary) 0%, var(--luxury-secondary) 100%);
        }
            `,
            basic: `
        /* Basic Theme Colors */
        :root {
            --basic-primary: var(--color-primary, #3B82F6);
            --basic-secondary: var(--color-secondary, #6B7280);
            --basic-accent: var(--color-accent, #10B981);
            --basic-text: var(--color-text, #1F2937);
            --basic-background: var(--color-background, #FFFFFF);
        }
        
        .text-basic-primary { color: var(--basic-primary); }
        .bg-basic-primary { background-color: var(--basic-primary); }
        .border-basic-primary { border-color: var(--basic-primary); }
            `
        };
        
        return styles[theme] || styles.basic;
    }
    
    getBodyClasses(theme) {
        const classes = {
            glamour: 'bg-glamour-background font-serif',
            luxury: 'bg-luxury-background font-serif', 
            basic: 'bg-basic-background font-sans'
        };
        
        return classes[theme] || classes.basic;
    }
    
    async createNavigationComponents() {
        console.log('\n🧭 Creating theme-specific navigation components...');
        
        for (const theme of this.themes) {
            await this.createNavigationComponent(theme);
        }
    }
    
    async createNavigationComponent(theme) {
        const componentDir = path.join(this.templatesPath, theme, 'components');
        const componentPath = path.join(componentDir, 'navigation.html');
        
        try {
            await fs.mkdir(componentDir, { recursive: true });
            
            const navigation = this.generateNavigationComponent(theme);
            await fs.writeFile(componentPath, navigation, 'utf8');
            
            console.log(`  ✅ Created ${theme}/components/navigation.html`);
            
        } catch (error) {
            console.error(`  ❌ Error creating ${theme} navigation:`, error.message);
        }
    }
    
    generateNavigationComponent(theme) {
        const themeConfig = {
            glamour: {
                navClass: 'bg-gradient-to-r from-pink-900 via-pink-800 to-pink-900 shadow-lg',
                textClass: 'text-pink-100',
                hoverClass: 'hover:text-pink-300',
                buttonClass: 'bg-pink-600 hover:bg-pink-700'
            },
            luxury: {
                navClass: 'bg-gradient-to-r from-purple-900 via-purple-800 to-purple-900 shadow-lg',
                textClass: 'text-purple-100', 
                hoverClass: 'hover:text-purple-300',
                buttonClass: 'bg-purple-600 hover:bg-purple-700'
            },
            basic: {
                navClass: 'bg-white shadow-sm border-b',
                textClass: 'text-gray-900',
                hoverClass: 'hover:text-blue-600',
                buttonClass: 'bg-blue-600 hover:bg-blue-700'
            }
        };
        
        const config = themeConfig[theme] || themeConfig.basic;
        
        return `<!-- ${theme.charAt(0).toUpperCase() + theme.slice(1)} Theme Navigation -->
<nav class="${config.navClass}">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
            <!-- Logo/Brand -->
            <div class="flex items-center">
                <a href="/{{model.slug}}" class="text-2xl font-light ${config.textClass} ${config.hoverClass} transition-colors">
                    {{site_settings.model_name}}
                </a>
            </div>
            
            <!-- Desktop Menu -->
            <div class="hidden md:flex items-center space-x-8">
                {{#each navigation.nav_items}}
                <a href="/{{../model.slug}}/{{this.path}}" 
                   class="${config.textClass} ${config.hoverClass} transition-colors font-medium px-3 py-2 rounded-lg hover:bg-black hover:bg-opacity-10">
                    {{this.name}}
                </a>
                {{/each}}
            </div>
            
            <!-- Mobile Menu Button -->
            <div class="md:hidden">
                <button type="button" 
                        class="${config.textClass} ${config.hoverClass} focus:outline-none transition-colors"
                        onclick="toggleMobileMenu()">
                    <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
            </div>
        </div>
    </div>
    
    <!-- Mobile Menu -->
    <div id="mobileMenu" class="md:hidden hidden bg-black bg-opacity-95 backdrop-blur-md border-t border-white border-opacity-20">
        <div class="px-2 pt-2 pb-3 space-y-1">
            {{#each navigation.nav_items}}
            <a href="/{{../model.slug}}/{{this.path}}" 
               class="block px-3 py-2 ${config.textClass} ${config.hoverClass} transition-colors font-medium rounded-lg hover:bg-white hover:bg-opacity-10">
                {{this.name}}
            </a>
            {{/each}}
        </div>
    </div>
</nav>

<script>
function toggleMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    if (menu.classList.contains('hidden')) {
        menu.classList.remove('hidden');
    } else {
        menu.classList.add('hidden');
    }
}

// Close mobile menu when clicking outside
document.addEventListener('click', function(event) {
    const menu = document.getElementById('mobileMenu');
    const button = event.target.closest('button');
    
    if (!menu.contains(event.target) && !button) {
        menu.classList.add('hidden');
    }
});
</script>`;
    }
}

// Run fixer if called directly
if (require.main === module) {
    const fixer = new TemplateFixer();
    fixer.fixAllTemplates();
}

module.exports = TemplateFixer;