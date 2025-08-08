#!/usr/bin/env node
const fs = require('fs').promises;
const path = require('path');
const db = require('../config/database');

async function getModelBySlug(slug){
  const rows = await db.query('SELECT id, slug, name FROM models WHERE slug = ? LIMIT 1', [slug]);
  return rows && rows[0] ? rows[0] : null;
}

async function ensureDefaultSection(modelId){
  const rows = await db.query('SELECT id FROM gallery_sections WHERE model_id = ? ORDER BY id ASC LIMIT 1', [modelId]);
  if (rows.length) return rows[0].id;
  const result = await db.query('INSERT INTO gallery_sections (model_id, title, layout_type, sort_order) VALUES (?, ?, ?, ?)', [modelId, 'Portfolio', 'grid', 0]);
  return result.insertId;
}

async function run(){
  const slug = process.argv[2] || process.env.MODEL_SLUG || 'modelexample';
  const dryRun = process.argv.includes('--dry');
  if (!slug) { console.error('Usage: node scripts/backfill_gallery.js <model-slug> [--dry]'); process.exit(1); }
  const model = await getModelBySlug(slug);
  if (!model) { console.error('Model not found:', slug); process.exit(1); }
  const root = path.join(process.cwd(), 'public', 'uploads', slug, 'public', 'gallery');
  try { await fs.access(root); } catch (e) { if (e.code === 'ENOENT') { console.log('No gallery folder; nothing to backfill.'); return; } throw e; }
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files = entries.filter(e => e.isFile()).map(e => e.name);
  if (!files.length) { console.log('No files found.'); return; }
  const sectionId = await ensureDefaultSection(model.id);
  console.log(`Backfilling ${files.length} file(s) into section ${sectionId} for model ${slug}${dryRun?' (dry-run)':''}`);
  let inserted = 0;
  for (const [idx, name] of files.entries()){
    const exists = await db.query('SELECT id FROM gallery_images WHERE model_id = ? AND filename = ? LIMIT 1', [model.id, name]);
    if (exists.length) continue;
    if (dryRun) { inserted++; continue; }
    const [{ nextOrder }] = await db.query('SELECT COALESCE(MAX(order_index), -1) + 1 AS nextOrder FROM gallery_images WHERE model_id = ? AND section_id = ?', [model.id, sectionId]);
    await db.query('INSERT INTO gallery_images (section_id, model_id, filename, is_active, order_index) VALUES (?, ?, ?, 1, ?)', [sectionId, model.id, name, nextOrder || 0]);
    inserted++;
    if (idx % 50 === 0) console.log(`... ${inserted} inserted so far`);
  }
  console.log(`Done. Inserted ${inserted} new record(s).`);
  process.exit(0);
}

run().catch(err => { console.error('Backfill failed:', err.message); process.exit(2); });


