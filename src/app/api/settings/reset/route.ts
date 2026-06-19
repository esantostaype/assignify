import { NextResponse } from 'next/server';
import { db } from '@/db';
import { systemSettings } from '@/db/schema';
import { asc, eq } from 'drizzle-orm';
import { DEFAULT_SETTINGS } from '@/config/settings-catalog';
import { invalidateAppSettingsCache } from '@/services/app-settings.service';
import { getCurrentWorkspaceId } from '@/lib/workspace';

// Escribe datos en vivo de la DB: nunca pre-renderizar/cachear en build.
export const dynamic = 'force-dynamic';

// POST /api/settings/reset
export async function POST() {
  try {
    const wsId = await getCurrentWorkspaceId();

    // Eliminar SOLO los settings de ESTE workspace (no los de otros inquilinos).
    await db.delete(systemSettings).where(eq(systemSettings.workspaceId, wsId ?? '__none__'));

    // Recrear con valores por defecto (con su workspaceId).
    for (const defaultSetting of DEFAULT_SETTINGS) {
      await db.insert(systemSettings).values({ ...defaultSetting, workspaceId: wsId });
    }

    // Invalidar la caché en memoria del motor (de este workspace).
    invalidateAppSettingsCache(wsId);

    const settings = await db.query.systemSettings.findMany({
      where: eq(systemSettings.workspaceId, wsId ?? '__none__'),
      orderBy: [asc(systemSettings.group), asc(systemSettings.order)]
    });

    return NextResponse.json({
      success: true,
      settings
    });

  } catch (error) {
    console.error('Error resetting settings:', error);
    return NextResponse.json({
      error: 'Error resetting settings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}