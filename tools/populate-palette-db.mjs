import fs from "node:fs";
import mysql from "mysql2/promise";

// Load the palette defaults we generated
const paletteDefaults = JSON.parse(fs.readFileSync("reports/palette-defaults.json", "utf8"));

// Connect to database
const db = await mysql.createConnection({
  host: 'localhost',
  user: 'root', 
  password: '',
  database: 'phoenix4ge'
});

console.log('🎨 Populating database with palette defaults...');

try {
  // First, get the theme_set_id mapping
  const [themes] = await db.execute('SELECT id, name FROM theme_sets');
  const themeMap = {};
  themes.forEach(theme => {
    themeMap[theme.name] = theme.id;
  });
  
  console.log('📋 Found themes:', Object.keys(themeMap));
  
  // Insert palette defaults for themes we analyzed
  for (const [themeName, tokens] of Object.entries(paletteDefaults)) {
    const themeId = themeMap[themeName];
    
    if (!themeId) {
      console.log(`⚠️  Theme '${themeName}' not found in database, skipping...`);
      continue;
    }
    
    console.log(`🎨 Processing theme: ${themeName} (ID: ${themeId})`);
    
    for (const [tokenName, tokenData] of Object.entries(tokens)) {
      try {
        // Insert or update the palette entry
        await db.execute(`
          INSERT INTO theme_default_palettes 
          (theme_set_id, token_name, token_value, confidence, source_count, example_files) 
          VALUES (?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE 
          token_value = VALUES(token_value),
          confidence = VALUES(confidence),
          source_count = VALUES(source_count),
          example_files = VALUES(example_files),
          updated_at = CURRENT_TIMESTAMP
        `, [
          themeId, 
          tokenName, 
          tokenData.value, 
          tokenData.confidence, 
          tokenData.count,
          tokenData.sources.join(', ')
        ]);
        
      } catch (error) {
        console.error(`❌ Error inserting ${themeName}.${tokenName}:`, error.message);
      }
    }
    
    console.log(`✅ Completed ${themeName}: ${Object.keys(tokens).length} tokens`);
  }
  
  // Verify what we inserted
  const [counts] = await db.execute(`
    SELECT ts.name as theme_name, COUNT(tdp.id) as token_count 
    FROM theme_sets ts 
    LEFT JOIN theme_default_palettes tdp ON ts.id = tdp.theme_set_id 
    GROUP BY ts.id, ts.name 
    ORDER BY ts.name
  `);
  
  console.log('\n📊 Final token counts by theme:');
  counts.forEach(row => {
    console.log(`  ${row.theme_name}: ${row.token_count} tokens`);
  });
  
  // Show sample of what was inserted
  console.log('\n🔍 Sample palette entries:');
  const [sample] = await db.execute(`
    SELECT ts.name as theme, tdp.token_name, tdp.token_value, tdp.confidence 
    FROM theme_default_palettes tdp 
    JOIN theme_sets ts ON tdp.theme_set_id = ts.id 
    WHERE tdp.confidence != 'generated' 
    ORDER BY ts.name, tdp.token_name 
    LIMIT 10
  `);
  
  sample.forEach(row => {
    console.log(`  ${row.theme}.${row.token_name}: ${row.token_value} (${row.confidence})`);
  });
  
  console.log('\n✅ Palette database population complete!');
  
} catch (error) {
  console.error('❌ Database error:', error);
} finally {
  await db.end();
}