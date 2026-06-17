// scripts/sync-deletions.js — reconcilia borrados: elimina de la DB las tareas
// que ya NO existen en ClickUp (p. ej. cuando el webhook taskDeleted no llegó/falló).
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

(async () => {
  try {
    const tasks = await prisma.task.findMany({
      where: { status: { not: 'COMPLETE' } },
      select: { id: true, name: true },
    });
    console.log(`Revisando ${tasks.length} tareas activas contra ClickUp...`);
    let deleted = 0;
    let kept = 0;
    for (const t of tasks) {
      const res = await fetch(`${BASE}/task/${t.id}`, { headers: { Authorization: TOKEN } });
      if (res.status === 404) {
        await prisma.taskAssignment.deleteMany({ where: { taskId: t.id } });
        await prisma.task.delete({ where: { id: t.id } });
        console.log(`  🗑️  "${t.name}" ya no existe en ClickUp → borrada de la DB`);
        deleted++;
      } else if (res.ok) {
        kept++;
      } else {
        console.log(`  ⚠️  "${t.name}" → ClickUp respondió ${res.status} (no se toca)`);
        kept++;
      }
    }
    console.log(`\nBorradas: ${deleted} · intactas: ${kept}`);
    await prisma.$disconnect();
    process.exit(0);
  } catch (e) {
    console.error('ERROR:', e.message);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
