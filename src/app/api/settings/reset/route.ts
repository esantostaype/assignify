import { NextResponse } from 'next/server';
import { db } from '@/db';
import { systemSettings } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { DEFAULT_SETTINGS } from '@/config/settings-catalog';
import { invalidateAppSettingsCache } from '@/services/app-settings.service';

// Escribe datos en vivo de la DB: nunca pre-renderizar/cachear en build.
export const dynamic = 'force-dynamic';

// POST /api/settings/reset
export async function POST() {
  try {
    // Eliminar todos los settings actuales
    await db.delete(systemSettings);

    // Recrear con valores por defecto
    for (const defaultSetting of DEFAULT_SETTINGS) {
      await db.insert(systemSettings).values(defaultSetting);
    }

    // Invalidar la caché en memoria del motor.
    invalidateAppSettingsCache();

    const settings = await db.query.systemSettings.findMany({
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