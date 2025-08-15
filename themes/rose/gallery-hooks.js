/**
 * Rose Theme Gallery Hooks
 * 
 * Customizes gallery functionality for the Rose theme with romantic aesthetics,
 * floral animations, and elegant interactions.
 */

module.exports = {
    /**
     * Transform gallery data with Rose theme enhancements
     */
    'gallery:dataTransform': function(data, context) {
        // Add rose-specific metadata
        if (data.items) {
            data.items = data.items.map(item => ({
                ...item,
                // Add rose-themed classes
                themeClasses: ['rose-bloom-item'],
                // Enhanced alt text with poetic descriptions
                poeticAlt: this.generatePoeticAlt(item.alt),
                // Rose-specific animation delays
                animationDelay: Math.random() * 500
            }));
        }

        // Add rose garden context
        data.themeContext = {
            gardenName: 'Rose Garden Gallery',
            bloomSeason: this.getCurrentSeason(),
            petalCount: data.pagination?.total || 0
        };

        return data;
    },

    /**
     * Customize layout configuration for Rose theme
     */
    'gallery:layoutConfig': function(config, context) {
        return {
            ...config,
            // Rose theme prefers masonry with organic spacing
            defaultLayout: 'masonry',
            masonry: {
                columnWidth: 300,
                gutter: 24,
                // Rose-specific masonry behavior
                staggerDelay: 100,
                bloomAnimation: 'rose-bloom-in',
                organicSpacing: true
            },
            // Custom grid settings for rose theme
            grid: {
                aspectRatio: 'auto', // Let images keep natural proportions
                gaps: '1.5rem',
                borderRadius: '12px'
            }
        };
    },

    /**
     * Customize animation configuration
     */
    'gallery:animationConfig': function(config, context) {
        return {
            ...config,
            // Rose-themed animations
            hover: {
                transform: 'scale(1.05) rotate(1deg)',
                filter: 'brightness(1.1) saturate(1.2)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            },
            lightboxOpen: {
                keyframes: 'roseBloomOpen',
                duration: '600ms',
                easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
            },
            lightboxClose: {
                keyframes: 'roseBloomClose',
                duration: '400ms',
                easing: 'ease-in-out'
            },
            // Petal fall animation for loading
            loading: {
                keyframes: 'petalFall',
                duration: '2s',
                iterationCount: 'infinite'
            }
        };
    },

    /**
     * Customize individual gallery item rendering
     */
    'gallery:itemRender': function(item, context) {
        return {
            ...item,
            // Add rose-specific overlay content
            overlayContent: this.generateRoseOverlay(item),
            // Custom caption styling
            captionStyle: 'rose-caption-elegant',
            // Add rose border treatment
            borderTreatment: this.getRoseBorderStyle(item.category),
            // Add seasonal context
            seasonalClass: `rose-${this.getCurrentSeason()}`
        };
    },

    /**
     * Customize CSS class mapping
     */
    'gallery:cssClassMapping': function(classMap, context) {
        return {
            ...classMap,
            // Override with Rose-specific classes
            gallery: 'rose-gallery-garden',
            section: 'rose-gallery-section',
            item: 'rose-gallery-bloom',
            lightbox: 'rose-lightbox-modal',
            pagination: 'rose-pagination-thorns',
            filters: 'rose-filters-petals',
            loading: 'rose-loading-dance',
            // Add rose-specific states
            featured: 'rose-featured-bloom',
            private: 'rose-private-bud',
            newest: 'rose-fresh-bloom'
        };
    },

    /**
     * Before gallery render hook
     */
    'gallery:beforeRender': function(data, context) {
        // Log rose theme rendering
        if (context.debug) {
            console.log('🌹 Rendering Rose Gallery:', {
                items: data.items?.length || 0,
                season: this.getCurrentSeason()
            });
        }

        // Add rose theme metadata
        data.roseTheme = {
            version: '1.0.0',
            renderedAt: new Date().toISOString(),
            petalPattern: this.generatePetalPattern(data.items?.length || 0)
        };

        return data;
    },

    /**
     * After gallery render hook
     */
    'gallery:afterRender': function(data, context) {
        // Add rose-specific enhancements after render
        if (typeof document !== 'undefined') {
            this.enhanceRoseInteractions();
            this.initializePetalAnimations();
        }

        return data;
    },

    /**
     * Custom render context for Rose theme
     */
    renderContext: function(baseContext) {
        return {
            ...baseContext,
            roseTheme: {
                gardenName: 'Enchanted Rose Gallery',
                currentSeason: this.getCurrentSeason(),
                petalColors: ['#ff69b4', '#ff1493', '#dc143c', '#b22222'],
                thornPattern: 'elegant',
                bloomIntensity: 'romantic'
            }
        };
    },

    /**
     * Custom Handlebars helpers for Rose theme
     */
    helpers: {
        /**
         * Generate rose-themed greeting based on time of day
         */
        roseGreeting: function() {
            const hour = new Date().getHours();
            if (hour < 12) return 'Good morning, beautiful soul';
            if (hour < 17) return 'Good afternoon, lovely visitor';
            if (hour < 20) return 'Good evening, dear one';
            return 'Good night, sweet dreamer';
        },

        /**
         * Convert number to rose petal count description
         */
        petalCount: function(number) {
            if (number === 1) return 'a single precious petal';
            if (number < 6) return 'a few delicate petals';
            if (number < 12) return 'a bouquet of petals';
            if (number < 25) return 'a garden of blooms';
            return 'an endless rose garden';
        },

        /**
         * Generate poetic image descriptions
         */
        poeticDescription: function(originalAlt) {
            const poeticPrefixes = [
                'A moment of pure beauty captured',
                'Like morning dew on rose petals',
                'Whispers of elegance frozen in time',
                'A dance of light and shadow',
                'Poetry written in visual form'
            ];
            
            const prefix = poeticPrefixes[Math.floor(Math.random() * poeticPrefixes.length)];
            return `${prefix}: ${originalAlt}`;
        },

        /**
         * Get seasonal rose variety
         */
        seasonalRose: function(season) {
            const varieties = {
                spring: 'Cherry Blossom Rose',
                summer: 'Garden Tea Rose',
                autumn: 'Burgundy Velvet Rose',
                winter: 'Frost-kissed Rose'
            };
            return varieties[season] || 'Eternal Rose';
        }
    },

    // ===== Helper Methods =====

    /**
     * Generate poetic alt text
     */
    generatePoeticAlt: function(originalAlt) {
        const poeticWords = [
            'enchanting', 'mesmerizing', 'captivating', 'ethereal',
            'graceful', 'radiant', 'luminous', 'exquisite'
        ];
        
        const randomWord = poeticWords[Math.floor(Math.random() * poeticWords.length)];
        return `${randomWord} ${originalAlt}`.toLowerCase();
    },

    /**
     * Get current season for theming
     */
    getCurrentSeason: function() {
        const month = new Date().getMonth();
        if (month >= 2 && month <= 4) return 'spring';
        if (month >= 5 && month <= 7) return 'summer';
        if (month >= 8 && month <= 10) return 'autumn';
        return 'winter';
    },

    /**
     * Generate rose overlay content
     */
    generateRoseOverlay: function(item) {
        return {
            petalCount: Math.floor(Math.random() * 12) + 3,
            dewDrops: Math.random() > 0.7,
            thornPattern: item.featured ? 'gold' : 'silver',
            bloomStage: ['bud', 'half-bloom', 'full-bloom'][Math.floor(Math.random() * 3)]
        };
    },

    /**
     * Get rose border style based on category
     */
    getRoseBorderStyle: function(category) {
        const styles = {
            'portraits': 'rose-border-elegant',
            'lifestyle': 'rose-border-organic',
            'artistic': 'rose-border-creative',
            'vintage': 'rose-border-classic'
        };
        return styles[category] || 'rose-border-default';
    },

    /**
     * Generate petal pattern based on item count
     */
    generatePetalPattern: function(count) {
        return {
            density: Math.min(count / 10, 5),
            colors: this.getSeasonalColors(),
            animation: count > 20 ? 'gentle-breeze' : 'still-air'
        };
    },

    /**
     * Get seasonal colors
     */
    getSeasonalColors: function() {
        const season = this.getCurrentSeason();
        const colors = {
            spring: ['#ffb6c1', '#ffc0cb', '#ff69b4'],
            summer: ['#ff1493', '#dc143c', '#b22222'],
            autumn: ['#8b0000', '#a52a2a', '#800000'],
            winter: ['#c0c0c0', '#dda0dd', '#deb887']
        };
        return colors[season] || colors.spring;
    },

    /**
     * Enhance rose interactions (client-side)
     */
    enhanceRoseInteractions: function() {
        // Add subtle sparkle effects on hover
        const galleryItems = document.querySelectorAll('.rose-gallery-bloom');
        galleryItems.forEach(item => {
            item.addEventListener('mouseenter', () => {
                this.addSparkleEffect(item);
            });
            
            item.addEventListener('mouseleave', () => {
                this.removeSparkleEffect(item);
            });
        });
    },

    /**
     * Initialize petal animations
     */
    initializePetalAnimations: function() {
        // Create floating petals background effect
        const petalContainer = document.createElement('div');
        petalContainer.className = 'rose-floating-petals';
        petalContainer.setAttribute('aria-hidden', 'true');
        
        // Add 5-10 animated petals
        for (let i = 0; i < Math.floor(Math.random() * 6) + 5; i++) {
            const petal = document.createElement('div');
            petal.className = 'rose-floating-petal';
            petal.style.left = Math.random() * 100 + '%';
            petal.style.animationDelay = Math.random() * 10 + 's';
            petal.style.animationDuration = (Math.random() * 10 + 15) + 's';
            petalContainer.appendChild(petal);
        }
        
        document.body.appendChild(petalContainer);
    },

    /**
     * Add sparkle effect
     */
    addSparkleEffect: function(element) {
        element.classList.add('rose-sparkle-active');
    },

    /**
     * Remove sparkle effect
     */
    removeSparkleEffect: function(element) {
        element.classList.remove('rose-sparkle-active');
    }
};