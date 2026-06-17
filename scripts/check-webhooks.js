// scripts/check-webhooks.js — lista los webhooks registrados en ClickUp.
const fs = require('fs');
if (fs.existsSync('.env')) {
  for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}
const TOKEN = process.env.CLICKUP_API_TOKEN;
const BASE = 'https://api.clickup.com/api/v2';

(async () => {
  const teams = (await (await fetch(`${BASE}/team`, { headers: { Authorization: TOKEN } })).json()).teams || [];
  for (const team of teams) {
    console.log(`\n=== Team ${team.name} (${team.id}) ===`);
    const res = await fetch(`${BASE}/team/${team.id}/webhook`, { headers: { Authorization: TOKEN } });
    const data = await res.json();
    const hooks = data.webhooks || [];
    if (!hooks.length) { console.log('   (sin webhooks registrados)'); continue; }
    for (const h of hooks) {
      console.log(`   id=${h.id}`);
      console.log(`     endpoint = ${h.endpoint}`);
      console.log(`     events   = ${Array.isArray(h.events) ? h.events.join(',') : h.events}`);
      console.log(`     health   = ${JSON.stringify(h.health)}`);
    }
  }
})();
