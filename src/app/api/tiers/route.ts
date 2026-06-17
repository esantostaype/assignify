import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tierList } from '@/db/schema';
import { asc } from 'drizzle-orm';

// Lee datos en vivo de la DB: nunca pre-renderizar/cachear en build.
export const dynamic = 'force-dynamic';

/**
 * GET /api/tiers
 * Obtiene todos los tiers disponibles con su información
 */
export async function GET() {
  try {
    const tiers = await db.query.tierList.findMany({
      orderBy: [asc(tierList.name)] // Esto ordenará S, A, B, C, D, E
    });

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