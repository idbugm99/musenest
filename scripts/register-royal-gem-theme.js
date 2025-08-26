const db = require('../config/database');
const royalGemColors = require('../themes/royal-gem/royal-gem-colors');

const registerRoyalGemTheme = async () => {
  console.log('🎭 Registering Royal Gem Theme...');
  
  try {
    // Check if theme already exists
    const [existingTheme] = await db.execute(`
      SELECT id FROM theme_sets WHERE name = 'royal-gem' LIMIT 1
    `);
    
    let themeSetId;
    
    if (existingTheme.length > 0) {
      themeSetId = existingTheme[0].id;
      console.log(`✅ Royal Gem theme already exists with ID: ${themeSetId}`);
    } else {
      // Create new theme set
      const [themeResult] = await db.execute(`
        INSERT INTO theme_sets (
          name, 
          display_name, 
          description, 
          category, 
          pricing_tier, 
          is_active,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [
        'royal-gem',
        'Royal Gem',
        'Regal luxury with deep jewel tones, gold accents, and velvet elegance. Perfect for exclusive, high-end clientele.',
        'luxury',
        'premium',
        1
      ]);
      
      themeSetId = themeResult.insertId;
      console.log(`✅ Created Royal Gem theme set with ID: ${themeSetId}`);
    }
    
    // Create color palette for the theme
    const [paletteResult] = await db.execute(`
      INSERT INTO color_palettes (
        name,
        display_name, 
        description,
        is_system_palette,
        theme_set_id,
        is_public,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        display_name = VALUES(display_name),
        description = VALUES(description),
        updated_at = NOW()
    `, [
      'royal-gem-default',
      'Royal Gem Default',
      'Deep jewel tones with gold accents - the signature Royal Gem palette',
      1, // system palette
      themeSetId,
      1  // public
    ]);
    
    const paletteId = paletteResult.insertId || paletteResult.insertId;
    console.log(`✅ Created Royal Gem color palette with ID: ${paletteId}`);
    
    // Insert all 17 color tokens
    const colorTokens = [
      ['primary', royalGemColors.colors.primary, 'Deep ruby red (velvet curtain)'],
      ['secondary', royalGemColors.colors.secondary, 'Royal purple (amethyst)'],
      ['accent', royalGemColors.colors.accent, 'Royal gold (champagne)'],
      ['bg', royalGemColors.colors.bg, 'Deep midnight background'],
      ['bg-alt', royalGemColors.colors.bgAlt, 'Slightly lighter midnight'],
      ['surface', royalGemColors.colors.surface, 'Dark plum surface'],
      ['overlay', royalGemColors.colors.overlay, 'Gold overlay with transparency'],
      ['text', royalGemColors.colors.text, 'Warm cream text'],
      ['text-subtle', royalGemColors.colors.textSubtle, 'Muted champagne text'],
      ['link', royalGemColors.colors.link, 'Royal gold links'],
      ['link-hover', royalGemColors.colors.linkHover, 'Brighter gold hover'],
      ['focus', royalGemColors.colors.focus, 'Golden focus ring'],
      ['success', royalGemColors.colors.success, 'Emerald green success'],
      ['warning', royalGemColors.colors.warning, 'Amber warning'],
      ['error', royalGemColors.colors.error, 'Deep red error'],
      ['border', royalGemColors.colors.border, 'Muted purple border'],
      ['border-muted', royalGemColors.colors.borderMuted, 'Subtle border']
    ];
    
    // Clear existing tokens for this palette first
    await db.execute(`
      DELETE FROM color_palette_values WHERE palette_id = ?
    `, [paletteId]);
    
    // Insert new tokens
    for (const [tokenName, tokenValue, description] of colorTokens) {
      await db.execute(`
        INSERT INTO color_palette_values (
          palette_id,
          token_name,
          token_value,
          token_description,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, NOW(), NOW())
      `, [paletteId, tokenName, tokenValue, description]);
    }
    
    console.log(`✅ Inserted ${colorTokens.length} color tokens`);
    
    // Create page mappings for Royal Gem theme
    const pages = ['home', 'about', 'gallery', 'rates', 'contact', 'calendar', 'etiquette'];
    
    for (const pageName of pages) {
      // Get page type ID
      const [pageType] = await db.execute(`
        SELECT id FROM page_types WHERE name = ? LIMIT 1
      `, [pageName]);
      
      if (pageType.length > 0) {
        const pageTypeId = pageType[0].id;
        
        // Insert theme-page mapping
        await db.execute(`
          INSERT INTO theme_set_pages (
            theme_set_id,
            page_type_id,
            template_file,
            has_custom_layout,
            features,
            is_available
          ) VALUES (?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            template_file = VALUES(template_file),
            has_custom_layout = VALUES(has_custom_layout),
            features = VALUES(features)
        `, [
          themeSetId,
          pageTypeId,
          `royal-gem/${pageName}.handlebars`,
          1, // has custom layout
          JSON.stringify({
            royal_icons: true,
            gold_accents: true,
            jewel_tones: true,
            velvet_texture: true,
            candlelight_ambiance: true
          }),
          1 // is available
        ]);
        
        console.log(`✅ Registered ${pageName} page for Royal Gem theme`);
      }
    }
    
    console.log('🎭 Royal Gem theme registration complete!');
    console.log(`📋 Theme ID: ${themeSetId}`);
    console.log(`🎨 Palette ID: ${paletteId}`);
    console.log(`🧪 Test URL: http://localhost:3000/modelexample/about?preview_theme=royal-gem`);
    
    return { themeSetId, paletteId };
    
  } catch (error) {
    console.error('❌ Error registering Royal Gem theme:', error);
    throw error;
  }
};

// Run if called directly
if (require.main === module) {
  registerRoyalGemTheme()
    .then(() => {
      console.log('🎉 Theme registration successful!');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Theme registration failed:', error);
      process.exit(1);
    });
}

module.exports = { registerRoyalGemTheme };