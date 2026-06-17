// scripts/inspect-sync.js — compara ClickUp (fuente real) vs DB local
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

if (!process.env.DATABASE_URL && fs.existsSync('.env')) {
  for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}
const prisma = new PrismaClient();
const TOKEN = process.env.CLICKUP_API_TOKEN;
const BASE = 'https://api.clickup.com/api/v2';

(async () => {
  try {
    // 1. Conteo de tareas locales por status
    const byStatus = await prisma.task.groupBy({ by: ['status'], _count: true });
    console.log('=== Tareas en DB local por status ===');
    byStatus.forEach((s) => console.log(`   ${s.status}: ${s._count}`));
    const totalLocal = await prisma.task.count();
    console.log(`   TOTAL = ${totalLocal}`);

    // 2. Brands
    const brands = await prisma.brand.findMany();
    console.log(`\n=== Brands en DB (${brands.length}) ===`);
    brands.forEach((b) => console.log(`   ${b.id} | ${b.name} | activo=${b.isActive}`));

    // 3. Por cada brand activo: cuántas tareas activas hay en ClickUp vs en local
    console.log(`\n=== ClickUp vs Local (por brand activo) ===`);
    for (const b of brands.filter((x) => x.isActive)) {
      let cuTotal = 0;
      let cuActive = 0;
      try {
        const res = await fetch(`${BASE}/list/${b.id}/task?archived=false&include_closed=false&subtasks=true`, {
          headers: { Authorization: TOKEN },
        });
        const data = await res.json();
        const tasks = data.tasks || [];
        cuTotal = tasks.length;
        cuActive = tasks.filter((t) => {
          const s = (t.status?.status || '').toLowerCase();
          return !(s.includes('done') || s.includes('complete') || s.includes('closed'));
        }).length;
      } catch (e) {
        console.log(`   ${b.name}: ERROR ClickUp ${e.message}`);
        continue;
      }
      const localActive = await prisma.task.count({
        where: { brandId: b.id, status: { not: 'COMPLETE' } },
      });
      console.log(`   ${b.name} (${b.id}): ClickUp activas=${cuActive}/${cuTotal} | Local activas=${localActive}`);
    }

    await prisma.$disconnect();
    process.exit(0);
  } catch (e) {
    console.error('ERROR:', e.message);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
