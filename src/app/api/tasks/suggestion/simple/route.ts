// src/app/api/tasks/suggestion/simple/route.ts
import { NextResponse } from 'next/server';
import { Priority, Level } from '@/db/enums';
import { getBestUserWithCache } from '@/services/task-assignment.service';
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

    // ✅ LÓGICA FLEXIBLE: Usar brandId si está disponible, sino buscar globalmente
    let bestSlot;

    if (brandId) {
      // Con brand específico
      bestSlot = await getBestUserWithCache(
        typeId,
        brandId,
        priority,
        durationDays,
        level
      );
    } else {
      // ✅ FALLBACK: Buscar en todos los brands activos
      const activeBrands = await db.query.brand.findMany({
        where: eq(brandTable.isActive, true),
        columns: { id: true, name: true }
      });

      // Intentar con cada brand hasta encontrar un usuario
      for (const brand of activeBrands) {
        const candidateSlot = await getBestUserWithCache(
          typeId,
          brand.id,
          priority,
          durationDays,
          level
        );

        if (candidateSlot) {
          bestSlot = candidateSlot;
          break;
        }
      }
    }

    if (!bestSlot) {
      return NextResponse.json({
        error: 'Could not find an optimal designer',
        details: brandId
          ? `No available users for brand ${brandId}`
          : 'No available users in any active brand'
      }, { status: 400 });
    }

    // ✅ RESPUESTA EXITOSA
    return NextResponse.json({
      suggestedUserId: bestSlot.userId,
      userInfo: {
        id: bestSlot.userId,
        name: bestSlot.userName,
        currentLoad: bestSlot.cargaTotal,
        isSpecialist: bestSlot.isSpecialist,
        availableFrom: bestSlot.availableDate.toISOString(),
        totalAssignedDurationDays: bestSlot.totalAssignedDurationDays,
        level: bestSlot.level
      },
      metadata: {
        typeId: typeId,
        durationDays: durationDays,
        brandId: brandId || 'global',
        requestedLevel: level,
        generatedAt: new Date().toISOString(),
        algorithm: 'duration-balanced-assignment-flexible'
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