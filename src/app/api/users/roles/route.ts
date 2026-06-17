// src/app/api/users/roles/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { user, taskType, brand, userRole } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

// Lee/escribe datos en vivo de la DB: nunca pre-renderizar/cachear en build.
export const dynamic = 'force-dynamic';

interface CreateRoleRequest {
  userId: string;
  typeId: number;
  brandId?: string | null;
  // Cargo primario (true) vs secundario (false). Opcional; por defecto secundario.
  isPrimary?: boolean;
}

/**
 * POST /api/users/roles
 * Agrega un nuevo rol a un usuario
 */
export async function POST(req: Request) {
  try {
    const body: CreateRoleRequest = await req.json();
    const { userId, typeId, brandId, isPrimary } = body;

    // Validar campos requeridos
    if (!userId || !typeId) {
      return NextResponse.json({
        error: 'userId and typeId are required',
        required: ['userId', 'typeId']
      }, { status: 400 });
    }

    console.log(`🔄 Adding role to user ${userId}: typeId=${typeId}, brandId=${brandId || 'null'}, isPrimary=${isPrimary ? 'true' : 'false'}`);

    // Verificar que el usuario existe
    const existingUser = await db.query.user.findFirst({
      where: eq(user.id, userId)
    });

    if (!existingUser) {
      return NextResponse.json({
        error: 'User not found'
      }, { status: 404 });
    }

    // Verificar que el tipo existe
    const existingType = await db.query.taskType.findFirst({
      where: eq(taskType.id, typeId)
    });

    if (!existingType) {
      return NextResponse.json({
        error: 'Task type not found'
      }, { status: 404 });
    }

    // Verificar que el brand existe si se proporciona
    if (brandId) {
      const existingBrand = await db.query.brand.findFirst({
        where: eq(brand.id, brandId)
      });

      if (!existingBrand) {
        return NextResponse.json({
          error: 'Brand not found'
        }, { status: 404 });
      }
    }

    // Verificar que el rol no existe ya
    const existingRole = await db.query.userRole.findFirst({
      where: and(
        eq(userRole.userId, userId),
        eq(userRole.typeId, typeId),
        brandId ? eq(userRole.brandId, brandId) : isNull(userRole.brandId)
      )
    });

    if (existingRole) {
      // Mensaje específico: este chequeo es la ÚNICA guardia para roles globales
      // (brandId NULL), porque el índice UNIQUE de SQLite trata NULL como distinto
      // y no bloquea duplicados de rol global.
      const scope = brandId ? `for "${existingType.name}" in this brand` : `for "${existingType.name}" (Global)`;
      return NextResponse.json({
        error: `This user already has a role ${scope}.`
      }, { status: 409 });
    }

    // Crear el rol. Normalizamos brandId: '' (cadena vacía que puede llegar del
    // Select "Global") → null, para no violar la FK a brand.
    const normalizedBrandId = brandId && brandId.trim() !== '' ? brandId : null;

    const [created] = await db
      .insert(userRole)
      .values({
        userId: userId,
        typeId: typeId,
        brandId: normalizedBrandId,
        isPrimary: isPrimary ?? false
      })
      .returning();

    // Releer con sus relaciones (type/brand) para mantener la forma de la respuesta
    const newRole = await db.query.userRole.findFirst({
      where: eq(userRole.id, created.id),
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
    });

    if (!newRole) {
      // No debería pasar (acabamos de insertar), pero evitamos un crash por
      // desreferenciar null si la relectura no encuentra la fila.
      return NextResponse.json(created, { status: 201 });
    }

    console.log(`✅ Role created successfully: ${newRole.type.name} ${newRole.brand ? `for ${newRole.brand.name}` : '(Global)'}`);

    return NextResponse.json(newRole, { status: 201 });

  } catch (error) {
    console.error('❌ Error creating user role:', error);

    return NextResponse.json({
      error: 'Internal server error creating role',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
