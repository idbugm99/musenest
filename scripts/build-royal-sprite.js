const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Royal SVG files to include in sprite
const royalIcons = [
  { file: '019-crown.svg', id: 'crown' },
  { file: '020-crown-1.svg', id: 'crown-alt' },
  { file: '022-crown-2.svg', id: 'crown-royal' },
  { file: '025-scepter.svg', id: 'scepter' },
  { file: '031-diamond.svg', id: 'diamond' },
  { file: '027-saphire.svg', id: 'sapphire' }, 
  { file: '029-ruby.svg', id: 'ruby' },
  { file: '028-gem.svg', id: 'gem' },
  { file: '035-gem-1.svg', id: 'gem-alt' },
  { file: '041-jewellery.svg', id: 'jewelry' },
  { file: '021-royal.svg', id: 'royal' },
  { file: '017-insignia.svg', id: 'insignia' }
];

const generateFingerprint = (content) => {
  return crypto.createHash('md5').update(content).digest('hex').slice(0, 6);
};

const buildRoyalSprite = async () => {
  console.log('🎭 Building Royal Gem sprite...');
  
  const testSvgDir = path.join(__dirname, '..', 'test_svg');
  const outputDir = path.join(__dirname, '..', 'public', 'assets', 'sprites');
  
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Start building sprite
  let spriteContent = `<svg xmlns="http://www.w3.org/2000/svg" style="display: none;">`;
  
  for (const icon of royalIcons) {
    const filePath = path.join(testSvgDir, icon.file);
    
    if (fs.existsSync(filePath)) {
      const svgContent = fs.readFileSync(filePath, 'utf8');
      
      // Extract the inner content (remove svg wrapper)
      const match = svgContent.match(/<svg[^>]*>(.*?)<\/svg>/s);
      if (match) {
        const innerSvg = match[1];
        spriteContent += `\n  <symbol id="${icon.id}" viewBox="0 0 64 64">${innerSvg}</symbol>`;
        console.log(`✅ Added ${icon.id} from ${icon.file}`);
      } else {
        console.log(`⚠️  Could not parse ${icon.file}`);
      }
    } else {
      console.log(`⚠️  File not found: ${icon.file}`);
    }
  }
  
  spriteContent += '\n</svg>';
  
  // Generate fingerprint and save
  const hash = generateFingerprint(spriteContent);
  const filename = `royal-icons.${hash}.svg`;
  const outputPath = path.join(outputDir, filename);
  
  fs.writeFileSync(outputPath, spriteContent);
  console.log(`🎭 Royal sprite created: ${filename}`);
  
  // Create a manifest file for easy reference
  const manifest = {
    'royal-icons': filename,
    icons: royalIcons.map(icon => icon.id),
    generated: new Date().toISOString()
  };
  
  fs.writeFileSync(
    path.join(outputDir, 'royal-sprite-manifest.json'), 
    JSON.stringify(manifest, null, 2)
  );
  
  console.log(`📋 Sprite manifest created with ${royalIcons.length} icons`);
  return filename;
};

// Run if called directly
if (require.main === module) {
  buildRoyalSprite().catch(console.error);
}

module.exports = { buildRoyalSprite };