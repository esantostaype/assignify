// src/app/api/users/[userId]/details/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { user, userRole, userVacation, taskType, brand } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';

// Lee datos en vivo de la DB: nunca pre-renderizar/cachear en build.
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: {
    userId: string;
  };
}

/**
 * GET /api/users/[userId]/details
 * Detalle completo del usuario (roles + vacaciones).
 *
 * IMPORTANTE: arma el resultado con consultas SEPARADAS en vez de la query
 * relacional de Drizzle (`db.query.user.findFirst({ with: { roles, vacations } })`).
 * En el dev server (cliente libSQL reutilizado vía globalThis) esa query
 * relacional devolvía resultados OBSOLETOS (nivel/roles de hace rato) mientras
 * las consultas directas devolvían datos frescos — el modal de edición mostraba
 * datos viejos aunque la DB estuviera correcta. Ensamblar a mano lo evita.
 */
export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { userId } = params;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const u = await db.query.user.findFirst({ where: eq(user.id, userId) });

    if (!u) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const [roleRows, vacations, types, brands] = await Promise.all([
      db.query.userRole.findMany({ where: eq(userRole.userId, userId) }),
      db.query.userVacation.findMany({
        where: eq(userVacation.userId, userId),
        orderBy: asc(userVacation.startDate),
      }),
      db.query.taskType.findMany(),
      db.query.brand.findMany(),
    ]);

    const typeById = new Map(types.map((t) => [t.id, { id: t.id, name: t.name }]));
    const brandById = new Map(brands.map((b) => [b.id, { id: b.id, name: b.name }]));

    const roles = roleRows.map((r) => ({
      ...r,
      type: typeById.get(r.typeId) ?? null,
      brand: r.brandId ? brandById.get(r.brandId) ?? null : null,
    }));

    return NextResponse.json({ ...u, roles, vacations });
  } catch (error) {
    console.error('Error loading user details:', error);

    return NextResponse.json(
      {
        error: 'Internal server error loading user details',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
