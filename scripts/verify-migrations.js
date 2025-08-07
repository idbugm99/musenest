#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function main() {
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.log('No migrations directory found.');
    process.exit(0);
  }

  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
  const byPrefix = new Map();

  for (const f of files) {
    const match = f.match(/^(\d{3})_/);
    if (!match) continue;
    const prefix = match[1];
    if (!byPrefix.has(prefix)) byPrefix.set(prefix, []);
    byPrefix.get(prefix).push(f);
  }

  let ok = true;
  for (const [prefix, group] of byPrefix.entries()) {
    if (group.length > 1) {
      ok = false;
      console.warn(`⚠️  Duplicate/variant migrations for ${prefix}:`);
      for (const g of group) console.warn('   -', g);
    }
  }

  if (!ok) {
    console.log('\nRecommendation: consolidate or clearly mark superseded variants and update migrations/INDEX.md.');
    process.exit(2);
  }

  console.log('Migrations verification PASS');
}

main();


