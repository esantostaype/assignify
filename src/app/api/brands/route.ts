// src/app/api/brands/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { brand } from '@/db/schema';
import { asc, eq } from 'drizzle-orm';
import { getCurrentWorkspaceId } from '@/lib/workspace';

// Lee datos en vivo de la DB: nunca pre-renderizar/cachear en build.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const wsId = await getCurrentWorkspaceId();
    const brands = await db.query.brand.findMany({
      where: eq(brand.workspaceId, wsId ?? '__none__'),
      columns: {
        id: true,
        name: true,
        isActive: true,
        description: true,
        defaultStatus: true,
        spaceId: true,
        folderId: true,
        teamId: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: [asc(brand.name)]
    });

    return NextResponse.json(brands);
  } catch (error) {
    console.error('Error fetching brands:', error);
    return NextResponse.json(
      { error: 'Failed to fetch brands' },
      { status: 500 }
    );
  }
}