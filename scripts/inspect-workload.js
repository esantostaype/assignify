// scripts/inspect-workload.js — diagnóstico de la carga por diseñador
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require('@prisma/client');

if (!process.env.DATABASE_URL && fs.existsSync('.env')) {
  for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}
const prisma = new PrismaClient();

(async () => {
  try {
    const now = new Date();
    console.log('HOY:', now.toISOString());
    const users = await prisma.user.findMany({
      where: { active: true },
      include: { tasks: { include: { task: { include: { tier: true } } } } },
      orderBy: { name: 'asc' },
    });
    for (const u of users) {
      const active = u.tasks.map((a) => a.task).filter((t) => t && t.status !== 'COMPLETE');
      const pending = active.filter((t) => t.status === 'TO_DO' || t.status === 'IN_PROGRESS');
      const approval = active.filter((t) => t.status === 'ON_APPROVAL');
      const sumDur = pending.reduce((s, t) => s + (t.customDuration ?? t.tier?.duration ?? 0), 0);
      const pendDeadlines = pending.map((t) => new Date(t.deadline).getTime());
      const maxPending = pendDeadlines.length ? new Date(Math.max(...pendDeadlines)) : null;
      console.log(`\n=== ${u.name} === (PENDIENTES=${pending.length} sumaDur=${sumDur}d · en aprobación=${approval.length})`);
      console.log(`   maxDeadline PENDIENTE = ${maxPending ? maxPending.toISOString() : 'N/A (libre)'}`);
      active
        .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
        .forEach((t) => {
          console.log(`   - "${t.name.slice(0, 40)}" | start=${new Date(t.startDate).toISOString().slice(0,16)} | deadline=${new Date(t.deadline).toISOString().slice(0,16)} | tier.dur=${t.tier?.duration} | custom=${t.customDuration} | status=${t.status}`);
        });
    }
    await prisma.$disconnect();
    process.exit(0);
  } catch (e) {
    console.error('ERROR:', e.message);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
