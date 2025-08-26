// WCAG Contrast Guard System
// Ensures all Royal Gem theme colors meet accessibility standards

const WCAG_AA_RATIO = 4.5;
const MAX_OVERLAY_ALPHA = 0.55;
const MIN_OVERLAY_ALPHA = 0.0;

// Parse color formats: #rgb, #rrggbb, rgb(), rgba()
const parseColor = (color) => {
  if (!color || typeof color !== 'string') {
    throw new Error('Invalid color input');
  }
  
  const hexRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
  const rgbRegex = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/;
  
  if (hexRegex.test(color)) {
    return hexToRgb(color);
  } else if (rgbRegex.test(color)) {
    const match = color.match(rgbRegex);
    return {
      r: parseInt(match[1]),
      g: parseInt(match[2]), 
      b: parseInt(match[3]),
      a: match[4] ? parseFloat(match[4]) : 1
    };
  }
  
  throw new Error(`Unsupported color format: ${color}`);
};

const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex) ||
                /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(hex);
  
  if (!result) throw new Error('Invalid hex color');
  
  if (result[1].length === 1) {
    // Short form (#rgb)
    return {
      r: parseInt(result[1] + result[1], 16),
      g: parseInt(result[2] + result[2], 16),
      b: parseInt(result[3] + result[3], 16),
      a: 1
    };
  } else {
    // Long form (#rrggbb)
    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
      a: 1
    };
  }
};

// Alpha composition: overlay onto background
const applyOverlay = (bgColor, overlayRGBA) => {
  const bg = parseColor(bgColor);
  const overlay = parseColor(overlayRGBA);
  
  // Alpha compositing formula
  const alpha = overlay.a + bg.a * (1 - overlay.a);
  const r = (overlay.r * overlay.a + bg.r * bg.a * (1 - overlay.a)) / alpha;
  const g = (overlay.g * overlay.a + bg.g * bg.a * (1 - overlay.a)) / alpha;
  const b = (overlay.b * overlay.a + bg.b * bg.a * (1 - overlay.a)) / alpha;
  
  return { 
    r: Math.round(r), 
    g: Math.round(g), 
    b: Math.round(b), 
    a: alpha 
  };
};

// WCAG 2.1 contrast ratio calculation
const calculateContrast = (color1, color2) => {
  const getLuminance = (color) => {
    const rgb = typeof color === 'string' ? parseColor(color) : color;
    const rsRGB = rgb.r / 255;
    const gsRGB = rgb.g / 255;
    const bsRGB = rgb.b / 255;
    
    const r = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
    const g = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
    const b = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);
    
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const brighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  
  return (brighter + 0.05) / (darker + 0.05);
};

// Main contrast validation with auto-fix
const validateRoyalGemContrast = (tokens) => {
  console.log('🎭 Running WCAG contrast validation for Royal Gem theme...');
  
  const issues = [];
  const fixes = [];
  
  try {
    // Validate token formats
    Object.entries(tokens).forEach(([key, value]) => {
      if (!value || typeof value !== 'string') {
        throw new Error(`Invalid token value for ${key}: ${value}`);
      }
      
      try {
        parseColor(value);
      } catch (e) {
        throw new Error(`Invalid color format for ${key}: ${value} - ${e.message}`);
      }
    });
    
    // Prevent fully transparent text/borders
    const textColor = parseColor(tokens.text);
    if (textColor.a < 0.1) {
      issues.push('Text color cannot be transparent');
    }
    
    // Ensure link/text distinction (Royal Gem specific)
    const linkTextContrast = calculateContrast(tokens.link, tokens.text);
    if (linkTextContrast < 1.2) {
      issues.push('Link and text colors must be visually distinct (1.2× contrast minimum)');
    }
    
    // Critical contrast checks for Royal Gem theme
    const contrastChecks = [
      { 
        name: 'text on background', 
        text: tokens.text, 
        bg: tokens.bg,
        critical: true 
      },
      { 
        name: 'text on surface', 
        text: tokens.text, 
        bg: tokens.surface,
        critical: true 
      },
      { 
        name: 'text on background-alt', 
        text: tokens.text, 
        bg: tokens.bgAlt,
        critical: true 
      },
      { 
        name: 'link on background', 
        text: tokens.link, 
        bg: tokens.bg,
        critical: true 
      },
      { 
        name: 'link on surface', 
        text: tokens.link, 
        bg: tokens.surface,
        critical: true 
      },
      { 
        name: 'accent on dark surface', 
        text: tokens.accent, 
        bg: tokens.surface,
        critical: false 
      }
    ];
    
    // Check each combination
    for (const check of contrastChecks) {
      const contrast = calculateContrast(check.text, check.bg);
      
      if (contrast < WCAG_AA_RATIO) {
        const message = `${check.name} contrast: ${contrast.toFixed(2)}:1 (needs ≥${WCAG_AA_RATIO}:1)`;
        
        if (check.critical) {
          issues.push(`❌ CRITICAL: ${message}`);
        } else {
          issues.push(`⚠️  WARNING: ${message}`);
        }
        
        // Suggest fixes
        if (check.critical) {
          fixes.push(`Consider lightening ${check.name.split(' ')[0]} or darkening ${check.name.split(' on ')[1]}`);
        }
      } else {
        console.log(`✅ ${check.name}: ${contrast.toFixed(2)}:1`);
      }
    }
    
    // Check overlay effectiveness for Royal Gem
    if (tokens.overlay) {
      const overlayAlpha = parseFloat(tokens.overlay.match(/[\d.]+/)?.[0] || '0.25');
      const overlayedBg = applyOverlay(tokens.bg, tokens.overlay);
      const overlayTextContrast = calculateContrast(tokens.text, overlayedBg);
      
      if (overlayTextContrast < WCAG_AA_RATIO) {
        issues.push(`⚠️  Overlay text contrast: ${overlayTextContrast.toFixed(2)}:1 (overlay alpha: ${overlayAlpha})`);
        fixes.push(`Increase overlay opacity to at least 0.4 for better text readability`);
      } else {
        console.log(`✅ overlay text contrast: ${overlayTextContrast.toFixed(2)}:1`);
      }
    }
    
    return {
      valid: issues.length === 0,
      issues,
      fixes,
      summary: `Royal Gem contrast validation: ${issues.length === 0 ? 'PASSED' : 'FAILED'} (${issues.length} issues found)`
    };
    
  } catch (error) {
    return {
      valid: false,
      issues: [`Validation error: ${error.message}`],
      fixes: ['Fix color format errors before running contrast validation'],
      summary: 'Royal Gem contrast validation: ERROR'
    };
  }
};

// Validate Royal Gem theme specifically
const validateRoyalGem = () => {
  const royalGemTokens = {
    // From our Royal Gem color scheme
    primary: '#8B1538',     // Deep ruby red
    secondary: '#2D1B69',   // Royal purple  
    accent: '#D4AF37',      // Royal gold
    bg: '#0F0D1A',          // Deep midnight
    bgAlt: '#1A1625',       // Lighter midnight
    surface: '#2A1F3D',     // Dark plum
    overlay: 'rgba(212, 175, 55, 0.25)', // Gold overlay
    text: '#F8F6F0',        // Warm cream
    textSubtle: '#C4B8A0',  // Champagne
    link: '#D4AF37',        // Royal gold
    linkHover: '#F4D03F',   // Brighter gold
    focus: '#F4D03F',       // Golden focus
    success: '#27AE60',     // Emerald
    warning: '#E67E22',     // Amber
    error: '#C0392B',       // Deep red
    border: '#4A3B5C',      // Purple border
    borderMuted: '#3D2E4A'  // Subtle border
  };
  
  return validateRoyalGemContrast(royalGemTokens);
};

module.exports = {
  parseColor,
  calculateContrast,
  applyOverlay,
  validateRoyalGemContrast,
  validateRoyalGem,
  WCAG_AA_RATIO
};