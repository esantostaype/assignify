import { NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';

/**
 * GET /api/tiers
 * Obtiene todos los tiers disponibles con su información
 */
export async function GET() {
  try {
    console.log('🎯 Fetching all tiers...');
    
    const tiers = await prisma.tierList.findMany({
      orderBy: {
        name: 'asc' // Esto ordenará S, A, B, C, D, E
      }
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

    console.log(`✅ Found ${sortedTiers.length} tiers`);
    
    return NextResponse.json(sortedTiers);
  } catch (error) {
    console.error('❌ Error fetching tiers:', error);
    return NextResponse.json({
      error: 'Error interno del servidor al obtener tiers',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}