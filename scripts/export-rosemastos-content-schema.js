#!/usr/bin/env node
/**
 * Export RoseMastos content-related schema and sample values to CSV
 */
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = '/Users/programmer/Projects/rosemastos/instance/models.db';
const OUT_DIR = path.join(__dirname, '..', 'docs');
const OUT_FILE = path.join(OUT_DIR, 'rosemastos_content_schema.csv');

const CONTENT_TABLE_REGEX = /(content|rates|gallery|page|site_page|template_pages|site|templates?)/i;

async function main(){
  if (!fs.existsSync(DB_PATH)){
    console.error('SQLite DB not found at', DB_PATH);
    process.exit(1);
  }
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const db = new sqlite3.Database(DB_PATH);

  const allTables = await queryAll(db, "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
  const tableNames = allTables.map(r => r.name).filter(n => CONTENT_TABLE_REGEX.test(n));

  const header = ['table_name','column_name','data_type','notnull','default_value','pk','sample_value'];
  const rows = [header.join(',')];

  for (const table of tableNames){
    const columns = await queryAll(db, `PRAGMA table_info(${escapeIdent(table)})`);
    const sample = await queryAll(db, `SELECT * FROM ${escapeIdent(table)} LIMIT 1`);
    const sampleRow = sample[0] || {};
    for (const col of columns){
      const sampleValue = sampleRow[col.name];
      rows.push([
        csv(table),
        csv(col.name),
        csv(col.type || ''),
        csv(String(col.notnull || 0)),
        csv(col.dflt_value == null ? '' : String(col.dflt_value)),
        csv(String(col.pk || 0)),
        csv(sampleValue == null ? '' : String(sampleValue))
      ].join(','));
    }
  }

  fs.writeFileSync(OUT_FILE, rows.join('\n'), 'utf8');
  console.log('✅ Wrote', OUT_FILE, `(${rows.length-1} columns)`);

  db.close();
}

function queryAll(db, sql){
  return new Promise((resolve, reject) => {
    db.all(sql, (err, rows) => err ? reject(err) : resolve(rows || []));
  });
}

function escapeIdent(name){
  // minimal quoting for identifiers
  return '`' + String(name).replace(/`/g, '``') + '`';
}

function csv(value){
  const s = String(value).replace(/"/g, '""');
  if (/[",\n]/.test(s)) return '"' + s + '"';
  return s;
}

if (require.main === module){
  main().catch(err => { console.error('❌ Export failed:', err.message); process.exit(1); });
}


