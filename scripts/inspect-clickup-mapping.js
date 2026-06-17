// scripts/inspect-clickup-mapping.js
// Diagnóstico (solo lectura): compara los Brands de la DB con las listas de ClickUp
// para validar el mapeo automático tarea -> list.id -> brand.
// Uso: node scripts/inspect-clickup-mapping.js

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const axios = require('axios');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require('@prisma/client');

if (!process.env.DATABASE_URL && fs.existsSync('.env')) {
  for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

const prisma = new PrismaClient();
const TOKEN = process.env.CLICKUP_API_TOKEN;
const TEAM_ID = process.env.CLICKUP_TEAM_ID;
const api = axios.create({ baseURL: 'https://api.clickup.com/api/v2', headers: { Authorization: TOKEN } });

(async () => {
  try {
    const brands = await prisma.brand.findMany();
    const brandIds = new Set(brands.map((b) => b.id));
    console.log(`\n=== BRANDS EN DB (${brands.length}) ===`);
    brands.forEach((b) => console.log(`  id=${b.id}  name="${b.name}"  active=${b.isActive}`));

    const taskCount = await prisma.task.count();
    const activeCount = await prisma.task.count({ where: { status: { not: 'COMPLETE' } } });
    const assignmentCount = await prisma.taskAssignment.count();
    console.log(`\n=== DATOS EN DB ===`);
    console.log(`  Tareas: ${taskCount} (${activeCount} activas)`);
    console.log(`  Asignaciones: ${assignmentCount}`);

    console.log(`\n=== LISTAS EN CLICKUP (¿coinciden con brand.id?) ===`);
    const { data: spacesData } = await api.get(`/team/${TEAM_ID}/space?archived=false`);
    for (const space of spacesData.spaces) {
      console.log(`\n  SPACE: "${space.name}" (id=${space.id})`);
      try {
        const { data: sl } = await api.get(`/space/${space.id}/list?archived=false`);
        (sl.lists || []).forEach((l) =>
          console.log(`    LIST(space):  "${l.name}"  id=${l.id}  ${brandIds.has(l.id) ? '✅ MATCH brand' : ''}`)
        );
      } catch (e) { /* sin listas directas */ }
      try {
        const { data: fd } = await api.get(`/space/${space.id}/folder?archived=false`);
        for (const folder of fd.folders || []) {
          console.log(`    FOLDER: "${folder.name}" (id=${folder.id})`);
          const { data: fl } = await api.get(`/folder/${folder.id}/list?archived=false`);
          (fl.lists || []).forEach((l) =>
            console.log(`      LIST: "${l.name}"  id=${l.id}  ${brandIds.has(l.id) ? '✅ MATCH brand' : ''}`)
          );
        }
      } catch (e) { /* sin folders */ }
    }
    await prisma.$disconnect();
    process.exit(0);
  } catch (e) {
    console.error('ERROR:', (e.response && e.response.data) || e.message);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
