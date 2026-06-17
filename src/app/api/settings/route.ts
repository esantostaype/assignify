import { NextResponse } from 'next/server';
import { db } from '@/db';
import { systemSettings } from '@/db/schema';
import { and, asc, eq } from 'drizzle-orm';
import { DEFAULT_SETTINGS } from '@/config/settings-catalog';
import { invalidateAppSettingsCache } from '@/services/app-settings.service';

// Lee/escribe datos en vivo de la DB: nunca pre-renderizar/cachear en build.
export const dynamic = 'force-dynamic';

// GET /api/settings
export async function GET() {
  try {
    // Obtener settings de la base de datos
    let settings = await db.query.systemSettings.findMany({
      orderBy: [asc(systemSettings.group), asc(systemSettings.order)]
    });

    // Si no hay settings, crear los por defecto
    if (settings.length === 0) {
      for (const defaultSetting of DEFAULT_SETTINGS) {
        await db.insert(systemSettings).values(defaultSetting);
      }

      settings = await db.query.systemSettings.findMany({
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
        .where(and(eq(systemSettings.category, category), eq(systemSettings.key, key)))
        .returning({ id: systemSettings.id });

      results.push({
        category,
        key,
        updated: updated.length > 0
      });
    }

    // Invalidar la caché en memoria para que el motor lea los nuevos valores ya.
    invalidateAppSettingsCache();

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