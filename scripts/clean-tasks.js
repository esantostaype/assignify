// scripts/clean-tasks.js
// Borra TODAS las Task y TaskAssignment (deja intactos brands/users/tiers/types/roles).
// Necesario antes de migrar el schema (tierId NOT NULL requiere la tabla vacía).
// Uso: node scripts/clean-tasks.js

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
    const a = await prisma.taskAssignment.deleteMany();
    const t = await prisma.task.deleteMany();
    console.log(`✅ Borradas ${a.count} asignaciones y ${t.count} tareas.`);
    await prisma.$disconnect();
    process.exit(0);
  } catch (e) {
    console.error('❌ Error limpiando tareas:', e.message);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
