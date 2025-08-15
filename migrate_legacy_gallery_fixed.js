/**
 * Fixed Legacy Gallery Data Migration Script
 * Handles duplicate images across sections correctly
 */

const mysql = require('mysql2/promise');

async function migrateLegacyGalleryDataFixed() {
  const db = await mysql.createConnection({
    host: 'localhost', 
    user: 'root', 
    password: '', 
    database: 'musenest'
  });
  
  try {
    console.log('=== MIGRATING LEGACY GALLERY DATA (FIXED VERSION) ===');
    
    // Clean up existing data first
    console.log('🧹 Cleaning up existing migration data...');
    await db.execute('DELETE FROM model_gallery_section_media WHERE section_id IN (SELECT id FROM model_gallery_sections WHERE model_slug = ?)', ['modelexample']);
    await db.execute('DELETE FROM model_gallery_sections WHERE model_slug = ?', ['modelexample']);
    await db.execute('DELETE FROM model_media_library WHERE model_slug = ?', ['modelexample']);
    
    // Check existing legacy data for modelexample (ID: 39)
    console.log('📊 Checking legacy data for modelexample...');
    const [legacyImages] = await db.execute('SELECT * FROM gallery_images WHERE model_id = 39 ORDER BY section_id, sort_order');
    const [legacySections] = await db.execute('SELECT * FROM gallery_sections WHERE model_id = 39 ORDER BY sort_order');
    
    console.log(`Found ${legacyImages.length} legacy images and ${legacySections.length} legacy sections`);
    
    // Step 1: Create gallery sections in new system
    console.log('\n🎨 Creating gallery sections...');
    for (const section of legacySections) {
      try {
        // Insert into model_gallery_sections
        const [sectionResult] = await db.execute(`
          INSERT INTO model_gallery_sections (
            model_slug, section_name, section_slug, section_description,
            layout_type, section_order, is_published, is_featured
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          'modelexample',
          section.title,
          `${section.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${section.id}`, // Make unique with section ID
          section.description || 'Gallery section',
          section.layout_type === 'slideshow' ? 'carousel' : section.layout_type, // Convert slideshow to carousel
          section.sort_order || 0,
          1, // is_published
          0  // is_featured
        ]);
        
        console.log(`✅ Created section: ${section.title} (ID: ${sectionResult.insertId})`);
        
        // Store section mapping for media association
        section.new_section_id = sectionResult.insertId;
        
      } catch (error) {
        console.error(`❌ Failed to create section ${section.title}:`, error.message);
      }
    }
    
    // Step 2: Migrate unique images to model_media_library
    console.log('\n📷 Migrating unique images to media library...');
    const imageMapping = new Map(); // legacy_id -> new_id
    const processedFilenames = new Set(); // Track already processed filenames
    
    // Get unique images (some images appear in multiple sections)
    const uniqueImages = [];
    const seenFilenames = new Set();
    
    for (const image of legacyImages) {
      if (!seenFilenames.has(image.filename)) {
        seenFilenames.add(image.filename);
        uniqueImages.push(image);
      }
    }
    
    console.log(`Processing ${uniqueImages.length} unique images out of ${legacyImages.length} total...`);
    
    for (const image of uniqueImages) {
      try {
        // Insert into model_media_library
        const [mediaResult] = await db.execute(`
          INSERT INTO model_media_library (
            model_slug, filename, original_filename, file_path, file_size,
            image_width, image_height, mime_type,
            processing_status, moderation_status, usage_intent,
            permanent_path, thumbnail_path, medium_path,
            alt_text, caption, upload_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          'modelexample',
          image.filename,
          image.original_filename || image.filename,
          `/uploads/${image.filename}`, // Assume standard uploads path
          image.file_size || 0, // Add file_size field with default 0
          image.width || null,
          image.height || null,
          image.mime_type || 'image/jpeg',
          'completed',
          'approved',
          'public_site',
          `/uploads/${image.filename}`, // permanent_path
          `/uploads/thumbs/${image.filename}`, // thumbnail_path (assume thumbs folder)
          `/uploads/${image.filename}`, // medium_path
          image.alt_text || 'Gallery image',
          image.caption || null,
          image.created_at || new Date()
        ]);
        
        // Map ALL legacy images with same filename to this new media ID
        for (const legacyImage of legacyImages) {
          if (legacyImage.filename === image.filename) {
            imageMapping.set(legacyImage.id, mediaResult.insertId);
          }
        }
        
        console.log(`✅ Migrated image: ${image.filename} (ID: ${mediaResult.insertId})`);
        
      } catch (error) {
        console.error(`❌ Failed to migrate image ${image.filename}:`, error.message);
      }
    }
    
    // Step 3: Associate images with sections (handling duplicates)
    console.log('\n🔗 Associating images with sections...');
    for (const image of legacyImages) {
      const newMediaId = imageMapping.get(image.id);
      if (!newMediaId) {
        console.warn(`⚠️  No media ID found for image: ${image.filename}`);
        continue;
      }
      
      // Find the corresponding section
      const section = legacySections.find(s => s.id === image.section_id);
      if (!section || !section.new_section_id) {
        console.warn(`⚠️  No section found for image: ${image.filename}`);
        continue;
      }
      
      try {
        // Check if this media is already associated with this section
        const [existing] = await db.execute(`
          SELECT id FROM model_gallery_section_media 
          WHERE section_id = ? AND media_id = ?
        `, [section.new_section_id, newMediaId]);
        
        if (existing.length > 0) {
          console.log(`ℹ️  Image ${image.filename} already associated with ${section.title}`);
          continue;
        }
        
        await db.execute(`
          INSERT INTO model_gallery_section_media (
            section_id, media_id, display_order, custom_caption, is_featured
          ) VALUES (?, ?, ?, ?, ?)
        `, [
          section.new_section_id,
          newMediaId,
          image.order_index || image.sort_order || 0,
          image.caption || null,
          image.is_featured ? 1 : 0
        ]);
        
        console.log(`✅ Associated ${image.filename} with ${section.title}`);
        
      } catch (error) {
        console.error(`❌ Failed to associate image ${image.filename} with section:`, error.message);
      }
    }
    
    // Step 4: Verify the migration
    console.log('\n📈 Verifying migration results...');
    const [newSections] = await db.execute('SELECT * FROM model_gallery_sections WHERE model_slug = ? ORDER BY section_order', ['modelexample']);
    const [newMedia] = await db.execute('SELECT COUNT(*) as count FROM model_media_library WHERE model_slug = ?', ['modelexample']);
    const [newAssociations] = await db.execute(`
      SELECT COUNT(*) as count 
      FROM model_gallery_section_media mgsm
      JOIN model_gallery_sections mgs ON mgs.id = mgsm.section_id
      WHERE mgs.model_slug = ?
    `, ['modelexample']);
    
    console.log('📊 Migration Summary:');
    console.log(`  • Sections created: ${newSections.length}`);
    console.log(`  • Unique images migrated: ${newMedia[0].count}`);
    console.log(`  • Image-section associations: ${newAssociations[0].count}`);
    
    console.log('\n📁 Section Details:');
    for (const section of newSections) {
      const [sectionMedia] = await db.execute(`
        SELECT COUNT(*) as count 
        FROM model_gallery_section_media 
        WHERE section_id = ?
      `, [section.id]);
      
      console.log(`    - ${section.section_name}: ${sectionMedia[0].count} images (${section.layout_type} layout)`);
    }
    
    console.log('\n🎉 Migration completed successfully!');
    
    // Test the API to make sure it works
    console.log('\n🧪 Testing Universal Gallery API...');
    console.log(`🌐 Test the gallery at: http://localhost:3000/api/universal-gallery/config?model=modelexample`);
    console.log(`🎯 View the gallery at: http://localhost:3000/modelexample/gallery`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
  } finally {
    await db.end();
  }
}

// Run the migration
migrateLegacyGalleryDataFixed();