// src/app/api/users/[userId]/details/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { user, userVacation } from '@/db/schema';
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
 * Obtiene detalles completos de un usuario incluyendo roles y vacaciones
 */
export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { userId } = params;

    if (!userId) {
      return NextResponse.json({
        error: 'User ID is required'
      }, { status: 400 });
    }

    // Obtener usuario con roles y vacaciones
    const user_ = await db.query.user.findFirst({
      where: eq(user.id, userId),
      with: {
        roles: {
          with: {
            type: {
              columns: {
                id: true,
                name: true
              }
            },
            brand: {
              columns: {
                id: true,
                name: true
              }
            }
          }
        },
        vacations: {
          orderBy: asc(userVacation.startDate)
        }
      }
    });

    if (!user_) {
      return NextResponse.json({
        error: 'User not found'
      }, { status: 404 });
    }

    console.log(`✅ User details loaded for: ${user_.name} (${user_.id})`);
    console.log(`   - Roles: ${user_.roles.length}`);
    console.log(`   - Vacations: ${user_.vacations.length}`);

    return NextResponse.json(user_);

  } catch (error) {
    console.error('❌ Error loading user details:', error);

    return NextResponse.json({
      error: 'Internal server error loading user details',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
