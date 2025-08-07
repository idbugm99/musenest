#!/usr/bin/env node
const db = require('../config/database');

async function main() {
  let ok = true;
  const failures = [];

  async function hasTable(name) {
    try {
      await db.execute(`SELECT 1 FROM ${name} LIMIT 1`);
      return true;
    } catch (e) {
      return false;
    }
  }

  console.log('Verifying database connectivity...');
  try {
    const [versionRows] = await db.execute('SELECT VERSION() as v');
    await db.execute('SELECT 1');
    console.log('✓ Connected');
    if (versionRows && versionRows[0] && versionRows[0].v) {
      console.log('MySQL version:', versionRows[0].v);
    }
  } catch (e) {
    console.error('✗ Cannot connect:', e.message);
    process.exit(1);
  }

  const requiredTables = [
    'models',
    'content_templates',
    'theme_sets',
    'media_review_queue'
  ];

  for (const t of requiredTables) {
    const present = await hasTable(t);
    if (!present) { ok = false; failures.push(`Missing table: ${t}`); }
    console.log(`${present ? '✓' : '✗'} ${t}`);
  }

  if (!ok) {
    console.error('\nFailures:');
    for (const f of failures) console.error(' -', f);
    process.exit(2);
  }

  console.log('\nDB verification PASS');
  process.exit(0);
}

main(); 