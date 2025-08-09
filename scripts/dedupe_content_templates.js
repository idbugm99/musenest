#!/usr/bin/env node
/**
 * Remove duplicate content_templates rows for the same (model_id, page_type_id, content_key)
 * Retain the most recently updated row, delete others.
 */
const { query, transaction } = require('../config/database');

async function run(){
  console.log('🔎 Scanning for duplicate content rows...');
  const dups = await query(`
    SELECT model_id, page_type_id, content_key, COUNT(*) AS cnt
    FROM content_templates
    GROUP BY model_id, page_type_id, content_key
    HAVING cnt > 1
  `);
  if (!dups.length){
    console.log('✅ No duplicates found');
    process.exit(0);
  }
  console.log(`Found ${dups.length} duplicated keys.`);
  let totalDeleted = 0;
  for (const row of dups){
    const rows = await query(
      `SELECT id FROM content_templates
       WHERE model_id = ? AND page_type_id = ? AND content_key = ?
       ORDER BY updated_at DESC, id DESC`,
      [row.model_id, row.page_type_id, row.content_key]
    );
    const keepId = rows[0].id;
    const toDelete = rows.slice(1).map(r => r.id);
    if (toDelete.length){
      const placeholders = toDelete.map(()=>'?').join(',');
      await query(`DELETE FROM content_templates WHERE id IN (${placeholders})`, toDelete);
      totalDeleted += toDelete.length;
      console.log(`🧹 ${row.model_id}:${row.page_type_id}:${row.content_key} → kept ${keepId}, deleted ${toDelete.length}`);
    }
  }
  console.log(`✅ Done. Deleted ${totalDeleted} duplicate rows.`);
  process.exit(0);
}

run().catch(e=>{ console.error('❌ Dedupe failed:', e); process.exit(1); });


