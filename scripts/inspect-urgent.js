// scripts/inspect-urgent.js — lista tareas por prioridad y fechas (para depurar el encolado)
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
if (fs.existsSync('.env')) {
  for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}
const prisma = new PrismaClient();
(async () => {
  try {
    const now = new Date();
    console.log('HOY (servidor):', now.toISOString());
    const tasks = await prisma.task.findMany({
      where: { status: { not: 'COMPLETE' }, deadline: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) } },
      include: { assignees: { include: { user: { select: { name: true } } } } },
      orderBy: [{ priority: 'desc' }, { startDate: 'asc' }],
    });
    console.log(`\nTareas activas (deadline >= hoy): ${tasks.length}`);
    for (const t of tasks) {
      const who = t.assignees.map((a) => a.user?.name).join(', ') || '—';
      console.log(`  [${t.priority}] "${t.name.slice(0, 30)}" | ${new Date(t.startDate).toISOString().slice(0, 10)} → ${new Date(t.deadline).toISOString().slice(0, 10)} | ${who}`);
    }
    await prisma.$disconnect();
    process.exit(0);
  } catch (e) {
    console.error('ERROR:', e.message);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
