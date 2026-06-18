// src/app/api/tasks/suggestion/simple/route.ts
// FUENTE ÚNICA de la UI de asignación: devuelve el diseñador sugerido por el motor
// y la lista completa de candidatos (con estado) para pintar opciones + badges.
import { NextResponse } from 'next/server';
import { Priority, Level } from '@/db/enums';
import { getRankedCandidates } from '@/services/task-assignment.service';
import { RankedCandidate } from '@/interfaces';
import { db } from '@/db';
import { brand as brandTable } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Lee DB y ClickUp en vivo, usa request.url: nunca pre-renderizar/cachear en build.
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const typeId = parseInt(searchParams.get('typeId') || '0');
    const durationDays = parseFloat(searchParams.get('durationDays') || '0');
    const brandId = searchParams.get('brandId'); // ✅ OPCIONAL
    const priorityParam = (searchParams.get('priority') || 'NORMAL').toUpperCase();
    const priority: Priority = (['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(priorityParam)
      ? priorityParam
      : 'NORMAL') as Priority;

    // Nivel solicitado (opcional; default MID). Solo decide el diseñador, no se persiste.
    const levelParam = (searchParams.get('level') || 'MID').toUpperCase();
    const level: Level = (['JUNIOR', 'MID', 'SENIOR'].includes(levelParam)
      ? levelParam
      : 'MID') as Level;

    // ✅ VALIDACIÓN SOLO DE PARÁMETROS ESENCIALES
    if (!typeId || typeId <= 0) {
      return NextResponse.json({
        error: 'typeId is required and must be a valid number greater than 0',
        received: typeId
      }, { status: 400 });
    }

    if (!durationDays || durationDays <= 0) {
      return NextResponse.json({
        error: 'durationDays is required and must be a number greater than 0',
        received: durationDays
      }, { status: 400 });
    }

    // Usar brandId si está disponible; si no, buscar en todos los brands activos.
    let suggestedUserId: string | null = null;
    let candidates: RankedCandidate[] = [];
    let resolvedBrandId = brandId;

    if (brandId) {
      const result = await getRankedCandidates(typeId, brandId, priority, durationDays, level);
      suggestedUserId = result.suggestedUserId;
      candidates = result.candidates;
    } else {
      // FALLBACK: probar cada brand activo hasta encontrar candidatos.
      const activeBrands = await db.query.brand.findMany({
        where: eq(brandTable.isActive, true),
        columns: { id: true, name: true }
      });

      for (const brand of activeBrands) {
        const result = await getRankedCandidates(typeId, brand.id, priority, durationDays, level);
        if (result.candidates.length > 0) {
          suggestedUserId = result.suggestedUserId;
          candidates = result.candidates;
          resolvedBrandId = brand.id;
          break;
        }
      }
    }

    if (candidates.length === 0) {
      return NextResponse.json({
        error: 'Could not find an optimal designer',
        details: brandId
          ? `No available users for brand ${brandId}`
          : 'No available users in any active brand'
      }, { status: 400 });
    }

    return NextResponse.json({
      suggestedUserId,
      candidates,
      metadata: {
        typeId,
        durationDays,
        brandId: resolvedBrandId || 'global',
        requestedLevel: level,
        algorithm: 'duration-balanced-priority-aware'
      }
    });

  } catch (error) {
    console.error('Failed to generate suggestion:', error);

    return NextResponse.json({
      error: 'Internal server error while generating suggestion',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}