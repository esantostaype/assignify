// scripts/fix-vacations-tz.js — normaliza vacaciones guardadas a medianoche UTC
// (bug de zona horaria) llevándolas a mediodía UTC del MISMO día, para que el día
// no se corra al mostrarlas/compararlas en zonas con offset negativo.
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
if (fs.existsSync('.env')) {
  for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}
const prisma = new PrismaClient();
const noon = (d) => { const x = new Date(d); x.setUTCHours(12, 0, 0, 0); return x; };

(async () => {
  try {
    const vacs = await prisma.userVacation.findMany({ include: { user: { select: { name: true } } } });
    console.log(`Vacaciones encontradas: ${vacs.length}`);
    let fixed = 0;
    for (const v of vacs) {
      const s = new Date(v.startDate), e = new Date(v.endDate);
      const needsFix = s.getUTCHours() === 0 || e.getUTCHours() === 0;
      console.log(`  ${v.user?.name}: ${s.toISOString()} → ${e.toISOString()}${needsFix ? '  [CORREGIR]' : ''}`);
      if (needsFix) {
        await prisma.userVacation.update({ where: { id: v.id }, data: { startDate: noon(s), endDate: noon(e) } });
        fixed++;
      }
    }
    console.log(`Corregidas: ${fixed}`);
    await prisma.$disconnect();
    process.exit(0);
  } catch (e) {
    console.error('ERROR:', e.message);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
