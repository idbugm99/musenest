import fs from "node:fs";

// Load classified colors
const classified = JSON.parse(fs.readFileSync("reports/classified-colors.json", "utf8"));

// Define the complete token set that every theme should have
const requiredTokens = [
  'primary', 'secondary', 'accent',
  'bg', 'bg-light', 'bg-dark', 'surface',
  'text', 'text-light', 'text-dark', 'text-muted',
  'border', 'border-light', 'border-dark',
  'btn-bg', 'btn-text', 'btn-bg-hover', 'btn-text-hover',
  'link', 'link-hover',
  'nav-bg', 'nav-text', 'nav-border',
  'footer-bg', 'footer-text', 'footer-border',
  'card-bg', 'card-border', 'card-shadow',
  'hero-bg', 'hero-text', 'hero-overlay',
  'badge-bg', 'badge-text',
  'alert-bg', 'alert-text', 'alert-border',
  'success', 'warning', 'danger', 'info',
  'focus-ring', 'disabled-bg', 'disabled-text'
];

// Default color values for fallbacks
const defaultColors = {
  primary: '#3b82f6',      // blue-500
  secondary: '#6b7280',    // gray-500
  accent: '#f59e0b',       // amber-500
  bg: '#ffffff',           // white
  'bg-light': '#f8fafc',   // slate-50
  'bg-dark': '#0f172a',    // slate-900
  surface: '#ffffff',      // white
  text: '#1e293b',         // slate-800
  'text-light': '#64748b', // slate-500
  'text-dark': '#0f172a',  // slate-900
  'text-muted': '#64748b', // slate-500
  border: '#e2e8f0',       // slate-200
  'border-light': '#f1f5f9', // slate-100
  'border-dark': '#334155', // slate-700
  'btn-bg': '#3b82f6',     // primary
  'btn-text': '#ffffff',   // white
  'btn-bg-hover': '#2563eb', // blue-600
  'btn-text-hover': '#ffffff', // white
  link: '#3b82f6',         // primary
  'link-hover': '#2563eb', // blue-600
  'nav-bg': '#ffffff',     // white
  'nav-text': '#1e293b',   // slate-800
  'nav-border': '#e2e8f0', // slate-200
  'footer-bg': '#f1f5f9',  // slate-100
  'footer-text': '#64748b', // slate-500
  'footer-border': '#e2e8f0', // slate-200
  'card-bg': '#ffffff',    // white
  'card-border': '#e2e8f0', // slate-200
  'card-shadow': 'rgba(0, 0, 0, 0.1)',
  'hero-bg': '#3b82f6',    // primary
  'hero-text': '#ffffff',  // white
  'hero-overlay': 'rgba(0, 0, 0, 0.5)',
  'badge-bg': '#f1f5f9',   // slate-100
  'badge-text': '#475569', // slate-600
  'alert-bg': '#fef2f2',   // red-50
  'alert-text': '#991b1b', // red-800
  'alert-border': '#fecaca', // red-200
  success: '#10b981',      // emerald-500
  warning: '#f59e0b',      // amber-500
  danger: '#ef4444',       // red-500
  info: '#3b82f6',         // blue-500
  'focus-ring': '#3b82f6', // primary
  'disabled-bg': '#f1f5f9', // slate-100
  'disabled-text': '#94a3b8' // slate-400
};

console.log('🎨 Building theme palette defaults...');

// Group by theme and token
const themeTokens = {};

classified.forEach(entry => {
  if (!themeTokens[entry.theme]) {
    themeTokens[entry.theme] = {};
  }
  
  if (!themeTokens[entry.theme][entry.token]) {
    themeTokens[entry.theme][entry.token] = {
      values: [],
      sources: []
    };
  }
  
  themeTokens[entry.theme][entry.token].values.push(entry.raw);
  themeTokens[entry.theme][entry.token].sources.push(`${entry.file}:${entry.line}`);
});

// Build final palette defaults
const paletteDefaults = {};

Object.keys(themeTokens).forEach(theme => {
  paletteDefaults[theme] = {};
  
  // For each required token
  requiredTokens.forEach(token => {
    if (themeTokens[theme][token]) {
      // Find most frequent value
      const values = themeTokens[theme][token].values;
      const valueCount = {};
      
      values.forEach(value => {
        valueCount[value] = (valueCount[value] || 0) + 1;
      });
      
      // Get most frequent value
      const mostFrequent = Object.entries(valueCount)
        .sort(([,a], [,b]) => b - a)[0];
      
      paletteDefaults[theme][token] = {
        value: mostFrequent[0],
        count: mostFrequent[1],
        sources: themeTokens[theme][token].sources.slice(0, 3), // limit to first 3 sources
        confidence: mostFrequent[1] > 1 ? 'high' : 'medium'
      };
    } else {
      // Use default value for missing tokens
      paletteDefaults[theme][token] = {
        value: defaultColors[token] || '#6b7280',
        count: 0,
        sources: ['default'],
        confidence: 'generated'
      };
    }
  });
  
  // Also include any extra tokens found that aren't in the required set
  Object.keys(themeTokens[theme]).forEach(token => {
    if (!requiredTokens.includes(token)) {
      const values = themeTokens[theme][token].values;
      const valueCount = {};
      
      values.forEach(value => {
        valueCount[value] = (valueCount[value] || 0) + 1;
      });
      
      const mostFrequent = Object.entries(valueCount)
        .sort(([,a], [,b]) => b - a)[0];
      
      paletteDefaults[theme][token] = {
        value: mostFrequent[0],
        count: mostFrequent[1],
        sources: themeTokens[theme][token].sources.slice(0, 3),
        confidence: mostFrequent[1] > 1 ? 'high' : 'medium'
      };
    }
  });
});

// Generate CSV for human review
const csvHeaders = 'theme,token,value,source_count,confidence,example_files\n';
const csvRows = [];

Object.entries(paletteDefaults).forEach(([theme, tokens]) => {
  Object.entries(tokens).forEach(([token, data]) => {
    const exampleFiles = data.sources
      .filter(s => s !== 'default')
      .map(s => s.split(':')[0])
      .filter((f, i, arr) => arr.indexOf(f) === i) // unique
      .slice(0, 3)
      .join(', ') || 'default';
    
    csvRows.push(`${theme},${token},"${data.value}",${data.count},${data.confidence},"${exampleFiles}"`);
  });
});

// Write outputs
fs.writeFileSync('reports/palette-defaults.json', JSON.stringify(paletteDefaults, null, 2));
fs.writeFileSync('reports/palette-defaults.csv', csvHeaders + csvRows.join('\n'));

// Generate statistics
const stats = {
  totalThemes: Object.keys(paletteDefaults).length,
  totalTokens: requiredTokens.length,
  themeStats: {}
};

Object.entries(paletteDefaults).forEach(([theme, tokens]) => {
  const generated = Object.values(tokens).filter(t => t.confidence === 'generated').length;
  const found = Object.values(tokens).filter(t => t.confidence !== 'generated').length;
  
  stats.themeStats[theme] = {
    totalTokens: Object.keys(tokens).length,
    foundTokens: found,
    generatedTokens: generated,
    completeness: Math.round((found / requiredTokens.length) * 100)
  };
});

fs.writeFileSync('reports/palette-stats.json', JSON.stringify(stats, null, 2));

console.log('✅ Palette defaults generated:');
console.log('- Themes processed:', stats.totalThemes);
console.log('- Required tokens per theme:', stats.totalTokens);

console.log('\n📊 Theme completeness:');
Object.entries(stats.themeStats).forEach(([theme, data]) => {
  console.log(`  ${theme}: ${data.completeness}% (${data.foundTokens}/${requiredTokens.length} found, ${data.generatedTokens} generated)`);
});

console.log('\n📁 Files written:');
console.log('- reports/palette-defaults.json (machine readable)');
console.log('- reports/palette-defaults.csv (human readable)');
console.log('- reports/palette-stats.json (statistics)');

console.log('\n🎯 Next steps:');
console.log('- Review reports/palette-defaults.csv to verify token mappings');
console.log('- Adjust any incorrect color assignments');
console.log('- Create database migration to store these palette defaults');