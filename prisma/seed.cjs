/* eslint-disable @typescript-eslint/no-require-imports */
// prisma/seed.cjs - modelo Tarea = Tipo + Tier (sin categorías)
// Ejecutar con: npx prisma db seed

const { PrismaClient, Tier } = require("@prisma/client");

let prisma;

// Duraciones por defecto (en días) para cada Tier
const tierDurations = {
  S: 5,
  A: 3,
  B: 2,
  C: 1,
  D: 0.5,
  E: 0.25,
};

// Tipos de tarea (ya no tienen categorías asociadas)
const taskTypeNames = ["UX/UI Design", "Graphic Design", "General Design"];

async function main() {
  console.log("🌱 Iniciando seeding...");

  // 0. Limpiar datos existentes
  console.log("\n--- Limpiando datos existentes ---");
  try {
    await prisma.syncLog.deleteMany();
    await prisma.taskAssignment.deleteMany();
    await prisma.task.deleteMany();
    await prisma.userVacation.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.taskType.deleteMany();
    await prisma.tierList.deleteMany();
    await prisma.user.deleteMany();
    await prisma.brand.deleteMany();
    console.log("✅ Datos antiguos eliminados.");
  } catch (error) {
    console.error("❌ Error limpiando datos:", error);
    throw error;
  }

  // 1. TierList
  console.log("\n--- Seeding TierList ---");
  for (const tierName of Object.keys(Tier)) {
    const defaultDuration = tierDurations[tierName];
    if (defaultDuration === undefined) continue;
    const tier = await prisma.tierList.upsert({
      where: { name: tierName },
      update: { duration: defaultDuration },
      create: { name: tierName, duration: defaultDuration },
    });
    console.log(`✅ Tier: ${tier.name} (${tier.duration} días)`);
  }

  // 2. Brands (id = ClickUp List ID)
  console.log("\n--- Seeding Brands ---");
  const brandData = [
    { id: "901700182493", name: "Inszone", spaceId: "90170091121", folderId: "90170099166", teamId: "9017044866", isActive: true, description: "Main Inszone brand", defaultStatus: "TO_DO" },
    { id: "901700182489", name: "R.E. Chaix", spaceId: "90170091121", folderId: "90170099166", teamId: "9017044866", isActive: true, description: "R.E. Chaix brand", defaultStatus: "TO_DO" },
    { id: "901704229078", name: "Pinney", spaceId: "90170091121", folderId: "90170099166", teamId: "9017044866", isActive: true, description: "Pinney brand", defaultStatus: "TO_DO" },
  ];
  for (const brand of brandData) {
    await prisma.brand.upsert({ where: { id: brand.id }, update: brand, create: brand });
    console.log(`✅ Brand: ${brand.name}`);
  }

  // 3. Users (id = ClickUp ID)
  console.log("\n--- Seeding Users ---");
  const userData = [
    { id: "114240449", name: "Erick Santos", email: "esantos@inszoneins.com", active: true },
    { id: "114217194", name: "Diego Ganoza", email: "dganoza@inszoneins.com", active: true },
    { id: "114217195", name: "Dayana Viggiani", email: "dviggiani@inszoneins.com", active: true },
  ];
  const allUsers = {};
  for (const user of userData) {
    const created = await prisma.user.upsert({ where: { id: user.id }, update: user, create: user });
    allUsers[created.name] = created;
    console.log(`✅ User: ${created.name}`);
  }

  // 4. TaskTypes (sin categorías)
  console.log("\n--- Seeding TaskTypes ---");
  const seededTaskTypes = {};
  for (const typeName of taskTypeNames) {
    const type = await prisma.taskType.upsert({
      where: { name: typeName },
      update: {},
      create: { name: typeName },
    });
    seededTaskTypes[type.name] = type;
    console.log(`✅ TaskType: ${type.name}`);
  }

  // 5. UserRoles
  console.log("\n--- Seeding UserRoles ---");
  const userRoleData = [
    { user: allUsers["Erick Santos"], types: ["UX/UI Design"], brandId: null },
    { user: allUsers["Diego Ganoza"], types: ["UX/UI Design", "Graphic Design"], brandId: null },
    { user: allUsers["Dayana Viggiani"], types: ["Graphic Design"], brandId: null },
  ];
  for (const roleData of userRoleData) {
    const user = roleData.user;
    if (!user) continue;
    for (const typeName of roleData.types) {
      const type = seededTaskTypes[typeName];
      if (!type) continue;
      const existing = await prisma.userRole.findFirst({
        where: { userId: user.id, typeId: type.id, brandId: roleData.brandId },
      });
      if (!existing) {
        await prisma.userRole.create({
          data: { userId: user.id, typeId: type.id, brandId: roleData.brandId },
        });
        console.log(`✅ UserRole: ${user.name} - ${type.name}`);
      }
    }
  }

  console.log("\n🌱 Seeding completado.");
}

try {
  prisma = new PrismaClient();
  main()
    .catch((e) => {
      console.error("❌ Error durante el seeding:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
} catch (e) {
  console.error("❌ Error al inicializar PrismaClient:", e);
  process.exit(1);
}
