#!/usr/bin/env node

/**
 * RoseMastos to phoenix4ge Template Migration Tool
 * 
 * This script converts Flask/Jinja2 templates to our Node.js template engine format
 */

const fs = require('fs').promises;
const path = require('path');

class TemplateMigrator {
    constructor() {
        this.roseMastosPath = '/Users/programmer/Projects/rosemastos/app/templates';
        this.phoenix4gePath = '/Users/programmer/Projects/phoenix4ge/templates';
        
        // Template mapping - maps RoseMastos template names to phoenix4ge themes
        this.templateMapping = {
            // Glamour theme
            'index_glamour.html': { theme: 'glamour', page: 'index' },
            'about_glamour.html': { theme: 'glamour', page: 'about' },
            'contact_glamour.html': { theme: 'glamour', page: 'contact' },
            'rates_glamour.html': { theme: 'glamour', page: 'rates' },
            'calendar_glamour.html': { theme: 'glamour', page: 'calendar' },
            'etiquette_glamour.html': { theme: 'glamour', page: 'etiquette' },
            'faq_glamour.html': { theme: 'glamour', page: 'faq' },
            
            // Luxury theme
            'index_luxury.html': { theme: 'luxury', page: 'index' },
            'about_luxury.html': { theme: 'luxury', page: 'about' },
            'contact_luxury.html': { theme: 'luxury', page: 'contact' },
            'rates_luxury.html': { theme: 'luxury', page: 'rates' },
            'etiquette_luxury.html': { theme: 'luxury', page: 'etiquette' },
            'gallery_luxury.html': { theme: 'luxury', page: 'gallery' },
            
            // Basic/Standard theme
            'index.html': { theme: 'basic', page: 'index' },
            'about.html': { theme: 'basic', page: 'about' },
            'contact.html': { theme: 'basic', page: 'contact' },
            'gallery.html': { theme: 'basic', page: 'gallery' },
            'rates.html': { theme: 'basic', page: 'rates' },
            'calendar.html': { theme: 'basic', page: 'calendar' },
            'etiquette.html': { theme: 'basic', page: 'etiquette' }
        };
        
        // Syntax conversion rules
        this.conversionRules = [
            // Remove Jinja2 extends and blocks - we'll handle this differently
            { pattern: /{% extends [^%]*%}/g, replacement: '' },
            { pattern: /{% block [^%]*%}[\\s\\S]*?{% endblock %}/g, replacement: '' },
            
            // Convert Jinja2 conditionals to our format
            { pattern: /{% if ([^%]+) %}/g, replacement: '{{#if $1}}' },
            { pattern: /{% else %}/g, replacement: '{{else}}' },
            { pattern: /{% endif %}/g, replacement: '{{/if}}' },
            
            // Convert Jinja2 loops to our format  
            { pattern: /{% for ([^%]+) %}/g, replacement: '{{#each $1}}' },
            { pattern: /{% endfor %}/g, replacement: '{{/each}}' },
            
            // Convert Flask url_for to our URL structure
            { pattern: /url_for\\('static', filename=([^)]+)\\)/g, replacement: '/uploads/{{model.slug}}/$1' },
            { pattern: /get_model_image_path\\([^,]+, ([^)]+)\\)/g, replacement: '/uploads/{{model.slug}}/$1' },
            
            // Convert Flask functions
            { pattern: /get_current_model_slug\\(\\)/g, replacement: '{{model.slug}}' },
            
            // Convert variable syntax - this is tricky, need to be careful
            // Convert complex variable access
            { pattern: /{{ ([^}]+) if ([^}]+) else ([^}]+) }}/g, replacement: '{{#if $2}}{{$1}}{{else}}{{$3}}{{/if}}' },
            
            // Convert simple variable access (but preserve our converted conditionals)
            { pattern: /{{ (?!#|\/|else)([^}]+) }}/g, replacement: '{{$1}}' },
            
            // Clean up common Flask-specific patterns
            { pattern: /\\|safe/g, replacement: '' },
            { pattern: /\\|length/g, replacement: '.length' },
            
            // Convert color theme references
            { pattern: /color_theme\\./g, replacement: 'theme.colors.' },
            
            // Convert content references to match our data structure
            { pattern: /home_content\\./g, replacement: 'content.home.' },
            { pattern: /about_content\\./g, replacement: 'content.about.' },
            { pattern: /contact_content\\./g, replacement: 'content.contact.' },
            { pattern: /rates_content\\./g, replacement: 'content.rates.' },
            
            // Convert site settings
            { pattern: /site_settings\\./g, replacement: 'site_settings.' },
            
            // Clean up whitespace
            { pattern: /\\n\\s*\\n\\s*\\n/g, replacement: '\\n\\n' }
        ];
    }
    
    async migrate() {
        console.log('🔄 Starting RoseMastos → phoenix4ge Template Migration\\n');
        
        try {
            // Get list of templates to migrate
            const templates = Object.keys(this.templateMapping);
            
            for (const templateFile of templates) {
                await this.migrateTemplate(templateFile);
            }
            
            console.log('\\n✅ Migration completed successfully!');
            console.log('\\n📋 Next Steps:');
            console.log('1. Review migrated templates for any manual fixes needed');
            console.log('2. Test templates with your data structure');
            console.log('3. Adjust CSS classes and styling as needed');
            console.log('4. Update navigation components');
            
        } catch (error) {
            console.error('❌ Migration failed:', error);
        }
    }
    
    async migrateTemplate(templateFile) {
        const mapping = this.templateMapping[templateFile];
        const sourcePath = path.join(this.roseMastosPath, templateFile);
        const targetDir = path.join(this.phoenix4gePath, mapping.theme);
        const targetPath = path.join(targetDir, `${mapping.page}.html`);
        
        try {
            console.log(`🔄 Migrating ${templateFile} → ${mapping.theme}/${mapping.page}.html`);
            
            // Read source template
            const sourceContent = await fs.readFile(sourcePath, 'utf8');
            
            // Apply conversion rules
            let convertedContent = this.convertTemplate(sourceContent, mapping);
            
            // Add our template structure
            convertedContent = this.addTemplateStructure(convertedContent, mapping);
            
            // Ensure target directory exists
            await fs.mkdir(targetDir, { recursive: true });
            
            // Write converted template
            await fs.writeFile(targetPath, convertedContent, 'utf8');
            
            console.log(`  ✅ Created ${mapping.theme}/${mapping.page}.html`);
            
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log(`  ⚠️  Source template ${templateFile} not found, skipping`);
            } else {
                console.error(`  ❌ Error migrating ${templateFile}:`, error.message);
            }
        }
    }
    
    convertTemplate(content, mapping) {
        let converted = content;
        
        // Apply all conversion rules
        for (const rule of this.conversionRules) {
            converted = converted.replace(rule.pattern, rule.replacement);
        }
        
        // Theme-specific conversions
        if (mapping.theme === 'glamour') {
            converted = this.applyGlamourConversions(converted);
        } else if (mapping.theme === 'luxury') {
            converted = this.applyLuxuryConversions(converted);
        }
        
        return converted;
    }
    
    applyGlamourConversions(content) {
        // Glamour-specific color conversions
        return content
            .replace(/text-\\[{{ color_theme\\.primary_color }}\\]/g, 'text-glamour-primary')
            .replace(/bg-\\[{{ color_theme\\.primary_color }}\\]/g, 'bg-glamour-primary')
            .replace(/border-\\[{{ color_theme\\.primary_color }}\\]/g, 'border-glamour-primary');
    }
    
    applyLuxuryConversions(content) {
        // Luxury-specific color conversions
        return content
            .replace(/text-\\[{{ color_theme\\.primary_color }}\\]/g, 'text-luxury-primary')
            .replace(/bg-\\[{{ color_theme\\.primary_color }}\\]/g, 'bg-luxury-primary')
            .replace(/border-\\[{{ color_theme\\.primary_color }}\\]/g, 'border-luxury-primary');
    }
    
    addTemplateStructure(content, mapping) {
        // Remove any remaining Jinja2 block structure
        content = content.replace(/{% block [^%]*%}/g, '');
        content = content.replace(/{% endblock %}/g, '');
        content = content.replace(/{{ super\\(\\) }}/g, '');
        
        // Add our template structure
        const template = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{#if site_settings.site_name}}{{site_settings.site_name}}{{else}}{{model.name}}{{/if}}</title>
    <meta name="description" content="{{site_settings.meta_description}}">
    <meta name="og:title" content="{{site_settings.site_name}} - {{model.name}}">
    <meta name="og:description" content="{{site_settings.meta_description}}">
    <meta name="og:type" content="website">
    <meta name="og:image" content="{{site_settings.og_image}}">
    
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    <link href="https://unpkg.com/aos@2.3.1/dist/aos.css" rel="stylesheet">
    <script src="https://unpkg.com/aos@2.3.1/dist/aos.js"></script>
    
    <!-- Dynamic Theme Colors -->
    <link rel="stylesheet" href="/api/theme-custom/css/{{model.id}}" type="text/css">
    
    <style>
        /* ${mapping.theme.charAt(0).toUpperCase() + mapping.theme.slice(1)} Theme Styles */
        ${this.getThemeStyles(mapping.theme)}
    </style>
</head>
<body class="${this.getBodyClasses(mapping.theme)}">
    <!-- Navigation Component -->
    {{component "navigation" theme="${mapping.theme}" model=model navigation=navigation}}
    
    <!-- Page Content -->
    ${content}
    
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
        
        return template;
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
}

// Run migration if called directly
if (require.main === module) {
    const migrator = new TemplateMigrator();
    migrator.migrate();
}

module.exports = TemplateMigrator;