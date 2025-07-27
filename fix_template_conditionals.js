#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class TemplateConditionalFixer {
    constructor() {
        this.templatesDir = path.join(__dirname, 'templates');
        this.fixedCount = 0;
        this.errorCount = 0;
    }

    async run() {
        console.log('🔧 Fixing template conditional blocks...\n');
        
        const themes = ['basic', 'glamour', 'luxury'];
        
        for (const theme of themes) {
            console.log(`\n📁 Processing ${theme} theme templates...`);
            await this.processTheme(theme);
        }
        
        console.log(`\n✅ Template conditional fix complete!`);
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
        
        // Fix multiple else blocks
        content = this.fixMultipleElseBlocks(content);
        
        // Fix malformed conditionals
        content = this.fixMalformedConditionals(content);
        
        // Remove complex conditional chains
        content = this.simplifyComplexConditionals(content);
        
        // Clean up comments
        content = this.cleanupComments(content);
        
        // Write the fixed content
        fs.writeFileSync(filePath, content);
    }

    fixMultipleElseBlocks(content) {
        // Replace multiple else blocks with simplified structure
        content = content.replace(
            /\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g,
            (match, condition, content1, content2, content3, content4, content5) => {
                // Simplify to just use the first condition
                return `{{#if ${condition}}}${content1}{{else}}${content2}{{/if}}`;
            }
        );

        // Handle any remaining triple else blocks
        content = content.replace(
            /\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g,
            (match, condition, content1, content2, content3) => {
                return `{{#if ${condition}}}${content1}{{else}}${content2}{{/if}}`;
            }
        );

        return content;
    }

    fixMalformedConditionals(content) {
        // Fix broken conditional syntax
        content = content.replace(/\{\{#if\s+([^}]+)\s+==\s+([^}]+)\}\}/g, '{{#if $1}}');
        
        // Fix nested conditionals that are malformed
        content = content.replace(/\{\{#if\s+([^}]+)\s+and\s+([^}]+)\}\}/g, '{{#if $1}}{{#if $2}}');
        content = content.replace(/\{\{#if\s+([^}]+)\s+or\s+([^}]+)\}\}/g, '{{#if $1}}');
        
        return content;
    }

    simplifyComplexConditionals(content) {
        // Remove complex button logic and replace with simple structure
        const buttonLogicPattern = /\{\{!\s*Set\s+button_\d+_page[\s\S]*?\{\{\/if\}\}/g;
        content = content.replace(buttonLogicPattern, '');

        // Remove complex variable assignments
        content = content.replace(/\{\{!\s*Set\s+[^}]+\}\}/g, '');

        // Replace complex href patterns with simple ones
        content = content.replace(/href="\{\{button_\d+_url\}\}"/g, 'href="#"');

        // Replace missing button text with defaults
        content = content.replace(/>\{\{home_content\.hero_button_1\}\}</g, '>Learn More<');
        content = content.replace(/>\{\{home_content\.hero_button_2\}\}</g, '>Contact Me<');

        return content;
    }

    cleanupComments(content) {
        // Remove handlebars comments that might interfere with processing
        content = content.replace(/\{\{!\s*[^}]*\s*\}\}/g, '');
        
        return content;
    }
}

// Run the fixer if called directly
if (require.main === module) {
    const fixer = new TemplateConditionalFixer();
    fixer.run().catch(console.error);
}

module.exports = TemplateConditionalFixer;