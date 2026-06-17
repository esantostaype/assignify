// scripts/inspect-clickup-load.js — agrupa tareas activas de ClickUp por asignado y estado
const fs = require('fs');
if (!process.env.CLICKUP_API_TOKEN && fs.existsSync('.env')) {
  for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}
const TOKEN = process.env.CLICKUP_API_TOKEN;
const BASE = 'https://api.clickup.com/api/v2';
const BRANDS = ['901700182493', '901700182489', '901704229078']; // Inszone, R.E. Chaix, Pinney

function mapStatus(s) {
  s = (s || '').toLowerCase();
  if (s.includes('approval') || s.includes('review')) return 'ON_APPROVAL';
  if (s.includes('progress') || s.includes('doing') || s.includes('active')) return 'IN_PROGRESS';
  if (s.includes('done') || s.includes('complete') || s.includes('closed')) return null;
  return 'TO_DO';
}

(async () => {
  const byUser = {};
  for (const listId of BRANDS) {
    const res = await fetch(`${BASE}/list/${listId}/task?archived=false&include_closed=false&subtasks=true`, {
      headers: { Authorization: TOKEN },
    });
    const tasks = (await res.json()).tasks || [];
    for (const t of tasks) {
      const st = mapStatus(t.status?.status);
      if (!st || !t.start_date || !t.due_date) continue;
      for (const a of t.assignees || []) {
        const k = a.username;
        byUser[k] = byUser[k] || { TO_DO: 0, IN_PROGRESS: 0, ON_APPROVAL: 0 };
        byUser[k][st]++;
      }
    }
  }
  console.log('=== Carga por asignado (tareas activas con fecha, en brands) ===');
  Object.entries(byUser)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([name, c]) => {
      const pend = c.TO_DO + c.IN_PROGRESS;
      console.log(`   ${name}: PENDIENTES=${pend} (todo=${c.TO_DO}, curso=${c.IN_PROGRESS}) · aprobación=${c.ON_APPROVAL}`);
    });
})();
