import { NextResponse } from 'next/server';
import { db } from '@/db';
import { systemSettings } from '@/db/schema';
import { and, asc, eq } from 'drizzle-orm';
import { DEFAULT_SETTINGS } from '@/config/settings-catalog';
import { invalidateAppSettingsCache } from '@/services/app-settings.service';
import { getCurrentWorkspaceId } from '@/lib/workspace';

// Lee/escribe datos en vivo de la DB: nunca pre-renderizar/cachear en build.
export const dynamic = 'force-dynamic';

// GET /api/settings
export async function GET() {
  try {
    const wsId = await getCurrentWorkspaceId();
    // Settings del workspace ACTIVO (cada inquilino tiene su horario/umbrales).
    let settings = await db.query.systemSettings.findMany({
      where: eq(systemSettings.workspaceId, wsId ?? '__none__'),
      orderBy: [asc(systemSettings.group), asc(systemSettings.order)]
    });

    // Si este workspace aún no tiene settings, sembrar los por defecto (con su workspaceId).
    if (settings.length === 0) {
      for (const defaultSetting of DEFAULT_SETTINGS) {
        await db.insert(systemSettings).values({ ...defaultSetting, workspaceId: wsId });
      }

      settings = await db.query.systemSettings.findMany({
        where: eq(systemSettings.workspaceId, wsId ?? '__none__'),
        orderBy: [asc(systemSettings.group), asc(systemSettings.order)]
      });
    }

    return NextResponse.json({
      settings,
      count: settings.length
    });

  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({
      error: 'Error fetching settings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// PATCH /api/settings
export async function PATCH(req: Request) {
  try {
    const wsId = await getCurrentWorkspaceId();
    const { updates } = await req.json();

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({
        error: 'Invalid updates array'
      }, { status: 400 });
    }

    const results = [];

    for (const update of updates) {
      const { category, key, value } = update;

      if (!category || !key || value === undefined) {
        continue;
      }

      const updated = await db
        .update(systemSettings)
        .set({ value })
        .where(and(
          eq(systemSettings.category, category),
          eq(systemSettings.key, key),
          eq(systemSettings.workspaceId, wsId ?? '__none__')
        ))
        .returning({ id: systemSettings.id });

      results.push({
        category,
        key,
        updated: updated.length > 0
      });
    }

    // Invalidar la caché en memoria (de ESTE workspace) para que el motor lea ya los nuevos valores.
    invalidateAppSettingsCache(wsId);

    return NextResponse.json({
      success: true,
      results
    });

  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({
      error: 'Error updating settings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}