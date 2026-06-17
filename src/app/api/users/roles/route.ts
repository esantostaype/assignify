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
}

/**
 * POST /api/users/roles
 * Agrega un nuevo rol a un usuario
 */
export async function POST(req: Request) {
  try {
    const body: CreateRoleRequest = await req.json();
    const { userId, typeId, brandId } = body;

    // Validar campos requeridos
    if (!userId || !typeId) {
      return NextResponse.json({
        error: 'userId and typeId are required',
        required: ['userId', 'typeId']
      }, { status: 400 });
    }

    console.log(`🔄 Adding role to user ${userId}: typeId=${typeId}, brandId=${brandId || 'null'}`);

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
      return NextResponse.json({
        error: 'Role already exists for this user'
      }, { status: 409 });
    }

    // Crear el rol
    const [created] = await db
      .insert(userRole)
      .values({
        userId: userId,
        typeId: typeId,
        brandId: brandId || null
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

    console.log(`✅ Role created successfully: ${newRole!.type.name} ${newRole!.brand ? `for ${newRole!.brand.name}` : '(Global)'}`);

    return NextResponse.json(newRole, { status: 201 });

  } catch (error) {
    console.error('❌ Error creating user role:', error);

    return NextResponse.json({
      error: 'Internal server error creating role',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
