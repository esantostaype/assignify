// src/app/api/users/vacations/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { user, userVacation } from '@/db/schema';
import { eq, and, or, lte, gte } from 'drizzle-orm';

// Lee/escribe datos en vivo de la DB: nunca pre-renderizar/cachear en build.
export const dynamic = 'force-dynamic';

interface CreateVacationRequest {
  userId: string;
  startDate: string;
  endDate: string;
}

/**
 * Las vacaciones son fechas de calendario (sin hora). El input envía 'YYYY-MM-DD'.
 * `new Date('YYYY-MM-DD')` las interpreta a medianoche UTC, lo que en zonas con
 * offset negativo (p. ej. Perú UTC-5) corre el día al anterior. Anclamos a
 * mediodía UTC para que el día se preserve en cualquier zona razonable.
 */
function parseCalendarDate(s: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T12:00:00.000Z`) : new Date(s);
}

/**
 * POST /api/users/vacations
 * Agrega un nuevo período de vacaciones a un usuario
 */
export async function POST(req: Request) {
  try {
    const body: CreateVacationRequest = await req.json();
    const { userId, startDate, endDate } = body;

    // Validar campos requeridos
    if (!userId || !startDate || !endDate) {
      return NextResponse.json({
        error: 'userId, startDate, and endDate are required',
        required: ['userId', 'startDate', 'endDate']
      }, { status: 400 });
    }

    console.log(`🔄 Adding vacation to user ${userId}: ${startDate} to ${endDate}`);

    // Convertir fechas (ancladas a mediodía UTC para no correr el día por zona horaria)
    const startDateObj = parseCalendarDate(startDate);
    const endDateObj = parseCalendarDate(endDate);

    // Validar fechas
    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      return NextResponse.json({
        error: 'Invalid date format. Use YYYY-MM-DD'
      }, { status: 400 });
    }

    if (startDateObj >= endDateObj) {
      return NextResponse.json({
        error: 'End date must be after start date'
      }, { status: 400 });
    }

    // Verificar que el usuario existe
    const existingUser = await db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: { id: true, name: true }
    });

    if (!existingUser) {
      return NextResponse.json({
        error: 'User not found'
      }, { status: 404 });
    }

    // Verificar conflictos con vacaciones existentes
    const conflictingVacations = await db.query.userVacation.findMany({
      where: and(
        eq(userVacation.userId, userId),
        or(
          and(
            lte(userVacation.startDate, startDateObj),
            gte(userVacation.endDate, startDateObj)
          ),
          and(
            lte(userVacation.startDate, endDateObj),
            gte(userVacation.endDate, endDateObj)
          ),
          and(
            gte(userVacation.startDate, startDateObj),
            lte(userVacation.endDate, endDateObj)
          )
        )
      )
    });

    if (conflictingVacations.length > 0) {
      return NextResponse.json({
        error: 'Vacation period conflicts with existing vacation',
        conflictingVacations: conflictingVacations.map(v => ({
          id: v.id,
          startDate: v.startDate.toISOString().split('T')[0],
          endDate: v.endDate.toISOString().split('T')[0]
        }))
      }, { status: 409 });
    }

    // Crear la vacación
    const [newVacation] = await db
      .insert(userVacation)
      .values({
        userId: userId,
        startDate: startDateObj,
        endDate: endDateObj
      })
      .returning();

    const durationDays = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));

    console.log(`✅ Vacation created successfully: ${durationDays} days for user ${existingUser.name}`);

    return NextResponse.json({
      ...newVacation,
      startDate: newVacation.startDate.toISOString().split('T')[0],
      endDate: newVacation.endDate.toISOString().split('T')[0],
      durationDays
    }, { status: 201 });

  } catch (error) {
    console.error('❌ Error creating user vacation:', error);

    return NextResponse.json({
      error: 'Internal server error creating vacation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
