import fs from "node:fs";

// Load color inventory
const inventory = JSON.parse(fs.readFileSync("reports/color-inventory.json", "utf8"));

// Define semantic token mapping rules
const tokenRules = [
  // Buttons
  { pattern: /btn|button/i, usage: 'button', token: 'btn-bg' },
  { pattern: /btn.*hover|button.*hover/i, usage: 'button', token: 'btn-bg-hover' },
  { pattern: /btn.*text|button.*text/i, usage: 'button', token: 'btn-text' },
  
  // Navigation
  { pattern: /nav|header|menu/i, usage: 'nav', token: 'nav-bg' },
  { pattern: /nav.*text|header.*text/i, usage: 'nav', token: 'nav-text' },
  
  // Footer
  { pattern: /footer/i, usage: 'footer', token: 'footer-bg' },
  { pattern: /footer.*text/i, usage: 'footer', token: 'footer-text' },
  
  // Links
  { pattern: /link/i, usage: 'link', token: 'link' },
  { pattern: /link.*hover/i, usage: 'link', token: 'link-hover' },
  
  // Cards
  { pattern: /card/i, usage: 'card', token: 'card-bg' },
  { pattern: /card.*border/i, usage: 'card', token: 'card-border' },
  
  // Hero section
  { pattern: /hero/i, usage: 'hero', token: 'hero-bg' },
  { pattern: /overlay/i, usage: 'hero', token: 'overlay' },
  
  // Badges/Pills/Chips
  { pattern: /badge|pill|chip/i, usage: 'badge', token: 'badge-bg' },
  { pattern: /badge.*text|pill.*text|chip.*text/i, usage: 'badge', token: 'badge-text' },
  
  // Alerts
  { pattern: /alert|toast/i, usage: 'alert', token: 'alert-bg' },
  { pattern: /alert.*text|toast.*text/i, usage: 'alert', token: 'alert-text' },
  
  // Tables
  { pattern: /table|thead|tbody/i, usage: 'table', token: 'table-bg' },
  { pattern: /table.*border/i, usage: 'table', token: 'table-border' },
  
  // Modals
  { pattern: /modal|dialog/i, usage: 'modal', token: 'modal-bg' },
  { pattern: /modal.*overlay|dialog.*overlay/i, usage: 'modal', token: 'modal-overlay' }
];

// CSS Variables mapping to semantic tokens
const cssVarTokens = {
  // BDSM theme
  '--bdsm-primary': 'primary',
  '--bdsm-secondary': 'secondary', 
  '--bdsm-bg': 'bg',
  '--bdsm-text': 'text',
  '--bdsm-accent': 'accent',
  
  // Generic CSS vars
  '--primary': 'primary',
  '--secondary': 'secondary',
  '--accent': 'accent',
  '--background': 'bg',
  '--text': 'text',
  '--border': 'border',
  '--surface': 'surface'
};

// Color value to semantic token mapping (common colors)
const colorToToken = {
  '#ffffff': 'bg', // white background
  '#000000': 'text', // black text
  '#1a1a1a': 'text-dark',
  '#f8f9fa': 'bg-light',
  '#6b7280': 'text-muted',
  '#d1d5db': 'border',
  '#dc2626': 'danger', // red
  '#ef4444': 'danger-light',
  '#10b981': 'success', // green
  '#3b82f6': 'primary', // blue
  '#f59e0b': 'warning', // yellow/orange
  '#8b5cf6': 'secondary' // purple
};

// Function to classify a color entry
function classifyColor(entry) {
  let token = 'unknown';
  
  // First, check CSS variables
  if (entry.type === 'cssVar') {
    const varName = entry.raw.toLowerCase();
    token = cssVarTokens[varName] || 'unknown';
    if (token !== 'unknown') {
      return { ...entry, token, confidence: 'high' };
    }
  }
  
  // Check for direct color value matches
  if (entry.type === 'hex' && colorToToken[entry.raw.toLowerCase()]) {
    token = colorToToken[entry.raw.toLowerCase()];
    return { ...entry, token, confidence: 'high' };
  }
  
  // Apply pattern matching rules based on file context
  const fullContext = `${entry.file} ${entry.usage}`.toLowerCase();
  
  for (const rule of tokenRules) {
    if (rule.pattern.test(fullContext)) {
      token = rule.token;
      return { ...entry, token, confidence: 'medium' };
    }
  }
  
  // Fallback rules based on common patterns
  if (entry.usage === 'hover') {
    token = 'hover-state';
  } else if (entry.usage === 'focus') {
    token = 'focus-state';
  } else if (fullContext.includes('text')) {
    token = 'text';
  } else if (fullContext.includes('background') || fullContext.includes('bg-')) {
    token = 'bg';
  } else if (fullContext.includes('border')) {
    token = 'border';
  } else {
    // Final fallback - try to categorize by color value
    if (entry.type === 'hex') {
      const hex = entry.raw.toLowerCase();
      if (hex === '#ffffff' || hex === '#fff') token = 'bg';
      else if (hex === '#000000' || hex === '#000') token = 'text';
      else if (hex.match(/^#[f]{3,6}$/)) token = 'bg-light'; // very light colors
      else if (hex.match(/^#[0-3]{3,6}$/)) token = 'text-dark'; // very dark colors
      else token = 'accent'; // everything else as accent
    } else {
      token = 'accent';
    }
  }
  
  return { ...entry, token, confidence: 'low' };
}

// Process all inventory entries
console.log('🔍 Classifying', inventory.length, 'color entries...');

const classified = inventory.map(classifyColor);

// Generate summary statistics
const stats = {
  totalEntries: classified.length,
  byTheme: {},
  byToken: {},
  byConfidence: { high: 0, medium: 0, low: 0 },
  unknownEntries: classified.filter(c => c.token === 'unknown')
};

classified.forEach(entry => {
  // By theme
  stats.byTheme[entry.theme] = (stats.byTheme[entry.theme] || 0) + 1;
  
  // By token
  stats.byToken[entry.token] = (stats.byToken[entry.token] || 0) + 1;
  
  // By confidence
  stats.byConfidence[entry.confidence] = (stats.byConfidence[entry.confidence] || 0) + 1;
});

// Write classified results
fs.writeFileSync('reports/classified-colors.json', JSON.stringify(classified, null, 2));

// Write CSV for manual review
const csvHeaders = 'theme,file,line,type,raw_value,token,confidence,usage\n';
const csvRows = classified.map(entry => 
  `${entry.theme},"${entry.file}",${entry.line},${entry.type},"${entry.raw}",${entry.token},${entry.confidence},${entry.usage}`
).join('\n');

fs.writeFileSync('reports/theme-token-map.csv', csvHeaders + csvRows);

// Write summary statistics
fs.writeFileSync('reports/classification-stats.json', JSON.stringify(stats, null, 2));

console.log('📊 Classification complete:');
console.log('- Total entries:', stats.totalEntries);
console.log('- High confidence:', stats.byConfidence.high);
console.log('- Medium confidence:', stats.byConfidence.medium);
console.log('- Low confidence:', stats.byConfidence.low);
console.log('- Unknown tokens:', stats.unknownEntries.length);

console.log('\n🎨 Tokens found:');
Object.entries(stats.byToken)
  .sort(([,a], [,b]) => b - a)
  .forEach(([token, count]) => {
    console.log(`  ${token}: ${count} entries`);
  });

console.log('\n📁 Files written:');
console.log('- reports/classified-colors.json (machine readable)');
console.log('- reports/theme-token-map.csv (human readable)'); 
console.log('- reports/classification-stats.json (statistics)');