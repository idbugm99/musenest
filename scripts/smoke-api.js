#!/usr/bin/env node
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

async function hit(name, url) {
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  const text = await res.text();
  const ok = res.status === 200 && (text.startsWith('{') || text.startsWith('['));
  console.log(`${name}: ${res.status} ${ok ? 'OK' : 'FAIL'} ${url}`);
  if (!ok) {
    console.log(text.slice(0, 300));
    process.exitCode = 1;
  }
}

(async () => {
  const base = 'http://127.0.0.1:3000';
  await hit('Ping', `${base}/_ping`);
  await hit('Health', `${base}/health`);
  await hit('Sys models', `${base}/api/sysadmin/models`);
  await hit('Sys AI servers', `${base}/api/sysadmin/ai-servers/servers`);
  await hit('Sys clients', `${base}/api/sysadmin/system/clients?page=1&limit=1`);
  await hit('Media queue', `${base}/api/sysadmin/media-review/queue?status=pending&page=1&limit=1`);
  await hit('CM queue', `${base}/api/content-moderation/queue?page=1&limit=1`);
  await hit('Site configs basic', `${base}/api/sysadmin/site-configuration/sites-basic?page=1&limit=1`);
  await hit('Site configs join', `${base}/api/sysadmin/site-configuration/sites?page=1&limit=1`);
})();
