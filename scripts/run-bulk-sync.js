// scripts/run-bulk-sync.js — llena la DB de Prisma con las tareas activas de ClickUp.
// Replica la lógica de clickup-sync.service.ts (upsertTaskFromClickUp + bulkSyncAllTasks)
// para poder ejecutarla localmente contra DATABASE_URL del .env.
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

if (fs.existsSync('.env')) {
  for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}
const prisma = new PrismaClient();
const TOKEN = process.env.CLICKUP_API_TOKEN;
const BASE = 'https://api.clickup.com/api/v2';

function mapStatus(s) {
  s = (s || '').toLowerCase().trim();
  if (s.includes('approval') || s.includes('review') || s.includes('qa') || s.includes('testing') || s.includes('check')) return 'ON_APPROVAL';
  if (s.includes('progress') || s.includes('active') || s.includes('working') || s.includes('development') || s.includes('doing')) return 'IN_PROGRESS';
  if (s.includes('done') || s.includes('complete') || s.includes('finished') || s.includes('closed') || s.includes('resolved') || s.includes('delivered') || s.includes('merged') || s.includes('deployed')) return null;
  if (s.includes('to do') || s.includes('todo') || s.includes('open') || s.includes('backlog') || s.includes('new') || s.includes('pending') || s.includes('ready')) return 'TO_DO';
  return 'TO_DO';
}
function mapPriority(p) {
  const map = { urgent: 'URGENT', high: 'HIGH', normal: 'NORMAL', low: 'LOW' };
  return map[(p || '').toLowerCase()] || 'NORMAL';
}

async function syncAssignees(taskId, assignees) {
  const ids = [];
  for (const a of assignees || []) {
    const uid = String(a.id);
    const u = await prisma.user.findUnique({ where: { id: uid } });
    if (u) ids.push(uid);
  }
  await prisma.taskAssignment.deleteMany({ where: { taskId } });
  if (ids.length) {
    await prisma.taskAssignment.createMany({ data: ids.map((userId) => ({ taskId, userId })), skipDuplicates: true });
  }
}

(async () => {
  try {
    const defaultTier = await prisma.tierList.findFirst({ where: { name: 'D' } });
    let defaultType = await prisma.taskType.findFirst({ where: { name: 'General Design' } });
    if (!defaultType) defaultType = await prisma.taskType.findFirst();
    const tierId = defaultTier?.id;
    const typeId = defaultType?.id;

    const brands = await prisma.brand.findMany({ where: { isActive: true } });
    const summary = { created: 0, updated: 0, completed: 0, skipped: 0, total: 0 };

    for (const brand of brands) {
      let page = 0, hasMore = true;
      while (hasMore && page < 20) {
        const res = await fetch(`${BASE}/list/${brand.id}/task?archived=false&page=${page}&include_closed=false&subtasks=true`, { headers: { Authorization: TOKEN } });
        const tasks = (await res.json()).tasks || [];
        for (const ct of tasks) {
          summary.total++;
          const localStatus = mapStatus(ct.status?.status || '');
          const existing = await prisma.task.findUnique({ where: { id: ct.id } });
          if (localStatus === null) {
            if (existing) { await prisma.task.update({ where: { id: ct.id }, data: { status: 'COMPLETE', syncStatus: 'SYNCED', lastSyncAt: new Date() } }); summary.completed++; }
            else summary.skipped++;
            continue;
          }
          if (!ct.start_date || !ct.due_date) { summary.skipped++; continue; }
          const data = {
            name: ct.name,
            description: ct.description || ct.text_content || null,
            status: localStatus,
            priority: mapPriority(ct.priority?.priority),
            startDate: new Date(parseInt(ct.start_date)),
            deadline: new Date(parseInt(ct.due_date)),
            timeEstimate: ct.time_estimate ? Math.round(ct.time_estimate / 3600000) : null,
            url: ct.url ?? null,
            brandId: brand.id,
            lastSyncAt: new Date(),
            syncStatus: 'SYNCED',
          };
          if (existing) {
            await prisma.task.update({ where: { id: ct.id }, data });
            await syncAssignees(ct.id, ct.assignees);
            summary.updated++;
          } else {
            if (!tierId || !typeId) { summary.skipped++; continue; }
            await prisma.task.create({ data: { id: ct.id, ...data, tierId, typeId } });
            await syncAssignees(ct.id, ct.assignees);
            summary.created++;
          }
        }
        hasMore = tasks.length >= 100;
        page++;
      }
    }
    console.log('RESUMEN sync masiva:', JSON.stringify(summary, null, 2));
    const total = await prisma.task.count();
    const active = await prisma.task.count({ where: { status: { not: 'COMPLETE' } } });
    console.log(`DB ahora: ${total} tareas (${active} activas)`);
    await prisma.$disconnect();
    process.exit(0);
  } catch (e) {
    console.error('ERROR:', e.message);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
