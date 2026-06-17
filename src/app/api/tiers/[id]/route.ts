import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tierList } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Lee/escribe datos en vivo de la DB: nunca pre-renderizar/cachear en build.
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * PATCH /api/tiers/[id]
 * Actualiza la duración de un tier específico
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { id } = params;
    const body = await req.json();
    const { duration } = body;

    // Validar que la duración sea válida
    if (typeof duration !== 'number' || duration <= 0) {
      return NextResponse.json({
        error: 'Duration must be a positive number'
      }, { status: 400 });
    }

    // Verificar que el tier existe
    const existingTier = await db.query.tierList.findFirst({
      where: eq(tierList.id, parseInt(id))
    });

    if (!existingTier) {
      return NextResponse.json({
        error: 'Tier not found'
      }, { status: 404 });
    }

    // Actualizar la duración
    const [updatedTier] = await db
      .update(tierList)
      .set({ duration })
      .where(eq(tierList.id, parseInt(id)))
      .returning();

    return NextResponse.json({
      ...updatedTier,
      previousDuration: existingTier.duration
    });

  } catch (error) {
    console.error('Error updating tier:', error);
    return NextResponse.json({
      error: 'Error updating tier',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}