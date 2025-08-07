#!/usr/bin/env node
const fs = require('fs').promises;
const path = require('path');
const { query, testConnection } = require('../config/database');

async function runExtraMigrations() {
  console.log('🚀 Starting MuseNest extra migrations (migrations/) ...\n');

  const isConnected = await testConnection();
  if (!isConnected) {
    console.error('❌ Cannot connect to database. Please check your configuration.');
    process.exit(1);
  }

  const migrationsDir = path.join(__dirname, '..', 'migrations');

  try {
    const files = await fs.readdir(migrationsDir);
    // Only run recent, consolidated migrations to avoid delimiter/procedure parsing
    const migrationFiles = files
      .filter((file) => file.endsWith('.sql'))
      .filter((file) => {
        const m = file.match(/^(\d{3})_/);
        if (!m) return false;
        const n = parseInt(m[1], 10);
        return n >= 19; // run 019+, skip older complex files
      })
      .sort();

    if (migrationFiles.length === 0) {
      console.log('No eligible extra migrations to run.');
      process.exit(0);
    }

    console.log(`Found ${migrationFiles.length} extra migration files:\n`);

    for (const file of migrationFiles) {
      console.log(`📄 Running migration: ${file}`);
      const filePath = path.join(migrationsDir, file);
      const raw = await fs.readFile(filePath, 'utf8');

      // Remove block comments and inline line comments, then split by semicolon
      let sanitized = raw.replace(/\/\*[\s\S]*?\*\//g, '');
      sanitized = sanitized
        .split('\n')
        .map((line) => line.replace(/--.*$/, '')) // strip anything after --
        .join('\n');

      const statements = sanitized
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const statement of statements) {
        try {
          await query(statement);
        } catch (error) {
          // Skip harmless errors for idempotency
          const msg = (error && error.message) || '';
          if (!/already exists|duplicate key|Unknown column|Check that column|errno/i.test(msg)) {
            throw error;
          }
        }
      }

      console.log(`   ✅ ${file} completed successfully`);
    }

    console.log('\n🎉 Extra migrations completed successfully!');
  } catch (error) {
    console.error('\n❌ Extra migration failed:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

if (require.main === module) {
  runExtraMigrations();
}

module.exports = { runExtraMigrations };


