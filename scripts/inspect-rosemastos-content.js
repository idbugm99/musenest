#!/usr/bin/env node
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.argv[2] || '/Users/programmer/Projects/rosemastos/instance/models.db';

function runQuery(db, sql){
  return new Promise((resolve, reject) => db.all(sql, (err, rows) => err ? reject(err) : resolve(rows)));
}

(async () => {
  const db = new sqlite3.Database(DB_PATH);
  const tables = await runQuery(db, `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`);
  const tableNames = tables.map(t => t.name);
  const interesting = tableNames.filter(n => n.match(/page|content|about|home|contact|gallery|rates|etiquette/i));
  console.log('Tables:', interesting);
  for (const t of interesting){
    const cols = await runQuery(db, `PRAGMA table_info(${t})`);
    console.log(`\n== ${t} ==`);
    console.log(cols.map(c => `${c.name}:${c.type}`).join(', '));
    const sample = await runQuery(db, `SELECT * FROM ${t} LIMIT 2`);
    console.log('Sample:', sample);
  }
  db.close();
})().catch(err => { console.error(err); process.exit(1); });


