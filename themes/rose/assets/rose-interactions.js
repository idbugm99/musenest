// Rose Theme Interactive Enhancements
// Dynamic decorative elements and interactions

class RoseThemeEnhancements {
    constructor() {
        this.init();
    }
    
    init() {
        this.addFloatingPetals();
        this.addFloatingRoses();
        this.addInteractiveRoses();
        this.addScrollEffects();
        this.addHoverEffects();
    }
    
    // Add dynamic floating petals
    addFloatingPetals() {
        const petalCount = 6;
        const container = document.body;
        
        for (let i = 0; i < petalCount; i++) {
            const petal = document.createElement('div');
            petal.className = 'dynamic-petal';
            petal.style.cssText = `
                position: fixed;
                width: 8px;
                height: 12px;
                background: linear-gradient(45deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent), var(--theme-text-inverted, #ffffff) 30%));
                border-radius: 0 100% 0 100%;
                pointer-events: none;
                z-index: 1;
                opacity: 0;
                animation: dynamicPetalFloat ${8 + Math.random() * 4}s ease-in-out infinite;
                animation-delay: ${Math.random() * 8}s;
            `;
            
            petal.style.left = Math.random() * 100 + '%';
            petal.style.top = Math.random() * 100 + '%';
            
            container.appendChild(petal);
        }
        
        // Add CSS animation
        this.addDynamicStyles();
    }
    
    // Add interactive roses that respond to mouse
    addInteractiveRoses() {
        document.addEventListener('mousemove', (e) => {
            const roses = document.querySelectorAll('.rose-flower');
            if (!roses || roses.length === 0) return;
            
            roses.forEach((rose, index) => {
                if (!rose) return;
                
                const rect = rose.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                
                const deltaX = e.clientX - centerX;
                const deltaY = e.clientY - centerY;
                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                
                if (distance < 100) {
                    const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
                    const intensity = Math.max(0, 1 - distance / 100);
                    
                    rose.style.transform = `rotate(${angle * 0.1}deg) scale(${1 + intensity * 0.2})`;
                    rose.style.filter = `hue-rotate(${intensity * 20}deg) brightness(${1 + intensity * 0.3})`;
                } else {
                    rose.style.transform = '';
                    rose.style.filter = '';
                }
            });
        });
    }

    // Add several floating SVG roses around the page
    addFloatingRoses() {
        const container = document.body;
        if (!container) return;

        // Avoid duplicating if already added
        if (container.querySelector('[data-rose-float="true"]')) return;

        const roseCount = Math.max(4, Math.min(8, Math.floor(window.innerWidth / 300)));
        const sizes = [24, 28, 36];

        for (let i = 0; i < roseCount; i++) {
            const img = document.createElement('img');
            img.src = '/themes/rose/assets/icons/rose-10.svg';
            img.alt = 'Rose';
            img.setAttribute('data-rose-float', 'true');
            img.className = 'rose-svg';

            const size = sizes[Math.floor(Math.random() * sizes.length)];
            const left = Math.random() * 100; // viewport percent
            const top = Math.random() * 60 + 10; // mostly upper area
            const duration = 10 + Math.random() * 10; // 10s - 20s
            const delay = Math.random() * 8; // 0 - 8s
            const opacity = 0.6 + Math.random() * 0.25; // 0.6 - 0.85

            img.style.cssText = `
                position: fixed;
                left: ${left}vw;
                top: ${top}vh;
                width: ${size}px;
                height: ${size}px;
                pointer-events: none;
                z-index: 1;
                opacity: ${opacity};
                animation-duration: ${duration}s;
                animation-delay: ${delay}s;
            `;

            container.appendChild(img);
        }
    }
    
    // Add scroll-based effects
    addScrollEffects() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('rose-visible');
                    
                    // Add staggered animations for cards
                    const cards = entry.target.querySelectorAll('.theme-card');
                    cards.forEach((card, index) => {
                        setTimeout(() => {
                            card.classList.add('rose-animate-in');
                        }, index * 150);
                    });
                }
            });
        }, observerOptions);
        
        // Observe sections
        const sections = document.querySelectorAll('section');
        if (sections && sections.length > 0) {
            sections.forEach(section => {
                if (section) {
                    observer.observe(section);
                }
            });
        }
    }
    
    // Add enhanced hover effects
    addHoverEffects() {
        // Enhanced button hover with particle effect
        const roseButtons = document.querySelectorAll('.rose-button');
        if (roseButtons && roseButtons.length > 0) {
            roseButtons.forEach(button => {
                if (button) {
                    button.addEventListener('mouseenter', (e) => {
                        this.createButtonParticles(e.target);
                    });
                }
            });
        }
        
        // Enhanced card hover with glow
        const roseCards = document.querySelectorAll('.rose-enhanced');
        if (roseCards && roseCards.length > 0) {
            roseCards.forEach(card => {
                if (card) {
                    card.addEventListener('mouseenter', (e) => {
                        this.addCardGlow(e.target);
                    });
                    
                    card.addEventListener('mouseleave', (e) => {
                        this.removeCardGlow(e.target);
                    });
                }
            });
        }
    }
    
    // Create particle effect for buttons
    createButtonParticles(button) {
        if (!button) return;
        
        const rect = button.getBoundingClientRect();
        const particleCount = 5;
        
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'rose-particle';
            particle.style.cssText = `
                position: fixed;
                width: 4px;
                height: 4px;
                background: var(--theme-accent);
                border-radius: 50%;
                pointer-events: none;
                z-index: 1000;
                left: ${rect.left + Math.random() * rect.width}px;
                top: ${rect.top + Math.random() * rect.height}px;
                animation: roseParticleFloat 1s ease-out forwards;
            `;
            
            if (document.body) {
                document.body.appendChild(particle);
                
                setTimeout(() => {
                    if (particle && particle.parentNode) {
                        particle.remove();
                    }
                }, 1000);
            }
        }
    }
    
    // Add card glow effect
    addCardGlow(card) {
        if (!card) return;
        
        card.style.boxShadow = `
            0 0 20px color-mix(in srgb, var(--theme-accent), transparent 70%),
            0 0 40px color-mix(in srgb, var(--theme-accent), transparent 90%)
        `;
    }
    
    // Remove card glow effect
    removeCardGlow(card) {
        if (!card) return;
        card.style.boxShadow = '';
    }
    
    // Add dynamic CSS styles
    addDynamicStyles() {
        if (!document.head) return;
        
        const style = document.createElement('style');
        style.textContent = `
            @keyframes dynamicPetalFloat {
                0% { opacity: 0; transform: translateY(0) rotate(0deg); }
                10% { opacity: 0.7; }
                90% { opacity: 0.7; }
                100% { opacity: 0; transform: translateY(-20px) rotate(360deg); }
            }
            
            @keyframes roseParticleFloat {
                0% { opacity: 1; transform: translateY(0) scale(1); }
                100% { opacity: 0; transform: translateY(-30px) scale(0); }
            }
            
            .rose-visible {
                animation: roseSlideIn 0.6s ease-out;
            }
            
            @keyframes roseSlideIn {
                from { opacity: 0; transform: translateY(30px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            .rose-animate-in {
                animation: roseScaleIn 0.4s ease-out;
            }
            
            @keyframes roseScaleIn {
                from { opacity: 0; transform: scale(0.9); }
                to { opacity: 1; transform: scale(1); }
            }
        `;
        
        document.head.appendChild(style);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    try {
        new RoseThemeEnhancements();
    } catch (error) {
        console.warn('Rose theme enhancements failed to initialize:', error);
    }
});

// Utility functions for theme customization
if (typeof window !== 'undefined') {
    window.RoseTheme = {
        // Add a custom rose at specific coordinates
        addRose: function(x, y, size = 'medium') {
            if (!document.body) return null;
            
            const rose = document.createElement('div');
            rose.className = `rose-flower ${size}`;
            rose.style.cssText = `
                position: absolute;
                left: ${x}px;
                top: ${y}px;
                z-index: 2;
            `;
            document.body.appendChild(rose);
            return rose;
        },
        
        // Create a rose trail following the cursor
        enableRoseTrail: function() {
            if (!document.body) return;
            
            let trail = [];
            document.addEventListener('mousemove', (e) => {
                if (trail.length > 5) {
                    const oldRose = trail.shift();
                    if (oldRose && oldRose.parentNode) {
                        oldRose.remove();
                    }
                }
                
                const rose = document.createElement('div');
                rose.style.cssText = `
                    position: fixed;
                    width: 6px;
                    height: 6px;
                    background: var(--theme-accent);
                    border-radius: 50%;
                    pointer-events: none;
                    z-index: 1;
                    left: ${e.clientX}px;
                    top: ${e.clientY}px;
                    animation: roseTrailFade 1s ease-out forwards;
                `;
                
                document.body.appendChild(rose);
                trail.push(rose);
            });
        },
        
        // Toggle decorative elements
        toggleDecorations: function(enable = true) {
            const decorations = document.querySelectorAll('.rose-flower, .rose-petals, .dynamic-petal, img.rose-svg[data-rose-float="true"]');
            if (decorations && decorations.length > 0) {
                decorations.forEach(el => {
                    if (el) {
                        el.style.display = enable ? 'block' : 'none';
                    }
                });
            }
        }
    };
}