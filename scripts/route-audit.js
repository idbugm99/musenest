#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'server.js');
const src = fs.readFileSync(file, 'utf8');

const routeRegex = /app\.(get|post|put|delete|use)\(\s*['"]([^'"]+)['"]/g;
let m;
const rows = [];
while ((m = routeRegex.exec(src))) {
  rows.push({ method: m[1].toUpperCase(), path: m[2] });
}

rows.sort((a,b)=> a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

console.log('Discovered routes in server.js (best-effort):');
for (const r of rows) {
  console.log(`${r.method.padEnd(6)} ${r.path}`);
}

// Simple overlap flags
const map = new Map();
for (const r of rows) {
  const key = `${r.method}:${r.path}`;
  map.set(key, (map.get(key)||0)+1);
}
const dups = Array.from(map.entries()).filter(([_,c])=>c>1);
if (dups.length) {
  console.log('\nPotential duplicates:');
  for (const [k,c] of dups) console.log(` - ${k} x${c}`);
} 