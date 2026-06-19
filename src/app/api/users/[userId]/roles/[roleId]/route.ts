// src/app/api/users/[userId]/roles/[roleId]/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { userRole } from '@/db/schema';
import { eq } from 'drizzle-orm';

interface UpdateRoleRequest {
  // Marca/desmarca el rol como cargo primario.
  isPrimary?: boolean;
}

// Escribe datos en vivo de la DB: nunca pre-renderizar/cachear en build.
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: {
    userId: string;
    roleId: string;
  };
}

/**
 * DELETE /api/users/[userId]/roles/[roleId]
 * Elimina un rol específico de un usuario
 */
export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const { roleId } = params;

    if (!roleId) {
      return NextResponse.json({
        error: 'Role ID is required'
      }, { status: 400 });
    }

    const roleIdInt = parseInt(roleId);

    if (isNaN(roleIdInt)) {
      return NextResponse.json({
        error: 'Role ID must be a valid number'
      }, { status: 400 });
    }

    console.log(`🔄 Deleting role: ${roleIdInt}`);

    // Verificar que el rol existe y obtener información para logging
    const existingRole = await db.query.userRole.findFirst({
      where: eq(userRole.id, roleIdInt),
      with: {
        user: {
          columns: {
            id: true,
            name: true
          }
        },
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

    if (!existingRole) {
      return NextResponse.json({
        error: 'Role not found'
      }, { status: 404 });
    }

    // Eliminar el rol
    await db.delete(userRole).where(eq(userRole.id, roleIdInt));

    console.log(`✅ Role deleted successfully: ${existingRole.type.name} ${existingRole.brand ? `for ${existingRole.brand.name}` : '(Global)'} from user ${existingRole.user?.name ?? 'unknown'}`);

    return NextResponse.json({
      message: 'Role deleted successfully',
      deletedRole: {
        id: existingRole.id,
        typeName: existingRole.type.name,
        brandName: existingRole.brand?.name || 'Global',
        userName: existingRole.user?.name ?? null
      }
    });

  } catch (error) {
    console.error('❌ Error deleting user role:', error);

    return NextResponse.json({
      error: 'Internal server error deleting role',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * PATCH /api/users/[userId]/roles/[roleId]
 * Alterna (o fija) el flag `isPrimary` de un rol existente.
 * Body: { isPrimary: boolean }. Si no se envía, alterna el valor actual.
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { roleId } = params;

    if (!roleId) {
      return NextResponse.json({
        error: 'Role ID is required'
      }, { status: 400 });
    }

    const roleIdInt = parseInt(roleId);

    if (isNaN(roleIdInt)) {
      return NextResponse.json({
        error: 'Role ID must be a valid number'
      }, { status: 400 });
    }

    // El body es opcional: si no llega isPrimary, alternamos el valor actual.
    let body: UpdateRoleRequest = {};
    try {
      body = (await req.json()) as UpdateRoleRequest;
    } catch {
      body = {};
    }

    // Verificar que el rol existe
    const existingRole = await db.query.userRole.findFirst({
      where: eq(userRole.id, roleIdInt)
    });

    if (!existingRole) {
      return NextResponse.json({
        error: 'Role not found'
      }, { status: 404 });
    }

    const nextIsPrimary =
      typeof body.isPrimary === 'boolean' ? body.isPrimary : !existingRole.isPrimary;

    console.log(`🔄 Updating role ${roleIdInt}: isPrimary ${existingRole.isPrimary} → ${nextIsPrimary}`);

    await db
      .update(userRole)
      .set({ isPrimary: nextIsPrimary })
      .where(eq(userRole.id, roleIdInt));

    // Releer con relaciones para mantener la misma forma que el POST.
    const updatedRole = await db.query.userRole.findFirst({
      where: eq(userRole.id, roleIdInt),
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

    console.log(`✅ Role ${roleIdInt} updated: isPrimary=${nextIsPrimary}`);

    return NextResponse.json(updatedRole);

  } catch (error) {
    console.error('❌ Error updating user role:', error);

    return NextResponse.json({
      error: 'Internal server error updating role',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
