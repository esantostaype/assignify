// scripts/check-types.js — cuenta tareas activas por tipo y por usuario+tipo
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
  const types = await prisma.taskType.findMany();
  console.log('TaskTypes:', types.map((t) => `${t.id}:${t.name}`).join(' | '));
  const tasks = await prisma.task.findMany({
    where: { status: { not: 'COMPLETE' } },
    include: { type: true },
  });
  const byType = {};
  for (const t of tasks) byType[t.type?.name || '??'] = (byType[t.type?.name || '??'] || 0) + 1;
  console.log('\nTareas activas por TIPO:');
  Object.entries(byType).forEach(([k, v]) => console.log(`   ${k}: ${v}`));
  await prisma.$disconnect();
  process.exit(0);
})();
