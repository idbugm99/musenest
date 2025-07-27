#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class CleanTemplateCreator {
    constructor() {
        this.templatesDir = path.join(__dirname, 'templates');
        this.createdCount = 0;
    }

    async run() {
        console.log('🔧 Creating clean, functional templates...\n');
        
        const themes = ['basic', 'glamour', 'luxury'];
        const pages = ['index', 'about', 'contact', 'gallery'];
        
        for (const theme of themes) {
            console.log(`\n📁 Creating ${theme} theme templates...`);
            await this.ensureThemeDirectory(theme);
            
            for (const page of pages) {
                await this.createTemplate(theme, page);
                this.createdCount++;
                console.log(`   ✅ Created ${page}.html for ${theme} theme`);
            }
        }
        
        console.log(`\n✅ Clean template creation complete! Created ${this.createdCount} templates.`);
    }

    async ensureThemeDirectory(theme) {
        const themeDir = path.join(this.templatesDir, theme);
        if (!fs.existsSync(themeDir)) {
            fs.mkdirSync(themeDir, { recursive: true });
        }
    }

    async createTemplate(theme, page) {
        const filePath = path.join(this.templatesDir, theme, `${page}.html`);
        const content = this.generateTemplate(theme, page);
        fs.writeFileSync(filePath, content);
    }

    generateTemplate(theme, page) {
        const pageTitle = page.charAt(0).toUpperCase() + page.slice(1);
        const title = page === 'index' ? 'Home' : pageTitle;
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - {{site_settings.model_name}}</title>
    <meta name="description" content="{{site_settings.meta_description}}">
    <meta name="og:title" content="${title} - {{site_settings.model_name}}">
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
<body class="${this.getBodyClass(theme)}">
    <!-- Navigation Component -->
    {{component "navigation" theme="${theme}" model=model navigation=navigation}}
    
    <!-- ${pageTitle} Page Content -->
    ${this.getPageContent(theme, page)}
    
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

    getThemeStyles(theme) {
        const styles = {
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
        .border-basic-primary { border-color: var(--basic-primary); }`,
            
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
        }`,
            
            luxury: `
        /* Luxury Theme Colors */
        :root {
            --luxury-primary: var(--color-primary, #D4AF37);
            --luxury-secondary: var(--color-secondary, #1A1A1A);
            --luxury-accent: var(--color-accent, #FFD700);
            --luxury-text: var(--color-text, #FFFFFF);
            --luxury-background: var(--color-background, #000000);
        }
        
        .text-luxury-primary { color: var(--luxury-primary); }
        .bg-luxury-primary { background-color: var(--luxury-primary); }
        .border-luxury-primary { border-color: var(--luxury-primary); }
        
        .luxury-grain::before {
            content: "";
            position: absolute;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background-image: url('/uploads/grain.png');
            opacity: 0.15;
            pointer-events: none;
        }`
        };
        
        return styles[theme] || styles.basic;
    }

    getBodyClass(theme) {
        const classes = {
            basic: 'bg-basic-background font-sans',
            glamour: 'bg-glamour-background font-serif',
            luxury: 'bg-luxury-background font-serif text-luxury-text'
        };
        
        return classes[theme] || classes.basic;
    }

    getPageContent(theme, page) {
        const contents = {
            index: this.getHomeContent(theme),
            about: this.getAboutContent(theme),
            contact: this.getContactContent(theme),
            gallery: this.getGalleryContent(theme)
        };
        
        return contents[page] || this.getDefaultContent(theme, page);
    }

    getHomeContent(theme) {
        const primaryClass = `${theme}-primary`;
        const textClass = `${theme}-text`;
        
        return `<section class="py-16 bg-gradient-to-r from-${primaryClass} to-accent text-white">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="text-center">
                <h1 class="text-4xl md:text-6xl font-bold mb-6">
                    {{site_settings.model_name}}
                </h1>
                <p class="text-xl md:text-2xl mb-8 max-w-3xl mx-auto">
                    {{site_settings.tagline}}
                </p>
                <div class="space-x-4">
                    <a href="/{{model.slug}}/contact" class="bg-white text-${primaryClass} px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
                        Contact Me
                    </a>
                    <a href="/{{model.slug}}/gallery" class="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-${primaryClass} transition-colors">
                        View Gallery
                    </a>
                </div>
            </div>
        </div>
    </section>`;
    }

    getAboutContent(theme) {
        const primaryClass = `${theme}-primary`;
        const textClass = `${theme}-text`;
        
        return `<section class="py-16">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="text-center mb-12">
                <h1 class="text-4xl font-bold mb-6 text-${primaryClass}">About {{site_settings.model_name}}</h1>
                <p class="text-xl text-${textClass} max-w-3xl mx-auto">
                    Learn more about my background and services
                </p>
            </div>
            
            <div class="grid md:grid-cols-2 gap-12 items-center">
                <div>
                    <h2 class="text-2xl font-bold mb-4 text-${primaryClass}">Professional Services</h2>
                    <p class="text-lg text-${textClass} mb-6">
                        I provide professional companion services with complete discretion and elegance.
                    </p>
                    <p class="text-lg text-${textClass} mb-6">
                        Experience sophistication and genuine connection in every interaction.
                    </p>
                    <a href="/{{model.slug}}/contact" class="bg-${primaryClass} text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity">
                        Get In Touch
                    </a>
                </div>
                <div class="bg-gray-200 h-96 rounded-lg flex items-center justify-center">
                    <span class="text-gray-500">Professional Photo</span>
                </div>
            </div>
        </div>
    </section>`;
    }

    getContactContent(theme) {
        const primaryClass = `${theme}-primary`;
        const textClass = `${theme}-text`;
        
        return `<section class="py-16">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="text-center mb-12">
                <h1 class="text-4xl font-bold mb-6 text-${primaryClass}">Contact {{site_settings.model_name}}</h1>
                <p class="text-xl text-${textClass} max-w-3xl mx-auto">
                    Ready to arrange a meeting? Get in touch today.
                </p>
            </div>
            
            <div class="max-w-2xl mx-auto">
                <form class="space-y-6">
                    <div>
                        <label class="block text-sm font-medium text-${textClass} mb-2">Name</label>
                        <input type="text" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${primaryClass} focus:border-transparent">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-${textClass} mb-2">Email</label>
                        <input type="email" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${primaryClass} focus:border-transparent">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-${textClass} mb-2">Message</label>
                        <textarea rows="6" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${primaryClass} focus:border-transparent"></textarea>
                    </div>
                    <button type="submit" class="w-full bg-${primaryClass} text-white py-3 px-6 rounded-lg font-semibold hover:opacity-90 transition-opacity">
                        Send Message
                    </button>
                </form>
            </div>
        </div>
    </section>`;
    }

    getGalleryContent(theme) {
        const primaryClass = `${theme}-primary`;
        const textClass = `${theme}-text`;
        
        return `<section class="py-16">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="text-center mb-12">
                <h1 class="text-4xl font-bold mb-6 text-${primaryClass}">Photo Gallery</h1>
                <p class="text-xl text-${textClass} max-w-3xl mx-auto">
                    Professional portfolio photographs
                </p>
            </div>
            
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {{#each gallery_images}}
                <div class="aspect-square bg-gray-200 rounded-lg overflow-hidden hover:opacity-90 transition-opacity cursor-pointer">
                    <img src="/uploads/{{../model.slug}}/{{this.filename}}" 
                         alt="{{this.alt_text}}" 
                         class="w-full h-full object-cover">
                </div>
                {{else}}
                <div class="col-span-full text-center py-12">
                    <p class="text-${textClass} text-lg">Gallery photos will be displayed here.</p>
                </div>
                {{/each}}
            </div>
        </div>
    </section>`;
    }

    getDefaultContent(theme, page) {
        const primaryClass = `${theme}-primary`;
        const textClass = `${theme}-text`;
        const pageTitle = page.charAt(0).toUpperCase() + page.slice(1);
        
        return `<section class="py-16">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="text-center">
                <h1 class="text-4xl font-bold mb-6 text-${primaryClass}">${pageTitle}</h1>
                <p class="text-xl text-${textClass} max-w-3xl mx-auto mb-8">
                    Welcome to the ${page} page.
                </p>
                <a href="/{{model.slug}}/contact" class="bg-${primaryClass} text-white px-8 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity">
                    Contact Me
                </a>
            </div>
        </div>
    </section>`;
    }
}

// Run the creator if called directly
if (require.main === module) {
    const creator = new CleanTemplateCreator();
    creator.run().catch(console.error);
}

module.exports = CleanTemplateCreator;