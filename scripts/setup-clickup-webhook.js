// scripts/setup-clickup-webhook.js
// Gestiona el webhook de ClickUp que alimenta el tiempo real de Assignify.
//
// Uso (desde la raíz del proyecto):
//   Listar:      node scripts/setup-clickup-webhook.js
//   Crear:       node scripts/setup-clickup-webhook.js --create
//   Reapuntar:   node scripts/setup-clickup-webhook.js --update <webhook_id>
//   Borrar:      node scripts/setup-clickup-webhook.js --delete <webhook_id>
//
// Lee CLICKUP_API_TOKEN y CLICKUP_TEAM_ID del entorno; si no están, los carga del .env.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const axios = require('axios');

// Carga sencilla del .env si las variables no están ya en el entorno.
if (!process.env.CLICKUP_API_TOKEN && fs.existsSync('.env')) {
  for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}

const TOKEN = process.env.CLICKUP_API_TOKEN;
const TEAM_ID = process.env.CLICKUP_TEAM_ID;
const ENDPOINT = 'https://assignify.vercel.app/api/clickup-webhook';
const EVENTS = ['taskCreated', 'taskUpdated', 'taskDeleted', 'taskStatusUpdated', 'taskAssigneeUpdated'];

if (!TOKEN || !TEAM_ID) {
  console.error('❌ Faltan CLICKUP_API_TOKEN o CLICKUP_TEAM_ID. Verifica tu .env.');
  process.exit(1);
}

const api = axios.create({
  baseURL: 'https://api.clickup.com/api/v2',
  headers: { Authorization: TOKEN, 'Content-Type': 'application/json' },
});

async function list() {
  const { data } = await api.get(`/team/${TEAM_ID}/webhook`);
  const hooks = data.webhooks || [];
  console.log(`\n📋 Webhooks actuales (${hooks.length}):`);
  if (!hooks.length) console.log('   (ninguno — hay que crear uno con --create)');
  hooks.forEach((h) => {
    const ok = h.endpoint === ENDPOINT;
    console.log(`\n  ${ok ? '✅' : '⚠️ '} id: ${h.id}`);
    console.log(`     endpoint: ${h.endpoint}${ok ? '  <- correcto' : '  <- NO apunta a assignify'}`);
    console.log(`     events:   ${Array.isArray(h.events) ? h.events.join(', ') : h.events}`);
    console.log(`     health:   ${h.health && h.health.status} (fallos: ${h.health && h.health.fail_count})`);
  });
  return hooks;
}

async function create() {
  const { data } = await api.post(`/team/${TEAM_ID}/webhook`, { endpoint: ENDPOINT, events: EVENTS });
  const w = data.webhook || data;
  console.log('\n✅ Webhook creado correctamente:');
  console.log(`   id:       ${w.id}`);
  console.log(`   endpoint: ${w.endpoint}`);
  console.log(`\n🔑 IMPORTANTE — copia este secret a CLICKUP_WEBHOOK_SECRET (.env y Vercel):`);
  console.log(`   ${w.secret}`);
}

async function update(id) {
  const { data } = await api.put(`/webhook/${id}`, { endpoint: ENDPOINT, events: EVENTS, status: 'active' });
  const w = data.webhook || data;
  console.log(`\n✅ Webhook ${id} reapuntado a: ${w.endpoint}`);
  console.log('   (el secret se mantiene; no necesitas cambiar CLICKUP_WEBHOOK_SECRET)');
}

async function remove(id) {
  await api.delete(`/webhook/${id}`);
  console.log(`\n🗑️  Webhook ${id} eliminado.`);
}

(async () => {
  try {
    const [cmd, arg] = process.argv.slice(2);
    if (cmd === '--create') { await create(); await list(); }
    else if (cmd === '--update' && arg) { await update(arg); await list(); }
    else if (cmd === '--delete' && arg) { await remove(arg); await list(); }
    else { await list(); }
  } catch (e) {
    console.error('❌ Error en la API de ClickUp:', (e.response && e.response.data) || e.message);
    process.exit(1);
  }
})();
