#!/usr/bin/env node
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const base = process.env.BASE_URL || 'http://127.0.0.1:3000';
const slug = process.env.MODEL_SLUG || 'modelexample';

async function getJson(url, opts){
  const r = await fetch(url, opts);
  let body = null;
  try { body = await r.json(); } catch { body = null; }
  return { status: r.status, ok: r.ok, body };
}

async function run(){
  const results = [];
  const push = (name, res) => results.push({ name, status: res.status, ok: res.ok && res.body?.success !== false, message: res.body?.message });

  // Content: pages list
  push('content:pages', await getJson(`${base}/api/model-content/${encodeURIComponent(slug)}/pages`));

  // Content: page fields
  push('content:page:1', await getJson(`${base}/api/model-content/${encodeURIComponent(slug)}/pages/1`));

  // Content: audit
  push('content:audit', await getJson(`${base}/api/model-content/${encodeURIComponent(slug)}/audit`));

  // Gallery: sections
  push('gallery:sections', await getJson(`${base}/api/model-gallery/${encodeURIComponent(slug)}/sections`));

  // Gallery: uploads-list
  push('gallery:uploads-list', await getJson(`${base}/api/model-gallery/${encodeURIComponent(slug)}/uploads-list?sub=public/gallery`));

  // Print summary
  const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);
  console.log('\nModel Admin Smoke Test');
  console.log('Base:', base, 'Slug:', slug);
  for (const r of results){
    console.log(`${pad(r.name, 24)} -> ${r.ok ? 'OK ' : 'FAIL'} (${r.status}) ${r.message ? '- ' + r.message : ''}`);
  }
  const fails = results.filter(r => !r.ok).length;
  process.exit(fails ? 1 : 0);
}

run().catch(err => { console.error('Smoke failed:', err); process.exit(2); });


