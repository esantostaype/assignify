// app/api/users/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { user } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { getCurrentWorkspaceId } from '@/lib/workspace';

// Lee datos en vivo de la DB: nunca pre-renderizar/cachear en build.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const wsId = await getCurrentWorkspaceId();
    const users = await db.query.user.findMany({
      // [SaaS] Solo los miembros del workspace activo.
      where: and(eq(user.active, true), eq(user.workspaceId, wsId ?? '__none__')),
    });
    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Error al obtener usuarios' }, { status: 500 });
  }
}
