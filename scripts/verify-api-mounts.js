#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'server.js');
const apiDir = path.join(__dirname, '..', 'routes', 'api');

function read(file) { return fs.readFileSync(file, 'utf8'); }

function main() {
  const src = read(serverPath);
  const mountRegex = /app\.use\(\s*['"](\/api\/[^'\"]+)['"]\s*,\s*require\(\s*['"]\.\/(?:src\/)?routes\/(?:api\/)?.*?['"]\s*\)\s*\)/g;
  const mounts = [];
  let m;
  while ((m = mountRegex.exec(src))) {
    mounts.push(m[1]);
  }

  const files = fs.readdirSync(apiDir).filter(f => f.endsWith('.js'));
  const expected = files.map(f => `/api/${f.replace(/\.js$/, '')}`);

  // Normalize dashes vs underscores in expectations
  const normalize = (s) => s.replace(/_/g, '-');
  const normalizedMounts = new Set(mounts.map(normalize));

  const missingMounts = expected.filter(e => !normalizedMounts.has(normalize(e)));
  const okFiles = expected.filter(e => normalizedMounts.has(normalize(e)));

  console.log('API mount check:');
  console.log(' Mounted:', mounts.length);
  console.log(' Expected from routes/api:', files.length);
  if (okFiles.length) {
    console.log('\nOK mounts:');
    okFiles.sort().forEach(v => console.log(' -', v));
  }
  if (missingMounts.length) {
    console.log('\nMissing mounts for:');
    missingMounts.sort().forEach(v => console.log(' -', v));
  }

  // Validate router structure for each file
  const issues = [];
  for (const f of files) {
    const src = read(path.join(apiDir, f));
    if (!/express\.Router\(/.test(src)) issues.push(`${f}: missing express.Router()`);
    if (!/module\.exports\s*=\s*router/.test(src)) issues.push(`${f}: missing module.exports = router`);
  }

  if (issues.length) {
    console.log('\nRouter structure issues:');
    for (const i of issues) console.log(' -', i);
    process.exitCode = 2;
  } else if (missingMounts.length) {
    process.exitCode = 2;
  } else {
    console.log('\nAPI mounts verification PASS');
  }
}

main();


