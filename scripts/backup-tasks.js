// scripts/backup-tasks.js
// Exporta todas las Task + relaciones a backups/ como red de seguridad.
// Uso: node scripts/backup-tasks.js   (correr ANTES de migrar el schema)

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
    const tasks = await prisma.task.findMany({
      include: {
        assignees: { include: { user: true } },
        category: { include: { tierList: true, type: true } },
        brand: true,
        type: true,
      },
    });
    if (!fs.existsSync('backups')) fs.mkdirSync('backups');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = `backups/tasks-${stamp}.json`;
    fs.writeFileSync(file, JSON.stringify(tasks, null, 2));
    console.log(`✅ Backup de ${tasks.length} tareas guardado en ${file}`);
    await prisma.$disconnect();
    process.exit(0);
  } catch (e) {
    console.error('❌ Error en backup:', e.message);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
