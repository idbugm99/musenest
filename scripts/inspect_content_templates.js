#!/usr/bin/env node
const { query } = require('../config/database');

async function run(){
  const slug = process.argv[2] || 'modelexample';
  const pageTypeId = parseInt(process.argv[3] || '1', 10);
  console.log('Inspecting content for', { slug, pageTypeId });
  const models = await query('SELECT id, name FROM models WHERE slug = ? LIMIT 1', [slug]);
  if (!models.length){
    console.error('Model not found');
    process.exit(1);
  }
  const modelId = models[0].id;
  const rows = await query('SELECT content_key, content_value, content_type, updated_at FROM content_templates WHERE model_id = ? AND page_type_id = ? ORDER BY content_key', [modelId, pageTypeId]);
  console.table(rows);
  process.exit(0);
}

run().catch(e=>{ console.error(e); process.exit(1); });


