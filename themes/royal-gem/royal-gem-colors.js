// Royal Gem Theme - Deep Jewel Tones & Gold Accents
// Inspired by velvet curtains, champagne, and candlelight

module.exports = {
  name: 'royal-gem',
  displayName: 'Royal Gem',
  description: 'Regal luxury with deep jewel tones, gold accents, and velvet elegance',
  
  // Core 17-token system with Royal Gem colors
  colors: {
    // Brand Identity (3) - Deep jewel tones
    primary: '#8B1538',     // Deep ruby red (velvet curtain)
    secondary: '#2D1B69',   // Royal purple (amethyst)  
    accent: '#D4AF37',      // Royal gold (champagne)
    
    // Surfaces (4) - Rich backgrounds
    bg: '#0F0D1A',          // Deep midnight (candlelight ambiance)
    bgAlt: '#1A1625',       // Slightly lighter midnight
    surface: '#2A1F3D',     // Dark plum (velvet texture)
    overlay: 'rgba(212, 175, 55, 0.25)', // Gold overlay with transparency
    
    // Typography (2) - Elegant contrast
    text: '#F8F6F0',        // Warm cream (candlelight glow)
    textSubtle: '#C4B8A0',  // Muted champagne
    
    // Interactive (3) - Gold interactions
    link: '#D4AF37',        // Royal gold
    linkHover: '#F4D03F',   // Brighter gold on hover
    focus: '#F4D03F',       // Golden focus ring
    
    // Status (3) - Jewel-toned states  
    success: '#27AE60',     // Emerald green
    warning: '#E67E22',     // Amber
    error: '#C0392B',       // Deep red (darker than primary)
    
    // System (2) - Subtle borders
    border: '#4A3B5C',      // Muted purple border
    borderMuted: '#3D2E4A'  // Even more subtle
  },
  
  // Non-color design tokens
  typography: {
    heading: "'Playfair Display', 'Times New Roman', serif", // Elegant serif
    body: "'Inter', 'Helvetica Neue', sans-serif"           // Clean sans-serif
  },
  
  spacing: {
    radiusSm: '8px',
    radiusMd: '16px', 
    radiusLg: '32px'
  },
  
  shadows: {
    sm: '0 4px 8px rgba(139, 21, 56, 0.15)',    // Ruby shadow
    md: '0 8px 24px rgba(45, 27, 105, 0.2)',    // Purple shadow
    lg: '0 16px 40px rgba(212, 175, 55, 0.25)'  // Gold shadow
  }
};