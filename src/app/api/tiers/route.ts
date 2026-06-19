import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tierList, systemSettings, TIER_NAMES } from '@/db/schema';
import { and, asc, eq } from 'drizzle-orm';
import { getCurrentWorkspaceId } from '@/lib/workspace';
import { DURATION_UNITS, type DurationUnit } from '@/utils/duration-utils';

// Lee datos en vivo de la DB: nunca pre-renderizar/cachear en build.
export const dynamic = 'force-dynamic';

// La unidad de duración de los tiers (days/hours/minutes) es config POR WORKSPACE; se
// guarda como una fila de system_settings (category 'tier'), gestionada solo aquí.
// Default 'days'. Las duraciones de los tiers SIEMPRE se guardan en días base.
async function readTierDurationUnit(wsId: string | null): Promise<DurationUnit> {
  const row = await db.query.systemSettings.findFirst({
    where: and(
      eq(systemSettings.workspaceId, wsId ?? '__none__'),
      eq(systemSettings.category, 'tier'),
      eq(systemSettings.key, 'duration_unit')
    ),
  });
  const v = row?.value as DurationUnit | undefined;
  return v && DURATION_UNITS.includes(v) ? v : 'days';
}

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

    const durationUnit = await readTierDurationUnit(wsId);
    return NextResponse.json({ tiers: sortedTiers, durationUnit });
  } catch (error) {
    console.error('Error fetching tiers:', error);
    return NextResponse.json({
      error: 'Internal server error while fetching tiers',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * PATCH /api/tiers — fija la unidad de duración de los tiers del workspace.
 * Body: { durationUnit: 'days' | 'hours' | 'minutes' }. Upsert del setting.
 */
export async function PATCH(req: Request) {
  try {
    const wsId = await getCurrentWorkspaceId();
    const { durationUnit } = (await req.json()) as { durationUnit?: DurationUnit };
    if (!durationUnit || !DURATION_UNITS.includes(durationUnit)) {
      return NextResponse.json({ error: 'durationUnit inválido (days|hours|minutes)' }, { status: 400 });
    }

    const existing = await db.query.systemSettings.findFirst({
      where: and(
        eq(systemSettings.workspaceId, wsId ?? '__none__'),
        eq(systemSettings.category, 'tier'),
        eq(systemSettings.key, 'duration_unit')
      ),
    });

    if (existing) {
      await db.update(systemSettings).set({ value: durationUnit }).where(eq(systemSettings.id, existing.id));
    } else {
      await db.insert(systemSettings).values({
        category: 'tier',
        key: 'duration_unit',
        value: durationUnit,
        dataType: 'string',
        label: 'Tier duration unit',
        group: 'tier',
        order: 0,
        required: false,
        workspaceId: wsId,
      });
    }

    return NextResponse.json({ durationUnit });
  } catch (error) {
    console.error('Error updating tier duration unit:', error);
    return NextResponse.json({
      error: 'Internal server error while updating tier duration unit',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}