import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tierList, TIER_NAMES } from '@/db/schema';
import { asc, eq } from 'drizzle-orm';
import { getCurrentWorkspaceId } from '@/lib/workspace';

// Lee datos en vivo de la DB: nunca pre-renderizar/cachear en build.
export const dynamic = 'force-dynamic';

// Duraciones por defecto (días) al sembrar los tiers de un workspace nuevo.
const DEFAULT_TIERS: { name: (typeof TIER_NAMES)[number]; duration: number }[] = [
  { name: 'S', duration: 5 },
  { name: 'A', duration: 4 },
  { name: 'B', duration: 3 },
  { name: 'C', duration: 2 },
  { name: 'D', duration: 1 },
  { name: 'E', duration: 0.5 },
];

/**
 * GET /api/tiers
 * Obtiene todos los tiers disponibles con su información
 */
export async function GET() {
  try {
    const wsId = await getCurrentWorkspaceId();
    let tiers = await db.query.tierList.findMany({
      where: eq(tierList.workspaceId, wsId ?? '__none__'),
      orderBy: [asc(tierList.name)] // Esto ordenará S, A, B, C, D, E
    });

    // Si este workspace aún no tiene tiers, sembrar los por defecto (con su workspaceId).
    if (tiers.length === 0 && wsId) {
      for (const t of DEFAULT_TIERS) {
        await db.insert(tierList).values({ name: t.name, duration: t.duration, workspaceId: wsId });
      }
      tiers = await db.query.tierList.findMany({
        where: eq(tierList.workspaceId, wsId ?? '__none__'),
        orderBy: [asc(tierList.name)]
      });
    }

    // Mapear para incluir información adicional útil
    const tiersWithInfo = tiers.map(tier => ({
      id: tier.id,
      name: tier.name,
      duration: tier.duration
    }));

    // Ordenar manualmente para asegurar el orden correcto S > A > B > C > D > E
    const tierOrder = ['S', 'A', 'B', 'C', 'D', 'E'];
    const sortedTiers = tiersWithInfo.sort((a, b) => {
      return tierOrder.indexOf(a.name) - tierOrder.indexOf(b.name);
    });

    return NextResponse.json(sortedTiers);
  } catch (error) {
    console.error('Error fetching tiers:', error);
    return NextResponse.json({
      error: 'Internal server error while fetching tiers',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}