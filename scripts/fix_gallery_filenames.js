#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function fixGalleryFilenames() {
  let connection;
  
  try {
    // Database connection
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'phoenix4ge'
    });

    console.log('Connected to database');

    // Get all gallery images
    const [rows] = await connection.execute(`
      SELECT id, filename, section_id 
      FROM gallery_images 
      ORDER BY section_id, order_index
    `);

    console.log(`Found ${rows.length} images to process`);

    let updated = 0;
    let errors = 0;

    for (const row of rows) {
      try {
        const { id, filename, section_id } = row;
        
        // Get the section to find the model slug
        const [sections] = await connection.execute(`
          SELECT m.slug 
          FROM gallery_sections gs 
          JOIN models m ON gs.model_id = m.id 
          WHERE gs.id = ?
        `, [section_id]);

        if (sections.length === 0) {
          console.log(`No section found for image ${id}`);
          continue;
        }

        const modelSlug = sections[0].slug;
        const galleryPath = path.join(__dirname, '..', 'public', 'uploads', modelSlug, 'public', 'gallery');
        
        if (!fs.existsSync(galleryPath)) {
          console.log(`Gallery path doesn't exist: ${galleryPath}`);
          continue;
        }

        // Try to find the actual file
        const baseName = filename.replace(/\.(jpg|png|jpeg)$/i, '');
        const files = fs.readdirSync(galleryPath);
        
        // Look for files that start with the base name
        const matchingFile = files.find(file => {
          const fileBase = file.replace(/\.(jpg|png|jpeg)$/i, '');
          return fileBase.startsWith(baseName) || fileBase === baseName;
        });

        if (matchingFile && matchingFile !== filename) {
          console.log(`Updating ${filename} -> ${matchingFile}`);
          
          await connection.execute(`
            UPDATE gallery_images 
            SET filename = ? 
            WHERE id = ?
          `, [matchingFile, id]);
          
          updated++;
        } else if (matchingFile) {
          console.log(`Filename already correct: ${filename}`);
        } else {
          console.log(`No matching file found for: ${filename}`);
          errors++;
        }

      } catch (error) {
        console.error(`Error processing image ${row.id}:`, error.message);
        errors++;
      }
    }

    console.log(`\nUpdate complete:`);
    console.log(`- Updated: ${updated}`);
    console.log(`- Errors: ${errors}`);
    console.log(`- Total: ${rows.length}`);

  } catch (error) {
    console.error('Database connection error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the script
fixGalleryFilenames().catch(console.error);