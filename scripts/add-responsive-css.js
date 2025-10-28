#!/usr/bin/env node
/**
 * Script to add responsive CSS links to all theme layouts
 */

const fs = require('fs');
const path = require('path');

const themes = ['basic', 'glamour', 'luxury', 'modern', 'dark', 'bdsm', 'royal-gem', 'simple-elegance'];

themes.forEach(theme => {
    const layoutPath = path.join(__dirname, '..', 'themes', theme, 'layouts', 'main.handlebars');

    if (!fs.existsSync(layoutPath)) {
        console.log(`⚠️  Layout not found for ${theme}`);
        return;
    }

    let content = fs.readFileSync(layoutPath, 'utf8');

    // Check if responsive CSS is already added
    if (content.includes(`${theme}-responsive.css`)) {
        console.log(`✅ ${theme}: Responsive CSS already included`);
        return;
    }

    // Find </head> tag and add responsive CSS before it
    const responsiveCSSLink = `    <!-- Responsive Design -->\n    <link rel="stylesheet" href="/themes/${theme}/assets/${theme}-responsive.css">\n</head>`;

    if (content.includes('</head>')) {
        content = content.replace('</head>', responsiveCSSLink);
        fs.writeFileSync(layoutPath, content, 'utf8');
        console.log(`✅ ${theme}: Added responsive CSS`);
    } else {
        console.log(`⚠️  ${theme}: Could not find </head> tag`);
    }
});

console.log('\n🎉 Responsive CSS integration complete!');
